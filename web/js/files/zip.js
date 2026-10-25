// Разбор ZIP/JAR на Uint8Array: центральный каталог (с zip64 и данными перед архивом), запасной поиск
// локальных заголовков, извлечение (stored/deflate), традиционное шифрование ZipCrypto.
// WinZip-AES, deflate64, bzip2, LZMA распознаются и честно отклоняются.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = (G.ArgFiles = G.ArgFiles || {});
  const { u16le, u32le, u64le, ascii } = NS;

  const SIG_LOCAL = 0x04034b50;
  const SIG_CENTRAL = 0x02014b50;
  const SIG_EOCD = 0x06054b50;
  const MAX_COMMENT = 65535;

  const METHODS = { 0: 'stored', 8: 'deflate', 9: 'deflate64', 12: 'bzip2', 14: 'lzma', 93: 'zstd', 95: 'xz', 98: 'ppmd', 99: 'AES' };

  function codedError(code, message) {
    const e = new Error(message);
    e.code = code;
    return e;
  }

  // CP866 (русские имена из Windows-архиватора без флага UTF-8): А–п, р–я, Ё/ё.
  function decodeCp866(b) {
    let s = '';
    for (const c of b) {
      if (c < 0x80) s += String.fromCharCode(c);
      else if (c <= 0xaf) s += String.fromCharCode(0x410 + c - 0x80);
      else if (c >= 0xe0 && c <= 0xef) s += String.fromCharCode(0x440 + c - 0xe0);
      else if (c === 0xf0) s += 'Ё'; // i18n-ok: данные
      else if (c === 0xf1) s += 'ё'; // i18n-ok: данные
      else s += '?';
    }
    return s;
  }

  function decodeName(bytes, flags) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      return flags & 0x800 ? NS.decodeUtf8(bytes) : decodeCp866(bytes);
    }
  }

  function dosDate(date, time) {
    const y = (date >> 9) + 1980, mo = (date >> 5) & 15, d = date & 31;
    if (!mo || !d) return '';
    const p = (n) => String(n).padStart(2, '0');
    return y + '-' + p(mo) + '-' + p(d) + ' ' + p(time >> 11) + ':' + p((time >> 5) & 63) + ':' + p((time & 31) * 2);
  }

  /** Позиция EOCD (последняя сигнатура PK\5\6, чья длина комментария укладывается в файл) или -1. */
  function findEocd(b) {
    const stop = Math.max(0, b.length - 22 - MAX_COMMENT);
    for (let i = b.length - 22; i >= stop; i--) {
      if (b[i] === 0x50 && u32le(b, i) === SIG_EOCD && i + 22 + u16le(b, i + 20) <= b.length) return i;
    }
    return -1;
  }

  // zip64: реальные размеры/смещение лежат в extra-поле 0x0001 в порядке size, csize, offset.
  function applyZip64(extra, e) {
    for (let p = 0; p + 4 <= extra.length;) {
      const id = u16le(extra, p), len = u16le(extra, p + 2);
      if (id === 1) {
        let q = p + 4;
        if (e.size === 0xffffffff && q + 8 <= p + 4 + len) { e.size = u64le(extra, q); q += 8; }
        if (e.csize === 0xffffffff && q + 8 <= p + 4 + len) { e.csize = u64le(extra, q); q += 8; }
        if (e.headerOffset === 0xffffffff && q + 8 <= p + 4 + len) { e.headerOffset = u64le(extra, q); }
      }
      if (id === 0x9901) e.aes = true;
      p += 4 + len;
    }
  }

  function describeEntry(e) {
    e.isDir = e.name.endsWith('/');
    e.encrypted = !!(e.flags & 1);
    e.strong = !!(e.flags & 0x40);
    e.aes = e.aes || e.method === 99;
    e.methodName = METHODS[e.method] || String(e.method);
    e.date = dosDate(e.dosDate, e.dosTime);
    return e;
  }

  function parseCentral(b, start, count, delta) {
    const entries = [];
    let p = start;
    for (let i = 0; i < count && p + 46 <= b.length; i++) {
      if (u32le(b, p) !== SIG_CENTRAL) break;
      const nlen = u16le(b, p + 28), elen = u16le(b, p + 30), clen = u16le(b, p + 32);
      if (p + 46 + nlen + elen + clen > b.length) break;
      const e = {
        index: entries.length, flags: u16le(b, p + 8), method: u16le(b, p + 10), dosTime: u16le(b, p + 12), dosDate: u16le(b, p + 14),
        crc: u32le(b, p + 16), csize: u32le(b, p + 20), size: u32le(b, p + 24), headerOffset: u32le(b, p + 42),
        name: decodeName(b.subarray(p + 46, p + 46 + nlen), u16le(b, p + 8)),
        comment: clen ? NS.decodeUtf8(b.subarray(p + 46 + nlen + elen, p + 46 + nlen + elen + clen)) : '',
      };
      applyZip64(b.subarray(p + 46 + nlen, p + 46 + nlen + elen), e);
      e.headerOffset += delta;
      entries.push(describeEntry(e));
      p += 46 + nlen + elen + clen;
    }
    return entries;
  }

  // Запасной режим: центрального каталога нет или он испорчен — идём по локальным заголовкам.
  function scanLocal(b) {
    const entries = [];
    const sig = [0x50, 0x4b, 3, 4];
    for (let p = NS.indexOfBytes(b, sig, 0); p >= 0 && p + 30 <= b.length; p = NS.indexOfBytes(b, sig, p + 4)) {
      const nlen = u16le(b, p + 26), elen = u16le(b, p + 28);
      if (p + 30 + nlen > b.length) break;
      const flags = u16le(b, p + 6);
      const e = {
        index: entries.length, flags, method: u16le(b, p + 8), dosTime: u16le(b, p + 10), dosDate: u16le(b, p + 12),
        crc: u32le(b, p + 14), csize: u32le(b, p + 18), size: u32le(b, p + 22), headerOffset: p, recovered: true,
        name: decodeName(b.subarray(p + 30, p + 30 + nlen), flags), comment: '',
      };
      applyZip64(b.subarray(p + 30 + nlen, p + 30 + nlen + elen), e);
      if (flags & 8 && !e.csize) e.unknownSize = true; // размер лежит в дескрипторе после данных
      entries.push(describeEntry(e));
    }
    return entries;
  }

  function zip64Eocd(b, eocd) {
    if (eocd < 20 || u32le(b, eocd - 20) !== 0x07064b50) return null;
    const at = u64le(b, eocd - 20 + 8);
    if (at + 56 > b.length || u32le(b, at) !== 0x06064b50) return null;
    return { count: u64le(b, at + 32), cdSize: u64le(b, at + 40), cdOffset: u64le(b, at + 48) };
  }

  /**
   * Открыть архив. @returns {{entries:object[], comment:string, recovered:boolean, prefix:number, eocd:number}}
   */
  function open(bytes) {
    const eocd = findEocd(bytes);
    if (eocd >= 0) {
      let count = u16le(bytes, eocd + 10), cdSize = u32le(bytes, eocd + 12), cdOffset = u32le(bytes, eocd + 16);
      if (count === 0xffff || cdOffset === 0xffffffff || cdSize === 0xffffffff) {
        const z = zip64Eocd(bytes, eocd);
        if (z) ({ count, cdSize, cdOffset } = z);
      }
      // Данные перед архивом (самораспаковка, склейка с картинкой): каталог лежит ровно перед EOCD.
      const delta = u32le(bytes, cdOffset) === SIG_CENTRAL ? 0 : eocd - cdSize - cdOffset;
      const start = cdOffset + delta;
      if (start >= 0 && start < bytes.length && u32le(bytes, start) === SIG_CENTRAL) {
        const entries = parseCentral(bytes, start, count, delta);
        if (entries.length) {
          const comment = u16le(bytes, eocd + 20) ? NS.decodeUtf8(bytes.subarray(eocd + 22, eocd + 22 + u16le(bytes, eocd + 20))) : '';
          return { entries, comment, recovered: false, prefix: Math.max(0, delta), eocd };
        }
      }
    }
    const entries = scanLocal(bytes);
    if (!entries.length) throw new Error(T('Это не ZIP: не найдены ни каталог, ни локальные заголовки', 'Not a ZIP: neither a directory nor local headers were found'));
    return { entries, comment: '', recovered: true, prefix: 0, eocd };
  }

  // ---------- ZipCrypto ----------
  function zipCryptoKeys(passBytes) {
    const t = NS.Hash.crcTable();
    const k = [0x12345678, 0x23456789, 0x34567890];
    const update = (c) => {
      k[0] = (t[(k[0] ^ c) & 255] ^ (k[0] >>> 8)) >>> 0;
      k[1] = (Math.imul((k[1] + (k[0] & 255)) >>> 0, 134775813) + 1) >>> 0;
      k[2] = (t[(k[2] ^ (k[1] >>> 24)) & 255] ^ (k[2] >>> 8)) >>> 0;
    };
    for (const c of passBytes) update(c);
    return { update, stream: () => { const x = (k[2] | 2) & 0xffff; return ((x * (x ^ 1)) >>> 8) & 255; } };
  }

  /** Расшифровать данные записи (с 12-байтовым заголовком). @returns {Uint8Array|null} null — пароль не подошёл по контрольному байту */
  function zipCryptoDecrypt(data, passBytes, entry) {
    if (data.length < 12) return null;
    const ks = zipCryptoKeys(passBytes);
    const out = new Uint8Array(data.length - 12);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const p = data[i] ^ ks.stream();
      ks.update(p);
      if (i < 12) last = p; else out[i - 12] = p;
    }
    const byCrc = entry.crc >>> 24;
    const byTime = (entry.dosTime >> 8) & 255;
    return last === byCrc || (entry.flags & 8 && last === byTime) ? out : null;
  }

  // ---------- извлечение ----------
  function rawData(b, e) {
    const o = e.headerOffset;
    if (o < 0 || o + 30 > b.length || u32le(b, o) !== SIG_LOCAL) throw new Error(T('Локальный заголовок записи не найден', 'Local header of the entry not found'));
    const start = o + 30 + u16le(b, o + 26) + u16le(b, o + 28);
    if (e.unknownSize) throw codedError('unsupported', T('Размер записи неизвестен (потоковый ZIP без каталога)', 'Entry size is unknown (streamed ZIP without a directory)'));
    if (start + e.csize > b.length) throw new Error(T('Данные записи обрезаны', 'Entry data is truncated'));
    return b.subarray(start, start + e.csize);
  }

  function passwordVariants(password) {
    const variants = [NS.encodeString(password, 'utf8')];
    if (/[^\x00-\x7f]/.test(password)) {
      try { variants.push(NS.encodeString(password, 'cp1251')); } catch (e) { /* пароль не записывается в CP1251 */ }
    }
    return variants;
  }

  // Подготовка: сжатые данные, расшифрованные при необходимости. Бросает ошибки с code: password | unsupported.
  function prepare(b, e, password) {
    if (e.isDir) return new Uint8Array(0);
    if (e.aes) throw codedError('unsupported', T('Запись зашифрована WinZip-AES: такая расшифровка в браузере не поддерживается (нужен 7-Zip/WinZip)', 'The entry uses WinZip AES encryption: it cannot be decrypted in the browser (use 7-Zip/WinZip)'));
    if (e.strong) throw codedError('unsupported', T('Сильное шифрование ZIP не поддерживается', 'ZIP strong encryption is not supported'));
    if (e.method !== 0 && e.method !== 8) throw codedError('unsupported', T('Метод сжатия «' + e.methodName + '» не поддерживается в браузере', 'Compression method “' + e.methodName + '” is not supported in the browser'));
    let data = rawData(b, e);
    if (e.encrypted) {
      if (!password) throw codedError('password', T('Запись защищена паролем: введи пароль', 'The entry is password-protected: enter the password'));
      let plain = null;
      for (const pb of passwordVariants(password)) { plain = zipCryptoDecrypt(data, pb, e); if (plain) break; }
      if (!plain) throw codedError('password', T('Неверный пароль (контрольный байт ZipCrypto не совпал)', 'Wrong password (ZipCrypto check byte mismatch)'));
      data = plain;
    }
    return data;
  }

  function finish(e, out) {
    if (!e.isDir && !e.recovered && NS.Hash.crc32(out) !== e.crc) {
      throw codedError(e.encrypted ? 'password' : 'crc', e.encrypted
        ? T('Неверный пароль или повреждённые данные (CRC32 не совпал)', 'Wrong password or corrupt data (CRC32 mismatch)')
        : T('Контрольная сумма CRC32 не совпала: данные повреждены', 'CRC32 mismatch: the data is corrupt'));
    }
    return out;
  }

  /** Извлечь запись синхронно. @returns {Uint8Array} */
  function extract(bytes, entry, password) {
    const data = prepare(bytes, entry, password);
    const out = entry.method === 8 && !entry.isDir ? NS.Inflate.inflateRaw(data) : data.slice();
    return finish(entry, out);
  }

  /** То же, но с нативным DecompressionStream для больших записей. */
  async function extractAsync(bytes, entry, password) {
    const data = prepare(bytes, entry, password);
    const out = entry.method === 8 && !entry.isDir ? await NS.Inflate.inflateRawAsync(data) : data.slice();
    return finish(entry, out);
  }

  NS.Zip = { open, findEocd, extract, extractAsync, METHODS, decodeCp866 };
})(typeof self !== 'undefined' ? self : this);
