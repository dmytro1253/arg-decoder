// Кодировки: EBCDIC (cp037), восьмеричные коды, Base91, uuencode, quoted-printable, Punycode, ROT5/ROT18, ROT8000, «двоичное в пиксели».
// Декодеры байтовых форматов возвращают «байтовую строку» (символы с кодами 0..255), как hex_decode; дальше можно подключить «Байты → текст».
(function (G) {
  'use strict';
  const C = G.Codec;
  const T = G.T || ((ru) => ru);
  const { def } = G.CipherOps;

  const fail = (ru, en) => { throw new Error(T(ru, en)); };
  const ENC_OPTIONS = [['utf8', 'UTF-8'], ['cp1251', 'CP1251 (Windows)'], ['koi8r', 'KOI8-R'], ['latin1', T('Байты как есть', 'Raw bytes')]];
  const isBytes = (s) => !/[^\u0000-ÿ]/.test(s);
  const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, '0');

  // ===================== EBCDIC cp037 =====================
  // Таблица из 256 знаков: индекс = байт EBCDIC, значение = символ Юникода.
  const EBCDIC_037 = '\u0000\u0001\u0002\u0003\u009c\u0009\u0086\u007f\u0097\u008d\u008e\u000b\u000c\u000d\u000e\u000f\u0010\u0011\u0012\u0013\u009d\u0085\u0008\u0087\u0018\u0019\u0092\u008f\u001c\u001d\u001e\u001f\u0080\u0081\u0082\u0083\u0084\u000a\u0017\u001b\u0088\u0089\u008a\u008b\u008c\u0005\u0006\u0007\u0090\u0091\u0016\u0093\u0094\u0095\u0096\u0004\u0098\u0099\u009a\u009b\u0014\u0015\u009e\u001a \u00a0\u00e2\u00e4\u00e0\u00e1\u00e3\u00e5\u00e7\u00f1\u00a2.<(+|&\u00e9\u00ea\u00eb\u00e8\u00ed\u00ee\u00ef\u00ec\u00df!$*);\u00ac-/\u00c2\u00c4\u00c0\u00c1\u00c3\u00c5\u00c7\u00d1\u00a6,%_>?\u00f8\u00c9\u00ca\u00cb\u00c8\u00cd\u00ce\u00cf\u00cc`:#@\u0027="\u00d8abcdefghi\u00ab\u00bb\u00f0\u00fd\u00fe\u00b1\u00b0jklmnopqr\u00aa\u00ba\u00e6\u00b8\u00c6\u00a4\u00b5~stuvwxyz\u00a1\u00bf\u00d0\u00dd\u00de\u00ae^\u00a3\u00a5\u00b7\u00a9\u00a7\u00b6\u00bc\u00bd\u00be[]\u00af\u00a8\u00b4\u00d7{ABCDEFGHI\u00ad\u00f4\u00f6\u00f2\u00f3\u00f5}JKLMNOPQR\u00b9\u00fb\u00fc\u00f9\u00fa\u00ff\u005c\u00f7STUVWXYZ\u00b2\u00d4\u00d6\u00d2\u00d3\u00d50123456789\u00b3\u00db\u00dc\u00d9\u00da\u009f';
  const EBCDIC_DEC = Array.from(EBCDIC_037);
  const EBCDIC_ENC = new Map(EBCDIC_DEC.map((ch, i) => [ch, i]));

  def({
    id: 'ebcdic_decode', name: T('EBCDIC (cp037) → текст', 'EBCDIC (cp037) → text'), cat: 'Кодировки', prior: 0,
    desc: T('Байты IBM EBCDIC (cp037) в текст: C8 85 93 93 96 → Hello. Вход — байты (например, после «HEX → байты»).',
      'IBM EBCDIC (cp037) bytes to text: C8 85 93 93 96 → Hello. The input is bytes (e.g. after “HEX → bytes”).'),
    params: [],
    run([t]) {
      if (!isBytes(t)) fail('Вход уже текст, а не байты', 'The input is already text, not bytes');
      return Array.from(t, (ch) => EBCDIC_DEC[ch.charCodeAt(0)]).join('');
    },
    probes(t) {
      if (t.length < 4 || !isBytes(t)) return [];
      // Типичные EBCDIC-диапазоны: пробел 40, строчные 81–A9, заглавные C1–E9, цифры F0–F9.
      const hits = Array.from(t).filter((ch) => /[@\u0081-\u0089\u0091-\u0099¢-©Á-ÉÑ-Ùâ-éð-ù]/.test(ch)).length;
      return hits / t.length >= 0.85 && /[\u0080-ÿ]/.test(t) ? [{}] : [];
    },
  });

  def({
    id: 'ebcdic_encode', name: T('Текст → EBCDIC (cp037)', 'Text → EBCDIC (cp037)'), cat: 'Кодировки', prior: 0,
    params: [],
    run([t]) {
      return Array.from(t, (ch) => {
        if (!EBCDIC_ENC.has(ch)) fail('Символ «' + ch + '» нет в cp037', 'Character “' + ch + '” is not in cp037');
        return String.fromCharCode(EBCDIC_ENC.get(ch));
      }).join('');
    },
  });

  // ===================== Восьмеричные коды =====================
  def({
    id: 'octal_decode', name: T('Восьмеричные коды → байты', 'Octal codes → bytes'), cat: 'Кодировки', prior: 0,
    desc: T('101 102 103 или \\101\\102\\103 → ABC. Без разделителей режет по 3 цифры.', '101 102 103 or \\101\\102\\103 → ABC. Without separators it splits into groups of 3 digits.'),
    params: [],
    run([t]) {
      const s = t.replace(/0o/gi, ' ').trim();
      if (/[^0-7\s,;\\:-]/.test(s)) fail('В строке есть не-восьмеричные символы', 'The string has non-octal characters');
      const tokens = /[^0-7]/.test(s) ? s.split(/[^0-7]+/).filter(Boolean) : (s.match(/.{1,3}/g) || []);
      if (!tokens.length) fail('Нет восьмеричных чисел', 'No octal numbers');
      return tokens.map((tok) => {
        const v = parseInt(tok, 8);
        if (v > 255) fail('Значение ' + tok + ' (' + v + ') больше байта', 'Value ' + tok + ' (' + v + ') is bigger than a byte');
        return String.fromCharCode(v);
      }).join('');
    },
    // Только явные «тройки», где ни одна не превышает 377 (иначе это скорее десятичные числа).
    probes(t) {
      const tokens = t.trim().split(/[\s,;\\]+/).filter(Boolean);
      return tokens.length >= 4 && tokens.every((x) => /^[0-3][0-7]{2}$/.test(x)) ? [{}] : [];
    },
  });

  def({
    id: 'octal_encode', name: T('Текст → восьмеричные коды', 'Text → octal codes'), cat: 'Кодировки', prior: 0,
    params: [{ key: 'sep', label: T('Разделитель', 'Separator'), type: 'text', default: ' ' }],
    run([t], p) { return Array.from(C.toBytesAuto(t), (ch) => ch.charCodeAt(0).toString(8).padStart(3, '0')).join(p.sep); },
  });

  // ===================== Base91 (basE91, Joachim Henke) =====================
  const B91 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"';

  function base91Decode(text) {
    let v = -1;
    let b = 0;
    let n = 0;
    let out = '';
    for (const ch of text) {
      if (/\s/.test(ch)) continue;
      const d = B91.indexOf(ch);
      if (d < 0) fail('Символ «' + ch + '» не входит в Base91', 'Character “' + ch + '” is not in Base91');
      if (v < 0) { v = d; continue; }
      v += d * 91;
      b |= v << n;
      n += (v & 8191) > 88 ? 13 : 14;
      do { out += String.fromCharCode(b & 255); b >>= 8; n -= 8; } while (n > 7);
      v = -1;
    }
    if (v !== -1) out += String.fromCharCode((b | (v << n)) & 255);
    return out;
  }

  function base91Encode(bin) {
    let b = 0;
    let n = 0;
    let out = '';
    for (let i = 0; i < bin.length; i++) {
      b |= bin.charCodeAt(i) << n;
      n += 8;
      if (n > 13) {
        let v = b & 8191;
        if (v > 88) { b >>= 13; n -= 13; } else { v = b & 16383; b >>= 14; n -= 14; }
        out += B91[v % 91] + B91[Math.floor(v / 91)];
      }
    }
    if (n) {
      out += B91[b % 91];
      if (n > 7 || b > 90) out += B91[Math.floor(b / 91)];
    }
    return out;
  }

  def({
    id: 'base91_decode', name: T('Base91 → байты', 'Base91 → bytes'), cat: 'Кодировки', prior: 0,
    desc: T('basE91 (Joachim Henke): 91 печатный символ, плотнее Base64. fPNKd → test.', 'basE91 (Joachim Henke): 91 printable characters, denser than Base64. fPNKd → test.'),
    params: [],
    run([t]) { return base91Decode(t); },
  });

  def({
    id: 'base91_encode', name: T('Текст → Base91', 'Text → Base91'), cat: 'Кодировки', prior: 0,
    params: [],
    run([t]) { return base91Encode(C.toBytesAuto(t)); },
  });

  // ===================== uuencode =====================
  const UU_LINE = 45;
  const uuValue = (ch) => (ch.charCodeAt(0) - 32) & 63;
  const uuChar = (v) => (v === 0 ? '`' : String.fromCharCode(32 + v));

  function uuDecode(text) {
    let out = '';
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(/\s+$/, '');
      if (!line || /^begin\s/.test(line) || line === 'end') continue;
      const n = uuValue(line[0]);
      let bytes = '';
      for (let i = 1; i < line.length; i += 4) {
        const v = [0, 1, 2, 3].map((k) => (line[i + k] === undefined ? 0 : uuValue(line[i + k])));
        bytes += String.fromCharCode(((v[0] << 2) | (v[1] >> 4)) & 255, ((v[1] << 4) | (v[2] >> 2)) & 255, ((v[2] << 6) | v[3]) & 255);
      }
      out += bytes.slice(0, n);
    }
    return out;
  }

  function uuEncode(bin, header) {
    const lines = [];
    for (let i = 0; i < bin.length; i += UU_LINE) {
      const part = bin.slice(i, i + UU_LINE);
      let line = uuChar(part.length);
      for (let j = 0; j < part.length; j += 3) {
        const a = part.charCodeAt(j);
        const b = j + 1 < part.length ? part.charCodeAt(j + 1) : 0;
        const c = j + 2 < part.length ? part.charCodeAt(j + 2) : 0;
        line += uuChar(a >> 2) + uuChar(((a & 3) << 4) | (b >> 4)) + uuChar(((b & 15) << 2) | (c >> 6)) + uuChar(c & 63);
      }
      lines.push(line);
    }
    return header ? ['begin 644 data.bin'].concat(lines, ['`', 'end']).join('\n') : lines.join('\n');
  }

  def({
    id: 'uudecode', name: T('uudecode → байты', 'uudecode → bytes'), cat: 'Кодировки', prior: 0,
    desc: T('Формат Unix-to-Unix: строки с символом длины в начале; строки begin/end игнорируются. #0V%T → Cat.', 'Unix-to-Unix format: lines start with a length character; begin/end lines are ignored. #0V%T → Cat.'),
    params: [],
    run([t]) { return uuDecode(t); },
    probes(t) { return /^begin\s+\d{3,4}\s+\S+/m.test(t) ? [{}] : []; },
  });

  def({
    id: 'uuencode', name: T('Текст → uuencode', 'Text → uuencode'), cat: 'Кодировки', prior: 0,
    params: [{ key: 'header', label: T('Строки begin / end', 'begin / end lines'), type: 'bool', default: true }],
    run([t], p) { return uuEncode(C.toBytesAuto(t), p.header); },
  });

  // ===================== Quoted-printable =====================
  def({
    id: 'qp_decode', name: T('Quoted-printable → текст', 'Quoted-printable → text'), cat: 'Кодировки', prior: 0,
    desc: T('Почтовая кодировка: =D0=9F → байты; «=» в конце строки — мягкий перенос.', 'Mail encoding: =D0=9F → bytes; a trailing “=” is a soft line break.'),
    params: [{ key: 'enc', label: T('Кодировка', 'Encoding'), type: 'select', options: ENC_OPTIONS, default: 'utf8' }],
    run([t], p) {
      const bin = t.replace(/=[ \t]*\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
      if (!isBytes(bin)) return bin;
      return C.decodeBytes(bin, p.enc);
    },
    probes(t) { return (t.match(/=[0-9A-F]{2}/g) || []).length >= 2 ? [{ enc: 'utf8' }, { enc: 'cp1251' }] : []; },
  });

  def({
    id: 'qp_encode', name: T('Текст → quoted-printable', 'Text → quoted-printable'), cat: 'Кодировки', prior: 0,
    params: [{ key: 'enc', label: T('Кодировка', 'Encoding'), type: 'select', options: ENC_OPTIONS.slice(0, 2), default: 'utf8' }],
    run([t], p) {
      const bin = C.encodeText(t, p.enc);
      return bin.split(/\r?\n/).map((line) => {
        const cells = Array.from(line, (ch, i) => {
          const c = ch.charCodeAt(0);
          const trailing = (c === 32 || c === 9) && i === line.length - 1;
          return (c >= 33 && c <= 126 && c !== 61) || ((c === 32 || c === 9) && !trailing) ? ch : '=' + hex2(c);
        });
        let out = '';
        let width = 0;
        for (const cell of cells) {
          if (width + cell.length > 75) { out += '=\n'; width = 0; }
          out += cell;
          width += cell.length;
        }
        return out;
      }).join('\n');
    },
  });

  // ===================== Punycode (RFC 3492) =====================
  const PUNY = { base: 36, tMin: 1, tMax: 26, skew: 38, damp: 700, bias: 72, n: 128 };
  const punyDigit = (d) => String.fromCharCode(d < 26 ? 97 + d : 22 + d);
  const punyValue = (ch) => {
    const c = ch.charCodeAt(0);
    if (c >= 48 && c <= 57) return c - 22;
    if (c >= 65 && c <= 90) return c - 65;
    if (c >= 97 && c <= 122) return c - 97;
    return PUNY.base;
  };
  const punyThreshold = (k, bias) => (k <= bias ? PUNY.tMin : k >= bias + PUNY.tMax ? PUNY.tMax : k - bias);

  function punyAdapt(delta, points, first) {
    let d = first ? Math.floor(delta / PUNY.damp) : delta >> 1;
    d += Math.floor(d / points);
    let k = 0;
    while (d > (((PUNY.base - PUNY.tMin) * PUNY.tMax) >> 1)) { d = Math.floor(d / (PUNY.base - PUNY.tMin)); k += PUNY.base; }
    return k + Math.floor(((PUNY.base - PUNY.tMin + 1) * d) / (d + PUNY.skew));
  }

  function punyEncode(str) {
    const input = Array.from(str, (ch) => ch.codePointAt(0));
    let out = input.filter((c) => c < 128).map((c) => String.fromCharCode(c)).join('');
    const basic = out.length;
    let h = basic;
    if (basic) out += '-';
    let { n, bias } = PUNY;
    let delta = 0;
    while (h < input.length) {
      const m = Math.min(...input.filter((c) => c >= n));
      delta += (m - n) * (h + 1);
      n = m;
      for (const c of input) {
        if (c < n) delta++;
        if (c !== n) continue;
        let q = delta;
        for (let k = PUNY.base; ; k += PUNY.base) {
          const t = punyThreshold(k, bias);
          if (q < t) break;
          out += punyDigit(t + ((q - t) % (PUNY.base - t)));
          q = Math.floor((q - t) / (PUNY.base - t));
        }
        out += punyDigit(q);
        bias = punyAdapt(delta, h + 1, h === basic);
        delta = 0;
        h++;
      }
      delta++;
      n++;
    }
    return out;
  }

  function punyDecode(str) {
    const split = str.lastIndexOf('-');
    const out = Array.from(split > 0 ? str.slice(0, split) : '', (ch) => ch.codePointAt(0));
    let { n, bias } = PUNY;
    let i = 0;
    for (let pos = split > 0 ? split + 1 : 0; pos < str.length;) {
      const oldI = i;
      for (let w = 1, k = PUNY.base; ; k += PUNY.base) {
        if (pos >= str.length) fail('Неполная запись Punycode', 'Truncated Punycode');
        const digit = punyValue(str[pos++]);
        if (digit >= PUNY.base) fail('Недопустимый символ Punycode «' + str[pos - 1] + '»', 'Invalid Punycode character “' + str[pos - 1] + '”');
        i += digit * w;
        const t = punyThreshold(k, bias);
        if (digit < t) break;
        w *= PUNY.base - t;
      }
      bias = punyAdapt(i - oldI, out.length + 1, oldI === 0);
      n += Math.floor(i / (out.length + 1));
      i %= out.length + 1;
      out.splice(i++, 0, n);
    }
    return String.fromCodePoint(...out);
  }

  def({
    id: 'punycode_decode', name: T('Punycode → Unicode', 'Punycode → Unicode'), cat: 'Кодировки', prior: 0,
    desc: T('xn--mnchen-3ya → münchen. Если в строке нет «xn--», она читается целиком как «сырой» Punycode (bcher-kva → bücher).', 'xn--mnchen-3ya → münchen. If the string has no “xn--”, it is read whole as raw Punycode (bcher-kva → bücher).'),
    params: [],
    run([t]) {
      const s = t.trim();
      if (!/xn--/i.test(s)) return punyDecode(s);
      return s.split('.').map((label) => (/^xn--/i.test(label) ? punyDecode(label.slice(4)) : label)).join('.');
    },
    probes(t) { return /(^|[.\s/])xn--[a-z0-9-]+/i.test(t) ? [{}] : []; },
  });

  def({
    id: 'punycode_encode', name: T('Unicode → Punycode', 'Unicode → Punycode'), cat: 'Кодировки', prior: 0,
    params: [{ key: 'prefix', label: T('Префикс xn-- (домен)', 'xn-- prefix (domain)'), type: 'bool', default: true }],
    run([t], p) {
      if (!p.prefix) return punyEncode(t.trim());
      return t.trim().split('.').map((label) => (/[^\u0000-\u007f]/.test(label) ? 'xn--' + punyEncode(label) : label)).join('.');
    },
  });

  // ===================== ROT5 / ROT18 / ROT8000 =====================
  const rot5 = (s) => s.replace(/[0-9]/g, (d) => String((Number(d) + 5) % 10));
  const rot13 = (s) => s.replace(/[a-z]/gi, (ch) => { const base = ch <= 'Z' ? 65 : 97; return String.fromCharCode(((ch.charCodeAt(0) - base + 13) % 26) + base); });

  def({
    id: 'rot5', name: 'ROT5', cat: 'Сдвиги', prior: 0,
    desc: T('Цифры сдвигаются на 5 (0↔5, 1↔6 …), остальное не меняется. Обратим сам себе.', 'Digits are shifted by 5 (0↔5, 1↔6 …), everything else is unchanged. It is its own inverse.'),
    params: [],
    run([t]) { return rot5(t); },
  });

  def({
    id: 'rot18', name: 'ROT18', cat: 'Сдвиги', prior: 0,
    desc: T('ROT13 для латинских букв и ROT5 для цифр одновременно.', 'ROT13 for Latin letters and ROT5 for digits at once.'),
    params: [],
    run([t]) { return rot5(rot13(t)); },
  });

  // Допустимые знаки BMP задаются переходами «с кода N допустимо/недопустимо» (как в rottytooth/rot8000):
  // пробельные, управляющие и суррогаты не трогаются; остальные вращаются на половину списка.
  const R8_TRANSITIONS = [[33, true], [127, false], [161, true], [5760, false], [5761, true], [8192, false], [8203, true], [8232, false], [8234, true], [8239, false], [8240, true], [8287, false], [8288, true], [12288, false], [12289, true], [55296, false], [57344, true]];
  let r8Map = null;

  function rot8000Map() {
    if (r8Map) return r8Map;
    const valid = [];
    let ok = false;
    let ti = 0;
    for (let c = 0; c < 0x10000; c++) {
      if (ti < R8_TRANSITIONS.length && R8_TRANSITIONS[ti][0] === c) ok = R8_TRANSITIONS[ti++][1];
      if (ok) valid.push(c);
    }
    const half = valid.length / 2;
    r8Map = new Int32Array(0x10000).fill(-1);
    valid.forEach((c, i) => { r8Map[c] = valid[(i + half) % valid.length]; });
    return r8Map;
  }

  def({
    id: 'rot8000', name: 'ROT8000', cat: 'Сдвиги', prior: 0,
    desc: T('«ROT13 для Юникода»: знаки BMP вращаются на половину списка допустимых (A → 籊). Пробелы, управляющие и эмодзи вне BMP не меняются. Обратим сам себе.',
      '“ROT13 for Unicode”: BMP characters rotate by half of the valid list (A → 籊). Whitespace, controls and non-BMP emoji are unchanged. It is its own inverse.'),
    params: [],
    run([t]) {
      const map = rot8000Map();
      let out = '';
      for (let i = 0; i < t.length; i++) {
        const m = map[t.charCodeAt(i)];
        out += m < 0 ? t[i] : String.fromCharCode(m);
      }
      return out;
    },
    probes(t) { return t.length >= 3 && /[一-鿿]/.test(t) && !/[a-z]/i.test(t) ? [{}] : []; },
  });

  // ===================== Двоичное → «пиксели» =====================
  // Чистая функция: строки из 0/1 → строки символов. Сам QR читает модуль изображений, здесь — только вид сетки.
  function bitsToPixels(text, o) {
    const rows = [];
    if (o.width > 0 || !/\n/.test(text.trim())) {
      const bits = text.replace(/[^01]/g, '');
      if (!bits) fail('Нет нулей и единиц', 'No zeros and ones');
      const width = o.width > 0 ? o.width : Math.round(Math.sqrt(bits.length));
      if (o.width <= 0 && width * width !== bits.length) fail('Не квадрат (' + bits.length + ' бит): укажите ширину строки', 'Not a square (' + bits.length + ' bits): set the row width');
      for (let i = 0; i < bits.length; i += width) rows.push(bits.slice(i, i + width).padEnd(width, '0'));
    } else {
      for (const line of text.split(/\r?\n/)) {
        const bits = line.replace(/[^01]/g, '');
        if (bits) rows.push(bits);
      }
    }
    return rows.map((row) => Array.from(row, (bit) => (((bit === '1') !== o.invert) ? o.on : o.off).repeat(o.scale)).join('')).join('\n');
  }

  def({
    id: 'binary_pixels', name: T('Двоичное → пиксельная сетка', 'Binary → pixel grid'), cat: 'Кодировки', prior: 0,
    desc: T('Строки из 0 и 1 рисуются знаками: 1 = █, 0 = пробел. Ширина 0 — по строкам ввода или по квадратному корню (QR-подобные сетки). Распознавание QR с картинки — в разделе изображений.',
      'Rows of 0 and 1 are drawn with characters: 1 = █, 0 = space. Width 0 uses the input lines or the square root (QR-like grids). Reading a QR from an image is done in the images tools.'),
    params: [
      { key: 'width', label: T('Ширина строки (0 — авто)', 'Row width (0 = auto)'), type: 'number', default: 0 },
      { key: 'on', label: T('Знак для 1', 'Character for 1'), type: 'text', default: '█' },
      { key: 'off', label: T('Знак для 0', 'Character for 0'), type: 'text', default: ' ' },
      { key: 'scale', label: T('Повтор по горизонтали', 'Horizontal repeat'), type: 'number', default: 2 },
      { key: 'invert', label: T('Инвертировать', 'Invert'), type: 'bool', default: false },
    ],
    run([t], p) {
      return bitsToPixels(t, { width: Math.floor(Number(p.width)) || 0, on: p.on || '█', off: p.off === '' ? ' ' : p.off, scale: Math.max(1, Math.floor(Number(p.scale)) || 1), invert: !!p.invert });
    },
  });

  G.Encodings = { base91Decode, base91Encode, uuDecode, uuEncode, punyEncode, punyDecode, bitsToPixels };
})(typeof self !== 'undefined' ? self : this);
