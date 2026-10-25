// Операции для разборов ARG: точная целочисленная арифметика (Cicada 3301: 509 × 503 × 3301 = 845145127).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const MAX_FACTOR_TRIAL = 20000000n;   // предел пробного деления: дальше разложение не гарантируется
  const MAX_POWER = 10000n;
  const MAX_EXPR = 2000;

  // ---------- разбор выражения: + − × ÷ % ^ и скобки над BigInt, без eval ----------
  function tokenize(src) {
    const tokens = [];
    const text = src.replace(/[×x·]/gi, '*').replace(/[÷:]/g, '/').replace(/[−–—]/g, '-').replace(/\*\*/g, '^').replace(/[,_\s]/g, '');
    let i = 0;
    while (i < text.length) {
      const c = text[i];
      if (/[0-9]/.test(c)) {
        let j = i;
        while (j < text.length && /[0-9]/.test(text[j])) j++;
        tokens.push({ num: BigInt(text.slice(i, j)) });
        i = j;
      } else if ('+-*/%^()'.includes(c)) {
        tokens.push({ op: c });
        i++;
      } else {
        throw new Error(T('Недопустимый символ «' + c + '» в выражении', 'Unexpected character “' + c + '” in the expression'));
      }
    }
    return tokens;
  }

  function evaluate(src) {
    if (src.length > MAX_EXPR) throw new Error(T('Выражение слишком длинное', 'The expression is too long'));
    const tokens = tokenize(src);
    if (!tokens.length) throw new Error(T('Пустое выражение', 'The expression is empty'));
    let pos = 0;
    const peek = () => tokens[pos];
    const isOp = (o) => peek() && peek().op === o;

    function atom() {
      const t = tokens[pos++];
      if (!t) throw new Error(T('Выражение оборвано', 'The expression ends too early'));
      if (t.num !== undefined) return t.num;
      if (t.op === '(') {
        const v = sum();
        if (!isOp(')')) throw new Error(T('Не закрыта скобка', 'A parenthesis is not closed'));
        pos++;
        return v;
      }
      if (t.op === '-') return -power();
      throw new Error(T('Неожиданный знак «' + t.op + '»', 'Unexpected sign “' + t.op + '”'));
    }
    function power() {
      const base = atom();
      if (!isOp('^')) return base;
      pos++;
      const exp = power();
      if (exp < 0n || exp > MAX_POWER) throw new Error(T('Степень должна быть от 0 до ' + MAX_POWER, 'The exponent must be between 0 and ' + MAX_POWER));
      return base ** exp;
    }
    function product() {
      let v = power();
      while (isOp('*') || isOp('/') || isOp('%')) {
        const o = tokens[pos++].op;
        const r = power();
        if (o === '*') v *= r;
        else {
          if (r === 0n) throw new Error(T('Деление на ноль', 'Division by zero'));
          if (o === '/' && v % r !== 0n) throw new Error(T('Деление нацело невозможно: ' + v + ' / ' + r, 'The division is not exact: ' + v + ' / ' + r));
          v = o === '/' ? v / r : ((v % r) + r) % r;
        }
      }
      return v;
    }
    function sum() {
      let v = product();
      while (isOp('+') || isOp('-')) v = tokens[pos++].op === '+' ? v + product() : v - product();
      return v;
    }
    const value = sum();
    if (pos < tokens.length) throw new Error(T('Лишнее после выражения: «' + tokens[pos].op + '»', 'Extra input after the expression: “' + tokens[pos].op + '”'));
    return value;
  }

  /** Простые множители числа пробным делением. */
  function factorize(n) {
    if (n < 2n) throw new Error(T('Раскладывать можно числа от 2', 'Only numbers from 2 can be factored'));
    const out = [];
    let rest = n;
    for (let d = 2n; d * d <= rest; d += d === 2n ? 1n : 2n) {
      if (d > MAX_FACTOR_TRIAL) throw new Error(T('Число слишком велико для пробного деления', 'The number is too large for trial division'));
      while (rest % d === 0n) { out.push(d); rest /= d; }
    }
    if (rest > 1n) out.push(rest);
    return out;
  }

  G.CipherOps.def({
    id: 'calc', name: T('Калькулятор (точная арифметика)', 'Calculator (exact arithmetic)'), cat: 'Текст', prior: 0,
    desc: T('Целые числа без округления: + − × ÷ % ^ и скобки. Режим «простые множители» показывает разложение — например, что 509, 503 и 3301 простые, а их произведение 845145127.',
      'Whole numbers with no rounding: + − × ÷ % ^ and parentheses. The “prime factors” mode shows the factorisation, for example that 509, 503 and 3301 are prime and their product is 845145127.'),
    params: [{ key: 'mode', label: T('Что показать', 'Show'), type: 'select', options: [['value', T('значение', 'value')], ['factors', T('простые множители', 'prime factors')]], default: 'value' }],
    run([t], p) {
      const value = evaluate(String(t));
      if (p.mode !== 'factors') return value.toString();
      const sign = value < 0n ? -1n : 1n;
      const parts = factorize(value * sign);
      return (sign < 0n ? '-' : '') + parts.join(' × ');
    },
  });

  G.CalcCases = { evaluate, factorize };
})(typeof self !== 'undefined' ? self : this);
