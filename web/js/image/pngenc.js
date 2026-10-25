// Минимальный PNG-кодировщик без зависимостей: RGBA 8 бит, deflate «stored» (без сжатия).
// Нужен, чтобы отдать производное изображение как файл-артефакт без canvas (и в тестах Node).
// В браузере для скачивания обычно удобнее canvas.toBlob — этот кодировщик запасной.
(function (G) {
  'use strict';

  let crcTable = null;
  function crc32(bytes, start, end) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
      }
    }
    let c = 0xffffffff;
    for (let i = start; i < end; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function adler32(bytes) {
    let a = 1, b = 0;
    for (let i = 0; i < bytes.length; i++) {
      a = (a + bytes[i]) % 65521;
      b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
  }

  function u32(view, off, v) { view.setUint32(off, v >>> 0, false); }

  function chunk(type, body) {
    const out = new Uint8Array(12 + body.length);
    const view = new DataView(out.buffer);
    u32(view, 0, body.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(body, 8);
    u32(view, 8 + body.length, crc32(out, 4, 8 + body.length));
    return out;
  }

  /** Кодирует { width, height, data(RGBA) } в байты PNG. */
  function encode(img) {
    const { width, height, data } = img;
    const stride = width * 4 + 1;
    const raw = new Uint8Array(stride * height);
    for (let y = 0; y < height; y++) {
      raw[y * stride] = 0; // фильтр None
      raw.set(data.subarray(y * width * 4, (y + 1) * width * 4), y * stride + 1);
    }
    const blocks = Math.ceil(raw.length / 65535) || 1;
    const z = new Uint8Array(2 + raw.length + blocks * 5 + 4);
    z[0] = 0x78; z[1] = 0x01;
    let pos = 2;
    for (let off = 0; off < raw.length || off === 0; off += 65535) {
      const len = Math.min(65535, raw.length - off);
      const last = off + len >= raw.length ? 1 : 0;
      z[pos++] = last;
      z[pos++] = len & 255; z[pos++] = len >> 8;
      z[pos++] = ~len & 255; z[pos++] = (~len >> 8) & 255;
      z.set(raw.subarray(off, off + len), pos);
      pos += len;
      if (last) break;
    }
    new DataView(z.buffer).setUint32(pos, adler32(raw), false);
    const ihdr = new Uint8Array(13);
    const hv = new DataView(ihdr.buffer);
    hv.setUint32(0, width, false); hv.setUint32(4, height, false);
    ihdr[8] = 8; ihdr[9] = 6; // 8 бит, RGBA
    const parts = [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', z.subarray(0, pos + 4)), chunk('IEND', new Uint8Array(0))];
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  G.PngEnc = { encode, crc32, adler32 };
})(typeof self !== 'undefined' ? self : this);
