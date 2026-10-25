// Реестр операций: каждая операция — это нода-функция графа и «проба» для авто-расшифровки.
// run(inputs, params) получает массив входных строк и возвращает строку или бросает Error.
// probes(text, ctx) возвращает список наборов параметров для автоматического перебора
// (ctx = { depth, chain }). Операция может сообщить о потере данных через CipherOps.warn(текст):
// предупреждения собирает Graph.evaluate (результат ноды: res.warnings).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const C = G.Codec;
  const OPS = [];
  const BY_ID = {};
  const MAX_TEXT_PARAM = 2000000;

  function def(op) {
    op.inputs = op.inputs || [T('вход', 'input')];
    op.params = op.params || [];
    op.prior = op.prior || 0;
    OPS.push(op);
    BY_ID[op.id] = op;
  }

  // ---------- предупреждения ----------
  let sink = null;
  function warn(msg) { if (sink) sink.push(msg); }
  /** Выполняет fn и складывает все warn() в list. */
  function collectWarnings(list, fn) {
    const prev = sink;
    sink = list;
    try { return fn(); } finally { sink = prev; }
  }

  // ---------- параметр-ползунок (type: 'range') ----------
  /** Вспомогательные функции ползунка: границы и подпись значения с нужным числом знаков по шагу. */
  const RangeParam = {
    clamp: (n, min, max) => Math.min(max, Math.max(min, n)),
    decimals(step) {
      const s = String(step);
      const i = s.indexOf('.');
      return i < 0 ? 0 : Math.min(4, s.length - i - 1);
    },
    format(v, step) { return Number(v).toFixed(RangeParam.decimals(step)).replace(/^-/, '−'); },
  };
  G.RangeParam = RangeParam;

  // ---------- проверка параметров по схеме ----------
  /**
   * Приводит значения параметров к схеме (типы number/range/select/bool/text/textarea/hidden; range — как number с границами min/max).
   * Возвращает { values, problems }: values — безопасные значения (при ошибке берётся default),
   * problems — список { key, label, value, reason } для сообщения пользователю.
   */
  function normalizeParams(schema, values) {
    const src = values && typeof values === 'object' ? values : {};
    const out = Object.assign({}, src);
    const problems = [];
    const bad = (p, reason) => { problems.push({ key: p.key, label: p.label || p.key, value: src[p.key], reason }); out[p.key] = p.default; };
    for (const p of schema || []) {
      const v = src[p.key];
      if (v === undefined) { out[p.key] = p.default; continue; }
      if (p.type === 'number' || p.type === 'range') {
        const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
        if (!Number.isFinite(n)) bad(p, T('нужно конечное число', 'a finite number is required'));
        else if (p.int && !Number.isInteger(n)) bad(p, T('нужно целое число', 'an integer is required'));
        else if (p.min !== undefined && n < p.min) bad(p, T('не меньше ' + p.min, 'at least ' + p.min));
        else if (p.max !== undefined && n > p.max) bad(p, T('не больше ' + p.max, 'at most ' + p.max));
        else out[p.key] = n;
      } else if (p.type === 'select') {
        if (!(p.options || []).some((o) => String(o[0]) === String(v))) bad(p, T('такого варианта нет в списке', 'not one of the available options'));
        else out[p.key] = String(v);
      } else if (p.type === 'bool') {
        if (typeof v === 'boolean') out[p.key] = v;
        else if (v === 'true' || v === 1) out[p.key] = true;
        else if (v === 'false' || v === 0) out[p.key] = false;
        else bad(p, T('нужно да/нет', 'a yes/no value is required'));
      } else if (p.type === 'text' || p.type === 'textarea' || p.type === 'hidden') {
        if (typeof v === 'number' || typeof v === 'boolean') out[p.key] = String(v);
        else if (typeof v !== 'string') bad(p, T('нужна строка', 'a string is required'));
        else if (v.length > MAX_TEXT_PARAM) bad(p, T('слишком длинное значение', 'the value is too long'));
        else out[p.key] = v;
      }
    }
    return { values: out, problems };
  }

  function problemsText(problems) {
    return problems.map((x) => '«' + x.label + '»: ' + x.reason).join('; ');
  }

  /** Параметры операции для запуска: ошибка в параметре — понятное исключение, а не зависание. */
  function checkedParams(op, params) {
    const r = normalizeParams(op.params, params);
    if (r.problems.length) throw new Error(T('Неверный параметр ', 'Invalid parameter ') + problemsText(r.problems));
    return r.values;
  }

  const ENC_OPTIONS = [['utf8', 'UTF-8'], ['cp1251', 'CP1251 (Windows)'], ['koi8r', 'KOI8-R'], ['latin1', T('Байты как есть (0–255)', 'Bytes as is (0–255)')]];
  const ENC_TEXT = ENC_OPTIONS.slice(0, 3);
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const STRICT_PARAM = { key: 'strict', label: T('Строго (ошибка вместо предупреждения)', 'Strict (error instead of a warning)'), type: 'bool', default: false };

  const letterCount = (t) => (t.match(/[a-zа-яёіїєґ]/gi) || []).length;
  const hasLatin = (t) => /[a-z]/i.test(t);
  const hasCyr = (t) => /[а-яёіїєґ]/i.test(t);
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

  // Ключ берётся со второго входа, если он подключён, иначе из параметра.
  const keyOf = (inputs, p) => (inputs[1] !== undefined && inputs[1] !== null ? inputs[1] : p.key) || '';

  // Строгий режим бросает ошибку, мягкий — запоминает предупреждение и продолжает.
  function lenient(strict, msg) {
    if (strict) throw new Error(msg);
    warn(msg);
  }

  // Байты текста по явной кодировке: «Байты как есть» требует символов 0..255.
  const bytesOf = (t, enc) => C.encodeText(t, enc);
  // Вход байтовой операции → байтовая строка: файл-артефакт — его байты; «авто» — байтовая строка как есть
  // (после HEX/Base64), иначе UTF-8; явная кодировка — текст в этой кодировке. Общий для XOR, RC4, распаковки.
  function inputBytes(v, enc) {
    if (G.Artifacts && G.Artifacts.isHandle(v) && G.ArgFiles && G.ArgFiles.artifactBytes) return C.arrayToBin(G.ArgFiles.artifactBytes(v));
    const t = String(v === undefined || v === null ? '' : v);
    return !enc || enc === 'auto' ? C.toBytesAuto(t) : bytesOf(t, enc);
  }

  // ===================== Кодировки =====================
  def({
    id: 'hex_decode', name: T('HEX → байты', 'HEX → bytes'), cat: 'Кодировки', prior: 6,
    desc: T('Пары шестнадцатеричных цифр в байты: 54 30 39 → T09. Пробелы, 0x и запятые игнорируются.', 'Pairs of hexadecimal digits to bytes: 54 30 39 → T09. Spaces, 0x and commas are ignored.'),
    run([t]) {
      const clean = t.replace(/0x/gi, '').replace(/[\s,:;#-]/g, '');
      if (!/^[0-9a-f]*$/i.test(clean)) throw new Error(T('В строке есть не-hex символы', 'The string contains non-hex characters'));
      if (clean.length % 2) throw new Error(T('Нечётное число hex-цифр', 'Odd number of hex digits'));
      let out = '';
      for (let i = 0; i < clean.length; i += 2) out += String.fromCharCode(parseInt(clean.substr(i, 2), 16));
      return out;
    },
    probes(t) {
      const clean = t.replace(/0x/gi, '').replace(/[\s,:;-]/g, '');
      return clean.length >= 4 && clean.length % 2 === 0 && /^[0-9a-f]+$/i.test(clean) ? [{}] : [];
    },
  });

  def({
    id: 'hex_encode', name: T('Текст → HEX', 'Text → HEX'), cat: 'Кодировки', prior: 1,
    desc: T('Обратная сторона hex: каждый символ записывается кодом байта. Кодировка задаётся явно (UTF-8 по умолчанию).', 'The reverse of hex: every character is written as a byte code. The encoding is explicit (UTF-8 by default).'),
    params: [
      { key: 'enc', label: T('Кодировка', 'Encoding'), type: 'select', options: ENC_OPTIONS, default: 'utf8' },
      { key: 'sep', label: T('Разделитель', 'Separator'), type: 'text', default: ' ' },
    ],
    run([t], p) {
      return Array.from(bytesOf(t, p.enc), (ch) => ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join(p.sep);
    },
    // «Обратная сторона» hex имеет смысл для буквенных строк (как книга), не для цифр и мусора.
    probes(t, ctx) { return ctx.depth === 0 && t.length <= 64 && letterCount(t) >= t.replace(/\s/g, '').length * 0.8 ? [{ enc: 'utf8', sep: '' }] : []; },
  });

  // Проверка «хвостовых» битов Base64/Base32: в каноничной записи они нулевые.
  function base64Canon(s, strict) {
    const rest = s.length % 4;
    if (rest === 2 && (B64.indexOf(s[s.length - 1]) & 0x0f)) lenient(strict, T('Base64 неканоничный: хвостовые биты не нули и будут потеряны', 'Non-canonical Base64: trailing bits are not zero and are lost'));
    if (rest === 3 && (B64.indexOf(s[s.length - 1]) & 0x03)) lenient(strict, T('Base64 неканоничный: хвостовые биты не нули и будут потеряны', 'Non-canonical Base64: trailing bits are not zero and are lost'));
  }

  def({
    id: 'base64_decode', name: T('Base64 → байты', 'Base64 → bytes'), cat: 'Кодировки', prior: 4,
    desc: T('Стандартный и URL-safe Base64. Недостающие «=» дописываются; неканоничные хвостовые биты дают предупреждение (в строгом режиме — ошибку).', 'Standard and URL-safe Base64. Missing “=” are added; non-canonical trailing bits give a warning (an error in strict mode).'),
    params: [STRICT_PARAM],
    run([t], p) {
      let s = t.replace(/\s/g, '');
      if (/[+/]/.test(s) && /[-_]/.test(s)) lenient(p.strict, T('Смешаны алфавиты стандартного и URL-safe Base64', 'Standard and URL-safe Base64 alphabets are mixed'));
      s = s.replace(/-/g, '+').replace(/_/g, '/');
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error(T('Недопустимые для Base64 символы', 'Characters not allowed in Base64'));
      const hadPad = /=$/.test(s);
      s = s.replace(/=+$/, '');
      if (s.length % 4 === 1) throw new Error(T('Неверная длина Base64', 'Invalid Base64 length'));
      if (!hadPad && s.length % 4 && p.strict) throw new Error(T('Нет завершающих «=» (строгий режим)', 'Missing trailing “=” (strict mode)'));
      base64Canon(s, p.strict);
      s += '='.repeat((4 - (s.length % 4)) % 4);
      return atob(s);
    },
    probes(t) {
      const s = t.replace(/\s/g, '');
      // Короткий Base64 (U1RPUA = STOP) тоже пробуем: шум от обычных слов отсеивает скоринг, а не порог длины.
      if (s.length < 4 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(s) || s.replace(/=+$/, '').length % 4 === 1) return [];
      return s.length >= 8 || /=$/.test(s) || /[0-9+/]/.test(s) || /[a-z]/.test(s) && /[A-Z]/.test(s) ? [{}] : [];
    },
  });

  def({
    id: 'base64_encode', name: T('Текст → Base64', 'Text → Base64'), cat: 'Кодировки',
    params: [{ key: 'enc', label: T('Кодировка', 'Encoding'), type: 'select', options: ENC_OPTIONS, default: 'utf8' }],
    run([t], p) { return btoa(bytesOf(t, p.enc)); },
  });

  def({
    id: 'base32_decode', name: T('Base32 → байты', 'Base32 → bytes'), cat: 'Кодировки', prior: 1,
    desc: T('RFC 4648: A–Z и 2–7. Невозможная длина, «=» внутри строки и ненулевые хвостовые биты дают предупреждение (в строгом режиме — ошибку).', 'RFC 4648: A–Z and 2–7. An impossible length, “=” inside the string and non-zero trailing bits give a warning (an error in strict mode).'),
    params: [STRICT_PARAM],
    run([t], p) {
      let s = t.replace(/\s/g, '').toUpperCase();
      const body = s.replace(/=+$/, '');
      if (body.includes('=')) { lenient(p.strict, T('«=» внутри строки Base32 удалены', '“=” inside the Base32 string was removed')); }
      s = body.replace(/=/g, '');
      if (![0, 2, 4, 5, 7].includes(s.length % 8)) lenient(p.strict, T('Невозможная длина Base32 (' + s.length + ' символов): последние биты не образуют байт', 'Impossible Base32 length (' + s.length + ' characters): the last bits do not form a byte'));
      let bits = 0, value = 0, out = '';
      for (const ch of s) {
        const v = B32.indexOf(ch);
        if (v < 0) throw new Error(T('Символ «' + ch + '» не входит в Base32', 'Character “' + ch + '” is not in Base32'));
        value = ((value << 5) | v) & 0xffff;
        bits += 5;
        if (bits >= 8) { out += String.fromCharCode((value >>> (bits - 8)) & 255); bits -= 8; }
      }
      if (bits > 0 && (value & ((1 << bits) - 1))) lenient(p.strict, T('Base32 неканоничный: хвостовые биты не нули и будут потеряны', 'Non-canonical Base32: trailing bits are not zero and are lost'));
      return out;
    },
    probes(t) {
      const raw = t.replace(/\s/g, '');
      const s = raw.replace(/=+$/, '');
      if (!/^[A-Z2-7]+$/i.test(s) || /^[0-9]+$/.test(s) || ![0, 2, 4, 5, 7].includes(s.length % 8)) return [];
      // Короткий Base32 (KNKE6UA= = STOP) — только в одном регистре и с выравниванием до 8 или цифрами 2–7.
      return s.length >= 8 || ((/=$/.test(raw) || /[2-7]/.test(s)) && (s === s.toUpperCase() || s === s.toLowerCase())) ? [{}] : [];
    },
  });

  def({
    id: 'base32_encode', name: T('Текст → Base32', 'Text → Base32'), cat: 'Кодировки',
    params: [{ key: 'enc', label: T('Кодировка', 'Encoding'), type: 'select', options: ENC_OPTIONS, default: 'utf8' }],
    run([t], p) {
      const bin = bytesOf(t, p.enc);
      let bits = 0, value = 0, out = '';
      for (let i = 0; i < bin.length; i++) {
        value = ((value << 8) | bin.charCodeAt(i)) & 0xffffff;
        bits += 8;
        while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
      }
      if (bits > 0) out += B32[(value << (5 - bits)) & 31];
      return out;
    },
  });

  def({
    id: 'base58_decode', name: T('Base58 → байты', 'Base58 → bytes'), cat: 'Кодировки',
    desc: T('Алфавит Bitcoin (без 0, O, I, l).', 'The Bitcoin alphabet (no 0, O, I, l).'),
    run([t]) {
      const s = t.trim();
      let n = 0n;
      for (const ch of s) {
        const v = B58.indexOf(ch);
        if (v < 0) throw new Error(T('Символ «' + ch + '» не входит в Base58', 'Character “' + ch + '” is not in Base58'));
        n = n * 58n + BigInt(v);
      }
      let out = '';
      while (n > 0n) { out = String.fromCharCode(Number(n % 256n)) + out; n /= 256n; }
      for (const ch of s) { if (ch !== '1') break; out = '\0' + out; }
      return out;
    },
    probes(t) { return t.length >= 6 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(t) && /[a-z]/.test(t) && /[A-Z]/.test(t) ? [{}] : []; },
  });

  def({
    id: 'binary_decode', name: T('Двоичный → байты', 'Binary → bytes'), cat: 'Кодировки', prior: 2,
    desc: T('01001000 01101001 → Hi. Без пробелов режет по 8 (или 7) бит; неполный хвост отбрасывается с предупреждением (в строгом режиме — ошибка).', '01001000 01101001 → Hi. Without spaces it splits into 8 (or 7) bits; an incomplete tail is dropped with a warning (an error in strict mode).'),
    params: [
      { key: 'group', label: T('Группа бит', 'Bits per group'), type: 'select', options: [['8', T('8 бит (без пробелов)', '8 bits (when unspaced)')], ['7', T('7 бит (ASCII)', '7 bits (ASCII)')]], default: '8' },
      STRICT_PARAM,
    ],
    run([t], p) {
      const s = t.trim();
      const width = Number(p.group);
      let groups;
      if (/\s/.test(s)) groups = s.split(/\s+/);
      else {
        const full = Math.floor(s.length / width) * width;
        groups = full ? s.slice(0, full).match(new RegExp('.{' + width + '}', 'g')) : [];
        if (full < s.length) lenient(p.strict, T('Хвост из ' + (s.length - full) + ' бит не образует байт и отброшен: ' + s.slice(full), 'A tail of ' + (s.length - full) + ' bits does not form a byte and was dropped: ' + s.slice(full)));
      }
      return groups.map((g) => {
        if (!/^[01]+$/.test(g)) throw new Error(T('Группа «' + g + '» не двоичная', 'Group “' + g + '” is not binary'));
        if (g.length > 8) throw new Error(T('Группа «' + g + '» длиннее 8 бит', 'Group “' + g + '” is longer than 8 bits'));
        return String.fromCharCode(parseInt(g, 2));
      }).join('');
    },
    probes(t) { const s = t.replace(/\s/g, ''); return s.length >= 8 && /^[01]+$/.test(s) ? [{ group: '8' }] : []; },
  });

  def({
    id: 'binary_encode', name: T('Текст → двоичный', 'Text → binary'), cat: 'Кодировки',
    params: [{ key: 'enc', label: T('Кодировка', 'Encoding'), type: 'select', options: ENC_OPTIONS, default: 'utf8' }],
    run([t], p) { return Array.from(bytesOf(t, p.enc), (c) => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' '); },
  });

  // Разбивает строку чисел: по разделителям или фиксированной ширине.
  function splitNumbers(t, width) {
    const s = t.trim();
    if (width === 'sep' || (width === 'auto' && /[^0-9]/.test(s))) return s.split(/[^0-9]+/).filter(Boolean).map(Number);
    const w = width === 'auto' ? 2 : Number(width);
    if (!Number.isInteger(w) || w < 1) throw new Error(T('Ширина группы должна быть целым числом ≥ 1', 'The group width must be an integer ≥ 1'));
    if (!/^[0-9]+$/.test(s)) throw new Error(T('Ожидались только цифры', 'Only digits were expected'));
    if (s.length % w) throw new Error(T('Число цифр (' + s.length + ') не делится на ' + w, 'The number of digits (' + s.length + ') is not divisible by ' + w));
    const out = [];
    for (let i = 0; i < s.length; i += w) out.push(Number(s.substr(i, w)));
    return out;
  }

  def({
    id: 'dec_codes', name: T('Числа → символы', 'Numbers → characters'), cat: 'Кодировки', prior: 6,
    favorite: (p) => Math.abs(Number(p.shift)) === 23,
    desc: T('Десятичные коды в символы с прибавлением сдвига: пары цифр +23 → %CA%D2… .', 'Decimal codes to characters with a shift added: digit pairs +23 → %CA%D2… .'),
    params: [
      { key: 'width', label: T('Разбиение', 'Split'), type: 'select', options: [['auto', T('Авто', 'Auto')], ['sep', T('По разделителям', 'By separators')], ['2', T('По 2 цифры', '2 digits')], ['3', T('По 3 цифры', '3 digits')]], default: 'auto' },
      { key: 'shift', label: T('Прибавить', 'Add'), type: 'number', int: true, min: -1114111, max: 1114111, default: 0 },
    ],
    run([t], p) {
      return splitNumbers(t, p.width).map((n) => {
        const c = n + Number(p.shift);
        if (c < 0 || c > 0x10ffff) throw new Error(T('Код ' + c + ' вне диапазона', 'Code ' + c + ' is out of range'));
        return String.fromCodePoint(c);
      }).join('');
    },
    probes(t) {
      const s = t.trim();
      if (!/^[0-9\s,;.-]+$/.test(s) || s.replace(/\D/g, '').length < 4) return [];
      const res = [];
      const widths = /[^0-9]/.test(s) ? ['sep'] : ['2', '3'];
      const extra = ((G.Profiles && G.Profiles.active().probeShifts) || []).flatMap((n) => [n, -n]);
      const shifts = [...new Set([0, 32].concat(extra))];
      for (const width of widths) for (const shift of shifts) res.push({ width, shift });
      return res;
    },
  });

  def({
    id: 'text_to_codes', name: T('Символы → числа', 'Characters → numbers'), cat: 'Кодировки',
    params: [
      { key: 'shift', label: T('Вычесть', 'Subtract'), type: 'number', int: true, min: -1114111, max: 1114111, default: 0 },
      { key: 'sep', label: T('Разделитель', 'Separator'), type: 'text', default: ' ' },
    ],
    run([t], p) { return Array.from(t, (ch) => ch.codePointAt(0) - Number(p.shift)).join(p.sep); },
  });

  def({
    id: 'a1z26', name: T('Номера → буквы (A1Z26)', 'Numbers → letters (A1Z26)'), cat: 'Кодировки', prior: 3,
    desc: T('Номера букв в алфавите. Для русского учитывается Ё (33 буквы). Числа вне алфавита — ошибка; для циклического отображения есть «Числа → буквы (модуль)».', 'Letter numbers in the alphabet. Russian counts Ё (33 letters). Numbers outside the alphabet are an error; for wrap-around mapping use “Numbers → letters (modulo)”.'),
    params: [
      { key: 'alpha', label: T('Алфавит', 'Alphabet'), type: 'select', options: [['en', T('Латиница', 'Latin')], ['ru33', T('Кириллица 33', 'Cyrillic 33')], ['ru32', T('Кириллица 32', 'Cyrillic 32')], ['uk33', T('Украинский 33', 'Ukrainian 33')]], default: 'en' },
      { key: 'base', label: T('Первая буква =', 'First letter ='), type: 'number', int: true, min: 0, max: 100, default: 1 },
      { key: 'width', label: T('Разбиение', 'Split'), type: 'select', options: [['sep', T('По разделителям', 'By separators')], ['2', T('По 2 цифры', '2 digits')]], default: 'sep' },
    ],
    run([t], p) {
      const alpha = C.ALPHABETS[p.alpha];
      return splitNumbers(t, p.width).map((n) => {
        const ch = alpha[n - Number(p.base)];
        if (!ch) throw new Error(T('Номер ' + n + ' больше длины алфавита', 'Number ' + n + ' is beyond the alphabet length'));
        return ch;
      }).join('');
    },
    probes(t) {
      const s = t.trim();
      if (!/^[0-9\s,;.-]+$/.test(s)) return [];
      const width = /[^0-9]/.test(s) ? 'sep' : '2';
      return [{ alpha: 'en', base: 1, width }, { alpha: 'ru33', base: 1, width }, { alpha: 'en', base: 0, width }];
    },
  });

  def({
    id: 'letters_to_numbers', name: T('Буквы → номера', 'Letters → numbers'), cat: 'Кодировки',
    params: [
      { key: 'alpha', label: T('Алфавит', 'Alphabet'), type: 'select', options: [['en', T('Латиница', 'Latin')], ['ru33', T('Кириллица 33', 'Cyrillic 33')], ['ru32', T('Кириллица 32', 'Cyrillic 32')], ['uk33', T('Украинский 33', 'Ukrainian 33')]], default: 'en' },
      { key: 'base', label: T('Первая буква =', 'First letter ='), type: 'number', int: true, min: 0, max: 100, default: 1 },
    ],
    run([t], p) {
      const alpha = C.ALPHABETS[p.alpha];
      return Array.from(t.toLowerCase()).map((ch) => alpha.indexOf(ch)).filter((i) => i >= 0).map((i) => i + Number(p.base)).join(' ');
    },
  });

  def({
    id: 'url_decode', name: T('URL-декодирование (%HH)', 'URL decoding (%HH)'), cat: 'Кодировки', prior: 6,
    desc: T('%CA%D2%CE → КТО (CP1251) или UTF-8. Плюс можно считать пробелом.', '%CA%D2%CE → КТО (CP1251) or UTF-8. A plus sign can be treated as a space.'),
    params: [
      { key: 'enc', label: T('Кодировка', 'Encoding'), type: 'select', options: ENC_TEXT, default: 'utf8' },
      { key: 'plus', label: T('«+» = пробел', '“+” = space'), type: 'bool', default: true },
    ],
    run([t], p) {
      const src = p.plus ? t.replace(/\+/g, ' ') : t;
      let decodedAny = false;
      const out = src.replace(/(%[0-9a-f]{2})+/gi, (m) => {
        const bin = m.split('%').slice(1).map((h) => String.fromCharCode(parseInt(h, 16))).join('');
        // Неверный UTF-8 в одном куске не должен ломать остальные — оставляем кусок как есть.
        try { const r = C.decodeBytes(bin, p.enc); decodedAny = true; return r; } catch (e) { return m; }
      });
      if (!decodedAny && /%[0-9a-f]{2}/i.test(src)) throw new Error(T('Байты не являются корректной записью ' + p.enc, 'The bytes are not a valid ' + p.enc + ' sequence'));
      return out;
    },
    probes(t) { return /%[0-9a-f]{2}/i.test(t) ? [{ enc: 'utf8', plus: true }, { enc: 'cp1251', plus: true }] : []; },
  });

  def({
    id: 'url_encode', name: T('URL-кодирование', 'URL encoding'), cat: 'Кодировки',
    params: [{ key: 'enc', label: T('Кодировка', 'Encoding'), type: 'select', options: ENC_OPTIONS, default: 'utf8' }],
    run([t], p) {
      const bin = bytesOf(t, p.enc);
      return Array.from(bin, (ch) => (/[A-Za-z0-9._~-]/.test(ch) ? ch : '%' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))).join('');
    },
  });

  def({
    id: 'bytes_decode', name: T('Байты → текст', 'Bytes → text'), cat: 'Кодировки', prior: 3,
    desc: T('Прочитать байты как UTF-8 / CP1251 / KOI8-R (например, после Base64 или HEX).', 'Read bytes as UTF-8 / CP1251 / KOI8-R (for example after Base64 or HEX).'),
    params: [{ key: 'enc', label: T('Кодировка', 'Encoding'), type: 'select', options: ENC_TEXT, default: 'utf8' }],
    run([t], p) {
      for (let i = 0; i < t.length; i++) if (t.charCodeAt(i) > 255) throw new Error(T('Вход уже текст, а не байты', 'The input is already text, not bytes'));
      return C.decodeBytes(t, p.enc);
    },
    probes(t) {
      if (!/[\x80-\xff]/.test(t) || /[^\x00-\xff]/.test(t)) return [];
      return [{ enc: 'utf8' }, { enc: 'cp1251' }, { enc: 'koi8r' }];
    },
  });

  def({
    id: 'text_encode', name: T('Текст → байты', 'Text → bytes'), cat: 'Кодировки',
    params: [{ key: 'enc', label: T('Кодировка', 'Encoding'), type: 'select', options: ENC_OPTIONS, default: 'utf8' }],
    run([t], p) { return C.encodeText(t, p.enc); },
  });

  def({
    id: 'morse_decode', name: T('Морзе → текст', 'Morse → text'), cat: 'Кодировки', prior: 2,
    desc: T('Буквы через пробел, слова через «/» или три пробела. Понимает · и −.', 'Letters separated by spaces, words by “/” or three spaces. Understands · and −.'),
    params: [{ key: 'lang', label: T('Язык', 'Language'), type: 'select', options: [['en', T('Латиница', 'Latin')], ['ru', T('Кириллица', 'Cyrillic')]], default: 'en' }],
    run([t], p) {
      const norm = t.replace(/[·•]/g, '.').replace(/[−–—_]/g, '-').trim();
      const dict = C.MORSE_DEC[p.lang];
      return norm.split(/\s*\/\s*|\s{3,}/).map((word) => word.split(/\s+/).filter(Boolean).map((code) => {
        if (!dict.has(code)) throw new Error(T('Неизвестный код Морзе «' + code + '»', 'Unknown Morse code “' + code + '”'));
        return dict.get(code);
      }).join('')).join(' ');
    },
    probes(t) { return /^[.\-·•−–—_\s/]+$/.test(t.trim()) && /[.·•]/.test(t) ? [{ lang: 'en' }, { lang: 'ru' }] : []; },
  });

  def({
    id: 'morse_encode', name: T('Текст → Морзе', 'Text → Morse'), cat: 'Кодировки',
    params: [{ key: 'lang', label: T('Язык', 'Language'), type: 'select', options: [['en', T('Латиница', 'Latin')], ['ru', T('Кириллица', 'Cyrillic')]], default: 'en' }],
    run([t], p) {
      const dict = C.MORSE_ENC[p.lang];
      return t.toLowerCase().split(/\s+/).map((w) => Array.from(w).map((ch) => dict[ch] || '?').join(' ')).join(' / ');
    },
  });

  def({
    id: 'base_convert', name: T('Число: основание → основание', 'Number: base → base'), cat: 'Кодировки',
    desc: T('Перевод целого числа, например десятичное 836 → hex 344.', 'Convert an integer, for example decimal 836 → hex 344.'),
    params: [
      { key: 'from', label: T('Из основания', 'From base'), type: 'number', int: true, min: 2, max: 36, default: 10 },
      { key: 'to', label: T('В основание', 'To base'), type: 'number', int: true, min: 2, max: 36, default: 16 },
    ],
    run([t], p) {
      const from = Number(p.from), to = Number(p.to);
      if (from < 2 || from > 36 || to < 2 || to > 36) throw new Error(T('Основание должно быть от 2 до 36', 'The base must be between 2 and 36'));
      const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
      let n = 0n;
      for (const ch of t.trim().toLowerCase()) {
        const v = digits.indexOf(ch);
        if (v < 0 || v >= from) throw new Error(T('Цифра «' + ch + '» не подходит для основания ' + from, 'Digit “' + ch + '” does not fit base ' + from));
        n = n * BigInt(from) + BigInt(v);
      }
      if (n === 0n) return '0';
      let out = '';
      while (n > 0n) { out = digits[Number(n % BigInt(to))] + out; n /= BigInt(to); }
      return out;
    },
  });

  G.CipherOps = {
    OPS, BY_ID, def, keyOf, letterCount, hasLatin, hasCyr, range, warn, collectWarnings, lenient,
    normalizeParams, checkedParams, problemsText, splitNumbers, bytesOf, inputBytes, ENC_OPTIONS, ENC_TEXT, STRICT_PARAM,
  };
})(typeof self !== 'undefined' ? self : this);
