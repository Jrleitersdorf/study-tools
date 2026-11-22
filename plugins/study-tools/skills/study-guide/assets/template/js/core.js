/* ---------- core engine: questions, grading, practice exam, progress, saving ----------
   ENGINE FILE. Do not edit per guide; everything guide-specific comes from window.SG.config
   (built from guide.config.json) and from the data-sg tags in the content.
   Reads:  section[data-sg="unit"]      one page per unit (id, data-num, data-title, optional data-label)
           section[data-sg="exam"]      the practice exam page (optional)
           .check[data-sg="question"]   questions (data-id, data-type mc|multi|tf|num|written, data-ans, data-tol,
                                        data-suffix, data-points, data-from, data-topic; written: data-format, data-lines)
           .sol[data-for]               worked solutions, matched to questions by id (written: model-answer + rubric)
   Written items are self-marked: rec.mark = 'full' | 'part' | 'none' (credit 1, 0.5, 0); firstCorrect is true
   only when the first attempt is marked full. The exam score weights every question by data-points (default 1).
   Saves:  claude.use('db') collection "progress" when the artifact has the db capability,
           otherwise localStorage <storage_key>-progress. Unsent practice text of written items is kept in
           localStorage <storage_key>-wdraft (this browser only). */
(function () {
  'use strict';
  var CFG = (window.SG && window.SG.config) || {};
  var KEY = CFG.storage_key || 'study-guide';
  var LS_KEY = KEY + '-progress';
  var UNIT_WORD = CFG.unit_label || 'Unit';
  var LETTERS = 'ABCDEFGH';
  var unitEls = Array.prototype.slice.call(document.querySelectorAll('section[data-sg="unit"]'));
  var examEl = document.querySelector('section[data-sg="exam"]');
  var SECS = unitEls.map(function (el) { return { id: el.id, num: el.dataset.num || '', label: el.dataset.label || UNIT_WORD, title: el.dataset.title || '', el: el, exam: false }; });
  if (examEl) SECS.push({ id: examEl.id, num: '', label: '', title: examEl.dataset.title || 'Practice exam', el: examEl, exam: true });
  var SEC = {}; SECS.forEach(function (s) { SEC[s.id] = s; });
  window.sgUnitName = function (s) { s = typeof s === 'string' ? SEC[s] : s; if (!s) return ''; return s.exam ? s.title : (s.label + (s.num ? ' ' + s.num : '')).trim(); };
  var unitName = window.sgUnitName;
  buildToc();
  var state = {};
  var checkIndex = {};
  var secChecks = {};
  SECS.forEach(function (s) {
    state[s.id] = { section: s.id, title: s.title, confidence: null, checks: {}, updatedAt: null };
    if (s.exam) { state[s.id].startedAt = null; state[s.id].submittedAt = null; state[s.id].seconds = null; state[s.id].history = []; state[s.id].draft = {}; }
    secChecks[s.id] = [];
  });

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fmtN(v) { return String(Math.round((v || 0) * 100) / 100); }
  var CREDIT = { full: 1, part: 0.5, none: 0 };
  var MARK_RES = { full: 'right', part: 'partial', none: 'wrong' };
  var MARK_WORD = { full: 'full marks', part: 'partly', none: 'missed' };
  var LS_WD = KEY + '-wdraft';
  var wdraft = {};
  try { wdraft = JSON.parse(localStorage.getItem(LS_WD) || '{}') || {}; } catch (e) { wdraft = {}; }
  function saveWDraft() { try { localStorage.setItem(LS_WD, JSON.stringify(wdraft)); } catch (e) { } }
  var FIELD_SIZING = !!(window.CSS && CSS.supports && CSS.supports('field-sizing', 'content'));
  function grow(ta) {
    if (!ta || FIELD_SIZING) return;
    if (!ta.offsetParent) return;
    ta.style.height = 'auto';
    ta.style.height = (ta.scrollHeight + 2) + 'px';
  }
  function writtenChanged(info) { if (window.sgWrittenChanged) { try { window.sgWrittenChanged(info.id); } catch (e) { } } }

  function buildToc() {
    var ol = document.getElementById('toc');
    if (!ol) return;
    var html = '';
    SECS.forEach(function (s) {
      var el = s.el;
      html += '<li><a class="unit-link" href="#' + el.id + '" data-unit="' + el.id + '" data-target="' + el.id + '"><span>' + esc(unitName(s)) + '</span><span class="st"></span></a><ol>';
      if (!s.exam) {
        Array.prototype.forEach.call(el.querySelectorAll('[data-sg="section"][id]'), function (it) {
          var h = it.querySelector('[data-sg="section-title"]'), n = h && h.querySelector('.n');
          var label = !h ? it.id : (h.dataset.short || (n ? h.textContent.replace(n.textContent, '') : h.textContent).trim());
          html += '<li><a href="#' + it.id + '" data-target="' + it.id + '">' + esc(label) + '</a></li>';
        });
        var cy = el.querySelector('details[data-sg="questions"]');
        if (cy) { if (!cy.id) cy.id = el.id + '-q'; html += '<li><a href="#' + cy.id + '" data-target="' + cy.id + '">Questions</a></li>'; }
      }
      html += '</ol></li>';
    });
    html += '<li><a class="unit-link" href="#summary" data-target="summary"><span>Your summary</span></a></li>';
    ol.innerHTML = html;
  }

  /* ---------- build questions ---------- */
  SECS.forEach(function (s) {
    var els = s.el.querySelectorAll('.check');
    Array.prototype.forEach.call(els, function (el, i) { build(el, s, i + 1); });
    var conf = s.el.querySelector('.conf');
    if (conf) buildConf(conf, s.id);
  });

  function qLabel(s, n) { return s.exam ? String(n) : (s.num ? s.num + '.' + n : String(n)); }

  function build(el, s, n) {
    var sec = s.id, id = el.dataset.id, type = el.dataset.type, exam = s.exam;
    var pts = parseFloat(el.dataset.points);
    var info = { el: el, sec: sec, id: id, type: type, n: n, locked: false, exam: exam, points: pts > 0 ? pts : 1, hasPoints: pts > 0 };
    checkIndex[id] = info;
    secChecks[sec].push(id);

    var qt = el.querySelector('.qt');
    var q = document.createElement('div'); q.className = 'q';
    var qn = document.createElement('span'); qn.className = 'qn'; qn.textContent = qLabel(s, n);
    qt.parentNode.insertBefore(q, qt);
    q.appendChild(qn); q.appendChild(qt);
    var tags = [];
    if (type === 'multi') tags.push('Select all');
    if (type === 'tf') tags.push('True / False');
    if (type === 'written') tags.push(el.dataset.format === 'code' ? 'Code' : 'Written');
    if (info.hasPoints) tags.push(fmtN(info.points) + (info.points === 1 ? ' point' : ' points'));
    if (tags.length) {
      var tag = document.createElement('span'); tag.className = 'tag';
      tag.textContent = tags.join(' · ');
      var tagHost = qt.tagName === 'P' ? qt : (qt.querySelector('p') || qt);
      tagHost.appendChild(tag);
    }

    var list = el.querySelector('.opts');
    if (type === 'tf') {
      list = document.createElement('ol'); list.className = 'opts';
      list.innerHTML = '<li data-k="T">True</li><li data-k="F">False</li>';
      q.parentNode.insertBefore(list, q.nextSibling);
    }
    if (list) {
      Array.prototype.forEach.call(list.children, function (li, j) {
        var label = document.createElement('label'); label.className = 'opt';
        var inp = document.createElement('input');
        inp.type = type === 'multi' ? 'checkbox' : 'radio'; inp.name = id; inp.value = li.dataset.k;
        var key = document.createElement('span'); key.className = 'k'; key.textContent = type === 'tf' ? '' : LETTERS[j];
        var t = document.createElement('span'); t.className = 't';
        while (li.firstChild) t.appendChild(li.firstChild);
        label.appendChild(inp); label.appendChild(key); label.appendChild(t);
        li.appendChild(label);
        inp.addEventListener('change', function () { markSel(info); if (info.onInput) info.onInput(); });
      });
      info.list = list;
    }
    if (type === 'num') {
      var row = document.createElement('div'); row.className = 'numrow';
      var inp = document.createElement('input');
      inp.type = 'text'; inp.inputMode = 'decimal'; inp.autocomplete = 'off'; inp.spellcheck = false;
      inp.placeholder = 'Your answer'; inp.setAttribute('aria-label', 'Your answer to question ' + qLabel(s, n));
      row.appendChild(inp);
      var suffix = el.dataset.suffix || el.dataset.unit;
      if (suffix) { var u = document.createElement('span'); u.className = 'suffix'; u.textContent = suffix; row.appendChild(u); }
      q.parentNode.insertBefore(row, q.nextSibling);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); grade(info); } });
      inp.addEventListener('input', function () { info.nudge.hidden = true; if (info.onInput) info.onInput(); });
      info.input = inp;
      var hint = document.createElement('p'); hint.className = 'mathhint';
      hint.textContent = 'Exact answers are fine. Type / for a fraction and use the arrow keys to move between top and bottom; ^ for a power, sqrt for a root, e and pi as constants.';
      row.parentNode.insertBefore(hint, row.nextSibling);
      (window.__sgNum = window.__sgNum || []).push(info);
    }
    if (type === 'written') {
      var code = el.dataset.format === 'code';
      var lines = parseInt(el.dataset.lines, 10); if (!(lines > 0)) lines = code ? 6 : 4;
      var ta = document.createElement('textarea');
      ta.className = 'wtext' + (code ? ' code' : '');
      ta.rows = lines; ta.style.minHeight = (lines * (code ? 1.5 : 1.55) + 1.3) + 'em';
      ta.spellcheck = !code; ta.autocomplete = 'off';
      if (code) { ta.setAttribute('wrap', 'off'); ta.setAttribute('autocapitalize', 'off'); ta.setAttribute('autocorrect', 'off'); }
      ta.placeholder = code ? 'Write your code here.' : 'Write your answer here, as you would on the exam.';
      ta.setAttribute('aria-label', 'Your answer to question ' + qLabel(s, n));
      q.parentNode.insertBefore(ta, q.nextSibling);
      if (!exam && wdraft[id]) ta.value = wdraft[id];
      ta.addEventListener('input', function () {
        grow(ta); info.nudge.hidden = true;
        if (!exam) { if (ta.value) wdraft[id] = ta.value; else delete wdraft[id]; saveWDraft(); }
        if (info.onInput) info.onInput();
      });
      ta.addEventListener('focus', function () { grow(ta); });
      ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !exam) { e.preventDefault(); compareWritten(info); } });
      info.input = ta;
    }
    if (exam) info.onInput = function () { examDraft(info); };

    var act = document.createElement('div'); act.className = 'actions';
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'primary'; btn.textContent = type === 'written' ? 'Compare with the model answer' : 'Check';
    var retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Try again'; retry.hidden = true;
    var nudge = document.createElement('span'); nudge.className = 'nudge'; nudge.hidden = true;
    var showBtn = document.createElement('button'); showBtn.type = 'button'; showBtn.className = 'showans'; showBtn.textContent = 'Show answer'; showBtn.hidden = true;
    var walk = document.createElement('button'); walk.type = 'button'; walk.className = 'walk'; walk.textContent = 'Solve it for me'; walk.dataset.id = id;
    walk.title = 'Claude works through this question step by step. It counts as a wrong answer.';
    if (exam) { btn.hidden = true; walk.hidden = true; walk.dataset.exam = '1'; walk.title = 'Claude works through this question step by step.'; }
    act.appendChild(btn); act.appendChild(retry); act.appendChild(showBtn); act.appendChild(nudge); act.appendChild(walk);

    var fb = document.createElement('div'); fb.className = 'fb'; fb.hidden = true; fb.setAttribute('aria-live', 'polite');
    var verdict = document.createElement('div'); verdict.className = 'verdict';
    var first = document.createElement('div'); first.className = 'first';
    var expl = el.querySelector('.expl');
    var sol = document.querySelector('.sol[data-for="' + id + '"]');
    fb.appendChild(verdict); if (expl) fb.appendChild(expl); if (sol) { sol.hidden = true; fb.appendChild(sol); }
    if (type === 'written') {
      if (sol && !sol.querySelector('.sol-h')) { var sh = document.createElement('p'); sh.className = 'sol-h'; sh.textContent = 'Model answer'; sol.insertBefore(sh, sol.firstChild); }
      var rb = sol && sol.querySelector('[data-sg="rubric"]');
      if (rb && !(rb.previousElementSibling && rb.previousElementSibling.classList.contains('rubric-h'))) { var rh = document.createElement('p'); rh.className = 'rubric-h'; rh.textContent = 'Rubric'; rb.parentNode.insertBefore(rh, rb); }
      if (sol) Array.prototype.forEach.call(sol.querySelectorAll('[data-sg="rubric"] > li[data-marks]'), function (li) {
        var mv = parseFloat(li.dataset.marks); if (isNaN(mv)) return;
        var mk = document.createElement('span'); mk.className = 'mk'; mk.textContent = fmtN(mv) + (mv === 1 ? ' mark' : ' marks');
        li.insertBefore(mk, li.firstChild);
      });
      var sm = document.createElement('div'); sm.className = 'selfmark'; sm.hidden = true;
      sm.innerHTML = '<span class="sm-l">Mark your answer against the rubric:</span><div class="seg" role="group" aria-label="Your mark for question ' + esc(qLabel(s, n)) + '">' +
        '<button type="button" data-m="full" aria-pressed="false">Full marks</button><button type="button" data-m="part" aria-pressed="false">Partly</button><button type="button" data-m="none" aria-pressed="false">Missed it</button></div>';
      Array.prototype.forEach.call(sm.querySelectorAll('button'), function (b) { b.addEventListener('click', function () { setMark(info, b.dataset.m); }); });
      fb.appendChild(sm); info.markEl = sm;
    }
    fb.appendChild(first);
    var fromU = el.dataset.from && SEC[el.dataset.from] && !SEC[el.dataset.from].exam ? el.dataset.from : '';
    if (exam && (fromU || el.dataset.topic)) { var fr = document.createElement('div'); fr.className = 'from'; fr.textContent = fromU ? 'From ' + unitName(fromU) + ': ' + SEC[fromU].title : 'Topic: ' + el.dataset.topic; fb.appendChild(fr); }
    el.appendChild(act); el.appendChild(fb);

    btn.addEventListener('click', function () { if (type === 'written') compareWritten(info); else grade(info); });
    retry.addEventListener('click', function () { reset(info); });
    showBtn.addEventListener('click', function () { reveal(info); });
    info.btn = btn; info.retry = retry; info.nudge = nudge; info.fb = fb; info.verdict = verdict; info.first = first;
    info.showBtn = showBtn; info.expl = expl; info.sol = sol; info.walk = walk;
  }

  function markSel(info) {
    Array.prototype.forEach.call(info.list.querySelectorAll('input'), function (inp) {
      inp.closest('.opt').classList.toggle('sel', inp.checked);
    });
    info.nudge.hidden = true;
  }

  function parseNum(s) {
    s = String(s).replace(/\u2212/g, '-').replace(/\s+/g, '').replace(/,/g, '');
    var m = s.match(/^(-?\d*\.?\d+)\/(-?\d*\.?\d+)$/);
    if (m) { var d = parseFloat(m[2]); return d === 0 ? NaN : parseFloat(m[1]) / d; }
    m = s.match(/^(-?\d*\.?\d+)%$/);
    if (m) return parseFloat(m[1]) / 100;
    if (/^-?\d*\.?\d+$/.test(s)) return parseFloat(s);
    return window.sgEvalMath ? window.sgEvalMath(s) : NaN;
  }

  function readAnswer(info) {
    if (info.type === 'num') { var raw = String(info.input.value || '').trim(); return raw ? raw : null; }
    if (info.type === 'written') { var wv = String(info.input.value || ''); return wv.trim() ? wv.replace(/\s+$/, '') : null; }
    var sel = Array.prototype.slice.call(info.list.querySelectorAll('input:checked')).map(function (i) { return i.value; });
    if (!sel.length) return null;
    return info.type === 'multi' ? sel.sort().join(',') : sel[0];
  }

  function isCorrect(info, ans) {
    var key = info.el.dataset.ans;
    if (ans === '' || ans === null || ans === undefined) return false;
    if (info.type === 'written') return false; /* written items are marked by the student (setMark), never here */
    if (info.type === 'num') {
      var v = parseNum(ans); if (isNaN(v)) return null;
      var tol = parseFloat(info.el.dataset.tol || '0.005');
      return Math.abs(v - parseFloat(key)) <= tol + 1e-9;
    }
    if (info.type === 'multi') return ans === key.split(',').map(function (x) { return x.trim(); }).sort().join(',');
    return ans === key;
  }

  function fmtKey(info) {
    var v = parseFloat(info.el.dataset.ans);
    return String(Number(v.toFixed(3)));
  }

  function showNudge(info, msg) { info.nudge.textContent = msg; info.nudge.hidden = false; }

  function grade(info) {
    if (info.locked || info.exam) return;
    var ans = readAnswer(info);
    if (ans === null) { showNudge(info, info.type === 'num' ? 'Enter a number first.' : 'Pick an answer first.'); return; }
    var ok = isCorrect(info, ans);
    if (ok === null) { showNudge(info, 'Could not read that. Try 0.75, 3/4 or 1/(1+e^-1).'); return; }
    var st = state[info.sec];
    var rec = st.checks[info.id] || (st.checks[info.id] = { tries: 0 });
    var now = new Date().toISOString();
    if (rec.first === undefined) { rec.first = ans; rec.firstCorrect = ok; rec.firstAt = now; }
    rec.last = ans; rec.lastCorrect = ok; rec.tries = (rec.tries || 0) + 1; rec.at = now;
    st.updatedAt = now;
    show(info, ans, ok, rec);
    persist(info.sec);
    refreshAll();
  }

  /* ---------- written items: compare with the model answer, then mark yourself ---------- */
  function compareWritten(info) {
    if (info.locked || info.exam) return;
    var ans = readAnswer(info);
    if (ans === null) { showNudge(info, 'Write your answer first.'); return; }
    var st = state[info.sec];
    var rec = st.checks[info.id] || (st.checks[info.id] = { tries: 0 });
    var now = new Date().toISOString();
    if (rec.first === undefined) { rec.first = ans; rec.firstCorrect = false; rec.firstAt = now; }
    rec.last = ans; rec.lastCorrect = false; rec.tries = (rec.tries || 0) + 1; rec.at = now;
    delete rec.mark; delete rec.gaveUp;
    st.updatedAt = now;
    delete wdraft[info.id]; saveWDraft();
    show(info, ans, false, rec);
    persist(info.sec);
    refreshAll();
  }

  function setMark(info, m) {
    if (!CREDIT.hasOwnProperty(m) || !info.locked) return;
    var st = state[info.sec], rec = st.checks[info.id];
    if (!rec || !String(rec.last || '').trim() || rec.gaveUp) return;
    if (info.exam && !st.submittedAt) return;
    var now = new Date().toISOString();
    rec.mark = m; rec.lastCorrect = m === 'full'; rec.markedAt = now; rec.at = now;
    /* the first attempt's mark decides firstCorrect; it can be corrected until Try again */
    if ((rec.tries || 1) <= 1) { rec.firstMark = m; rec.firstCorrect = m === 'full'; }
    st.updatedAt = now;
    show(info, rec.last, false, rec);
    if (info.exam) {
      var sc = examScore(), h = st.history && st.history[st.history.length - 1];
      if (h) { h.right = sc.right; h.total = sc.total; h.pending = sc.pending; }
      paintExam();
    }
    persist(info.sec);
    refreshAll();
  }

  function showWritten(info, ans, rec) {
    rec = rec || {};
    info.locked = true; info.el.classList.add('locked');
    info.nudge.hidden = true;
    info.lastAns = ans; info.lastOk = rec.mark === 'full';
    var blank = !String(ans || '').trim();
    var m = rec.mark || (blank ? 'none' : '');
    info.input.value = ans || ''; info.input.readOnly = true; grow(info.input);
    info.el.dataset.res = m ? MARK_RES[m] : 'pending';
    info.verdict.className = 'verdict ' + ({ full: 'r', part: 'p', none: 'w' }[m] || 'n');
    info.verdict.textContent = rec.gaveUp ? 'Solved for you, counted as missed.' :
      blank ? 'Not answered, counted as missed.' :
      m === 'full' ? 'You marked this: full marks.' : m === 'part' ? 'You marked this: partly right.' : m === 'none' ? 'You marked this: missed it.' :
      'Compare your answer with the model answer and the rubric, then mark it yourself.';
    if (info.expl) info.expl.hidden = false;
    if (info.sol) { info.sol.hidden = false; if (window.sgMathReady && window.MathJax && MathJax.typesetPromise && !info.sol.querySelector('mjx-container') && /\\\(|\\\[/.test(info.sol.textContent)) MathJax.typesetPromise([info.sol]).catch(function () { }); }
    if (info.markEl) {
      info.markEl.hidden = blank || !!rec.gaveUp;
      Array.prototype.forEach.call(info.markEl.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.m === rec.mark)); });
    }
    info.showBtn.hidden = true;
    info.first.textContent = !info.exam && rec.tries > 1 ? ('First try: ' + (rec.firstMark ? MARK_WORD[rec.firstMark] : 'not marked') + ' · attempts: ' + rec.tries) : '';
    info.fb.hidden = false;
    info.btn.hidden = true; info.retry.hidden = !!info.exam;
    if (info.exam && info.walk && !info.walk.dataset.off) info.walk.hidden = false;
    var wb = info.el.querySelector('.walkbox'); if (wb && wb.dataset.has && rec.shown) { wb.hidden = false; if (info.walk) info.walk.hidden = true; }
    writtenChanged(info);
  }

  function show(info, ans, ok, rec) {
    if (info.type === 'written') { showWritten(info, ans, rec); return; }
    info.locked = true; info.el.classList.add('locked');
    info.el.dataset.res = ok ? 'right' : 'wrong';
    info.nudge.hidden = true;
    info.lastAns = ans; info.lastOk = ok;
    if (info.list) {
      var chosen = String(ans).split(',');
      Array.prototype.forEach.call(info.list.querySelectorAll('input'), function (inp) {
        var isChosen = chosen.indexOf(inp.value) >= 0;
        inp.checked = isChosen; inp.disabled = true;
        var lab = inp.closest('.opt');
        lab.classList.remove('sel', 'ok', 'no', 'miss');
        if (ok && isChosen) lab.classList.add('ok');
        else if (!ok && isChosen && info.type !== 'multi') lab.classList.add('no');
        else if (!ok && isChosen) lab.classList.add('sel');
      });
    }
    if (info.input) { info.input.value = ans; info.input.disabled = true; }
    info.verdict.className = 'verdict ' + (ok ? 'r' : 'w');
    if (ok) {
      info.verdict.textContent = 'Correct.';
      if (info.type === 'num' && !/^-?\d*\.?\d+$/.test(String(ans).trim())) { var cv = parseNum(ans); if (!isNaN(cv)) info.verdict.textContent = 'Correct (\u2248 ' + String(Number(cv.toFixed(4))) + ').'; }
    } else if (ans === '' && info.exam) info.verdict.textContent = 'Not answered.';
    else if (info.type === 'num') {
      var yv = parseNum(ans);
      info.verdict.textContent = 'Not quite' + (isNaN(yv) ? '.' : ': yours works out to ' + String(Number(yv.toFixed(4))) + '.');
    } else if (info.type === 'multi') info.verdict.textContent = 'Not quite. At least one choice is wrong or missing.';
    else info.verdict.textContent = 'Not quite.';
    if (info.expl) info.expl.hidden = !ok;
    if (info.sol) info.sol.hidden = true;
    info.showBtn.textContent = ok ? 'Show worked solution' : 'Show answer';
    info.showBtn.hidden = ok && !info.sol;
    info.first.textContent = !info.exam && rec && rec.tries > 1 ? ('First try: ' + (rec.firstCorrect ? 'right' : 'wrong') + ' \u00b7 attempts: ' + rec.tries) : '';
    info.fb.hidden = false;
    info.btn.hidden = true; info.retry.hidden = !!info.exam;
    if (info.exam && info.walk && !info.walk.dataset.off) info.walk.hidden = false;
    if (rec && rec.shown) applyReveal(info);
  }

  function applyReveal(info) {
    var ok = info.lastOk, ans = info.lastAns;
    if (info.list) {
      var keySet = info.el.dataset.ans.split(',');
      Array.prototype.forEach.call(info.list.querySelectorAll('input'), function (inp) {
        var isKey = keySet.indexOf(inp.value) >= 0, isChosen = inp.checked;
        var lab = inp.closest('.opt');
        lab.classList.remove('sel', 'ok', 'no', 'miss');
        if (isKey && isChosen) lab.classList.add('ok');
        else if (!isKey && isChosen) lab.classList.add('no');
        else if (isKey) lab.classList.add('miss');
      });
      if (!ok) info.verdict.textContent = info.type === 'multi' ? 'Not quite. Dashed green marks the correct options you missed.' : 'Not quite. The correct option is outlined in dashed green.';
    } else if (info.type === 'num' && !ok) {
      var yv = parseNum(ans);
      info.verdict.textContent = 'Not quite. The answer is ' + fmtKey(info) + (isNaN(yv) || ans === '' ? '.' : ' (yours works out to ' + String(Number(yv.toFixed(4))) + ').');
    }
    var rr = state[info.sec] && state[info.sec].checks[info.id];
    if (rr && rr.gaveUp && !ok) info.verdict.textContent = 'Solved for you, counted as wrong. ' + (info.type === 'num' ? 'The answer is ' + fmtKey(info) + '.' : info.type === 'multi' ? 'Dashed green marks the correct options.' : 'The correct option is outlined in dashed green.');
    var wb = info.el.querySelector('.walkbox'); if (wb && wb.dataset.has) { wb.hidden = false; var wk = info.el.querySelector('button.walk'); if (wk) wk.hidden = true; }
    var gave = !!(rr && rr.gaveUp && !ok);
    if (info.expl) info.expl.hidden = gave;
    if (info.sol && gave) info.sol.hidden = true;
    if (info.sol && !gave) { info.sol.hidden = false; if (window.sgMathReady && window.MathJax && MathJax.typesetPromise && !info.sol.querySelector('mjx-container') && /\\\(|\\\[/.test(info.sol.textContent)) MathJax.typesetPromise([info.sol]).catch(function () { }); }
    info.showBtn.hidden = true;
  }

  /* called by ask.js when the reader presses "Solve it for me" */
  window.sgGiveUp = function (id) {
    var info = checkIndex[id]; if (!info) return;
    var st = state[info.sec], rec = st.checks[id], now = new Date().toISOString();
    if (info.exam && !info.locked) return;
    var wr = info.type === 'written';
    if (!rec) {
      rec = st.checks[id] = { tries: 1, first: '', firstCorrect: false, firstAt: now, last: '', lastCorrect: false, at: now, gaveUp: true, shown: true };
      if (wr) { rec.mark = 'none'; rec.firstMark = 'none'; }
      show(info, '', false, rec);
    } else if (!info.locked) {
      rec.tries = (rec.tries || 0) + 1; rec.last = ''; rec.lastCorrect = false; rec.at = now; rec.gaveUp = true; rec.shown = true;
      if (wr) rec.mark = 'none';
      show(info, '', false, rec);
    } else if (wr) { rec.shown = true; show(info, rec.last || '', false, rec); } /* already compared: the student's own mark stands */
    else { rec.shown = true; applyReveal(info); }
    if (wr && !info.exam) { delete wdraft[id]; saveWDraft(); }
    st.updatedAt = now; persist(info.sec); refreshAll();
  };

  function reveal(info) {
    var st = state[info.sec], rec = st.checks[info.id];
    if (!rec) return;
    rec.shown = true; st.updatedAt = new Date().toISOString();
    applyReveal(info);
    persist(info.sec);
  }

  function reset(info) {
    info.locked = false; info.el.classList.remove('locked'); delete info.el.dataset.res;
    if (info.list) {
      Array.prototype.forEach.call(info.list.querySelectorAll('input'), function (inp) {
        inp.checked = false; inp.disabled = false;
        inp.closest('.opt').classList.remove('sel', 'ok', 'no', 'miss');
      });
    }
    if (info.type === 'written') { info.input.readOnly = false; info.input.value = ''; if (info.input.style.height) info.input.style.height = ''; if (info.markEl) info.markEl.hidden = true; if (!info.exam) info.input.focus(); }
    else if (info.input) { info.input.disabled = false; info.input.value = ''; if (!info.exam) info.input.focus(); }
    if (info.expl) info.expl.hidden = true;
    if (info.sol) info.sol.hidden = true;
    info.showBtn.hidden = true;
    var wbx = info.el.querySelector('.walkbox'); if (wbx && !wbx.classList.contains('busy')) wbx.hidden = true;
    var wkb = info.el.querySelector('button.walk'); if (wkb && !wkb.dataset.off) wkb.hidden = !!info.exam;
    var rs = state[info.sec] && state[info.sec].checks[info.id];
    if (rs && rs.shown) { rs.shown = false; persist(info.sec); }
    info.fb.hidden = true; info.btn.hidden = !!info.exam; info.retry.hidden = true;
    if (info.type === 'written') writtenChanged(info);
  }

  /* ---------- practice exam: answer everything, then submit once ---------- */
  var EX = examEl ? SEC[examEl.id] : null;
  var exBar = null, exSubmit = null, exResult = null, exTimer = 0;
  function exState() { return EX ? state[EX.id] : null; }
  function exMinutes() { return parseFloat(CFG.practice_minutes || 0) || 0; } /* the practice exam's time target, from guide.config.json practice_minutes */
  function fmtTime(sec) { sec = Math.max(0, Math.round(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function elapsed() { var x = exState(); if (!x || !x.startedAt) return 0; var end = x.submittedAt ? new Date(x.submittedAt) : new Date(); return (end - new Date(x.startedAt)) / 1000; }
  function examStart() { var x = exState(); if (!x.startedAt) { x.startedAt = new Date().toISOString(); x.updatedAt = x.startedAt; persist(EX.id); } paintExam(); }
  function examDraft(info) {
    var x = exState(); if (!x || x.submittedAt) return;
    var a = readAnswer(info);
    if (a === null) delete x.draft[info.id]; else x.draft[info.id] = a;
    if (!x.startedAt) x.startedAt = new Date().toISOString();
    x.updatedAt = new Date().toISOString();
    persist(EX.id); paintExam();
    if (!unitEls.length) refreshAll();
  }
  /* score in points (data-points, default 1); written items count full 1, partly 0.5, missed 0, unmarked 0 for now.
     The breakdown groups by data-from (a unit) when present, otherwise by data-topic, weakest first. */
  function examScore() {
    var ids = secChecks[EX.id], x = exState(), right = 0, total = 0, pending = 0, by = {}, order = [], anyPts = false;
    ids.forEach(function (id) {
      var info = checkIndex[id], r = x.checks[id], credit = 0, pend = false, el = info.el;
      if (info.hasPoints) anyPts = true;
      if (info.type === 'written') { if (r && r.mark) credit = CREDIT[r.mark] || 0; else if (r) pend = true; }
      else credit = r && r.firstCorrect ? 1 : 0;
      right += info.points * credit; total += info.points; if (pend) pending++;
      var from = el.dataset.from && SEC[el.dataset.from] && !SEC[el.dataset.from].exam ? el.dataset.from : '';
      var key = from ? 'u:' + from : (el.dataset.topic ? 't:' + el.dataset.topic : '');
      if (!key) return;
      if (!by[key]) { by[key] = { label: from ? unitName(from) + ': ' + SEC[from].title : el.dataset.topic, got: 0, of: 0, pending: 0, i: order.length }; order.push(key); }
      by[key].got += info.points * credit; by[key].of += info.points; if (pend) by[key].pending++;
    });
    var rows = order.map(function (k) { return by[k]; }).sort(function (a, b) { return (a.got / a.of - b.got / b.of) || (a.i - b.i); });
    return { right: Math.round(right * 100) / 100, total: Math.round(total * 100) / 100, pending: pending, by: by, rows: rows, points: anyPts };
  }
  function submitExam() {
    var x = exState(), now = new Date().toISOString();
    if (!x.startedAt) x.startedAt = now;
    x.submittedAt = now;
    secChecks[EX.id].forEach(function (id) {
      var info = checkIndex[id], ans = readAnswer(info), ok = ans === null ? false : isCorrect(info, ans);
      if (ok === null) ok = false;
      var rec = x.checks[id] = { tries: 1, first: ans || '', firstCorrect: !!ok, firstAt: now, last: ans || '', lastCorrect: !!ok, at: now };
      if (info.type === 'written' && ans === null) { rec.mark = 'none'; rec.firstMark = 'none'; }
      show(info, ans || '', !!ok, rec);
    });
    x.seconds = elapsed();
    var sc = examScore();
    x.history = (x.history || []).concat([{ right: sc.right, total: sc.total, pending: sc.pending, seconds: x.seconds, at: now }]);
    x.draft = {}; x.updatedAt = now;
    persist(EX.id); refreshAll(); paintExam();
    if (exResult) exResult.scrollIntoView({ block: 'nearest' });
  }
  function retakeExam() {
    var x = exState();
    secChecks[EX.id].forEach(function (id) { reset(checkIndex[id]); });
    x.checks = {}; x.startedAt = null; x.submittedAt = null; x.seconds = null; x.draft = {}; x.updatedAt = new Date().toISOString();
    persist(EX.id); refreshAll(); paintExam();
    examEl.scrollIntoView();
  }
  function paintExam() {
    if (!EX) return;
    var x = exState(), mins = exMinutes(), el = elapsed(), done = !!x.submittedAt;
    var answered = done ? secChecks[EX.id].length : Object.keys(x.draft || {}).length;
    if (exBar) {
      var t = !x.startedAt ? 'Not started' : (done ? 'Time taken ' : 'Elapsed ') + fmtTime(el) + (mins ? ' of ' + fmtTime(mins * 60) : '');
      var over = mins && el > mins * 60 && !done;
      exBar.innerHTML = '<span class="ex-time' + (over ? ' over' : '') + '">' + esc(t) + (over ? ' \u00b7 time is up' : '') + '</span>' +
        '<span class="ex-count">' + (done ? 'Submitted' : answered + ' of ' + secChecks[EX.id].length + ' answered') + '</span>' +
        (!x.startedAt && !done ? '<button type="button" class="primary ex-start">Start the timer</button>' : '');
      var sb = exBar.querySelector('.ex-start'); if (sb) sb.addEventListener('click', examStart);
    }
    if (exSubmit) {
      if (done) {
        var sc = examScore(), pct = sc.total ? Math.round(100 * sc.right / sc.total) : 0;
        var hasW = secChecks[EX.id].some(function (id) { return checkIndex[id].type === 'written'; });
        var rows = sc.rows.map(function (r) { return '<tr><td>' + esc(r.label) + '</td><td class="num">' + fmtN(r.got) + ' / ' + fmtN(r.of) + (r.pending ? ' (' + r.pending + ' to mark)' : '') + '</td></tr>'; }).join('');
        exSubmit.innerHTML = '<div class="ex-result" data-sg="exam-result"><p class="ex-score">Score: ' + fmtN(sc.right) + ' / ' + fmtN(sc.total) +
          (sc.pending ? ' so far; ' + sc.pending + ' written answer' + (sc.pending === 1 ? '' : 's') + ' still to mark yourself' : ' (' + pct + '%)') + '</p>' +
          '<p class="src">Time taken ' + fmtTime(x.seconds || el) + (mins ? ' of ' + mins + ' minutes' : '') + '. Each question now shows whether you got it right.' +
          (hasW ? ' Written answers show a model answer and a rubric: mark each one yourself (full marks count 1, partly 0.5, missed 0) and the score updates.' : '') +
          ' Use Show answer or Solve it for me on any question to review it.</p>' +
          (rows ? '<div class="tbl"><table><thead><tr><th>Where the questions came from, weakest first</th><th>' + (sc.points ? 'Points' : 'Right') + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '') +
          '<div class="actions"><button type="button" class="ex-retake">Retake the exam</button></div></div>';
        exSubmit.querySelector('.ex-retake').addEventListener('click', function () {
          var a = exSubmit.querySelector('.actions');
          a.innerHTML = '<span class="qc-sure">Clear all answers and start over?</span><button type="button" class="primary ex-yes">Retake</button><button type="button" class="ex-no">Cancel</button>';
          a.querySelector('.ex-yes').addEventListener('click', retakeExam);
          a.querySelector('.ex-no').addEventListener('click', paintExam);
        });
        exResult = exSubmit.querySelector('.ex-result');
      } else {
        var left = secChecks[EX.id].length - answered;
        exSubmit.innerHTML = '<div class="actions"><button type="button" class="primary ex-submit">Submit exam</button><span class="src">' + (left ? left + ' unanswered' : 'All questions answered') + '</span></div>';
        exSubmit.querySelector('.ex-submit').addEventListener('click', function () {
          if (!left) { submitExam(); return; }
          var a = exSubmit.querySelector('.actions');
          a.innerHTML = '<span class="qc-sure">' + left + ' question' + (left === 1 ? ' is' : 's are') + ' unanswered and will count as wrong. Submit anyway?</span><button type="button" class="primary ex-yes">Submit</button><button type="button" class="ex-no">Keep working</button>';
          a.querySelector('.ex-yes').addEventListener('click', submitExam);
          a.querySelector('.ex-no').addEventListener('click', paintExam);
        });
        exResult = null;
      }
    }
    clearInterval(exTimer);
    if (x.startedAt && !done) exTimer = setInterval(function () { if (!examEl.hidden && exBar) { var tt = exBar.querySelector('.ex-time'); var e2 = elapsed(), over2 = mins && e2 > mins * 60; if (tt) { tt.textContent = 'Elapsed ' + fmtTime(e2) + (mins ? ' of ' + fmtTime(mins * 60) : '') + (over2 ? ' \u00b7 time is up' : ''); tt.classList.toggle('over', !!over2); } } }, 1000);
  }
  function applyDraft() {
    var x = exState(); if (!x || x.submittedAt) return;
    Object.keys(x.draft || {}).forEach(function (id) {
      var info = checkIndex[id], v = x.draft[id]; if (!info) return;
      if (info.list) { var vals = String(v).split(','); Array.prototype.forEach.call(info.list.querySelectorAll('input'), function (inp) { inp.checked = vals.indexOf(inp.value) >= 0; }); markSel(info); }
      else if (info.input) { info.input.value = v; if (info.type === 'written') grow(info.input); }
    });
  }
  if (EX) {
    exBar = examEl.querySelector('[data-sg="exam-bar"]');
    exSubmit = examEl.querySelector('[data-sg="exam-submit"]');
    if (!exBar) { exBar = document.createElement('div'); exBar.className = 'exam-bar'; var hd = examEl.querySelector('[data-sg="exam-head"]'); examEl.insertBefore(exBar, hd ? hd.nextSibling : examEl.firstChild); }
    if (!exSubmit) { exSubmit = document.createElement('div'); exSubmit.className = 'exam-submit'; (examEl.querySelector('[data-sg="exam-body"]') || examEl).appendChild(exSubmit); }
    window.sgExam = { submit: submitExam, retake: retakeExam, state: function () { return clone(exState()); }, score: examScore, start: examStart };
  }

  /* ---------- confidence ---------- */
  function buildConf(conf, sec) {
    var seg = document.createElement('div'); seg.className = 'seg';
    seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Confidence for ' + unitName(sec));
    [['shaky', 'Shaky'], ['ok', 'OK'], ['solid', 'Solid']].forEach(function (p) {
      var b = document.createElement('button'); b.type = 'button'; b.dataset.v = p[0]; b.textContent = p[1];
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        var st = state[sec];
        st.confidence = st.confidence === p[0] ? null : p[0];
        st.updatedAt = new Date().toISOString();
        paintConf(sec); persist(sec); refreshAll();
      });
      seg.appendChild(b);
    });
    conf.appendChild(seg);
  }
  function paintConf(sec) {
    var conf = document.querySelector('.conf[data-sec="' + sec + '"]');
    if (!conf) return;
    Array.prototype.forEach.call(conf.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.v === state[sec].confidence));
    });
  }

  /* ---------- progress, contents, summary ---------- */
  var CONF_LABEL = { shaky: 'Shaky', ok: 'OK', solid: 'Solid' };
  function refreshAll() {
    var total = 0, answered = 0, right = 0, wrong = 0, exOnly = false;
    var body = document.getElementById('sum-body');
    var html = '';
    SECS.forEach(function (s) {
      var ids = secChecks[s.id];
      var st = document.querySelector('.toc a[data-unit="' + s.id + '"] .st');
      if (s.exam) {
        var x = state[s.id], hist = x.history || [], last = hist[hist.length - 1];
        if (st) st.textContent = last ? fmtN(last.right) + '/' + fmtN(last.total) : (x.startedAt ? 'in progress' : 'not taken');
        var exl = document.getElementById('sum-exam');
        if (exl) {
          if (!hist.length) exl.textContent = 'Practice exam: not taken yet' + (x.startedAt ? ' (in progress).' : '.');
          else { var best = hist.reduce(function (a, h) { return h.right / h.total > a.right / a.total ? h : a; }, hist[0]); exl.textContent = 'Practice exam: last score ' + fmtN(last.right) + ' / ' + fmtN(last.total) + (last.pending ? ' (' + last.pending + ' written answer' + (last.pending === 1 ? '' : 's') + ' still to mark)' : '') + ', best ' + fmtN(best.right) + ' / ' + fmtN(best.total) + ', ' + hist.length + ' attempt' + (hist.length === 1 ? '' : 's') + '.'; }
        }
        if (!unitEls.length) { /* exam-only guide: the header meter follows the exam */
          var n0 = ids.length, ans0 = x.submittedAt ? n0 : Object.keys(x.draft || {}).length;
          var mA = document.getElementById('m-ans'), mF = document.getElementById('m-first'), bG = document.getElementById('bar-good'), bB = document.getElementById('bar-bad');
          if (mA) mA.textContent = (x.submittedAt ? 'Submitted' : ans0 + ' of ' + n0 + ' answered');
          if (mF) mF.textContent = last ? 'Last score ' + fmtN(last.right) + ' / ' + fmtN(last.total) : 'Not taken yet';
          if (bG) bG.style.width = (last && last.total ? 100 * last.right / last.total : 0) + '%';
          if (bB) bB.style.width = (last && last.total ? 100 * (last.total - last.right) / last.total : 0) + '%';
          exOnly = true;
        }
        return;
      }
      var recs = ids.map(function (id) { return state[s.id].checks[id]; }).filter(Boolean);
      var a = recs.length, r = recs.filter(function (x) { return x.firstCorrect; }).length;
      total += ids.length; answered += a; right += r; wrong += a - r;
      var c = state[s.id].confidence || '';
      if (st) st.innerHTML = '<span class="dot" data-c="' + c + '"></span>' + a + '/' + ids.length;
      html += '<tr><td><a href="#' + s.id + '">' + esc(unitName(s)) + ' \u00b7 ' + esc(s.title) + '</a></td>' +
        '<td><span class="chip" data-c="' + c + '">' + (c ? CONF_LABEL[c] : 'Not rated') + '</span></td>' +
        '<td class="num">' + a + ' / ' + ids.length + '</td>' +
        '<td class="num">' + (a ? r + ' / ' + a : '\u2013') + '</td></tr>';
      var meta = s.el.querySelector('.questions-meta'); if (meta) meta.textContent = a + ' of ' + ids.length + ' answered' + (a ? ', ' + r + ' right first try' : '');
    });
    if (body) body.innerHTML = html;
    if (exOnly) return;
    var ma = document.getElementById('m-ans'), mf = document.getElementById('m-first');
    if (ma) ma.textContent = answered + ' of ' + total + ' questions answered';
    if (mf) mf.textContent = right + ' right on first try';
    var bg = document.getElementById('bar-good'), bb = document.getElementById('bar-bad');
    if (bg) bg.style.width = (total ? 100 * right / total : 0) + '%';
    if (bb) bb.style.width = (total ? 100 * wrong / total : 0) + '%';
  }

  /* ---------- persistence ---------- */
  var db = null, dbPhase = 'connecting', readOnly = false, lastError = null;
  var writers = {}, beforeDb = {};

  function saveLocal() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { } }
  function loadLocal() { try { var raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }

  function persist(sec) {
    saveLocal();
    if (!db) { if (dbPhase === 'connecting') beforeDb[sec] = true; setPill(); return; }
    if (readOnly) { setPill(); return; }
    var w = writers[sec] || (writers[sec] = { inflight: false, dirty: false, timer: 0 });
    w.dirty = true;
    clearTimeout(w.timer);
    w.timer = setTimeout(function () { flush(sec); }, 400);
    setPill();
  }

  function flush(sec) {
    var w = writers[sec];
    if (!w || w.inflight || !w.dirty || readOnly) return;
    w.dirty = false; w.inflight = true;
    setPill();
    db.doc('progress/' + sec).set(clone(state[sec])).then(function () {
      lastError = null;
    }, function (e) {
      lastError = (e && e.code) || 'error';
      if (lastError === 'invalid_argument' || lastError === 'revoked' || lastError === 'not_granted') { readOnly = true; }
      else { w.dirty = true; setTimeout(function () { flush(sec); }, 4000); }
    }).then(function () {
      w.inflight = false;
      if (w.dirty && !lastError) flush(sec);
      setPill();
    });
  }

  function setPill() {
    var el = document.getElementById('save');
    if (!el) return;
    var pending = Object.keys(writers).some(function (k) { return writers[k].inflight || writers[k].dirty; });
    var s = 'idle', t;
    if (!db) t = dbPhase === 'connecting' ? 'Connecting\u2026' : 'Saved in this browser only';
    else if (readOnly) { s = 'error'; t = 'View only: not saving'; }
    else if (lastError) { s = 'error'; t = 'Not saved yet, retrying'; }
    else if (pending) { s = 'saving'; t = 'Saving\u2026'; }
    else { s = 'saved'; t = 'All changes saved'; }
    el.dataset.s = s; el.textContent = t;
  }

  function applySaved(saved) {
    if (!saved) return;
    Object.keys(saved).forEach(function (sec) {
      if (!state[sec]) return;
      var src = saved[sec] || {}, st = state[sec];
      if (SEC[sec].exam) {
        if (st.startedAt || st.submittedAt || Object.keys(st.checks).length || Object.keys(st.draft || {}).length) return;
        st.startedAt = src.startedAt || null; st.submittedAt = src.submittedAt || null; st.seconds = src.seconds || null;
        st.history = src.history || []; st.draft = src.draft || {}; st.updatedAt = src.updatedAt || null;
        if (st.submittedAt) {
          Object.keys(src.checks || {}).forEach(function (id) {
            if (!checkIndex[id]) return;
            var rec = st.checks[id] = clone(src.checks[id]);
            show(checkIndex[id], rec.last || '', !!rec.firstCorrect, rec);
          });
        } else applyDraft();
        paintExam();
        return;
      }
      if (st.confidence == null && src.confidence) st.confidence = src.confidence;
      var checks = src.checks || {};
      Object.keys(checks).forEach(function (id) {
        if (st.checks[id] || !checkIndex[id]) return;
        var rec = st.checks[id] = clone(checks[id]);
        if (rec.last !== undefined) {
          var ok = isCorrect(checkIndex[id], rec.last);
          show(checkIndex[id], rec.last, !!ok, rec);
        }
      });
      if (src.updatedAt && !st.updatedAt) st.updatedAt = src.updatedAt;
      paintConf(sec);
    });
  }

  refreshAll();
  setPill();
  paintExam();

  (function connect() {
    var p = null;
    try { if (window.claude && typeof window.claude.use === 'function') p = window.claude.use('db'); } catch (e) { p = null; }
    Promise.resolve(p).then(function (ns) {
      if (!ns) {
        dbPhase = 'none';
        applySaved(loadLocal());
        refreshAll(); setPill();
        return;
      }
      db = ns; dbPhase = 'ready';
      return db.collection('progress').get().then(function (snap) {
        var saved = {};
        snap.docs.forEach(function (d) { if (d.exists) saved[d.id] = d.data(); });
        applySaved(saved);
      }, function (e) {
        lastError = (e && e.code) || 'error';
      }).then(function () {
        Object.keys(beforeDb).forEach(function (sec) { persist(sec); });
        beforeDb = {};
        refreshAll(); setPill();
      });
    }, function () {
      dbPhase = 'none';
      applySaved(loadLocal());
      refreshAll(); setPill();
    });
  })();

  /* ---------- active section in the contents ---------- */
  var links = {};
  Array.prototype.forEach.call(document.querySelectorAll('.toc a[data-target]'), function (a) { links[a.dataset.target] = a; });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].classList.remove('active'); });
        var a = links[e.target.id];
        if (a) a.classList.add('active');
      });
    }, { rootMargin: '-25% 0px -65% 0px' });
    Array.prototype.forEach.call(document.querySelectorAll('main [data-sg="section"][id], main > section[id], main details[data-sg="questions"][id]'), function (s) { io.observe(s); });
  }
})();
