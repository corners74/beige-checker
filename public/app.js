const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of children.flat()) {
    if (child != null) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
};

// Paint colours from beige (most beige) to bold, matching the server's swatch names.
const SWATCH_COLOURS = {
  'Hospital Magnolia': '#f4eee3',
  'Corporate Oatmeal': '#e3d6bf',
  'Polite Greige': '#cfc3ae',
  'Warm Toast': '#d9a46a',
  Paprika: '#e0602b',
  'Electric Tangerine': '#ff5a1f',
};
const STRIP_ORDER = ['Hospital Magnolia', 'Corporate Oatmeal', 'Polite Greige', 'Warm Toast', 'Paprika', 'Electric Tangerine'];

const SCORE_LABELS = {
  clarity: 'Clarity',
  valueProposition: 'Value proposition',
  callsToAction: 'Calls to action',
  customerFocus: 'Customer focus',
  trust: 'Trust & credibility (E-E-A-T)',
  searchBasics: 'Search basics (SEO)',
  aiReadiness: 'AI search readiness',
};

// Embedded in another site (e.g. a WordPress page) via <iframe src=".../?embed=1">.
const EMBEDDED = new URLSearchParams(location.search).has('embed') && window.parent !== window;
if (EMBEDDED) document.documentElement.classList.add('embedded');
const tellParent = (msg) => { if (EMBEDDED) window.parent.postMessage({ source: 'beige-o-meter', ...msg }, '*'); };
if (EMBEDDED && 'ResizeObserver' in window) {
  let last = 0;
  new ResizeObserver(() => {
    const h = Math.ceil(document.body.getBoundingClientRect().height);
    if (Math.abs(h - last) > 2) { last = h; tellParent({ type: 'height', height: h }); }
  }).observe(document.body);
}
// Inside an auto-height iframe, in-page links must ask the host page to scroll.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || !EMBEDDED) return;
  const target = document.querySelector(a.getAttribute('href'));
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: 'smooth' });
  tellParent({ type: 'scroll', offset: target.getBoundingClientRect().top + window.scrollY });
});

const LOADING_LINES = [
  'Reading your homepage…',
  'Squinting at it like a first-time visitor…',
  'Counting how many times you said "seamless"…',
  'Looking for the bit that says what you actually do…',
  'Checking whether each of your services gets a look-in…',
  'Looking for reasons to trust you…',
  'Checking what Google sees…',
  'Asking whether ChatGPT could recommend you…',
  'Hunting for waffle…',
  'Writing what your customer actually needs to know…',
  'Mixing paint colours…',
];

let config = {};
let lastReport = null;
let lastUrl = '';
let lastPayload = {};

