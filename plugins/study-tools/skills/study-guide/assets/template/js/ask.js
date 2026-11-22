/* ---------- Ask (questions answered in place) and "Solve it for me" ----------
   ENGINE FILE. Do not edit per guide; the tutor prompts are built from window.SG.config.
   Ask: a floating button follows the section being read. Questions are saved under that section
   (or under a unit's Questions block, with an optional question number), answered by Claude with
   claude.use('sample'), shown at the bottom of the section, and can take follow-ups.
   Solve it for me: on a practice question, Claude writes a pen-and-paper walkthrough on demand.
   It counts the question as wrong (unit questions; Missed for written items), appears only when ready,
   and is cached. Its shape follows the kind of question (computation, code, conceptual choice,
   identification or passage, essay or short answer).
   Get feedback: on a written item that has been compared (or submitted, in the exam), Claude reads the
   student's text against the model answer and rubric and suggests a mark, labeled as advice.
   Storage: db collections "questions", "walkthroughs" and "feedback" when the artifact has the db
   capability, otherwise localStorage (<storage_key>-questions, <storage_key>-walk, <storage_key>-feedback).
   Gotchas: sample() messages must alternate user/assistant and end on a user turn; section text is
   captured before MathJax runs so the prompt contains TeX, not SVG (code blocks keep their line breaks,
   in fences); answers are typeset only after they are inserted into the page. Without the sample
   capability Solve it for me and Get feedback hide themselves. core.js calls window.sgWrittenChanged(id)
   whenever a written item is shown, marked or reset. */
