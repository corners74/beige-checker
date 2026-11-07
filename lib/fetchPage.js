// Fetches a public homepage safely and pulls out the bits a visitor actually sees.
import dns from 'node:dns/promises';
import net from 'node:net';
import * as cheerio from 'cheerio';
import { CTA_WORDS } from './pasted.js';

export { contentFromPastedText } from './pasted.js';

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 5;

export class FetchError extends Error {
  constructor(message, code = 'fetch_failed') {
    super(message);
    this.code = code;
  }
}

/** Accepts "example.com", "www.example.com/about", "https://…" and returns a URL object. */
export function normaliseUrl(input) {
  let raw = String(input || '').trim();
  if (!raw) throw new FetchError('Please enter your homepage address.', 'bad_url');
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchError("That doesn't look like a web address. Try something like yourbusiness.co.nz", 'bad_url');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new FetchError('Only http and https addresses work.', 'bad_url');
  if (url.username || url.password) throw new FetchError('Please remove any login details from the address.', 'bad_url');
  if (!url.hostname.includes('.') && !net.isIP(url.hostname)) {
    throw new FetchError("That doesn't look like a public website address.", 'bad_url');
  }
  return url;
}

/** True for loopback, private, link-local, CGNAT, multicast and other non-public ranges. */
export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower === '::' || lower === '::1' ||
      lower.startsWith('fc') || lower.startsWith('fd') ||
      lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb') ||
      lower.startsWith('ff')
    );
  }
  return true;
}

async function assertPublicHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new FetchError("We can only check public websites.", 'blocked_host');
  }
  let addresses;
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await dns.lookup(host, { all: true })).map((r) => r.address);
    } catch {
      throw new FetchError(`We couldn't find a website at ${host}. Check the spelling?`, 'dns_failed');
    }
  }
  if (!addresses.length || addresses.some(isPrivateAddress)) {
    throw new FetchError("We can only check public websites.", 'blocked_host');
  }
}

async function readCapped(response) {
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Fetches HTML, following redirects manually so every hop is checked. */
export async function fetchHtml(inputUrl) {
  let url = normaliseUrl(inputUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url.hostname);
    let response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BeigeOMeter/1.0; website copy checker)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en',
        },
      });
    } catch (err) {
      if (err.name === 'TimeoutError') throw new FetchError('Your site took too long to respond.', 'timeout');
      throw new FetchError("We couldn't reach that website. Is the address right?", 'unreachable');
    }
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      url = new URL(response.headers.get('location'), url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new FetchError('That site redirects somewhere we cannot follow.', 'bad_redirect');
      continue;
    }
    if (!response.ok) {
      throw new FetchError(`The site answered with an error (${response.status}). Some sites block automated visitors; you can paste your copy instead.`, 'http_error');
    }
    const type = response.headers.get('content-type') || '';
    if (!type.includes('html')) throw new FetchError("That address isn't a web page we can read.", 'not_html');
    return { html: await readCapped(response), finalUrl: url.toString() };
  }
  throw new FetchError('That site redirects too many times.', 'too_many_redirects');
}

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const uniq = (arr) => [...new Set(arr.filter(Boolean))];


/** Turns raw HTML into the structured copy a visitor would see. */
export function extractContent(html, pageUrl = '') {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, iframe, template, [hidden], [aria-hidden="true"]').remove();

  const title = clean($('title').first().text());
  const metaDescription = clean($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content'));

  const headings = [];
  $('h1, h2, h3').each((_, el) => {
    const text = clean($(el).text());
    if (text && text.length < 200) headings.push({ level: el.tagName.toLowerCase(), text });
  });

  const ctas = [];
  $('a, button, input[type="submit"], input[type="button"]').each((_, el) => {
    const $el = $(el);
    const text = clean($el.text() || $el.attr('value') || $el.attr('aria-label'));
    if (!text || text.length > 60) return;
    const inNav = $el.closest('nav, header [role="navigation"]').length > 0;
    const cls = `${$el.attr('class') || ''} ${$el.attr('id') || ''}`.toLowerCase();
    const looksLikeButton = el.tagName === 'button' || /\b(btn|button|cta)\b/.test(cls) || el.tagName === 'input';
    if (looksLikeButton || (!inNav && CTA_WORDS.test(text))) ctas.push(text);
  });

  const navItems = [];
  $('nav a').each((_, el) => navItems.push(clean($(el).text())));

  // Hero: the first heading plus the text that follows it.
  const firstH1 = $('h1').first();
  let hero = clean(firstH1.text());
  if (firstH1.length) {
    const nextText = clean(firstH1.parent().text());
    if (nextText.length > hero.length) hero = nextText.slice(0, 400);
  }

  const paragraphs = [];
  $('main p, article p, section p, p, li').each((_, el) => {
    const text = clean($(el).text());
    if (text.split(' ').length >= 6) paragraphs.push(text);
  });

  $('nav, footer').remove();
  const bodyText = clean($('body').text());

  return {
    url: pageUrl,
    title,
    metaDescription,
    hero,
    headings: headings.slice(0, 40),
    ctas: uniq(ctas).slice(0, 25),
    navItems: uniq(navItems).slice(0, 20),
    paragraphs: uniq(paragraphs).slice(0, 80),
    bodyText: bodyText.slice(0, 20000),
  };
}

export async function fetchPage(inputUrl) {
  const { html, finalUrl } = await fetchHtml(inputUrl);
  return extractContent(html, finalUrl);
}
