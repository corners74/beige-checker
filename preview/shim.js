// Preview-only glue: makes the app run inside a claude.ai page with no server.
// /api/* calls are answered in the browser; reports come from Claude through the
// page's `sample` capability when available, otherwise from the rule-based checks.
import { contentFromPastedText } from '../lib/pasted.js';
import { analyseCopy } from '../lib/heuristics.js';
import { ruleBasedReport, finaliseReport } from '../lib/ruleReport.js';
import { SYSTEM_PROMPT, REPORT_JSON_SCHEMA, SCORE_KEYS, buildUserMessage } from '../lib/reviewPrompt.js';
import SITE from '../content/site.json';

const SAMPLE_COPY = `Welcome to Acme Solutions
Unlock your potential with our innovative solutions.
In today's fast-paced world, we are passionate about delivering high-quality, tailored solutions that empower businesses to thrive. Our dedicated team of experts is committed to excellence.
We pride ourselves on our holistic approach. We leverage cutting-edge technology to seamlessly streamline your operations and take your business to the next level.
Whether you're a small business or a large enterprise, we've got you covered. We offer a wide range of innovative solutions tailored to your unique needs.
Our innovative solutions deliver the best results every step of the way.
Learn more`;

const SAMPLE_ANSWERS = {
  customer: 'owners of small accounting firms',
  services: 'Client onboarding software\nPractice management consulting\nStaff training',
  problem: 'onboarding new clients takes weeks of back-and-forth emails',
  action: 'book a 20-minute demo',
  different: 'set up in one afternoon, by people who used to run a practice',
};

const PREVIEW_CONFIG = {
  ...SITE,
  enquiry: { ...SITE.enquiry, success: 'This is a preview, so no message was sent. In the live app, this enquiry goes straight to your inbox.' },
  aiEnabled: true,
};

// Ask for the sample capability early; it resolves later (or null outside claude.ai).
const samplePromise = (async () => {
  try {
    return window.claude?.use ? await window.claude.use('sample') : null;
  } catch {
    return null;
  }
})();

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');

/** Light run-time check of Claude's JSON, since sample.json does not validate. */
function looksLikeReport(r) {
  return isObj(r) && str(r.fiveSecondTake) && isObj(r.customerNeedsToKnow) && Array.isArray(r.customerNeedsToKnow.points)
    && isObj(r.scores) && SCORE_KEYS.every((k) => isObj(r.scores[k]))
    && Array.isArray(r.flagged) && Array.isArray(r.improvements) && r.improvements.length > 0 && typeof r.beigeScore === 'number';
}

async function aiReport(content, findings, audience) {
  const sample = await samplePromise;
  if (!sample?.json) return null;
  const prompt = `${SYSTEM_PROMPT}

${buildUserMessage(content, findings, audience)}

Reply with only one JSON object that matches this JSON schema exactly (all fields required):
${JSON.stringify(REPORT_JSON_SCHEMA)}`;
  try {
    const report = await sample.json(prompt, { modelTier: 'default' });
    return looksLikeReport(report) ? report : null;
  } catch (err) {
    console.warn('AI review unavailable in preview:', err?.code || err);
    return null;
  }
}

async function check(body) {
  const pasted = str(body.pastedCopy).trim();
  if (pasted.length < 200) {
    return [422, { error: 'Paste a bit more of your homepage copy (a few paragraphs) to run the check.', code: 'too_little_text' }];
  }
  const audience = { customer: str(body.customer), services: str(body.services), problem: str(body.problem), action: str(body.action), different: str(body.different) };
  const content = contentFromPastedText(pasted, '');
  const findings = analyseCopy(content);
  if (findings.wordCount < 40) {
    return [422, { error: 'Paste a bit more of your homepage copy (a few paragraphs) to run the check.', code: 'too_little_text' }];
  }
  const ai = await aiReport(content, findings, audience);
  const report = finaliseReport(ai || ruleBasedReport(content, findings, audience), findings, content, ai ? 'ai' : 'rules', null);
  if (!ai) report.aiError = 'This preview could not reach Claude, so the report uses the built-in rule-based checks. The live app gives a fuller, AI-written review.';
  return [200, report];
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('/api/')) return realFetch(input, init);
  const body = init.body ? JSON.parse(init.body) : {};
  let status = 200;
  let data = {};
  if (url === '/api/config') data = PREVIEW_CONFIG;
  else if (url === '/api/check') [status, data] = await check(body);
  else if (url === '/api/lead') data = { ok: true };
  else status = 404;
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
};

// Page tweaks for the preview.
function setUpPreviewPage() {
  const q = (s) => document.querySelector(s);
  q('.url-row').hidden = true;
  q('label[for="url"]').textContent = 'Paste your homepage copy';
  q('#toggle-paste').hidden = true;
  q('#paste-wrap').hidden = false;
  q('label[for="pastedCopy"]').textContent = 'In the live app, visitors just type their web address. In this preview, paste the text from a homepage (headline first).';

  const actions = document.createElement('div');
  actions.className = 'preview-actions';
  const sampleBtn = document.createElement('button');
  sampleBtn.type = 'button';
  sampleBtn.className = 'btn btn-outline';
  sampleBtn.textContent = 'Try sample copy';
  sampleBtn.addEventListener('click', () => {
    q('#pastedCopy').value = SAMPLE_COPY;
    for (const [id, value] of Object.entries(SAMPLE_ANSWERS)) q(`#${id}`).value = value;
  });
  const nextBtn = q('#to-step-2');
  actions.append(sampleBtn, nextBtn);
  q('#paste-wrap').after(actions);

  // claude.ai pages can't open the print window, so the PDF button only works in the live app.
  q('#pdf-btn').hidden = true;
  q('#pdf-hint').textContent = 'In the live app, visitors can save their report as a PDF here.';

  const ribbon = document.createElement('p');
  ribbon.className = 'preview-ribbon';
  ribbon.textContent = 'Try it with any homepage copy. Nothing you enter is saved.';
  q('.topbar').after(ribbon);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setUpPreviewPage);
else setUpPreviewPage();
