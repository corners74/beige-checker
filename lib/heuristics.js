// Rule-based checks. These run on every page (no API key needed) and also feed
// the AI review so its feedback is grounded in what is actually on the page.

// Phrases that could sit on any business's website, often the fingerprints of generic AI copy.
export const BEIGE_PHRASES = [
  'unlock your potential', 'unlock the power', 'unleash', 'elevate your', 'take your business to the next level',
  'next level', 'in today\'s fast-paced world', 'in today\'s digital age', 'in today\'s competitive', 'ever-evolving',
  'ever-changing landscape', 'navigate the complexities', 'navigating the', 'seamless', 'seamlessly', 'cutting-edge',
  'state-of-the-art', 'world-class', 'best-in-class', 'industry-leading', 'innovative solutions', 'tailored solutions',
  'bespoke solutions', 'holistic approach', 'comprehensive solutions', 'one-stop shop', 'one stop shop', 'game-changer',
  'game changer', 'revolutionize', 'revolutionise', 'transform your', 'empower', 'empowering', 'synergy', 'leverage',
  'robust', 'streamline', 'harness the power', 'embark on a journey', 'your journey', 'journey to success', 'look no further',
  'we\'ve got you covered', 'whether you\'re a', 'dive into', 'delve', 'tapestry', 'realm', 'in the world of', 'beacon',
  'passionate about', 'we are passionate', 'dedicated team', 'team of experts', 'highly skilled', 'committed to excellence',
  'commitment to excellence', 'customer-centric', 'client-centric', 'results-driven', 'solutions-driven', 'value-added',
  'unparalleled', 'unrivalled', 'unrivaled', 'second to none', 'exceed your expectations', 'exceeding expectations',
  'peace of mind', 'quality service', 'high quality', 'high-quality', 'top quality', 'top-notch', 'excellence',
  'trusted partner', 'your trusted', 'go-to', 'we pride ourselves', 'take pride', 'look forward to', 'don\'t hesitate',
  'reach out', 'get in touch today', 'welcome to our website', 'welcome to',
  'solutions for all your', 'all your needs', 'every step of the way', 'from start to finish', 'at the forefront',
  'paradigm', 'game-changing', 'next-generation', 'future-proof', 'drive growth', 'drive results', 'meaningful impact',
  'make a difference', 'thrive', 'supercharge', 'skyrocket', 'curated', 'crafted with care', 'tailored to your needs',
  'tailored to your unique', 'unique needs', 'specific needs', 'needs and goals',
];

// Promises that sound like something but don't commit to anything checkable.
export const VAGUE_PROMISES = [
  'best results', 'great results', 'amazing results', 'real results', 'proven results', 'maximise', 'maximize',
  'optimise', 'optimize', 'grow your business', 'boost your', 'increase your', 'improve your', 'save time', 'save money',
  'achieve your goals', 'reach your goals', 'success', 'solutions', 'quality', 'value', 'satisfaction',
  'the best', 'best service', 'affordable', 'competitive prices', 'competitive pricing', 'fast and reliable',
  'reliable', 'professional', 'efficient', 'effective', 'exceptional', 'outstanding', 'superior', 'premium',
];

export const FILLER_WORDS = [
  'very', 'really', 'truly', 'actually', 'basically', 'simply', 'just', 'literally', 'totally', 'completely',
  'absolutely', 'extremely', 'incredibly', 'highly', 'quite', 'rather', 'somewhat', 'various', 'numerous',
  'a wide range of', 'a variety of', 'a range of', 'in order to', 'due to the fact that', 'at this point in time',
  'for all intents and purposes', 'needless to say', 'it goes without saying', 'whether you are', 'we believe that',
  'we strive to', 'strive', 'endeavour', 'endeavor', 'utilise', 'utilize', 'facilitate', 'in terms of', 'with regards to',
  'with regard to', 'moving forward', 'going forward',
];

export const JARGON = [
  'synergy', 'synergies', 'leverage', 'paradigm', 'scalable', 'ecosystem', 'bandwidth', 'deliverables', 'stakeholders',
  'actionable', 'value proposition', 'omnichannel', 'end-to-end', 'turnkey', 'best practice', 'best practices',
  'core competencies', 'mission-critical', 'disruptive', 'ideation', 'optimisation', 'optimization', 'methodology',
  'framework', 'deploy', 'onboarding', 'touchpoint', 'touchpoints', 'proactive', 'agile', 'granular',
];

