// Suggested Google page title and meta description: shared rules used by the server and the preview.
import { keywordMatch } from './heuristics.js';

export const TITLE_MAX = 60; // Google shows roughly 50–60 characters (about 580 pixels)
export const DESC_MAX = 155; // and roughly 150–160 for descriptions (about 920 pixels)

// Common initialisms that should stay in capitals even if typed in lowercase.
const ACRONYMS = new Set(['seo', 'nz', 'au', 'uk', 'usa', 'us', 'faq', 'faqs', 'b2b', 'b2c', 'diy', 'gst', 'ai', 'ppc', 'crm', 'hr', 'cbd', 'ceo', 'smb', 'sme', 'smes', 'llc', 'ltd', 'nzqa', 'eeat', 'aeo', 'geo', 'ux', 'ui', 'cpa', 'pr']);
const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'vs', 'via', 'with']);

/** Title Case that keeps acronyms (SEO, NZ) and brand spellings (iPhone), and lowercases small words mid-title. */
export function titleCase(text) {
  const tokens = String(text || '').trim().split(/(\s+)/);
  let startOfPhrase = true;
  return tokens.map((tok) => {
    if (/^\s+$/.test(tok)) return tok;
    if (/^[|:–—-]+$/.test(tok)) { startOfPhrase = true; return tok; }
    const core = tok.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
    let out = tok;
    if (ACRONYMS.has(core.toLowerCase())) {
      out = tok.replace(core, core.toLowerCase() === 'faqs' ? 'FAQs' : core.toUpperCase());
    } else if (/[A-Z].*[A-Z]|[a-z][A-Z]|\d/.test(core)) {
      out = tok; // SEO, NZ, iPhone, 24/7: keep as written
    } else if (!startOfPhrase && SMALL_WORDS.has(core.toLowerCase())) {
      out = tok.toLowerCase();
    } else {
      out = tok.toLowerCase().replace(/(^|[-/(“"'])([a-z])/g, (m, p, c) => p + c.toUpperCase());
    }
    startOfPhrase = /[:|–—]$/.test(tok);
    return out;
  }).join('');
}

/** Sentence case for a phrase: capital first letter, acronyms (SEO, NZ) in capitals, the rest as typed. */
export function sentenceCase(text) {
  const t = String(text || '').trim().replace(/[A-Za-z0-9]+/g, (w) => (ACRONYMS.has(w.toLowerCase()) ? (w.toLowerCase() === 'faqs' ? 'FAQs' : w.toUpperCase()) : w));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const normText = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Trims at a sentence end if possible, otherwise at a word boundary with an ellipsis. */
function trimTo(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (sentenceEnd > max * 0.6) return cut.slice(0, sentenceEnd + 1);
  return `${cut.slice(0, cut.lastIndexOf(' ', max - 1)).replace(/[,;:–—-]+$/, '')}…`;
}

/**
 * Makes a suggested title and description follow the rules: keyword first in the title,
 * Title Case, within the character limits, keyword somewhere in the description.
 */
export function finaliseMeta(meta, { keyword = '', businessName = '' } = {}) {
  const kw = String(keyword || '').trim();
  let title = titleCase(String(meta?.title || '').replace(/\s+/g, ' '));
  let description = String(meta?.description || '').replace(/\s+/g, ' ').trim();

  if (kw && !normText(title).startsWith(normText(kw))) {
    const kwTitle = titleCase(kw);
    const options = [`${kwTitle} | ${title}`, businessName && `${kwTitle} | ${businessName}`, kwTitle].filter(Boolean);
    title = options.find((o) => o.length <= TITLE_MAX) || kwTitle;
  }
  if (title.length > TITLE_MAX) {
    // Drop the brand part first ("… | Brand"), then trim.
    const parts = title.split(' | ');
    while (parts.length > 1 && parts.join(' | ').length > TITLE_MAX) parts.pop();
    title = parts.join(' | ');
    if (title.length > TITLE_MAX) title = title.slice(0, title.lastIndexOf(' ', TITLE_MAX)).replace(/[|,;:–—-]+$/, '').trim();
  }
  description = trimTo(description, DESC_MAX);
  if (description && /^[a-z]/.test(description)) description = description[0].toUpperCase() + description.slice(1);

  return {
    title,
    description,
    titleLength: title.length,
    descriptionLength: description.length,
    keywordInTitleStart: kw ? normText(title).startsWith(normText(kw)) : null,
    keywordInDescription: kw ? Boolean(keywordMatch(description, kw)) : null,
  };
}

/** A sensible starting point when there's no AI review. */
export function ruleBasedMeta(audience = {}, services = []) {
  const kw = audience.keyword || services[0] || '[Main Service] in [Your Town]';
  const brand = audience.businessName || '[Business Name]';
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  const who = audience.customer ? ` ${audience.customer}` : ' you';
  const where = audience.location ? ` (${audience.location.replace(/\.$/, '')})` : '';
  const next = audience.action ? `${cap(audience.action.replace(/\.$/, ''))} today.` : 'Get in touch today.';
  const lead = audience.keyword ? `${sentenceCase(audience.keyword)}: ` : '';
  return {
    title: `${kw} | ${brand}`,
    description: `${lead}${audience.businessName || 'We'} help${audience.businessName ? 's' : ''}${who}${where}. ${next}`,
  };
}
