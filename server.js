import express from 'express';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPage, contentFromPastedText, FetchError, normaliseUrl } from './lib/fetchPage.js';
import { analyseCopy } from './lib/heuristics.js';
import { buildReport, aiAvailable } from './lib/review.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const LEADS_FILE = process.env.LEADS_FILE || path.join(here, 'data', 'leads.jsonl');
const CHECKS_PER_HOUR = Number(process.env.CHECKS_PER_HOUR) || 6;

// Everything the front end shows about you (name, bio, services, results) lives in content/site.json.
const SITE_CONTENT = JSON.parse(readFileSync(path.join(here, 'content', 'site.json'), 'utf8'));

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(here, 'public'), { extensions: ['html'] }));

// --- tiny in-memory rate limiter and cache (fine for a single small server) ---
const hits = new Map();
function rateLimited(ip, limit = CHECKS_PER_HOUR, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}
const cache = new Map();
const CACHE_MS = 6 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) if (now - v.at > CACHE_MS) cache.delete(k);
  for (const [ip, times] of hits) if (!times.some((t) => now - t < 60 * 60 * 1000)) hits.delete(ip);
}, 10 * 60 * 1000).unref();

const trim = (v, n) => String(v ?? '').trim().slice(0, n);

app.get('/api/config', (_req, res) => {
  res.json({ ...SITE_CONTENT, aiEnabled: aiAvailable() });
});

app.post('/api/check', async (req, res) => {
  const body = req.body || {};
  const audience = {
    customer: trim(body.customer, 300),
    services: trim(body.services, 600),
    pageType: ['homepage', 'service', 'other'].includes(body.pageType) ? body.pageType : 'homepage',
    problem: trim(body.problem, 300),
    action: trim(body.action, 200),
    different: trim(body.different, 300),
  };
  const pasted = trim(body.pastedCopy, 30000);
  const urlInput = trim(body.url, 500);

  try {
    let url = '';
    if (urlInput) url = normaliseUrl(urlInput).toString();
    if (!url && !pasted) return res.status(400).json({ error: 'Enter your homepage address (or paste your copy).' });

    const key = JSON.stringify([url, pasted.length ? pasted : null, audience]);
    const cached = cache.get(key);
    if (cached) return res.json(cached.report);

    if (rateLimited(req.ip)) {
      return res.status(429).json({ error: "You've run a lot of checks this hour. Take a breather and try again soon (or just get in touch!)." });
    }

    const content = pasted.length >= 200 ? contentFromPastedText(pasted, url) : await fetchPage(url);
    const findings = analyseCopy(content, audience);

    if (findings.wordCount < 40) {
      return res.status(422).json({
        error: "We could only find a handful of words on that page. It may be built in a way we can't read (lots of sites load their text with JavaScript). Paste your homepage copy instead and we'll check that.",
        code: 'too_little_text',
      });
    }

    const report = await buildReport(content, findings, audience);
    cache.set(key, { at: Date.now(), report });
    res.json(report);
  } catch (err) {
    if (err instanceof FetchError) {
      return res.status(422).json({ error: err.message, code: err.code });
    }
    console.error('[check] failed:', err);
    res.status(500).json({ error: 'Something went wrong on our side. Please try again in a minute.' });
  }
});

// Leads: saved to a local file and optionally forwarded to a webhook (Zapier, Make, Slack, etc.)
app.post('/api/lead', async (req, res) => {
  const body = req.body || {};
  if (body.website_hp) return res.json({ ok: true }); // honeypot field for bots
  const lead = {
    at: new Date().toISOString(),
    name: trim(body.name, 120),
    email: trim(body.email, 200),
    website: trim(body.website, 300),
    services: (Array.isArray(body.services) ? body.services : [body.services]).filter(Boolean).map((x) => trim(x, 80)).slice(0, 8),
    otherCopywriters: trim(body.otherCopywriters, 120),
    message: trim(body.message, 2000),
    url: trim(body.url, 500),
    beigeScore: Number.isFinite(Number(body.beigeScore)) ? Number(body.beigeScore) : null,
    swatch: trim(body.swatch, 60),
    summary: trim(body.summary, 1000),
  };
  if (!lead.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    return res.status(400).json({ error: 'Please add your name and a valid email address.' });
  }
  if (rateLimited(`lead:${req.ip}`, 5)) return res.status(429).json({ error: 'Too many messages. Please try again later.' });

  try {
    await fs.mkdir(path.dirname(LEADS_FILE), { recursive: true });
    await fs.appendFile(LEADS_FILE, `${JSON.stringify(lead)}\n`);
  } catch (err) {
    console.error('[lead] could not save lead:', err.message);
  }
  if (process.env.LEAD_WEBHOOK_URL) {
    try {
      const text = `New Beige-o-Meter enquiry: ${lead.name} <${lead.email}> | ${lead.website || lead.url} | interested in: ${lead.services.join(', ') || '-'} | other copywriters: ${lead.otherCopywriters || '-'} | beige score ${lead.beigeScore} (${lead.swatch})\n${lead.message}\n\nReport: ${lead.summary}`;
      await fetch(process.env.LEAD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        // _subject is used by Formspree for the email subject line; other services ignore it.
        body: JSON.stringify({ ...lead, text, _subject: `New Beige-o-Meter enquiry from ${lead.name}` }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      console.error('[lead] webhook failed:', err.message);
    }
  }
  console.log(`[lead] ${lead.name} <${lead.email}> ${lead.url}`);
  res.json({ ok: true });
});

// Simple protected export of leads: /api/leads?key=YOUR_ADMIN_KEY
app.get('/api/leads', async (req, res) => {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) return res.status(404).end();
  try {
    const raw = await fs.readFile(LEADS_FILE, 'utf8');
    res.json(raw.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).reverse());
  } catch {
    res.json([]);
  }
});

app.listen(PORT, () => {
  if (!process.env.LEAD_WEBHOOK_URL) {
    console.warn('[lead] LEAD_WEBHOOK_URL is not set: enquiries are only saved to a local file, which some hosts wipe on restart.');
  }
  console.log(`${SITE_CONTENT.appName} running at http://localhost:${PORT} (AI review ${aiAvailable() ? 'ON' : 'OFF - rule-based only'})`);
});
