import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractContent, contentFromPastedText, isPrivateAddress, normaliseUrl } from '../lib/fetchPage.js';
import { analyseCopy, swatchFor, readingEase, repeatedPhrases, focusRatio } from '../lib/heuristics.js';
import { BEIGE_HTML, SHARP_HTML } from './fixtures.js';

test('extracts headline, CTAs and body copy but not scripts or nav', () => {
  const c = extractContent(BEIGE_HTML, 'https://acme.example');
  assert.equal(c.title, 'Welcome | Acme Solutions');
  assert.equal(c.headings[0].text, 'Welcome to Acme');
  assert.ok(c.ctas.includes('Learn more'));
  assert.ok(!c.bodyText.includes('ignore me'));
  assert.ok(c.paragraphs.length >= 4);
});

test('beige copy scores beige; sharp copy scores bold', () => {
  const beige = analyseCopy(extractContent(BEIGE_HTML));
  const sharp = analyseCopy(extractContent(SHARP_HTML));
  assert.ok(beige.beigeScore > 60, `beige score ${beige.beigeScore}`);
  assert.ok(sharp.beigeScore < 35, `sharp score ${sharp.beigeScore}`);
  assert.ok(beige.beigePhrases.some((p) => p.phrase === 'unlock your potential'));
  assert.ok(beige.weakCtas.includes('Learn more'));
  assert.ok(beige.repetition.some((r) => r.phrase.includes('innovative solutions')));
  assert.ok(beige.issues.some((i) => i.includes('Welcome')));
  assert.ok(sharp.scores.customerFocus > beige.scores.customerFocus);
});

test('we/you ratio and reading ease', () => {
  assert.deepEqual(focusRatio('We help you. Our team helps your team.'), { we: 2, you: 2, youShare: 50 });
  assert.equal(readingEase('too short'), null);
  assert.equal(repeatedPhrases('red fox jumps. red fox jumps. red fox jumps.').length, 1);
});

test('swatches cover the full range', () => {
  assert.equal(swatchFor(0).name, 'Electric Tangerine');
  assert.equal(swatchFor(100).name, 'Hospital Magnolia');
});

test('pasted copy is analysed', () => {
  const c = contentFromPastedText('Grow your business\nWe offer seamless innovative solutions for all your needs and more.\nBook a call');
  assert.equal(c.hero, 'Grow your business');
  assert.ok(c.ctas.includes('Book a call'));
});

test('blocks private addresses and bad URLs', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.5', '172.20.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1', '100.64.0.1']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  assert.equal(isPrivateAddress('93.184.216.34'), false);
  assert.equal(normaliseUrl('example.co.nz').toString(), 'https://example.co.nz/');
  assert.throws(() => normaliseUrl('ftp://example.com'));
  assert.throws(() => normaliseUrl('intranet'));
  assert.throws(() => normaliseUrl('https://user:pw@example.com'));
});

import { trustSignals, searchChecks, CREDENTIAL_RE } from '../lib/heuristics.js';
import { ruleBasedReport, finaliseReport, splitServices } from '../lib/ruleReport.js';

test('credentials do not count against customer focus', () => {
  const html = `<html><head><title>Copywriter in Kerikeri | Words</title></head><body><h1>Website copy that wins you work</h1>
  <p>I have a BSc (Hons) and a Postgraduate Diploma in Marketing, and I have 30 years of experience in marketing.</p>
  <p>I founded my business in 2006 and I have worked with hundreds of service businesses since then.</p>
  <p>You get copy that sounds like you, brings your services to life, and helps your customers choose you over the rest.</p>
  <p>You'll know exactly what your website needs, and you can stop worrying about what to write.</p></body></html>`;
  const a = analyseCopy(extractContent(html, 'https://example.co.nz'));
  assert.ok(CREDENTIAL_RE.test('I have 30 years of experience in marketing.'));
  assert.equal(a.focus.we, 0, 'credential sentences excluded from the we-count');
  assert.equal(a.trust.signals.credentials, true);
});

test('trust signals and search checks', () => {
  const t = trustSignals('Rated 5 stars by 120 clients. Call 09 123 4567. Based in Auckland. Fully insured.', '', {});
  assert.equal(t.signals.contact, true);
  assert.equal(t.signals.guarantee, true);
  const c = extractContent(SHARP_HTML, 'https://tradie.example');
  const s = searchChecks(c, 80);
  assert.ok(s.checks.find((x) => x.label === 'One main heading (H1)').ok);
  assert.ok(!s.checks.find((x) => x.label === 'Enough words to rank').ok);
  assert.equal(searchChecks(contentFromPastedText('Hello there'), 10), null);
});

test('rule report handles several services and pasted copy', () => {
  assert.deepEqual(splitServices('Plumbing, Blocked drains\nGas fitting'), ['Plumbing', 'Blocked drains', 'Gas fitting']);
  const content = contentFromPastedText('Your local plumber\nWe fix leaks, clear blocked drains and do gas work across Tauranga for homeowners and landlords.\nGet a quote');
  const findings = analyseCopy(content);
  const r = finaliseReport(ruleBasedReport(content, findings, { services: 'Plumbing, Blocked drains, Gas fitting' }), findings, content, 'rules', null);
  assert.equal(r.customerNeedsToKnow.services.length, 3);
  assert.equal(r.scores.searchBasics.score, null);
  assert.equal(typeof r.scores.trust.score, 'number');
});

import { parseRobots } from '../lib/fetchPage.js';
import { aiReadinessChecks } from '../lib/heuristics.js';

test('robots.txt: AI crawler blocking', () => {
  assert.deepEqual(parseRobots('User-agent: *\nDisallow: /wp-admin/\n\nUser-agent: GPTBot\nUser-agent: CCBot\nDisallow: /\n'), ['GPTBot']);
  assert.ok(parseRobots('User-agent: *\nDisallow: /').includes('Googlebot'));
  assert.deepEqual(parseRobots('User-agent: *\nDisallow:\n'), []);
});

test('AI readiness checks', () => {
  const html = `<html><head><script type="application/ld+json">{"@type":"LocalBusiness","name":"X"}</script></head><body>
  <h1>Plumbing repairs in Tauranga</h1><p>Hi, I'm Dave. We fix leaks fast for Tauranga homeowners, with 25 years on the tools and 1,200 jobs done.</p>
  <h2>How much does a plumber cost?</h2><p>Call-outs start from $95 and most jobs take under 2 hours to finish properly.</p>
  <h2>Do you do gas work?</h2><p>Yes, we are certified gasfitters and can help with hobs, hot water and heaters.</p><h2>Areas we serve</h2></body></html>`;
  const content = extractContent(html, 'https://plumber.example');
  content.technical.robots = { found: true, blocked: ['GPTBot'] };
  const a = analyseCopy(content, { services: 'Plumbing repairs, Gas fitting' });
  const byLabel = Object.fromEntries(a.ai.checks.map((c) => [c.label, c.ok]));
  assert.equal(byLabel['Says plainly what you do, near the top'], true);
  assert.equal(byLabel['Answers customer questions'], true);
  assert.equal(byLabel['Tells AI tools who you are (structured data)'], true);
  assert.equal(byLabel['AI tools are allowed to read your site'], false);
  assert.ok(a.issues.some((i) => i.includes('GPTBot')));
  const pasted = aiReadinessChecks(contentFromPastedText('Hello\nSome words here about things we do for people in town.'), { specifics: { numbers: 0, timeframes: 0 }, trust: { signals: { people: false } } }, {});
  assert.equal(pasted.partial, true);
});
