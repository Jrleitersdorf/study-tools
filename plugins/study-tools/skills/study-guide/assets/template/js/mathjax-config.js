/* ---------- MathJax configuration ----------
   ENGINE FILE. MathJax 3.2.2 (tex-svg) loads from cdnjs right after this script.
   startup.typeset is false on purpose: pages.js typesets one page at a time (the open page first,
   the rest in the background) via window.sgPump, and ask.js typesets answers only after they are
   inserted into the page. Typesetting a detached element produces NaN-sized SVGs. */
window.MathJax = {
  tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']] },
  svg: { fontCache: 'global' },
  options: { enableMenu: false },
  startup: {
    typeset: false,
    ready: function () {
      MathJax.startup.defaultReady();
      MathJax.startup.promise.then(function () { window.sgMathReady = true; if (window.sgPump) window.sgPump(); });
    }
  }
};
