const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else node.setAttribute(k, v);
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

const LOADING_LINES = [
  'Reading your homepage…',
  'Squinting at it like a first-time visitor…',
  'Counting how many times you said "seamless"…',
  'Looking for the bit that says what you actually do…',
  'Hunting for waffle…',
  'Checking whether you talk about "we" more than "you"…',
  'Comparing your copy to 1,000 other beige websites…',
  'Writing what your customer actually needs to know…',
  'Mixing paint colours…',
];

let config = {};
let lastReport = null;
let lastUrl = '';

async function loadConfig() {
  try {
    config = await (await fetch('/api/config')).json();
  } catch {
    config = {};
  }
  document.querySelectorAll('[data-config]').forEach((node) => {
    const value = config[node.dataset.config];
    if (value) node.textContent = value;
  });
  document.querySelectorAll('[data-config-link]').forEach((node) => {
    const value = config[node.dataset.configLink];
    if (value) node.href = value;
    else node.removeAttribute('href');
  });
  if (config.bookingUrl) {
    const link = $('#booking-link');
    link.href = config.bookingUrl;
    link.hidden = false;
  }
  if (config.contactEmail) {
    const fe = $('#footer-email');
    fe.href = `mailto:${config.contactEmail}`;
    fe.textContent = config.contactEmail;
    fe.hidden = false;
  }
  if (config.appName) document.title = `${config.appName} · Is your website copy beige?`;
}

function showError(target, message) {
  const node = $(target);
  node.textContent = message;
  node.hidden = !message;
}

function show(section) {
  for (const id of ['intro', 'loading', 'results']) $(`#${id}`).hidden = id !== section;
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const url = $('#url').value.trim();
  const pasted = $('#pastedCopy').value.trim();
  if (!url && pasted.length < 200) {
    showError('#form-error', pasted ? 'Please paste a bit more of your copy (at least a few paragraphs).' : 'Enter your homepage address to get started.');
    return;
  }
  showError('#form-error', '');
  goStep(2);
});
$('#url').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('#to-step-2').click(); }
});
$('#back-step-1').addEventListener('click', () => goStep(1));

$('#check-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const payload = Object.fromEntries(form.entries());
  if (!payload.customer?.trim() || !payload.problem?.trim()) {
    showError('#form-error', 'Tell us who your customer is and what you solve for them. It makes the feedback far more useful.');
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      show('intro');
      goStep(1);
      if (data.code === 'too_little_text' || data.code === 'http_error' || data.code === 'not_html') {
        $('#paste-wrap').hidden = false;
      }
      showError('#form-error', data.error || 'Something went wrong. Please try again.');
      return;
    }
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
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'your page'; }
}

function renderReport(r) {
  const colour = SWATCH_COLOURS[r.swatch.name] || '#e3d6bf';
  $('#paint-colour').style.background = colour;
  $('#swatch-name').textContent = r.swatch.name;
  $('#beige-score').textContent = r.beigeScore;
  $('#swatch-blurb').textContent = r.swatch.blurb;
  $('#page-host').textContent = r.page.url ? hostOf(r.page.url) : 'your copy';
  $('#five-second-take').textContent = r.fiveSecondTake;
  $('#what-they-think').textContent = r.whatTheyThinkYouDo;

  const strip = $('#strip');
  strip.replaceChildren(...STRIP_ORDER.map((name) => el('span', {
    class: name === r.swatch.name ? 'on' : '',
    style: `background:${SWATCH_COLOURS[name]}`,
    title: name,
  })));

  const notice = $('#ai-notice');
  notice.hidden = !r.aiError;
  notice.textContent = r.aiError || '';

  const n = r.customerNeedsToKnow;
  $('#need-headline').textContent = n.headline;
  $('#need-sub').textContent = n.subheadline;
  $('#need-points').replaceChildren(...n.points.map((p) => el('li', {}, p)));
  $('#need-cta').textContent = n.callToAction;

  $('#fixes').replaceChildren(...r.improvements.map((f) => el('li', {},
    el('h3', {}, f.title),
    el('p', {}, f.detail),
    f.example ? el('p', { class: 'example' }, f.example) : null,
  )));

  const labels = { clarity: 'Clarity', valueProposition: 'Value proposition', callsToAction: 'Calls to action', customerFocus: 'Customer focus' };
  $('#scores').replaceChildren(...Object.entries(labels).map(([key, label]) => {
    const s = r.scores[key];
    return el('div', { class: 'card score' },
      el('div', { class: 'score-top' }, el('h3', {}, label), el('b', {}, `${s.score}`)),
      el('div', { class: 'bar' }, el('i', { style: `width:${s.score}%;background:${barColour(s.score)}` })),
      el('p', {}, s.comment),
    );
  }));

  $('#flags').replaceChildren(...(r.flagged.length ? r.flagged : []).map((f) => el('div', { class: 'card flag' },
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
    `"you" ${st.you}× vs "we/I" ${st.we}×`,
    `${st.beigePhrases} beige phrases`,
    `${st.fillerWords} filler words`,
  ].filter(Boolean).map((t) => el('span', {}, t)));

  $('#lead-message').placeholder = `e.g. I'd love help making ${r.page.url ? hostOf(r.page.url) : 'my site'} less ${r.swatch.name}`;
}

$('#lead-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  if (!data.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) {
    showError('#lead-error', 'Please add your name and a valid email address.');
    return;
  }
  if (!data.consent) {
    showError('#lead-error', 'Please tick the box so I know it\'s OK to get in touch.');
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
        consent: true,
        url: lastReport?.page?.url || lastUrl,
        beigeScore: lastReport?.beigeScore,
        swatch: lastReport?.swatch?.name,
        summary: lastReport ? `${lastReport.fiveSecondTake} | Fixes: ${lastReport.improvements.map((f) => f.title).join('; ')}` : '',
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Something went wrong.');
    form.querySelectorAll('input, textarea, button').forEach((n) => { n.disabled = true; });
    $('#lead-success').hidden = false;
  } catch (err) {
    showError('#lead-error', err.message);
    button.disabled = false;
  }
});

$('#print-btn').addEventListener('click', () => window.print());
$('#again-btn').addEventListener('click', () => {
  $('#check-form').reset();
  goStep(1);
  show('intro');
});

loadConfig();
