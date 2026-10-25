// Поиск кандидатов внутри длинного текста или лога: hex, base64, двоичные группы, ссылки, ID сервисов,
// координаты и ряды чисел. Каждый кандидат хранит исходный диапазон (start/end), строку и столбец,
// поэтому его можно вырезать, декодировать отдельно и вернуться к месту в журнале.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const MAX_CANDIDATES = 60;
  const HASH_LENGTHS = new Set([32, 40, 56, 64, 96, 128]);
  const KINDS = ['url', 'hex', 'hash', 'binary', 'id', 'base64', 'numbers', 'digits', 'coords'];

  const KIND_LABEL = () => ({
    url: T('ссылка', 'URL'), hex: 'HEX', hash: T('хеш?', 'hash?'), binary: T('двоичные группы', 'binary groups'), id: 'ID',
    base64: 'Base64', numbers: T('ряд чисел', 'number run'), digits: T('длинное число', 'long number'), coords: T('координаты', 'coordinates'),
  });

  // Регулярные выражения: границу слева проверяем группой (без lookbehind — старые браузеры).
  const RE = {
    url: /\b(?:https?|hxxps?|ftp):\/\/[^\s"'<>«»]+/gi,
    hexSpaced: /(^|[^0-9A-Za-z])((?:[0-9A-Fa-f]{2}[ :-]){3,}[0-9A-Fa-f]{2})(?![0-9A-Za-z])/g,
    hex: /(^|[^0-9A-Za-z])((?:0x)?[0-9A-Fa-f]{8,})(?![0-9A-Za-z])/g,
    binary: /(^|[^01])((?:[01]{8} ?){2,})(?![01])/g,
    base64: /(^|[^A-Za-z0-9+/_=-])([A-Za-z0-9+/_-]{16,}={0,2})(?![A-Za-z0-9+/_=-])/g,
    numbers: /(^|[^0-9])((?:\d{1,3}(?:[ ,;]+\r?\n?|\r?\n)){7,}\d{1,3})(?![0-9])/g,
    digits: /(^|[^0-9.])(\d{16,})(?![0-9.])/g,
    xyz: /\bx\s*[:=]?\s*-?\d+(?:\.\d+)?[\s,;]+y\s*[:=]?\s*-?\d+(?:\.\d+)?[\s,;]+z\s*[:=]?\s*-?\d+(?:\.\d+)?/gi,
    tp: /\/?tp\s+(?:@\w+\s+)?-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?/gi,
    degrees: /[-+]?\d{1,3}\.\d{3,}\s*[,;/ ]\s*[-+]?\d{1,3}\.\d{3,}/g,
    token: /[A-Za-z0-9_\-.]{5,64}/g,
  };

  function trimUrl(u) {
    let s = u.replace(/[.,;:!?\]}>'"]+$/, '');
    while (s.endsWith(')') && (s.match(/\(/g) || []).length < (s.match(/\)/g) || []).length) s = s.slice(0, -1);
    return s;
  }

  function lineStarts(text) {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\n') starts.push(i + 1);
      else if (text[i] === '\r' && text[i + 1] !== '\n') starts.push(i + 1);
    }
    return starts;
  }

  function position(starts, offset) {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= offset) lo = mid; else hi = mid - 1; }
    return { line: lo + 1, col: offset - starts[lo] + 1 };
  }

  const base64Like = (s) => {
    const body = s.replace(/=+$/, '');
    if (body.length % 4 === 1) return false;
    const classes = (/[a-z]/.test(body) ? 1 : 0) + (/[A-Z]/.test(body) ? 1 : 0) + (/[0-9]/.test(body) ? 1 : 0) + (/[+/_-]/.test(body) ? 1 : 0);
    // Одно слово из строчных букв — не Base64; нужна смесь классов или «=» на конце.
    return classes >= 2 || /=$/.test(s);
  };

  /**
   * Находит кандидатов в тексте.
   * @param {string} text
   * @param {{kinds?:string[], max?:number}} [opts]
   * @returns {Array<{kind:string, value:string, start:number, end:number, line:number, col:number, kindIndex:number, label:string, service?:string}>}
   */
  function extract(text, opts) {
    const src = String(text || '');
    const o = opts || {};
    const want = o.kinds && o.kinds.length ? new Set(o.kinds) : null;
    const max = o.max || MAX_CANDIDATES;
    const taken = [];
    const found = [];
    const free = (a, b) => !taken.some(([s, e]) => a < e && b > s);
    const labels = KIND_LABEL();
    const starts = lineStarts(src);
    const add = (kind, value, start, end, extra) => {
      if ((want && !want.has(kind)) || found.length >= max || !free(start, end)) return;
      taken.push([start, end]);
      found.push({ kind, value, start, end, ...position(starts, start), label: labels[kind], ...(extra || {}) });
    };
    const scan = (re, handler) => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src)) !== null) {
        handler(m);
        if (m[0].length === 0) re.lastIndex++;
      }
    };
    const grouped = (m) => ({ value: m[2], start: m.index + m[1].length, end: m.index + m[1].length + m[2].length });

    scan(RE.url, (m) => { const v = trimUrl(m[0]); add('url', v, m.index, m.index + v.length); });
    scan(RE.binary, (m) => { const g = grouped(m); add('binary', g.value.trim(), g.start, g.start + g.value.trim().length); });
    // Только цифры «27 12 12 15» — это десятичные числа, а не hex: нужна хотя бы одна буква a–f.
    scan(RE.hexSpaced, (m) => { const g = grouped(m); if (/[a-f]/i.test(g.value)) add('hex', g.value, g.start, g.end); });
    scan(RE.hex, (m) => {
      const g = grouped(m);
      const digits = g.value.replace(/^0x/i, '');
      if (digits.length % 2) return;
      if (HASH_LENGTHS.has(digits.length)) { add('hash', g.value, g.start, g.end); return; }
      // Короткие «hex-слова» (decade, facade) — частая случайность: нужна цифра или длина от 12.
      if (!/[0-9]/.test(digits) && digits.length < 12) return;
      add('hex', g.value, g.start, g.end);
    });
    // ID сервисов (YouTube, Drive, Catbox…) — по готовому детектору ссылок.
    if (G.Links) {
      scan(RE.token, (m) => {
        const tok = m[0].replace(/^[.\-]+|[.\-]+$/g, '');
        if (tok.length < 5) return;
        const hit = G.Links.detect(tok).find((l) => l.confidence >= 2 && l.id === tok);
        if (hit) add('id', tok, m.index, m.index + m[0].length, { service: hit.service });
      });
    }
    scan(RE.base64, (m) => { const g = grouped(m); if (base64Like(g.value)) add('base64', g.value, g.start, g.end); });
    scan(RE.numbers, (m) => { const g = grouped(m); add('numbers', g.value, g.start, g.end); });
    scan(RE.digits, (m) => { const g = grouped(m); add('digits', g.value, g.start, g.end); });
    for (const re of [RE.xyz, RE.tp, RE.degrees]) scan(re, (m) => add('coords', m[0], m.index, m.index + m[0].length));

    found.sort((a, b) => a.start - b.start);
    const counters = {};
    for (const c of found) { counters[c.kind] = (counters[c.kind] || 0) + 1; c.kindIndex = counters[c.kind]; }
    return found;
  }

  const describe = (c) => '[' + c.label + ' · ' + T('строка ', 'line ') + c.line + T(', столбец ', ', column ') + c.col + T(', символы ', ', chars ') + c.start + '–' + c.end + '] ' + c.value;

  G.CipherOps.def({
    id: 'extract_candidates', name: T('Найти кандидатов в тексте', 'Find candidates in text'), cat: 'Проверка', prior: 0,
    desc: T('Ищет внутри длинного текста или лога hex, Base64, двоичные группы, ссылки, ID сервисов, координаты и ряды чисел. «Номер» выбирает одного кандидата (для дальнейшей расшифровки); 0 показывает весь список с позициями в исходнике.', 'Finds hex, Base64, binary groups, links, service IDs, coordinates and number runs inside a long text or log. “Number” picks one candidate (for further decoding); 0 lists them all with positions in the source.'),
    params: [
      { key: 'kind', label: T('Тип', 'Kind'), type: 'select', options: [['any', T('Любой', 'Any')]].concat(KINDS.map((k) => [k, KIND_LABEL()[k]])), default: 'any' },
      { key: 'n', label: T('Номер (0 = список)', 'Number (0 = list)'), type: 'number', int: true, min: 0, max: MAX_CANDIDATES, default: 1 },
    ],
    run([t], p) {
      // Извлекаем все виды сразу (иначе перекрытия и номера «поплывут»), потом фильтруем.
      const list = extract(t).filter((c) => p.kind === 'any' || c.kind === p.kind);
      if (!list.length) throw new Error(T('Кандидатов не найдено', 'No candidates found'));
      const n = Number(p.n);
      if (n === 0) return list.map(describe).join('\n');
      const pick = list[n - 1];
      if (!pick) throw new Error(T('Кандидатов всего ' + list.length, 'There are only ' + list.length + ' candidates'));
      return pick.value;
    },
  });

  G.Candidates = { extract, describe, KINDS };
})(typeof self !== 'undefined' ? self : this);
