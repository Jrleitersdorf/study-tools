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
   math answers, progress survives a reload, Solve it for me (and that its prompt fits the question
   type), Ask with a saved answer, written items (compare, self-mark, Get feedback, Try again, Solve
   it for me counts as missed, reload), the practice exam (no feedback before submit, drafts survive
   a reload, score in points with written answers still to mark, weakest-first breakdown, marking
   after submit updates the score and history, retake), light and dark (code blocks too), phone
   width (code blocks scroll inside themselves), the db capability (a mocked Claude storage:
   marks and feedback come back after the browser's own copy is cleared), and no Claude at all.
   An exam-only guide (no units) runs the same suite minus the unit checks, plus a check that it
   opens on the exam.
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

/* window.claude mock: sample() always answers; with db, an in-page database kept in localStorage
   under __mockdb, so it survives a reload even after the guide's own browser keys are cleared. */
function mockScript(withDb) {
  return `(() => {
  window.__calls = [];
  const sample = async (messages, opts) => {
    window.__calls.push(messages);
    const text = 'This asks you to apply one formula.\\n\\n1. Pull out the givens: \\\\(a=1\\\\).\\n2. Substitute:\\n\\\\[x=\\\\frac{1}{2}\\\\]\\n\\n**Answer:** \\\\(1/2\\\\)\\nRecognize it next time by the givens.\\n\\n\`\`\`\\nprint(0.5 ** 2.5)\\n\`\`\`';
    if (opts && opts.onText) opts.onText({ text: text.slice(0, 20) });
    await new Promise(r => setTimeout(r, 300));
    return { text };
  };
  let db = null;
  if (${withDb ? 'true' : 'false'}) {
    const K = '__mockdb', L = {};
    const load = () => { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { return {}; } };
    const save = d => localStorage.setItem(K, JSON.stringify(d));
    const snap = c => { const d = load(); return { docs: Object.keys(d).filter(k => k.indexOf(c + '/') === 0).map(k => ({ id: k.slice(c.length + 1), exists: true, data: () => JSON.parse(JSON.stringify(d[k])) })) }; };
    const fire = c => (L[c] || []).forEach(f => f(snap(c)));
    const ref = path => ({
      set: async v => { const d = load(); d[path] = JSON.parse(JSON.stringify(v)); save(d); setTimeout(() => fire(path.split('/')[0]), 0); },
      delete: async () => { const d = load(); delete d[path]; save(d); setTimeout(() => fire(path.split('/')[0]), 0); }
    });
    db = { doc: ref, collection: c => ({ get: async () => snap(c), doc: id => ref(c + '/' + id), onSnapshot: cb => { (L[c] = L[c] || []).push(cb); setTimeout(() => cb(snap(c)), 0); return () => { }; } }) };
  }
  window.claude = { use: async (n) => n === 'sample' ? sample : (n === 'db' ? db : null) };
})();`;
}

async function open(browser, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }, opts.ctx || {}));
  if (opts.mock) await ctx.addInitScript(mockScript(!!opts.db));
  const p = await ctx.newPage();
  p._errs = [];
  p.on('pageerror', e => p._errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_FILE_NOT_FOUND|net::/.test(m.text())) p._errs.push(m.text()); });
  await p.route('https://cdnjs.cloudflare.com/**', r => { const m = r.request().url().match(/\/es5\/(.*)$/); const f = m ? path.join(MJ, m[1]) : path.join(MJ, 'tex-svg.js'); r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }); });
  await p.route('https://cdn.jsdelivr.net/npm/mathlive@0.109.2/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(ML) }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('https://fonts.gstatic.com/**', r => r.abort());
  await p.goto('file://' + pageFile + (opts.hash ? '#' + opts.hash : ''));
  await settle(p);
  return { ctx, p };
}
async function settle(p) {
  await p.waitForFunction(() => window.MathJax && MathJax.startup && MathJax.startup.promise, null, { timeout: 20000 });
  await p.evaluate(() => MathJax.startup.promise);
  await p.waitForFunction(() => Array.from(document.querySelectorAll('main > section[id]')).every(s => s.dataset.tex === 'done'), null, { timeout: 90000 });
  await p.waitForTimeout(400);
}
async function reload(p) { await p.reload(); await p.evaluate(() => MathJax.startup.promise); await p.waitForTimeout(1200); }
async function goPage(p, id) { await p.evaluate(i => { const a = document.createElement('a'); a.href = '#' + i; document.body.appendChild(a); a.click(); a.remove(); }, id); await p.waitForTimeout(250); }
const WRITTEN_TEXT = 'About 11,000 half-lives have passed, so practically no carbon-14 is left to measure.';
/* the state of one written item, read from the page and from the saved progress */
async function wState(p, id) {
  return p.evaluate(id => {
    const c = document.querySelector(`.check[data-id="${id}"]`), ta = c.querySelector('textarea.wtext'), sm = c.querySelector('.selfmark'), sol = c.querySelector('.sol');
    const pressed = sm ? (Array.from(sm.querySelectorAll('button')).find(b => b.getAttribute('aria-pressed') === 'true') || {}).dataset : null;
    const fbk = c.querySelector('button.fbk'), box = c.querySelector('.fbkbox'), sec = c.closest('section').id;
    let rec = null; try { rec = JSON.parse(localStorage.getItem(window.SG.config.storage_key + '-progress'))[sec].checks[id] || null; } catch (e) { }
    return {
      res: c.dataset.res || '', val: ta ? ta.value : null, ro: ta ? ta.readOnly : null, btn: c.querySelector('button.primary').textContent, btnShown: !c.querySelector('button.primary').hidden,
      nudge: !c.querySelector('.nudge').hidden, sol: !!sol && !sol.hidden, model: !!c.querySelector('.model') && !!c.querySelector('.model').offsetParent,
      rubric: c.querySelectorAll('.rubric > li').length, marks: c.querySelectorAll('.rubric .mk').length, selfmark: !!sm && !sm.hidden, pressed: pressed ? pressed.m : '',
      showans: !c.querySelector('button.showans').hidden, fbk: !!fbk && !fbk.hidden, box: !!box && !box.hidden, boxText: box ? box.textContent : '',
      verdict: c.querySelector('.verdict').textContent, border: getComputedStyle(c).borderTopColor, rec
    };
  }, id);
}

