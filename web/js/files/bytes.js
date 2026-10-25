// Общие байтовые помощники пакета «Файлы и хеши»: чтение чисел, hex, кодировки, артефакты.
// Всё, что не трогает DOM, работает на Uint8Array и проверяется в Node.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = (G.ArgFiles = G.ArgFiles || {});

  const HEX = '0123456789abcdef';
  const MAX_DERIVED = 96 * 1048576; // защита от копирования гигантских вложений в dataURL

  function toHex(bytes, sep) {
    const s = sep === undefined ? '' : sep;
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += (i && s ? s : '') + HEX[bytes[i] >> 4] + HEX[bytes[i] & 15];
    return out;
  }

  /** Строгий разбор hex: пробелы, двоеточия и 0x допускаются. */
  function hexToBytes(str) {
    const clean = String(str).replace(/0x/gi, '').replace(/[\s,:;-]/g, '');
    if (!/^[0-9a-f]*$/i.test(clean)) throw new Error(T('В строке есть не-hex символы', 'The string contains non-hex characters'));
    if (clean.length % 2) throw new Error(T('Нечётное число hex-цифр', 'Odd number of hex digits'));
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
  }

  const u16le = (b, o) => b[o] | (b[o + 1] << 8);
  const u16be = (b, o) => (b[o] << 8) | b[o + 1];
  const u32le = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const u32be = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const u64le = (b, o) => u32le(b, o) + u32le(b, o + 4) * 4294967296;

  function ascii(b, start, end) {
    let s = '';
    const stop = Math.min(end === undefined ? b.length : end, b.length);
    for (let i = start || 0; i < stop; i++) s += String.fromCharCode(b[i]);
    return s;
  }

  function startsWith(b, sig, off) {
    const o = off || 0;
    if (b.length < o + sig.length) return false;
    for (let i = 0; i < sig.length; i++) if (b[o + i] !== sig[i]) return false;
    return true;
  }

  function indexOfBytes(hay, needle, from) {
    const n = needle.length;
    if (!n) return -1;
    const first = needle[0];
    const last = hay.length - n;
    for (let i = from || 0; i <= last; i++) {
      if (hay[i] !== first) continue;
      let j = 1;
      while (j < n && hay[i + j] === needle[j]) j++;
      if (j === n) return i;
    }
    return -1;
  }

  const strBytes = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 255);

  function concat(parts) {
    const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  /** Текст → байты в явной кодировке: utf8, cp1251, latin1 (символ = байт). */
  function encodeString(text, enc) {
    const e = enc || 'utf8';
    if (e === 'utf8') return new TextEncoder().encode(text);
    if (!G.Codec) throw new Error(T('Не загружен модуль кодеков', 'Codec module is not loaded'));
    return G.Codec.binToArray(G.Codec.encodeText(text, e));
  }

  const decodeUtf8 = (b) => new TextDecoder('utf-8').decode(b);
  const decodeLatin1 = (b) => ascii(b, 0, b.length);

  // ---------- артефакты ----------
  const isHandle = (v) => !!(G.Artifacts && G.Artifacts.isHandle(v));

  /** Байты артефакта по ручке "artifact:<id>" (кэшируются: распаковка dataURL дорога). */
  function artifactBytes(value) {
    const A = G.Artifacts;
    const item = A.require(value);
    const rt = A.runtimeGet(item.id);
    if (rt && ArrayBuffer.isView(rt)) return new Uint8Array(rt.buffer, rt.byteOffset, rt.byteLength);
    const cached = A.runtimeGet('bytes:' + item.id);
    if (cached) return cached;
    const bytes = A.bytes(item.id);
    if (!bytes) throw new Error(T('У артефакта нет данных', 'The artifact has no data'));
    A.runtimeSet('bytes:' + item.id, bytes);
    return bytes;
  }

  /** Вход графа → байты: ручка артефакта или текст в указанной кодировке. */
  function bytesOf(value, enc) {
    if (isHandle(value)) return artifactBytes(value);
    return encodeString(String(value === undefined || value === null ? '' : value), enc);
  }

  /** Вход графа → байты без явной кодировки: ручка файла; строка из символов 0–255 — как есть (результат hex/base64), иначе UTF-8. */
  function bytesAuto(value) {
    if (isHandle(value)) return artifactBytes(value);
    const text = String(value === undefined || value === null ? '' : value);
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) > 255) return encodeString(text, 'utf8');
    return strBytes(text);
  }

  /** Строго артефакт (для нод файлов): понятная ошибка, если пришёл текст. */
  function requireArtifactBytes(value) {
    if (!isHandle(value)) throw new Error(T('Подключи артефакт (нода «Артефакт (файл)»)', 'Connect an artifact (the “Artifact (file)” node)'));
    return artifactBytes(value);
  }

  function toBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(bin);
  }

  const toDataUrl = (bytes, mime) => 'data:' + (mime || 'application/octet-stream') + ';base64,' + toBase64(bytes);

  function kindOf(mime, name) {
    const m = (mime || '').toLowerCase();
    if (m.startsWith('image/')) return 'image';
    if (m.startsWith('audio/')) return 'audio';
    if (m.startsWith('video/')) return 'video';
    if (m.startsWith('text/') || /\.(txt|log|json|md|csv)$/i.test(name || '')) return 'text';
    return 'file';
  }

  /** Производный артефакт (память): ключ детерминирован, поэтому при пересчёте графа id не меняется. */
  function derive(key, name, bytes, mime) {
    const A = G.Artifacts;
    if (!A) throw new Error(T('Хранилище артефактов недоступно', 'Artifact store is unavailable'));
    if (bytes.length > MAX_DERIVED) throw new Error(T('Файл слишком велик для передачи как артефакт', 'The file is too large to pass on as an artifact'));
    const id = 'd_' + key;
    if (!A.has(id)) {
      const m = mime || 'application/octet-stream';
      A.addDerived(key, kindOf(m, name), bytes, { name, mime: m, size: bytes.length, dataUrl: toDataUrl(bytes, m), sha256: null });
    }
    return A.handle(id);
  }

  /** Постоянный артефакт проекта (сохраняется вместе с графом). @returns {Promise<string>} ручка */
  async function saveAsArtifact(bytes, name, mime) {
    const m = mime || 'application/octet-stream';
    const id = await G.Artifacts.addDataUrl(toDataUrl(bytes, m), name, m);
    return G.Artifacts.handle(id);
  }

  function fmtSize(n) {
    if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
    if (n >= 1048576) return (n / 1048576).toFixed(2) + ' MB';
    if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
    return n + ' B';
  }

  const hex = (n, w) => '0x' + n.toString(16).toUpperCase().padStart(w || 1, '0');

  // Короткий ключ из строки (для идентификаторов производных артефактов).
  function keyOf(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = (Math.imul(h, 33) + str.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  Object.assign(NS, {
    toHex, hexToBytes, u16le, u16be, u32le, u32be, u64le, ascii, startsWith, indexOfBytes, strBytes, concat,
    encodeString, decodeUtf8, decodeLatin1, isHandle, artifactBytes, bytesOf, bytesAuto, requireArtifactBytes,
    toBase64, toDataUrl, kindOf, derive, saveAsArtifact, fmtSize, hex, keyOf, MAX_DERIVED,
  });
})(typeof self !== 'undefined' ? self : this);
