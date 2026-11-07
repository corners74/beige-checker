# Beige-o-Meter 🎨

**Is your website copy beige?** A free website first-impressions checker that turns curious business owners into copywriting leads.

A visitor enters their homepage URL and answers four quick questions about their audience. The app reads the page and tells them:

- **Their beige rating** on a paint-chip scale: *Hospital Magnolia → Corporate Oatmeal → Polite Greige → Warm Toast → Paprika → Electric Tangerine*
- **The five-second take:** what a first-time visitor actually picks up, and what they'd guess the business does
- **"Here's what your customer actually needs to know":** a rewritten above-the-fold headline, subheadline, three points and a button
- **Three practical fixes**, each with a worked example
- **A scorecard** for clarity, value proposition, calls to action and customer focus
- **The beige bits:** real quotes from their page flagged as beige, waffle, repetition, vague promise, filler, jargon, complexity or we-focused, each with a suggested rewrite

…followed by a "let's fix it together" pitch and an enquiry form. There's no email list involved: enquiries go straight to you.

## How it works

1. **Fetch** (`lib/fetchPage.js`): downloads the homepage (blocking private and internal addresses), then pulls out the title, meta description, headings, hero, buttons, nav and body copy. If a site can't be read (some are built in ways that hide their text from tools like this), the visitor can paste their copy instead.
2. **Measure** (`lib/heuristics.js`): rule-based checks for beige and AI-sounding phrases ("unlock your potential", "seamless", "tailored solutions"…), vague promises, filler words, jargon, repeated phrases, we-vs-you ratio, reading ease, sentence length, weak button text and missing specifics.
3. **Review** (`lib/review.js`): Claude reads the page, the measurements and the owner's answers, and returns the structured report. It quotes the page exactly and uses `[placeholders]` instead of inventing facts. If there's no API key, or the AI call fails, the app falls back to a rule-based report, so it never breaks.

## Run it locally

Needs Node.js 20 or newer.

```bash
npm install
```

```bash
cp .env.example .env
```

Fill in `.env` (at minimum `ANTHROPIC_API_KEY`, `COPYWRITER_NAME` and `BOOKING_URL`), then:

```bash
node --env-file=.env server.js
```

Open http://localhost:3000.

Run the tests:

```bash
npm test
```

## Deploy

Any Node host works: Render, Railway, Fly.io, a small VPS. Set the variables from `.env.example` in the host's dashboard and use `npm start` as the start command.

**Leads:** saved to `data/leads.jsonl`, but many hosts wipe files on redeploy. Set `LEAD_WEBHOOK_URL` so each enquiry is also sent somewhere permanent. A Zapier or Make "catch hook" that emails you or adds a row to a Google Sheet takes five minutes to set up.

**Cost:** one check is one Claude request (roughly 5–10k input tokens plus the report). Results are cached for 6 hours per URL and answers, and each visitor is limited to `CHECKS_PER_HOUR` checks. Set a monthly spend limit in the Anthropic Console as a backstop.

## Customising

- **Your details and offer:** environment variables (see `.env.example`)
- **Wording, colours and layout:** `public/index.html`, `public/styles.css`
- **Beige phrase lists:** `BEIGE_PHRASES`, `VAGUE_PROMISES`, `FILLER_WORDS` and `JARGON` in `lib/heuristics.js`
- **Paint-chip names:** `SWATCHES` in `lib/heuristics.js` (and their colours in `public/app.js`)
- **The reviewer's voice and rules:** `SYSTEM_PROMPT` in `lib/review.js`
