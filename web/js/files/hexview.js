// Hex-просмотр со смещениями и поиск по hex/тексту/UTF-16. Чистые функции над Uint8Array.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = (G.ArgFiles = G.ArgFiles || {});

  const COLS = 16;
  const PAGE_ROWS = 32;

  const printable = (c) => (c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : '.');

  /** Строки дампа: [{offset, hex:string[], text}] начиная с offset (выровнен по строке). */
  function rows(bytes, offset, count) {
    const start = Math.max(0, Math.floor(offset / COLS) * COLS);
    const out = [];
    for (let r = 0, o = start; r < count && o < bytes.length; r++, o += COLS) {
      const slice = bytes.subarray(o, Math.min(o + COLS, bytes.length));
      out.push({ offset: o, hex: Array.from(slice, (b) => b.toString(16).padStart(2, '0')), text: Array.from(slice, printable).join('') });
    }
    return out;
  }

  /** Текстовый дамп в классическом виде: «00000000  89 50 …  |.PNG…|». */
  function format(bytes, offset, count) {
    return rows(bytes, offset, count).map((r) => {
      const hex = r.hex.join(' ').padEnd(COLS * 3 - 1, ' ');
      return r.offset.toString(16).padStart(8, '0') + '  ' + hex + '  |' + r.text + '|';
    }).join('\n');
  }

  /** Запрос → байты. mode: hex ("89 50 4E"), text (UTF-8), utf16 (UTF-16LE). */
  function parseQuery(query, mode) {
    if (!query) throw new Error(T('Введи, что искать', 'Enter what to search for'));
    if (mode === 'hex') return NS.hexToBytes(query);
    if (mode === 'utf16') {
      const out = new Uint8Array(query.length * 2);
      for (let i = 0; i < query.length; i++) { out[2 * i] = query.charCodeAt(i) & 255; out[2 * i + 1] = query.charCodeAt(i) >> 8; }
      return out;
    }
    return NS.encodeString(query, 'utf8');
  }

  /** Все вхождения (не больше limit) начиная с from. @returns {number[]} смещения */
  function findAll(bytes, needle, from, limit) {
    const hits = [];
    const max = limit || 500;
    for (let i = NS.indexOfBytes(bytes, needle, from || 0); i >= 0 && hits.length < max; i = NS.indexOfBytes(bytes, needle, i + 1)) hits.push(i);
    return hits;
  }

  NS.HexView = { rows, format, parseQuery, findAll, COLS, PAGE_ROWS };
})(typeof self !== 'undefined' ? self : this);
