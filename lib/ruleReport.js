// Rule-based report: used when AI is off or fails. No dependencies, so it also runs in the browser preview.
import { swatchFor } from './heuristics.js';

export const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
const list = (items, n = 3) => items.slice(0, n).map((h) => `"${h.phrase}"`).join(', ');

/** Report built from rules alone, used when AI is off or fails. */
export function splitServices(text) {
  return String(text || '').split(/\n|,|;|\band\b/).map((x) => x.trim()).filter(Boolean).slice(0, 5);
}

const SIGNAL_LABELS = {
  credentials: 'experience or qualifications',
  proof: 'testimonials, reviews or case studies',
  results: 'specific results (numbers)',
  authority: 'awards, memberships or media mentions',
  people: 'the person behind the business',
  contact: 'contact details',
  location: 'where you are or who you serve',
  guarantee: 'a guarantee or reassurance',
};

export function ruleBasedReport(content, findings, audience) {
  const services = splitServices(audience.services);
  const h1 = content.headings.find((h) => h.level === 'h1')?.text || content.hero || '';
  const flagged = [
    ...findings.beigePhrases.slice(0, 3).map((h) => ({ quote: h.phrase, problem: 'beige', why: `Used ${h.count}×. This could sit on any competitor's site unchanged.`, tryInstead: 'Replace with something only you could say: a result, a number, a named customer type.' })),
    ...findings.vaguePromises.slice(0, 2).map((h) => ({ quote: h.phrase, problem: 'vague promise', why: "Sounds good, means little. Visitors can't picture it or check it.", tryInstead: 'Say exactly what changes for the customer, e.g. "[result] in [timeframe]".' })),
    ...findings.fillerWords.slice(0, 2).map((h) => ({ quote: h.phrase, problem: 'filler', why: `Appears ${h.count}×. Cutting it makes the sentence stronger.`, tryInstead: 'Delete it and reread the sentence.' })),
    ...findings.repetition.slice(0, 1).map((h) => ({ quote: h.phrase, problem: 'repetition', why: `Repeated ${h.count} times.`, tryInstead: 'Say it once, well, then move on to proof.' })),
  ];

  const improvements = [];
  improvements.push({
    title: 'Make the headline say what you do and who it\'s for',
    detail: h1 ? `Your headline is "${h1.slice(0, 120)}". A stranger should know within five seconds what you offer, who it's for and what they get.` : 'We couldn\'t find a clear headline. Your first line should say what you offer, who it\'s for and what they get.',
    example: audience.customer && audience.problem ? `[What you do] for ${audience.customer}, so ${audience.problem.replace(/^(to )?/i, '')} stops being a problem.` : '[What you do] for [who], so they can [outcome].',
  });
  if (findings.beigePhrases.length || findings.vaguePromises.length) {
    improvements.push({
      title: 'Swap generic claims for specific proof',
      detail: `Phrases like ${list([...findings.beigePhrases, ...findings.vaguePromises])} could belong to anyone. Replace them with numbers, examples, timeframes and customer words.`,
      example: '"Trusted by [number] [customer type] in [place] since [year]."',
    });
  } else {
    improvements.push({ title: 'Add specific proof', detail: 'Back up your key claim with a number, a short testimonial or a concrete example.', example: '"[Customer name] went from [before] to [after] in [timeframe]."' });
  }
  improvements.push({
    title: 'Give visitors one obvious next step',
    detail: findings.weakCtas.length ? `Buttons like ${findings.weakCtas.slice(0, 3).map((c) => `"${c}"`).join(', ')} don't say what happens next.` : findings.ctas.length ? 'Pick one primary action and repeat it, using button text that says what they get.' : 'We couldn\'t find a clear call to action.',
    example: audience.action ? `A button that says exactly that: "${audience.action.slice(0, 40)}"` : '"Book your free 15-minute call"',
  });

  // If trust or search is the weakest area, make it the third fix.
  const missingTrust = Object.entries(findings.trust.signals).filter(([, v]) => !v).map(([k]) => SIGNAL_LABELS[k]);
  const failedSearch = findings.search ? findings.search.checks.filter((c) => !c.ok) : [];
  if (findings.scores.trust < 50 && missingTrust.length) {
    improvements[2] = {
      title: 'Give people reasons to trust you',
      detail: `We couldn't find ${missingTrust.slice(0, 3).join(', ')}. These are the E-E-A-T signals readers and Google look for before they choose you.`,
      example: '"[Name], [qualification], has helped [number] [customer type] since [year]." plus a short client quote with their name and town.',
    };
  } else if (findings.search && findings.search.score < 60 && failedSearch.length) {
    improvements[2] = {
      title: 'Fix the search basics',
      detail: failedSearch.slice(0, 3).map((c) => c.fix).join(' '),
      example: services.length ? `Page title: "${services[0]} in [your town] | [Business name]"` : 'Page title: "[Main service] in [your town] | [Business name]"',
    };
  }

  const s = findings.scores;
  return {
    fiveSecondTake: findings.issues[0] || 'The basics are in place. The question is whether your copy sounds like you or like everyone else.',
    whatTheyThinkYouDo: h1 ? `Based on your headline alone: "${h1.slice(0, 160)}"` : 'Hard to tell from the top of the page.',
    customerNeedsToKnow: {
      headline: services.length > 1 ? '[The outcome all your services share] for [who you help]' : '[What you do] for [who you help]',
      subheadline: audience.problem ? `So they can stop worrying about ${audience.problem.replace(/^(to )?/i, '')}.` : '[The outcome they get, in their words]',
      points: [
        audience.different ? `Why you: ${audience.different}` : 'Why you: [the one thing competitors can\'t claim]',
        'Proof: [a number, a result or a testimonial]',
        'What happens next: [the first step and how easy it is]',
      ],
      services: services.length > 1 ? services.map((name) => ({ name, line: '[What this service gets the customer, in one line]' })) : [],
      callToAction: audience.action ? audience.action.slice(0, 40) : 'Get in touch',
    },
    scores: {
      clarity: { score: s.clarity, comment: findings.readingEase !== null ? `Reading ease ${findings.readingEase}/100, average sentence ${findings.averageSentenceLength} words.` : 'Not enough copy to measure reading ease.' },
      valueProposition: { score: s.specificity, comment: findings.specifics.numbers ? `${findings.specifics.numbers} concrete numbers found.` : 'No concrete numbers or results found.' },
      callsToAction: { score: s.cta, comment: `${findings.ctas.length} call${findings.ctas.length === 1 ? '' : 's'} to action found${findings.weakCtas.length ? `, ${findings.weakCtas.length} of them vague` : ''}.` },
      customerFocus: { score: s.customerFocus, comment: `Leaving out your credentials and proof (those count towards trust), the copy says "you/your" ${findings.focus.you}× and "we/our/I" ${findings.focus.we}×.` },
      trust: { score: s.trust, comment: missingTrust.length ? `Missing: ${missingTrust.join(', ')}.` : 'All the main trust signals are there.' },
      searchBasics: findings.search
        ? { score: s.searchBasics, comment: failedSearch.length ? `To fix: ${failedSearch.map((c) => c.label.toLowerCase()).join(', ')}.` : 'The on-page basics are in place.' }
        : { score: null, comment: "Not checked: pasted copy doesn't include the page code. Enter a web address for this score." },
    },
    beigeScore: findings.beigeScore,
    flagged: flagged.slice(0, 8),
    improvements,
    doingWell: findings.ctas.length && !findings.weakCtas.length ? 'Your calls to action are clear about what happens next.' : findings.focus.youShare >= 55 ? 'You talk to the reader more than about yourself. Good instinct.' : 'You have a live website with real content to work with, which is more than many businesses manage.',
  };
}