const WEAK_CTAS = /^(submit|click here|learn more|read more|more|find out more|discover more|see more|explore|go|send|continue|here|more info|details|view more)$/i;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function countMatches(text, phrases) {
  const lower = text.toLowerCase().replace(/[’‘]/g, "'");
  const hits = [];
  for (const phrase of phrases) {
    const re = new RegExp(`(^|[^a-z])${escapeRe(phrase)}(?=[^a-z]|$)`, 'g');
    const n = (lower.match(re) || []).length;
    if (n) hits.push({ phrase, count: n });
  }
  // Drop phrases fully contained in a longer matched phrase with the same count (e.g. "seamless" inside "seamlessly").
  return hits
    .filter((h) => !hits.some((o) => o !== h && o.phrase.includes(h.phrase) && o.count >= h.count))
    .sort((a, b) => b.count - a.count);
}

export function words(text) {
  return (String(text).toLowerCase().replace(/[’‘]/g, "'").match(/[a-z][a-z'-]*/g) || []);
}

function sentences(text) {
  return String(text).split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).map((s) => s.trim()).filter((s) => words(s).length >= 3);
}

function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Flesch reading ease: 60–70 is plain English; under 50 is hard going for a homepage. */
export function readingEase(text) {
  const ws = words(text);
  const ss = sentences(text);
  if (ws.length < 30 || !ss.length) return null;
  const syl = ws.reduce((n, w) => n + syllables(w), 0);
  const score = 206.835 - 1.015 * (ws.length / ss.length) - 84.6 * (syl / ws.length);
  return Math.round(Math.max(0, Math.min(100, score)));
}

/** Repeated 2–5 word phrases, a quick proxy for waffle and copy-paste sections. */
export function repeatedPhrases(text, { min = 2, max = 5 } = {}) {
  const ws = words(text);
  const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'with', 'is', 'are', 'we', 'you', 'our', 'your', 'it', 'that', 'this', 'at', 'by', 'be', 'as']);
  const counts = new Map();
  for (let n = max; n >= min; n--) {
    for (let i = 0; i + n <= ws.length; i++) {
      const gram = ws.slice(i, i + n);
      if (STOP.has(gram[0]) || STOP.has(gram[n - 1])) continue;
      if (gram.filter((w) => !STOP.has(w)).length < 2) continue;
      const key = gram.join(' ');
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const repeated = [...counts.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  const kept = [];
  for (const [phrase, count] of repeated) {
    if (kept.some((k) => k.phrase.includes(phrase))) continue;
    kept.push({ phrase, count });
    if (kept.length >= 8) break;
  }
  return kept;
}

/** How often the copy talks about the business vs. the reader. */
export function focusRatio(text) {
  const ws = words(text);
  const WE = new Set(['we', "we're", "we've", "we'll", 'our', 'ours', 'us', 'ourselves', 'i', "i'm", "i've", 'my', 'me']);
  const YOU = new Set(['you', "you're", "you've", "you'll", 'your', 'yours', 'yourself', 'yourselves']);
  let we = 0;
  let you = 0;
  for (const w of ws) {
    if (WE.has(w)) we++;
    else if (YOU.has(w)) you++;
  }
  return { we, you, youShare: we + you ? Math.round((you / (we + you)) * 100) : null };
}

function hasSpecifics(text) {
  // Numbers, prices, timeframes, place names in caps etc. are signs of concrete claims.
  const numbers = (text.match(/\b\d[\d,.%$]*\b/g) || []).length;
  const timeframes = (text.match(/\b(\d+\s*(hours?|days?|weeks?|months?|years?|minutes?))\b/gi) || []).length;
  return { numbers, timeframes };
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Runs every check on extracted page content.
 * Returns raw findings plus a 0–100 "beige score" (100 = fully beige).
 */
export function analyseCopy(content) {
  const fullText = [content.hero, ...content.headings.map((h) => h.text), ...content.paragraphs].join('. ');
  const text = fullText.length > 200 ? fullText : content.bodyText || fullText;
  const ws = words(text);
  const wordCount = ws.length;
  const per100 = (n) => (wordCount ? (n / wordCount) * 100 : 0);

  const beige = countMatches(text, BEIGE_PHRASES);
  const vague = countMatches(text, VAGUE_PROMISES);
  const filler = countMatches(text, FILLER_WORDS);
  const jargon = countMatches(text, JARGON);
  const repetition = repeatedPhrases(text);
  const focus = focusRatio(text);
  const ease = readingEase(text);
  const specifics = hasSpecifics(text);

  const sents = sentences(text);
  const longSentences = sents.filter((s) => words(s).length > 28).slice(0, 5);
  const avgSentence = sents.length ? Math.round(wordCount / sents.length) : null;

  const ctas = content.ctas || [];
  const weakCtas = ctas.filter((c) => WEAK_CTAS.test(c.trim()));
  const h1s = content.headings.filter((h) => h.level === 'h1');

  const sum = (arr) => arr.reduce((n, h) => n + h.count, 0);
  const beigeDensity = per100(sum(beige));
  const vagueDensity = per100(sum(vague));
  const fillerDensity = per100(sum(filler));
  const jargonDensity = per100(sum(jargon));

  const issues = [];
  if (!h1s.length) issues.push('No main headline (H1) found, so visitors may not know what the page is about straight away.');
  if (h1s.length && words(h1s[0].text).length <= 2) issues.push(`Your main headline is just "${h1s[0].text}", which tells visitors very little.`);
  if (/^(welcome|home|hello|hi)\b/i.test(h1s[0]?.text || '')) issues.push(`Your headline opens with "${h1s[0].text.split(' ')[0]}", wasting the most valuable spot on the page.`);
  if (!ctas.length) issues.push('No clear call to action found. What should a visitor do next?');
  if (weakCtas.length) issues.push(`Vague button text: ${weakCtas.slice(0, 4).map((c) => `"${c}"`).join(', ')}.`);
  if (ctas.length > 12) issues.push(`${ctas.length} different calls to action compete for attention.`);
  if (focus.youShare !== null && focus.youShare < 45) issues.push(`The copy says "we/our/I" more than "you/your" (${focus.we} vs ${focus.you}).`);
  if (ease !== null && ease < 45) issues.push(`Reading ease is ${ease}/100, which is harder going than a homepage should be.`);
  if (avgSentence && avgSentence > 22) issues.push(`Sentences average ${avgSentence} words; aim for 15–20.`);
  if (!specifics.numbers && wordCount > 120) issues.push('No numbers, prices, timeframes or results anywhere, so every claim stays abstract.');
  if (!content.metaDescription) issues.push('No meta description, so Google will pick your search snippet for you.');

  // Scores: higher = better for categories; beige score: higher = more beige.
  const clarity = clamp(100 - (h1s.length ? 0 : 25) - fillerDensity * 6 - jargonDensity * 10 - (ease !== null && ease < 50 ? (50 - ease) : 0) - (avgSentence > 22 ? (avgSentence - 22) * 2 : 0));
  const ctaScore = clamp((ctas.length ? 80 : 15) - weakCtas.length * 12 - (ctas.length > 12 ? 15 : 0) + (ctas.length && !weakCtas.length ? 20 : 0));
  const customerFocus = clamp(focus.youShare === null ? 50 : focus.youShare * 1.4);
  const specificity = clamp(35 + specifics.numbers * 6 + specifics.timeframes * 8 - vagueDensity * 8 - beigeDensity * 10);
  const beigeScore = clamp(15 + beigeDensity * 22 + vagueDensity * 10 + fillerDensity * 4 + jargonDensity * 8 + (specifics.numbers ? 0 : 12) + (focus.youShare !== null && focus.youShare < 45 ? 10 : 0) + repetition.length * 2);

  return {
    wordCount,
    readingEase: ease,
    averageSentenceLength: avgSentence,
    focus,
    beigePhrases: beige.slice(0, 15),
    vaguePromises: vague.slice(0, 12),
    fillerWords: filler.slice(0, 12),
    jargon: jargon.slice(0, 10),
    repetition,
    longSentences,
    ctas,
    weakCtas,
    specifics,
    issues,
    scores: { clarity, cta: ctaScore, customerFocus, specificity },
    beigeScore,
  };
}

// The rating scale: paint-swatch names from beige to bold.
export const SWATCHES = [
  { max: 15, name: 'Electric Tangerine', blurb: 'Bold, specific and unmistakably you. Very little beige here.' },
  { max: 30, name: 'Paprika', blurb: 'Plenty of flavour, with a few bland patches to fix.' },
  { max: 45, name: 'Warm Toast', blurb: 'Some personality, but parts of your page could belong to anyone.' },
  { max: 60, name: 'Polite Greige', blurb: 'Inoffensive, forgettable, and easy for visitors to skim past.' },
  { max: 75, name: 'Corporate Oatmeal', blurb: 'Swap your logo for a competitor\'s and nobody would notice.' },
  { max: 101, name: 'Hospital Magnolia', blurb: 'Maximum beige. Your copy is blending into the wall.' },
];

export function swatchFor(score) {
  return SWATCHES.find((s) => score < s.max) || SWATCHES[SWATCHES.length - 1];
}