const PAGE_TYPES = { homepage: 'Homepage', service: 'Service page', other: 'Other page', draft: 'Draft copy' };
const store = {
  get(k) { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

async function loadConfig() {
  try {
    config = await (await fetch('/api/config')).json();
  } catch {
    config = {};
  }
  document.querySelectorAll('[data-config]').forEach((node) => {
    const value = getPath(config, node.dataset.config);
    if (typeof value === 'string' && value) node.textContent = value;
  });
  document.querySelectorAll('[data-config-link]').forEach((node) => {
    const value = getPath(config, node.dataset.configLink);
    if (value) node.href = value;
  });
  if (config.appName) document.title = `${config.appName} · Is your website copy beige?`;
  // Promotion (bio, services, results, enquiry form) only when switched on in content/site.json.
  document.querySelectorAll('[data-promo]').forEach((node) => { node.hidden = !config.showPromotion; });
  $('#done-for-you').hidden = Boolean(config.showPromotion) || !config.doneForYou;
  if (config.passwordRequired) {
    $('#password-wrap').hidden = false;
    $('#accessPassword').value = store.get('bom-password');
  }
  renderAbout();
}

function renderAbout() {
  if (config.photo) {
    const img = $('#about-photo');
    img.src = config.photo;
    img.alt = config.copywriterName || '';
    img.hidden = false;
  }
  $('#bio').replaceChildren(...(config.bio || []).map((p) => el('p', {}, p)));

  const services = config.services || [];
  $('#service-grid').replaceChildren(...services.map((s) => el('a', { class: 'service-card', href: s.url, target: '_blank', rel: 'noopener' },
    el('strong', {}, s.name),
    el('span', {}, s.line),
    el('span', { class: 'more' }, 'Find out more →'),
  )));
  $('#service-choices').replaceChildren(...services.map((s, i) => el('label', { class: 'choice' },
    el('input', { type: 'checkbox', name: 'services', value: s.name, id: `svc-${i}` }),
    ` ${s.name}`,
  )));

  $('#results-grid').replaceChildren(...(config.results || []).map((r) => el('figure', { class: 'result-card' },
    el('p', { class: 'result-headline' }, `“${r.headline}”`),
    r.quote ? el('blockquote', {}, `“${r.quote}”`) : null,
    el('figcaption', {}, el('strong', {}, r.name), r.business ? `, ${r.business}` : ''),
  )));

  $('#good-fit').replaceChildren(...(config.goodFit || []).map((t) => el('li', {}, t)));
  $('#not-fit').replaceChildren(...(config.notAFit || []).map((t) => el('li', {}, t)));
  $('#lead-success').textContent = config.enquiry?.success || 'Thanks! Your message is on its way.';
}

function showError(target, message) {
  const node = $(target);
  node.textContent = message;
  node.hidden = !message;
}

function show(section) {
  for (const id of ['intro', 'loading', 'results']) $(`#${id}`).hidden = id !== section;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  tellParent({ type: 'scroll', offset: 0 });
}

function goStep(n) {
  document.querySelectorAll('.step').forEach((s) => { s.hidden = s.dataset.step !== String(n); });
  const first = document.querySelector(`.step[data-step="${n}"] input, .step[data-step="${n}"] textarea`);
  first?.focus();
}

$('#toggle-paste').addEventListener('click', () => {
  const wrap = $('#paste-wrap');
  wrap.hidden = !wrap.hidden;
  if (!wrap.hidden) $('#pastedCopy').focus();
});

$('#to-step-2').addEventListener('click', () => {
  const draft = $('#pt-draft').checked;
  const url = draft ? '' : $('#url').value.trim();
  const pasted = $('#pastedCopy').value.trim();
  if (config.passwordRequired && !$('#accessPassword').value.trim()) {
    showError('#form-error', 'Enter the password to use the Beige-o-Meter.');
    $('#accessPassword').focus();
    return;
  }
  if (!url && pasted.length < 200) {
    showError('#form-error', pasted ? 'Please paste a bit more of your copy (at least a few paragraphs).' : draft ? 'Paste your draft to get started.' : 'Enter your web page address to get started.');
    return;
  }
  showError('#form-error', '');
  goStep(2);
});
$('#url').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('#to-step-2').click(); }
});
$('#back-step-1').addEventListener('click', () => goStep(1));

// Draft copy has no web address: show the paste box instead.
function syncDraftMode() {
  const draft = $('#pt-draft').checked;
  $('#url-wrap').hidden = draft;
  $('#toggle-paste').hidden = draft;
  if (draft) $('#paste-wrap').hidden = false;
  // The Next button normally sits beside the address box; in draft mode it goes under the paste box.
  const next = $('#to-step-2');
  if (draft && !next.closest('#draft-next')) {
    let holder = $('#draft-next');
    if (!holder) { holder = el('div', { id: 'draft-next', class: 'draft-next' }); $('#paste-wrap').after(holder); }
    syncDraftMode.home = next.parentElement; // remember where it lives, so it can go back
    holder.append(next);
  } else if (!draft && next.closest('#draft-next')) {
    (syncDraftMode.home || $('.url-row')).append(next);
  }
  $('label[for="pastedCopy"]').textContent = draft
    ? 'Paste your draft (headline first, one heading or paragraph per line)'
    : "Paste the page's text (headline first, one heading or paragraph per line)";
}
document.querySelectorAll('input[name="pageType"]').forEach((r) => r.addEventListener('change', syncDraftMode));

// Suggest "Service page" when the address goes beyond the homepage.
$('#url').addEventListener('change', () => {
  try {
    const raw = $('#url').value.trim();
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const isHome = u.pathname === '/' || u.pathname === '';
    if (!isHome && $('#pt-home').checked) $('#pt-service').checked = true;
    if (isHome && $('#pt-service').checked) $('#pt-home').checked = true;
  } catch { /* not a full address yet */ }
});

