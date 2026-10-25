// Помощники для ARG: проверка и подбор анаграмм, XOR с пропуском знаков, наложение двух текстов,
// выбор букв по индексам/регистру/отметке, порядок позывных. Фонетические слова берутся из ops-glyphs.js (G.Phonetic).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const C = G.Codec;
  const { def, keyOf } = G.CipherOps;

  const fail = (ru, en) => { throw new Error(T(ru, en)); };
  const LETTER = /\p{L}/u;
  const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
  const second = (inputs, p, key) => (inputs[1] !== undefined && inputs[1] !== null ? inputs[1] : p[key]) || '';

  // ===================== Анаграммы: проверка =====================
  function letterCounts(text) {
    const counts = new Map();
    for (const ch of text.toLowerCase()) {
      if (LETTER_OR_DIGIT.test(ch)) counts.set(ch, (counts.get(ch) || 0) + 1);
    }
    return counts;
  }

  // Что есть в a сверх b: Map знак → сколько лишних.
  function surplus(a, b) {
    const out = new Map();
    for (const [ch, n] of a) if (n > (b.get(ch) || 0)) out.set(ch, n - (b.get(ch) || 0));
    return out;
  }

  const showCounts = (m) => (m.size ? Array.from(m, ([ch, n]) => (n > 1 ? ch + '×' + n : ch)).join(' ') : '—');
  const total = (m) => Array.from(m.values()).reduce((s, n) => s + n, 0);

  def({
    id: 'anagram_check', name: T('Анаграммы: сверка двух текстов', 'Anagram check: two texts'), cat: 'Проверка', prior: 0, inputs: [T('текст A', 'text A'), T('текст B', 'text B')],
    desc: T('Сравнивает наборы букв/цифр двух строк без учёта регистра и пробелов и показывает лишние и недостающие. «D I E L N I A I W R M R S» и «MILNER IS WARD» — в A лишняя I.',
      'Compares the letter/digit multisets of two strings ignoring case and spaces and shows the extra and missing ones. “D I E L N I A I W R M R S” vs “MILNER IS WARD”: A has one extra I.'),
    params: [{ key: 'other', label: T('Текст B (если не подключён)', 'Text B (if not connected)'), type: 'text', default: '' }],
    run(inputs, p) {
      const a = letterCounts(inputs[0]);
      const b = letterCounts(second(inputs, p, 'other'));
      const extra = surplus(a, b);
      const missing = surplus(b, a);
      const same = !extra.size && !missing.size;
      return [
        T('Анаграммы: ', 'Anagram: ') + (same ? T('да', 'yes') : T('нет', 'no')),
        'A: ' + total(a) + T(' зн.', ' chars') + ', B: ' + total(b) + T(' зн.', ' chars'),
        T('Лишние в A (нет в B): ', 'Extra in A (not in B): ') + showCounts(extra),
        T('Не хватает в A (есть в B): ', 'Missing in A (present in B): ') + showCounts(missing),
      ].join('\n');
    },
  });

  // ===================== Анаграммы: подбор слов =====================
  const MAX_ANAGRAM_LETTERS = 16;
  const MAX_STEPS = 400000;

  function wordList(lang) {
    if (G.Scorer && G.Scorer.init) G.Scorer.init();
    const model = G.Scorer && G.Scorer.MODELS && G.Scorer.MODELS[lang];
    if (!model || !model.words) fail('Словарь «' + lang + '» недоступен', 'The “' + lang + '” word list is not available');
    return Array.from(model.words);
  }

  const toCounts = (chars) => { const m = new Map(); for (const ch of chars) m.set(ch, (m.get(ch) || 0) + 1); return m; };
  const fits = (word, left) => { const need = toCounts(word); for (const [ch, n] of need) if ((left.get(ch) || 0) < n) return false; return true; };

  function solveAnagram(letters, words, o) {
    const left = toCounts(letters);
    const n = letters.length;
    const cand = words.map((w, rank) => ({ w, rank, len: Array.from(w).length }))
      .filter((c) => c.len >= o.minLen && c.len <= n && fits(c.w, left));
    const results = [];
    let steps = 0;
    const dfs = (rest, restLen, start, picked) => {
      if (steps++ > MAX_STEPS || results.length >= o.limit * 20) return;
      if (restLen === 0) { results.push(picked.slice()); return; }
      if (picked.length >= o.maxWords) return;
      const last = picked.length === o.maxWords - 1;
      for (let i = start; i < cand.length; i++) {
        const c = cand[i];
        if (c.len > restLen || (last && c.len !== restLen) || !fits(c.w, rest)) continue;
        const next = new Map(rest);
        for (const ch of c.w) next.set(ch, next.get(ch) - 1);
        picked.push(c);
        dfs(next, restLen - c.len, i, picked);
        picked.pop();
      }
    };
    dfs(left, n, 0, []);
    return results
      .map((r) => ({ text: r.map((c) => c.w).join(' '), words: r.length, rank: r.reduce((s, c) => s + c.rank, 0) }))
      .sort((x, y) => x.words - y.words || x.rank - y.rank)
      .slice(0, o.limit)
      .map((r) => r.text);
  }

  def({
    id: 'anagram_solve', name: T('Анаграммы: подбор слов', 'Anagram solver'), cat: 'Текст', prior: 0,
    desc: T('Ищет слова (и пары/тройки слов), составленные из всех букв входа, по встроенному словарю частотных слов. Только для коротких строк (до ' + MAX_ANAGRAM_LETTERS + ' букв).',
      'Looks for words (and pairs/triples of words) that use all input letters, from the built-in frequent-word list. Short strings only (up to ' + MAX_ANAGRAM_LETTERS + ' letters).'),
    params: [
      { key: 'lang', label: T('Словарь', 'Word list'), type: 'select', options: [['auto', T('Авто', 'Auto')], ['en', 'English'], ['ru', 'Русский']], default: 'auto' }, // i18n-ok: данные
      { key: 'maxWords', label: T('Слов не больше', 'Max words'), type: 'number', default: 2 },
      { key: 'minLen', label: T('Мин. длина слова', 'Min word length'), type: 'number', default: 2 },
      { key: 'limit', label: T('Показать вариантов', 'Results to show'), type: 'number', default: 30 },
    ],
    run([t], p) {
      const letters = Array.from(t.toLowerCase()).filter((ch) => LETTER.test(ch));
      if (!letters.length) fail('В тексте нет букв', 'The text has no letters');
      if (letters.length > MAX_ANAGRAM_LETTERS) fail('Слишком длинно: ' + letters.length + ' > ' + MAX_ANAGRAM_LETTERS + ' букв', 'Too long: ' + letters.length + ' > ' + MAX_ANAGRAM_LETTERS + ' letters');
      const lang = p.lang === 'auto' ? (/[а-яё]/.test(letters.join('')) ? 'ru' : 'en') : p.lang;
      const found = solveAnagram(letters, wordList(lang), {
        maxWords: Math.min(3, Math.max(1, Math.floor(Number(p.maxWords)) || 1)),
        minLen: Math.max(1, Math.floor(Number(p.minLen)) || 1),
        limit: Math.max(1, Math.floor(Number(p.limit)) || 30),
      });
      if (!found.length) fail('В словаре нет подходящих слов', 'No matching words in the list');
      return found.join('\n');
    },
  });

  // ===================== XOR с пропуском знаков =====================
  const KEEP_RULES = {
    space: (ch) => /\s/.test(ch),
    // Для байтовых строк: не трогать только пробелы, точки и запятые (буквы после XOR сами похожи на знаки: l^23 = «{»).
    asciipunct: (ch) => /[\s.,]/.test(ch),
    nonalnum: (ch) => !LETTER_OR_DIGIT.test(ch),
    nonletter: (ch) => !LETTER.test(ch),
    none: () => false,
  };

  // Тот же разбор ключа, что у обычного XOR: «bad» как число — ошибка, нечётный HEX — предупреждение или ошибка в строгом режиме.
  function xorKeyBytes(raw, p) {
    const key = G.CipherOps.xorKey(String(raw), p, 'auto');
    if (!key.length) fail('Пустой ключ XOR', 'Empty XOR key');
    return key;
  }

  def({
    id: 'xor_keep', name: T('XOR с пропуском пробелов и знаков', 'XOR keeping spaces/punctuation'), cat: 'Шифры с ключом', prior: 0, inputs: [T('вход', 'input'), T('ключ', 'key')],
    desc: T('XOR только тех символов, что не попали под правило «оставить как есть» (пробелы, знаки, не-буквы). Можно решить, тратят ли оставленные знаки позицию ключа.',
      'XORs only the characters that are not covered by the “keep as is” rule (spaces, punctuation, non-letters). You can choose whether kept characters consume a key position.'),
    params: [
      { key: 'key', label: T('Ключ', 'Key'), type: 'text', default: '23' },
      { key: 'fmt', label: T('Формат ключа', 'Key format'), type: 'select', options: [['num', T('Число', 'Number')], ['text', T('Текст', 'Text')], ['hex', 'HEX']], default: 'num' },
      { key: 'keep', label: T('Не трогать', 'Keep as is'), type: 'select', options: [['space', T('Пробельные', 'Whitespace')], ['nonalnum', T('Пробелы и знаки', 'Spaces and punctuation')], ['asciipunct', T('Пробелы, точки и запятые (для байтов)', 'Spaces, dots and commas (for bytes)')], ['nonletter', T('Всё кроме букв', 'Everything except letters')], ['none', T('Ничего', 'Nothing')]], default: 'nonalnum' },
      { key: 'consume', label: T('Оставленные знаки двигают ключ', 'Kept characters advance the key'), type: 'bool', default: false },
      G.CipherOps.STRICT_PARAM,
    ],
    run(inputs, p) {
      const key = xorKeyBytes(keyOf(inputs, p), p);
      const keep = KEEP_RULES[p.keep];
      let pos = 0;
      return Array.from(inputs[0]).map((ch) => {
        if (keep(ch)) { if (p.consume) pos++; return ch; }
        const c = ch.codePointAt(0);
        if (c > 255) fail('Символ «' + ch + '» вне диапазона байта: сначала переведите текст в байты', 'Character “' + ch + '” is outside a byte: convert the text to bytes first');
        return String.fromCharCode(c ^ key[pos++ % key.length]);
      }).join('');
    },
    // Авто-поиск: только сырые байты (после HEX/Base64), где обычный XOR портит пробелы и точки.
    probes(t) {
      if (t.length < 3 || !/[\u0080-ÿ]/.test(t) || /[^\u0000-ÿ]/.test(t) || !/[ .,]/.test(t)) return [];
      return [23, 32, 1, 7, 13, 42, 64, 127].map((n) => ({ key: String(n), fmt: 'num', keep: 'asciipunct' }));
    },
  });

  // ===================== Наложение двух текстов =====================
  def({
    id: 'overlay_fill', name: T('Наложение: заполнить # из второго текста', 'Overlay: fill # from the second text'), cat: 'Объединение', prior: 0, inputs: [T('шаблон A', 'template A'), T('текст B', 'text B')],
    desc: T('Знаки-заполнители в A (по умолчанию #) заменяются символами из B: по очереди либо по той же позиции. «H#LL#» + «EO» → HELLO.',
      'Placeholders in A (default #) are replaced with characters from B: in turn or at the same position. “H#LL#” + “EO” → HELLO.'),
    params: [
      { key: 'mark', label: T('Заполнитель', 'Placeholder'), type: 'text', default: '#' },
      { key: 'mode', label: T('Откуда брать', 'Take from B'), type: 'select', options: [['seq', T('По очереди', 'In turn')], ['pos', T('С той же позиции', 'Same position')]], default: 'seq' },
      { key: 'other', label: T('Текст B (если не подключён)', 'Text B (if not connected)'), type: 'text', default: '' },
    ],
    run(inputs, p) {
      const mark = Array.from(p.mark || '#')[0];
      const b = Array.from(second(inputs, p, 'other'));
      let n = 0;
      const out = Array.from(inputs[0]).map((ch, i) => {
        if (ch !== mark) return ch;
        const fill = p.mode === 'pos' ? b[i] : b[n++];
        return fill === undefined || (p.mode === 'pos' && fill === mark) ? ch : fill;
      });
      return out.join('');
    },
  });

  // ===================== Выбор букв =====================
  // Список позиций «1,3,5-8,-1»; отрицательные считаются с конца. Возвращает индексы с нуля.
  function parseIndices(spec, base, length) {
    const out = [];
    for (const token of String(spec).split(/[,;\s]+/).filter(Boolean)) {
      const m = /^(-?\d+)(?:(?:\.\.|-)(-?\d+))?$/.exec(token);
      if (!m) fail('Не понял позицию «' + token + '»', 'Cannot read position “' + token + '”');
      const resolve = (v) => (Number(v) < 0 ? length + Number(v) : Number(v) - base);
      const a = resolve(m[1]);
      const b = m[2] === undefined ? a : resolve(m[2]);
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (i >= 0 && i < length) out.push(i);
    }
    return out;
  }

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function markPair(mark) {
    if (mark.includes('|')) { const [a, b] = mark.split('|'); return [a, b || a]; }
    const chars = Array.from(mark);
    return chars.length === 2 ? chars : [mark, mark];
  }

  function pickByIndex(text, p) {
    const base = Number(p.base) === 0 ? 0 : 1;
    const takeFrom = (piece) => {
      const chars = Array.from(piece).filter((ch) => (p.count === 'letters' ? LETTER_OR_DIGIT.test(ch) : !/\s/.test(ch)));
      return parseIndices(p.indices, base, chars.length).map((i) => chars[i]).join('');
    };
    if (p.scope === 'word') return text.split(/\s+/).filter(Boolean).map(takeFrom).join(p.joiner);
    if (p.scope === 'line') return text.split(/\r?\n/).map(takeFrom).join(p.joiner);
    return takeFrom(text);
  }

  function pickByMark(text, p) {
    if (!p.mark) fail('Укажите отметку', 'Specify the mark');
    if (p.mode === 'marked') {
      const [open, close] = markPair(p.mark);
      const re = new RegExp(escapeRe(open) + '([\\s\\S]*?)' + escapeRe(close), 'g');
      return Array.from(text.matchAll(re), (m) => m[1]).join(p.joiner);
    }
    const re = new RegExp(p.mode === 'after_mark' ? escapeRe(p.mark) + '(\\P{M}\\p{M}*)' : '(\\P{M}\\p{M}*)' + escapeRe(p.mark), 'gu');
    return Array.from(text.matchAll(re), (m) => m[1]).join(p.joiner);
  }

  def({
    id: 'pick_letters', name: T('Выбрать буквы (позиции, ЗАГЛАВНЫЕ, отметка)', 'Pick letters (positions, UPPERCASE, mark)'), cat: 'Текст', prior: 0,
    desc: T('Достаёт знаки по списку позиций (1,3,5-8,-1) во всём тексте / в каждом слове / в каждой строке; только ЗАГЛАВНЫЕ или цифры; заключённые в отметку (*x*, [x]); стоящие после или перед отметкой.',
      'Extracts characters by a position list (1,3,5-8,-1) in the whole text / each word / each line; only UPPERCASE letters or digits; those enclosed in a mark (*x*, [x]); those right after or before a mark.'),
    params: [
      { key: 'mode', label: T('Что выбрать', 'What to pick'), type: 'select', options: [['index', T('По позициям', 'By positions')], ['upper', T('Только ЗАГЛАВНЫЕ', 'Only UPPERCASE')], ['digits', T('Только цифры', 'Only digits')], ['marked', T('Внутри отметки', 'Inside a mark')], ['after_mark', T('После отметки', 'After a mark')], ['before_mark', T('Перед отметкой', 'Before a mark')]], default: 'index' },
      { key: 'indices', label: T('Позиции', 'Positions'), type: 'text', default: '1' },
      { key: 'base', label: T('Первая позиция =', 'First position ='), type: 'number', default: 1 },
      { key: 'scope', label: T('Область', 'Scope'), type: 'select', options: [['all', T('Весь текст', 'Whole text')], ['word', T('Каждое слово', 'Each word')], ['line', T('Каждая строка', 'Each line')]], default: 'all' },
      { key: 'count', label: T('Считать', 'Count'), type: 'select', options: [['letters', T('Буквы и цифры', 'Letters and digits')], ['chars', T('Все знаки кроме пробелов', 'All non-space characters')]], default: 'letters' },
      { key: 'mark', label: T('Отметка (для «[|]» или «*»)', 'Mark (e.g. “[|]” or “*”)'), type: 'text', default: '*' },
      { key: 'joiner', label: T('Склеивать через', 'Join with'), type: 'text', default: '' },
    ],
    run([t], p) {
      let out;
      if (p.mode === 'index') out = pickByIndex(t, p);
      else if (p.mode === 'upper') out = Array.from(t).filter((ch) => /\p{Lu}/u.test(ch)).join(p.joiner);
      else if (p.mode === 'digits') out = Array.from(t).filter((ch) => /\p{Nd}/u.test(ch)).join(p.joiner);
      else out = pickByMark(t, p);
      if (!out) fail('Ничего не выбрано', 'Nothing was picked');
      return out;
    },
  });

  // ===================== Порядок позывных =====================
  def({
    id: 'callsign_order', name: T('Позывные по алфавиту (Able…Jig / НАТО)', 'Callsigns by alphabet (Able…Jig / NATO)'), cat: 'Текст', prior: 0,
    desc: T('Строки вида «Charlie 3», «Able 7», «Baker-2» сортируются по порядку фонетических слов (Able, Baker, Charlie… или Alfa, Bravo, Charlie…), а числа в конце строк склеиваются.',
      'Lines like “Charlie 3”, “Able 7”, “Baker-2” are sorted by phonetic word order (Able, Baker, Charlie… or Alfa, Bravo, Charlie…) and the trailing numbers are concatenated.'),
    params: [{ key: 'out', label: T('Результат', 'Output'), type: 'select', options: [['digits', T('Склеенные числа', 'Concatenated numbers')], ['lines', T('Отсортированные строки', 'Sorted lines')], ['both', T('Строки и числа', 'Lines and numbers')]], default: 'digits' }],
    run([t], p) {
      const P = G.Phonetic;
      if (!P) fail('Нужен файл ops-glyphs.js', 'ops-glyphs.js is required');
      const rows = t.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, order) => {
        const word = (P.normalizeWords(line).match(/[a-z]+/g) || []).find((w) => P.WORD_INDEX.has(w));
        if (word === undefined) fail('В строке «' + line + '» нет слова фонетического алфавита', 'No phonetic-alphabet word in the line “' + line + '”');
        const digits = /(\d+)\s*$/.exec(line);
        return { line, order, key: P.WORD_INDEX.get(word), digits: digits ? digits[1] : '' };
      }).sort((a, b) => a.key - b.key || a.order - b.order);
      if (!rows.length) fail('Нет строк', 'No lines');
      const digits = rows.map((r) => r.digits).join('');
      const lines = rows.map((r) => r.line).join('\n');
      return p.out === 'lines' ? lines : p.out === 'both' ? lines + '\n\n' + digits : digits;
    },
  });

  G.ArgTools = { letterCounts, surplus, solveAnagram, parseIndices };
})(typeof self !== 'undefined' ? self : this);
