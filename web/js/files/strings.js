// Поиск строк в двоичных данных (как утилита strings): ASCII, UTF-8 с не-ASCII символами, UTF-16LE/BE.
// Результат — список {offset, kind, text}; formatStrings превращает его в текст «по строке на запись».
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = (G.ArgFiles = G.ArgFiles || {});

  const DEFAULT_LIMIT = 5000;
  const MAX_LIMIT = 200000;

  const isAsciiPrintable = (c) => (c >= 0x20 && c < 0x7f) || c === 9;

  // Печатный символ UTF-16: ASCII, Latin-1, кириллица и общая пунктуация (иначе в случайных данных слишком много шума).
  const isUnitPrintable = (u) => (u >= 0x20 && u < 0x7f) || u === 9 || (u >= 0xa0 && u <= 0xff) || (u >= 0x400 && u <= 0x4ff) || (u >= 0x2010 && u <= 0x203a);

  function scanAscii(b, minLen, skip, out, limit) {
    let start = -1;
    for (let i = 0; i <= b.length; i++) {
      const ok = i < b.length && isAsciiPrintable(b[i]) && !skip(i);
      if (ok && start < 0) start = i;
      if (!ok && start >= 0) {
        if (i - start >= minLen) out.push({ offset: start, kind: 'ascii', text: NS.ascii(b, start, i) });
        start = -1;
        if (out.length >= limit) return;
      }
    }
  }

  // Длина UTF-8 последовательности в позиции i (1 для ASCII), 0 если байты не образуют допустимый символ.
  function utf8Len(b, i) {
    const c = b[i];
    if (c < 0x80) return isAsciiPrintable(c) ? 1 : 0;
    const need = c >= 0xf0 && c <= 0xf4 ? 3 : c >= 0xe0 ? 2 : c >= 0xc2 ? 1 : -1;
    if (need < 0 || c > 0xf4) return 0;
    if (i + need >= b.length) return 0;
    for (let k = 1; k <= need; k++) if ((b[i + k] & 0xc0) !== 0x80) return 0;
    if (need === 2 && c === 0xe0 && b[i + 1] < 0xa0) return 0;
    return need + 1;
  }

  // Возвращает диапазоны [start, end) UTF-8 строк, содержащих не-ASCII символы.
  function scanUtf8(b, minLen, out, ranges, limit) {
    let start = -1, chars = 0, wide = false;
    const flush = (end) => {
      if (start >= 0 && wide && chars >= minLen) {
        out.push({ offset: start, kind: 'utf8', text: NS.decodeUtf8(b.subarray(start, end)) });
        ranges.push([start, end]);
      }
      start = -1; chars = 0; wide = false;
    };
    for (let i = 0; i < b.length && out.length < limit;) {
      const n = utf8Len(b, i);
      if (!n) { flush(i); i++; continue; }
      if (start < 0) start = i;
      if (n > 1) wide = true;
      chars++;
      i += n;
    }
    flush(b.length);
  }

  function scanUtf16(b, minLen, bigEndian, out, limit) {
    for (let parity = 0; parity < 2; parity++) {
      let start = -1, text = '';
      for (let i = parity; i <= b.length; i += 2) {
        const u = i + 1 < b.length ? (bigEndian ? (b[i] << 8) | b[i + 1] : b[i] | (b[i + 1] << 8)) : -1;
        if (u >= 0 && isUnitPrintable(u)) {
          if (start < 0) start = i;
          text += String.fromCharCode(u);
        } else {
          if (start >= 0 && text.length >= minLen) out.push({ offset: start, kind: bigEndian ? 'utf16be' : 'utf16le', text });
          start = -1; text = '';
          if (out.length >= limit) return;
        }
      }
    }
  }

  /**
   * @param {Uint8Array} bytes
   * @param {{minLen?:number, kinds?:string, regex?:string, ignoreCase?:boolean, limit?:number}} [opts]
   *   kinds: ascii | utf8 | utf16le | utf16be | all (ASCII + UTF-8 + UTF-16LE)
   * @returns {{items:{offset:number,kind:string,text:string}[], truncated:boolean}}
   */
  function extractStrings(bytes, opts) {
    const o = Object.assign({ minLen: 4, kinds: 'all', regex: '', ignoreCase: true, limit: DEFAULT_LIMIT }, opts || {});
    const minLen = Math.max(1, Math.floor(Number(o.minLen)) || 4);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(o.limit)) || DEFAULT_LIMIT));
    let re = null;
    if (o.regex) {
      try { re = new RegExp(o.regex, o.ignoreCase ? 'i' : ''); } catch (e) { throw new Error(T('Неверное регулярное выражение: ', 'Invalid regular expression: ') + e.message); }
    }
    const k = o.kinds;
    const raw = [];
    const ranges = [];
    const cap = limit * 4; // с запасом: фильтр по regex отбросит часть
    if (k === 'utf8' || k === 'all') scanUtf8(bytes, minLen, raw, ranges, cap);
    if (k === 'ascii' || k === 'all') {
      let ri = 0;
      const inRange = (i) => {
        while (ri < ranges.length && ranges[ri][1] <= i) ri++;
        return k === 'all' && ri < ranges.length && ranges[ri][0] <= i;
      };
      scanAscii(bytes, minLen, inRange, raw, cap);
    }
    if (k === 'utf16le' || k === 'all') scanUtf16(bytes, minLen, false, raw, cap);
    if (k === 'utf16be') scanUtf16(bytes, minLen, true, raw, cap);
    raw.sort((a, b) => a.offset - b.offset);
    const filtered = re ? raw.filter((s) => re.test(s.text)) : raw;
    return { items: filtered.slice(0, limit), truncated: filtered.length > limit || raw.length >= cap };
  }

  function formatStrings(items, withOffset) {
    return items.map((s) => (withOffset ? NS.hex(s.offset, 8) + ' [' + s.kind + '] ' : '') + s.text).join('\n');
  }

  NS.Strings = { extractStrings, formatStrings, DEFAULT_LIMIT };
})(typeof self !== 'undefined' ? self : this);