$('#check-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const payload = Object.fromEntries(form.entries());
  if (payload.pageType === 'draft') payload.url = '';
  lastPayload = payload;
  if (!payload.customer?.trim() || !payload.services?.trim()) {
    showError('#form-error', 'Tell us who your customer is and what services you offer. It makes the feedback far more useful.');
    return;
  }
  showError('#form-error', '');
  lastUrl = payload.url;
  show('loading');

  let i = 0;
  const msg = $('#loading-msg');
  msg.textContent = LOADING_LINES[0];
  const timer = setInterval(() => {
    i = (i + 1) % LOADING_LINES.length;
    msg.textContent = LOADING_LINES[i];
  }, 3200);

  try {
    const res = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Access-Password': $('#accessPassword').value.trim() },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      show('intro');
      goStep(1);
      if (['too_little_text', 'http_error', 'not_html'].includes(data.code)) $('#paste-wrap').hidden = false;
      if (data.code === 'bad_password') $('#accessPassword').focus();
      showError('#form-error', data.error || 'Something went wrong. Please try again.');
      return;
    }
    if (config.passwordRequired) store.set('bom-password', $('#accessPassword').value.trim());
    lastReport = data;
    renderReport(data);
    show('results');
  } catch {
    show('intro');
    showError('#form-error', "We couldn't connect. Check your internet and try again.");
  } finally {
    clearInterval(timer);
  }
});

function barColour(score) {
  if (score >= 70) return 'var(--good)';
  if (score >= 45) return 'var(--warn)';
  return 'var(--bad)';
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function renderReport(r) {
  const forWhom = lastPayload.businessName || hostOf(r.page.url) || '';
  const date = new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });
  $('#report-meta').textContent = [
    `${PAGE_TYPES[lastPayload.pageType] || 'Page'} report${forWhom ? ` for ${forWhom}` : ''}`,
    date,
    config.businessName ? `Prepared by ${config.businessName}` : '',
  ].filter(Boolean).join(' · ');

  const colour = SWATCH_COLOURS[r.swatch.name] || '#e3d6bf';
  $('#paint-colour').style.background = colour;
  $('#swatch-name').textContent = r.swatch.name;
  $('#beige-score').textContent = r.beigeScore;
  $('#swatch-blurb').textContent = r.swatch.blurb;
  $('#page-host').textContent = hostOf(r.page.url) || 'your copy';
  $('#five-second-take').textContent = r.fiveSecondTake;
  $('#what-they-think').textContent = r.whatTheyThinkYouDo;

  $('#strip').replaceChildren(...STRIP_ORDER.map((name) => el('span', {
    class: name === r.swatch.name ? 'on' : '',
    style: `background:${SWATCH_COLOURS[name]}`,
    title: name,
  })));

  $('#beige-card-chip').style.background = colour;
  $('#beige-card-name').textContent = r.swatch.name;
  $('#beige-card-score').textContent = r.beigeScore;
  const b = r.beigeBreakdown || {};
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  $('#beige-counts').replaceChildren(...[
    plural(b.stockPhrases ?? 0, 'stock phrase', 'stock phrases'),
    plural(b.vaguePromises ?? 0, 'vague promise', 'vague promises'),
    plural(b.fillerWords ?? 0, 'filler word', 'filler words'),
    plural(b.jargon ?? 0, 'jargon word', 'jargon words'),
    plural(b.repeatedPhrases ?? 0, 'repeated phrase', 'repeated phrases'),
    `${b.specifics ?? 0} specifics (numbers, timeframes)`,
  ].map((t) => el('span', {}, t)));

  const notice = $('#ai-notice');
  notice.hidden = !r.aiError;
  notice.textContent = r.aiError || '';

  const n = r.customerNeedsToKnow;
  $('#need-headline').textContent = n.headline;
  $('#need-sub').textContent = n.subheadline;
  $('#need-points').replaceChildren(...n.points.map((p) => el('li', {}, p)));
  const svc = n.services || [];
  $('#need-services').hidden = !svc.length;
  $('#need-services').replaceChildren(...svc.map((s) => el('div', { class: 'mock-service' }, el('strong', {}, s.name), el('span', {}, s.line))));
  $('#need-cta').textContent = n.callToAction;

  $('#fixes').replaceChildren(...r.improvements.map((f) => el('li', {},
    el('h3', {}, f.title),
    el('p', {}, f.detail),
    f.example ? el('p', { class: 'example' }, f.example) : null,
  )));

  $('#scores').replaceChildren(...Object.entries(SCORE_LABELS).filter(([key]) => r.scores[key]).map(([key, label]) => {
    const s = r.scores[key];
    const has = typeof s.score === 'number';
    return el('div', { class: 'card score' },
      el('div', { class: 'score-top' }, el('h3', {}, label), el('b', {}, has ? `${s.score}` : '–')),
      el('div', { class: 'bar' }, has ? el('i', { style: `width:${s.score}%;background:${barColour(s.score)}` }) : null),
      el('p', {}, s.comment),
    );
  }));

  const renderChecks = (box, list, checks) => {
    $(box).hidden = !checks.length;
    $(list).replaceChildren(...checks.map((c) => el('li', { class: c.ok ? 'ok' : 'fail' },
      el('span', { class: 'mark', 'aria-label': c.ok ? 'Passed' : 'Needs work' }, c.ok ? '✓' : '✗'),
      el('span', {}, el('strong', {}, c.label), c.ok ? '' : ` ${c.fix}`),
    )));
  };
  renderChecks('#seo-checks', '#seo-list', r.searchChecks || []);
  renderChecks('#ai-checks', '#ai-list', r.aiChecks || []);

  $('#flags').replaceChildren(...r.flagged.map((f) => el('div', { class: 'card flag' },
    el('div', {}, el('blockquote', {}, `“${f.quote}”`), el('span', { class: 'tag' }, f.problem)),
    el('p', {}, f.why),
    el('p', { class: 'instead' }, `Try instead: ${f.tryInstead}`),
  )));
  if (!r.flagged.length) $('#flags').append(el('p', { class: 'muted' }, 'Nothing major to flag. Nice work.'));

  $('#doing-well').textContent = r.doingWell;

  const st = r.stats;
  $('#stats').replaceChildren(...[
    `${st.wordCount} words checked`,
    st.readingEase != null ? `Reading ease ${st.readingEase}/100` : null,
    st.averageSentenceLength ? `${st.averageSentenceLength} words per sentence` : null,
    `${st.beigePhrases} beige phrases`,
    `${st.fillerWords} filler words`,
  ].filter(Boolean).map((t) => el('span', {}, t)));

  if (r.page.url) $('#lead-website').value = r.page.url;
  $('#faqs').replaceChildren(...(r.faqs || []).map((f) => el('div', { class: 'faq card' }, el('h3', {}, f.question), el('p', {}, f.answer))));
  $('#brief-text').textContent = buildBrief(r);
  $('#brief-copied').hidden = true;
  renderShare(r);
}

