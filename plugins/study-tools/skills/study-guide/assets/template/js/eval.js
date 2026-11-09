/* ---------- evaluate exact answers: 3/4, 1/(1+e^-1), \frac{1}{1+e^{-1}}, sqrt(2)/2, ln(3) ---------- */
(function () {
  'use strict';
  function group(s, i) {
    while (s[i] === ' ') i++;
    if (s[i] === '{') {
      var d = 0;
      for (var j = i; j < s.length; j++) {
        if (s[j] === '{') d++;
        else if (s[j] === '}') { d--; if (d === 0) return { body: s.slice(i + 1, j), end: j + 1 }; }
      }
      return null;
    }
    if (s[i] === '\\') { var m = /^\\[a-zA-Z]+/.exec(s.slice(i)); if (m) return { body: m[0], end: i + m[0].length }; }
    return i < s.length ? { body: s[i], end: i + 1 } : null;
  }
  function latex(s) {
    s = s.replace(/\\(?:left|right|mleft|mright|bigl|bigr|Bigl|Bigr|big|Big)\b/g, '')
      .replace(/\\[dt]frac/g, '\\frac')
      .replace(/\\mathrm\{exp\}/g, 'exp').replace(/\\exponentialE|\\mathrm\{e\}|\\operatorname\{e\}/g, 'e')
      .replace(/\\operatorname\{([a-z]+)\}/g, '$1')
      .replace(/\\cdot|\\times|\\ast/g, '*').replace(/\\div/g, '/')
      .replace(/\\pi\b/g, 'pi').replace(/\\(ln|log|exp|sin|cos|tan|sigma)\b/g, '$1')
      .replace(/\\[,;:! ]|~|\\quad|\\qquad/g, ' ')
      .replace(/\\lbrace|\\lbrack/g, '(').replace(/\\rbrace|\\rbrack/g, ')');
    var out = '', i = 0, guard = 0;
    while (i < s.length && guard++ < 10000) {
      if (s.startsWith('\\frac', i)) {
        var a = group(s, i + 5); if (!a) return null;
        var b = group(s, a.end); if (!b) return null;
        out += '((' + latex(a.body) + ')/(' + latex(b.body) + '))'; i = b.end; continue;
      }
      if (s.startsWith('\\sqrt', i)) {
        var j = i + 5, idx = null;
        if (s[j] === '[') { var k = s.indexOf(']', j); if (k < 0) return null; idx = s.slice(j + 1, k); j = k + 1; }
        var g = group(s, j); if (!g) return null;
        out += idx ? '((' + latex(g.body) + ')^(1/(' + latex(idx) + ')))' : 'sqrt(' + latex(g.body) + ')'; i = g.end; continue;
      }
      if (s[i] === '^' || s[i] === '_') {
        var g2 = group(s, i + 1); if (!g2) return null;
        if (s[i] === '_') return null;
        out += '^(' + latex(g2.body) + ')'; i = g2.end; continue;
      }
      if (s[i] === '{') { out += '('; i++; continue; }
      if (s[i] === '}') { out += ')'; i++; continue; }
      if (s[i] === '\\') { return null; }
      out += s[i]; i++;
    }
    return out;
  }
  function tokens(s) {
    var t = [], i = 0, m;
    s = s.replace(/\u03c3/g, 'sigma').replace(/[\u2212\u2013]/g, '-').replace(/[\u00d7\u22c5\u00b7]/g, '*').replace(/\u00f7/g, '/').replace(/\u03c0/g, 'pi').replace(/\u221a/g, 'sqrt').replace(/\*\*/g, '^').replace(/,/g, '');
    while (i < s.length) {
      var c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if ((m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i)))) { t.push({ k: 'n', v: parseFloat(m[1]) }); i += m[1].length; continue; }
      if ((m = /^[a-zA-Z]+/.exec(s.slice(i)))) {
        var w = m[0].toLowerCase(); i += m[0].length;
        var fn = ['sqrt', 'exp', 'sigma', 'ln', 'log', 'sin', 'cos', 'tan'];
        while (w.length) {
          var hit = null;
          if (w.indexOf('pi') === 0) hit = 'pi';
          else for (var f = 0; f < fn.length; f++) if (w.indexOf(fn[f]) === 0) { hit = fn[f]; break; }
          if (!hit && w[0] === 'e') hit = 'e';
          if (!hit) return null;
          t.push(hit === 'pi' || hit === 'e' ? { k: 'n', v: hit === 'pi' ? Math.PI : Math.E } : { k: 'f', v: hit });
          w = w.slice(hit.length);
        }
        continue;
      }
      if ('+-*/^()%!|'.indexOf(c) >= 0) { t.push({ k: c }); i++; continue; }
      return null;
    }
    return t;
  }
  var F = { sigma: function (x) { return 1 / (1 + Math.exp(-x)); }, sqrt: Math.sqrt, exp: Math.exp, ln: Math.log, log: Math.log, sin: Math.sin, cos: Math.cos, tan: Math.tan };
  function parse(t) {
    var p = 0;
    function peek() { return t[p]; }
    function starts(x) { return x && (x.k === 'n' || x.k === 'f' || x.k === '('); }
    function expr() { var v = term(); while (peek() && (peek().k === '+' || peek().k === '-')) { var o = t[p++].k, r = term(); v = o === '+' ? v + r : v - r; } return v; }
    function term() {
      var v = unary();
      for (;;) {
        var x = peek();
        if (x && (x.k === '*' || x.k === '/')) { p++; var r = unary(); v = x.k === '*' ? v * r : v / r; }
        else if (starts(x)) { v = v * power(); }
        else return v;
      }
    }
    function unary() { var x = peek(); if (x && (x.k === '-' || x.k === '+')) { p++; var v = unary(); return x.k === '-' ? -v : v; } return power(); }
    function power() { var b = postfix(); if (peek() && peek().k === '^') { p++; return Math.pow(b, unary()); } return b; }
    function postfix() {
      var v = primary();
      while (peek() && (peek().k === '%' || peek().k === '!')) {
        if (t[p++].k === '%') v = v / 100;
        else { if (v < 0 || v !== Math.floor(v) || v > 170) return NaN; var r = 1; for (var i = 2; i <= v; i++) r *= i; v = r; }
      }
      return v;
    }
    function primary() {
      var x = t[p++];
      if (!x) throw 0;
      if (x.k === 'n') return x.v;
      if (x.k === 'f') { var a = (peek() && peek().k === '^') ? null : power(); if (a === null) throw 0; return F[x.v](a); }
      if (x.k === '(') { var v = expr(); if (!peek() || peek().k !== ')') throw 0; p++; return v; }
      if (x.k === '|') { var w = expr(); if (!peek() || peek().k !== '|') throw 0; p++; return Math.abs(w); }
      throw 0;
    }
    var v = expr();
    if (p !== t.length) throw 0;
    return v;
  }
  window.sgEvalMath = function (s) {
    try {
      s = String(s).trim(); if (!s) return NaN;
      if (s.indexOf('\\') >= 0 || s.indexOf('{') >= 0) { s = latex(s); if (s === null) return NaN; }
      var t = tokens(s); if (!t || !t.length) return NaN;
      var v = parse(t);
      return typeof v === 'number' && isFinite(v) ? v : NaN;
    } catch (e) { return NaN; }
  };
})();