(async () => {
  const browser = await pw.chromium.launch();
  try {
    /* ---------------- desktop, with a mocked Claude ---------------- */
    const { ctx, p } = await open(browser, { mock: true });
    const info = await p.evaluate(() => {
      const raw = []; const w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const el = n.parentElement; if (el.closest('script,.sols,mjx-container,.sol,pre,textarea')) continue; if (/\\\(|\\\[|\\frac|\\mathbf/.test(n.nodeValue)) raw.push(n.nodeValue.trim().slice(0, 60)); }
      return {
        merr: Array.from(document.querySelectorAll('mjx-merror, [data-mjx-error]')).map(e => e.getAttribute('data-mjx-error') || e.textContent).slice(0, 5),
        raw: raw.slice(0, 5),
        units: document.querySelectorAll('section[data-sg="unit"]').length,
        exam: !!document.querySelector('section[data-sg="exam"]'),
        open: (Array.from(document.querySelectorAll('main > section[id]')).find(s => !s.hidden) || {}).id,
        toc: Array.from(document.querySelectorAll('#toc > li > a')).map(a => a.innerText.replace(/\s+/g, ' ').trim()),
        qEntries: Array.from(document.querySelectorAll('#toc a')).filter(a => a.textContent.trim() === 'Questions').length,
        cards: document.querySelectorAll('.unit-card').length,
        checks: document.querySelectorAll('.check').length,
        badKeys: Array.from(document.querySelectorAll('.check')).filter(c => c.dataset.type !== 'num' && c.dataset.type !== 'written' && (c.dataset.ans || '').split(',').some(k => !Array.from(c.querySelectorAll('input')).some(i => i.value === k))).map(c => c.dataset.id),
        sols: Array.from(document.querySelectorAll('.check')).filter(c => !c.querySelector('.sol')).map(c => c.dataset.id),
        written: Array.from(document.querySelectorAll('.check[data-type="written"]')).filter(c => !c.querySelector('textarea.wtext') || c.querySelectorAll('.sol .rubric > li').length < 2 || !c.querySelector('.sol .model')).map(c => c.dataset.id),
        imgsNoDims: Array.from(document.images).filter(i => !i.getAttribute('width')).map(i => i.getAttribute('src')),
        pill: document.getElementById('save').textContent
      };
    });
    const hasUnits = info.units > 0;
    check('no script errors on load', p._errs.length === 0, p._errs.join(' | '));
    check('MathJax typeset without errors', info.merr.length === 0, JSON.stringify(info.merr));
    check('no raw TeX left in the page', info.raw.length === 0, JSON.stringify(info.raw));
    check('contents lists Start, every unit' + (info.exam ? ', the exam' : '') + ' and the summary', info.toc.length === info.units + (info.exam ? 1 : 0) + 2, JSON.stringify(info.toc));
    check('one Questions entry per unit in the contents', info.qEntries === info.units, info.qEntries + ' vs ' + info.units);
    check('start page has a card per unit' + (info.exam ? ' and the exam' : ''), info.cards === info.units + (info.exam ? 1 : 0), String(info.cards));
    check('every option-type answer key matches an option', info.badKeys.length === 0, info.badKeys.join(','));
    check('every question has a worked solution', info.sols.length === 0, info.sols.join(','));
    check('every written question has a text box, a model answer and a rubric', info.written.length === 0, info.written.join(','));
    check('every image has width and height', info.imgsNoDims.length === 0, info.imgsNoDims.join(','));
    if (!hasUnits) check('an exam-only guide opens on the practice exam', info.exam && info.open === 'exam', 'open page: ' + info.open);
    await p.screenshot({ path: path.join(SHOTS, 'desktop-start.png') });

    const firstUnit = hasUnits ? await p.evaluate(() => document.querySelector('section[data-sg="unit"]').id) : null;
    if (hasUnits) {
      /* first unit: wrong answer hides the key, Show answer reveals it */
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
    }
    check('the evaluator reads LaTeX exact answers', Math.abs(await p.evaluate(() => window.sgEvalMath('\\frac{1}{1+e^{-1}}')) - 0.7310586) < 1e-6, '');

    /* Solve it for me */
    if (hasUnits) {
      const walkId = await p.evaluate(() => { const c = Array.from(document.querySelectorAll('section[data-sg="unit"] .check')).find(c => !c.dataset.res && c.dataset.type !== 'written' && c.querySelector('button.walk') && !c.querySelector('button.walk').hidden); return c ? c.dataset.id : null; });
      if (walkId) {
        await p.click(`.check[data-id="${walkId}"] button.walk`, { force: true });
        await p.waitForFunction(() => window.sgQA.walking().length === 0, null, { timeout: 10000 });
        await p.waitForTimeout(700);
        const w = await p.evaluate(id => { const c = document.querySelector(`.check[data-id="${id}"]`); const b = c.querySelector('.walkbox'); return { res: c.dataset.res, shown: b && !b.hidden, steps: b ? b.querySelectorAll('ol li').length : 0, mjx: b ? b.querySelectorAll('mjx-container').length : 0, code: b ? b.querySelectorAll('pre.code').length : 0 }; }, walkId);
        check('Solve it for me shows a worked walkthrough and counts as wrong', w.res === 'wrong' && w.shown && w.steps >= 2, JSON.stringify(w));
        check('code fences in Claude\'s answers render as code blocks', w.code === 1, JSON.stringify(w));
        const last = await p.evaluate(() => { const m = window.__calls[window.__calls.length - 1]; return { role: m[m.length - 1].role, len: m[m.length - 1].content.length, generic: !/FML|Julian|CSCI/.test(m[m.length - 1].content) }; });
        check('the Solve it for me prompt ends on a user turn', last.role === 'user' && last.len > 200, JSON.stringify(last));
      } else check('a question with Solve it for me', false, 'no visible Solve button');
    }
    const shapes = await p.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('.check')).map(c => ({ id: c.dataset.id, t: c.dataset.type, f: c.dataset.format || '' }));
      const pick = f => ids.find(f);
      const one = (q, want) => { if (!q) return true; const s = window.sgQA.walkPrompt(q.id); return want.test(s) && /must agree with the answer key/.test(s) && !/show the algebra line by line/i.test(s); };
      return {
        num: one(pick(q => q.t === 'num'), /computation or derivation shape most likely fits/),
        choice: one(pick(q => q.t === 'mc' || q.t === 'tf'), /conceptual multiple choice or true\/false shape most likely fits/),
        essay: one(pick(q => q.t === 'written' && !q.f), /essay or short answer shape most likely fits[\s\S]*short plan[\s\S]*\*\*Model answer:\*\*/),
        code: one(pick(q => q.t === 'written' && q.f === 'code'), /code shape most likely fits[\s\S]*fenced block/)
      };
    });
    check('the Solve it for me prompt fits the question type (computation, choice, short answer, code)', shapes.num && shapes.choice && shapes.essay && shapes.code, JSON.stringify(shapes));

    /* Ask */
    const sect = await p.evaluate(() => { const s = document.querySelector('[data-sg="section"][id]'); return s ? s.id : 'exam-q'; });
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

    /* a written question in a unit: compare, self-mark, feedback */
    const wr = hasUnits ? await p.evaluate(() => { const c = document.querySelector('section[data-sg="unit"] .check[data-type="written"]'); return c ? { id: c.dataset.id, unit: c.closest('section').id } : null; }) : null;
    if (wr) {
      await goPage(p, wr.unit + '-q');
      const blankBorder = (await wState(p, wr.id)).border;
      await p.click(`.check[data-id="${wr.id}"] button.primary`, { force: true });
      const w0 = await wState(p, wr.id);
      check('a written question offers "Compare with the model answer" and asks for text first', /Compare with the model answer/.test(w0.btn) && w0.nudge && !w0.res && !w0.sol && !w0.fbk, JSON.stringify(w0));
      await p.fill(`.check[data-id="${wr.id}"] textarea.wtext`, WRITTEN_TEXT);
      await p.click(`.check[data-id="${wr.id}"] button.primary`, { force: true });
      await p.waitForTimeout(150);
      const w1 = await wState(p, wr.id);
      check('Compare locks the answer and reveals the model answer, the rubric and the self-mark', w1.res === 'pending' && w1.ro && w1.sol && w1.model && w1.rubric >= 2 && w1.marks >= 2 && w1.selfmark && !w1.showans && !w1.btnShown, JSON.stringify(w1));
      check('Get feedback appears on a compared written answer when Claude is available', w1.fbk && !w1.box, JSON.stringify(w1));
      await p.click(`.check[data-id="${wr.id}"] .selfmark button[data-m="part"]`, { force: true });
      const w2 = await wState(p, wr.id);
      check('marking Partly saves the mark and styles the card as partial (amber)', w2.res === 'partial' && w2.pressed === 'part' && w2.rec && w2.rec.mark === 'part' && w2.rec.firstCorrect === false && w2.border !== blankBorder && w2.border !== w1.border, JSON.stringify({ res: w2.res, rec: w2.rec, b: [blankBorder, w1.border, w2.border] }));
      await p.click(`.check[data-id="${wr.id}"] .selfmark button[data-m="full"]`, { force: true });
      const w3 = await wState(p, wr.id);
      await p.click(`.check[data-id="${wr.id}"] .selfmark button[data-m="part"]`, { force: true });
      const w4 = await wState(p, wr.id);
      check('first-try credit is true only for Full marks on the first attempt', w3.res === 'right' && w3.rec.firstCorrect === true && w4.rec.firstCorrect === false && w4.rec.mark === 'part', JSON.stringify([w3.rec, w4.rec]));
      await p.click(`.check[data-id="${wr.id}"] button.fbk`, { force: true });
      await p.waitForFunction(() => window.sgQA.feeding().length === 0, null, { timeout: 10000 });
      await p.waitForTimeout(400);
      const w5 = await wState(p, wr.id);
      check('Get feedback shows Claude\'s feedback with the note that the student sets the mark', w5.box && /advice; you set the mark/.test(w5.boxText) && w5.boxText.length > 60 && !w5.fbk, JSON.stringify({ box: w5.box, t: w5.boxText.slice(0, 80), fbk: w5.fbk }));
      const fp = await p.evaluate(t => { const m = window.__calls[window.__calls.length - 1]; const c = m[m.length - 1].content; return { n: m.length, role: m[m.length - 1].role, text: c.indexOf(t) >= 0, model: /<model_answer>/.test(c), rubric: /Rubric:\n- \(1 mark\)/.test(c), mark: /Suggested mark \(advice only\)/.test(c) }; }, WRITTEN_TEXT);
      check('the feedback prompt holds the question, model answer, rubric and the student\'s text, as one user turn', fp.n === 1 && fp.role === 'user' && fp.text && fp.model && fp.rubric && fp.mark, JSON.stringify(fp));
    }

    /* reload keeps progress */
    if (hasUnits) {
      const answered = await p.evaluate(() => Array.from(document.querySelectorAll('.check[data-res]')).filter(c => !c.closest('section[data-sg="exam"]')).map(c => c.dataset.id));
      await reload(p);
      const kept = await p.evaluate(ids => ids.filter(id => document.querySelector(`.check[data-id="${id}"]`).dataset.res).length, answered);
      check('answers survive a reload', kept === answered.length && answered.length > 0, kept + ' of ' + answered.length);
      check('Ask question survives a reload', await p.evaluate(() => document.querySelectorAll('.qbox .qcard, .qrail .qcard').length) === 1, '');
      if (wr) {
        await goPage(p, wr.unit + '-q');
        const w6 = await wState(p, wr.id);
        check('a self-marked written answer, its text and its feedback survive a reload', w6.res === 'partial' && w6.val === WRITTEN_TEXT && w6.ro && w6.pressed === 'part' && w6.box && /advice/.test(w6.boxText), JSON.stringify({ res: w6.res, val: w6.val, pressed: w6.pressed, box: w6.box }));
        await p.evaluate(id => { const b = Array.from(document.querySelectorAll(`.check[data-id="${id}"] .actions button`)).find(b => b.textContent === 'Try again' && !b.hidden); if (b) b.click(); }, wr.id);
        const w7 = await wState(p, wr.id);
        check('Try again on a written answer clears the box and hides the model answer and feedback', !w7.res && w7.val === '' && !w7.ro && !w7.sol && !w7.selfmark && !w7.box && w7.btnShown, JSON.stringify(w7));
        await p.click(`.check[data-id="${wr.id}"] button.walk`, { force: true });
        await p.waitForFunction(() => window.sgQA.walking().length === 0, null, { timeout: 10000 });
        await p.waitForTimeout(500);
        const w8 = await wState(p, wr.id);
        check('Solve it for me on a written item counts as missed and shows the model answer', w8.res === 'wrong' && w8.rec.mark === 'none' && w8.rec.gaveUp && w8.sol && !w8.selfmark && /counted as missed/.test(w8.verdict) && w8.rec.firstCorrect === false && w8.rec.tries === 2, JSON.stringify(w8));
      }
    }

    /* practice exam */
    if (info.exam) {
      await goPage(p, 'exam');
      const ex0 = await p.evaluate(() => { const cs = Array.from(document.querySelectorAll('#exam .check')); return { n: cs.length, checkBtns: cs.filter(c => !c.querySelector('button.primary').hidden).length, walks: cs.filter(c => !c.querySelector('button.walk').hidden).length, fbks: cs.filter(c => c.querySelector('button.fbk') && !c.querySelector('button.fbk').hidden).length, bar: (document.querySelector('#exam .exam-bar') || {}).textContent || '' }; });
      check('exam page hides Check, Solve and Get feedback before submitting', ex0.n > 0 && ex0.checkBtns === 0 && ex0.walks === 0 && ex0.fbks === 0, JSON.stringify(ex0));
      const plan = await p.evaluate(() => {
        const cs = Array.from(document.querySelectorAll('#exam .check')).map(c => ({ id: c.dataset.id, type: c.dataset.type, ans: c.dataset.ans, pts: parseFloat(c.dataset.points) > 0 ? parseFloat(c.dataset.points) : 1, hasPts: parseFloat(c.dataset.points) > 0 }));
        return { cs, obj: cs.find(c => c.type === 'mc' || c.type === 'tf'), wr: cs.find(c => c.type === 'written'), total: cs.reduce((a, c) => a + c.pts, 0), anyPts: cs.some(c => c.hasPts) };
      });
      const r2 = v => Math.round(v * 100) / 100;
      if (plan.obj) await p.click(`.check[data-id="${plan.obj.id}"] input[value="${plan.obj.ans}"]`, { force: true });
      if (plan.wr) await p.fill(`.check[data-id="${plan.wr.id}"] textarea.wtext`, WRITTEN_TEXT);
      await p.waitForTimeout(200);
      const mid = await p.evaluate(ids => ({ res: ids.map(id => document.querySelector(`.check[data-id="${id}"]`).dataset.res || '').join(''), bar: document.querySelector('#exam .exam-bar').textContent, model: Array.from(document.querySelectorAll('#exam .check .sol')).some(s => !s.hidden) }), [plan.obj && plan.obj.id, plan.wr && plan.wr.id].filter(Boolean));
      check('answering an exam question gives no feedback and starts the timer', !mid.res && !mid.model && /Elapsed/.test(mid.bar), JSON.stringify(mid));
      await reload(p); await goPage(p, 'exam');
      const dr = await p.evaluate(o => ({ obj: !o.obj || !!document.querySelector(`.check[data-id="${o.obj.id}"] input[value="${o.obj.ans}"]:checked`), wr: !o.wr || document.querySelector(`.check[data-id="${o.wr.id}"] textarea.wtext`).value, res: document.querySelectorAll('#exam .check[data-res]').length }), plan);
      check('an unsubmitted exam draft, written answers included, survives a reload', dr.obj && (!plan.wr || dr.wr === WRITTEN_TEXT) && dr.res === 0, JSON.stringify(dr));
      await p.click('#exam .ex-submit');
      const confirm = await p.evaluate(() => (document.querySelector('#exam .exam-submit .qc-sure') || {}).textContent || '');
      check('submitting with blanks asks for confirmation inside the page', /unanswered/.test(confirm), confirm);
      await p.click('#exam .ex-yes');
      await p.waitForTimeout(300);
      const earned = plan.obj ? plan.obj.pts : 0, pend = plan.wr ? 1 : 0;
      const scoreHead = 'Score: ' + r2(earned) + ' / ' + r2(plan.total);
      const done = await p.evaluate(() => {
        const cs = Array.from(document.querySelectorAll('#exam .check'));
        const rows = Array.from(document.querySelectorAll('#exam .ex-result tbody tr')).map(tr => { const m = tr.querySelector('td.num').textContent.match(/([\d.]+) \/ ([\d.]+)/); return { label: tr.cells[0].textContent, r: m ? parseFloat(m[1]) / parseFloat(m[2]) : -1 }; });
        return { graded: cs.filter(c => c.dataset.res).length, n: cs.length, nObj: cs.filter(c => c.dataset.type !== 'written').length, score: (document.querySelector('#exam .ex-score') || {}).textContent || '', miss: document.querySelectorAll('#exam .opt.miss').length, show: cs.filter(c => c.dataset.type !== 'written' && !c.querySelector('button.showans').hidden).length, walks: cs.filter(c => !c.querySelector('button.walk').hidden).length, sum: (document.getElementById('sum-exam') || {}).textContent || '', rows, head: (document.querySelector('#exam .ex-result th:last-child') || {}).textContent || '' };
      });
      check('after submitting, every question is graded and a score shows', done.graded === done.n && done.score.indexOf(scoreHead) === 0, JSON.stringify({ done, want: scoreHead }));
      check('the exam score weights questions by data-points (default 1)', done.score.indexOf(scoreHead) === 0 && (!plan.anyPts || done.head === 'Points'), scoreHead + ' | ' + done.score + ' | ' + done.head);
      if (plan.wr) check('written answers still to mark are named in the score line', done.score.indexOf(scoreHead + ' so far; 1 written answer still to mark yourself') === 0, done.score);
      check('the score breakdown lists the weakest first', done.rows.length > 0 && done.rows.every((r, i) => i === 0 || done.rows[i - 1].r <= r.r + 1e-9), JSON.stringify(done.rows));
      check('after submitting, answers stay hidden until Show answer', done.miss === 0 && done.show >= done.nObj - 1, JSON.stringify(done));
      check('after submitting, Solve it for me becomes available', done.walks === done.n, JSON.stringify(done));
      check('the summary page records the exam score', done.sum.indexOf('last score ' + r2(earned) + ' / ' + r2(plan.total)) >= 0, done.sum);
      if (plan.wr) {
        const ew = await wState(p, plan.wr.id);
        check('after submitting, written answers show the model answer, rubric, self-mark and Get feedback', ew.res === 'pending' && ew.sol && ew.rubric >= 2 && ew.selfmark && ew.ro && ew.val === WRITTEN_TEXT && ew.fbk, JSON.stringify(ew));
        await p.click(`.check[data-id="${plan.wr.id}"] .selfmark button[data-m="full"]`, { force: true });
        await p.waitForTimeout(200);
        const after = r2(earned + plan.wr.pts);
        const mk = await p.evaluate(() => { let x = null; try { x = JSON.parse(localStorage.getItem(window.SG.config.storage_key + '-progress')).exam; } catch (e) { } const h = x && x.history[x.history.length - 1]; return { score: document.querySelector('#exam .ex-score').textContent, sum: document.getElementById('sum-exam').textContent, h }; });
        check('marking a written answer after submitting updates the score and the latest history entry', mk.score.indexOf('Score: ' + after + ' / ' + r2(plan.total) + ' (') === 0 && mk.sum.indexOf('last score ' + after + ' /') >= 0 && mk.h && mk.h.right === after && mk.h.pending === 0, JSON.stringify(mk));
        await p.click(`.check[data-id="${plan.wr.id}"] .selfmark button[data-m="part"]`, { force: true });
        await p.waitForTimeout(200);
        const half = r2(earned + plan.wr.pts / 2);
        check('Partly counts half the points of a written question', (await p.evaluate(() => document.querySelector('#exam .ex-score').textContent)).indexOf('Score: ' + half + ' / ') === 0, '');
      }
      await p.screenshot({ path: path.join(SHOTS, 'desktop-exam.png'), fullPage: false });
      const finalScore = await p.evaluate(() => document.querySelector('#exam .ex-score').textContent);
      await reload(p);
      check('the submitted exam survives a reload', await p.evaluate(s => (document.querySelector('#exam .ex-score') || {}).textContent === s, finalScore), finalScore);
      if (plan.wr) { const ew2 = await wState(p, plan.wr.id); check('a written exam answer and its mark survive a reload', ew2.res === 'partial' && ew2.pressed === 'part' && ew2.val === WRITTEN_TEXT, JSON.stringify(ew2)); }
      await goPage(p, 'exam');
      await p.click('#exam .ex-retake'); await p.click('#exam .ex-yes'); await p.waitForTimeout(300);
      const re = await p.evaluate(() => ({ graded: document.querySelectorAll('#exam .check[data-res]').length, submit: !!document.querySelector('#exam .ex-submit'), checked: document.querySelectorAll('#exam input:checked').length, text: Array.from(document.querySelectorAll('#exam textarea.wtext')).map(t => t.value).join(''), marks: Array.from(document.querySelectorAll('#exam .selfmark')).filter(s => !s.hidden).length }));
      check('Retake clears the exam', re.graded === 0 && re.submit && re.checked === 0 && re.text === '' && re.marks === 0, JSON.stringify(re));
    }

    /* themes */
    const look = async () => p.evaluate(() => { const k = document.querySelector('main > section:not([hidden]) pre.code[data-sg="code-block"]'); return { bg: getComputedStyle(document.body).backgroundColor, code: k ? getComputedStyle(k).backgroundColor : '' }; });
    const codePage = await p.evaluate(() => { const c = document.querySelector('main [data-sg="section"] pre.code[data-sg="code-block"]') || document.querySelector('main pre.code[data-sg="code-block"]'); return c ? c.closest('main > section[id]').id : null; });
    await goPage(p, codePage || firstUnit || 'exam');
    await p.click('.themesw button[data-t="dark"]'); await p.waitForTimeout(150);
    const dark = await look(); await p.screenshot({ path: path.join(SHOTS, 'desktop-dark.png') });
    await p.click('.themesw button[data-t="light"]'); await p.waitForTimeout(150);
    const light = await look(); await p.screenshot({ path: path.join(SHOTS, 'desktop-light.png') });
    check('Light and Dark switch the page colors', dark.bg !== light.bg, dark.bg + ' / ' + light.bg);
    if (codePage) check('code blocks follow Light and Dark', dark.code && light.code && dark.code !== light.code, dark.code + ' / ' + light.code);
    check('no script errors during the desktop run', p._errs.length === 0, p._errs.slice(0, 5).join(' | '));
    await ctx.close();

    /* ---------------- phone width ---------------- */
    const m = await open(browser, { mock: true, ctx: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' } });
    const pages = await m.p.evaluate(() => Array.from(document.querySelectorAll('main > section[id]')).map(s => s.id));
    const sweep = async (label) => {
      const wide = [];
      for (const id of pages) {
        await goPage(m.p, id);
        const ov = await m.p.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: window.innerWidth }));
        if (ov.sw > ov.iw + 1) wide.push(id + ':' + ov.sw);
        if (label) continue;
        const boxes = await m.p.evaluate(() => Array.from(document.querySelectorAll('main > section[data-sg="unit"]:not([hidden]) mjx-container[display="true"], main > section[data-sg="unit"]:not([hidden]) .tbl, main > section[data-sg="exam"]:not([hidden]) mjx-container[display="true"]'))
          .filter(e => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 2)
          .map(e => { const s = e.closest('[data-sg="section"][id]') || e.closest('section[id]'); return (s ? s.id : '?') + ' ' + (e.classList.contains('tbl') ? 'table' : 'equation') + ' (' + e.scrollWidth + ' px in ' + e.clientWidth + ')'; }));
        boxes.forEach(b => warn('at phone width this overflows its box and must be scrolled sideways: ' + b + '. Split the equation with aligned, or give the table at most 2 columns.'));
      }
      return wide;
    };
    const wide = await sweep('');
    check('no horizontal scrolling at phone width on any page', wide.length === 0, wide.join(', '));
    if (codePage) {
      await goPage(m.p, codePage);
      const cb = await m.p.evaluate(() => { const c = document.querySelector('main > section:not([hidden]) [data-sg="section"] pre.code[data-sg="code-block"]') || document.querySelector('main > section:not([hidden]) pre.code[data-sg="code-block"]'); c.scrollIntoView(); return { sw: c.scrollWidth, cw: c.clientWidth, ox: getComputedStyle(c).overflowX, page: document.scrollingElement.scrollWidth, iw: window.innerWidth, right: c.getBoundingClientRect().right }; });
      check('a code block scrolls inside itself at phone width, not the page', cb.sw > cb.cw && cb.ox === 'auto' && cb.page <= cb.iw + 1 && cb.right <= cb.iw, JSON.stringify(cb));
      await m.p.screenshot({ path: path.join(SHOTS, 'phone-code-dark.png') });
      await m.p.click('.themesw button[data-t="light"]').catch(() => { }); await m.p.waitForTimeout(150);
      const wideLight = await sweep('light');
      check('no horizontal scrolling at phone width in the light theme either', wideLight.length === 0, wideLight.join(', '));
      await m.p.click('.themesw button[data-t="dark"]').catch(() => { }); await m.p.waitForTimeout(150);
    }
    await goPage(m.p, pages[1]);
    await m.p.screenshot({ path: path.join(SHOTS, 'phone-unit-dark.png') });
    check('no script errors at phone width', m.p._errs.length === 0, m.p._errs.slice(0, 3).join(' | '));
    await m.ctx.close();

    /* ---------------- with the db capability (Claude storage) ---------------- */
    const d = await open(browser, { mock: true, db: true });
    const dw = await d.p.evaluate(() => { const c = document.querySelector('section[data-sg="unit"] .check[data-type="written"]') || document.querySelector('.check[data-type="written"]'); return c ? { id: c.dataset.id, page: c.closest('main > section[id]').id, exam: !!c.closest('section[data-sg="exam"]') } : null; });
    if (dw) {
      await goPage(d.p, dw.page);
      await d.p.fill(`.check[data-id="${dw.id}"] textarea.wtext`, WRITTEN_TEXT);
      if (dw.exam) { await d.p.click('#exam .ex-submit'); await d.p.click('#exam .ex-yes').catch(() => { }); }
      else await d.p.click(`.check[data-id="${dw.id}"] button.primary`, { force: true });
      await d.p.waitForTimeout(200);
      await d.p.click(`.check[data-id="${dw.id}"] .selfmark button[data-m="full"]`, { force: true });
      await d.p.click(`.check[data-id="${dw.id}"] button.fbk`, { force: true });
      await d.p.waitForFunction(() => window.sgQA.feeding().length === 0, null, { timeout: 10000 });
      await d.p.waitForTimeout(1200);
      const pill = await d.p.evaluate(() => document.getElementById('save').textContent);
      const stored = await d.p.evaluate(() => { const db = JSON.parse(localStorage.getItem('__mockdb') || '{}'); return Object.keys(db); });
      await d.p.evaluate(() => { const k = window.SG.config.storage_key; Object.keys(localStorage).filter(x => x.indexOf(k) === 0).forEach(x => localStorage.removeItem(x)); });
      await reload(d.p); await goPage(d.p, dw.page);
      const back = await wState(d.p, dw.id);
      check('with the db capability, progress saves to Claude storage', /All changes saved/.test(pill) && stored.indexOf('feedback/' + dw.id) >= 0 && stored.some(k => k.indexOf('progress/') === 0), pill + ' | ' + stored.join(','));
      check('with the db capability, a written answer, its mark and its feedback come back from the database', back.res === 'right' && back.val === WRITTEN_TEXT && back.pressed === 'full' && back.box && /advice/.test(back.boxText), JSON.stringify({ res: back.res, val: back.val, pressed: back.pressed, box: back.box }));
    }
    check('no script errors with the db capability', d.p._errs.length === 0, d.p._errs.slice(0, 3).join(' | '));
    await d.ctx.close();

    /* ---------------- without Claude (a plain HTML file) ---------------- */
    const n = await open(browser, { mock: false, hash: hasUnits ? firstUnit + '-q' : 'exam' });
    await n.p.waitForTimeout(500);
    const off = await n.p.evaluate(() => ({ walks: Array.from(document.querySelectorAll('button.walk')).filter(b => !b.hidden).length, fab: !document.querySelector('.ask-wrap').hidden, noAns: document.querySelector('.ask-wrap').classList.contains('no-answers'), pill: document.getElementById('save').textContent }));
    check('without Claude, Solve it for me hides itself', off.walks === 0, JSON.stringify(off));
    check('without Claude, Ask still saves questions but offers no instant answers', off.fab && off.noAns, JSON.stringify(off));
    check('without Claude, progress saves in the browser', /browser/.test(off.pill), off.pill);
    const nw = await n.p.evaluate(() => { const c = document.querySelector('section[data-sg="unit"] .check[data-type="written"]') || document.querySelector('.check[data-type="written"]'); return c ? { id: c.dataset.id, page: c.closest('main > section[id]').id, exam: !!c.closest('section[data-sg="exam"]') } : null; });
    if (nw) {
      await goPage(n.p, nw.page);
      await n.p.fill(`.check[data-id="${nw.id}"] textarea.wtext`, WRITTEN_TEXT);
      if (nw.exam) { await n.p.click('#exam .ex-submit'); await n.p.click('#exam .ex-yes').catch(() => { }); }
      else await n.p.click(`.check[data-id="${nw.id}"] button.primary`, { force: true });
      await n.p.waitForTimeout(200);
      await n.p.click(`.check[data-id="${nw.id}"] .selfmark button[data-m="none"]`, { force: true });
      const s0 = await wState(n.p, nw.id);
      check('without Claude, Get feedback hides itself and written answers still compare and self-mark', !s0.fbk && !s0.box && s0.res === 'wrong' && s0.sol && s0.rec && s0.rec.mark === 'none', JSON.stringify(s0));
    }
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
