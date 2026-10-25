// Клавиатура стола зачарований (SGA): данные и чистая логика, раскладка для панели «Клавиатуры» (keyboards.js).
// Строки знаков совпадают с таблицей SGA в ops-arg.js (проверяется тестом).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const Core = G.KbCore;

  // Знаки алфавита; у t и x в таблице стоит пробел перед комбинирующей точкой, это часть строки.
  const GLYPHS = [
    ['a', 'ᔑ'], ['b', 'ʖ'], ['c', 'ᓵ'], ['d', '↸'], ['e', 'ᒷ'], ['f', '⎓'], ['g', '⊣'],
    ['h', '⍑'], ['i', '╎'], ['j', '⋮'], ['k', 'ꖌ'], ['l', 'ꖎ'], ['m', 'ᒲ'], ['n', 'リ'],
    ['o', '\u{1d679}'], ['p', '!¡'], ['q', 'ᑑ'], ['r', '∷'], ['s', 'ᓭ'], ['t', 'ℸ ̣'],
    ['u', '⚍'], ['v', '⍊'], ['w', '∴'], ['x', ' ̇/'], ['y', '||'], ['z', '⨅'],
  ].map(([latin, glyph]) => ({ latin, glyph }));

  // Варианты записи одного знака, которые встречаются в переводчиках: backspace стирает и их целиком.
  const VARIANTS = ['ℸ̣', 'ℸ', '̇/', '!¡', '¡', '∥'];
  const TOKENS = Core.sortTokens(GLYPHS.map((g) => g.glyph).concat(VARIANTS));
  const BY_LATIN = new Map(GLYPHS.map((g) => [g.latin, g.glyph]));

  /** Латиница → знаки SGA (регистр теряется: в SGA его нет). Остальные символы остаются как есть. */
  function encode(text) {
    return Array.from(String(text).toLowerCase(), (ch) => BY_LATIN.get(ch) || ch).join('');
  }

  /** Backspace: выделение целиком, иначе один знак SGA (даже из нескольких кодовых единиц) или один символ. */
  const deleteBackward = (text, start, end) => Core.deleteBackward(text, start, end, TOKENS);

  /** Какие буквы подсвечивать по тексту в строке поиска: латиница или уже готовые знаки. */
  function matchLetters(query) {
    const q = String(query).toLowerCase();
    const found = new Set();
    for (const ch of q) if (BY_LATIN.has(ch)) found.add(ch);
    for (const g of GLYPHS) if (q.includes(g.glyph)) found.add(g.latin);
    return found;
  }

  Core.register({
    id: 'sga', order: 10,
    tab: 'SGA',
    name: T('Стол зачарований (SGA)', 'Enchanting table (SGA)'),
    note: T('В SGA нет регистра: «A» и «a» дают один знак, при обратном переводе получится строчная буква.',
      'SGA has no letter case: "A" and "a" give the same glyph, decoding back yields lowercase.'),
    search: T('Набери латиницей — знаки подсветятся, Enter — вставить', 'Type latin letters to highlight glyphs, Enter to insert'),
    cols: 7,
    sections: [{ keys: GLYPHS.map((g) => ({ ins: g.glyph, glyph: g.glyph, cap: g.latin, src: g.latin, title: g.latin.toUpperCase() + ' = ' + g.glyph })) }],
    tokens: TOKENS,
    encode,
    decode: (text) => G.CipherOps.BY_ID.sga_decode.run([text], {}),
  });

  G.SgaKeyboard = {
    GLYPHS, TOKENS, encode, deleteBackward, matchLetters,
    // Совместимость со старым API: панель теперь общая для всех раскладок.
    mount: (opts) => G.Keyboards.mount(opts),
    toggle: (force) => G.Keyboards.toggle(force),
    insertText: (str, keepFocus) => G.Keyboards.insertText(str, keepFocus),
  };
})(typeof self !== 'undefined' ? self : this);
