#!/usr/bin/env node
/* Browser test suite for a built study guide.

   Usage: node test_guide.js <built study_guide.html> [--libs DIR] [--shots DIR]
          node test_guide.js <offline copy.html> --offline      (the file from make_offline.py)

   Needs Playwright with Chromium, and local copies of MathJax 3.2.2 and MathLive 0.109.2 (run
   fetch_libs.sh once; it prints the --libs directory). CDN requests are served from those copies,
   so the test works without network access. window.claude is mocked so Ask and Solve it for me
   run end to end; a second pass runs with no window.claude to check that they degrade.

   Checks: no script errors, math typeset with no MathJax errors and no raw TeX left, contents and
   pages, wrong answer does not reveal the key, Show answer reveals key and worked solution, exact
   math answers, progress survives a reload, Solve it for me, Ask with a saved answer, the practice
   exam (no feedback before submit, score after, retake), light and dark, phone width.
   At phone width (390 px) it also lists, as WARN lines that do not fail the run, every display
   equation and table that overflows its box (the reader would have to scroll it sideways).
   With --offline it loads the offline copy with ALL network access blocked and checks that the
   equations render, the math answer box works and the images load.
   Exit code: 0 all passed, 1 a check failed, 3 Playwright or the libraries are missing. */
const fs = require('fs');
const path = require('path');

