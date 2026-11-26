#!/usr/bin/env node
/* Browser tests for a built exam review page.

   Usage: node test_review.js <exam_review.html> [--libs DIR] [--shots DIR]

   Needs Playwright with Chromium (found as "playwright", /opt/npm-tools/node_modules/playwright or
   $PLAYWRIGHT_PATH; never run "playwright install"). When the page has math, it also needs a local
   MathJax 3.2.2 (run fetch_libs.sh once; it prints the --libs directory), because the sandbox
   usually cannot reach cdnjs. window.claude is mocked so Ask runs end to end; later passes run
   without the sample capability and with no window.claude at all.

   Checks: no script errors; the summary shows the computed score and counts; one card per
   question; every filter chip shows exactly the matching cards; Wrong first sorts misses first;
   the Lessons view shows every lesson and the habits list; links between the views work; every
   miss has a walkthrough; images load; code renders in a monospace block; math typesets with no
   errors and no raw TeX (or MathJax is absent when there is no math); Ask follows the item on
   screen, accepts a typed target, answers under the item, keeps follow-ups, alternates roles and
   ends on a user turn, and survives a reload; Light and Dark; no sideways scrolling at phone
   width; without the sample capability Ask only saves.
   Screenshots go to --shots (default: test-shots/ next to the page).
   Exit code: 0 all passed, 1 a check failed, 2 bad usage, 3 Playwright or MathJax missing. */
const fs = require('fs');
const path = require('path');
const os = require('os');

function arg(name, dflt) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; }
const built = process.argv[2];
if (!built || !fs.existsSync(built)) { console.log('usage: node test_review.js <exam_review.html> [--libs DIR] [--shots DIR]'); process.exit(2); }
const SHOTS = arg('--shots', path.join(path.dirname(path.resolve(built)), 'test-shots'));
let pw = null;
for (const c of ['playwright', '/opt/npm-tools/node_modules/playwright', process.env.PLAYWRIGHT_PATH || '']) {
  if (!c) continue;
  try { pw = require(c); break; } catch (e) { }
}
if (!pw) { console.log('SKIP: Playwright is not installed. Install it (npm i playwright) or set PLAYWRIGHT_PATH.'); process.exit(3); }

const src = fs.readFileSync(built, 'utf8');
const m = src.match(/<script type="application\/json" id="review-data">([\s\S]*?)<\/script>/);
if (!m) { console.log('FAIL the page has no review data block; was it built with build_review.py?'); process.exit(1); }
const D = JSON.parse(m[1]);
const HAS_MATH = !!(D.summary && D.summary.has_math);
let MJ = null;
{
  const cands = [arg('--libs', ''), process.env.ST_LIBS || '', path.join(os.homedir(), '.cache', 'study-tools-libs'), process.env.SG_LIBS || '', path.join(os.homedir(), '.cache', 'study-guide-libs')].filter(Boolean);
  for (const c of cands) { if (fs.existsSync(path.join(c, 'mathjax', 'es5', 'tex-svg.js'))) { MJ = path.join(c, 'mathjax', 'es5'); break; } }
  if (!MJ && HAS_MATH) { console.log('SKIP: the page has math but MathJax 3.2.2 was not found. Run scripts/fetch_libs.sh first.'); process.exit(3); }
}
fs.mkdirSync(SHOTS, { recursive: true });

const results = [], warnings = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail && !ok ? '  :: ' + detail : '')); }
function warn(msg) { warnings.push(msg); console.log('WARN ' + msg); }

