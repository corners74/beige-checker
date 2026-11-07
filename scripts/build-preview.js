// Builds preview/index.html: a single self-contained page of the app that runs
// in the browser with no server, for sharing as a claude.ai preview link.
// Usage: npm run build:preview
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFile(path.join(root, p), 'utf8');

const html = await read('public/index.html');
const css = await read('public/styles.css');

const bundle = await build({
  entryPoints: [path.join(root, 'preview/entry.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  write: false,
});
const js = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const fontLinks = html.match(/<link rel="preconnect"[^>]*>|<link href="https:\/\/fonts\.googleapis\.com[^>]*>/g).join('\n');
const body = html
  .slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'))
  .replace(/<script[^>]*src="app\.js"[^>]*><\/script>/, '')
  .trim();

const previewCss = `
.preview-ribbon { max-width: 900px; margin: 0 auto; padding: 0 16px; font-size: 14px; font-weight: 600; color: var(--ink-2); }
.preview-ribbon::before { content: 'PREVIEW'; display: inline-block; margin-right: 8px; padding: 2px 8px; border-radius: 99px; background: var(--ink); color: var(--paper); font-size: 11px; letter-spacing: 0.08em; }
.preview-actions { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; margin-top: 14px; }
`;

// The publish step wraps this in <html><head><body>, so it starts with title and styles.
const page = `<title>Beige-o-Meter Preview</title>
${fontLinks}
<style>
${css}
${previewCss}
</style>
${body}
<script>
${js}
</script>
`;

await fs.writeFile(path.join(root, 'preview/index.html'), page);
console.log(`Built preview/index.html (${Math.round(page.length / 1024)} KB)`);
