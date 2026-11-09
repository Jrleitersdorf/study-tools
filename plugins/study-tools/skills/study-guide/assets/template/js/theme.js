/* ---------- light / dark switch ----------
   ENGINE FILE. The header has <div class="themesw" data-sg="theme-switch"> with Light and Dark buttons.
   A choice is stored per browser (key: <storage_key>-theme) and applied before first paint by the
   inline script that build.py puts in <head>. Until the reader picks, the page follows the system or
   host theme. html[data-guide-theme] is used (not data-theme) so the reader's choice wins over the host. */
(function () {
  var CFG = (window.SG && window.SG.config) || {};
  var KEY = (CFG.storage_key || 'study-guide') + '-theme', root = document.documentElement, sw = document.querySelector('.themesw');
  if (!sw) return;
  function effective() { var t = root.getAttribute('data-guide-theme'); if (t) return t; var h = root.getAttribute('data-theme'); if (h === 'light' || h === 'dark') return h; return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  function paint() { var e = effective(); Array.prototype.forEach.call(sw.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.t === e)); }); }
  sw.addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-t]'); if (!b) return;
    root.setAttribute('data-guide-theme', b.dataset.t);
    try { localStorage.setItem(KEY, b.dataset.t); } catch (e) { }
    paint();
  });
  if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paint); } catch (e) { } }
  paint();
})();
