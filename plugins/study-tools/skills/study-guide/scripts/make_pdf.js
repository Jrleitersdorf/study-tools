#!/usr/bin/env node
/* Print a built study guide to PDF (the reading text only: the print stylesheet hides the
   contents, questions, Ask, the practice exam and all buttons, and shows every unit page).

   Usage: node make_pdf.js <study_guide.html> <out.pdf> [--libs DIR]

   Gotchas handled: MathJax typesets lazily, so the script waits until every page is typeset;
   images are lazy, so they are forced to load before printing. Needs Playwright and the local
   libraries from fetch_libs.sh (CDN requests are served from them). */
const fs = require('fs');
const path = require('path');
function arg(name, dflt) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; }
const built = process.argv[2], out = process.argv[3];
if (!built || !out) { console.log('usage: node make_pdf.js <study_guide.html> <out.pdf> [--libs DIR]'); process.exit(2); }
const LIBS = arg('--libs', process.env.SG_LIBS || path.join(require('os').homedir(), '.cache', 'study-guide-libs'));
let pw = null;
for (const c of ['playwright', '/opt/npm-tools/node_modules/playwright', process.env.PLAYWRIGHT_PATH || '']) { if (!c) continue; try { pw = require(c); break; } catch (e) { } }
if (!pw) { console.log('Playwright is not installed; cannot print.'); process.exit(3); }
const MJ = path.join(LIBS, 'mathjax', 'es5');
if (!fs.existsSync(path.join(MJ, 'tex-svg.js'))) { console.log('MathJax not found under ' + LIBS + '. Run fetch_libs.sh first.'); process.exit(3); }
const src = fs.readFileSync(built, 'utf8');
const title = (src.match(/<title>([^<]*)<\/title>/) || [, 'Study guide'])[1];
const pageFile = path.join(path.dirname(path.resolve(built)), '.sg-print-page.html');
fs.writeFileSync(pageFile, '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>' +
  src.split('<header class="top"')[0] + '</head><body><header class="top"' + src.split('<header class="top"').slice(1).join('<header class="top"') + '</body></html>');
(async () => {
  const browser = await pw.chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, colorScheme: 'light', reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.route('https://cdnjs.cloudflare.com/**', r => { const m = r.request().url().match(/\/es5\/(.*)$/); r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(m ? path.join(MJ, m[1]) : path.join(MJ, 'tex-svg.js')) }); });
    await p.route('https://cdn.jsdelivr.net/**', r => r.abort());
    await p.goto('file://' + pageFile);
    await p.evaluate(() => MathJax.startup.promise);
    await p.waitForFunction(() => Array.from(document.querySelectorAll('main > section[id]')).every(s => s.dataset.tex === 'done'), null, { timeout: 180000 });
    await p.evaluate(() => document.fonts.ready);
    await p.emulateMedia({ media: 'print' });
    await p.evaluate(async () => { const ims = Array.from(document.images); ims.forEach(i => { i.loading = 'eager'; const s = i.src; i.src = ''; i.src = s; }); await Promise.all(ims.map(i => i.complete && i.naturalWidth ? 1 : new Promise(r => { i.onload = i.onerror = r; }))); });
    await p.waitForTimeout(500);
    const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    await p.pdf({ path: out, format: 'Letter', printBackground: true, margin: { top: '0.5in', bottom: '0.55in', left: '0.55in', right: '0.55in' },
      displayHeaderFooter: true, headerTemplate: '<div></div>',
      footerTemplate: '<div style="width:100%;font-size:8px;color:#777;font-family:Helvetica,Arial,sans-serif;padding:0 0.55in;display:flex;justify-content:space-between"><span>' + esc(title) + '</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>' });
    console.log('pdf written: ' + out);
  } finally { await browser.close(); try { fs.unlinkSync(pageFile); } catch (e) { } }
})();
