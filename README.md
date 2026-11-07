# Beige-o-Meter 🎨

**Is your website copy beige?** A free website first-impressions checker that turns curious business owners into copywriting leads.

## 👀 Just want a look?

Open the preview: https://claude.ai/artifact/AKnKNEGzsBVu7hKHJe3ahb (private to you until you share it). Paste any homepage copy, or click **Try sample copy**. The preview can't fetch websites or send enquiries; everything else works. To rebuild it after changes, run `npm run build:preview`.

## 🚀 Put it online (no coding needed, about 15 minutes)

You'll set up three free accounts, copy a few codes, then press one button.

### Step 1: Get your AI key (this powers the reports)
1. Go to **console.anthropic.com** and sign up.
2. Add a little credit under **Billing**. Each check costs a few cents. Set a **monthly limit** while you're there so there are no surprises.
3. Go to **API Keys**, click **Create Key**, and copy it somewhere safe (it starts with `sk-ant-`).

### Step 2: Get enquiries sent to your inbox
1. Go to **formspree.io** and sign up (free).
2. Click **New Form**, give it a name like "Beige-o-Meter", and enter the email address enquiries should go to.
3. Copy the form's link. It looks like `https://formspree.io/f/abcd1234`.

### Step 3: Press the button
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/corners74/beige-checker)

1. Sign up to Render using **"Sign in with GitHub"**, and allow it to see this project.
2. Render will ask for a few details. Paste in:
   - **ANTHROPIC_API_KEY**: your key from Step 1
   - **COPYWRITER_NAME**: your name, as visitors should see it
   - **CONTACT_EMAIL**: your email address
   - **LEAD_WEBHOOK_URL**: your Formspree link from Step 2
   - **BOOKING_URL**: your Calendly/TidyCal link (or leave blank)
   - **COPYWRITER_WEBSITE**: your website address (or leave blank)
3. Click **Apply** / **Deploy** and wait a few minutes.
4. Render shows your app's web address (something like `beige-o-meter.onrender.com`). That's your live app. 🎉

**Good to know**
- On Render's free plan, the app falls asleep when nobody has used it for a while, so the first visit after a quiet spell takes about a minute to load. Upgrading to the cheapest paid plan (about US$7/month) keeps it awake.
- To use your own address (like `beige.yourbusiness.co.nz`), see **Settings → Custom Domains** in Render.
- Need to change a detail later? In Render, open your app → **Environment**, edit the value, and save. It restarts by itself.

---

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

## For developers: run it locally

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
