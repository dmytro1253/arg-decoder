// OpenSSL «Salted__»: детектор конверта и расшифровка (EVP_BytesToKey на MD5, AES-CBC/ECB/CTR, RC4).
// MD5 и AES написаны здесь же на чистом JS: файл не зависит от остальных модулей хешей.
(function (G) {
  'use strict';
  const C = G.Codec;
  const T = G.T || ((ru) => ru);
  const { def, keyOf } = G.CipherOps;

  const fail = (ru, en) => { throw new Error(T(ru, en)); };
  const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const MAGIC = 'Salted__';

  // ===================== MD5 =====================
  const MD5_SHIFT = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0);
  const rotl32 = (x, n) => (x << n) | (x >>> (32 - n));

  function md5(data) {
    const len = data.length;
    const padded = new Uint8Array(((len + 8) >> 6 << 6) + 64);
    padded.set(data);
    padded[len] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, (len << 3) >>> 0, true);
    view.setUint32(padded.length - 4, Math.floor(len / 536870912), true);
    let a0 = 0x67452301; let b0 = 0xefcdab89 | 0; let c0 = 0x98badcfe | 0; let d0 = 0x10325476;
    for (let off = 0; off < padded.length; off += 64) {
      let a = a0; let b = b0; let c = c0; let d = d0;
      for (let i = 0; i < 64; i++) {
        let f; let g;
        if (i < 16) { f = (b & c) | (~b & d); g = i; }
        else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
        else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
        else { f = c ^ (b | ~d); g = (7 * i) % 16; }
        const next = (f + a + MD5_K[i] + view.getUint32(off + g * 4, true)) | 0;
        a = d; d = c; c = b;
        b = (b + rotl32(next, MD5_SHIFT[(i >> 4) * 4 + (i % 4)])) | 0;
      }
      a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
    }
    const out = new Uint8Array(16);
    const ov = new DataView(out.buffer);
    [a0, b0, c0, d0].forEach((v, i) => ov.setUint32(i * 4, v >>> 0, true));
    return out;
  }

  const concat = (...parts) => {
    const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let pos = 0;
    for (const p of parts) { out.set(p, pos); pos += p.length; }
    return out;
  };

  // EVP_BytesToKey(MD5, count = 1): D1 = MD5(pass‖salt), Di = MD5(Di−1‖pass‖salt).
  function evpBytesToKey(password, salt, keyLen, ivLen) {
    let block = new Uint8Array(0);
    let all = new Uint8Array(0);
    while (all.length < keyLen + ivLen) {
      block = md5(concat(block, password, salt));
      all = concat(all, block);
    }
    return { key: all.slice(0, keyLen), iv: all.slice(keyLen, keyLen + ivLen) };
  }

  // ===================== AES =====================
  const SBOX = new Uint8Array(256);
  const INV_SBOX = new Uint8Array(256);
  (function buildSbox() {
    const rotl8 = (x, n) => ((x << n) | (x >> (8 - n))) & 255;
    let p = 1; let q = 1;
    do {
      p = (p ^ (p << 1) ^ (p & 0x80 ? 0x11b : 0)) & 255; // p *= 3
      q ^= q << 1; q &= 255; q ^= q << 2; q &= 255; q ^= q << 4; q &= 255; // q /= 3
      if (q & 0x80) q ^= 0x09;
      SBOX[p] = (q ^ rotl8(q, 1) ^ rotl8(q, 2) ^ rotl8(q, 3) ^ rotl8(q, 4) ^ 0x63) & 255;
    } while (p !== 1);
    SBOX[0] = 0x63;
    SBOX.forEach((v, i) => { INV_SBOX[v] = i; });
  })();

  const xtime = (a) => ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 255;
  function gmul(a, b) {
    let r = 0;
    for (let x = a, y = b; y; y >>= 1, x = xtime(x)) if (y & 1) r ^= x;
    return r;
  }

  function expandKey(key) {
    const nk = key.length / 4;
    if (![4, 6, 8].includes(nk)) fail('Длина ключа AES должна быть 16, 24 или 32 байта', 'AES key length must be 16, 24 or 32 bytes');
    const rounds = nk + 6;
    const w = [];
    for (let i = 0; i < nk; i++) w.push(Array.from(key.slice(4 * i, 4 * i + 4)));
    let rcon = 1;
    for (let i = nk; i < 4 * (rounds + 1); i++) {
      let t = w[i - 1].slice();
      if (i % nk === 0) { t = [t[1], t[2], t[3], t[0]].map((b) => SBOX[b]); t[0] ^= rcon; rcon = xtime(rcon); }
      else if (nk > 6 && i % nk === 4) t = t.map((b) => SBOX[b]);
      w.push(w[i - nk].map((b, j) => b ^ t[j]));
    }
    return { rounds, round: (r) => w.slice(4 * r, 4 * r + 4).flat() };
  }

  const addKey = (s, k) => s.map((b, i) => b ^ k[i]);
  const shiftRows = (s) => s.map((_, i) => s[(i % 4) + 4 * ((Math.floor(i / 4) + (i % 4)) % 4)]);
  const invShiftRows = (s) => { const o = new Array(16); s.forEach((b, i) => { o[(i % 4) + 4 * ((Math.floor(i / 4) + (i % 4)) % 4)] = b; }); return o; };
  const mixWith = (s, m) => {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[r + 4 * c] = m[r].reduce((acc, f, j) => acc ^ gmul(s[j + 4 * c], f), 0);
    return o;
  };
  const MIX = [[2, 3, 1, 1], [1, 2, 3, 1], [1, 1, 2, 3], [3, 1, 1, 2]];
  const INV_MIX = [[14, 11, 13, 9], [9, 14, 11, 13], [13, 9, 14, 11], [11, 13, 9, 14]];

  function aesEncryptBlock(block, ks) {
    let s = addKey(Array.from(block), ks.round(0));
    for (let r = 1; r < ks.rounds; r++) s = addKey(mixWith(shiftRows(s.map((b) => SBOX[b])), MIX), ks.round(r));
    return addKey(shiftRows(s.map((b) => SBOX[b])), ks.round(ks.rounds));
  }

  function aesDecryptBlock(block, ks) {
    let s = addKey(Array.from(block), ks.round(ks.rounds));
    for (let r = ks.rounds - 1; r >= 1; r--) s = mixWith(addKey(invShiftRows(s).map((b) => INV_SBOX[b]), ks.round(r)), INV_MIX);
    return addKey(invShiftRows(s).map((b) => INV_SBOX[b]), ks.round(0));
  }

  function pkcs7Unpad(bytes) {
    const n = bytes[bytes.length - 1];
    if (!bytes.length || n < 1 || n > 16 || bytes.slice(-n).some((b) => b !== n)) {
      fail('Неверный пароль, шифр или дайджест (дополнение PKCS#7 не сходится)', 'Wrong password, cipher or digest (PKCS#7 padding is invalid)');
    }
    return bytes.slice(0, bytes.length - n);
  }

  function aesDecrypt(data, key, iv, mode) {
    const ks = expandKey(key);
    const out = new Uint8Array(data.length);
    if (mode === 'ctr') {
      const counter = Array.from(iv);
      for (let i = 0; i < data.length; i += 16) {
        const stream = aesEncryptBlock(counter, ks);
        for (let j = 0; j < 16 && i + j < data.length; j++) out[i + j] = data[i + j] ^ stream[j];
        for (let k = 15; k >= 0 && ++counter[k] > 255; k--) counter[k] = 0;
      }
      return out;
    }
    if (data.length % 16 || !data.length) {
      fail('Длина шифртекста ' + data.length + ' не кратна 16: это не AES-CBC/ECB с дополнением (попробуйте CTR или RC4)', 'Ciphertext length ' + data.length + ' is not a multiple of 16: not padded AES-CBC/ECB (try CTR or RC4)');
    }
    let prev = Array.from(iv || []);
    for (let i = 0; i < data.length; i += 16) {
      const block = data.slice(i, i + 16);
      const plain = aesDecryptBlock(block, ks);
      out.set(mode === 'cbc' ? plain.map((b, j) => b ^ prev[j]) : plain, i);
      prev = Array.from(block);
    }
    return pkcs7Unpad(out);
  }

  function rc4(data, key) {
    const s = Uint8Array.from({ length: 256 }, (_, i) => i);
    for (let i = 0, j = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) & 255; [s[i], s[j]] = [s[j], s[i]]; }
    const out = new Uint8Array(data.length);
    for (let n = 0, i = 0, j = 0; n < data.length; n++) {
      i = (i + 1) & 255; j = (j + s[i]) & 255;
      [s[i], s[j]] = [s[j], s[i]];
      out[n] = data[n] ^ s[(s[i] + s[j]) & 255];
    }
    return out;
  }

  // ===================== Конверт OpenSSL =====================
  const toBytes = (bin) => Uint8Array.from(bin, (ch) => ch.charCodeAt(0));

  // Вход: Base64, hex или «сырые» байты. Возвращает { bytes, via }.
  function readEnvelope(text) {
    const s = text.trim();
    if (s.startsWith(MAGIC) && !/[^\u0000-ÿ]/.test(s)) return { bytes: toBytes(s), via: 'raw' };
    const compact = s.replace(/\s+/g, '');
    if (/^[0-9a-f]+$/i.test(compact) && compact.length % 2 === 0 && compact.toLowerCase().startsWith('53616c7465645f5f')) {
      return { bytes: Uint8Array.from(compact.match(/../g), (h) => parseInt(h, 16)), via: 'hex' };
    }
    if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(compact) && compact.length >= 8) {
      const std = compact.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
      if (std.length % 4 !== 1) return { bytes: toBytes(atob(std + '='.repeat((4 - (std.length % 4)) % 4))), via: 'base64' };
    }
    return { bytes: toBytes(s), via: 'raw' };
  }

  const isSalted = (bytes) => bytes.length >= 16 && Array.from(bytes.slice(0, 8), (b) => String.fromCharCode(b)).join('') === MAGIC;

  def({
    id: 'openssl_inspect', name: T('OpenSSL «Salted__»: осмотр конверта', 'OpenSSL “Salted__”: inspect envelope'), cat: 'Кодировки', prior: 0,
    desc: T('Определяет, что вход — результат «openssl enc» (U2FsdGVkX1… в Base64): размер, соль, длина шифртекста и какие шифры возможны. Ничего не расшифровывает и не угадывает пароль.',
      'Detects whether the input is an “openssl enc” result (U2FsdGVkX1… in Base64): size, salt, ciphertext length and which ciphers are possible. It decrypts nothing and does not guess the password.'),
    params: [],
    run([t]) {
      const { bytes, via } = readEnvelope(t);
      if (!isSalted(bytes)) {
        return [T('Конверт OpenSSL «Salted__»: НЕТ', 'OpenSSL “Salted__” envelope: NO'),
          T('Прочитано как ', 'Read as ') + via + ', ' + bytes.length + T(' байт; начало: ', ' bytes; starts with: ') + hex(bytes.slice(0, 8))].join('\n');
      }
      const body = bytes.length - 16;
      const blockOk = body > 0 && body % 16 === 0;
      return [
        T('Конверт OpenSSL «Salted__»: ДА (', 'OpenSSL “Salted__” envelope: YES (') + via + ')',
        T('Всего байт: ', 'Total bytes: ') + bytes.length,
        T('Соль (8 байт, hex): ', 'Salt (8 bytes, hex): ') + hex(bytes.slice(8, 16)),
        T('Шифртекст: ', 'Ciphertext: ') + body + T(' байт (остаток от деления на 16: ', ' bytes (remainder mod 16: ') + (body % 16) + ')',
        blockOk ? T('Длина подходит для блочных AES-CBC/ECB с дополнением.', 'The length fits padded block ciphers (AES-CBC/ECB).')
          : T('Длина НЕ кратна 16: блочный AES-CBC/ECB с дополнением исключён; вероятны потоковые режимы (AES-CTR, RC4, ChaCha20) или повреждённые данные.',
            'The length is NOT a multiple of 16: padded AES-CBC/ECB is ruled out; stream modes (AES-CTR, RC4, ChaCha20) or damaged data are likely.'),
        T('Нужен пароль: ключ получается из пароля и соли (EVP_BytesToKey/MD5 у старых openssl, PBKDF2 у новых). Расшифровки не выполнялось.',
          'A password is required: the key derives from the password and salt (EVP_BytesToKey/MD5 in old openssl, PBKDF2 in new). Nothing was decrypted.'),
      ].join('\n');
    },
  });

  const CIPHERS = [
    ['aes-256-cbc', 'AES-256-CBC'], ['aes-192-cbc', 'AES-192-CBC'], ['aes-128-cbc', 'AES-128-CBC'],
    ['aes-256-ecb', 'AES-256-ECB'], ['aes-128-ecb', 'AES-128-ECB'],
    ['aes-256-ctr', 'AES-256-CTR'], ['aes-128-ctr', 'AES-128-CTR'], ['rc4', 'RC4 (128 bit)'],
  ];

  def({
    id: 'openssl_decrypt', name: T('OpenSSL enc: расшифровать по паролю', 'OpenSSL enc: decrypt with password'), cat: 'Шифры с ключом', prior: 0, inputs: [T('вход', 'input'), T('пароль', 'password')],
    desc: T('Для «openssl enc -md md5» (по умолчанию в openssl ≤ 1.0.x): ключ и IV = EVP_BytesToKey(MD5, соль, пароль). AES-CBC/ECB/CTR и RC4. Без пароля или при неверном пароле выдаёт ошибку, а не мусор. PBKDF2 (-pbkdf2) не поддержан.',
      'For “openssl enc -md md5” (default in openssl ≤ 1.0.x): key and IV = EVP_BytesToKey(MD5, salt, password). AES-CBC/ECB/CTR and RC4. Without a password, or with a wrong one, it raises an error instead of garbage. PBKDF2 (-pbkdf2) is not supported.'),
    params: [
      { key: 'key', label: T('Пароль', 'Password'), type: 'text', default: '' },
      { key: 'cipher', label: T('Шифр', 'Cipher'), type: 'select', options: CIPHERS, default: 'aes-256-cbc' },
    ],
    run(inputs, p) {
      const password = String(keyOf(inputs, p));
      const { bytes } = readEnvelope(inputs[0]);
      if (!isSalted(bytes)) fail('Это не конверт OpenSSL «Salted__»', 'This is not an OpenSSL “Salted__” envelope');
      if (!password) fail('Нужен пароль: без него расшифровать нельзя', 'A password is required: it cannot be decrypted without one');
      const [, bits, mode] = /^aes-(\d+)-(\w+)$/.exec(p.cipher) || [];
      const isRc4 = p.cipher === 'rc4';
      const keyLen = isRc4 ? 16 : Number(bits) / 8;
      const ivLen = isRc4 || mode === 'ecb' ? 0 : 16;
      const { key, iv } = evpBytesToKey(toBytes(C.toBytesAuto(password)), bytes.slice(8, 16), keyLen, ivLen);
      const data = bytes.slice(16);
      const plain = isRc4 ? rc4(data, key) : aesDecrypt(data, key, iv, mode);
      const bin = Array.from(plain, (b) => String.fromCharCode(b)).join('');
      try { return C.decodeBytes(bin, 'utf8'); } catch (e) { return bin; }
    },
  });

  G.OpenSSLTools = { md5, evpBytesToKey, aesEncryptBlock, aesDecryptBlock, expandKey, readEnvelope, rc4, hex };
})(typeof self !== 'undefined' ? self : this);
