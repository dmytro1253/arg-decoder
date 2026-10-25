// Раскладки экранных клавиатур: Брайль, Морзе, руны, греческий, пигпен, двойники кириллица ↔ латиница.
// Таблицы берутся из операций (G.GlyphTables, G.Codec), поэтому клавиши дают ровно то, что ждёт расшифровщик.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const Core = G.KbCore;
  const TB = G.GlyphTables || {};

  /** Функция text → строка для операции из реестра: параметры по умолчанию плюс указанные. */
  function op(id, params) {
    return (text) => {
      const def = G.CipherOps.BY_ID[id];
      const full = Object.assign({}, ...def.params.map((p) => ({ [p.key]: p.default })), params);
      return def.run([text], full);
    };
  }
  const isLetter = (s) => /^\p{L}$/u.test(s);
  const hasCyrillic = (s) => /[а-яё]/i.test(s); // i18n-ok: данные

  // ---------- Брайль ----------
  const BR = TB.braille;
  const BRAILLE_BASE = 0x2800;
  /** Ячейка по номерам включённых точек 1–6 (0 точек — пустая ячейка U+2800, она читается как пробел). */
  const cellFromDots = (dots) => BR.cell(Array.from(new Set(dots)).filter((d) => d >= 1 && d <= 6).join(''));
  /** Номера точек ячейки Брайля (1–6; точки 7–8 игнорируются). */
  const dotsOfCell = (cell) => [1, 2, 3, 4, 5, 6].filter((d) => (cell.codePointAt(0) - BRAILLE_BASE) & (1 << (d - 1)));

  function brailleKeys() {
    const out = [];
    for (let code = BRAILLE_BASE + 1; code < BRAILLE_BASE + 64; code++) {
      const cell = String.fromCodePoint(code);
      const service = cell === BR.number || cell === BR.capital;
      const meaning = ['en', 'ru'].map((lang) => { const m = BR.decode(cell, lang); return m === '?' || service ? '' : m; });
      const cap = cell === BR.number ? '#' : cell === BR.capital ? 'Aa' : meaning[0] === meaning[1] ? meaning[0] : meaning.filter(Boolean).join('/');
      out.push({
        ins: cell, glyph: cell, cap, src: meaning.filter(isLetter),
        title: cell + ' — ' + T('точки ', 'dots ') + dotsOfCell(cell).join('') + (cap ? ' · ' + cap : ''),
      });
    }
    return out;
  }

  function registerBraille() {
    if (!BR) return;
    Core.register({
      id: 'braille', order: 20, tab: T('Брайль', 'Braille'), name: T('Шрифт Брайля', 'Braille'),
      note: T('Ячейка = 6 точек (1–3 слева, 4–6 справа). Подпись: английская/русская буква. Собери ячейку по точкам с фото в конструкторе ниже.',
        'A cell is 6 dots (1–3 left, 4–6 right). Caption: English/Russian letter. Build a cell from a photo with the dot builder below.'),
      search: T('Текст → ячейки (Enter — вставить); ⠼ перед цифрами, ⠠ перед заглавной', 'Text → cells (Enter inserts); ⠼ before digits, ⠠ before a capital'),
      cols: 8, widget: 'braille',
      sections: [
        { title: T('Служебные', 'Service'), keys: [
          { ins: BR.number, glyph: BR.number, cap: '#', title: T('Знак числа ⠼: следующие a–j становятся цифрами 1–0', 'Number sign ⠼: the next a–j become digits 1–0') },
          { ins: BR.capital, glyph: BR.capital, cap: 'Aa', title: T('Знак заглавной ⠠', 'Capital sign ⠠') },
          { ins: '⠀', glyph: '␣', cap: T('проб.', 'space'), title: T('Пустая ячейка U+2800 (пробел)', 'Blank cell U+2800 (space)') },
        ] },
        { title: T('Все ячейки ⠁–⠿', 'All cells ⠁–⠿'), keys: brailleKeys() },
      ],
      encode: (text) => BR.encode(text, hasCyrillic(text) ? 'ru' : 'en'),
      decode: (text, lang) => BR.decode(text, lang || 'en'),
      langs: [['en', 'EN'], ['ru', 'RU']],
    });
  }

  // ---------- Морзе ----------
  const normMorse = (t) => t.replace(/[·•]/g, '.').replace(/[−–—_]/g, '-').trim();
  const showMorse = (code) => code.replace(/\./g, '·').replace(/-/g, '−');
  /** Расшифровка Морзе, терпимая к ошибкам: неизвестный код даёт «?». Формат записи как у операции «Морзе → текст». */
  function morseDecode(text, lang) {
    const dict = G.Codec.MORSE_DEC[lang || 'en'];
    return normMorse(text).split(/\s*\/\s*|\s{3,}/).map((word) => word.split(/\s+/).filter(Boolean).map((code) => (dict.has(code) ? dict.get(code) : '?')).join('')).join(' ');
  }

  function morseKeys(lang, filter) {
    const table = G.Codec.MORSE_ENC[lang];
    return Object.keys(table).filter(filter).map((ch) => ({
      ins: showMorse(table[ch]) + ' ', insAlt: table[ch] + ' ', glyph: showMorse(table[ch]), cap: ch, src: ch, title: ch + ' = ' + showMorse(table[ch]),
    }));
  }

  function registerMorse() {
    if (!G.Codec || !G.Codec.MORSE_ENC) return;
    Core.register({
      id: 'morse', order: 30, tab: T('Морзе', 'Morse'), name: T('Азбука Морзе', 'Morse code'),
      note: T('Буквы разделяются пробелом, слова — « / ». Клавиша буквы вставляет её код и пробел.', 'Letters are separated by a space, words by " / ". A letter key inserts its code and a space.'),
      search: T('Текст → Морзе (Enter — вставить)', 'Text → Morse (Enter inserts)'),
      cols: 6, alt: { label: T('ASCII (. и -)', 'ASCII (. and -)') },
      sections: [
        { title: T('Ввод', 'Input'), keys: [
          { id: 'dot', ins: '·', insAlt: '.', glyph: '·', cap: T('точка', 'dot'), title: T('Точка', 'Dot') },
          { id: 'dash', ins: '−', insAlt: '-', glyph: '−', cap: T('тире', 'dash'), title: T('Тире', 'Dash') },
          { id: 'gap', ins: ' ', glyph: '␣', cap: T('буква', 'letter'), title: T('Граница букв (пробел)', 'Letter gap (space)') },
          { id: 'word', ins: ' / ', glyph: '/', cap: T('слово', 'word'), title: T('Граница слов', 'Word gap') },
        ] },
        { title: T('Латиница и цифры', 'Latin and digits'), keys: morseKeys('en', (ch) => /[a-z0-9]/.test(ch)) },
        { title: T('Кириллица', 'Cyrillic'), keys: morseKeys('ru', (ch) => /[а-яё]/.test(ch)) }, // i18n-ok: данные
        { title: T('Знаки', 'Punctuation'), keys: morseKeys('en', (ch) => !/[a-z0-9]/.test(ch)) },
      ],
      encode: (text) => op('morse_encode', { lang: hasCyrillic(text) ? 'ru' : 'en' })(text),
      decode: morseDecode,
      langs: [['en', 'EN'], ['ru', 'RU']],
    });
  }

  // ---------- Руны ----------
  const RUNE_NAMES = 'fehu uruz thurisaz ansuz raido kenaz gebo wunjo hagalaz nauthiz isa jera eihwaz perthro algiz sowilo tiwaz berkano ehwaz mannaz laguz ingwaz dagaz othala'.split(' ');
  // Младший футарк: руна и её звучание (ᛦ — ир, читается как r; ᛐ — вариант t).
  const YOUNGER = [['ᚠ', 'f'], ['ᚢ', 'u'], ['ᚦ', 'th'], ['ᚬ', 'o'], ['ᚱ', 'r'], ['ᚴ', 'k'], ['ᚼ', 'h'], ['ᚾ', 'n'], ['ᛁ', 'i'], ['ᛅ', 'a'], ['ᛋ', 's'], ['ᛐ', 't'], ['ᛏ', 't'], ['ᛒ', 'b'], ['ᛘ', 'm'], ['ᛚ', 'l'], ['ᛦ', 'r']];

  function registerRunes() {
    if (!TB.runes) return;
    const key = (rune, latin, name) => ({ ins: rune, glyph: rune, cap: latin, src: latin, title: rune + ' = ' + latin + (name ? ' (' + name + ')' : '') });
    Core.register({
      id: 'runes', order: 40, tab: T('Руны', 'Runes'), name: T('Руны', 'Runes'),
      note: T('ᚦ = th, ᛜ = ng, ᛇ = ï; ᛫ — разделитель слов (читается как пробел). Общие руны одинаковы в обоих футарках.', 'ᚦ = th, ᛜ = ng, ᛇ = ï; ᛫ separates words (read as a space). Shared runes are the same characters in both futharks.'),
      search: T('Латиница → руны (Enter — вставить)', 'Latin → runes (Enter inserts)'),
      cols: 8,
      sections: [
        { title: T('Старший футарк', 'Elder Futhark'), keys: TB.runes.elder.map(([r, l], i) => key(r, l, RUNE_NAMES[i])) },
        { title: T('Младший футарк', 'Younger Futhark'), keys: YOUNGER.map(([r, l]) => key(r, l)) },
        { title: T('Разделители', 'Separators'), keys: ['᛫', '᛬', '᛭'].map((r) => ({ id: 'sep', ins: r, glyph: r, cap: T('проб.', 'space'), title: r + ' ' + T('— разделитель слов', '— word separator') })) },
      ],
      encode: op('runes_encode'),
      decode: op('runes_decode'),
    });
  }

  // ---------- Греческий ----------
  function registerGreek() {
    if (!TB.greek) return;
    const mk = (g, l, up) => { const ch = up ? g.toUpperCase() : g; return { ins: ch, glyph: ch, cap: l, src: l, title: ch + ' = ' + l }; };
    const final = { ins: 'ς', glyph: 'ς', cap: 's', src: 's', title: 'ς = s (' + T('конечная сигма', 'final sigma') + ')' };
    Core.register({
      id: 'greek', order: 50, tab: T('Греческий', 'Greek'), name: T('Греческий алфавит', 'Greek alphabet'),
      note: T('Подпись — латинская транслитерация, как в операции «Греческие буквы ↔ латиница».', 'The caption is the Latin transliteration used by the "Greek letters ↔ Latin" operation.'),
      search: T('Латиница → греческий (Enter — вставить)', 'Latin → Greek (Enter inserts)'),
      cols: 8,
      sections: [
        { title: T('Строчные', 'Lowercase'), keys: TB.greek.letters.map(([g, l]) => mk(g, l, false)).concat([final]) },
        { title: T('Заглавные', 'Capitals'), keys: TB.greek.letters.map(([g, l]) => mk(g, l, true)) },
        { title: T('Ударения', 'Accents'), keys: ['ά', 'έ', 'ή', 'ί', 'ό', 'ύ', 'ώ', 'ϊ', 'ϋ'].map((g) => ({ ins: g, glyph: g, cap: g.normalize('NFD')[0], title: g })) },
      ],
      encode: op('greek_translit', { dir: 'lat2gr' }),
      decode: op('greek_translit', { dir: 'gr2lat' }),
    });
  }

  // ---------- Пигпен ----------
  function registerPigpen() {
    if (!TB.pigpen) return;
    const keys = Object.keys(TB.pigpen.letterToken).map((letter) => {
      const tok = TB.pigpen.letterToken[letter];
      const glyph = TB.pigpen.glyph[tok.replace('.', '')] + (tok.endsWith('.') ? '·' : '');
      return { ins: glyph, insAlt: tok + ' ', glyph, cap: letter, src: letter.toLowerCase(), title: letter + ' = ' + glyph + ' (' + tok + ')' };
    });
    Core.register({
      id: 'pigpen', order: 60, tab: T('Пигпен', 'Pigpen'), name: T('Пигпен (масонский шифр)', 'Pigpen (Freemason cipher)'),
      note: T('Юникод-приближения фигур; точка · в конце знака — вариант с точкой (J–R, W–Z). Режим жетонов вставляет rb, lrb. …',
        'Unicode approximations of the shapes; a trailing · marks the dotted variant (J–R, W–Z). Token mode inserts rb, lrb. …'),
      search: T('Буквы → пигпен (Enter — вставить)', 'Letters → pigpen (Enter inserts)'),
      cols: 7, alt: { label: T('Жетоны (rb, v.)', 'Tokens (rb, v.)') },
      sections: [
        { title: T('Буквы A–Z', 'Letters A–Z'), keys },
        { title: T('Разделители', 'Separators'), keys: [
          { id: 'gap', ins: ' ', glyph: '␣', cap: T('буква', 'letter'), title: T('Пробел между знаками', 'Space between glyphs') },
          { id: 'word', ins: ' / ', glyph: '/', cap: T('слово', 'word'), title: T('Граница слов', 'Word gap') },
        ] },
      ],
      encode: op('pigpen_encode', { style: 'unicode' }),
      decode: op('pigpen_decode'),
    });
  }

  // ---------- Двойники кириллица ↔ латиница ----------
  function registerHomoglyph() {
    if (!TB.homoglyph) return;
    const { cyr, lat } = TB.homoglyph;
    const cp = (c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    const pairs = Array.from(cyr, (c, i) => [c, lat[i]]);
    Core.register({
      id: 'homoglyph', order: 90, tab: T('Двойники', 'Look-alikes'), name: T('Похожие буквы: кириллица ↔ латиница', 'Look-alike letters: Cyrillic ↔ Latin'),
      note: T('Клавиша вставляет двойник (он на кнопке), подпись — оригинал. Так прячут и находят «латинские» слова с кириллицей внутри.',
        'A key inserts the look-alike (on the button), the caption is the original. Used to hide and find "Latin" words with Cyrillic inside.'),
      search: T('Латиница → кириллические двойники (Enter — вставить)', 'Latin → Cyrillic look-alikes (Enter inserts)'),
      cols: 8,
      sections: [
        { title: T('Вставить кириллицу (оригинал — латиница)', 'Insert Cyrillic (original is Latin)'), keys: pairs.map(([c, l]) => ({ ins: c, glyph: c, cap: l, src: l.toLowerCase(), title: c + ' ' + cp(c) + ' ≈ ' + l })) },
        { title: T('Вставить латиницу (оригинал — кириллица)', 'Insert Latin (original is Cyrillic)'), keys: pairs.map(([c, l]) => ({ ins: l, glyph: l, cap: c, src: c.toLowerCase(), title: l + ' ' + cp(l) + ' ≈ ' + c })) },
      ],
      encode: op('homoglyph', { mode: 'tocyr' }),
      decode: op('homoglyph', { mode: 'tolat' }),
    });
  }

  G.KbLayouts = { cellFromDots, dotsOfCell, morseDecode };
  registerBraille();
  registerMorse();
  registerRunes();
  registerGreek();
  registerPigpen();
  registerHomoglyph();
})(typeof self !== 'undefined' ? self : this);
