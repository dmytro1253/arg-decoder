// Раскладка «Спецсимволы»: коды цвета Minecraft (§), невидимые символы нулевой ширины, стрелки, рамки, частые знаки ARG.
// Коды § и набор нулевой ширины совпадают с операциями «Убрать коды цвета Minecraft» и «Символы нулевой ширины» (ops-extra.js).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const Core = G.KbCore;

  const MC_COLORS = [
    ['0', '#000000', T('чёрный', 'black')], ['1', '#0000AA', T('тёмно-синий', 'dark blue')], ['2', '#00AA00', T('тёмно-зелёный', 'dark green')],
    ['3', '#00AAAA', T('тёмно-бирюзовый', 'dark aqua')], ['4', '#AA0000', T('тёмно-красный', 'dark red')], ['5', '#AA00AA', T('пурпурный', 'dark purple')],
    ['6', '#FFAA00', T('золотой', 'gold')], ['7', '#AAAAAA', T('серый', 'gray')], ['8', '#555555', T('тёмно-серый', 'dark gray')],
    ['9', '#5555FF', T('синий', 'blue')], ['a', '#55FF55', T('зелёный', 'green')], ['b', '#55FFFF', T('бирюзовый', 'aqua')],
    ['c', '#FF5555', T('красный', 'red')], ['d', '#FF55FF', T('розовый', 'light purple')], ['e', '#FFFF55', T('жёлтый', 'yellow')], ['f', '#FFFFFF', T('белый', 'white')],
  ];
  const MC_FORMATS = [
    ['k', T('случайные символы', 'obfuscated')], ['l', T('жирный', 'bold')], ['m', T('зачёркнутый', 'strikethrough')],
    ['n', T('подчёркнутый', 'underline')], ['o', T('курсив', 'italic')], ['r', T('сброс', 'reset')],
  ];
  // Невидимые: первые шесть читает операция «Символы нулевой ширины».
  const INVISIBLE = [
    ['​', 'ZWSP', T('нулевой ширины пробел', 'zero-width space')], ['‌', 'ZWNJ', T('нулевой ширины не-соединитель', 'zero-width non-joiner')],
    ['‍', 'ZWJ', T('нулевой ширины соединитель', 'zero-width joiner')], ['﻿', 'BOM', T('нулевой ширины неразрывный пробел / BOM', 'zero-width no-break space / BOM')],
    ['⁠', 'WJ', T('соединитель слов', 'word joiner')], ['᠎', 'MVS', T('монгольский разделитель гласных', 'Mongolian vowel separator')],
    [' ', 'NBSP', T('неразрывный пробел', 'no-break space')], ['‎', 'LRM', T('метка «слева направо»', 'left-to-right mark')], ['‏', 'RLM', T('метка «справа налево»', 'right-to-left mark')],
  ];
  const cpLabel = (ch) => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');

  const chars = (str, cap) => Array.from(str.replace(/\s/g, ''), (ch) => ({ ins: ch, glyph: ch, cap: cap || '', title: ch + ' ' + cpLabel(ch) }));
  const ARROWS = '← ↑ → ↓ ↔ ↕ ↖ ↗ ↘ ↙ ⇐ ⇑ ⇒ ⇓ ⇔ ⇕ ↩ ↪ ↺ ↻ ➔ ➜ ➤ ▲ ▼ ◀ ▶ ⟵ ⟶';
  const BOXES = '─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ ═ ║ ╔ ╗ ╚ ╝ ╠ ╣ ╦ ╩ ╬ ░ ▒ ▓ █ ▀ ▄ ▌ ▐ ■ □ ▪ ▫';
  const ARG = '† ‡ § ¶ © ® ™ ° № ‰ ‽ ¿ ¡ « » „ “ ” ‘ ’ – — … • · ∞ ∴ ∵ ∅ ± × ÷ ≈ ≠ ≤ ≥ √ π Σ Δ Ω µ ☉ ☽ ☾ ☠ ☢ ☣ ⚠ ⚑ ⚐ ✝ ☯ ☮ ✦ ★ ☆ ♠ ♣ ♥ ♦ ♪ ♫ ⌘ ⌥ ⎋ ⏎ ⌫ ✓ ✗ ✔ ✘';

  const mcKey = (code, label) => ({ ins: '§' + code, glyph: '§' + code, cap: label, title: '§' + code + ' — ' + label });
  const mcTokens = ['§'].concat('0123456789abcdefklmnorx'.split('').map((c) => '§' + c));

  Core.register({
    id: 'special', order: 80, tab: T('Спецсимволы', 'Special'), name: T('Спецсимволы и коды', 'Special characters and codes'),
    note: T('Невидимые символы подписаны, но в поле остаются невидимыми: проверяй длину текста или HEX-вид. Backspace стирает «§a» целиком.',
      'Invisible characters are labelled here but stay invisible in the field: check the text length or the HEX view. Backspace erases "§a" as one unit.'),
    search: T('Фильтр: название, код, символ (например «zero», «200b», «красный»)', 'Filter: name, code, symbol (e.g. "zero", "200b", "red")'),
    cols: 8, filter: true,
    tokens: Core.sortTokens(mcTokens.concat(INVISIBLE.map((x) => x[0]))),
    sections: [
      { title: T('Minecraft: цвет (§ + код)', 'Minecraft: colour (§ + code)'), keys: MC_COLORS.map(([c, hex, name]) => Object.assign(mcKey(c, name), { swatch: hex })) },
      { title: T('Minecraft: форматирование', 'Minecraft: formatting'), keys: MC_FORMATS.map(([c, name]) => mcKey(c, name)).concat([{ ins: '§', glyph: '§', cap: T('только §', '§ only'), title: T('Знак параграфа без кода', 'Section sign without a code') }]) },
      { title: T('Невидимые символы', 'Invisible characters'), keys: INVISIBLE.map(([ch, label, name]) => ({ ins: ch, glyph: label, cap: cpLabel(ch).slice(2), title: cpLabel(ch) + ' ' + name, mono: true })) },
      { title: T('Стрелки и фигуры', 'Arrows and shapes'), keys: chars(ARROWS) },
      { title: T('Рамки и блоки', 'Box drawing and blocks'), keys: chars(BOXES) },
      { title: T('Символы ARG', 'ARG symbols'), keys: chars(ARG) },
    ],
    decode: (text) => G.CipherOps.BY_ID.zero_width.run([text], { mode: 'show' }),
  });
})(typeof self !== 'undefined' ? self : this);
