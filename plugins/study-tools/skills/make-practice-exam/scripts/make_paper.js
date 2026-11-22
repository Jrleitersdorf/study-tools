#!/usr/bin/env node
/* Print a practice exam on paper: a questions PDF to write on and a separate answer key.

   Usage: node make_paper.js <guide> [--out DIR] [--libs DIR] [--paper letter|a4]
                             [--instructions "text"] [--only questions|key]

   <guide> is the exam-only study guide folder (outline.json, guide.config.json and the exam
   files it names). The PDFs are named after guide_title:
     "<title> - Questions.pdf"   cover with name line, instructions, points; answer space sized
                                 to each question (lines for written answers, a box for code)
     "<title> - Answer Key.pdf"  a one-page quick key, then every question with its key, worked
                                 solution, model answer and rubric

   Needs Playwright and MathJax from the study-guide skill's fetch_libs.sh (pass its folder
   with --libs, or set SG_LIBS). Images in the questions resolve against <guide>. */
const fs = require('fs');
const path = require('path');
function arg(name, dflt) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; }
const guide = process.argv[2];
if (!guide || guide.startsWith('--')) { console.log('usage: node make_paper.js <guide> [--out DIR] [--libs DIR] [--paper letter|a4] [--instructions "text"] [--only questions|key]'); process.exit(2); }
const OUT = arg('--out', guide);
const LIBS = arg('--libs', process.env.SG_LIBS || path.join(require('os').homedir(), '.cache', 'study-guide-libs'));
const PAPER = (arg('--paper', 'letter') || 'letter').toLowerCase() === 'a4' ? 'A4' : 'Letter';
const ONLY = arg('--only', '');
let pw = null;
for (const c of ['playwright', '/opt/npm-tools/node_modules/playwright', process.env.PLAYWRIGHT_PATH || '']) { if (!c) continue; try { pw = require(c); break; } catch (e) { } }
if (!pw) { console.log('Playwright is not installed; cannot print.'); process.exit(3); }
const MJ = path.join(LIBS, 'mathjax', 'es5', 'tex-svg.js');
if (!fs.existsSync(MJ)) { console.log('MathJax not found under ' + LIBS + '. Run the study-guide skill\'s scripts/fetch_libs.sh and pass its folder with --libs.'); process.exit(3); }