/* The artifact host wraps the page in a document skeleton; do the same for the test. */
const pageFile = path.join(path.dirname(path.resolve(built)), '.rv-test-page.html');
fs.writeFileSync(pageFile, '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + src + '</body></html>');

const MOCK = `(() => {
  window.__calls = [];
  const sample = async (messages, opts) => {
    window.__calls.push(JSON.parse(JSON.stringify(messages)));
    const n = window.__calls.length;
    const text = 'Answer ' + n + '. The key idea is the definition.\\n\\n- First, read the question.\\n- Then compare \\\\(\\\\frac{1}{2}\\\\) with the key.\\n\\n\`\`\`python\\nprint(1)\\n\`\`\`';
    if (opts && opts.onText) opts.onText({ text: text.slice(0, 12), delta: text.slice(0, 12) });
    await new Promise(r => setTimeout(r, 200));
    return { text, truncated: false };
  };
  window.claude = { use: async (name) => name === 'sample' ? sample : null };
})();`;
const NO_SAMPLE = `(() => { window.claude = { use: async () => null }; })();`;

async function open(browser, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }, opts.ctx || {}));
  if (opts.init) await ctx.addInitScript(opts.init);
  const p = await ctx.newPage();
  p._errs = []; p._mj = 0;
  p.on('pageerror', e => p._errs.push(e.message));
  p.on('console', mm => { if (mm.type() === 'error' && !/favicon|ERR_FILE_NOT_FOUND|net::|fonts\.g/.test(mm.text())) p._errs.push(mm.text()); });
  await p.route('https://cdnjs.cloudflare.com/**', r => {
    p._mj++;
    if (!MJ) return r.abort();
    const mm = r.request().url().match(/\/es5\/(.*)$/);
    const f = mm ? path.join(MJ, mm[1]) : path.join(MJ, 'tex-svg.js');
    r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) });
  });
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('https://fonts.gstatic.com/**', r => r.abort());
  await p.goto('file://' + pageFile + (opts.hash ? '#' + opts.hash : ''));
  await p.waitForFunction(() => window.rvReview, null, { timeout: 10000 });
  if (HAS_MATH) {
    await p.waitForFunction(() => window.rvMathReady, null, { timeout: 30000 });
    await p.waitForFunction(() => { const v = document.querySelector('.view:not([hidden])'); return document.getElementById('summary').dataset.tex === 'done' && v && v.dataset.tex === 'done'; }, null, { timeout: 30000 }).catch(() => { });
  }
  await p.waitForTimeout(300);
  return { ctx, p };
}
async function go(p, hash) { await p.evaluate(h => { location.hash = h; }, hash); await p.waitForTimeout(250); }
async function rawTex(p, sel) {
  return p.evaluate(s => {
    const out = []; const root = document.querySelector(s); if (!root) return out;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const el = n.parentElement; if (el.closest('script,mjx-container,pre,code,textarea')) continue; if (/\\\(|\\\[|\\frac/.test(n.nodeValue)) out.push(n.nodeValue.trim().slice(0, 50)); }
    return out;
  }, sel);
}

const Q = D.questions, L = D.lessons || [];
const conf = q => q.confidence || 'solid';
const PRED = {
  all: () => true,
  wrong: q => q.verdict === 'wrong' || q.verdict === 'blank',
  partial: q => q.verdict === 'partial',
  unsure: q => conf(q) !== 'solid',
  right: q => q.verdict === 'right',
  flagged: q => !!(q.student_note && String(q.student_note).trim())
};

(async () => {
  const browser = await pw.chromium.launch();
  try {
    /* ---------------- desktop, Claude mocked ---------------- */
    const { ctx, p } = await open(browser, { init: MOCK });
    check('no script errors on load', p._errs.length === 0, p._errs.join(' | '));
    const sum = await p.evaluate(() => ({ num: (document.querySelector('.score .num') || {}).textContent || '', tally: Array.from(document.querySelectorAll('.tally li b')).map(b => b.textContent), cards: document.querySelectorAll('#view-answers .qcard').length }));
    const S = D.summary;
    check('the summary shows the computed score', sum.num.replace(/\D/g, '') === String(S.pct_likely), sum.num + ' vs ' + S.pct_likely);
    check('the tally shows right, partly, wrong and unsure counts', sum.tally[0] === String(S.counts.right) && sum.tally[1] === String(S.counts.partial) && sum.tally[2] === String(S.counts.wrong + S.counts.blank) && sum.tally[3] === String(S.counts.unsure), JSON.stringify(sum.tally));
    check('one card per question', sum.cards === Q.length, sum.cards + ' vs ' + Q.length);

    /* walkthroughs, images, code */
    const misc = await p.evaluate(() => ({
      noWalk: Array.from(document.querySelectorAll('.qcard')).filter(c => c.dataset.v !== 'right' && !c.querySelector('details.walk')).map(c => c.id),
      imgs: Array.from(document.images).map(i => ({ ok: i.complete && i.naturalWidth > 0, alt: (i.alt || '').slice(0, 30) })),
      pre: Array.from(document.querySelectorAll('pre.code')).map(e => getComputedStyle(e).fontFamily)
    }));
    check('every miss has a walkthrough', misc.noWalk.length === 0, misc.noWalk.join(','));
    check('every image is embedded and loads', misc.imgs.every(i => i.ok), JSON.stringify(misc.imgs.filter(i => !i.ok)));
    const wantsCode = JSON.stringify(D).includes('```') || Q.some(q => (q.answer && q.answer.code) || (q.correct && q.correct.code));
    if (wantsCode) check('code renders in a monospace block', misc.pre.length > 0 && misc.pre.every(f => /mono|Menlo|Consolas|monospace/i.test(f)), JSON.stringify(misc.pre));
    const open1 = await p.evaluate(() => { const d = document.querySelector('details.walk'); if (!d) return null; d.open = true; return { steps: d.querySelectorAll('ol.steps li').length, parts: d.querySelectorAll('.wk-s').length }; });
    if (open1) check('a walkthrough shows How to think, Steps, Answer and The trap', open1.parts === 4 && open1.steps > 0, JSON.stringify(open1));

    /* math */
    if (HAS_MATH) {
      const mj = await p.evaluate(() => ({ n: document.querySelectorAll('#view-answers mjx-container, #summary mjx-container').length, err: Array.from(document.querySelectorAll('mjx-merror, [data-mjx-error]')).map(e => e.getAttribute('data-mjx-error') || e.textContent).slice(0, 3) }));
      check('math typesets with no MathJax errors', mj.n > 0 && mj.err.length === 0, JSON.stringify(mj));
      const raw = await rawTex(p, '#view-answers');
      check('no raw TeX left in Your answers', raw.length === 0, JSON.stringify(raw.slice(0, 3)));
    } else {
      check('no MathJax is loaded when the review has no math', p._mj === 0, 'requests: ' + p._mj);
    }

    /* filters */
    const counts = {};
    for (const f of Object.keys(PRED)) {
      const want = Q.filter(PRED[f]).map(q => 'q-' + q.id).sort();
      const disabled = await p.evaluate(ff => document.querySelector('.chip[data-f="' + ff + '"]').disabled, f);
      if (!want.length) { check('chip "' + f + '" is disabled when nothing matches', disabled || f === 'all', ''); continue; }
      await p.click('.chip[data-f="' + f + '"]');
      const got = await p.evaluate(() => Array.from(document.querySelectorAll('#view-answers .qcard')).filter(c => !c.hidden).map(c => c.id).sort());
      counts[f] = got.length;
      check('filter "' + f + '" shows exactly the matching questions', JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got) + ' vs ' + JSON.stringify(want));
    }
    await p.click('.chip[data-f="all"]');

    /* sort */
    await p.click('.sortbtn');
    const order = await p.evaluate(() => Array.from(document.querySelectorAll('#view-answers .qcard')).map(c => ({ v: c.dataset.v, c: c.dataset.conf })));
    const rank = o => (o.v === 'wrong' || o.v === 'blank') ? 0 : o.v === 'partial' ? 1 : o.c !== 'solid' ? 2 : 3;
    const sorted = order.every((o, i) => i === 0 || rank(order[i - 1]) <= rank(o));
    check('Wrong first puts wrong, then partly, then unsure, then right', sorted && rank(order[0]) === Math.min(...order.map(rank)), JSON.stringify(order.map(rank)));
    await p.screenshot({ path: path.join(SHOTS, 'desktop-answers-light.png'), fullPage: false });
    await p.click('.sortbtn');
    const back = await p.evaluate(() => Array.from(document.querySelectorAll('#view-answers .qcard')).map(c => c.id.slice(2)));
    check('turning Wrong first off restores exam order', JSON.stringify(back) === JSON.stringify(Q.map(q => String(q.id))), back.join(','));

    /* lessons view */
    await p.click('.tabs a[data-view="lessons"]'); await p.waitForTimeout(300);
    if (HAS_MATH) await p.waitForFunction(() => document.getElementById('view-lessons').dataset.tex === 'done', null, { timeout: 20000 }).catch(() => { });
    const lv = await p.evaluate(() => ({ ans: document.getElementById('view-answers').hidden, les: !document.getElementById('view-lessons').hidden, n: document.querySelectorAll('.lesson').length, ex: document.querySelectorAll('.lesson .lex').length, trap: document.querySelectorAll('.lesson .ltrap').length, fixes: document.querySelectorAll('#fixes li').length, hash: location.hash }));
    lv.sum = await p.evaluate(() => document.getElementById('summary').hidden);
    check('the Lessons tab shows every lesson and hides the answers and the score', lv.ans && lv.les && lv.sum && lv.n === L.length, JSON.stringify(lv));
    check('every lesson has a worked example and a trap', lv.ex === L.length && lv.trap === L.length, JSON.stringify(lv));
    check('the habits list closes the lessons', lv.fixes === (D.fixes || []).length && lv.fixes > 0, JSON.stringify(lv));
    if (HAS_MATH) { const raw = await rawTex(p, '#view-lessons'); check('no raw TeX left in Lessons', raw.length === 0, JSON.stringify(raw.slice(0, 3))); }
    await p.screenshot({ path: path.join(SHOTS, 'desktop-lessons-light.png') });
    const link = await p.evaluate(() => { const a = document.querySelector('.lesson a.tag[href^="#q-"]'); return a ? a.getAttribute('href') : null; });
    if (link) {
      await p.click('.chip[data-f="right"]', { force: true }).catch(() => { });
      await p.click('.lesson a.tag[href="' + link + '"]'); await p.waitForTimeout(400);
      const jumped = await p.evaluate(h => { const el = document.querySelector(h); const r = el.getBoundingClientRect(); return { view: !document.getElementById('view-answers').hidden, shown: !el.hidden, top: Math.round(r.top) }; }, link);
      check('a question link in a lesson opens that card in Your answers', jumped.view && jumped.shown && jumped.top >= 0 && jumped.top < 400, JSON.stringify(jumped));
    }
    const hl = await p.evaluate(() => { const a = document.querySelector('.habits a[href^="#lesson-"]'); return a ? a.getAttribute('href') : null; });
    if (hl) {
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.click('.habits a[href="' + hl + '"]'); await p.waitForTimeout(400);
      const j2 = await p.evaluate(h => ({ les: !document.getElementById('view-lessons').hidden, top: Math.round(document.querySelector(h).getBoundingClientRect().top) }), hl);
      check('a pattern in the summary opens its lesson', j2.les && j2.top >= 0 && j2.top < 400, JSON.stringify(j2));
    }

    /* Ask: follows the item on screen, answers under it, follow-ups */
    await go(p, 'answers');
    const target = Q.find(q => q.verdict !== 'right') || Q[0];
    await go(p, 'q-' + target.id); await p.waitForTimeout(300);
    const fabText = await p.evaluate(() => document.querySelector('.ask-fab').textContent);
    check('the Ask button follows the card on screen', fabText.includes('Q' + target.id), fabText);
    await p.click('.ask-fab');
    const tv = await p.inputValue('#ap-target');
    check('Ask is prefilled with the item on screen', tv === String(target.id), tv);
    await p.fill('#ap-text', 'Why is my answer wrong?');
    await p.click('.ask-now');
    await p.waitForFunction(() => Object.values(window.rvReview.docs()).some(d => d.thread.length === 2), null, { timeout: 10000 });
    await p.waitForTimeout(300);
    const a1 = await p.evaluate(id => { const c = document.getElementById('q-' + id); const t = c.querySelector('.qa .thread'); return { under: !!t, msgs: t ? t.querySelectorAll('.msg').length : 0, code: t ? t.querySelectorAll('pre.code').length : 0, last: window.__calls[window.__calls.length - 1] }; }, target.id);
    const roles1 = a1.last.map(mm => mm.role);
    check('Ask saves the question and answers it under its card', a1.under && a1.msgs === 2, JSON.stringify({ under: a1.under, msgs: a1.msgs }));
    check('the Ask prompt is one user turn that names the question and the student answer', roles1.length === 1 && roles1[0] === 'user' && a1.last[0].content.includes('<question number="' + target.id + '"') && a1.last[0].content.includes('<student_answer>'), JSON.stringify(roles1));
    check('code in an answer renders as a monospace block', a1.code === 1, String(a1.code));
    if (MJ) {
      await p.waitForFunction(() => window.rvMathReady, null, { timeout: 20000 }).catch(() => { });
      await p.waitForTimeout(800);
      const raw = await rawTex(p, '#q-' + target.id + ' .qa');
      check('math in a Claude answer is typeset' + (HAS_MATH ? '' : ' (MathJax loads on demand)'), raw.length === 0 && await p.evaluate(() => !!window.rvMathReady), JSON.stringify(raw));
    }
    await p.fill('#q-' + target.id + ' .th-follow', 'Can you give a hint for next time?');
    await p.click('#q-' + target.id + ' .th-send');
    await p.waitForFunction(() => Object.values(window.rvReview.docs()).some(d => d.thread.length === 4), null, { timeout: 10000 });
    await p.waitForTimeout(300);
    const a2 = await p.evaluate(() => window.__calls[window.__calls.length - 1].map(mm => mm.role));
    check('a follow-up keeps the thread: roles alternate and end on the user', JSON.stringify(a2) === JSON.stringify(['user', 'assistant', 'user']), JSON.stringify(a2));
    await p.screenshot({ path: path.join(SHOTS, 'desktop-ask-light.png') });

    /* Ask with a typed target */
    if (L.length >= 2) {
      await p.click('.ask-fab');
      await p.fill('#ap-target', 'zz9');
      await p.fill('#ap-text', 'test');
      await p.click('.ask-now');
      const err = await p.evaluate(() => { const e = document.querySelector('.ap-err'); return e.hidden ? '' : e.textContent; });
      check('an unknown target gives a plain error', /no question or lesson/.test(err), err);
      await p.fill('#ap-target', 'L2');
      await p.fill('#ap-text', 'Another example please.');
      await p.click('.ask-now');
      await p.waitForTimeout(700);
      const l2 = await p.evaluate(id => ({ view: !document.getElementById('view-lessons').hidden, thread: !!document.querySelector('#lesson-' + id + ' .qa .thread .msg.a'), prompt: (window.__calls[window.__calls.length - 1][0] || {}).content || '' }), L[1].id);
      check('a typed lesson target ("L2") answers under that lesson', l2.view && l2.thread && l2.prompt.includes('<lesson number="2"'), JSON.stringify({ view: l2.view, thread: l2.thread }));
      if (HAS_MATH) { await p.waitForTimeout(600); const raw = await rawTex(p, '#lesson-' + L[1].id + ' .qa'); check('math in an answer is typeset', raw.length === 0, JSON.stringify(raw)); }
    }

    /* reload keeps questions and UI state */
    const nDocs = await p.evaluate(() => Object.keys(window.rvReview.docs()).length);
    await p.reload(); await p.waitForFunction(() => window.rvReview); await p.waitForTimeout(400);
    const kept = await p.evaluate(() => ({ docs: Object.keys(window.rvReview.docs()).length, threads: document.querySelectorAll('.qa .thread').length }));
    check('saved questions survive a reload', kept.docs === nDocs && kept.threads === nDocs, JSON.stringify(kept) + ' vs ' + nDocs);

    /* themes */
    await go(p, 'answers');
    const bg = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await p.click('.themesw button[data-t="dark"]'); await p.waitForTimeout(150);
    const dark = await bg();
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.screenshot({ path: path.join(SHOTS, 'desktop-answers-dark.png') });
    await go(p, 'lessons'); await p.evaluate(() => window.scrollTo(0, 0));
    await p.screenshot({ path: path.join(SHOTS, 'desktop-lessons-dark.png') });
    await p.click('.themesw button[data-t="light"]'); await p.waitForTimeout(150);
    const light = await bg();
    check('Light and Dark switch the page colors', dark !== light, dark + ' / ' + light);
    await go(p, 'answers'); await p.evaluate(() => window.scrollTo(0, 0));
    await p.screenshot({ path: path.join(SHOTS, 'desktop-top-light.png') });
    check('no script errors during the desktop run', p._errs.length === 0, p._errs.slice(0, 5).join(' | '));
    await ctx.close();

    /* ---------------- phone width, dark ---------------- */
    const ph = await open(browser, { init: MOCK, ctx: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' } });
    const wide = [];
    for (const v of ['answers', 'lessons']) {
      await go(ph.p, v);
      await ph.p.evaluate(() => document.querySelectorAll('details.walk').forEach(d => { d.open = true; }));
      await ph.p.waitForTimeout(200);
      const ov = await ph.p.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: window.innerWidth }));
      if (ov.sw > ov.iw + 1) wide.push(v + ':' + ov.sw);
      const boxes = await ph.p.evaluate(() => Array.from(document.querySelectorAll('.view:not([hidden]) .mathwrap, .view:not([hidden]) pre.code, .view:not([hidden]) .rubric-wrap, .view:not([hidden]) mjx-container.wide')).filter(e => e.offsetParent && e.scrollWidth > e.clientWidth + 2).map(e => (e.closest('[id]') || {}).id + ' ' + e.className));
      boxes.forEach(b => warn('at phone width this box scrolls sideways: ' + b));
    }
    check('no horizontal page scrolling at phone width', wide.length === 0, wide.join(', '));
    await go(ph.p, 'answers'); await ph.p.evaluate(() => window.scrollTo(0, 0));
    await ph.p.screenshot({ path: path.join(SHOTS, 'phone-top-dark.png') });
    await go(ph.p, 'q-' + target.id);
    await ph.p.screenshot({ path: path.join(SHOTS, 'phone-card-dark.png') });
    await go(ph.p, 'lessons'); await ph.p.evaluate(() => window.scrollTo(0, 0));
    await ph.p.screenshot({ path: path.join(SHOTS, 'phone-lessons-dark.png') });
    check('no script errors at phone width', ph.p._errs.length === 0, ph.p._errs.join(' | '));
    await ph.ctx.close();

    /* ---------------- without the sample capability, and with no window.claude ---------------- */
    for (const [label, init] of [['without the sample capability', NO_SAMPLE], ['with no window.claude', null]]) {
      const n = await open(browser, { init });
      await n.p.waitForTimeout(400);
      const st = await n.p.evaluate(() => ({ s: window.rvReview.state().sample, saveOnly: document.querySelector('.ask-wrap').classList.contains('save-only'), nowVisible: getComputedStyle(document.querySelector('.ask-now')).display !== 'none' }));
      check(label + ', Ask hides "Ask Claude" and only saves', st.s === 'none' && st.saveOnly && !st.nowVisible, JSON.stringify(st));
      await n.p.click('.ask-fab');
      await n.p.fill('#ap-text', 'Saved for later?');
      await n.p.click('.ask-save');
      await n.p.waitForTimeout(300);
      const sv = await n.p.evaluate(() => ({ docs: Object.keys(window.rvReview.docs()).length, note: (document.querySelector('.qa .thread .th-note') || {}).textContent || '', answerBtn: !!document.querySelector('.qa .th-answer') }));
      check(label + ', a question is saved with a note and no Answer button', sv.docs === 1 && /published/.test(sv.note) && !sv.answerBtn, JSON.stringify(sv));
      check('no script errors ' + label, n.p._errs.length === 0, n.p._errs.join(' | '));
      await n.ctx.close();
    }
  } catch (e) {
    check('test run finished', false, e.stack || String(e));
  } finally {
    await browser.close();
    try { fs.unlinkSync(pageFile); } catch (e) { }
  }
  const failed = results.filter(r => !r.ok);
  console.log('\nScreenshots: ' + SHOTS);
  console.log((results.length - failed.length) + ' passed, ' + failed.length + ' failed, ' + warnings.length + ' warning(s).');
  process.exit(failed.length ? 1 : 0);
})();