(function () {
  'use strict';
  var CFG = (window.SG && window.SG.config) || {};
  var KEY = CFG.storage_key || 'study-guide';
  var LS_Q = KEY + '-questions';
  var lecs = Array.prototype.slice.call(document.querySelectorAll('section[data-sg="unit"], section[data-sg="exam"]'));
  if (!lecs.length) return;
  var UNIT_WORD = CFG.unit_label || 'Unit';

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clean(t) { return String(t).replace(/\s+/g, ' ').trim(); }
  /* code blocks (<pre>) keep their line breaks: they are swapped for markers, the rest is cleaned, then
     each marker becomes a fenced block */
  function pullCode(c) {
    var codes = [];
    Array.prototype.forEach.call(c.querySelectorAll('pre'), function (pr) { codes.push(pr.textContent.replace(/\s+$/, '')); pr.replaceWith(document.createTextNode(' \u0001' + (codes.length - 1) + '\u0001 ')); });
    return codes;
  }
  function unfence(s, codes) { return s.replace(/ ?\u0001(\d+)\u0001 ?/g, function (m, i) { return '\n```\n' + codes[+i] + '\n```\n'; }).replace(/^\n+|\n+$/g, ''); }
  function txt(el, drop) {
    if (!el) return '';
    var c = el.cloneNode(true);
    if (drop) Array.prototype.forEach.call(c.querySelectorAll(drop), function (x) { x.remove(); });
    var codes = pullCode(c);
    return unfence(clean(c.textContent), codes);
  }
  function uname(lec) { return window.sgUnitName ? window.sgUnitName(lec.id) : ((lec.dataset.label || UNIT_WORD) + ' ' + (lec.dataset.num || '')).trim(); }
  function isExam(lec) { return lec && lec.dataset.sg === 'exam'; }

  /* ---------- tutor prompt pieces, all from guide.config.json ---------- */
  var STUDENT = CFG.student_name ? 'The student, ' + CFG.student_name + ',' : 'The student';
  var EXAM = (CFG.exam_name || 'an upcoming exam') + (CFG.exam_format ? ' (' + CFG.exam_format + ')' : '');
  var COURSE = CFG.course_full || CFG.course || 'this course';
  var SUBJECT = CFG.subject || 'the subject';
  var STYLE = (CFG.style && CFG.style.no_em_dashes === false ? '' : ' Never use em dashes.') + (CFG.style && CFG.style.prompt_extra ? ' ' + CFG.style.prompt_extra : '');
  var CALC = CFG.calculator ? 'a calculator is allowed' : 'no calculator';
  function intro() { return 'You are a patient, precise tutor for ' + COURSE + '. ' + STUDENT + ' is preparing for ' + EXAM + '.'; }

  /* section context, captured before MathJax replaces the TeX */
  var CTX = {}, ORDER = [], CHECKS = {}, NUM = {};
  lecs.forEach(function (lec) {
    NUM[lec.id] = lec.dataset.num || '';
    var take = lec.querySelector('[data-sg="takeaway"]');
    var lbl0 = take && take.querySelector('.lbl');
    var takeText = take ? clean(take.textContent.replace(lbl0 ? lbl0.textContent : '', '')) : '';
    var title = lec.dataset.title || '';
    Array.prototype.forEach.call(lec.querySelectorAll('[data-sg="section"][id]'), function (it) {
      var h = it.querySelector('[data-sg="section-title"]');
      var n = h && h.querySelector('.n') ? h.querySelector('.n').textContent.trim() : '';
      var t = h ? clean(h.textContent).replace(n, '').trim() : it.id;
      var c = it.cloneNode(true);
      Array.prototype.forEach.call(c.querySelectorAll('img'), function (im) { im.replaceWith(document.createTextNode('[Figure: ' + (im.getAttribute('alt') || '') + '] ')); });
      var codes = pullCode(c);
      Array.prototype.forEach.call(c.querySelectorAll('h4, p, li, dt, dd, tr, figcaption, .eq-name'), function (el) { el.appendChild(document.createTextNode('\n')); });
      CTX[it.id] = { lec: lec.id, lecTitle: title, n: n, title: t, text: unfence(c.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim(), codes), takeaway: takeText, el: it, lecEl: lec };
      ORDER.push(it.id);
    });
    var cy = isExam(lec) ? (lec.querySelector('[data-sg="exam-body"]') || lec) : lec.querySelector('details[data-sg="questions"]');
    if (cy) {
      if (!cy.id) cy.id = lec.id + '-q';
      CTX[cy.id] = { lec: lec.id, lecTitle: title, n: '', title: isExam(lec) ? (title || 'Practice exam') : 'Questions', isQ: true, exam: isExam(lec), takeaway: takeText, el: cy, lecEl: lec, text: '' };
      ORDER.push(cy.id);
      Array.prototype.forEach.call(cy.querySelectorAll('.check'), function (ch) {
        var qn = ch.querySelector('.qn'), qt = ch.querySelector('.qt');
        var opts = Array.prototype.map.call(ch.querySelectorAll('.opt'), function (o) {
          var inp = o.querySelector('input'), k = o.querySelector('.k'), t = o.querySelector('.t');
          return { v: inp ? inp.value : '', letter: k ? k.textContent : '', text: t ? txt(t) : '' };
        });
        var ex = ch.querySelector('.expl'), so = ch.querySelector('.sol');
        var mo = so ? so.querySelector('[data-sg="model-answer"]') : null;
        var rub = so ? Array.prototype.map.call(so.querySelectorAll('[data-sg="rubric"] > li'), function (li) { return { t: txt(li, '.mk'), marks: li.dataset.marks || '' }; }) : [];
        CHECKS[ch.dataset.id] = { id: ch.dataset.id, num: qn ? qn.textContent.trim() : '', lec: lec.id, exam: isExam(lec), type: ch.dataset.type, format: ch.dataset.format || '', points: ch.dataset.points || '', topic: ch.dataset.topic || '',
          stem: txt(qt, '.tag'), opts: opts, ans: ch.dataset.ans || '', tol: ch.dataset.tol || '', expl: ex ? txt(ex) : '', sol: so ? txt(so, '.mk, .sol-h') : '', model: mo ? txt(mo) : '', rubric: rub, el: ch };
      });
    }
  });
  function checkByNum(lec, num) {
    for (var id in CHECKS) if (CHECKS[id].lec === lec && CHECKS[id].num === num) return CHECKS[id];
    return null;
  }
  function parseNum(lec, raw) {
    var s = String(raw || '').trim(), m, L = NUM[lec] || '';
    if (!s) return null;
    if (L && (m = /^(?:q(?:uestion)?\s*#?\s*)?([\w]+)\.(\d+)$/i.exec(s))) return m[1] === L ? L + '.' + m[2] : null;
    if ((m = /^(?:q(?:uestion)?\s*#?\s*)?(\d+)$/i.exec(s))) return L ? L + '.' + m[1] : m[1];
    return null;
  }
  function numFromText(lec, t) {
    var L = NUM[lec] || '', m;
    if (L && (m = new RegExp('\\b' + L.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.(\\d+)\\b').exec(t))) return L + '.' + m[1];
    if ((m = /\b(?:question|q)\s*#?\s*(\d+)\b/i.exec(t)) || (m = /#\s*(\d+)\b/.exec(t))) return L ? L + '.' + m[1] : m[1];
    return null;
  }
  function examOpen() { return !!(window.sgExam && !window.sgExam.state().submittedAt); }
  function writtenText(c) { var ta = c.el.querySelector('textarea.wtext'); return ta ? ta.value.replace(/\s+$/, '') : ''; }
  function quoteText(w) { return '"""\n' + (w.length > 4000 ? w.slice(0, 4000) + '\n[...]' : w) + '\n"""'; }
  function checkState(c) {
    var el = c.el, res = el.dataset.res || '', chosen = '';
    if (c.type === 'written') {
      var w = writtenText(c);
      if (!res) return w.trim() ? 'They have written this but not ' + (c.exam ? 'submitted it' : 'compared it with the model answer') + ' yet:\n' + quoteText(w) : 'They have not answered it yet.';
      if (!w.trim()) return 'They did not write an answer; it counts as missed.';
      return 'They wrote:\n' + quoteText(w) + '\n' + (res === 'pending' ? 'They have seen the model answer and rubric but have not marked their answer yet.' : 'They marked it themselves as ' + ({ right: 'full marks', partial: 'partly right', wrong: 'missed' }[res] || res) + '.');
    }
    if (c.type === 'num') { var mf = el.querySelector('math-field'); var inp = el.querySelector('.numrow input'); chosen = mf ? mf.value : (inp ? inp.value : ''); }
    else chosen = Array.prototype.map.call(el.querySelectorAll('input:checked'), function (i) { var o = c.opts.filter(function (x) { return x.v === i.value; })[0]; return o ? (o.letter || o.text) : i.value; }).join(', ');
    return res ? ('They answered "' + chosen + '", which was ' + (res === 'right' ? 'correct' : 'wrong') + '.') : (chosen ? 'They have selected "' + chosen + '" but have not checked it yet.' : 'They have not answered it yet.');
  }
  var KINDS = { mc: 'multiple choice, one answer', multi: 'select all that apply', tf: 'true or false', num: 'numeric answer', written: 'written answer' };
  function kindOf(c) { return c.type === 'written' && c.format === 'code' ? 'written answer: code' : (KINDS[c.type] || c.type); }
  function checkText(c, withState, hideKey) {
    var t = 'Question ' + c.num + ' (' + kindOf(c) + (c.points ? ', worth ' + c.points + ' point' + (c.points === '1' ? '' : 's') : '') + (c.topic ? ', topic: ' + c.topic : '') + '): ' + c.stem;
    if (c.type === 'written') {
      t += '\nAnswer key, the model answer and its rubric' + (hideKey ? ' (confidential: the exam is not submitted, do not reveal them)' : '') + ':\n<model_answer>\n' + c.model + '\n</model_answer>';
      if (c.rubric.length) t += '\nRubric:\n' + c.rubric.map(function (r) { return '- ' + (r.marks ? '(' + r.marks + ' mark' + (r.marks === '1' ? '' : 's') + ') ' : '') + r.t; }).join('\n');
      if (c.expl) t += '\nExplanation in the guide: ' + c.expl;
      t += '\nThe student marks written answers themselves against the rubric: full marks, partly, or missed.';
      if (withState) t += '\nStatus: ' + checkState(c);
      return t;
    }
    if (c.opts.length && c.type !== 'tf') t += '\nOptions: ' + c.opts.map(function (o) { return (o.letter || o.v) + ') ' + o.text; }).join('  ');
    var key = c.type === 'num' ? c.ans + (c.tol ? ' (tolerance ' + c.tol + ')' : '') : c.ans.split(',').map(function (k) { var o = c.opts.filter(function (x) { return x.v === k.trim(); })[0]; return o ? (o.letter || o.text) : k; }).join(', ');
    t += '\nAnswer key: ' + key + (hideKey ? ' (confidential: the exam is not submitted, do not reveal it)' : '') + '\nExplanation in the guide: ' + c.expl;
    if (withState) t += '\nStatus: ' + checkState(c);
    return t;
  }

  /* ---------- storage: shared db when available, this browser otherwise ---------- */
  var docs = {}, db = null, coll = null, listeners = [];
  function emit() { listeners.forEach(function (f) { f(); }); }
  function loadLocal() { try { return JSON.parse(localStorage.getItem(LS_Q) || '{}') || {}; } catch (e) { return {}; } }
  function saveLocal() { try { localStorage.setItem(LS_Q, JSON.stringify(docs)); } catch (e) { } }
  docs = loadLocal();
  var writing = {};
  function put(id, d) {
    docs[id] = d; saveLocal(); emit();
    if (!coll) return Promise.resolve();
    var w = writing[id] || Promise.resolve();
    var p = w.then(function () { return coll.doc(id).set(d); }).catch(function (e) { console.warn('save failed', e); });
    writing[id] = p; return p;
  }
  function del(id) {
    delete docs[id]; saveLocal(); emit();
    if (coll) (writing[id] || Promise.resolve()).then(function () { return coll.doc(id).delete(); }).catch(function () { });
  }
  if (window.claude && claude.use) {
    claude.use('db').then(function (d) {
      if (!d) return;
      db = d; coll = db.collection('questions');
      var first = true;
      coll.onSnapshot(function (snap) {
        var remote = {};
        snap.docs.forEach(function (s) { if (s.exists) remote[s.id] = JSON.parse(JSON.stringify(s.data())); });
        if (first) {
          first = false;
          Object.keys(docs).forEach(function (id) { if (!remote[id]) coll.doc(id).set(docs[id]).catch(function () { }); });
          Object.keys(docs).forEach(function (id) { if (!remote[id]) remote[id] = docs[id]; });
        }
        Object.keys(answering).forEach(function (id) { if (docs[id] && remote[id] && remote[id].thread.length < docs[id].thread.length) remote[id] = docs[id]; });
        docs = remote; saveLocal(); emit();
      }, function () { });
    }).catch(function () { });
  }

  /* ---------- answering ---------- */
  var sampleFn = null, sampleState = (window.claude && claude.use) ? 'unknown' : 'none', answering = {}, streamText = {};
  function getSample() {
    if (sampleFn) return Promise.resolve(sampleFn);
    if (!(window.claude && claude.use)) return Promise.resolve(null);
    return claude.use('sample').then(function (s) { sampleFn = s; setSampleState(s ? 'ok' : 'none'); return s; }).catch(function () { setSampleState('none'); return null; });
  }
  function setSampleState(v) { if (sampleState === v) return; sampleState = v; cards = {}; emit(); if (fab) fab.classList.toggle('no-answers', v === 'none'); }
  var RULES = 'Build understanding first, then be precise. Be concise: usually one to four short paragraphs of two or three sentences. Write plain paragraphs; you may use **bold** and simple lists with "- ". Use \\( \\) for inline math and \\[ \\] for display math, and put code in fenced blocks (```).' + STYLE + ' Do not repeat the question.';
  function thread(d, head) {
    var msgs = [];
    d.thread.forEach(function (m, i) {
      if (m.r === 'q') msgs.push({ role: 'user', content: i === 0 ? head + m.t : m.t });
      else msgs.push({ role: 'assistant', content: m.t });
    });
    return msgs;
  }
  function prompt(d) {
    var c = CTX[d.item] || {};
    if (c.isQ) return promptQ(d, c);
    var lecEl = c.lecEl;
    var head = intro() + ' They are reading this section of their study guide (math is written in LaTeX, code in fenced blocks):\n\n' +
      '<unit>' + (lecEl ? uname(lecEl) : '') + ': ' + (c.lecTitle || '') + '</unit>\n<unit_takeaway>' + (c.takeaway || '') + '</unit_takeaway>\n' +
      '<section title="' + (c.n || '') + ' ' + (c.title || '') + '">\n' + (c.text || '') + '\n</section>\n\n' +
      'Answer their question directly and correctly. Follow the conventions and notation used in the section. If the question goes beyond the course material, answer from standard ' + SUBJECT + ' knowledge and say in one clause that it goes beyond the course. ' + RULES + '\n\nQuestion: ';
    return thread(d, head);
  }
  function promptQ(d, c) {
    var one = d.qnum ? checkByNum(c.lec, d.qnum) : null;
    var lock = c.exam && examOpen();
    var ctx = one ? checkText(one, true, lock) : Object.keys(CHECKS).filter(function (id) { return CHECKS[id].lec === c.lec; }).map(function (id) { return checkText(CHECKS[id], true, lock); }).join('\n\n');
    var where = c.exam ? 'is taking the practice exam' + (lock ? ' and has not submitted it yet' : ' and has submitted it') : 'is working through the practice questions for ' + uname(c.lecEl) + ' (' + c.lecTitle + '). Unit takeaway: ' + c.takeaway;
    var head = intro() + ' They ' + where + '\n\n' +
      (one ? 'Their question is about this practice question:\n' : 'Their question may refer to one of these practice questions (math is in LaTeX, code in fenced blocks):\n') + '<practice_questions>\n' + ctx + '\n</practice_questions>\n\n' +
      (lock ? 'The exam is still in progress: do not reveal or confirm any answer, do not say whether a selected option or a written answer is right, and do not reveal a model answer or rubric. Clarify what a question means, recall the relevant idea, or give a small hint. ' :
        'Answer directly and correctly. If they have not answered the practice question yet and want help, guide their reasoning first and reveal the final answer only if they ask for it or have already answered. If they answered it wrong, explain where the reasoning likely went off and why the key is right. For a written question the model answer and rubric are the key and the student sets their own mark; if they ask how their answer would score, go through the rubric points and suggest a mark as advice. ') +
      RULES + '\n\nTheir question: ';
    return thread(d, head);
  }
  function needsAnswer(d) { return d && d.thread.length && d.thread[d.thread.length - 1].r === 'q'; }
  var errs = {};
  function answer(id) {
    var d = docs[id];
    if (!needsAnswer(d) || answering[id]) return Promise.resolve();
    answering[id] = true; streamText[id] = ''; emit();
    return getSample().then(function (s) {
      if (!s) throw { code: 'not_granted' };
      return s(prompt(d), { cache: false, onText: function (u) { streamText[id] = u.text; paintStream(id); } });
    }).then(function (res) {
      var cur = docs[id]; if (!cur) return;
      var nd = JSON.parse(JSON.stringify(cur));
      nd.thread.push({ r: 'a', t: (res && res.text) || '', at: new Date().toISOString() });
      delete answering[id]; delete streamText[id]; delete errs[id];
      return put(id, nd);
    }).catch(function (e) {
      delete answering[id]; delete streamText[id];
      var code = e && e.code;
      errs[id] = code === 'not_granted' ? 'Answering needs permission for this page. Allow it when asked, or from the page\u2019s Permissions menu, then try again.' :
        code === 'rate_limited' ? 'Too many requests just now. Try again in a minute.' :
        code === 'cancelled' ? 'Stopped.' : 'Could not get an answer right now. Try again.';
      emit();
    });
  }
  function answerAll(ids) {
    var list = ids.filter(function (id) { return needsAnswer(docs[id]) && !answering[id]; });
    return list.reduce(function (p, id) { return p.then(function () { return answer(id); }); }, Promise.resolve());
  }

  /* ---------- rendering: questions sit at the bottom of their section ---------- */
  function md(t) {
    var out = [], list = null, ltag = 'ul', fence = null;
    function flush() { if (list) { out.push('<' + ltag + '>' + list.map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</' + ltag + '>'); list = null; } }
    String(t).split(/\n/).forEach(function (line) {
      if (fence) { if (/^\s*```/.test(line)) { out.push({ code: fence.join('\n') }); fence = null; } else fence.push(line.replace(/\s+$/, '')); return; }
      if (/^\s*```/.test(line)) { flush(); fence = []; return; }
      var l = line.replace(/\s+$/, '');
      var m = /^\s*([-*]|\d+[.)])\s+(.*)$/.exec(l);
      if (m) { var tg = /\d/.test(m[1]) ? 'ol' : 'ul'; if (list && tg !== ltag) flush(); if (!list) { list = []; ltag = tg; } list.push(m[2]); return; }
      if (list && /^\s{2,}\S/.test(l)) { list[list.length - 1] += ' ' + l.trim(); return; }
      flush();
      if (!l.trim()) { out.push('\u0000'); return; }
      out.push(l);
    });
    if (fence) out.push({ code: fence.join('\n') });
    flush();
    var html = '', para = [];
    function endPara() { if (para.length) { html += '<p>' + inline(para.join(' ')) + '</p>'; para = []; } }
    out.forEach(function (x) {
      if (typeof x === 'object') { endPara(); html += '<pre class="code"><code>' + esc(x.code.replace(/^\n+|\n+$/g, '')) + '</code></pre>'; }
      else if (x === '\u0000') endPara();
      else if (x.indexOf('<ul>') === 0 || x.indexOf('<ol>') === 0) { endPara(); html += x; }
      else para.push(x);
    });
    endPara();
    return html;
  }
  function inline(s) { var o = esc(s).replace(/^#{1,4}\s+/, '').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); return CFG.style && CFG.style.no_em_dashes === false ? o : o.replace(/\u2014/g, ', '); }
  var pendingTex = [];
  function typeset(el) {
    if (window.sgMathReady && window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([el]).catch(function () { });
    else pendingTex.push(el);
  }
  var texTimer = setInterval(function () {
    if (!window.sgMathReady) return;
    clearInterval(texTimer);
    pendingTex.splice(0).forEach(function (el) { if (el.isConnected) typeset(el); });
  }, 500);
  function when(iso) { try { var d = new Date(iso); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }

  var boxes = {}, cards = {}, fab = null;
  ORDER.forEach(function (iid) {
    var it = CTX[iid].el;
    var box = document.createElement('div');
    box.className = 'qbox'; box.hidden = true; box.dataset.item = iid;
    box.innerHTML = '<div class="qb-head"><span class="qb-title">Your questions</span><button type="button" class="qb-btn qb-all" hidden></button></div><div class="qb-list"></div>';
    var sub = CTX[iid].exam ? it.querySelector('[data-sg="exam-submit"], .exam-submit') : null;
    if (sub) it.insertBefore(box, sub); else it.appendChild(box);
    boxes[iid] = box;
    box.querySelector('.qb-all').addEventListener('click', function () { answerAll(idsFor(iid)); });
  });
  function idsFor(iid) { return Object.keys(docs).filter(function (id) { return docs[id].item === iid; }).sort(function (a, b) { return docs[a].created < docs[b].created ? -1 : 1; }); }
  function cardSig(id) { var d = docs[id]; return JSON.stringify(d.thread) + '|' + (answering[id] ? 1 : 0) + '|' + (errs[id] || ''); }
  function buildCard(id) {
    var d = docs[id], el = document.createElement('div');
    el.className = 'qcard'; el.dataset.id = id;
    var h = '';
    d.thread.forEach(function (m, i) {
      if (m.r === 'q') h += '<div class="qc-q"><span class="qc-lbl">' + (i === 0 ? (d.qnum ? 'Q ' + esc(d.qnum) : 'Q') : 'Follow-up') + '</span><div class="qc-text">' + esc(m.t).replace(/\n/g, '<br>') + '</div></div>';
      else h += '<div class="qc-a"><span class="qc-lbl">Answer</span><div class="qc-text">' + md(m.t) + '</div></div>';
    });
    if (answering[id]) h += '<div class="qc-a qc-live"><span class="qc-lbl">Answer</span><div class="qc-text qc-stream">Thinking\u2026</div></div>';
    if (errs[id]) h += '<p class="qc-err">' + esc(errs[id]) + '</p>';
    h += '<div class="qc-foot"><span class="qc-when">' + esc(when(d.created)) + '</span><span class="qc-acts">';
    if (needsAnswer(d) && !answering[id] && sampleState !== 'none') h += '<button type="button" class="qb-btn qc-answer">Answer</button>';
    if (needsAnswer(d) && sampleState === 'none') h += '<span class="qc-sure">Saved. Answers appear when this guide is opened as a published Claude artifact.</span>';
    if (!needsAnswer(d) && !answering[id]) h += '<button type="button" class="qb-link qc-follow">Follow up</button>';
    h += '<button type="button" class="qb-link qc-del">Delete</button></span></div>';
    h += '<form class="qc-fu" hidden><textarea rows="2" placeholder="Ask a follow-up\u2026"></textarea><div class="qc-fu-acts"><button type="submit" class="qb-btn">Send</button><button type="button" class="qb-link qc-fu-x">Cancel</button></div></form>';
    el.innerHTML = h;
    var q = function (s) { return el.querySelector(s); };
    if (q('.qc-answer')) q('.qc-answer').addEventListener('click', function () { answer(id); });
    if (q('.qc-follow')) q('.qc-follow').addEventListener('click', function () { q('.qc-fu').hidden = false; q('.qc-fu textarea').focus(); });
    q('.qc-fu-x').addEventListener('click', function () { q('.qc-fu').hidden = true; });
    q('.qc-fu').addEventListener('submit', function (e) {
      e.preventDefault();
      var t = q('.qc-fu textarea').value.trim(); if (!t) return;
      var nd = JSON.parse(JSON.stringify(docs[id])); nd.thread.push({ r: 'q', t: t, at: new Date().toISOString() });
      put(id, nd).then(function () { answer(id); }); if (!coll) answer(id);
    });
    q('.qc-fu textarea').addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); q('.qc-fu').requestSubmit(); } });
    q('.qc-del').addEventListener('click', function () {
      var acts = q('.qc-acts');
      acts.innerHTML = '<span class="qc-sure">Delete this question?</span><button type="button" class="qb-link qc-yes">Delete</button><button type="button" class="qb-link qc-no">Keep</button>';
      acts.querySelector('.qc-yes').addEventListener('click', function () { del(id); });
      acts.querySelector('.qc-no').addEventListener('click', function () { delete cards[id]; render(); });
    });
    return el;
  }
  function paintStream(id) {
    var c = cards[id]; if (!c) return;
    var s = c.el.querySelector('.qc-stream'); if (s) s.textContent = streamText[id] || 'Thinking\u2026';
  }
  /* ---------- side rail: on wide screens every question is its own card beside the text ---------- */
  var RAIL_MIN = 1240, railOn = false, rcards = {}, collapsed = {}, dragId = null, railRaf = 0;
  var layoutEl = document.querySelector('.layout'), rail = null;
  if (layoutEl) {
    rail = document.createElement('aside');
    rail.className = 'qrail'; rail.hidden = true; rail.setAttribute('aria-label', 'Your questions');
    layoutEl.appendChild(rail);
  }
  var railRO = window.ResizeObserver ? new ResizeObserver(function () { queueRail(); }) : null;
  function wantRail() { return !!rail && window.innerWidth >= RAIL_MIN; }
  function queueRail() { if (!railOn || railRaf) return; railRaf = requestAnimationFrame(function () { railRaf = 0; layoutRail(); }); }
  function railSlot(id) {
    var w = rcards[id], d = docs[id];
    if (!w) {
      w = document.createElement('div'); w.className = 'rcard'; w.dataset.id = id;
      w.innerHTML = '<div class="rc-head" title="Drag up or down to move"><span class="rc-grip" aria-hidden="true">⋮⋮</span><span class="rc-sec"></span><span class="rc-q"></span><button type="button" class="rc-min" aria-label="Collapse">−</button></div><div class="rc-body"></div>';
      rail.appendChild(w); rcards[id] = w;
      w.querySelector('.rc-min').addEventListener('click', function (e) {
        e.stopPropagation(); collapsed[id] = !collapsed[id];
        w.classList.toggle('min', !!collapsed[id]); this.textContent = collapsed[id] ? '+' : '−';
        this.setAttribute('aria-label', collapsed[id] ? 'Expand' : 'Collapse'); layoutRail();
      });
      dragify(w, id);
      if (railRO) railRO.observe(w);
    }
    w.querySelector('.rc-sec').textContent = d.itemTitle || '';
    w.querySelector('.rc-q').textContent = (d.qnum ? 'Q ' + d.qnum + ': ' : '') + ((d.thread[0] && d.thread[0].t) || '');
    return w.querySelector('.rc-body');
  }
  function anchorOf(d) { return document.getElementById((d.pos && d.pos.a) || d.item); }
  function railItems(lec) {
    return lec ? Array.prototype.filter.call(lec.querySelectorAll('[data-sg="section"][id], details[data-sg="questions"][id], [data-sg="exam-body"][id]'), function (x) { return CTX[x.id]; }) : [];
  }
  function layoutRail() {
    if (!railOn) return;
    var lec = visibleLec(), top0 = rail.getBoundingClientRect().top, list = [];
    Object.keys(rcards).forEach(function (id) {
      var w = rcards[id], d = docs[id];
      if (!d) { if (railRO) railRO.unobserve(w); w.remove(); delete rcards[id]; return; }
      var a = anchorOf(d), show = !!(lec && d.lec === lec.id && a && a.getClientRects().length);
      w.hidden = !show;
      if (show) list.push({ id: id, w: w, want: a.getBoundingClientRect().top - top0 + ((d.pos && d.pos.off) || 0) });
    });
    list.sort(function (x, y) { return (x.want - y.want) || (docs[x.id].created < docs[y.id].created ? -1 : 1); });
    var y = 0;
    list.forEach(function (c) {
      if (c.id === dragId) return;
      var top = Math.max(c.want, y, 0);
      c.w.style.top = Math.round(top) + 'px';
      y = top + c.w.offsetHeight + 12;
    });
    rail.style.minHeight = Math.round(y) + 'px';
  }
  function dragify(w, id) {
    var head = w.querySelector('.rc-head');
    head.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target.closest('button')) return;
      e.preventDefault();
      var startY = e.clientY, startTop = parseFloat(w.style.top) || 0, moved = false;
      dragId = id; w.classList.add('drag');
      try { head.setPointerCapture(e.pointerId); } catch (er) { }
      function mv(ev) { var dy = ev.clientY - startY; if (Math.abs(dy) > 3) moved = true; w.style.top = Math.max(0, startTop + dy) + 'px'; }
      function up() {
        head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); head.removeEventListener('pointercancel', up);
        dragId = null; w.classList.remove('drag');
        var d = docs[id];
        if (!moved || !d) { layoutRail(); return; }
        var newTop = parseFloat(w.style.top) || 0, top0 = rail.getBoundingClientRect().top, best = null;
        railItems(visibleLec()).forEach(function (it) { if (it.getBoundingClientRect().top - top0 <= newTop + 1) best = it; });
        var a = best || anchorOf(d); if (!a) { layoutRail(); return; }
        var nd = JSON.parse(JSON.stringify(d));
        nd.pos = { a: a.id, off: Math.max(0, Math.round(newTop - (a.getBoundingClientRect().top - top0))) };
        put(id, nd);
      }
      head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up); head.addEventListener('pointercancel', up);
    });
  }
  function setRail() {
    var on = wantRail();
    if (on === railOn) { layoutRail(); return; }
    railOn = on; if (rail) rail.hidden = !on;
    if (layoutEl) layoutEl.classList.toggle('has-rail', on);
    if (!on) { Object.keys(rcards).forEach(function (id) { if (railRO) railRO.unobserve(rcards[id]); rcards[id].remove(); }); rcards = {}; }
    render();
  }

  function render() {
    ORDER.forEach(function (iid) {
      var box = boxes[iid], ids = idsFor(iid), list = box.querySelector('.qb-list');
      box.hidden = railOn || !ids.length;
      var frag = document.createDocumentFragment(), fresh = [];
      ids.forEach(function (id) {
        var sig = cardSig(id), c = cards[id];
        if (!c || c.sig !== sig) { c = cards[id] = { sig: sig, el: buildCard(id) }; fresh.push(c.el); }
        if (railOn) { var slot = railSlot(id); if (c.el.parentNode !== slot) { slot.innerHTML = ''; slot.appendChild(c.el); } }
        else frag.appendChild(c.el);
      });
      if (!railOn) { list.innerHTML = ''; list.appendChild(frag); }
      fresh.forEach(typeset);
      ids.forEach(function (id) { if (answering[id]) paintStream(id); });
      var open = ids.filter(function (id) { return needsAnswer(docs[id]) && !answering[id]; }).length;
      var allBtn = box.querySelector('.qb-all');
      allBtn.hidden = open < 2; allBtn.textContent = 'Answer all ' + open;
      box.querySelector('.qb-title').textContent = 'Your questions (' + ids.length + ')';
    });
    Object.keys(cards).forEach(function (id) { if (!docs[id]) delete cards[id]; });
    layoutRail();
    updateFab();
  }
  listeners.push(render);

  /* ---------- the floating Ask button follows the section you are reading ---------- */
  fab = document.createElement('div');
  fab.className = 'ask-wrap'; fab.hidden = true;
  fab.innerHTML =
    '<div class="ask-pop" hidden role="dialog" aria-label="Ask a question">' +
    '<div class="ap-head"><label class="ap-l">Question about <select class="ap-sec"></select></label><button type="button" class="ap-x" aria-label="Close">\u00d7</button></div>' +
    '<label class="ap-num" hidden>Question number <input type="text" class="ap-qn" placeholder="e.g. 3" autocomplete="off" spellcheck="false"></label>' +
    '<textarea class="ap-text" rows="4" placeholder="Type your question. Save it now and get answers when you finish reading, or ask right away."></textarea>' +
    '<div class="ap-acts"><button type="button" class="qb-btn ap-save">Save question</button><button type="button" class="qb-btn ap-now">Save and answer now</button></div>' +
    '<div class="ap-foot"><span class="ap-count"></span><button type="button" class="qb-link ap-all" hidden></button></div>' +
    '<p class="ap-saved" hidden></p>' +
    '</div>' +
    '<button type="button" class="ask-fab" aria-haspopup="dialog"><span class="af-q">Ask</span><span class="af-sec"></span><span class="af-badge" hidden></span></button>';
  document.body.appendChild(fab);
  var pop = fab.querySelector('.ask-pop'), fabBtn = fab.querySelector('.ask-fab'), sel = fab.querySelector('.ap-sec'), ta = fab.querySelector('.ap-text');
  var curLec = null, curItem = null, numRow = fab.querySelector('.ap-num'), qnIn = fab.querySelector('.ap-qn');
  var selTouched = false;
  sel.addEventListener('change', function () { selTouched = true; modeQ(); });

  function lbl(c) { return c ? (c.isQ ? c.title : (c.n + ' ' + c.title)) : ''; }
  function modeQ() {
    var c = CTX[sel.value], q = !!(c && c.isQ);
    numRow.hidden = !q;
    ta.placeholder = q ? 'Ask about a practice question. Put its number in the box above, or just mention it (for example "question 3").' : 'Type your question. Save it now and get answers when you finish reading, or ask right away.';
  }
  function visibleLec() { for (var i = 0; i < lecs.length; i++) if (!lecs[i].hidden) return lecs[i]; return null; }
  function track() {
    var lec = visibleLec();
    if (!lec) { fab.hidden = true; pop.hidden = true; curLec = null; return; }
    fab.hidden = false;
    var items = Array.prototype.slice.call(lec.querySelectorAll('[data-sg="section"][id], details[data-sg="questions"][id], [data-sg="exam-body"][id]')).filter(function (x) { return CTX[x.id]; });
    if (!items.length && CTX[lec.id + '-q']) items = [CTX[lec.id + '-q'].el];
    var pick = items[0] || null, line = window.innerHeight * 0.45;
    for (var i = 0; i < items.length; i++) { if (items[i].getBoundingClientRect().top < line) pick = items[i]; }
    if (lec !== curLec) {
      curLec = lec;
      sel.innerHTML = items.map(function (it) { return '<option value="' + it.id + '">' + esc(lbl(CTX[it.id])) + '</option>'; }).join('');
    }
    if (pick && pick.id !== curItem) {
      curItem = pick.id;
      fab.querySelector('.af-sec').textContent = lbl(CTX[curItem]);
      if (pop.hidden || (!selTouched && !ta.value.trim())) { sel.value = curItem; modeQ(); }
    }
    updateFab();
  }
  function lecOpen() {
    if (!curLec) return [];
    return Object.keys(docs).filter(function (id) { return docs[id].lec === curLec.id && needsAnswer(docs[id]) && !answering[id]; });
  }
  function updateFab() {
    if (!curLec) return;
    var open = lecOpen(), all = Object.keys(docs).filter(function (id) { return docs[id].lec === curLec.id; }).length;
    var b = fab.querySelector('.af-badge'); b.hidden = !open.length; b.textContent = open.length;
    b.title = open.length + ' unanswered';
    var cnt = fab.querySelector('.ap-count'), where = isExam(curLec) ? 'the practice exam' : uname(curLec);
    cnt.textContent = all ? (all + ' question' + (all === 1 ? '' : 's') + ' in ' + where + (open.length ? ', ' + open.length + ' unanswered' : ', all answered')) : 'No questions in ' + where + ' yet.';
    var ab = fab.querySelector('.ap-all'); ab.hidden = !open.length; ab.textContent = 'Answer all ' + open.length;
  }
  var raf = 0;
  window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; track(); }); }, { passive: true });
  window.addEventListener('resize', track);
  var mo = new MutationObserver(function () { setTimeout(function () { track(); queueRail(); }, 0); });
  window.addEventListener('resize', function () { setRail(); });
  if (railRO) { var mainEl = document.querySelector('main'); if (mainEl) railRO.observe(mainEl); }
  window.addEventListener('load', queueRail);
  lecs.forEach(function (l) { mo.observe(l, { attributes: true, attributeFilter: ['hidden'] }); });
  if (document.getElementById('intro')) mo.observe(document.getElementById('intro'), { attributes: true, attributeFilter: ['hidden'] });

  function openPop() { selTouched = false; sel.value = curItem || sel.value; modeQ(); pop.hidden = false; fab.classList.add('open'); fab.querySelector('.ap-saved').hidden = true; ta.focus(); updateFab(); }
  function closePop() { pop.hidden = true; fab.classList.remove('open'); }
  fabBtn.addEventListener('click', function () { pop.hidden ? openPop() : closePop(); });
  fab.querySelector('.ap-x').addEventListener('click', closePop);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) closePop(); });
  function save(now) {
    var t = ta.value.trim(); if (!t) { ta.focus(); return; }
    var iid = sel.value || curItem, c = CTX[iid];
    var qnum = null;
    if (c.isQ) {
      var raw = qnIn.value.trim();
      qnum = raw ? parseNum(c.lec, raw) : numFromText(c.lec, t);
      if (raw && (!qnum || !checkByNum(c.lec, qnum))) { qnIn.focus(); fab.querySelector('.ap-saved').textContent = 'There is no question ' + raw + ' here.'; fab.querySelector('.ap-saved').hidden = false; return; }
      if (qnum && !checkByNum(c.lec, qnum)) qnum = null;
    }
    var id = 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var d = { lec: c.lec, item: iid, itemTitle: lbl(c), created: new Date().toISOString(), thread: [{ r: 'q', t: t, at: new Date().toISOString() }] };
    if (qnum) d.qnum = qnum;
    var ael = c.el || document.getElementById(iid);
    if (ael) { var ar = ael.getBoundingClientRect(), line = window.innerHeight * 0.3; d.pos = { a: iid, off: (ar.top <= line && ar.bottom >= line) ? Math.round(line - ar.top) : 0 }; }
    ta.value = ''; qnIn.value = '';
    var msg = fab.querySelector('.ap-saved');
    msg.innerHTML = 'Saved under <a href="#' + iid + '">' + esc(lbl(c)) + '</a>' + (qnum ? ' (question ' + esc(qnum) + ')' : '') + (now ? '. Answering now.' : '.');
    msg.hidden = false;
    put(id, d).then(function () { if (now) answer(id); });
    if (railOn) { closePop(); var nw = rcards[id]; if (nw) { nw.classList.add('new'); setTimeout(function () { nw.classList.remove('new'); }, 2200); } }
    if (now && !coll) answer(id);
    if (now) getSample();
  }
  fab.querySelector('.ap-save').addEventListener('click', function () { save(false); });
  fab.querySelector('.ap-now').addEventListener('click', function () { save(true); });
  fab.querySelector('.ap-all').addEventListener('click', function () { answerAll(lecOpen()); });
  ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(false); } });
  qnIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); ta.focus(); } });

  /* ---------- "Solve it for me": an on-demand worked answer inside the question ---------- */
  var LS_W = KEY + '-walk', walks = {}, wcoll = null, walking = {};
  try { walks = JSON.parse(localStorage.getItem(LS_W) || '{}') || {}; } catch (e) { walks = {}; }
  function saveWalksLocal() { try { localStorage.setItem(LS_W, JSON.stringify(walks)); } catch (e) { } }
  function walkBox(c) {
    var wb = c.el.querySelector('.walkbox');
    if (!wb) { wb = document.createElement('div'); wb.className = 'walkbox'; wb.hidden = true; c.el.appendChild(wb); }
    return wb;
  }
  function paintWalk(id) {
    var c = CHECKS[id]; if (!c) return;
    var w = walks[id], wb = walkBox(c);
    if (walking[id]) { wb.classList.add('busy'); wb.dataset.has = ''; wb.innerHTML = '<p class="wk-h">Solving it for you</p><p class="wk-wait">Working it out\u2026</p>'; wb.hidden = false; return; }
    wb.classList.remove('busy');
    if (!w || !w.text) { if (w && w.err) { var so = c.el.querySelector('.sol'), ex = c.el.querySelector('.expl'); if (so) so.hidden = false; if (ex) ex.hidden = false; wb.innerHTML = '<p class="wk-h">Solving it for you</p><p class="qc-err">' + esc(w.err) + ' The prepared worked solution is shown above.</p><button type="button" class="qb-btn wk-retry">Try again</button>'; wb.hidden = false; wb.querySelector('.wk-retry').addEventListener('click', function () { delete walks[id]; runWalk(id); }); } return; }
    if (wb.dataset.sig === w.at) { var lk = c.el.dataset.res; if (lk) wb.hidden = false; return; }
    wb.dataset.sig = w.at; wb.dataset.has = '1';
    wb.innerHTML = '<p class="wk-h">Solved for you</p><div class="wk-body">' + md(w.text) + '</div>';
    wb.hidden = !c.el.dataset.res;
    var b = c.el.querySelector('button.walk'); if (b) { b.textContent = 'Show the walkthrough'; b.hidden = !wb.hidden || (c.exam && !c.el.dataset.res); }
    typeset(wb);
  }
  function walkPrompt(c) {
    var lecEl = c.el.closest('section[data-sg="unit"], section[data-sg="exam"]');
    var from = c.el.dataset.from ? document.getElementById(c.el.dataset.from) : null;
    var unitEl = from || lecEl, take = unitEl ? unitEl.querySelector('[data-sg="takeaway"]') : null;
    var tl = take && take.querySelector('.lbl');
    return intro() + ' Conditions: ' + (CFG.exam_conditions || CALC) + '. They do not know how to approach the practice question below and want you to solve it for them.\n\n' +
      '<unit>' + (unitEl && !isExam(unitEl) ? uname(unitEl) + ': ' + unitEl.dataset.title : (lecEl ? lecEl.dataset.title || '' : '')) + '</unit>\n<unit_takeaway>' + takeawayOf(unitEl, take, tl) + '</unit_takeaway>\n' +
      '<question>\n' + checkText(c, false) + (c.sol && c.type !== 'written' ? '\nReference worked solution (correct, for your accuracy): ' + c.sol : '') + '\n</question>\n\n' +
      walkShape(c);
  }
  /* the takeaway as captured before MathJax ran (TeX, not rendered math), else the page text */
  function takeawayOf(unitEl, take, tl) {
    if (!unitEl) return '';
    for (var k in CTX) if (CTX[k].lec === unitEl.id && CTX[k].takeaway) return CTX[k].takeaway;
    return take ? clean(take.textContent.replace(tl ? tl.textContent : '', '')) : '';
  }
  /* the walkthrough's shape follows the kind of question, so it fits any subject */
  var SHAPES = {
    calc: ['computation or derivation', 'list the givens (in the notation the subject uses), name the principle or formula that connects them, work the steps line by line, and end on the answer. Keep exact forms' + (CFG.calculator ? ' and evaluate at the end' : ' and approximate by hand at the end')],
    code: ['code', 'say what the code must do (inputs, output, edge cases), give a short plan, write the code in a fenced block, then check it by hand on one small example'],
    concept: ['conceptual multiple choice or true/false', 'name the idea the question tests, then judge each option (or the statement) in one sentence: why it is right or why it is a tempting mistake. If an option needs a value worked out, work it out first'],
    ident: ['identification or passage', 'point out the clues in the stem (the details that give it away), make the identification, then explain its significance'],
    essay: ['essay or short answer', 'say what the prompt actually asks (every part of it), state a thesis or main claim, gather the evidence that supports it, then write the answer at the real length expected on the exam']
  };
  function shapeOf(c) { return c.type === 'num' ? 'calc' : c.type === 'written' ? (c.format === 'code' ? 'code' : 'essay') : 'concept'; }
  function walkShape(c) {
    var k = shapeOf(c), w = c.type === 'written';
    var menu = ['calc', 'code', 'concept', 'ident', 'essay'].map(function (s) { return '- ' + SHAPES[s][0].charAt(0).toUpperCase() + SHAPES[s][0].slice(1) + ': ' + SHAPES[s][1] + '.'; }).join('\n');
    return 'Match the walkthrough to the kind of question. The shapes:\n' + menu + '\n' +
      'This is ' + ({ mc: 'a multiple-choice question', multi: 'a select-all question', tf: 'a true/false question', num: 'a numeric question' }[c.type] || (c.format === 'code' ? 'a code-writing question' : 'a written question')) + ', so the ' + SHAPES[k][0] + ' shape most likely fits. Use another shape from the list only when the question is clearly of that kind (for example a derivation or a proof asked as a written answer, a passage to identify, or a multiple-choice question that needs a computation).\n\n' +
      'Write it like this:\n' +
      '1. One to three sentences, in plain words, on what the question is really asking and the idea it tests.\n' +
      (w ? '2. A short plan: two to four "- " bullet points.\n' +
        '3. A line reading **Model answer:**, then the answer the way a top student would write it on the exam, in the form the exam expects' + (c.format === 'code' ? ' (the code in a fenced block, then one line on how you checked it)' : ' (prose at the real length for an essay or short answer; numbered steps for a derivation or proof)') + '.\n' +
        '4. One short line on what a grader looks for in this kind of question.\n' :
        '2. The walkthrough in that shape, as a numbered list of short steps.\n' +
        '3. A line starting **Answer:**, then one short line on how to recognize this kind of question next time.\n') +
      'Be concise: no long paragraphs' + (w ? ', except that a model essay or short answer has its real length' : '') + '. Use \\( \\) for inline math and \\[ \\] for display math on their own lines, and put code in fenced blocks (```).' + STYLE + ' ' +
      (w ? 'Your model answer must agree with the answer key (the model answer in the guide) and earn every rubric point.' : 'Your answer must agree with the answer key.');
  }

  /* ---------- "Get feedback" on a written answer: advice against the model answer and rubric ---------- */
  var LS_F = KEY + '-feedback', feeds = {}, fcoll = null, feeding = {}, ferr = {}, fbOff = false;
  try { feeds = JSON.parse(localStorage.getItem(LS_F) || '{}') || {}; } catch (e) { feeds = {}; }
  function saveFeedsLocal() { try { localStorage.setItem(LS_F, JSON.stringify(feeds)); } catch (e) { } }
  var NOTE = 'Claude’s feedback is advice; you set the mark.';
  function feedbackPrompt(c, text) {
    var marks = c.rubric.reduce(function (a, r) { var v = parseFloat(r.marks); return isNaN(v) ? a : a + v; }, 0);
    return intro() + ' They answered the written practice question below and want feedback before they mark it themselves against the rubric.\n\n' +
      '<question>\n' + checkText(c, false) + '\n</question>\n\n<student_answer>\n' + text + '\n</student_answer>\n\n' +
      'Judge the answer only against the model answer and the rubric. Accept different wording, a different order or a different correct approach when it makes the same point' + (c.format === 'code' ? '; for code, accept any correct solution that does what the rubric requires, and name each bug by its line' : '') + '. Give credit only for what the answer actually says: a point it only gestures at is partly met at best, and when you hesitate between two marks, suggest the lower one.\n\n' +
      'Write the feedback in this shape:\n' +
      '**What your answer gets right:** one to three sentences.\n' +
      '**Against the rubric:** a "- " list with one line per rubric point: met, partly met or missing, and what is missing.\n' +
      '**Suggested mark (advice only):** Full marks, Partly or Missed it' + (marks ? ', and the rubric marks you would give out of ' + marks : '') + '. The student sets the mark.\n' +
      '**To improve:** one line.\n' +
      'Address the student as "you". Be concise. Use \\( \\) for inline math and fenced blocks (```) for code.' + STYLE;
  }
  function fbParts(c) {
    var b = c.el.querySelector('button.fbk'), box = c.el.querySelector('.fbkbox'), act = c.el.querySelector('.actions');
    if (!b && act) {
      b = document.createElement('button'); b.type = 'button'; b.className = 'fbk'; b.textContent = 'Get feedback'; b.dataset.id = c.id; b.hidden = true;
      b.title = 'Claude compares your answer with the model answer and the rubric and suggests a mark. You still set the mark.';
      act.insertBefore(b, act.querySelector('button.walk'));
      b.addEventListener('click', function () { runFeedback(c.id); });
    }
    if (!box) { box = document.createElement('div'); box.className = 'fbkbox'; box.hidden = true; box.setAttribute('aria-live', 'polite'); c.el.appendChild(box); }
    return { b: b, box: box };
  }
  function paintFeedback(id) {
    var c = CHECKS[id]; if (!c || c.type !== 'written') return;
    var p = fbParts(c), b = p.b, box = p.box, f = feeds[id], text = writtenText(c);
    var open = !!c.el.dataset.res && !!text.trim();
    if (feeding[id]) { box.classList.add('busy'); box.dataset.sig = ''; box.innerHTML = '<p class="wk-h">Claude’s feedback</p><p class="wk-wait">Reading your answer…</p>'; box.hidden = false; if (b) b.hidden = true; return; }
    box.classList.remove('busy');
    if (open && f && f.text && f.answer === text) {
      box.hidden = false;
      if (box.dataset.sig !== f.at) { box.dataset.sig = f.at; box.innerHTML = '<p class="wk-h">Claude’s feedback</p><div class="wk-body">' + md(f.text) + '</div><p class="fk-note">' + NOTE + '</p>'; typeset(box); }
      if (b) b.hidden = true;
      return;
    }
    if (open && ferr[id]) { box.hidden = false; box.dataset.sig = ''; box.innerHTML = '<p class="wk-h">Claude’s feedback</p><p class="qc-err">' + esc(ferr[id]) + '</p>'; }
    else box.hidden = true;
    if (b) { b.textContent = ferr[id] ? 'Try feedback again' : 'Get feedback'; b.hidden = fbOff || !open; }
  }
  function runFeedback(id) {
    var c = CHECKS[id]; if (!c || feeding[id]) return;
    var text = writtenText(c); if (!text.trim() || !c.el.dataset.res) return;
    delete ferr[id]; feeding[id] = true; paintFeedback(id);
    getSample().then(function (s) {
      if (!s) throw { code: 'not_granted' };
      return s([{ role: 'user', content: feedbackPrompt(c, text) }], { cache: false });
    }).then(function (res) {
      delete feeding[id];
      feeds[id] = { text: (res && res.text) || '', answer: text, at: new Date().toISOString() };
      saveFeedsLocal(); paintFeedback(id);
      if (fcoll) fcoll.doc(id).set(feeds[id]).catch(function () { });
    }).catch(function (e) {
      delete feeding[id];
      var code = e && e.code;
      ferr[id] = code === 'not_granted' ? 'Feedback needs permission for this page. Allow it when asked, or from the page’s Permissions menu, then try again.' : code === 'rate_limited' ? 'Too many requests just now. Try again in a minute.' : 'Could not get feedback right now. Try again.';
      paintFeedback(id);
    });
  }
  function paintAllFeedback() { Object.keys(CHECKS).forEach(function (id) { if (CHECKS[id].type === 'written') paintFeedback(id); }); }
  window.sgWrittenChanged = function (id) { paintFeedback(id); };
  paintAllFeedback();
  function runWalk(id) {
    var c = CHECKS[id]; if (!c || walking[id]) return;
    if (c.exam && !c.el.dataset.res) return;
    if (window.sgGiveUp) window.sgGiveUp(id);
    if (walks[id] && walks[id].text) { paintWalk(id); var wb0 = walkBox(c); wb0.hidden = false; var bb = c.el.querySelector('button.walk'); if (bb) bb.hidden = true; wb0.scrollIntoView({ block: 'nearest' }); return; }
    var bw = c.el.querySelector('button.walk'); if (bw) bw.hidden = true;
    walking[id] = true; paintWalk(id);
    getSample().then(function (s) {
      if (!s) throw { code: 'not_granted' };
      return s([{ role: 'user', content: walkPrompt(c) }], { cache: false });
    }).then(function (res) {
      delete walking[id];
      walks[id] = { text: (res && res.text) || '', at: new Date().toISOString() };
      saveWalksLocal(); paintWalk(id);
      if (wcoll) wcoll.doc(id).set(walks[id]).catch(function () { });
    }).catch(function (e) {
      delete walking[id];
      var code = e && e.code;
      walks[id] = { err: code === 'not_granted' ? 'Solving needs permission for this page. Allow it when asked, or from the page\u2019s Permissions menu, then try again.' : code === 'rate_limited' ? 'Too many requests just now. Try again in a minute.' : 'Could not get a solution right now. Try again.' };
      paintWalk(id); delete walks[id];
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button.walk') : null;
    if (!b) return;
    e.preventDefault(); runWalk(b.dataset.id);
  });
  Object.keys(walks).forEach(paintWalk);
  function walkOff() {
    Array.prototype.forEach.call(document.querySelectorAll('button.walk'), function (b) { b.hidden = true; b.dataset.off = '1'; });
    fbOff = true; paintAllFeedback();
  }
  if (window.claude && claude.use) {
    claude.use('sample').then(function (s) { if (!s) walkOff(); }).catch(walkOff);
    claude.use('db').then(function (d) {
      if (!d) return;
      wcoll = d.collection('walkthroughs');
      wcoll.onSnapshot(function (snap) {
        snap.docs.forEach(function (sd) { if (sd.exists) { var v = sd.data(); if (v && v.text && (!walks[sd.id] || walks[sd.id].at !== v.at)) { walks[sd.id] = { text: v.text, at: v.at }; } } });
        saveWalksLocal(); Object.keys(walks).forEach(paintWalk);
      }, function () { });
      fcoll = d.collection('feedback');
      fcoll.onSnapshot(function (snap) {
        snap.docs.forEach(function (sd) { if (sd.exists) { var v = sd.data(); if (v && v.text && (!feeds[sd.id] || feeds[sd.id].at !== v.at)) feeds[sd.id] = { text: v.text, answer: v.answer || '', at: v.at }; } });
        saveFeedsLocal(); paintAllFeedback();
      }, function () { });
    }).catch(function () { });
  } else walkOff();

  if (sampleState === 'none') fab.classList.add('no-answers'); else getSample();
  setRail();
  render();
  setTimeout(function () { track(); queueRail(); }, 0);
  window.sgQA = { docs: function () { return docs; }, answer: answer, walks: function () { return walks; }, walking: function () { return Object.keys(walking); }, feedback: function () { return feeds; }, feeding: function () { return Object.keys(feeding); }, feedbackPrompt: function (id) { return feedbackPrompt(CHECKS[id], writtenText(CHECKS[id])); }, state: function () { return { curItem: curItem, answering: Object.keys(answering), errs: errs }; }, prompt: function (id) { return prompt(docs[id]); }, walkPrompt: function (id) { return walkPrompt(CHECKS[id]); } };
})();
