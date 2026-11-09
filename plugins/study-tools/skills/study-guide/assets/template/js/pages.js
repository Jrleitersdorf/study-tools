/* ---------- one unit per page ----------
   ENGINE FILE. Every direct <section id> child of <main> is a page: the start page (#intro), each
   unit (data-sg="unit"), the practice exam (data-sg="exam") and the summary (#summary). Only one is
   visible at a time; links to any id inside a page open that page and scroll to the target.
   Math is typeset lazily, the open page first, through window.sgPump (see mathjax-config.js).
   Gotcha: scrollTo(0,0) runs only when the page actually changes, otherwise a contents link to a
   section on the same page would jump to the top first and land in the wrong place. */
(function () {
  'use strict';
  var CFG = (window.SG && window.SG.config) || {};
  var NAV_KEY = (CFG.storage_key || 'study-guide') + '-nav';
  var main = document.querySelector('main');
  var pages = Array.prototype.filter.call(main.children, function (el) { return el.tagName === 'SECTION' && el.id; });
  var current = null, pending = null, busy = false;
  var nav = { page: null, pos: {} };
  try { var raw = localStorage.getItem(NAV_KEY); if (raw) nav = JSON.parse(raw) || nav; nav.pos = nav.pos || {}; } catch (e) { }
  function saveNav() { try { localStorage.setItem(NAV_KEY, JSON.stringify(nav)); } catch (e) { } }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function uname(p) { return window.sgUnitName ? window.sgUnitName(p.id) : p.id; }
  function label(p) {
    if (p.id === 'intro') return 'Start here';
    if (p.id === 'summary') return 'Your summary';
    if (p.dataset.sg === 'exam') return p.dataset.title || 'Practice exam';
    return uname(p) + ': ' + p.dataset.title;
  }
  function pageOf(el) { while (el && el.parentElement !== main) el = el.parentElement; return pages.indexOf(el) >= 0 ? el : null; }

  /* contents: a start link on top; only the open unit shows its sections */
  var toc = document.getElementById('toc');
  if (toc) {
    var li = document.createElement('li');
    li.innerHTML = '<a class="unit-link" href="#intro" data-target="intro"><span>Start here</span></a>';
    toc.insertBefore(li, toc.firstChild);
  }

  /* unit cards on the start page */
  var cards = document.getElementById('unit-cards');
  if (cards) {
    cards.innerHTML = pages.filter(function (p) { return p.dataset.sg === 'unit' || p.dataset.sg === 'exam'; }).map(function (p) {
      var c = p.querySelectorAll('.check').length;
      if (p.dataset.sg === 'exam') {
        var mins = CFG.practice_minutes;
        return '<a class="unit-card exam-card" href="#' + p.id + '"><span class="k">Practice exam</span><span class="t">' + esc(p.dataset.title || 'Practice exam') + '</span>' +
          '<span class="m"><span>' + c + ' questions' + (mins ? ' \u00b7 ' + mins + ' min' : '') + '</span><span class="st" data-for="' + p.id + '"></span></span></a>';
      }
      var n = p.querySelectorAll('[data-sg="section"][id]').length;
      return '<a class="unit-card" href="#' + p.id + '"><span class="k">' + esc(uname(p)) + '</span><span class="t">' + esc(p.dataset.title) + '</span>' +
        '<span class="m"><span>' + n + ' section' + (n === 1 ? '' : 's') + ' \u00b7 ' + c + ' question' + (c === 1 ? '' : 's') + '</span><span class="st" data-for="' + p.id + '"></span></span></a>';
    }).join('');
  }
  function syncCards() {
    Array.prototype.forEach.call(document.querySelectorAll('.unit-card .st[data-for]'), function (st) {
      var src = document.querySelector('.toc a[data-unit="' + st.dataset.for + '"] .st');
      if (src && st.innerHTML !== src.innerHTML) st.innerHTML = src.innerHTML;
    });
  }
  syncCards();
  if (toc && 'MutationObserver' in window) new MutationObserver(syncCards).observe(toc, { subtree: true, childList: true, characterData: true });

  /* previous / next at the bottom of every page */
  pages.forEach(function (p, i) {
    var prev = pages[i - 1], next = pages[i + 1];
    var el = document.createElement('nav');
    el.className = 'pager';
    el.setAttribute('aria-label', 'Previous and next page');
    el.innerHTML = (prev ? '<a class="pg prev" href="#' + prev.id + '" data-nav="top"><span class="dir">Previous</span><span class="t">' + esc(label(prev)) + '</span></a>' : '<span></span>') +
      (next ? '<a class="pg next primary" href="#' + next.id + '" data-nav="top"><span class="dir">Next</span><span class="t">' + esc(label(next)) + '</span></a>' : '');
    p.appendChild(el);
  });

  /* math is typeset page by page: the open page first, the rest in the background */
  function pump() {
    if (busy || !window.sgMathReady || !(window.MathJax && MathJax.typesetPromise)) return;
    var p = (current && current.dataset.tex !== 'done') ? current : pages.filter(function (q) { return q.dataset.tex !== 'done'; })[0];
    if (!p) return;
    busy = true;
    MathJax.typesetPromise([p]).catch(function () { }).then(function () {
      p.dataset.tex = 'done'; busy = false;
      if (p === current) settle();
      setTimeout(pump, 20);
    });
  }
  window.sgPump = pump;
  setTimeout(function () { if (!window.sgMathReady) { window.sgMathFailed = true; settle(); } }, 6000);

  function settle() {
    if (!pending) return;
    if (current.dataset.tex !== 'done' && !window.sgMathFailed) return;
    var t = pending; pending = null;
    if (t.el) t.el.scrollIntoView();
    else window.scrollTo(0, t.y || 0);
  }

  function show(p, how) {
    if (!p) p = pages[0];
    var changed = current !== p;
    if (current && changed) { nav.pos[current.id] = window.scrollY; }
    pages.forEach(function (q) { q.hidden = (q !== p); });
    current = p;
    nav.page = p.id; saveNav();
    Array.prototype.forEach.call(document.querySelectorAll('#toc > li'), function (li) {
      var a = li.querySelector('a.unit-link'), on = !!a && a.dataset.target === p.id;
      li.classList.toggle('cur', on);
      if (a) a.classList.toggle('current', on);
    });
    pending = how && how.el ? { el: how.el } : { y: how && how.restore ? (nav.pos[p.id] || 0) : 0 };
    if (changed) window.scrollTo(0, 0);
    try { history.replaceState(null, '', '#' + (how && how.el ? how.el.id : p.id)); } catch (e) { }
    settle();
    pump();
  }

  function go(id, restore) {
    var el = document.getElementById(id), p = el && pageOf(el);
    if (!p) return false;
    show(p, el === p ? { restore: restore } : { el: el });
    return true;
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (go(id, a.dataset.nav !== 'top')) e.preventDefault();
  });
  window.addEventListener('hashchange', function () { var id = location.hash.slice(1); if (id && (!current || id !== current.id)) go(id, true); });

  var scrollTimer = 0;
  window.addEventListener('scroll', function () {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () { if (current && !pending) { nav.pos[current.id] = window.scrollY; saveNav(); } }, 250);
  }, { passive: true });

  var start = '';
  try { start = decodeURIComponent((location.hash || '').slice(1)); } catch (e) { }
  if (!(start && go(start, true))) go(nav.page && document.getElementById(nav.page) ? nav.page : 'intro', true);
})();
