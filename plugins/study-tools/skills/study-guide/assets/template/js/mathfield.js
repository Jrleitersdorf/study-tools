/* ---------- math input: numeric answer boxes become live math fields (typing / makes a fraction) ----------
   ENGINE FILE. Do not edit per guide. core.js registers every numeric question in window.__sgNum;
   this file swaps each plain <input> for a MathLive <math-field> after the page loads.
   Gotchas handled here: fonts are inlined (mathfield-fonts.html) because the artifact CSP blocks font
   files, so fontsDirectory is null; the virtual keyboard and menu toggles are hidden; placeholder box
   glyphs are made transparent by a MutationObserver because MathLive draws them inside its shadow DOM. */
(function () {
  'use strict';
  var infos = window.__sgNum || [];
  if (!infos.length || !window.customElements) return;
  function upgrade() {
    var MF = window.MathfieldElement || (window.MathLive && window.MathLive.MathfieldElement);
    if (!MF) return;
    try {
      MF.fontsDirectory = null;
      MF.soundsDirectory = null;
      MF.keypressSound = null; MF.plonkSound = null;
    } catch (e) { }
    infos.forEach(function (info) {
      var plain = info.input;
      if (!plain || plain.tagName !== 'INPUT') return;
      var mf = new MF();
      mf.className = 'mathin';
      mf.setAttribute('aria-label', plain.getAttribute('aria-label') || 'Your answer');
      mf.setAttribute('math-virtual-keyboard-policy', 'manual');
      try { mf.mathVirtualKeyboardPolicy = 'manual'; mf.menuItems = []; } catch (e) { }
      try { mf.smartFence = true; mf.smartSuperscript = true; } catch (e) { }
      var startVal = plain.value, startDis = plain.disabled;
      plain.parentNode.insertBefore(mf, plain);
      try {
        if (mf.shadowRoot) {
          var st = document.createElement('style');
          st.textContent = '.ML__placeholder{color:transparent!important}.ML__virtual-keyboard-toggle,[part=virtual-keyboard-toggle],[part=menu-toggle]{display:none!important}';
          mf.shadowRoot.appendChild(st);
          var hideBoxes = function () {
            var w = document.createTreeWalker(mf.shadowRoot, NodeFilter.SHOW_TEXT), n;
            while ((n = w.nextNode())) { if (/^[\u25a2\u25a1\u25fb\u2b1a]$/.test(n.nodeValue.trim()) && n.parentElement && n.parentElement.style.color !== 'transparent') n.parentElement.style.color = 'transparent'; }
          };
          new MutationObserver(hideBoxes).observe(mf.shadowRoot, { childList: true, subtree: true, characterData: true });
        }
      } catch (e) { }
      plain.hidden = true;
      var wrap = {
        tagName: 'MATH-FIELD',
        get value() { try { return mf.getValue ? mf.getValue('latex-unstyled') || mf.value : mf.value; } catch (e) { return mf.value; } },
        set value(v) { try { mf.value = v || ''; } catch (e) { } },
        get disabled() { return !!mf.readOnly; },
        set disabled(b) { mf.readOnly = !!b; mf.classList.toggle('ro', !!b); },
        focus: function () { try { mf.focus(); } catch (e) { } },
        getAttribute: function (n) { return mf.getAttribute(n); }
      };
      if (plain.value !== startVal) startVal = plain.value;
      if (startVal) wrap.value = startVal;
      wrap.disabled = plain.disabled || startDis;
      mf.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); var b = info.el.querySelector('button.primary'); if (b && !b.hidden) b.click(); }
      }, true);
      mf.addEventListener('input', function () { if (info.nudge) info.nudge.hidden = true; if (info.onInput) info.onInput(); });
      info.input = wrap;
    });
  }
  function load() {
    if (window.MathfieldElement || window.MathLive) { upgrade(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/mathlive@0.109.2/mathlive.min.js';
    s.async = true;
    s.onload = function () { setTimeout(upgrade, 0); };
    document.head.appendChild(s);
  }
  if (document.readyState === 'complete') setTimeout(load, 300);
  else window.addEventListener('load', function () { setTimeout(load, 300); });
})();
