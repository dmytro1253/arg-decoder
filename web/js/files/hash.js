// Хеши на чистом JS (синхронные, без crypto.subtle): MD5, SHA-1, SHA-256, SHA-512, CRC32.
// Вход — Uint8Array, выход — Uint8Array (CRC32 — число). Константы SHA-2 вычисляются из простых чисел.
(function (G) {
  'use strict';
  const NS = (G.ArgFiles = G.ArgFiles || {});

  const rotl = (x, n) => (x << n) | (x >>> (32 - n));
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  // Дополнение хвоста: остаток + 0x80 + нули + длина в битах (big- или little-endian).
  function padTail(data, blockSize, lenBytes, bigEndian) {
    const full = data.length - (data.length % blockSize);
    const rest = data.length - full;
    const total = rest + 1 + lenBytes <= blockSize ? blockSize : blockSize * 2;
    const tail = new Uint8Array(total);
    tail.set(data.subarray(full), 0);
    tail[rest] = 0x80;
    const bits = data.length * 8;
    const lo = bits >>> 0;
    const hi = Math.floor(bits / 4294967296);
    const base = total - 8;
    for (let i = 0; i < 4; i++) {
      if (bigEndian) { tail[base + 3 - i] = (hi >>> (8 * i)) & 255; tail[base + 7 - i] = (lo >>> (8 * i)) & 255; }
      else { tail[base + i] = (lo >>> (8 * i)) & 255; tail[base + 4 + i] = (hi >>> (8 * i)) & 255; }
    }
    return { full, tail };
  }

  // Обработка всех блоков: целая часть входа напрямую, затем дополненный хвост.
  function eachBlock(data, blockSize, lenBytes, bigEndian, block) {
    const { full, tail } = padTail(data, blockSize, lenBytes, bigEndian);
    for (let o = 0; o < full; o += blockSize) block(data, o);
    for (let o = 0; o < tail.length; o += blockSize) block(tail, o);
  }

  function wordsOut(h, count, bigEndian) {
    const out = new Uint8Array(count * 4);
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < 4; j++) out[i * 4 + j] = (h[i] >>> (bigEndian ? 24 - 8 * j : 8 * j)) & 255;
    }
    return out;
  }

  // ---------- MD5 ----------
  const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  let MD5_K = null;

  function md5(data) {
    if (!MD5_K) MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296));
    const st = [0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476];
    const M = new Uint32Array(16);
    eachBlock(data, 64, 8, false, (buf, off) => {
      for (let i = 0; i < 16; i++) M[i] = buf[off + 4 * i] | (buf[off + 4 * i + 1] << 8) | (buf[off + 4 * i + 2] << 16) | (buf[off + 4 * i + 3] << 24);
      let A = st[0], B = st[1], C = st[2], D = st[3];
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
        else { F = C ^ (B | ~D); g = (7 * i) & 15; }
        F = (F + A + MD5_K[i] + M[g]) | 0;
        A = D; D = C; C = B;
        B = (B + rotl(F, MD5_S[(i >> 4) * 4 + (i & 3)])) | 0;
      }
      st[0] = (st[0] + A) | 0; st[1] = (st[1] + B) | 0; st[2] = (st[2] + C) | 0; st[3] = (st[3] + D) | 0;
    });
    return wordsOut(st, 4, false);
  }

  // ---------- SHA-1 ----------
  function sha1(data) {
    const h = [0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476, 0xc3d2e1f0 | 0];
    const W = new Int32Array(80);
    eachBlock(data, 64, 8, true, (buf, off) => {
      for (let i = 0; i < 16; i++) W[i] = (buf[off + 4 * i] << 24) | (buf[off + 4 * i + 1] << 16) | (buf[off + 4 * i + 2] << 8) | buf[off + 4 * i + 3];
      for (let i = 16; i < 80; i++) W[i] = rotl(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
      let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];
      for (let i = 0; i < 80; i++) {
        let f, k;
        if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
        else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
        else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc | 0; }
        else { f = b ^ c ^ d; k = 0xca62c1d6 | 0; }
        const t = (rotl(a, 5) + f + e + k + W[i]) | 0;
        e = d; d = c; c = rotl(b, 30); b = a; a = t;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0; h[4] = (h[4] + e) | 0;
    });
    return wordsOut(h, 5, true);
  }

  // ---------- константы SHA-2 (дробные части корней простых чисел, точно через BigInt) ----------
  const FIRST_PRIMES = (() => {
    const p = [];
    for (let n = 2; p.length < 80; n++) if (p.every((q) => n % q)) p.push(n);
    return p;
  })();

  // Целая часть корня степени k из n (метод Ньютона сверху).
  function iroot(n, k) {
    const K = BigInt(k);
    let x = 1n << (BigInt(n.toString(2).length) / K + 1n);
    for (;;) {
      const y = ((K - 1n) * x + n / x ** (K - 1n)) / K;
      if (y >= x) return x;
      x = y;
    }
  }

  // Дробная часть корня простого числа с bits двоичными разрядами, как BigInt.
  const rootFrac = (prime, k, bits) => iroot(BigInt(prime) << BigInt(k * bits), k) & ((1n << BigInt(bits)) - 1n);

  let K256 = null;
  let K512 = null;

  function sha256(data) {
    if (!K256) K256 = Int32Array.from(FIRST_PRIMES.slice(0, 64), (p) => Number(rootFrac(p, 3, 32)));
    const h = Int32Array.from(FIRST_PRIMES.slice(0, 8), (p) => Number(rootFrac(p, 2, 32)));
    const W = new Int32Array(64);
    eachBlock(data, 64, 8, true, (buf, off) => {
      for (let i = 0; i < 16; i++) W[i] = (buf[off + 4 * i] << 24) | (buf[off + 4 * i + 1] << 16) | (buf[off + 4 * i + 2] << 8) | buf[off + 4 * i + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
        const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K256[i] + W[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    });
    return wordsOut(h, 8, true);
  }

  // ---------- SHA-512: 64-битные слова как пары (hi, lo) ----------
  const TWO32 = 4294967296;
  let rh = 0; // результат последнего вращения/сдвига: старшая и младшая половины
  let rl = 0;

  function rot64(hi, lo, n) {
    if (n < 32) { rh = (hi >>> n) | (lo << (32 - n)); rl = (lo >>> n) | (hi << (32 - n)); }
    else if (n === 32) { rh = lo; rl = hi; }
    else { const m = n - 32; rh = (lo >>> m) | (hi << (32 - m)); rl = (hi >>> m) | (lo << (32 - m)); }
  }

  function shr64(hi, lo, n) { rh = hi >>> n; rl = (lo >>> n) | (hi << (32 - n)); }

  // Расписание сообщения: W[16..79] по W[0..15].
  function sha512Schedule(W) {
    for (let i = 16; i < 80; i++) {
      const x15h = W[2 * (i - 15)], x15l = W[2 * (i - 15) + 1], x2h = W[2 * (i - 2)], x2l = W[2 * (i - 2) + 1];
      rot64(x15h, x15l, 1); let s0h = rh, s0l = rl;
      rot64(x15h, x15l, 8); s0h ^= rh; s0l ^= rl;
      shr64(x15h, x15l, 7); s0h ^= rh; s0l ^= rl;
      rot64(x2h, x2l, 19); let s1h = rh, s1l = rl;
      rot64(x2h, x2l, 61); s1h ^= rh; s1l ^= rl;
      shr64(x2h, x2l, 6); s1h ^= rh; s1l ^= rl;
      const lo = (W[2 * (i - 16) + 1] >>> 0) + (s0l >>> 0) + (W[2 * (i - 7) + 1] >>> 0) + (s1l >>> 0);
      const hi = (W[2 * (i - 16)] >>> 0) + (s0h >>> 0) + (W[2 * (i - 7)] >>> 0) + (s1h >>> 0) + Math.floor(lo / TWO32);
      W[2 * i] = hi >>> 0; W[2 * i + 1] = lo >>> 0;
    }
  }

  // Один раунд сжатия SHA-512; v — 16 половинок слов a..h, возвращает новое состояние.
  function sha512Round(v, i, W) {
    const [ah, al, bh, bl, ch, cl, dh, dl, eh, el, fh, fl, gh, gl, hh, hl] = v;
    rot64(eh, el, 14); let S1h = rh, S1l = rl;
    rot64(eh, el, 18); S1h ^= rh; S1l ^= rl;
    rot64(eh, el, 41); S1h ^= rh; S1l ^= rl;
    const chh = (eh & fh) ^ (~eh & gh), chl = (el & fl) ^ (~el & gl);
    const lo1 = (hl >>> 0) + (S1l >>> 0) + (chl >>> 0) + (K512[2 * i + 1] >>> 0) + (W[2 * i + 1] >>> 0);
    const hi1 = (hh >>> 0) + (S1h >>> 0) + (chh >>> 0) + (K512[2 * i] >>> 0) + (W[2 * i] >>> 0) + Math.floor(lo1 / TWO32);
    const t1h = hi1 >>> 0, t1l = lo1 >>> 0;
    rot64(ah, al, 28); let S0h = rh, S0l = rl;
    rot64(ah, al, 34); S0h ^= rh; S0l ^= rl;
    rot64(ah, al, 39); S0h ^= rh; S0l ^= rl;
    const mjh = (ah & bh) ^ (ah & ch) ^ (bh & ch), mjl = (al & bl) ^ (al & cl) ^ (bl & cl);
    const lo2 = (S0l >>> 0) + (mjl >>> 0);
    const t2h = ((S0h >>> 0) + (mjh >>> 0) + Math.floor(lo2 / TWO32)) >>> 0, t2l = lo2 >>> 0;
    const loE = (dl >>> 0) + t1l, hiE = (dh >>> 0) + t1h + Math.floor(loE / TWO32);
    const loA = t1l + t2l, hiA = t1h + t2h + Math.floor(loA / TWO32);
    return [hiA | 0, loA | 0, ah, al, bh, bl, ch, cl, hiE | 0, loE | 0, eh, el, fh, fl, gh, gl];
  }

  function sha512(data) {
    if (!K512) {
      K512 = new Int32Array(160);
      FIRST_PRIMES.forEach((p, i) => {
        const v = rootFrac(p, 3, 64);
        K512[2 * i] = Number(v >> 32n); K512[2 * i + 1] = Number(v & 0xffffffffn);
      });
    }
    const h = new Int32Array(16);
    FIRST_PRIMES.slice(0, 8).forEach((p, i) => {
      const v = rootFrac(p, 2, 64);
      h[2 * i] = Number(v >> 32n); h[2 * i + 1] = Number(v & 0xffffffffn);
    });
    const W = new Int32Array(160);
    eachBlock(data, 128, 16, true, (buf, off) => {
      for (let i = 0; i < 32; i++) W[i] = (buf[off + 4 * i] << 24) | (buf[off + 4 * i + 1] << 16) | (buf[off + 4 * i + 2] << 8) | buf[off + 4 * i + 3];
      sha512Schedule(W);
      let v = Array.from(h);
      for (let i = 0; i < 80; i++) v = sha512Round(v, i, W);
      for (let i = 0; i < 8; i++) {
        const lo = (h[2 * i + 1] >>> 0) + (v[2 * i + 1] >>> 0);
        h[2 * i] = ((h[2 * i] >>> 0) + (v[2 * i] >>> 0) + Math.floor(lo / TWO32)) | 0;
        h[2 * i + 1] = lo | 0;
      }
    });
    return wordsOut(h, 16, true);
  }

  // ---------- CRC32 ----------
  let CRC_TABLE = null;
  function crcTable() {
    if (CRC_TABLE) return CRC_TABLE;
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
    return CRC_TABLE;
  }

  /** CRC-32 (zip/png/gzip). prev — предыдущее значение для потокового счёта. @returns {number} unsigned */
  function crc32(data, prev) {
    const t = crcTable();
    let c = ((prev === undefined ? 0 : prev) ^ 0xffffffff) >>> 0;
    for (let i = 0; i < data.length; i++) c = t[(c ^ data[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  const crc32Bytes = (data) => {
    const c = crc32(data);
    return Uint8Array.of(c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255, c & 255);
  };

  const ALGS = {
    md5: { name: 'MD5', bytes: 16, fn: md5 },
    sha1: { name: 'SHA-1', bytes: 20, fn: sha1 },
    sha256: { name: 'SHA-256', bytes: 32, fn: sha256 },
    sha512: { name: 'SHA-512', bytes: 64, fn: sha512 },
    crc32: { name: 'CRC32', bytes: 4, fn: crc32Bytes },
  };
  // Длина hex-дайджеста → алгоритм, который мы умеем проверять.
  const BY_HEX_LENGTH = { 8: 'crc32', 32: 'md5', 40: 'sha1', 64: 'sha256', 128: 'sha512' };

  function hashHex(alg, data) {
    const a = ALGS[alg];
    if (!a) throw new Error('Unknown hash: ' + alg);
    return NS.toHex(a.fn(data));
  }

  NS.Hash = { md5, sha1, sha256, sha512, crc32, crcTable, ALGS, BY_HEX_LENGTH, hashHex };
})(typeof self !== 'undefined' ? self : this);
