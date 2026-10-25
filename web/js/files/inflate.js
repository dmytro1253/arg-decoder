// Распаковка deflate/gzip. Синхронная версия на чистом JS (по мотивам puff.c) нужна графу, где вычисления
// синхронны; асинхронная использует нативный DecompressionStream('deflate-raw'), если он есть.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = (G.ArgFiles = G.ArgFiles || {});

  const MAX_OUT = 256 * 1048576; // защита от zip-бомб
  const RAW_SLACK = 1;           // байт после конца сырого deflate, допустимых в «авто» (дополнение до байта уже внутри)
  const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  const corrupt = () => new Error(T('Повреждённые данные deflate', 'Corrupt deflate data'));

  // Таблица Хаффмана: count[len] — число кодов длины len, symbol — символы по порядку кодов.
  function huffman(lengths, n) {
    const count = new Uint16Array(16);
    for (let i = 0; i < n; i++) count[lengths[i]]++;
    const offs = new Uint16Array(16);
    for (let len = 1; len < 15; len++) offs[len + 1] = offs[len] + count[len];
    const symbol = new Uint16Array(n);
    for (let i = 0; i < n; i++) if (lengths[i]) symbol[offs[lengths[i]]++] = i;
    return { count, symbol };
  }

  let FIXED = null;
  function fixedTables() {
    if (FIXED) return FIXED;
    const l = new Uint8Array(288);
    l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288);
    FIXED = { lit: huffman(l, 288), dist: huffman(new Uint8Array(30).fill(5), 30) };
    return FIXED;
  }

  /**
   * Распаковать сырой deflate.
   * @param {Uint8Array} src
   * @param {{maxOut?:number, truncate?:boolean}} [opts] truncate — вернуть то, что успели распаковать, вместо ошибки
   * @returns {Uint8Array}
   */
  function inflateRaw(src, opts) {
    const o = opts || {};
    const maxOut = o.maxOut || MAX_OUT;
    let out = new Uint8Array(Math.min(Math.max(src.length * 3, 1024), maxOut));
    let outPos = 0;
    let pos = 0;
    let bitBuf = 0;
    let bitCnt = 0;
    let stop = false;

    const ensure = (extra) => {
      if (outPos + extra <= out.length) return;
      if (outPos + extra > maxOut) {
        if (o.truncate) { stop = true; return; }
        throw new Error(T('Распакованные данные слишком велики (защита от архивной бомбы)', 'Decompressed data is too large (archive bomb protection)'));
      }
      const bigger = new Uint8Array(Math.min(Math.max(out.length * 2, outPos + extra), maxOut));
      bigger.set(out.subarray(0, outPos));
      out = bigger;
    };
    const bits = (need) => {
      let val = bitBuf;
      while (bitCnt < need) {
        if (pos >= src.length) throw new Error(T('Данные deflate оборваны', 'Truncated deflate data'));
        val |= src[pos++] << bitCnt;
        bitCnt += 8;
      }
      bitBuf = val >>> need;
      bitCnt -= need;
      return val & ((1 << need) - 1);
    };
    const decode = (h) => {
      let code = 0, first = 0, index = 0;
      for (let len = 1; len <= 15; len++) {
        code |= bits(1);
        const c = h.count[len];
        if (code - c < first) return h.symbol[index + (code - first)];
        index += c; first += c; first <<= 1; code <<= 1;
      }
      throw corrupt();
    };

    const codes = (lit, dist) => {
      for (;;) {
        const sym = decode(lit);
        if (sym < 256) { ensure(1); if (stop) return; out[outPos++] = sym; continue; }
        if (sym === 256) return;
        const s = sym - 257;
        if (s >= 29) throw corrupt();
        const len = LEN_BASE[s] + bits(LEN_EXTRA[s]);
        const ds = decode(dist);
        if (ds >= 30) throw corrupt();
        const d = DIST_BASE[ds] + bits(DIST_EXTRA[ds]);
        if (d > outPos) throw corrupt();
        ensure(len);
        if (stop) return;
        for (let i = 0; i < len; i++, outPos++) out[outPos] = out[outPos - d];
      }
    };

    const dynamic = () => {
      const nlen = bits(5) + 257;
      const ndist = bits(5) + 1;
      const ncode = bits(4) + 4;
      if (nlen > 286 || ndist > 30) throw corrupt();
      const lengths = new Uint8Array(320);
      for (let i = 0; i < ncode; i++) lengths[CL_ORDER[i]] = bits(3);
      const cl = huffman(lengths.subarray(0, 19), 19);
      const all = new Uint8Array(nlen + ndist);
      for (let i = 0; i < nlen + ndist;) {
        const sym = decode(cl);
        if (sym < 16) { all[i++] = sym; continue; }
        let rep, val = 0;
        if (sym === 16) { if (i === 0) throw corrupt(); val = all[i - 1]; rep = 3 + bits(2); }
        else if (sym === 17) rep = 3 + bits(3);
        else rep = 11 + bits(7);
        if (i + rep > nlen + ndist) throw corrupt();
        while (rep--) all[i++] = val;
      }
      if (!all[256]) throw corrupt();
      codes(huffman(all.subarray(0, nlen), nlen), huffman(all.subarray(nlen), ndist));
    };

    try {
      let last;
      do {
        last = bits(1);
        const type = bits(2);
        if (type === 0) {
          bitBuf = 0; bitCnt = 0;
          if (pos + 4 > src.length) throw new Error(T('Данные deflate оборваны', 'Truncated deflate data'));
          const len = src[pos] | (src[pos + 1] << 8);
          if ((len ^ (src[pos + 2] | (src[pos + 3] << 8))) !== 0xffff) throw corrupt();
          pos += 4;
          if (pos + len > src.length) throw new Error(T('Данные deflate оборваны', 'Truncated deflate data'));
          ensure(len);
          if (stop) break;
          out.set(src.subarray(pos, pos + len), outPos);
          outPos += len; pos += len;
        } else if (type === 1) {
          const f = fixedTables();
          codes(f.lit, f.dist);
        } else if (type === 2) dynamic();
        else throw corrupt();
      } while (!last && !stop);
    } catch (e) {
      if (!o.truncate) throw e;
    }
    if (o.info) o.info.end = pos;   // сколько байт входа занял поток (дальше — хвост zlib/gzip или мусор)
    return out.slice(0, outPos);
  }

  const adler32 = (b) => {
    let a = 1, c = 0;
    for (let i = 0; i < b.length; i++) { a = (a + b[i]) % 65521; c = (c + a) % 65521; }
    return ((c << 16) | a) >>> 0;
  };
  const u32be = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  const u32le = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

  /** Заголовок zlib (RFC 1950): метод 8, окно ≤ 32 КБ, CMF·256+FLG делится на 31. */
  const isZlib = (b) => b.length >= 6 && (b[0] & 15) === 8 && b[0] >> 4 <= 7 && ((b[0] << 8) | b[1]) % 31 === 0;
  const isGzip = (b) => b.length >= 18 && b[0] === 0x1f && b[1] === 0x8b && b[2] === 8;
  /** Формат по заголовку без распаковки: 'gzip' | 'zlib' | null (сырой deflate заголовка не имеет). */
  const detect = (b) => (isGzip(b) ? 'gzip' : isZlib(b) ? 'zlib' : null);

  /** zlib: заголовок, deflate, Adler-32. @returns {{data, checksum:'ok'|'bad'|'missing', dict:boolean}} */
  function zlibInflate(src, opts) {
    if (!isZlib(src)) throw new Error(T('Это не zlib: неверный заголовок', 'Not zlib: invalid header'));
    if (src[1] & 0x20) throw new Error(T('zlib с внешним словарём (FDICT) — без словаря не распаковать', 'zlib with a preset dictionary (FDICT): cannot inflate without the dictionary'));
    const info = {};
    const data = inflateRaw(src.subarray(2), Object.assign({}, opts, { info }));
    const tail = 2 + info.end;
    const checksum = tail + 4 > src.length ? 'missing' : u32be(src, tail) === adler32(data) ? 'ok' : 'bad';
    return { data, checksum, trailing: Math.max(0, src.length - tail - 4) };
  }

  /** gzip: заголовок + deflate. @returns {{data:Uint8Array, name:string|null}} */
  function gunzip(src, opts) {
    if (src.length < 18 || src[0] !== 0x1f || src[1] !== 0x8b || src[2] !== 8) throw new Error(T('Это не gzip', 'Not a gzip stream'));
    const flags = src[3];
    let pos = 10;
    let name = null;
    if (flags & 4) pos += 2 + (src[pos] | (src[pos + 1] << 8));
    if (flags & 8) { const e = src.indexOf(0, pos); name = NS.ascii(src, pos, e); pos = e + 1; }
    if (flags & 16) pos = src.indexOf(0, pos) + 1;
    if (flags & 2) pos += 2;
    if (pos <= 0 || pos >= src.length) throw new Error(T('Повреждённый заголовок gzip', 'Corrupt gzip header'));
    const info = {};
    const data = inflateRaw(src.subarray(pos), Object.assign({}, opts, { info }));
    const tail = pos + info.end;
    let checksum = 'missing';
    if (tail + 8 <= src.length && NS.Hash) checksum = u32le(src, tail) === NS.Hash.crc32(data) && u32le(src, tail + 4) === (data.length >>> 0) ? 'ok' : 'bad';
    return { data, name, checksum, trailing: Math.max(0, src.length - tail - 8) };
  }

  /**
   * Распаковка с выбором формата: 'auto' | 'zlib' | 'gzip' | 'raw'. В «авто» формат — по заголовку; без заголовка
   * сырой deflate принимается, только если поток занял почти весь вход (иначе это, скорее всего, не deflate).
   * @returns {{data:Uint8Array, format:string, checksum:'ok'|'bad'|'missing'|'none', name:string|null, trailing:number}}
   */
  function decompress(src, opts) {
    const o = Object.assign({ format: 'auto' }, opts);
    const fmt = o.format === 'auto' ? detect(src) || 'raw' : o.format;
    if (fmt === 'gzip') return Object.assign({ format: 'gzip' }, gunzip(src, o));
    if (fmt === 'zlib') return Object.assign({ format: 'zlib', name: null }, zlibInflate(src, o));
    if (fmt !== 'raw') throw new Error(T('Неизвестный формат: ', 'Unknown format: ') + fmt);
    const info = {};
    const data = inflateRaw(src, Object.assign({}, o, { info }));
    const trailing = src.length - info.end;
    if (o.format === 'auto' && trailing > RAW_SLACK) throw new Error(T('Не похоже на сжатые данные: заголовка zlib/gzip нет, а сырой deflate закончился раньше конца входа', 'Does not look compressed: no zlib/gzip header, and raw deflate ended before the end of the input'));
    return { data, format: 'raw', checksum: 'none', name: null, trailing };
  }

  /** Асинхронная распаковка: нативный поток, при любой неудаче — чистый JS. */
  async function inflateRawAsync(src, opts) {
    const DS = G.DecompressionStream;
    if (typeof DS === 'function' && src.length > 4096) {
      try {
        const ds = new DS('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(src).catch(() => {});
        writer.close().catch(() => {});
        const reader = ds.readable.getReader();
        const chunks = [];
        let total = 0;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          total += value.length;
          if (total > ((opts && opts.maxOut) || MAX_OUT)) { reader.cancel().catch(() => {}); throw new Error('too large'); }
          chunks.push(value);
        }
        return NS.concat(chunks);
      } catch (e) { /* нативный поток не справился — повторим сами: так ошибки будут понятными */ }
    }
    return inflateRaw(src, opts);
  }

  NS.Inflate = { inflateRaw, inflateRawAsync, gunzip, zlibInflate, decompress, detect, adler32, MAX_OUT };
})(typeof self !== 'undefined' ? self : this);
