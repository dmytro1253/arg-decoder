// Скрытые слои и выборки: похожие буквы (кириллица/латиница), символы нулевой ширины,
// экранирование, акростих, поворот сетки, книжный шифр, коды форматирования Minecraft.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const { def, hasLatin, hasCyr } = G.CipherOps;
  const NEWLINE = /\r\n|\r|\n/;

  // Кириллица, которая выглядит как латиница.
  const HOMO_CYR = 'АВЕКМНОРСТХаеорсухіјѕԁԛԝ'; // i18n-ok: данные
  const HOMO_LAT = 'ABEKMHOPCTXaeopcyxijsdqw';
  const CYR_RUN = /[а-яёіїєґјѕԁԛԝ]/i;
  G.GlyphTables = Object.assign(G.GlyphTables || {}, { homoglyph: { cyr: HOMO_CYR, lat: HOMO_LAT } }); // для клавиатуры двойников

  def({
    id: 'homoglyph', name: T('Похожие буквы (кир ↔ лат)', 'Look-alike letters (Cyr ↔ Lat)'), cat: 'Скрытое', prior: 3,
    desc: T('В «латинском» тексте могут прятаться кириллические А, Е, О, Р, С… Можно заменить их или вытащить как биты: латиница = 0, кириллица = 1.', 'Cyrillic А, Е, О, Р, С… may hide in “Latin” text. Replace them or extract bits: Latin = 0, Cyrillic = 1.'),
    params: [{ key: 'mode', label: T('Режим', 'Mode'), type: 'select', options: [['tolat', T('Кириллицу-двойники → латиница', 'Cyrillic look-alikes → Latin')], ['tocyr', T('Латиницу-двойники → кириллица', 'Latin look-alikes → Cyrillic')], ['bits', T('Биты: лат = 0, кир = 1', 'Bits: Lat = 0, Cyr = 1')], ['mark', T('Подсветить: кириллица в [скобках]', 'Highlight: Cyrillic in [brackets]')]], default: 'tolat' }],
    run([t], p) {
      if (p.mode === 'bits') {
        let bits = '';
        for (const ch of t) { if (/[a-z]/i.test(ch)) bits += '0'; else if (CYR_RUN.test(ch)) bits += '1'; }
        return bits;
      }
      if (p.mode === 'mark') return t.replace(/[а-яёіїєґјѕԁԛԝ]+/gi, (m) => '[' + m + ']');
      const [from, to] = p.mode === 'tolat' ? [HOMO_CYR, HOMO_LAT] : [HOMO_LAT, HOMO_CYR];
      return Array.from(t, (ch) => { const i = from.indexOf(ch); return i >= 0 ? to[i] : ch; }).join('');
    },
    probes(t) {
      if (!(hasLatin(t) && hasCyr(t))) return [];
      return [{ mode: 'tolat' }, { mode: 'tocyr' }, { mode: 'bits' }];
    },
  });

  const ZW = /[​‌‍⁠﻿᠎]/g;
  const HAS_ZW = /[​‌‍⁠﻿᠎]/;
  def({
    id: 'zero_width', name: T('Символы нулевой ширины', 'Zero-width characters'), cat: 'Скрытое', prior: 3,
    desc: T('Невидимые U+200B/200C/200D/FEFF в описаниях. Можно показать, удалить или превратить в биты.', 'Invisible U+200B/200C/200D/FEFF in descriptions. Show them, remove them or turn them into bits.'),
    params: [{ key: 'mode', label: T('Режим', 'Mode'), type: 'select', options: [['bits', T('Биты: 200B = 0, 200C = 1', 'Bits: 200B = 0, 200C = 1')], ['bits2', T('Биты: 200C = 0, 200D = 1', 'Bits: 200C = 0, 200D = 1')], ['show', T('Показать метками', 'Show as marks')], ['strip', T('Удалить', 'Remove')]], default: 'bits' }],
    run([t], p) {
      if (p.mode === 'strip') return t.replace(ZW, '');
      if (p.mode === 'show') return t.replace(ZW, (c) => '⟨' + c.charCodeAt(0).toString(16).toUpperCase() + '⟩');
      const map = p.mode === 'bits' ? { '​': '0', '‌': '1' } : { '‌': '0', '‍': '1' };
      const bits = (t.match(ZW) || []).map((c) => map[c] || (c === '‍' || c === '⁠' ? ' ' : '')).join('');
      if (!bits.replace(/\s/g, '')) throw new Error(T('Невидимых символов не найдено', 'No invisible characters found'));
      return bits.trim();
    },
    probes(t) { return HAS_ZW.test(t) ? [{ mode: 'bits' }, { mode: 'bits2' }, { mode: 'strip' }] : []; },
  });

  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  def({
    id: 'unescape', name: T('Экранирование → символы', 'Escapes → characters'), cat: 'Кодировки', prior: 3,
    desc: '\\u0041, \\x41, &#65;, &#x41;, &amp;, U+0041 → A.',
    run([t]) {
      // Код вне Unicode оставляем как есть, а не роняем всю строку.
      const cp = (m, n) => (n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m);
      return t
        .replace(/\\u\{([0-9a-f]{1,6})\}|\\u([0-9a-f]{4})|U\+([0-9A-F]{4,5})(?![0-9A-F])/g, (m, a, b, c) => cp(m, parseInt(a || b || c, 16)))
        .replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/&#x([0-9a-f]{1,6});/gi, (m, h) => cp(m, parseInt(h, 16)))
        .replace(/&#(\d{1,7});/g, (m, d) => cp(m, Number(d)))
        .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] || m);
    },
    probes(t) { return /\\u[0-9a-f]{4}|\\x[0-9a-f]{2}|&#x?[0-9a-f]+;|U\+[0-9a-f]{4}/i.test(t) ? [{}] : []; },
  });

  def({
    id: 'acrostic', name: T('Буквы из слов (акростих)', 'Letters from words (acrostic)'), cat: 'Скрытое', prior: 3,
    desc: T('N-я буква каждого слова или строки: первые буквы, последние, только заглавные.', 'The N-th letter of each word or line: first letters, last letters, only capitals.'),
    params: [
      { key: 'n', label: T('Какая буква (1 = первая, −1 = последняя)', 'Which letter (1 = first, −1 = last)'), type: 'number', int: true, min: -1000, max: 1000, default: 1 },
      { key: 'by', label: T('Брать из', 'Take from'), type: 'select', options: [['words', T('Каждого слова', 'Each word')], ['lines', T('Каждой строки', 'Each line')], ['caps', T('Только заглавные буквы текста', 'Capital letters of the text only')]], default: 'words' },
    ],
    run([t], p) {
      if (p.by === 'caps') return (t.match(/[A-ZА-ЯЁІЇЄҐ]/g) || []).join('');
      const parts = p.by === 'lines' ? t.split(/[\r\n]+/) : t.split(/[^\p{L}\p{N}]+/u);
      const n = Number(p.n);
      if (n === 0) throw new Error(T('Номер буквы не может быть 0', 'The letter number cannot be 0'));
      return parts.filter(Boolean).map((w) => { const c = Array.from(w); return c[n > 0 ? n - 1 : c.length + n] || ''; }).join('');
    },
    probes(t) {
      if (!/\s/.test(t.trim())) return [];
      const words = t.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      const res = [];
      if (words.length >= 6) res.push({ n: 1, by: 'words' }, { n: -1, by: 'words' });
      if (t.split(/[\r\n]+/).filter(Boolean).length >= 3) res.push({ n: 1, by: 'lines' });
      if ((t.match(/[A-ZА-ЯЁІЇЄҐ]/g) || []).length >= 3 && /[a-zа-яёіїєґ]/.test(t)) res.push({ n: 1, by: 'caps' });
      return res;
    },
  });

  def({
    id: 'grid_rotate', name: T('Сетка: поворот и отражение', 'Grid: rotate and flip'), cat: 'Перестановки', prior: 1,
    desc: T('Текст раскладывается в сетку шириной W и поворачивается (так было в ARG Dungeons II: сетка 15×6, поворот на 90°). Переводы строк (LF, CRLF, CR) в сетку не попадают.', 'The text is laid out in a grid of width W and rotated (as in the Dungeons II ARG: a 15×6 grid, a 90° turn). Line breaks (LF, CRLF, CR) do not enter the grid.'),
    params: [
      { key: 'w', label: T('Ширина W', 'Width W'), type: 'number', int: true, min: 1, max: 10000, default: 15 },
      { key: 'op', label: T('Действие', 'Action'), type: 'select', options: [['ccw', T('Поворот 90° против часовой', 'Rotate 90° counter-clockwise')], ['cw', T('Поворот 90° по часовой', 'Rotate 90° clockwise')], ['180', T('Поворот 180°', 'Rotate 180°')], ['flipH', T('Отразить слева направо', 'Flip left–right')], ['flipV', T('Отразить сверху вниз', 'Flip top–bottom')]], default: 'ccw' },
      { key: 'lines', label: T('Выводить строками', 'Output as lines'), type: 'bool', default: false },
    ],
    run([t], p) {
      const chars = Array.from(t.replace(/\r\n|\r|\n/g, ''));
      const w = Math.max(1, Number(p.w)), h = Math.ceil(chars.length / w);
      const at = (r, c) => chars[r * w + c] || ' ';
      let rows = [];
      if (p.op === 'ccw') for (let c = w - 1; c >= 0; c--) rows.push(Array.from({ length: h }, (_, r) => at(r, c)).join(''));
      else if (p.op === 'cw') for (let c = 0; c < w; c++) rows.push(Array.from({ length: h }, (_, r) => at(h - 1 - r, c)).join(''));
      else if (p.op === '180') for (let r = h - 1; r >= 0; r--) rows.push(Array.from({ length: w }, (_, c) => at(r, w - 1 - c)).join(''));
      else if (p.op === 'flipH') for (let r = 0; r < h; r++) rows.push(Array.from({ length: w }, (_, c) => at(r, w - 1 - c)).join(''));
      else for (let r = h - 1; r >= 0; r--) rows.push(Array.from({ length: w }, (_, c) => at(r, c)).join(''));
      return p.lines ? rows.join('\n') : rows.join('').replace(/\s+$/, '');
    },
    // Ширина сетки неизвестна: пробуем делители длины текста и два поворота на 90°.
    probes(t) {
      const len = Array.from(t.replace(/\r\n|\r|\n/g, '')).length;
      // Только сплошной буквенный текст: цифры, hex и Base64 в сетку никто не раскладывает.
      if (len < 12 || len > 600 || /\s/.test(t.trim()) || !/^[A-Za-zА-Яа-яЁё]+$/.test(t.trim())) return [];
      const out = [];
      for (let w = 2; w <= len / 2; w++) if (len % w === 0) for (const op of ['ccw', 'cw']) out.push({ w, op, lines: false });
      return out.slice(0, 24);
    },
  });

  def({
    id: 'book_cipher', name: T('Книжный шифр (номера → слова)', 'Book cipher (numbers → words)'), cat: 'Скрытое', inputs: [T('номера', 'numbers'), T('текст-книга', 'book text')],
    desc: T('Номера указывают на слова (или буквы, строки) во втором входе. «3:5» — строка 3, слово 5.', 'Numbers point to words (or letters, lines) in the second input. “3:5” means line 3, word 5.'),
    params: [
      { key: 'unit', label: T('Номер указывает на', 'A number points to'), type: 'select', options: [['words', T('Слово', 'A word')], ['firstletter', T('Первую букву слова', 'The first letter of a word')], ['letters', T('Букву текста', 'A letter of the text')], ['lines', T('Строку', 'A line')]], default: 'words' },
      { key: 'exact', label: T('Точная разметка', 'Exact layout'), type: 'select', options: [['off', T('нет: пробелы схлопываются', 'off: whitespace collapses')], ['chars', T('символы как есть (пробелы и переводы строк считаются)', 'characters as is (spaces and line breaks count)')], ['fields', T('слова по одному пробелу (пустые поля считаются)', 'words split on a single space (empty fields count)')]], default: 'off' },
      { key: 'base', label: T('Первый номер', 'First number'), type: 'select', options: [['1', '1'], ['0', '0']], default: '1' },
      { key: 'book', label: T('Текст-книга (если вход не подключён)', 'Book text (if no input is connected)'), type: 'textarea', default: '' },
    ],
    run(inputs, p) {
      const book = inputs[1] != null ? inputs[1] : p.book;
      if (!book) throw new Error(T('Нужен текст-книга: подключи второй вход или вставь текст', 'A book text is needed: connect the second input or paste the text'));
      const lines = book.split(NEWLINE);
      const exact = p.exact || 'off';
      const splitWords = (s) => (exact === 'fields' ? s.split(' ') : s.split(/\s+/).filter(Boolean));
      const words = exact === 'fields' ? book.split(/ |\r\n|\r|\n/) : splitWords(book);
      const letters = exact === 'chars' ? Array.from(book) : Array.from(book.replace(/\s/g, ''));
      const shift = p.base === '0' ? 1 : 0;
      const pick = (token) => {
        const nums = token.split(/[:.\-/]/).map((x) => Number(x) + shift);
        if (nums.length >= 2) {
          const lineWords = splitWords(lines[nums[0] - 1] || '');
          const w = lineWords[nums[1] - 1] || '?';
          return p.unit === 'firstletter' ? w[0] : w;
        }
        const n = nums[0];
        if (p.unit === 'letters') return letters[n - 1] || '?';
        if (p.unit === 'lines') return lines[n - 1] || '?';
        const w = words[n - 1] !== undefined && (exact === 'fields' || words[n - 1]) ? words[n - 1] : '?';   // пустое поле — честный результат
        return p.unit === 'firstletter' ? (w[0] || '') : w;
      };
      const tokens = inputs[0].trim().split(/[\s,;]+/).filter(Boolean);
      return tokens.map(pick).join(p.unit === 'words' || p.unit === 'lines' ? ' ' : '');
    },
  });

  // Русский, набранный латиницей и цифрами вперемешку: «tЫ N3 SпАs3шЬ» → «тЫ не спАсешЬ».
  const RU_PHONETIC = {
    a: 'а', b: 'б', c: 'с', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'й', k: 'к', l: 'л', m: 'м', // i18n-ok: данные
    n: 'н', o: 'о', p: 'п', q: 'к', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'ш', x: 'х', y: 'у', z: 'з', // i18n-ok: данные
    3: 'е', 4: 'ч', 6: 'б', 0: 'о', 8: 'в', // i18n-ok: данные
  };
  const RU_VISUAL = {
    A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', N: 'И', O: 'О', P: 'Р', R: 'Я', T: 'Т', X: 'Х', Y: 'У', // i18n-ok: данные
    a: 'а', b: 'ь', c: 'с', e: 'е', k: 'к', m: 'т', n: 'п', o: 'о', p: 'р', r: 'г', u: 'и', x: 'х', y: 'у', // i18n-ok: данные
    3: 'з', 4: 'ч', 6: 'б', 0: 'о', // i18n-ok: данные
  };
  def({
    id: 'ru_leet', name: T('Русский латиницей и цифрами → кириллица', 'Russian in Latin letters and digits → Cyrillic'), cat: 'Скрытое', prior: 3,
    desc: T('Латинские буквы и цифры, которыми записан русский текст: по звучанию (N3 → не, S → с) или по виду (N → И, 3 → З).', 'Latin letters and digits used to write Russian: by sound (N3 → не, S → с) or by look (N → И, 3 → З).'),
    params: [{ key: 'mode', label: T('Как заменять', 'How to replace'), type: 'select', options: [['phonetic', T('По звучанию (t → т, 3 → е)', 'By sound (t → т, 3 → е)')], ['visual', T('По виду (N → И, R → Я)', 'By look (N → И, R → Я)')]], default: 'phonetic' }],
    run([t], p) {
      const map = p.mode === 'visual' ? RU_VISUAL : RU_PHONETIC;
      // Цифры меняем только внутри слов с буквами, чтобы не испортить числа.
      return t.replace(/[\p{L}\d]+/gu, (word) => {
        if (!/\p{L}/u.test(word)) return word;
        return Array.from(word, (ch) => {
          if (p.mode === 'visual') return map[ch] || ch;
          const low = ch.toLowerCase();
          const r = map[low];
          if (!r) return ch;
          return ch !== low ? r.toUpperCase() : r;
        }).join('');
      });
    },
    probes(t) {
      const lat = /[a-z]/i.test(t), cyr = /[а-яё]/i.test(t);
      return lat && cyr ? [{ mode: 'phonetic' }, { mode: 'visual' }] : [];
    },
  });

  def({
    id: 'mc_format', name: T('Убрать коды цвета Minecraft', 'Strip Minecraft colour codes'), cat: 'ARG и Minecraft', prior: 2,
    desc: T('§a, §l, &c и т. п. — коды форматирования в книгах, табличках и чате. Можно удалить или оставить только сами коды.', '§a, §l, &c etc. are formatting codes in books, signs and chat. Remove them or keep only the codes.'),
    params: [
      { key: 'mode', label: T('Режим', 'Mode'), type: 'select', options: [['strip', T('Удалить коды', 'Remove codes')], ['codes', T('Оставить только коды', 'Keep only the codes')]], default: 'strip' },
      { key: 'amp', label: T('Считать «&» кодом (как в плагинах)', 'Treat “&” as a code (like plugins do)'), type: 'bool', default: false },
    ],
    run([t], p) {
      const re = p.amp ? /[§&]([0-9a-fk-orx])/gi : /§([0-9a-fk-orx])/gi;
      if (p.mode === 'codes') return (t.match(re) || []).map((m) => m[1]).join('');
      return t.replace(re, '');
    },
    probes(t) { return /§[0-9a-fk-or]/i.test(t) ? [{ mode: 'strip' }, { mode: 'codes' }] : []; },
  });

})(typeof self !== 'undefined' ? self : this);
