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
