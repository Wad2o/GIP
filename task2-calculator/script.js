
(function () {
  'use strict';

  class CalcError extends Error {}

  var expr = '';          // internal form: digits . + - * / ( ) %
  var lastExpr = '';
  var error = '';
  var justEvaluated = false;

  var mainEl = document.getElementById('main');
  var subEl = document.getElementById('sub');
  var keysEl = document.getElementById('keys');

  // ---------- evaluation: recursive descent, so * / bind tighter than + - ----------
  function prepare(src) {
    var s = src.replace(/[-+*/(]+$/, '');           // drop dangling operators / open paren
    if (!s) return null;
    var open = (s.match(/\(/g) || []).length;
    var close = (s.match(/\)/g) || []).length;
    for (var n = open - close; n > 0; n--) s += ')'; // auto-close parentheses
    return s;
  }

  function evaluate(src) {
    var s = prepare(src);
    if (s === null) return null;
    var tokens = s.match(/\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[-+*/()%]/gi);
    if (!tokens || tokens.join('') !== s) throw new CalcError('Invalid expression');
    var i = 0;
    var peek = function () { return tokens[i]; };
    var next = function () { return tokens[i++]; };

    function parseExpr() {            // + -
      var v = parseTerm();
      while (peek() === '+' || peek() === '-') {
        var op = next();
        var r = parseTerm();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    function parseTerm() {            // * /
      var v = parseUnary();
      while (peek() === '*' || peek() === '/') {
        var op = next();
        var r = parseUnary();
        if (op === '/') {
          if (r === 0) throw new CalcError('Cannot divide by zero');
          v /= r;
        } else {
          v *= r;
        }
      }
      return v;
    }
    function parseUnary() {           // leading + or -
      if (peek() === '-') { next(); return -parseUnary(); }
      if (peek() === '+') { next(); return parseUnary(); }
      return parsePostfix();
    }
    function parsePostfix() {         // 50% = 0.5
      var v = parsePrimary();
      while (peek() === '%') { next(); v /= 100; }
      return v;
    }
    function parsePrimary() {
      var t = next();
      if (t === '(') {
        var v = parseExpr();
        if (next() !== ')') throw new CalcError('Invalid expression');
        return v;
      }
      if (t !== undefined && /^[\d.]/.test(t)) return parseFloat(t);
      throw new CalcError('Invalid expression');
    }

    var result = parseExpr();
    if (i < tokens.length) throw new CalcError('Invalid expression');
    return result;
  }

  function fmt(n) {
    if (!Number.isFinite(n)) throw new CalcError('Result is too large');
    var r = parseFloat(n.toPrecision(12));          // hides 0.1 + 0.2 float noise
    return String(r === 0 ? 0 : r);
  }

  // ---------- input rules ----------
  var isOp = function (c) { return c === '+' || c === '-' || c === '*' || c === '/'; };
  var currentNumber = function () { return (expr.match(/\d*\.?\d*$/) || [''])[0]; };
  var endsValue = function () { return /[\d.)%]$/.test(expr); };

  function pushDigit(d) {
    if (/[)%]$/.test(expr)) expr += '*';             // 2(3) and 50%3 mean multiplication
    var cur = currentNumber();
    expr = cur === '0' ? expr.slice(0, -1) + d : expr + d;   // no leading zeros
  }
  function pushDot() {
    if (/[)%]$/.test(expr)) expr += '*';
    var cur = currentNumber();
    if (cur.indexOf('.') !== -1) return;
    expr += cur === '' ? '0.' : '.';
  }
  function pushOpen() {
    if (endsValue()) expr += '*';
    expr += '(';
  }
  function pushClose() {
    var open = (expr.match(/\(/g) || []).length - (expr.match(/\)/g) || []).length;
    if (open > 0 && endsValue()) expr += ')';
  }
  function pushPercent() {
    if (endsValue()) expr += '%';
  }
  function pushOperator(t) {
    var last = expr.slice(-1);
    if (expr === '' || last === '(') { if (t === '-') expr += t; return; }   // only a sign is allowed here
    if (isOp(last)) {
      if (t === '-' && (last === '*' || last === '/')) { expr += t; return; } // 2 × −3
      var base = expr.replace(/[-+*/]+$/, '');                               // replace the previous operator
      if (base === '' || base.slice(-1) === '(') { if (t === '-') expr = base + t; return; }
      expr = base + t;
      return;
    }
    expr += t;
  }

  function equals() {
    if (!expr) return;
    try {
      var v = evaluate(expr);
      if (v === null) return;
      lastExpr = expr;
      expr = fmt(v);
      justEvaluated = true;
    } catch (e) {
      error = e instanceof CalcError ? e.message : 'Invalid expression';
    }
    render();
  }

  function press(k) {
    if (error) {
      error = ''; expr = ''; justEvaluated = false;
      if (k === 'clear' || k === 'back') { render(); return; }
    }
    if (k === 'clear') { expr = ''; lastExpr = ''; justEvaluated = false; render(); return; }
    if (k === 'back') { justEvaluated = false; expr = expr.slice(0, -1); render(); return; }
    if (k === '=') { equals(); return; }

    if (justEvaluated && /^[\d.(]$/.test(k)) expr = '';   // typing a number starts fresh; operators continue from the result
    justEvaluated = false;

    if (/^\d$/.test(k)) pushDigit(k);
    else if (k === '.') pushDot();
    else if (k === '(') pushOpen();
    else if (k === ')') pushClose();
    else if (k === '%') pushPercent();
    else pushOperator(k);
    render();
  }

  // ---------- display ----------
  function pretty(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (isOp(c)) {
        var sym = c === '*' ? '×' : c === '/' ? '÷' : c === '-' ? '−' : '+';
        out += i > 0 && /[\d.)%]/.test(s[i - 1]) ? ' ' + sym + ' ' : sym;
      } else {
        out += c;
      }
    }
    return out;
  }

  function render() {
    mainEl.textContent = error || pretty(expr) || '0';
    mainEl.classList.toggle('error', !!error);
    var len = mainEl.textContent.length;
    mainEl.dataset.size = len > 18 ? 's' : len > 11 ? 'm' : 'l';

    var sub = '';
    if (!error) {
      if (justEvaluated) {
        sub = pretty(lastExpr) + ' =';
      } else if (/[+*/()%]/.test(expr) || /.-/.test(expr)) {   // live preview
        try {
          var v = evaluate(expr);
          if (v !== null) sub = '= ' + fmt(v);
        } catch (e) { /* no preview for incomplete or invalid input */ }
      }
    }
    subEl.textContent = sub;
    mainEl.scrollLeft = mainEl.scrollWidth;
  }

  // ---------- mouse / touch ----------
  keysEl.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) press(b.dataset.k);
  });

  // ---------- keyboard ----------
  var KEYMAP = { Enter: '=', '=': '=', Backspace: 'back', Escape: 'clear', Delete: 'clear', c: 'clear', C: 'clear', x: '*', X: '*', ',': '.' };

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = KEYMAP[e.key] || (/^[\d.+\-*/()%]$/.test(e.key) ? e.key : null);
    if (!k) return;
    e.preventDefault();                                     // stops "/" quick-find and Enter re-clicking a focused button
    press(k);
    var btn = keysEl.querySelector('[data-k="' + k + '"]');
    if (btn) {
      btn.classList.add('pressed');
      setTimeout(function () { btn.classList.remove('pressed'); }, 110);
    }
  });

  render();
})();