/** Tidies any report (AI or rule-based) into the final shape the page renders. */
export function finaliseReport(report, findings, content, mode, aiError) {
  // Blend the AI's judgement with the measured score so the number stays grounded.
  const beigeScore = mode === 'ai' ? clamp(report.beigeScore * 0.7 + findings.beigeScore * 0.3) : clamp(findings.beigeScore);
  for (const key of Object.keys(report.scores)) {
    const sc = report.scores[key];
    sc.score = sc.score === null || sc.score === undefined ? null : clamp(sc.score);
  }
  report.customerNeedsToKnow.services = (report.customerNeedsToKnow.services || []).slice(0, 5);
  report.improvements = report.improvements.slice(0, 3);
  report.customerNeedsToKnow.points = report.customerNeedsToKnow.points.slice(0, 3);

  return {
    ...report,
    beigeScore,
    swatch: swatchFor(beigeScore),
    mode,
    aiError: aiError ? 'AI review unavailable, so this report uses our rule-based checks.' : null,
    page: { url: content.url, title: content.title },
    stats: {
      wordCount: findings.wordCount,
      readingEase: findings.readingEase,
      averageSentenceLength: findings.averageSentenceLength,
      we: findings.focus.we,
      you: findings.focus.you,
      beigePhrases: findings.beigePhrases.length,
      fillerWords: findings.fillerWords.reduce((n, h) => n + h.count, 0),
    },
    searchChecks: findings.search ? findings.search.checks.map(({ ok, label, fix }) => ({ ok, label, fix })) : null,
  };
}