const readJSON = f => JSON.parse(fs.readFileSync(path.join(guide, f), 'utf8'));
const outline = readJSON('outline.json');
const cfg = readJSON('guide.config.json');
if (!outline.exam) { console.log('outline.json has no "exam" entry.'); process.exit(2); }
const qhtml = fs.readFileSync(path.join(guide, outline.exam.questions), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const shtml = fs.readFileSync(path.join(guide, outline.exam.solutions), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const title = cfg.guide_title || 'Practice exam';
const minutes = cfg.practice_minutes || cfg.exam_minutes || '';
const conditions = cfg.exam_conditions || '';
const userInstr = arg('--instructions', '');

const CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; font: 11pt/1.45 "Charter", "Georgia", "Times New Roman", serif; color: #111; }
h1 { font-size: 18pt; margin: 0 0 2pt; font-weight: 700; }
.meta { font: 9.5pt/1.4 Helvetica, Arial, sans-serif; color: #444; margin-bottom: 10pt; }
.cover { border: 1.2pt solid #111; padding: 12pt 14pt; margin-bottom: 16pt; }
.namerow { display: flex; gap: 18pt; margin: 12pt 0 4pt; font: 10pt Helvetica, Arial, sans-serif; }
.namerow span { flex: 1; border-bottom: 0.8pt solid #111; padding-bottom: 2pt; }
.instr { font-size: 10.5pt; margin: 8pt 0 0; }
.instr li { margin: 2pt 0; }
.q { break-inside: avoid; page-break-inside: avoid; margin: 0 0 16pt; }
.qh { display: flex; justify-content: space-between; align-items: baseline; font: 700 10.5pt Helvetica, Arial, sans-serif; border-bottom: 0.6pt solid #999; margin-bottom: 4pt; padding-bottom: 1pt; }
.qh .pts { font-weight: 400; color: #333; }
.qt p { margin: 0 0 5pt; }
.qt img, .sol img { max-width: 70%; max-height: 3.2in; display: block; margin: 4pt 0; }
ol.opts { list-style: none; padding: 0; margin: 4pt 0 0 8pt; }
ol.opts li { margin: 3pt 0; padding-left: 24pt; text-indent: -24pt; }
ol.opts li .lt { display: inline-block; width: 24pt; text-indent: 0; font-family: Helvetica, Arial, sans-serif; }
.tfrow { font: 10.5pt Helvetica, Arial, sans-serif; margin: 6pt 0 0 8pt; letter-spacing: 0.5pt; }
.tfrow span { margin-right: 28pt; }
.numrow { margin: 10pt 0 0 8pt; font: 10.5pt Helvetica, Arial, sans-serif; }
.numrow .blank { display: inline-block; width: 2.2in; border-bottom: 0.8pt solid #111; margin: 0 4pt; }
.lines { margin: 8pt 0 0; }
.lines div { height: 26pt; border-bottom: 0.6pt solid #9a9a9a; }
.codebox { margin: 8pt 0 0; border: 0.8pt solid #777; background-image: repeating-linear-gradient(#fff 0 21pt, #e4e4e4 21pt 22pt); }
.hint { font: italic 9pt Helvetica, Arial, sans-serif; color: #555; margin-top: 3pt; }
pre.code { font: 9pt/1.35 "DejaVu Sans Mono", Menlo, Consolas, monospace; background: #f3f3f3; border: 0.6pt solid #ccc; padding: 5pt 7pt; white-space: pre-wrap; margin: 4pt 0; }
code { font-family: "DejaVu Sans Mono", Menlo, Consolas, monospace; font-size: 0.92em; }
table { border-collapse: collapse; margin: 4pt 0; font-size: 10pt; }
td, th { border: 0.6pt solid #999; padding: 2pt 6pt; }
.extra { margin: 0 0 12pt; }
/* answer key */
.quick { margin-bottom: 20pt; }
.quick table { width: 100%; font: 10pt Helvetica, Arial, sans-serif; }
.quick th { background: #eee; text-align: left; }
.key { font: 700 10.5pt Helvetica, Arial, sans-serif; margin: 6pt 0 4pt; padding: 3pt 7pt; background: #eef3ee; border-left: 3pt solid #2d6a3e; }
.k-opts li.right { font-weight: 700; }
.k-opts li .ok { font: 700 9pt Helvetica, Arial, sans-serif; color: #2d6a3e; margin-left: 6pt; }
.sol { margin-top: 4pt; font-size: 10.5pt; }
.sol .sol-h, .lbl { font: 700 9.5pt Helvetica, Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.6pt; color: #333; margin: 6pt 0 2pt; }
.sol ol.ws { margin: 2pt 0 4pt 16pt; padding: 0; }
.model { border-left: 2pt solid #999; padding: 2pt 0 2pt 8pt; margin: 2pt 0 4pt; }
.model p, .sol p { margin: 0 0 4pt; }
ul.rubric { margin: 2pt 0 0 16pt; padding: 0; }
ul.rubric li .mk { font: 9pt Helvetica, Arial, sans-serif; color: #333; margin-right: 4pt; }
.expl p { margin: 2pt 0; }
.topic { font: 400 9pt Helvetica, Arial, sans-serif; color: #555; }
`;

/* The page builds itself from the raw exam markup in the browser, so the parsing is the DOM's. */
const BUILD = function (mode, meta) {
  const raw = document.getElementById('raw'), sols = document.getElementById('sols'), out = document.getElementById('out');
  const solFor = {};
  sols.querySelectorAll('[data-sg="solution"],.sol').forEach(s => { solFor[s.getAttribute('data-for')] = s; });
  const qs = Array.from(raw.querySelectorAll('[data-sg="question"],.check'));
  let total = 0, n = 0;
  const quick = [];
  const letters = 'abcdefghij';
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const fmtPts = p => p + (p === 1 ? ' point' : ' points');
  Array.from(raw.children).forEach(node => {
    if (!qs.includes(node)) { if (node.nodeType === 1 && node.textContent.trim()) out.appendChild(el('div', 'extra', node.innerHTML)); return; }
    const q = node; n += 1;
    const type = q.getAttribute('data-type'), ans = q.getAttribute('data-ans') || '';
    const pts = parseFloat(q.getAttribute('data-points') || '1'); total += pts;
    const box = el('div', 'q');
    const head = el('div', 'qh');
    head.appendChild(el('span', '', 'Question ' + n + (mode === 'key' && q.getAttribute('data-topic') ? ' <span class="topic">· ' + q.getAttribute('data-topic') + '</span>' : '')));
    head.appendChild(el('span', 'pts', '(' + fmtPts(pts) + ')'));
    box.appendChild(head);
    const stem = q.querySelector('[data-sg="question-stem"],.qt');
    if (stem) { const s = el('div', 'qt'); if (stem.tagName === 'P') s.appendChild(el('p', '', stem.innerHTML)); else s.innerHTML = stem.innerHTML; box.appendChild(s); }
    const opts = Array.from(q.querySelectorAll('[data-sg="option"]'));
    const keys = ans.split(',').map(x => x.trim()).filter(Boolean);
    let keyText = '';
    if (type === 'mc' || type === 'multi') {
      const ol = el('ol', 'opts' + (mode === 'key' ? ' k-opts' : ''));
      opts.forEach((o, i) => {
        const k = o.getAttribute('data-k') || letters[i];
        const li = el('li', mode === 'key' && keys.includes(k) ? 'right' : '', '<span class="lt">(' + k + ')</span>' + o.innerHTML + (mode === 'key' && keys.includes(k) ? '<span class="ok">correct</span>' : ''));
        ol.appendChild(li);
      });
      box.appendChild(ol);
      if (type === 'multi' && mode !== 'key') box.appendChild(el('div', 'hint', 'Circle every correct answer.'));
      keyText = keys.map(k => '(' + k + ')').join(', ');
    } else if (type === 'tf') {
      if (mode !== 'key') box.appendChild(el('div', 'tfrow', '<span>True</span><span>False</span>'));
      keyText = ans === 'T' ? 'True' : 'False';
    } else if (type === 'num') {
      const suf = q.getAttribute('data-suffix') || '';
      if (mode !== 'key') box.appendChild(el('div', 'numrow', 'Answer:<span class="blank"></span>' + suf));
      const tol = q.getAttribute('data-tol');
      keyText = ans + (suf ? ' ' + suf : '') + (tol && parseFloat(tol) > 0 ? ' (accept ±' + tol + ')' : '');
    } else if (type === 'written') {
      const lines = Math.max(2, parseInt(q.getAttribute('data-lines') || '4', 10));
      if (mode !== 'key') {
        if (q.getAttribute('data-format') === 'code') {
          const b = el('div', 'codebox'); b.style.height = (Math.round(lines * 1.5) * 22 + 6) + 'pt'; box.appendChild(b);
        } else {
          const w = el('div', 'lines'); for (let i = 0; i < Math.round(lines * 1.6) + 1; i++) w.appendChild(el('div')); box.appendChild(w);
        }
      }
      keyText = 'written; mark with the rubric';
    }
    if (mode === 'key') {
      box.appendChild(el('div', 'key', 'Answer: ' + keyText));
      const so = solFor[q.getAttribute('data-id')];
      if (so) {
        const s = el('div', 'sol');
        Array.from(so.children).forEach(c => {
          const sg = c.getAttribute('data-sg');
          if (sg === 'model-answer') { s.appendChild(el('div', 'lbl', 'Model answer')); s.appendChild(el('div', 'model', c.innerHTML)); }
          else if (sg === 'rubric') {
            s.appendChild(el('div', 'lbl', 'Rubric'));
            const ul = el('ul', 'rubric');
            Array.from(c.children).forEach(li => { const m = li.getAttribute('data-marks'); ul.appendChild(el('li', '', (m ? '<span class="mk">[' + m + (m === '1' ? ' mark' : ' marks') + ']</span>' : '') + li.innerHTML)); });
            s.appendChild(ul);
          } else if (sg === 'solution-answer') { /* the key line above already says it */ }
          else s.appendChild(c.cloneNode(true));
        });
        box.appendChild(s);
      } else {
        const ex = q.querySelector('[data-sg="explanation"],.expl');
        if (ex) { const s = el('div', 'sol expl', ex.innerHTML); box.appendChild(s); }
      }
    }
    quick.push([n, q.getAttribute('data-topic') || '', pts, keyText]);
    out.appendChild(box);
  });
  const head = document.getElementById('head');
  if (mode === 'key') {
    const t = el('div', 'quick');
    t.appendChild(el('h1', '', meta.title + ': Answer Key'));
    t.appendChild(el('div', 'meta', meta.sub + ' · ' + n + ' questions · ' + total + ' points'));
    const tb = el('table'); tb.innerHTML = '<tr><th>#</th><th>Topic</th><th>Points</th><th>Answer</th></tr>' + quick.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>').join('');
    t.appendChild(tb);
    head.appendChild(t);
  } else {
    const c = el('div', 'cover');
    c.appendChild(el('h1', '', meta.title));
    c.appendChild(el('div', 'meta', meta.sub));
    c.appendChild(el('div', 'namerow', '<span>Name</span><span>Date</span><span>Score&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/ ' + total + '</span>'));
    const items = [];
    items.push(n + ' questions, ' + total + ' points' + (meta.minutes ? ', ' + meta.minutes + ' minutes' : '') + '.');
    if (meta.conditions) items.push(meta.conditions.charAt(0).toUpperCase() + meta.conditions.slice(1) + '.');
    if (meta.instr) items.push(meta.instr);
    else {
      items.push('Write every answer on this paper. Multiple choice: circle one letter. True or false: circle one word.');
      items.push('Time yourself, and mark your answers with the separate answer key only when you have finished.');
    }
    c.appendChild(el('ul', 'instr', items.map(x => '<li>' + x + '</li>').join('')));
    head.appendChild(c);
  }
};

function page(mode) {
  const meta = { title: title, sub: [cfg.course_full || cfg.course, cfg.exam_name ? 'Practice for ' + cfg.exam_name : ''].filter(Boolean).join(' · '), minutes: minutes, conditions: conditions, instr: userInstr };
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + CSS + '</style>' +
    '<script>window.MathJax={tex:{inlineMath:[["\\\\(","\\\\)"]],displayMath:[["\\\\[","\\\\]"]]},svg:{fontCache:"global"},startup:{typeset:false}};</script>' +
    '<script src="file://' + MJ + '"></script></head><body>' +
    '<div id="raw" hidden>' + qhtml + '</div><div id="sols" hidden>' + shtml + '</div>' +
    '<div id="head"></div><div id="out"></div>' +
    '<script>(' + BUILD.toString() + ')(' + JSON.stringify(mode) + ',' + JSON.stringify(meta) + ');document.getElementById("raw").remove();document.getElementById("sols").remove();</script></body></html>';
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pw.chromium.launch();
  const made = [];
  try {
    for (const mode of ['questions', 'key']) {
      if (ONLY && ONLY !== mode) continue;
      const pf = path.join(path.resolve(guide), '.mpe-print-' + mode + '.html');
      fs.writeFileSync(pf, page(mode));
      const ctx = await browser.newContext({ colorScheme: 'light' });
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.goto('file://' + pf);
      await p.evaluate(() => MathJax.startup.promise.then(() => MathJax.typesetPromise()));
      const bad = await p.evaluate(() => document.querySelectorAll('mjx-merror, [data-mjx-error]').length);
      await p.evaluate(() => document.fonts.ready);
      await p.evaluate(async () => { const ims = Array.from(document.images); await Promise.all(ims.map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))); });
      const broken = await p.evaluate(() => Array.from(document.images).filter(i => !i.naturalWidth).map(i => i.getAttribute('src')));
      const file = path.join(OUT, title + (mode === 'key' ? ' - Answer Key.pdf' : ' - Questions.pdf'));
      await p.pdf({ path: file, format: PAPER, printBackground: true, margin: { top: '0.6in', bottom: '0.7in', left: '0.65in', right: '0.65in' },
        displayHeaderFooter: true, headerTemplate: '<div></div>',
        footerTemplate: '<div style="width:100%;font-size:8px;color:#666;font-family:Helvetica,Arial,sans-serif;padding:0 0.65in;display:flex;justify-content:space-between"><span>' + esc(title) + (mode === 'key' ? ' · Answer key' : '') + '</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>' });
      await ctx.close();
      try { fs.unlinkSync(pf); } catch (e) { }
      errs.forEach(e => console.log('ERROR (' + mode + '): script error: ' + e));
      if (bad) console.log('ERROR (' + mode + '): ' + bad + ' math expression(s) failed to typeset. Check the TeX in the exam files.');
      broken.forEach(s => console.log('ERROR (' + mode + '): image not found: ' + s + ' (paths resolve against the guide folder)'));
      console.log('pdf written: ' + file);
      made.push(file);
    }
  } finally { await browser.close(); }
})().catch(e => { console.log('ERROR: ' + e.message); process.exit(1); });
