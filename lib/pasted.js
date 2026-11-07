// Reads copy a visitor pasted in. No dependencies, so it also runs in the browser preview.

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

export const CTA_WORDS = /\b(book|buy|call|contact|start|get|try|shop|order|join|sign ?up|subscribe|enquire|enquiry|quote|download|schedule|talk|chat|request|register|apply|learn more|find out|discover|see|view|explore|hire|claim|reserve)\b/i;

/** Builds the same shape from copy a user pasted in (for sites we cannot fetch). */
export function contentFromPastedText(text, pageUrl = '') {
  const lines = String(text || '').split(/\n+/).map(clean).filter(Boolean);
  const paragraphs = lines.filter((l) => l.split(' ').length >= 6);
  const shortLines = lines.filter((l) => l.split(' ').length < 6);
  return {
    url: pageUrl,
    title: '',
    metaDescription: '',
    hero: lines[0] || '',
    headings: lines.slice(0, 1).map((t) => ({ level: 'h1', text: t })),
    ctas: shortLines.filter((l) => CTA_WORDS.test(l)).slice(0, 15),
    navItems: [],
    paragraphs: paragraphs.slice(0, 80),
    bodyText: lines.join(' ').slice(0, 20000),
  };
}