function arg(name, dflt) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; }
const built = process.argv[2];
if (!built || !fs.existsSync(built)) { console.log('usage: node test_guide.js <study_guide.html> [--libs DIR] [--shots DIR]'); process.exit(2); }
const LIBS = arg('--libs', process.env.SG_LIBS || path.join(require('os').homedir(), '.cache', 'study-guide-libs'));
const SHOTS = arg('--shots', path.join(path.dirname(path.resolve(built)), 'test-shots'));
let pw = null;
for (const c of ['playwright', '/opt/npm-tools/node_modules/playwright', process.env.PLAYWRIGHT_PATH || '']) {
  if (!c) continue;
  try { pw = require(c); break; } catch (e) { }
}
if (!pw) { console.log('SKIP: Playwright is not installed. Install it (npm i playwright) or set PLAYWRIGHT_PATH.'); process.exit(3); }
const results = [];
const warnings = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail && !ok ? '  :: ' + detail : '')); }
function warn(msg) { warnings.push(msg); console.log('WARN ' + msg); }
function finishRun() {
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed, ' + warnings.length + ' warning(s).');
  process.exit(failed.length ? 1 : 0);
}
if (process.argv.includes('--offline')) {
  (async () => {
    const browser = await pw.chromium.launch();
    try {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, offline: true });
      const p = await ctx.newPage();
      const errs = [], blocked = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.route(/^https?:/, r => { blocked.push(r.request().url()); r.abort(); });
      await p.goto('file://' + path.resolve(built));
      const ready = await p.waitForFunction(() => window.MathJax && MathJax.startup && MathJax.startup.promise, null, { timeout: 20000 }).then(() => true).catch(() => false);
      check('MathJax is embedded and starts with no network', ready, 'window.MathJax never started: the copy still loads it from a CDN (run make_offline.py with the libraries available)');
      if (ready) {
        await p.evaluate(() => MathJax.startup.promise);
        await p.waitForFunction(() => Array.from(document.querySelectorAll('main > section[id]')).every(s => s.dataset.tex === 'done'), null, { timeout: 120000 }).catch(() => { });
      }
      const info = await p.evaluate(() => {
        const raw = []; const w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) { const el = n.parentElement; if (el.closest('script,mjx-container')) continue; if (/\\\(|\\\[|\\frac/.test(n.nodeValue)) raw.push(n.nodeValue.trim().slice(0, 50)); }
        return { raw: raw.length, sample: raw.slice(0, 3), mjx: document.querySelectorAll('mjx-container').length, imgs: Array.from(document.images).filter(i => i.complete && !i.naturalWidth).length };
      });
      check('every equation renders with no network (no raw TeX)', info.raw === 0 && info.mjx > 0, JSON.stringify(info));
      await p.evaluate(() => Array.from(document.images).forEach(i => { i.loading = 'eager'; }));
      await p.waitForTimeout(500);
      const broken = await p.evaluate(() => Array.from(document.images).filter(i => !i.naturalWidth).map(i => (i.getAttribute('alt') || '').slice(0, 30)));
      check('every image is embedded and loads', broken.length === 0, broken.join(' | '));
      const mf = await p.waitForFunction(() => window.__sgNum && window.__sgNum.length && window.__sgNum.every(i => i.input.tagName === 'MATH-FIELD'), null, { timeout: 15000 }).then(() => true).catch(() => false);
      const hasNum = await p.evaluate(() => !!document.querySelector('.check[data-type="num"]'));
      if (hasNum) {
        check('the math answer box loads with no network', mf, 'numeric questions kept the plain box: MathLive is not embedded');
        const num = await p.evaluate(() => { const c = document.querySelector('section[data-sg="unit"] .check[data-type="num"]'); return c ? { id: c.dataset.id, ans: c.dataset.ans, unit: c.closest('section').id } : null; });
        if (num && mf) {
          await p.evaluate(i => { const a = document.createElement('a'); a.href = '#' + i; document.body.appendChild(a); a.click(); a.remove(); }, num.unit + '-q'); await p.waitForTimeout(300);
          await p.evaluate(n => { const c = document.querySelector(`.check[data-id="${n.id}"]`); c.querySelector('math-field').value = '\\frac{' + (parseFloat(n.ans) * 2) + '}{2}'; }, num);
          await p.click(`.check[data-id="${num.id}"] button.primary`, { force: true });
          check('an exact answer typed in the math box is graded with no network', await p.evaluate(id => document.querySelector(`.check[data-id="${id}"]`).dataset.res === 'right', num.id), '');
        }
      }
      check('no script errors with no network', errs.length === 0, errs.slice(0, 3).join(' | '));
      const needed = blocked.filter(u => !/fonts\.(googleapis|gstatic)\.com/.test(u));
      check('nothing but web fonts was requested from the network', needed.length === 0, needed.slice(0, 3).join(' | '));
      await ctx.close();
    } catch (e) { check('offline test finished', false, e.stack || String(e)); }
    finally { await browser.close(); }
    finishRun();
  })();
} else {
const MJ = path.join(LIBS, 'mathjax', 'es5');
const ML = path.join(LIBS, 'mathlive', 'mathlive.min.js');
if (!fs.existsSync(path.join(MJ, 'tex-svg.js')) || !fs.existsSync(ML)) { console.log('SKIP: MathJax or MathLive not found under ' + LIBS + '. Run scripts/fetch_libs.sh first.'); process.exit(3); }
fs.mkdirSync(SHOTS, { recursive: true });

const src = fs.readFileSync(built, 'utf8');
const pageFile = path.join(path.dirname(path.resolve(built)), '.sg-test-page.html');
fs.writeFileSync(pageFile, '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}img{max-width:100%}</style>' +
  src.split('<header class="top"')[0] + '</head><body><header class="top"' + src.split('<header class="top"').slice(1).join('<header class="top"') + '</body></html>');

const MOCK = `(() => {
  window.__calls = [];
  const sample = async (messages, opts) => {
    window.__calls.push(messages);
    const text = 'This asks you to apply one formula.\\n\\n1. Pull out the givens: \\\\(a=1\\\\).\\n2. Substitute:\\n\\\\[x=\\\\frac{1}{2}\\\\]\\n\\n**Answer:** \\\\(1/2\\\\)\\nRecognize it next time by the givens.';
    if (opts && opts.onText) opts.onText({ text: text.slice(0, 20) });
    await new Promise(r => setTimeout(r, 300));
    return { text };
  };
  window.claude = { use: async (n) => n === 'sample' ? sample : null };
})();`;

async function open(browser, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }, opts.ctx || {}));
  if (opts.mock) await ctx.addInitScript(MOCK);
  const p = await ctx.newPage();
  p._errs = [];
  p.on('pageerror', e => p._errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_FILE_NOT_FOUND|net::/.test(m.text())) p._errs.push(m.text()); });
  await p.route('https://cdnjs.cloudflare.com/**', r => { const m = r.request().url().match(/\/es5\/(.*)$/); const f = m ? path.join(MJ, m[1]) : path.join(MJ, 'tex-svg.js'); r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }); });
  await p.route('https://cdn.jsdelivr.net/npm/mathlive@0.109.2/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(ML) }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('https://fonts.gstatic.com/**', r => r.abort());
  await p.goto('file://' + pageFile + (opts.hash ? '#' + opts.hash : ''));
  await p.waitForFunction(() => window.MathJax && MathJax.startup && MathJax.startup.promise, null, { timeout: 20000 });
  await p.evaluate(() => MathJax.startup.promise);
  await p.waitForFunction(() => Array.from(document.querySelectorAll('main > section[id]')).every(s => s.dataset.tex === 'done'), null, { timeout: 90000 });
  await p.waitForTimeout(400);
  return { ctx, p };
}
async function goPage(p, id) { await p.evaluate(i => { const a = document.createElement('a'); a.href = '#' + i; document.body.appendChild(a); a.click(); a.remove(); }, id); await p.waitForTimeout(250); }