function reportSummary(r) {
  const lines = [
    `My Beige-o-Meter results${r.page.url ? ` for ${r.page.url}` : ''}`,
    `Beige rating: ${r.swatch.name} (${r.beigeScore}% beige)`,
    `First impression: ${r.fiveSecondTake}`,
    '',
    'Scores:',
    ...Object.entries(SCORE_LABELS).filter(([k]) => r.scores[k]).map(([k, label]) => `- ${label}: ${typeof r.scores[k].score === 'number' ? `${r.scores[k].score}/100` : 'not checked'}`),
    '',
    'Top three fixes:',
    ...r.improvements.map((f, i) => `${i + 1}. ${f.title}`),
  ];
  return lines.join('\n');
}

// ---------- Brief for a web designer or AI tool ----------
function buildBrief(r) {
  const p = lastPayload;
  const out = [];
  const line = (t = '') => out.push(t);
  const heading = (t) => { line(); line(t.toUpperCase()); line('-'.repeat(t.length)); };
  line(`WEBSITE COPY BRIEF${p.businessName ? `: ${p.businessName}` : ''}`);
  line(r.page.url ? `Page: ${r.page.url} (${PAGE_TYPES[p.pageType] || 'Page'})` : `Page: ${p.pageType === 'draft' ? 'Draft copy (not published yet)' : `${PAGE_TYPES[p.pageType] || 'Page'} (pasted copy)`}`);
  line(`Prepared ${new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })} with the ${config.appName || 'Beige-o-Meter'}${config.businessName ? ` by ${config.businessName}` : ''}`);

  heading('Goal');
  line(`Make this page clearer, more specific and more trustworthy${p.customer ? ` for ${p.customer}` : ''}${p.action ? `, so more visitors ${p.action.replace(/^to /i, '')}` : ''}.`);
  if (p.tone) line(`Tone of voice: ${p.tone}.`);

  heading('1. Top priorities');
  r.improvements.forEach((f, i) => {
    line(`${i + 1}. ${f.title}`);
    line(`   ${f.detail}`);
    if (f.example) line(`   Example: ${f.example}`);
  });

  const n = r.customerNeedsToKnow;
  heading('2. New copy for the top of the page');
  line(`Headline: ${n.headline}`);
  line(`Subheadline: ${n.subheadline}`);
  line('Key points:');
  n.points.forEach((x) => line(`- ${x}`));
  if (n.services?.length) {
    line('Service links (one per service, each linking to its page):');
    n.services.forEach((x) => line(`- ${x.name}: ${x.line}`));
  }
  line(`Main button: ${n.callToAction}`);

  if (r.flagged.length) {
    heading('3. Wording to replace');
    r.flagged.forEach((f) => {
      line(`- Replace: "${f.quote}"`);
      line(`  With: ${f.tryInstead}`);
      line(`  Why: ${f.why}`);
    });
  }

  const seo = (r.searchChecks || []).filter((c) => !c.ok);
  if (seo.length) {
    heading('4. Search (SEO) fixes');
    seo.forEach((c) => line(`- ${c.label}: ${c.fix}`));
  }
  const ai = (r.aiChecks || []).filter((c) => !c.ok);
  if (ai.length) {
    heading(`${seo.length ? '5' : '4'}. AI search readiness fixes`);
    ai.forEach((c) => line(`- ${c.label}: ${c.fix}`));
  }

  if (r.faqs?.length) {
    heading('FAQ section to add');
    r.faqs.forEach((f) => { line(`Q: ${f.question}`); line(`A: ${f.answer}`); line(); });
  }

  heading('Notes');
  line('- Anything in [square brackets] is a fact to fill in before publishing.');
  line('- Keep the existing facts accurate: do not add claims, numbers or testimonials that are not true.');
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

$('#copy-brief').addEventListener('click', async () => {
  const text = $('#brief-text').textContent;
  try {
    await navigator.clipboard.writeText(text);
    $('#brief-copied').hidden = false;
  } catch {
    const range = document.createRange();
    range.selectNodeContents($('#brief-text'));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
});

$('#download-brief').addEventListener('click', () => {
  const blob = new Blob([$('#brief-text').textContent], { type: 'text/plain' });
  const name = (lastPayload.businessName || hostOf(lastReport?.page?.url) || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const a = el('a', { href: URL.createObjectURL(blob), download: `copy-brief-${name}.txt` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

// ---------- Share your rating ----------
const shareUrl = () => config.toolUrl || config.websiteUrl || location.origin;
const postText = (r) => `My website copy just got "${r.swatch.name}" (${r.beigeScore}% beige) on the Beige-o-Meter from ${config.businessName || 'Words by Cornelia'}. What colour is yours? ${shareUrl()}`;

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Draws a 1200×628 rating card (the size LinkedIn and Facebook use for link images). */
async function drawShareCard(r) {
  try { await document.fonts.ready; } catch { /* fonts optional */ }
  const W = 1200;
  const H = 628;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const ink = '#1f1b16';
  g.fillStyle = '#efe6d6';
  g.fillRect(0, 0, W, H);

  // Paint chip
  const colour = SWATCH_COLOURS[r.swatch.name] || '#e3d6bf';
  g.fillStyle = '#fffdf8';
  g.strokeStyle = ink;
  g.lineWidth = 4;
  g.beginPath(); g.roundRect(70, 70, 360, 488, 22); g.fill(); g.stroke();
  g.fillStyle = colour;
  g.beginPath(); g.roundRect(72, 72, 356, 330, [20, 20, 0, 0]); g.fill();
  g.fillStyle = ink;
  g.fillRect(72, 402, 356, 3);
  g.font = '600 26px Inter, system-ui, sans-serif';
  g.fillText(`${r.beigeScore}% beige`, 100, 450);
  g.font = '500 20px Inter, system-ui, sans-serif';
  g.fillStyle = '#5a5146';
  g.fillText('Beige-o-Meter paint chart', 100, 490);

  // Text
  g.fillStyle = '#ff5a1f';
  g.font = '700 22px Inter, system-ui, sans-serif';
  g.fillText('MY WEBSITE COPY IS…', 490, 130);
  g.fillStyle = ink;
  const name = r.swatch.name;
  let size = 84;
  g.font = `900 ${size}px Fraunces, Georgia, serif`;
  const wordsArr = name.split(' ');
  const lines = wordsArr.length > 1 ? [wordsArr.slice(0, Math.ceil(wordsArr.length / 2)).join(' '), wordsArr.slice(Math.ceil(wordsArr.length / 2)).join(' ')] : [name];
  while (lines.some((l) => g.measureText(l).width > 640) && size > 40) { size -= 4; g.font = `900 ${size}px Fraunces, Georgia, serif`; }
  lines.forEach((l, i) => g.fillText(l, 490, 220 + i * (size + 6)));

  // Paint strip with marker
  const stripY = 400;
  STRIP_ORDER.forEach((n, i) => {
    g.fillStyle = SWATCH_COLOURS[n];
    g.fillRect(490 + i * 106, stripY, 100, 22);
    if (n === r.swatch.name) { g.strokeStyle = ink; g.lineWidth = 4; g.strokeRect(487 + i * 106, stripY - 3, 106, 28); }
  });
  g.fillStyle = '#5a5146';
  g.font = '500 18px Inter, system-ui, sans-serif';
  g.fillText('beige', 490, stripY + 52);
  g.textAlign = 'right';
  g.fillText('bold', 1126, stripY + 52);
  g.textAlign = 'left';

  g.fillStyle = ink;
  g.font = '700 30px Fraunces, Georgia, serif';
  g.fillText('What colour is yours?', 490, 520);
  const logo = await loadImage(config.logo);
  if (logo) {
    const lh = 38;
    const lw = (logo.width / logo.height) * lh;
    g.drawImage(logo, W - 70 - lw, 535, lw, lh);
  }
  return c;
}

let shareCanvas = null;
async function renderShare(r) {
  $('#share-linkedin').href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl())}`;
  $('#share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl())}`;
  $('#post-fallback').hidden = true;
  try {
    shareCanvas = await drawShareCard(r);
    $('#share-image').src = shareCanvas.toDataURL('image/png');
  } catch (err) {
    console.warn('Could not draw share image', err);
    $('#share-image').hidden = true;
    $('#download-image').hidden = true;
  }
}

$('#download-image').addEventListener('click', () => {
  if (!shareCanvas || !lastReport) return;
  shareCanvas.toBlob((blob) => {
    const a = el('a', { href: URL.createObjectURL(blob), download: `beige-o-meter-${lastReport.swatch.name.toLowerCase().replace(/\s+/g, '-')}.png` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
});

$('#copy-post').addEventListener('click', async () => {
  if (!lastReport) return;
  const text = postText(lastReport);
  try {
    await navigator.clipboard.writeText(text);
    $('#share-hint').textContent = 'Copied! Paste it into your post, and add the image.';
  } catch {
    const box = $('#post-fallback');
    box.value = text;
    box.hidden = false;
    box.focus();
    box.select();
    $('#share-hint').textContent = 'Copy the text below (Ctrl+C or Cmd+C), then paste it into your post.';
  }
});

// PDF: the browser's print window has "Save as PDF". Open the collapsed checklist first so it prints.
$('#pdf-btn').addEventListener('click', () => {
  $('#seo-checks').open = true;
  $('#ai-checks').open = true;
  window.print();
});
window.addEventListener('beforeprint', () => { $('#seo-checks').open = true; $('#ai-checks').open = true; });

$('#lead-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());
  data.services = fd.getAll('services');
  if (!data.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) {
    showError('#lead-error', 'Please add your name and a valid email address.');
    return;
  }
  showError('#lead-error', '');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const res = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        url: lastReport?.page?.url || lastUrl,
        beigeScore: lastReport?.beigeScore,
        swatch: lastReport?.swatch?.name,
        summary: lastReport ? reportSummary(lastReport) : '',
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Something went wrong. Please try again, or use my contact page.');
    form.querySelectorAll('input, textarea, button').forEach((node) => { node.disabled = true; });
    $('#lead-success').hidden = false;
  } catch (err) {
    showError('#lead-error', err.message);
    button.disabled = false;
  }
});

$('#again-btn').addEventListener('click', () => {
  // Keep the business details and facts so the next page is quick to check.
  $('#url').value = '';
  $('#pastedCopy').value = '';
  syncDraftMode();
  goStep(1);
  show('intro');
});

loadConfig();
