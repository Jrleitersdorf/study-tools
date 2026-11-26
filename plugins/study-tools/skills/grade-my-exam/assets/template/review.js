/* review.js  (ENGINE FILE: inlined by build_review.py; do not edit per review)
   Renders the exam review page from the JSON in <script id="review-data"> (fields: review.html).
   Views: "Your answers" (score summary, filter chips, Wrong-first sort, one card per question with
   a walkthrough for every miss) and "Lessons" (ordered lessons, then the habits list). The hash
   selects the view: #answers, #lessons, #q-<id> (a question card), #lesson-<id> (a lesson).
   Ask: a floating button follows the card or lesson on screen, or takes a typed target ("7", "L3").
   Questions are saved under that item, answered with claude.use('sample'), and take follow-ups.
   Storage: db collection "questions" when the page has the db capability, otherwise localStorage
   (<storage_key>-asks). Without the sample capability Ask only saves.
   Gotchas: sample() messages must alternate user/assistant and end on a user turn; math is typeset
   only once its view is visible (MathJax measures the page); every localStorage call is guarded. */
(function () {
  'use strict';
  var D;
  try { D = JSON.parse(document.getElementById('review-data').textContent); } catch (e) {
    document.getElementById('app').innerHTML = '<p class="empty">This page has no readable review data. Rebuild it with build_review.py.</p>';
    return;
  }
  var M = D.meta || {}, S = D.summary || {}, KEY = M.storage_key || 'exam-review';
  var QS = D.questions || [], LS = D.lessons || [];
  var QBY = {}, LBY = {}, UNIT = {}, HAB = {}, HAB_LESSON = {};
  QS.forEach(function (q) { QBY[String(q.id).toLowerCase()] = q; });
  LS.forEach(function (l, i) { l._n = i + 1; LBY[String(l.id).toLowerCase()] = l; (l.habits || []).forEach(function (h) { if (!HAB_LESSON[h]) HAB_LESSON[h] = l; }); });
  (D.units || []).forEach(function (u) { UNIT[u.id] = u; });
  (D.habits || []).forEach(function (h) { HAB[h.id] = h; });
  var CH1 = String.fromCharCode(1), CH2 = String.fromCharCode(2);
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function store(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(KEY + '-' + k) || 'null');
      localStorage.setItem(KEY + '-' + k, JSON.stringify(v));
    } catch (e) { }
    return null;
  }
  function fmt(n) { return String(Math.round(n * 100) / 100); }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : b); }
  function dateText(iso) {
    if (!iso) return '';
    try { var d = new Date(iso + 'T12:00:00'); if (isNaN(d)) return iso; return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return iso; }
  }

  /* ---------- rich text: paragraphs, lists, bold, italic, code, math ---------- */
  function rtInner(s) {
    if (s == null || s === '') return '';
    var stash = [];
    function keep(h) { stash.push(h); return CH1 + (stash.length - 1) + CH2; }
    s = String(s).replace(/\r\n?/g, '\n');
    s = s.replace(/```([\w+#.-]*)[ \t]*\n([\s\S]*?)\n?```/g, function (m, lang, code) {
      return '\n\n' + keep('<pre class="code"' + (lang ? ' data-lang="' + esc(lang) + '"' : '') + '><code>' + esc(code) + '</code></pre>') + '\n\n';
    });
    s = s.replace(/`([^`\n]+)`/g, function (m, c) { return keep('<code>' + esc(c) + '</code>'); });
    s = s.replace(/\\\[([\s\S]+?)\\\]/g, function (m) { return keep('<span class="mathwrap" style="display:block">' + esc(m) + '</span>'); });
    s = s.replace(/\\\(([\s\S]+?)\\\)/g, function (m) { return keep(esc(m)); });
    function inline(t) {
      return esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<i>$2</i>');
    }
    var out = [];
    s.split(/\n\s*\n/).forEach(function (block) {
      var lines = block.split('\n').filter(function (l) { return l.trim() !== ''; });
      if (!lines.length) return;
      if (lines.length === 1 && new RegExp('^' + CH1 + '\\d+' + CH2 + '$').test(lines[0].trim()) && /^<pre/.test(stash[+lines[0].trim().slice(1, -1)])) { out.push(lines[0].trim()); return; }
      var para = [], list = null, tag = 'ul';
      function flushP() { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } }
      function flushL() { if (list) { out.push('<' + tag + '>' + list.map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</' + tag + '>'); list = null; } }
      lines.forEach(function (l) {
        var m = /^\s*([-*]|\d+[.)])\s+(.*)$/.exec(l);
        if (m) { var t = /\d/.test(m[1]) ? 'ol' : 'ul'; flushP(); if (list && t !== tag) flushL(); if (!list) { list = []; tag = t; } list.push(m[2]); return; }
        if (list && /^\s{2,}\S/.test(l)) { list[list.length - 1] += ' ' + l.trim(); return; }
        flushL(); para.push(l.trim());
      });
      flushP(); flushL();
    });
    var html = out.join('');
    var re = new RegExp(CH1 + '(\\d+)' + CH2, 'g');
    for (var i = 0; i < 3 && re.test(html); i++) { re.lastIndex = 0; html = html.replace(re, function (m, n) { return stash[+n]; }); }
    return html;
  }
  function rt(s, cls) { var h = rtInner(s); return h ? '<div class="rt' + (cls ? ' ' + cls : '') + '">' + h + '</div>' : ''; }
  function rtLine(s) { return rtInner(s).replace(/^<p>([\s\S]*)<\/p>$/, '$1'); }
  function img(o) {
    if (!o || !o.src) return '';
    return '<figure class="fig"><img src="' + esc(o.src) + '" alt="' + esc(o.alt || '') + '"' + (o.width ? ' width="' + o.width + '" height="' + o.height + '"' : '') + '>' +
      (o.caption ? '<figcaption>' + rtLine(o.caption) + '</figcaption>' : '') + '</figure>';
  }
  function code(o) { return o && o.code != null ? '<pre class="code"' + (o.lang ? ' data-lang="' + esc(o.lang) + '"' : '') + '><code>' + esc(o.code) + '</code></pre>' : ''; }

  /* ---------- small helpers about questions ---------- */
  var VLABEL = { right: 'Right', partial: 'Partly right', wrong: 'Wrong', blank: 'Blank' };
  var TLABEL = { mc: 'Multiple choice', multi: 'Select all that apply', tf: 'True or false', num: 'Numeric', written: 'Written' };
  function isEst(q) { return q.earned !== null && typeof q.earned === 'object'; }
  function likely(q) { return isEst(q) ? q.earned.likely : q.earned; }
  function earnedText(q) {
    if (!isEst(q)) return fmt(q.earned) + ' of ' + fmt(q.points);
    var e = q.earned;
    return 'about ' + fmt(e.likely) + ' of ' + fmt(q.points) + (e.low !== e.high ? ', ' + fmt(e.low) + ' to ' + fmt(e.high) : '');
  }
  function conf(q) { return q.confidence || 'solid'; }
  function units(q) { return [].concat(q.unit || []).map(function (u) { return UNIT[u] ? UNIT[u].name : u; }); }
  function opts(q) { return q.type === 'tf' ? [{ key: 'T', text: 'True' }, { key: 'F', text: 'False' }] : (q.options || []); }
  function picks(o) { return o && o.choice != null ? [].concat(o.choice).map(String) : []; }
  function optLabel(q, k) { var o = opts(q).filter(function (x) { return x.key === k; })[0]; return q.type === 'tf' ? (o ? o.text : k) : k; }
  function qName(q) { return 'Q' + q.id; }
  function lName(l) { return 'Lesson ' + l._n; }

  /* ---------- top bar ---------- */
  $('#top-title').textContent = M.title || M.exam || 'Exam review';
  $('#top-sub').textContent = [M.course, dateText(M.taken)].filter(Boolean).join(' · ');
  $('#n-answers').textContent = QS.length;
  $('#n-lessons').textContent = LS.length;

  /* ---------- summary (shown above Your answers) ---------- */
  function fmt1(n) { return String(Math.round(n * 10) / 10); }
  function renderSummary() {
    var c = S.counts || {}, est = !!S.estimated, graded = M.kind === 'graded';
    var kick = (graded ? 'Graded exam review' : 'Practice exam review') + (M.taken ? ' · taken ' + dateText(M.taken) : '');
    var h = '<div class="sum-head"><p class="kicker">' + esc(kick) + '</p>' +
      '<h1>' + esc(M.exam || M.title) + '</h1>' +
      (M.intro ? rt(M.intro, 'sub') : '<p class="sub">' + (graded ? 'Your graded exam, marked by the instructor. Each question below shows your answer, the correct one and what to take from it.' : 'Your attempt, graded question by question. Start with the patterns, then work through the lessons.') + '</p>') + '</div>';
    var lo = S.pct_low, hi = S.pct_high, mid = S.pct_likely;
    h += '<div class="scorebox"><div class="score">' +
      '<p class="lbl">' + (est ? 'Estimated score' : graded ? 'Score from the instructor' : 'Score') + '</p>' +
      '<div class="big"><span class="num">' + (est ? '<small class="about">about </small>' : '') + mid + '<small>%</small></span>' +
      (est ? '<span class="rng">likely ' + lo + ' to ' + hi + '%</span>' : '') + '</div>' +
      '<div class="rbar" aria-hidden="true"><span class="band" style="left:' + lo + '%;width:' + Math.max(hi - lo, 0.8) + '%"></span><span class="pin" style="left:' + mid + '%"></span>' +
      '<span class="tick" style="left:0">0</span><span class="tick" style="left:50%">50</span><span class="tick" style="left:100%">100</span></div>' +
      '<p class="pts">' + (est ? 'about ' + fmt(S.likely) + ' of ' + fmt(S.points_total) + ' points, ' + fmt(S.low) + ' to ' + fmt(S.high) : fmt(S.likely) + ' of ' + fmt(S.points_total) + ' points') + '</p></div>' +
      '<ul class="tally">' +
      '<li class="good"><b>' + (c.right || 0) + '</b><span>right</span></li>' +
      '<li class="part"><b>' + (c.partial || 0) + '</b><span>partly right</span></li>' +
      '<li class="bad"><b>' + ((c.wrong || 0) + (c.blank || 0)) + '</b><span>wrong' + (c.blank ? ' (' + c.blank + ' blank)' : '') + '</span></li>' +
      '<li class="uns"><b>' + (c.unsure || 0) + '</b><span>unsure or guessed</span></li>' +
      (M.time && M.time.used_min ? '<li class="wide"><b>' + fmt(M.time.used_min) + ' min</b><span>' + (M.time.limit_min ? 'of ' + fmt(M.time.limit_min) + ' allowed' : 'used') + '</span></li>' : '') +
      '</ul></div>';
    if ((c.guessed_right || []).length) {
      var g = c.guessed_right;
      h += '<p class="note warn"><b>' + (g.length === 1 ? 'One right answer was' : g.length + ' right answers were') + ' a guess or unsure</b> (' + g.map(function (i) { return '<a href="#q-' + esc(i) + '">Q' + esc(i) + '</a>'; }).join(', ') + '). Count ' + (g.length === 1 ? 'it' : 'them') + ' as a weak spot, not as points you can rely on.</p>';
    }
    var ub = (S.units || []).map(function (u) {
      var r = u.possible ? u.earned / u.possible : 0;
      return '<li><div class="row"><span>' + esc(u.name) + '</span><span>' + fmt1(u.earned) + ' of ' + fmt1(u.possible) + ' pts</span></div><div class="bar"><i class="' + (r >= 0.8 ? '' : r >= 0.5 ? 'mid' : 'low') + '" style="width:' + Math.round(r * 100) + '%"></i></div></li>';
    }).join('');
    var hb = (S.habits || []).filter(function (x) { return x.questions.length; }).map(function (x) {
      var l = LBY[String(x.lesson || '').toLowerCase()];
      return '<li><a href="' + (l ? '#lesson-' + esc(l.id) : '#answers') + '"><span class="h">' + esc(x.name) + '</span><span class="m">' + x.questions.map(function (i) { return 'Q' + esc(i); }).join(', ') + (x.lost ? ' · −' + fmt1(x.lost) + ' pts' : '') + (l ? ' · L' + l._n : '') + '</span></a></li>';
    }).join('');
    h += '<div class="gaps">' +
      '<div class="panel"><h2>Patterns in your misses</h2>' + (hb ? '<ul class="habits">' + hb + '</ul><p class="th-note">Each pattern links to the lesson that fixes it.</p>' : '<p class="th-note">No pattern repeats. Every miss is covered in its walkthrough.</p>') + '</div>' +
      '<div class="panel"><h2>Where the points went</h2>' + (ub ? '<ul class="ubars">' + ub + '</ul>' : '<p class="th-note">No units listed.</p>') + '</div></div>';
    var how = [];
    if (M.key_source) how.push('<li>Correct answers: ' + esc(M.key_source) + '.</li>');
    if (est) how.push('<li><b>Written answers are estimates</b> (' + (S.estimated_ids || []).map(function (i) { return 'Q' + esc(i); }).join(', ') + '). Language-model grading agrees well with instructors on right versus wrong, but less on exact marks, and it leans lenient. Treat the lower end of the range as the safer number.</li>');
    (M.credit_rules || []).forEach(function (r) { how.push('<li>' + esc(r) + '</li>'); });
    (M.notes || []).forEach(function (n) { how.push('<li>' + rtLine(n) + '</li>'); });
    if (how.length) h += '<div class="panel how"><h2>How this was graded</h2><ul>' + how.join('') + '</ul></div>';
    $('#summary').innerHTML = h;
  }

  /* ---------- answers view ---------- */
  var FILTERS = [
    ['all', 'All', function () { return true; }],
    ['wrong', 'Wrong', function (q) { return q.verdict === 'wrong' || q.verdict === 'blank'; }],
    ['partial', 'Partly', function (q) { return q.verdict === 'partial'; }],
    ['unsure', 'Unsure', function (q) { return conf(q) !== 'solid'; }],
    ['right', 'Right', function (q) { return q.verdict === 'right'; }],
    ['flagged', 'You flagged', function (q) { return !!(q.student_note && String(q.student_note).trim()); }]
  ];
  var PRED = {}; FILTERS.forEach(function (f) { PRED[f[0]] = f[2]; });
  var RANK = { wrong: 0, blank: 0, partial: 1, right: 3 };
  function rank(q) { var r = RANK[q.verdict]; return r === 3 && conf(q) !== 'solid' ? 2 : r; }

  function choiceBlock(q) {
    var you = picks(q.answer), key = picks(q.correct), blank = q.answer && q.answer.blank;
    var h = '<ol class="opts">' + opts(q).map(function (o) {
      var p = you.indexOf(o.key) >= 0, k = key.indexOf(o.key) >= 0;
      var cls = p && k ? 'ok' : p ? 'no' : k ? 'missed' : '';
      var marks = (p ? '<span class="mk you">Your answer</span>' : '') + (k ? '<span class="mk ' + (p ? 'key' : 'miss') + '">Correct</span>' : '');
      return '<li class="opt ' + cls + '"><span class="k">' + (q.type === 'tf' ? '' : esc(o.key)) + '</span><span class="t">' + rtLine(o.text) + '</span><span class="marks">' + marks + '</span></li>';
    }).join('') + '</ol>';
    var line = blank ? 'You left this blank.' : 'You chose <b>' + (you.length ? you.map(function (k) { return esc(optLabel(q, k)); }).join(', ') : 'nothing') + '</b>. Correct: <b>' + key.map(function (k) { return esc(optLabel(q, k)); }).join(', ') + '</b>.';
    if (blank) line += ' Correct: <b>' + key.map(function (k) { return esc(optLabel(q, k)); }).join(', ') + '</b>.';
    h += '<p class="choice-line">' + line + '</p>';
    var at = q.answer && q.answer.text, ct = q.correct && q.correct.text;
    if (at || ct) {
      var word = q.type === 'tf' ? 'justification' : 'reasoning';
      h += '<div class="pair">' +
        '<div class="ans you"><p class="lbl">Your ' + word + '</p>' + (at ? rt(at) : '<p class="th-note">None given.</p>') + '</div>' +
        (ct ? '<div class="ans key"><p class="lbl">Model ' + word + '</p>' + rt(ct) + '</div>' : '') + '</div>';
    }
    return h;
  }
  function answerBox(o, label, cls, isKey) {
    o = o || {};
    var body = '';
    if (o.blank) body = '<p class="th-note">Left blank.</p>';
    if (o.value != null && o.value !== '') body += '<p><b class="mono">' + esc(o.value) + '</b>' + (isKey && o.tolerance ? ' <span class="th-note">(within ' + esc(o.tolerance) + ')</span>' : '') + '</p>';
    body += rt(o.text) + code(o) + img(o.image);
    return '<div class="ans ' + cls + '"><p class="lbl">' + label + '</p>' + (body || '<p class="th-note">None given.</p>') + '</div>';
  }
  function rubricBlock(q) {
    if (!(q.rubric || []).length) return '';
    var est = isEst(q);
    return '<div class="why"><p class="lbl">Rubric' + (est ? ' (Claude’s estimate)' : '') + '</p><div class="rubric-wrap"><table class="rubric"><thead><tr><th>What earns marks</th><th style="text-align:right">Marks</th></tr></thead><tbody>' +
      q.rubric.map(function (r) {
        var got = r.got == null ? null : r.got, cls = got == null ? '' : got >= r.marks ? 'full' : got > 0 ? 'part' : 'none';
        return '<tr><td>' + rtLine(r.point) + (r.comment ? '<span class="c">' + rtLine(r.comment) + '</span>' : '') + '</td><td class="m ' + cls + '">' + (got == null ? '' : fmt(got) + ' of ') + fmt(r.marks) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }
  function walkBlock(q) {
    var w = q.walkthrough;
    if (!w) return '';
    var open = false;
    return '<details class="walk"' + (open ? ' open' : '') + '><summary>Walkthrough: how to get this right</summary><div class="wk">' +
      (w.think ? '<div class="wk-s"><p class="lbl">How to think about it</p>' + rt(w.think) + '</div>' : '') +
      ((w.steps || []).length ? '<div class="wk-s"><p class="lbl">Steps</p><ol class="steps">' + w.steps.map(function (s) { return '<li>' + rtInner(s) + '</li>'; }).join('') + '</ol></div>' : '') +
      (w.answer ? '<div class="wk-s answer"><p class="lbl">Answer</p>' + rt(w.answer) + '</div>' : '') +
      (w.trap ? '<div class="wk-s trap"><p class="lbl">The trap</p>' + rt(w.trap) + '</div>' : '') +
      '</div></details>';
  }
  function card(q) {
    var c = conf(q), est = isEst(q);
    var h = '<article class="qcard" id="q-' + esc(q.id) + '" data-item="q:' + esc(q.id) + '" data-v="' + q.verdict + '" data-conf="' + c + '"' + (q.student_note ? ' data-flag="1"' : '') + '>' +
      '<header class="qc-h"><span class="qn">' + qName(q) + '</span><span class="qt">' + esc(q.format || TLABEL[q.type] || q.type) + ' · ' + plural(q.points, 'pt', 'pts') + '</span><span class="sp"></span>' +
      (c !== 'solid' ? '<span class="badge conf">' + (c === 'guessed' ? 'Guessed' : 'Unsure') + '</span>' : '') +
      (est ? '<span class="badge est">Estimate</span>' : '') +
      '<span class="verdict v-' + q.verdict + '">' + VLABEL[q.verdict] + '<small>' + esc(earnedText(q)) + '</small></span></header>' +
      '<div class="stem">' + rt(q.prompt) + img(q.image) + '</div>';
    if (q.type === 'mc' || q.type === 'multi' || q.type === 'tf') h += choiceBlock(q);
    else h += '<div class="pair' + (q.type === 'written' ? ' one' : '') + '">' + answerBox(q.answer, 'Your answer', 'you') + answerBox(q.correct, q.type === 'written' ? 'Model answer' : 'Correct answer', 'key', true) + '</div>';
    if (q.student_note) h += '<p class="snote"><span class="lbl">Your note</span><span>' + esc(q.student_note) + '</span></p>';
    h += '<div class="why"><p class="lbl">Why</p>' + rt(q.explanation) + '</div>';
    if (q.verdict_reason) h += '<div class="note">' + rtInner(q.verdict_reason) + '</div>';
    h += rubricBlock(q);
    if (q.key_dispute) h += '<div class="dispute"><p class="lbl">Claude disagrees with the key</p>' + rt(q.key_dispute) + '</div>';
    h += walkBlock(q);
    var tags = (q.habits || []).map(function (hid) {
      var hb = HAB[hid], l = HAB_LESSON[hid];
      return hb ? (l ? '<a class="tag" href="#lesson-' + esc(l.id) + '" title="' + esc(lName(l)) + '">' + esc(hb.name) + '</a>' : '<span class="tag">' + esc(hb.name) + '</span>') : '';
    }).join('') + units(q).map(function (u) { return '<span class="tag">' + esc(u) + '</span>'; }).join('');
    h += '<div class="qa" hidden></div><div class="qc-foot"><div class="tags">' + tags + '</div><button type="button" class="linkbtn ask-here">Ask about ' + qName(q) + '</button></div></article>';
    return h;
  }
  function renderAnswers() {
    var counts = {}; FILTERS.forEach(function (f) { counts[f[0]] = QS.filter(f[2]).length; });
    var h = '<div class="view-head"><h2>Your answers</h2><p>Every question with your answer, the correct one and the reasoning. Each miss has a walkthrough.</p></div>' +
      '<div class="toolbar"><div class="chips" role="group" aria-label="Show">' + FILTERS.map(function (f) {
        return '<button type="button" class="chip" data-f="' + f[0] + '" aria-pressed="false"' + (counts[f[0]] || f[0] === 'all' ? '' : ' disabled') + '>' + f[1] + '<span class="n">' + counts[f[0]] + '</span></button>';
      }).join('') + '</div>' +
      '<button type="button" class="sortbtn" aria-pressed="false"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3v10M1.5 10.5 4 13l2.5-2.5M9 4h6M9 8h4M9 12h2"/></svg>Wrong first</button></div>' +
      '<div class="cards">' + QS.map(card).join('') + '</div><p class="empty" hidden>No questions match this filter.</p>';
    $('#view-answers').innerHTML = h;
  }

  /* ---------- lessons view ---------- */
  function renderLessons() {
    var h = '<div class="view-head"><h2>Lessons</h2><p>' + plural(LS.length, 'short lesson', 'short lessons') + ' aimed at the patterns behind your misses, the costliest first. Each has a worked example and the trap to watch for.</p></div><ol class="lessons">' +
      LS.map(function (l) {
        var tags = (l.habits || []).map(function (hid) { return HAB[hid] ? '<span class="tag">' + esc(HAB[hid].name) + '</span>' : ''; }).join('') +
          ((l.questions || []).length ? '<span class="fx">Fixes</span>' + l.questions.map(function (i) { return '<a class="tag" href="#q-' + esc(i) + '">Q' + esc(i) + '</a>'; }).join('') : '');
        var ex = l.example || {};
        return '<li><article class="lesson" id="lesson-' + esc(l.id) + '" data-item="l:' + esc(l.id) + '"><div class="lesson-h"><p class="kicker">' + lName(l) + '</p><h3>' + esc(l.title) + '</h3>' + (tags ? '<div class="for">' + tags + '</div>' : '') + '</div>' +
          '<div class="ls"><h4>The idea</h4>' + rt(l.idea) + '</div>' +
          '<div class="ls"><h4>How to think about this kind of question</h4>' + rt(l.how) + '</div>' +
          (ex.prompt ? '<div class="lex"><h4 class="lbl">Worked example</h4><div class="q">' + rt(ex.prompt) + img(ex.image) + '</div><div class="s">' + rt(ex.solution) + '</div></div>' : '') +
          (l.trap ? '<div class="ltrap"><h4 class="lbl">The trap</h4>' + rt(l.trap) + '</div>' : '') +
          '<div class="qa" hidden></div><div class="qc-foot"><span></span><button type="button" class="linkbtn ask-here">Ask about ' + lName(l) + '</button></div></article></li>';
      }).join('') + '</ol>';
    if ((D.fixes || []).length) h += '<section class="fixes" id="fixes"><h2>Habits that fix most of these</h2><ol>' + D.fixes.map(function (f) { return '<li>' + rtInner(f) + '</li>'; }).join('') + '</ol></section>';
    $('#view-lessons').innerHTML = h;
  }

  /* ---------- math: MathJax 3.2.2 from cdnjs, loaded only when some text has math ----------
     Typesetting waits until the element is visible: MathJax measures the page, and math typeset
     inside display:none comes out with broken sizes. */
  var HAS_MATH = false, pending = [];
  var MJ_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.js';
  var TEX_RE = /\\\(|\\\[/;
  function loadMath() {
    if (HAS_MATH) return;
    HAS_MATH = true;
    if (!window.MathJax) window.MathJax = {
      tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']] },
      svg: { fontCache: 'global' },
      options: { enableMenu: false },
      startup: { typeset: false, ready: function () { MathJax.startup.defaultReady(); MathJax.startup.promise.then(function () { window.rvMathReady = true; pump(); }); } }
    };
    var sc = document.createElement('script'); sc.src = MJ_URL; sc.async = true;
    (document.head || document.body).appendChild(sc);
  }
  function typeset(el) {
    if (!el) return;
    if (!HAS_MATH) { if (!TEX_RE.test(el.textContent)) return; loadMath(); }
    if (!window.rvMathReady || !window.MathJax || !MathJax.typesetPromise || el.closest('[hidden]')) { if (pending.indexOf(el) < 0) pending.push(el); return; }
    MathJax.typesetPromise([el]).then(function () { el.dataset.tex = 'done'; fitMath(el); }).catch(function () { });
  }
  /* an inline formula wider than its column scrolls inside itself instead of widening the page */
  function fitMath(el) {
    $$('mjx-container:not([display="true"])', el).forEach(function (m) {
      var p = m.parentElement; if (!p || !p.clientWidth) return;
      if (m.getBoundingClientRect().width > p.clientWidth + 1) m.classList.add('wide');
    });
  }
  function pump() { var list = pending.splice(0); list.forEach(function (el) { if (el.isConnected) typeset(el); }); }

  /* ---------- views, hash, filter, sort ---------- */
  var ui = store('ui') || {};
  var state = { view: ui.view === 'lessons' ? 'lessons' : 'answers', filter: PRED[ui.filter] ? ui.filter : 'all', sort: ui.sort === 'wrong' ? 'wrong' : 'exam' };
  function saveUi() { store('ui', { view: state.view, filter: state.filter, sort: state.sort }); }
  function show(view) {
    state.view = view;
    $$('.view').forEach(function (s) { s.hidden = s.dataset.view !== view; });
    $('#summary').hidden = view !== 'answers';
    $$('.tabs a').forEach(function (a) { if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    saveUi(); pump(); queueTrack();
  }
  function applyFilter() {
    var p = PRED[state.filter], n = 0;
    $$('#view-answers .qcard').forEach(function (el) { var q = QBY[el.id.slice(2).toLowerCase()]; var on = p(q); el.hidden = !on; if (on) n++; });
    $$('#view-answers .chip').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.f === state.filter)); });
    $('#view-answers .empty').hidden = n > 0;
    saveUi(); pump(); queueTrack();
  }
  function applySort() {
    var box = $('#view-answers .cards'), order = QS.slice();
    if (state.sort === 'wrong') order = order.map(function (q, i) { return { q: q, i: i }; }).sort(function (a, b) { return (rank(a.q) - rank(b.q)) || (a.i - b.i); }).map(function (x) { return x.q; });
    order.forEach(function (q) { box.appendChild(document.getElementById('q-' + q.id)); });
    $('#view-answers .sortbtn').setAttribute('aria-pressed', String(state.sort === 'wrong'));
    saveUi(); queueTrack();
  }
  function viewOf(el) { return el.closest ? el.closest('.view') : null; }
  function flash(el) { if (!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  function reveal(el) {
    if (!el) return;
    var v = viewOf(el);
    if (v && v.dataset.view !== state.view) show(v.dataset.view);
    if (el.classList.contains('qcard') && el.hidden) { state.filter = 'all'; applyFilter(); }
    requestAnimationFrame(function () { el.scrollIntoView({ block: 'start' }); flash(el); });
  }
  function route() {
    var h = ''; try { h = decodeURIComponent(location.hash.slice(1)); } catch (e) { }
    if (h === 'answers' || h === 'lessons') { show(h); window.scrollTo(0, 0); return; }
    var el = h && document.getElementById(h);
    if (el && (el.classList.contains('qcard') || el.classList.contains('lesson'))) { reveal(el); return; }
    if (h === 'fixes') { show('lessons'); requestAnimationFrame(function () { $('#fixes').scrollIntoView(); }); return; }
    show(state.view);
  }

  /* ---------- theme switch ---------- */
  (function () {
    var root = document.documentElement, sw = $('.themesw');
    function eff() { var t = root.getAttribute('data-review-theme'); if (t) return t; var h = root.getAttribute('data-theme'); if (h === 'light' || h === 'dark') return h; return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
    function paint() { $$('button', sw).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.t === eff())); }); }
    sw.addEventListener('click', function (e) { var b = e.target.closest('button[data-t]'); if (!b) return; root.setAttribute('data-review-theme', b.dataset.t); try { localStorage.setItem(KEY + '-theme', b.dataset.t); } catch (er) { } paint(); });
    if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paint); } catch (e) { } }
    paint();
  })();

  /* ---------- Ask: storage ---------- */
  var docs = store('asks') || {}, coll = null, writing = {}, listeners = [];
  if (typeof docs !== 'object' || Array.isArray(docs)) docs = {};
  function emit() { listeners.forEach(function (f) { f(); }); }
  function saveLocal() { store('asks', docs); }
  function put(id, d) {
    docs[id] = d; saveLocal(); emit();
    if (!coll) return Promise.resolve();
    var p = (writing[id] || Promise.resolve()).then(function () { return coll.doc(id).set(d); }).catch(function (e) { console.warn('save failed', e && e.code); });
    writing[id] = p; return p;
  }
  function del(id) {
    delete docs[id]; saveLocal(); emit();
    if (coll) (writing[id] || Promise.resolve()).then(function () { return coll.doc(id).delete(); }).catch(function () { });
  }
  var answering = {}, streamText = {}, errs = {}, confirmDel = {};
  if (window.claude && claude.use) {
    claude.use('db').then(function (d) {
      if (!d) return;
      coll = d.collection('questions');
      var first = true;
      coll.onSnapshot(function (snap) {
        var remote = {};
        snap.docs.forEach(function (s) { if (s.exists) remote[s.id] = JSON.parse(JSON.stringify(s.data())); });
        if (first) {
          first = false;
          Object.keys(docs).forEach(function (id) { if (!remote[id]) { remote[id] = docs[id]; coll.doc(id).set(docs[id]).catch(function () { }); } });
        }
        Object.keys(answering).forEach(function (id) { if (docs[id] && remote[id] && remote[id].thread.length < docs[id].thread.length) remote[id] = docs[id]; });
        docs = remote; saveLocal(); emit();
      }, function () { });
    }).catch(function () { });
  }

  /* ---------- Ask: answering with sample ---------- */
  var sampleFn = null, sampleState = (window.claude && claude.use) ? 'unknown' : 'none';
  function setSample(v) { if (sampleState === v) return; sampleState = v; if (wrapEl) wrapEl.classList.toggle('save-only', v === 'none'); paintPopNote(); emit(); }
  function getSample() {
    if (sampleFn) return Promise.resolve(sampleFn);
    if (!(window.claude && claude.use)) { setSample('none'); return Promise.resolve(null); }
    return claude.use('sample').then(function (s) { sampleFn = s || null; setSample(s ? 'ok' : 'none'); return sampleFn; }).catch(function () { setSample('none'); return null; });
  }
  function choiceText(q, o) { var p = picks(o); return p.length ? p.map(function (k) { return optLabel(q, k); }).join(', ') : ''; }
  function ansText(q, o) {
    o = o || {};
    if (o.blank) return '(left blank)';
    var parts = [];
    var c = choiceText(q, o); if (c) parts.push(c);
    if (o.value != null && o.value !== '') parts.push(String(o.value));
    if (o.text) parts.push(o.text);
    if (o.code) parts.push('```' + (o.lang || '') + '\n' + o.code + '\n```');
    if (o.image) parts.push('[an image: ' + (o.image.alt || 'see the page') + ']');
    return parts.join('\n') || '(none)';
  }
  function itemContext(item) {
    var kind = item.slice(0, 1), id = item.slice(2).toLowerCase();
    if (kind === 'q') {
      var q = QBY[id]; if (!q) return '';
      var t = '<question number="' + q.id + '" type="' + (q.format || TLABEL[q.type]) + '" points="' + q.points + '" unit="' + units(q).join('; ') + '">\n' + q.prompt;
      if (q.image) t += '\n[The question shows an image: ' + (q.image.alt || '') + ']';
      if (q.type === 'mc' || q.type === 'multi') t += '\nOptions:\n' + opts(q).map(function (o) { return o.key + '. ' + o.text; }).join('\n');
      t += '\n</question>\n<student_answer>' + ansText(q, q.answer) + '</student_answer>\n<correct_answer>' + ansText(q, q.correct) + '</correct_answer>' +
        '\n<verdict>' + VLABEL[q.verdict] + ', ' + earnedText(q) + ' points' + (isEst(q) ? ' (an estimate by Claude, not the instructor)' : '') + '</verdict>';
      if (q.student_note) t += '\n<student_note>' + q.student_note + '</student_note>';
      t += '\n<explanation_on_page>' + q.explanation + '</explanation_on_page>';
      if ((q.rubric || []).length) t += '\n<rubric>' + q.rubric.map(function (r) { return '- ' + r.point + ' (' + (r.got == null ? '' : r.got + ' of ') + r.marks + ')' + (r.comment ? ': ' + r.comment : ''); }).join('\n') + '</rubric>';
      if (q.key_dispute) t += '\n<key_dispute>' + q.key_dispute + '</key_dispute>';
      var w = q.walkthrough;
      if (w) t += '\n<walkthrough_on_page>How to think about it: ' + (w.think || '') + '\nSteps:\n' + (w.steps || []).map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n') + '\nAnswer: ' + (w.answer || '') + '\nThe trap: ' + (w.trap || '') + '</walkthrough_on_page>';
      return t;
    }
    var l = LBY[id]; if (!l) return '';
    var ex = l.example || {};
    return '<lesson number="' + l._n + '" title="' + l.title + '">\nThe idea: ' + l.idea + '\nHow to think about it: ' + l.how + '\nWorked example: ' + (ex.prompt || '') + '\nSolution: ' + (ex.solution || '') + '\nThe trap: ' + (l.trap || '') +
      '\nIt targets these exam questions: ' + (l.questions || []).map(function (i) { var q = QBY[String(i).toLowerCase()]; return q ? 'Q' + q.id + ' (' + VLABEL[q.verdict] + ')' : 'Q' + i; }).join(', ') + '\n</lesson>';
  }
  function promptFor(d) {
    var who = M.student_name ? M.student_name : 'The student';
    var head = 'You are a patient, exact tutor for ' + (M.course || 'this course') + '. ' + who + ' took ' + (M.exam || 'an exam') + (M.kind === 'graded' ? ' (a real exam the instructor graded; the instructor’s marks are final)' : ' (a practice exam)') +
      ' and is reviewing it on a page that shows each question with their answer, the correct answer and an explanation. The correct answers come from ' + (M.key_source || 'the answer key') + '.' +
      ((M.credit_rules || []).length ? ' Credit rules: ' + M.credit_rules.join(' ') : '') +
      '\n\nThey are asking about this item:\n\n' + itemContext(d.item) + '\n\n' +
      'Answer their question directly and correctly. Build the intuition first, then be precise. Use one to four short paragraphs of two or three sentences; you may use **bold**, simple lists with "- ", `code` and fenced code blocks for code. Write math as \\( \\) inline and \\[ \\] for display, with \\frac for fractions, and define every symbol you use. Tone: formal, concise and direct; never use em dashes. ' +
      'If they believe their answer deserved more credit, check it honestly against the key, the rubric and the credit rules, say plainly whether they have a point, and suggest asking the instructor when it is a judgment call. If the question goes beyond the course, answer from standard ' + (M.subject || 'subject') + ' knowledge and say so in one clause. Do not repeat their question.\n\nTheir question: ';
    return d.thread.map(function (m, i) { return { role: m.r === 'q' ? 'user' : 'assistant', content: i === 0 ? head + m.t : m.t }; });
  }
  function needsAnswer(d) { return d && d.thread && d.thread.length && d.thread[d.thread.length - 1].r === 'q'; }
  function answer(id) {
    var d = docs[id];
    if (!needsAnswer(d) || answering[id]) return Promise.resolve();
    answering[id] = true; streamText[id] = ''; delete errs[id]; emit();
    return getSample().then(function (s) {
      if (!s) throw { code: 'not_granted' };
      return s(promptFor(d), { cache: false, onText: function (u) { streamText[id] = u.text; paintStream(id); } });
    }).then(function (res) {
      var cur = docs[id]; delete answering[id]; delete streamText[id];
      if (!cur) { emit(); return; }
      var nd = JSON.parse(JSON.stringify(cur));
      nd.thread.push({ r: 'a', t: (res && res.text) || '', at: new Date().toISOString() });
      return put(id, nd);
    }).catch(function (e) {
      delete answering[id]; delete streamText[id];
      var c = e && e.code;
      errs[id] = c === 'not_granted' ? 'Answering needs permission for this page. Allow it when asked, or from the page’s Permissions menu, then try again.' :
        c === 'rate_limited' ? 'Too many requests just now. Try again in a minute.' : 'Could not get an answer right now. Try again.';
      emit();
    });
  }

  /* ---------- Ask: threads under their item ---------- */
  function itemEl(item) { var k = item.slice(0, 1), id = item.slice(2); return document.getElementById((k === 'q' ? 'q-' : 'lesson-') + id); }
  function idsFor(item) { return Object.keys(docs).filter(function (id) { return docs[id] && docs[id].item === item; }).sort(function (a, b) { return docs[a].created < docs[b].created ? -1 : 1; }); }
  function threadHtml(id) {
    var d = docs[id], h = '<div class="thread" data-id="' + esc(id) + '">';
    d.thread.forEach(function (m) { h += '<div class="msg ' + (m.r === 'q' ? 'q' : 'a') + '"><span class="who">' + (m.r === 'q' ? 'You' : 'Claude') + '</span>' + rt(m.t) + '</div>'; });
    if (answering[id]) h += '<div class="msg a wait"><span class="who">Claude</span><div class="rt stream"><p>Thinking…</p></div></div>';
    if (needsAnswer(d) && !answering[id]) {
      if (sampleState === 'none') h += '<p class="th-note">Saved. Answers appear when this page is opened as a published Claude artifact.</p>';
      else h += '<div class="th-acts"><button type="button" class="btn primary th-answer">Answer</button></div>';
    }
    if (errs[id]) h += '<p class="th-err">' + esc(errs[id]) + '</p>';
    h += '<div class="th-acts"><input type="text" class="th-follow" id="fu-' + esc(id) + '" placeholder="Follow-up question" autocomplete="off" aria-label="Follow-up question">' +
      '<button type="button" class="btn th-send">' + (sampleState === 'none' ? 'Save' : 'Ask') + '</button>' +
      (confirmDel[id] ? '<span class="th-note">Delete this thread?</span><button type="button" class="btn ghost th-del-yes">Delete</button><button type="button" class="btn ghost th-del-no">Keep</button>' : '<button type="button" class="btn ghost th-del">Delete</button>') +
      '</div></div>';
    return h;
  }
  var sigs = {};
  function renderThreads() {
    var items = {};
    $$('[data-item]').forEach(function (el) { items[el.dataset.item] = el; });
    Object.keys(items).forEach(function (item) {
      var ids = idsFor(item), box = items[item].querySelector('.qa');
      var sig = JSON.stringify(ids.map(function (id) { return [docs[id].thread.length, !!answering[id], errs[id] || '', !!confirmDel[id]]; })) + sampleState;
      if (sigs[item] === sig) return;
      sigs[item] = sig;
      var keepVals = {}; $$('.th-follow', box).forEach(function (i) { keepVals[i.id] = i.value; });
      box.hidden = !ids.length;
      box.innerHTML = ids.length ? '<p class="lbl">Your questions (' + ids.length + ')</p>' + ids.map(threadHtml).join('') : '';
      $$('.th-follow', box).forEach(function (i) { if (keepVals[i.id]) i.value = keepVals[i.id]; });
      ids.forEach(function (id) { if (answering[id]) paintStream(id); });
      typeset(box);
    });
    updateFab();
  }
  function paintStream(id) {
    var el = document.querySelector('.thread[data-id="' + id + '"] .stream');
    if (el && streamText[id]) el.innerHTML = rtInner(streamText[id]);
  }
  listeners.push(renderThreads);
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('button') : null;
    if (!t) return;
    var th = t.closest('.thread'), id = th && th.dataset.id;
    if (t.classList.contains('th-answer')) answer(id);
    else if (t.classList.contains('th-send')) sendFollow(th);
    else if (t.classList.contains('th-del')) { confirmDel[id] = true; emit(); }
    else if (t.classList.contains('th-del-no')) { delete confirmDel[id]; emit(); }
    else if (t.classList.contains('th-del-yes')) { delete confirmDel[id]; del(id); }
    else if (t.classList.contains('ask-here')) { var it = t.closest('[data-item]'); openPop(it.dataset.item); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('th-follow')) { e.preventDefault(); sendFollow(e.target.closest('.thread')); } });
  function sendFollow(th) {
    var id = th.dataset.id, inp = th.querySelector('.th-follow'), v = inp.value.trim(), d = docs[id];
    if (!v || !d || answering[id]) return;
    var nd = JSON.parse(JSON.stringify(d));
    nd.thread.push({ r: 'q', t: v, at: new Date().toISOString() });
    inp.value = '';
    put(id, nd);
    if (sampleState !== 'none') answer(id);
  }

  /* ---------- Ask: the floating button and its box ---------- */
  var wrapEl = document.createElement('div');
  wrapEl.className = 'ask-wrap' + (sampleState === 'none' ? ' save-only' : '');
  wrapEl.innerHTML = '<div class="ask-pop" hidden role="dialog" aria-label="Ask a question">' +
    '<div class="ap-head"><label for="ap-target">About</label><input id="ap-target" type="text" placeholder="7 or L3" autocomplete="off" spellcheck="false"><span style="flex:1"></span><button type="button" class="ap-x" aria-label="Close">&times;</button></div>' +
    '<textarea id="ap-text" placeholder="What do you want to understand? For example: why is option B wrong?"></textarea>' +
    '<p class="ap-err" hidden></p>' +
    '<div class="ap-acts"><button type="button" class="btn ghost ask-save">Save for later</button><button type="button" class="btn primary ask-now">Ask Claude</button></div>' +
    '<p class="ap-note"></p></div>' +
    '<button type="button" class="ask-fab" aria-haspopup="dialog"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/></svg><b>Ask</b><span class="af-t"></span></button>';
  document.body.appendChild(wrapEl);
  var pop = $('.ask-pop', wrapEl), fab = $('.ask-fab', wrapEl), tIn = $('#ap-target'), tx = $('#ap-text'), apErr = $('.ap-err', wrapEl);
  function paintPopNote() {
    var n = $('.ap-note', wrapEl); if (!n) return;
    n.textContent = sampleState === 'none' ? 'Your question is saved under the item. Answers appear when this page is opened as a published Claude artifact.' : 'The question is saved under the item, with Claude’s answer below it.';
    $('.ask-save', wrapEl).textContent = sampleState === 'none' ? 'Save question' : 'Save for later';
  }
  paintPopNote();
  var current = null;
  function labelFor(item) { if (!item) return ''; var id = item.slice(2); return item[0] === 'q' ? id : (LBY[id.toLowerCase()] ? 'L' + LBY[id.toLowerCase()]._n : id); }
  function nameFor(item) { if (!item) return ''; var id = item.slice(2).toLowerCase(); return item[0] === 'q' ? 'Q' + QBY[id].id : lName(LBY[id]); }
  function track() {
    var v = state.view === 'lessons' ? '#view-lessons .lesson' : '#view-answers .qcard:not([hidden])';
    var els = $$(v), top = document.querySelector('.top').getBoundingClientRect().bottom, line = top + (window.innerHeight - top) * 0.25, pick = els[els.length - 1] || null;
    for (var i = 0; i < els.length; i++) { if (els[i].getBoundingClientRect().bottom > line) { pick = els[i]; break; } }
    current = pick ? pick.dataset.item : null;
    updateFab();
  }
  var tq = 0;
  function queueTrack() { if (tq) return; tq = requestAnimationFrame(function () { tq = 0; track(); }); }
  function updateFab() {
    if (!fab) return;
    var t = $('.af-t', fab), n = current ? idsFor(current).length : 0;
    t.textContent = current ? 'about ' + nameFor(current) + (n ? ' (' + n + ')' : '') : '';
  }
  function parseTarget(s) {
    s = String(s || '').trim();
    var m = /^(?:l|lesson)\s*-?\s*(\d+)$/i.exec(s);
    if (m) { var l = LS[+m[1] - 1]; if (l) return 'l:' + l.id; }
    if (LBY[s.toLowerCase()]) return 'l:' + LBY[s.toLowerCase()].id;
    var q = /^(?:q|question|#)?\s*\.?\s*([A-Za-z0-9.-]+)$/i.exec(s);
    if (q && QBY[q[1].toLowerCase()]) return 'q:' + QBY[q[1].toLowerCase()].id;
    if (QBY[s.toLowerCase()]) return 'q:' + QBY[s.toLowerCase()].id;
    return null;
  }
  function openPop(item) {
    pop.hidden = false; apErr.hidden = true;
    tIn.value = labelFor(item || current);
    getSample();
    setTimeout(function () { tx.focus(); }, 0);
  }
  function closePop() { pop.hidden = true; }
  fab.addEventListener('click', function () { if (pop.hidden) openPop(); else closePop(); });
  $('.ap-x', wrapEl).addEventListener('click', closePop);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) closePop(); });
  function submit(now) {
    var item = parseTarget(tIn.value), text = tx.value.trim();
    apErr.hidden = true;
    if (!item) { apErr.textContent = 'There is no question or lesson called “' + tIn.value.trim() + '”. Type a question number such as ' + (QS[0] ? QS[0].id : '1') + ', or a lesson such as L1.'; apErr.hidden = false; return; }
    if (!text) { apErr.textContent = 'Type your question first.'; apErr.hidden = false; tx.focus(); return; }
    var id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    put(id, { item: item, thread: [{ r: 'q', t: text, at: new Date().toISOString() }], created: new Date().toISOString() });
    tx.value = ''; closePop();
    var el = itemEl(item); reveal(el);
    if (now && sampleState !== 'none') answer(id);
  }
  $('.ask-now', wrapEl).addEventListener('click', function () { submit(true); });
  $('.ask-save', wrapEl).addEventListener('click', function () { submit(false); });
  tx.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(sampleState !== 'none'); } });

  /* ---------- wire up ---------- */
  renderSummary();
  renderAnswers();
  renderLessons();
  $$('#view-answers .chip').forEach(function (b) { b.addEventListener('click', function () { if (b.disabled) return; state.filter = b.dataset.f; applyFilter(); }); });
  $('#view-answers .sortbtn').addEventListener('click', function () { state.sort = state.sort === 'wrong' ? 'exam' : 'wrong'; applySort(); });
  applySort(); applyFilter();
  window.addEventListener('hashchange', route);
  window.addEventListener('scroll', queueTrack, { passive: true });
  window.addEventListener('resize', queueTrack);
  route();
  typeset($('#summary')); typeset($('#view-answers')); typeset($('#view-lessons'));
  renderThreads();
  if (S.has_math) loadMath();
  if (sampleState !== 'none') getSample();
  window.rvReview = {
    docs: function () { return docs; },
    state: function () { return { view: state.view, filter: state.filter, sort: state.sort, sample: sampleState, current: current, answering: Object.keys(answering), errs: errs }; },
    prompt: function (id) { return promptFor(docs[id]); },
    parseTarget: parseTarget
  };
})();