(async () => {
  const browser = await pw.chromium.launch();
  try {
    /* ---------------- desktop, with a mocked Claude ---------------- */
    const { ctx, p } = await open(browser, { mock: true });
    const info = await p.evaluate(() => {
      const raw = []; const w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const el = n.parentElement; if (el.closest('script,.sols,mjx-container,.sol') ) continue; if (/\\\(|\\\[|\\frac|\\mathbf/.test(n.nodeValue)) raw.push(n.nodeValue.trim().slice(0, 60)); }
      return {
        merr: Array.from(document.querySelectorAll('mjx-merror, [data-mjx-error]')).map(e => e.getAttribute('data-mjx-error') || e.textContent).slice(0, 5),
        raw: raw.slice(0, 5),
        units: document.querySelectorAll('section[data-sg="unit"]').length,
        exam: !!document.querySelector('section[data-sg="exam"]'),
        toc: Array.from(document.querySelectorAll('#toc > li > a')).map(a => a.innerText.replace(/\s+/g, ' ').trim()),
        qEntries: Array.from(document.querySelectorAll('#toc a')).filter(a => a.textContent.trim() === 'Questions').length,
        cards: document.querySelectorAll('.unit-card').length,
        checks: document.querySelectorAll('.check').length,
        badKeys: Array.from(document.querySelectorAll('.check')).filter(c => c.dataset.type !== 'num' && c.dataset.ans.split(',').some(k => !Array.from(c.querySelectorAll('input')).some(i => i.value === k))).map(c => c.dataset.id),
        sols: Array.from(document.querySelectorAll('.check')).filter(c => !c.querySelector('.sol')).map(c => c.dataset.id),
        imgsNoDims: Array.from(document.images).filter(i => !i.getAttribute('width')).map(i => i.getAttribute('src')),
        pill: document.getElementById('save').textContent
      };
    });
    check('no script errors on load', p._errs.length === 0, p._errs.join(' | '));
    check('MathJax typeset without errors', info.merr.length === 0, JSON.stringify(info.merr));
    check('no raw TeX left in the page', info.raw.length === 0, JSON.stringify(info.raw));
    check('contents lists Start, every unit' + (info.exam ? ', the exam' : '') + ' and the summary', info.toc.length === info.units + (info.exam ? 1 : 0) + 2, JSON.stringify(info.toc));
    check('one Questions entry per unit in the contents', info.qEntries === info.units, info.qEntries + ' vs ' + info.units);
    check('start page has a card per unit' + (info.exam ? ' and the exam' : ''), info.cards === info.units + (info.exam ? 1 : 0), String(info.cards));
    check('every option-type answer key matches an option', info.badKeys.length === 0, info.badKeys.join(','));
    check('every question has a worked solution', info.sols.length === 0, info.sols.join(','));
    check('every image has width and height', info.imgsNoDims.length === 0, info.imgsNoDims.join(','));
    await p.screenshot({ path: path.join(SHOTS, 'desktop-start.png') });

    /* first unit: wrong answer hides the key, Show answer reveals it */
    const firstUnit = await p.evaluate(() => document.querySelector('section[data-sg="unit"]').id);
    await goPage(p, firstUnit + '-q');
    const mc = await p.evaluate(u => { const c = Array.from(document.querySelectorAll('#' + u + ' .check')).find(c => c.dataset.type === 'mc'); if (!c) return null; const wrong = Array.from(c.querySelectorAll('input')).find(i => i.value !== c.dataset.ans); return { id: c.dataset.id, wrong: wrong && wrong.value }; }, firstUnit);
    if (mc) {
      await p.click(`.check[data-id="${mc.id}"] input[value="${mc.wrong}"]`, { force: true });
      await p.click(`.check[data-id="${mc.id}"] button.primary`, { force: true });
      const after = await p.evaluate(id => { const c = document.querySelector(`.check[data-id="${id}"]`); return { res: c.dataset.res, miss: c.querySelectorAll('.opt.miss').length, solHidden: c.querySelector('.sol') ? c.querySelector('.sol').hidden : true, show: !c.querySelector('button.showans').hidden }; }, mc.id);
      check('a wrong answer is marked wrong without revealing the key', after.res === 'wrong' && after.miss === 0 && after.solHidden && after.show, JSON.stringify(after));
      await p.click(`.check[data-id="${mc.id}"] button.showans`, { force: true });
      const rev = await p.evaluate(id => { const c = document.querySelector(`.check[data-id="${id}"]`); return { miss: c.querySelectorAll('.opt.miss').length, sol: c.querySelector('.sol') && !c.querySelector('.sol').hidden, mjx: c.querySelectorAll('.sol mjx-container').length }; }, mc.id);
      check('Show answer reveals the key and the worked solution', rev.miss === 1 && rev.sol, JSON.stringify(rev));
    } else check('first unit has a multiple-choice question to test', false, 'none found');

    /* numeric question with an exact answer */
    await p.waitForFunction(() => !window.__sgNum || window.__sgNum.every(i => i.input.tagName === 'MATH-FIELD'), null, { timeout: 15000 }).catch(() => { });
    const num = await p.evaluate(() => { const c = document.querySelector('section[data-sg="unit"] .check[data-type="num"]'); return c ? { id: c.dataset.id, ans: c.dataset.ans, unit: c.closest('section').id } : null; });
    if (num) {
      await goPage(p, num.unit + '-q');
      await p.evaluate(n => { const c = document.querySelector(`.check[data-id="${n.id}"]`); const mf = c.querySelector('math-field'); const v = '\\frac{' + (parseFloat(n.ans) * 2) + '}{2}'; if (mf) mf.value = v; else c.querySelector('.numrow input').value = (parseFloat(n.ans) * 2) + '/2'; }, num);
      await p.click(`.check[data-id="${num.id}"] button.primary`, { force: true });
      const r = await p.evaluate(id => { const c = document.querySelector(`.check[data-id="${id}"]`); return { res: c.dataset.res, v: c.querySelector('.verdict').textContent, mf: !!c.querySelector('math-field') }; }, num.id);
      check('numeric answers accept exact forms (a fraction typed in the math box)', r.res === 'right', JSON.stringify(r));
      check('numeric answer box is a live math field', r.mf, '');
    }
    check('the evaluator reads LaTeX exact answers', Math.abs(await p.evaluate(() => window.sgEvalMath('\\frac{1}{1+e^{-1}}')) - 0.7310586) < 1e-6, '');

    /* Solve it for me */
    const walkId = await p.evaluate(() => { const c = Array.from(document.querySelectorAll('section[data-sg="unit"] .check')).find(c => !c.dataset.res && c.querySelector('button.walk') && !c.querySelector('button.walk').hidden); return c ? c.dataset.id : null; });
    if (walkId) {
      await p.click(`.check[data-id="${walkId}"] button.walk`, { force: true });
      await p.waitForFunction(() => window.sgQA.walking().length === 0, null, { timeout: 10000 });
      await p.waitForTimeout(700);
      const w = await p.evaluate(id => { const c = document.querySelector(`.check[data-id="${id}"]`); const b = c.querySelector('.walkbox'); return { res: c.dataset.res, shown: b && !b.hidden, steps: b ? b.querySelectorAll('ol li').length : 0, mjx: b ? b.querySelectorAll('mjx-container').length : 0 }; }, walkId);
      check('Solve it for me shows a worked walkthrough and counts as wrong', w.res === 'wrong' && w.shown && w.steps >= 2, JSON.stringify(w));
      const last = await p.evaluate(() => { const m = window.__calls[window.__calls.length - 1]; return { role: m[m.length - 1].role, len: m[m.length - 1].content.length, generic: !/FML|Julian|CSCI/.test(m[m.length - 1].content) }; });
      check('the Solve it for me prompt ends on a user turn', last.role === 'user' && last.len > 200, JSON.stringify(last));
    } else check('a question with Solve it for me', false, 'no visible Solve button');

    /* Ask */
    const sect = await p.evaluate(() => document.querySelector('[data-sg="section"][id]').id);
    await goPage(p, sect);
    await p.click('.ask-fab');
    await p.fill('.ap-text', 'Why is this true?');
    await p.click('.ap-now');
    await p.waitForFunction(() => Object.values(window.sgQA.docs()).some(d => d.thread.length === 2), null, { timeout: 10000 });
    await p.waitForTimeout(500);
    const ask = await p.evaluate(s => ({ cards: document.querySelectorAll('#' + s + ' .qbox .qcard, .qrail .rcard:not([hidden]) .qcard').length, answer: (document.querySelector('#' + s + ' .qc-a .qc-text, .qrail .rcard:not([hidden]) .qc-a .qc-text') || {}).textContent || '', role: window.__calls[window.__calls.length - 1].slice(-1)[0].role }), sect);
    check('Ask saves the question and answers it beside or below its section', ask.cards === 1 && ask.answer.length > 10 && ask.role === 'user', JSON.stringify(ask));
    await p.screenshot({ path: path.join(SHOTS, 'desktop-ask.png') });
    await p.click('.ap-x').catch(() => { });

    /* reload keeps progress */
    const answered = await p.evaluate(() => Array.from(document.querySelectorAll('.check[data-res]')).map(c => c.dataset.id));
    await p.reload();
    await p.evaluate(() => MathJax.startup.promise);
    await p.waitForTimeout(1200);
    const kept = await p.evaluate(ids => ids.filter(id => document.querySelector(`.check[data-id="${id}"]`).dataset.res).length, answered);
    check('answers survive a reload', kept === answered.length && answered.length > 0, kept + ' of ' + answered.length);
    check('Ask question survives a reload', await p.evaluate(() => document.querySelectorAll('.qbox .qcard, .qrail .qcard').length) === 1, '');

    /* practice exam */
    if (info.exam) {
      await goPage(p, 'exam');
      const ex0 = await p.evaluate(() => { const cs = Array.from(document.querySelectorAll('#exam .check')); return { n: cs.length, checkBtns: cs.filter(c => !c.querySelector('button.primary').hidden).length, walks: cs.filter(c => !c.querySelector('button.walk').hidden).length, bar: (document.querySelector('#exam .exam-bar') || {}).textContent || '' }; });
      check('exam page hides Check and Solve before submitting', ex0.n > 0 && ex0.checkBtns === 0 && ex0.walks === 0, JSON.stringify(ex0));
      const firstEx = await p.evaluate(() => { const c = document.querySelector('#exam .check[data-type="mc"], #exam .check[data-type="tf"]'); return c ? { id: c.dataset.id, ans: c.dataset.ans } : null; });
      if (firstEx) await p.click(`.check[data-id="${firstEx.id}"] input[value="${firstEx.ans}"]`, { force: true });
      await p.waitForTimeout(200);
      const mid = await p.evaluate(id => ({ res: document.querySelector(`.check[data-id="${id}"]`).dataset.res || '', bar: document.querySelector('#exam .exam-bar').textContent }), firstEx.id);
      check('answering an exam question gives no feedback and starts the timer', !mid.res && /Elapsed/.test(mid.bar), JSON.stringify(mid));
      await p.click('#exam .ex-submit');
      const confirm = await p.evaluate(() => (document.querySelector('#exam .exam-submit .qc-sure') || {}).textContent || '');
      check('submitting with blanks asks for confirmation inside the page', /unanswered/.test(confirm), confirm);
      await p.click('#exam .ex-yes');
      await p.waitForTimeout(300);
      const done = await p.evaluate(() => { const cs = Array.from(document.querySelectorAll('#exam .check')); return { graded: cs.filter(c => c.dataset.res).length, n: cs.length, score: (document.querySelector('#exam .ex-score') || {}).textContent || '', miss: document.querySelectorAll('#exam .opt.miss').length, show: cs.filter(c => !c.querySelector('button.showans').hidden).length, walks: cs.filter(c => !c.querySelector('button.walk').hidden).length, sum: (document.getElementById('sum-exam') || {}).textContent || '' }; });
      check('after submitting, every question is graded and a score shows', done.graded === done.n && /Score: 1 \//.test(done.score), JSON.stringify(done));
      check('after submitting, answers stay hidden until Show answer', done.miss === 0 && done.show >= done.n - 1, JSON.stringify(done));
      check('after submitting, Solve it for me becomes available', done.walks === done.n, JSON.stringify(done));
      check('the summary page records the exam score', /last score 1 \//.test(done.sum), done.sum);
      await p.screenshot({ path: path.join(SHOTS, 'desktop-exam.png') });
      await p.reload(); await p.evaluate(() => MathJax.startup.promise); await p.waitForTimeout(1200);
      check('the submitted exam survives a reload', await p.evaluate(() => /Score: 1 \//.test((document.querySelector('#exam .ex-score') || {}).textContent || '')), '');
      await goPage(p, 'exam');
      await p.click('#exam .ex-retake'); await p.click('#exam .ex-yes'); await p.waitForTimeout(300);
      const re = await p.evaluate(() => ({ graded: document.querySelectorAll('#exam .check[data-res]').length, submit: !!document.querySelector('#exam .ex-submit'), checked: document.querySelectorAll('#exam input:checked').length }));
      check('Retake clears the exam', re.graded === 0 && re.submit && re.checked === 0, JSON.stringify(re));
    }

    /* themes */
    const bg = async () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await goPage(p, firstUnit);
    await p.click('.themesw button[data-t="dark"]'); await p.waitForTimeout(150);
    const dark = await bg(); await p.screenshot({ path: path.join(SHOTS, 'desktop-dark.png') });
    await p.click('.themesw button[data-t="light"]'); await p.waitForTimeout(150);
    const light = await bg(); await p.screenshot({ path: path.join(SHOTS, 'desktop-light.png') });
    check('Light and Dark switch the page colors', dark !== light, dark + ' / ' + light);
    check('no script errors during the desktop run', p._errs.length === 0, p._errs.slice(0, 5).join(' | '));
    await ctx.close();

    /* ---------------- phone width ---------------- */
    const m = await open(browser, { mock: true, ctx: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' } });
    const pages = await m.p.evaluate(() => Array.from(document.querySelectorAll('main > section[id]')).map(s => s.id));
    const wide = [];
    for (const id of pages) {
      await goPage(m.p, id);
      const ov = await m.p.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: window.innerWidth }));
      if (ov.sw > ov.iw + 1) wide.push(id + ':' + ov.sw);
      const boxes = await m.p.evaluate(() => Array.from(document.querySelectorAll('main > section[data-sg="unit"]:not([hidden]) mjx-container[display="true"], main > section[data-sg="unit"]:not([hidden]) .tbl, main > section[data-sg="exam"]:not([hidden]) mjx-container[display="true"]'))
        .filter(e => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 2)
        .map(e => { const s = e.closest('[data-sg="section"][id]') || e.closest('section[id]'); return (s ? s.id : '?') + ' ' + (e.classList.contains('tbl') ? 'table' : 'equation') + ' (' + e.scrollWidth + ' px in ' + e.clientWidth + ')'; }));
      boxes.forEach(b => warn('at phone width this overflows its box and must be scrolled sideways: ' + b + '. Split the equation with aligned, or give the table at most 2 columns.'));
    }
    check('no horizontal scrolling at phone width on any page', wide.length === 0, wide.join(', '));
    await goPage(m.p, pages[1]);
    await m.p.screenshot({ path: path.join(SHOTS, 'phone-unit-dark.png') });
    await m.ctx.close();

    /* ---------------- without Claude (a plain HTML file) ---------------- */
    const n = await open(browser, { mock: false, hash: firstUnit + '-q' });
    await n.p.waitForTimeout(500);
    const off = await n.p.evaluate(() => ({ walks: Array.from(document.querySelectorAll('button.walk')).filter(b => !b.hidden).length, fab: !document.querySelector('.ask-wrap').hidden, noAns: document.querySelector('.ask-wrap').classList.contains('no-answers'), pill: document.getElementById('save').textContent }));
    check('without Claude, Solve it for me hides itself', off.walks === 0, JSON.stringify(off));
    check('without Claude, Ask still saves questions but offers no instant answers', off.fab && off.noAns, JSON.stringify(off));
    check('without Claude, progress saves in the browser', /browser/.test(off.pill), off.pill);
    check('no script errors without Claude', n.p._errs.length === 0, n.p._errs.join(' | '));
    await n.ctx.close();
  } catch (e) {
    check('test run finished', false, e.stack || String(e));
  } finally {
    await browser.close();
    try { fs.unlinkSync(pageFile); } catch (e) { }
  }
  console.log('Screenshots: ' + SHOTS);
  finishRun();
})();
}
