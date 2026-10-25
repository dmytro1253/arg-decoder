// Определение формата по сигнатуре (magic bytes), поиск конца структуры (данные «после IEND/EOI/EOCD»)
// и поиск вложенных файлов внутри любого контейнера. Чистые функции над Uint8Array.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = (G.ArgFiles = G.ArgFiles || {});
  const { u16be, u32be, u32le, u64le, ascii, startsWith } = NS;

  const sig = (s) => Array.from(s, (c) => c.charCodeAt(0));

  // Простые сигнатуры с начала файла. kind — подсказка для предпросмотра, mime — для артефакта.
  const MAGIC = [
    { id: 'png', name: 'PNG', ext: 'png', mime: 'image/png', sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    { id: 'jpeg', name: 'JPEG', ext: 'jpg', mime: 'image/jpeg', sig: [0xff, 0xd8, 0xff] },
    { id: 'gif', name: 'GIF', ext: 'gif', mime: 'image/gif', sig: sig('GIF8') },
    { id: 'ogg', name: 'Ogg (Vorbis/Opus/…)', ext: 'ogg', mime: 'audio/ogg', sig: sig('OggS') },
    { id: 'flac', name: 'FLAC', ext: 'flac', mime: 'audio/flac', sig: sig('fLaC') },
    { id: 'mkv', name: 'Matroska/WebM', ext: 'mkv', mime: 'video/x-matroska', sig: [0x1a, 0x45, 0xdf, 0xa3] },
    { id: 'rar5', name: 'RAR 5', ext: 'rar', mime: 'application/vnd.rar', sig: [...sig('Rar!'), 0x1a, 0x07, 0x01, 0x00] },
    { id: 'rar4', name: 'RAR 4', ext: 'rar', mime: 'application/vnd.rar', sig: [...sig('Rar!'), 0x1a, 0x07, 0x00] },
    { id: '7z', name: '7-Zip', ext: '7z', mime: 'application/x-7z-compressed', sig: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
    { id: 'pdf', name: 'PDF', ext: 'pdf', mime: 'application/pdf', sig: sig('%PDF-') },
    { id: 'gzip', name: 'gzip', ext: 'gz', mime: 'application/gzip', sig: [0x1f, 0x8b, 0x08] },
    { id: 'bzip2', name: 'bzip2', ext: 'bz2', mime: 'application/x-bzip2', sig: sig('BZh'), check: (b) => b[3] >= 0x31 && b[3] <= 0x39 },
    { id: 'xz', name: 'XZ', ext: 'xz', mime: 'application/x-xz', sig: [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00] },
    { id: 'zstd', name: 'Zstandard', ext: 'zst', mime: 'application/zstd', sig: [0x28, 0xb5, 0x2f, 0xfd] },
    { id: 'elf', name: 'ELF', ext: 'elf', mime: 'application/x-elf', sig: [0x7f, 0x45, 0x4c, 0x46] },
    { id: 'sqlite', name: 'SQLite', ext: 'sqlite', mime: 'application/vnd.sqlite3', sig: [...sig('SQLite format 3'), 0] },
    { id: 'ole', name: 'OLE2 (doc/xls/msi)', ext: 'doc', mime: 'application/x-ole-storage', sig: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
    { id: 'tiff', name: 'TIFF', ext: 'tif', mime: 'image/tiff', sig: [0x49, 0x49, 0x2a, 0x00] },
    { id: 'tiff', name: 'TIFF', ext: 'tif', mime: 'image/tiff', sig: [0x4d, 0x4d, 0x00, 0x2a] },
    { id: 'psd', name: 'Photoshop PSD', ext: 'psd', mime: 'image/vnd.adobe.photoshop', sig: sig('8BPS') },
    { id: 'ico', name: 'ICO', ext: 'ico', mime: 'image/x-icon', sig: [0, 0, 1, 0], check: (b) => b.length >= 22 && b[4] > 0 && b[5] === 0 },
    { id: 'midi', name: 'MIDI', ext: 'mid', mime: 'audio/midi', sig: sig('MThd') },
    { id: 'wasm', name: 'WebAssembly', ext: 'wasm', mime: 'application/wasm', sig: [0, 0x61, 0x73, 0x6d] },
    { id: 'rtf', name: 'RTF', ext: 'rtf', mime: 'application/rtf', sig: sig('{\\rtf') },
    { id: 'swf', name: 'Flash SWF', ext: 'swf', mime: 'application/x-shockwave-flash', sig: sig('FWS'), check: (b) => b.length > 8 && b[3] < 60 },
    { id: 'lnk', name: 'Windows .lnk', ext: 'lnk', mime: 'application/x-ms-shortcut', sig: [0x4c, 0, 0, 0, 0x01, 0x14, 0x02, 0] },
    { id: 'pe', name: 'Windows PE (exe/dll)', ext: 'exe', mime: 'application/vnd.microsoft.portable-executable', sig: sig('MZ'), check: (b) => b.length >= 64 && u32le(b, 60) + 4 <= b.length && ascii(b, u32le(b, 60), u32le(b, 60) + 2) === 'PE' },
    { id: 'bmp', name: 'BMP', ext: 'bmp', mime: 'image/bmp', sig: sig('BM'), check: (b) => b.length > 18 && [12, 40, 52, 56, 64, 108, 124].includes(u32le(b, 14)) },
  ];

  const ZIP_SIGS = [sig('PK\x03\x04'), sig('PK\x05\x06'), sig('PK\x07\x08')];

  /** Содержимое ZIP → уточнение: JAR / APK / документ Office / ODF / EPUB. */
  function classifyZip(bytes) {
    let names;
    try { names = NS.Zip.open(bytes).entries.map((e) => e.name); } catch (e) { return null; }
    const has = (n) => names.includes(n);
    if (has('AndroidManifest.xml')) return { id: 'apk', name: 'Android APK', ext: 'apk', mime: 'application/vnd.android.package-archive' };
    if (has('META-INF/MANIFEST.MF') || names.some((n) => n.endsWith('.class'))) return { id: 'jar', name: 'Java JAR', ext: 'jar', mime: 'application/java-archive' };
    if (has('[Content_Types].xml')) {
      const part = names.find((n) => /^(word|xl|ppt)\//.test(n));
      const kind = part ? { word: 'docx', xl: 'xlsx', ppt: 'pptx' }[part.split('/')[0]] : 'docx';
      return { id: 'ooxml', name: 'Office Open XML (' + kind + ')', ext: kind, mime: 'application/vnd.openxmlformats-officedocument' };
    }
    if (has('mimetype')) return { id: 'odf', name: 'OpenDocument / EPUB', ext: 'odt', mime: 'application/zip' };
    if (names.some((n) => /^(plugin|fabric|mcmod)\.(yml|json|info)$|^mods\.toml$|^META-INF\/mods\.toml$/.test(n))) return { id: 'jar', name: T('Мод/плагин Minecraft (JAR)', 'Minecraft mod/plugin (JAR)'), ext: 'jar', mime: 'application/java-archive' };
    return null;
  }

  /** NBT (Minecraft): корневой TAG_Compound с именем. */
  function looksNbt(b) {
    if (b.length < 8 || b[0] !== 0x0a) return false;
    const nameLen = u16be(b, 1);
    if (nameLen > 255 || 3 + nameLen + 1 > b.length) return false;
    for (let i = 0; i < nameLen; i++) if (b[3 + i] < 0x20 || b[3 + i] > 0x7e) return false;
    const next = b[3 + nameLen];
    return next <= 12;
  }

  function mp3Kind(b) {
    if (startsWith(b, sig('ID3'))) return { id: 'mp3', name: 'MP3 (ID3)', ext: 'mp3', mime: 'audio/mpeg' };
    if (b.length > 3 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0) {
      const layer = (b[1] >> 1) & 3;
      if (layer === 0 && (b[1] & 0xf0) === 0xf0) return { id: 'aac', name: 'AAC (ADTS)', ext: 'aac', mime: 'audio/aac' };
      if (layer !== 0 && ((b[2] >> 4) & 15) !== 15) return { id: 'mp3', name: 'MP3', ext: 'mp3', mime: 'audio/mpeg' };
    }
    return null;
  }

  function riffKind(b) {
    if (b.length < 12 || !startsWith(b, sig('RIFF'))) return null;
    const form = ascii(b, 8, 12);
    if (form === 'WAVE') return { id: 'wav', name: 'WAV', ext: 'wav', mime: 'audio/wav' };
    if (form === 'AVI ') return { id: 'avi', name: 'AVI', ext: 'avi', mime: 'video/x-msvideo' };
    if (form === 'WEBP') return { id: 'webp', name: 'WebP', ext: 'webp', mime: 'image/webp' };
    return { id: 'riff', name: 'RIFF (' + form + ')', ext: 'riff', mime: 'application/octet-stream' };
  }

  function isoKind(b) {
    if (b.length < 12 || ascii(b, 4, 8) !== 'ftyp') return null;
    const brand = ascii(b, 8, 12);
    if (brand === 'qt  ') return { id: 'mov', name: 'QuickTime MOV', ext: 'mov', mime: 'video/quicktime' };
    if (brand.startsWith('M4A')) return { id: 'm4a', name: 'M4A (audio)', ext: 'm4a', mime: 'audio/mp4' };
    if (/^(heic|heix|mif1|avif)/.test(brand)) return { id: 'heif', name: 'HEIF/AVIF', ext: 'heic', mime: 'image/heif' };
    return { id: 'mp4', name: 'MP4 (' + brand.trim() + ')', ext: 'mp4', mime: 'video/mp4' };
  }

  function classKind(b) {
    if (b.length < 10 || !startsWith(b, [0xca, 0xfe, 0xba, 0xbe])) return null;
    const major = u16be(b, 6);
    if (major < 45 || major > 80) return null;
    return { id: 'class', name: 'Java class (Java ' + (major - 44) + ')', ext: 'class', mime: 'application/java-vm' };
  }

  function textKind(b) {
    const n = Math.min(b.length, 4096);
    if (!n) return null;
    if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return { id: 'text', name: 'Text (UTF-8 BOM)', ext: 'txt', mime: 'text/plain' };
    if ((b[0] === 0xff && b[1] === 0xfe) || (b[0] === 0xfe && b[1] === 0xff)) return { id: 'text', name: 'Text (UTF-16)', ext: 'txt', mime: 'text/plain' };
    let ok = 0;
    for (let i = 0; i < n; i++) {
      const c = b[i];
      if (c === 9 || c === 10 || c === 13 || (c >= 0x20 && c < 0x7f) || c >= 0x80) ok++;
      else if (c === 0) return null;
    }
    if (ok / n < 0.95) return null;
    const head = ascii(b, 0, Math.min(n, 256)).trimStart().toLowerCase();
    if (head.startsWith('<?xml') || head.startsWith('<svg')) return { id: 'xml', name: head.startsWith('<svg') ? 'SVG' : 'XML', ext: 'xml', mime: 'text/xml' };
    if (head.startsWith('<!doctype html') || head.startsWith('<html')) return { id: 'html', name: 'HTML', ext: 'html', mime: 'text/html' };
    if (head.startsWith('{') || head.startsWith('[')) return { id: 'json', name: T('Текст, похоже на JSON', 'Text, looks like JSON'), ext: 'json', mime: 'application/json' };
    return { id: 'text', name: T('Текст', 'Text'), ext: 'txt', mime: 'text/plain' };
  }

  /**
   * Определить формат. @returns {{id,name,ext,mime,note?}} — всегда объект (id 'unknown' для неизвестного).
   */
  function detect(bytes) {
    const b = bytes;
    if (!b.length) return { id: 'empty', name: T('Пустой файл', 'Empty file'), ext: '', mime: 'application/octet-stream' };
    for (const z of ZIP_SIGS) {
      if (startsWith(b, z)) return classifyZip(b) || { id: 'zip', name: 'ZIP', ext: 'zip', mime: 'application/zip' };
    }
    const special = classKind(b) || riffKind(b) || isoKind(b) || mp3Kind(b);
    if (special) return special;
    for (const m of MAGIC) {
      if (!startsWith(b, m.sig) || (m.check && !m.check(b))) continue;
      if (m.id === 'gzip') {
        const inner = peekGzip(b);
        if (inner) return Object.assign({}, m, { name: 'gzip → ' + inner, note: inner });
      }
      return { id: m.id, name: m.name, ext: m.ext, mime: m.mime };
    }
    if (looksNbt(b)) return { id: 'nbt', name: T('NBT (Minecraft, без сжатия)', 'NBT (Minecraft, uncompressed)'), ext: 'nbt', mime: 'application/octet-stream' };
    if (ascii(b, 257, 262) === 'ustar') return { id: 'tar', name: 'tar', ext: 'tar', mime: 'application/x-tar' };
    return textKind(b) || { id: 'unknown', name: T('Неизвестный формат (сырые данные)', 'Unknown format (raw data)'), ext: 'bin', mime: 'application/octet-stream' };
  }

  // gzip с NBT внутри (level.dat, servers.dat…): заглянем в первые байты.
  function peekGzip(b) {
    try {
      const head = NS.Inflate.gunzip(b, { maxOut: 512, truncate: true }).data;
      if (looksNbt(head)) return 'NBT (Minecraft)';
      return null;
    } catch (e) { return null; }
  }

  // ---------- конец структуры ----------
  function pngEnd(b) {
    let p = 8;
    while (p + 12 <= b.length) {
      const next = p + 12 + u32be(b, p);
      if (next > b.length) break;
      if (ascii(b, p + 4, p + 8) === 'IEND') return { end: next, marker: 'IEND' };
      p = next;
    }
    return { end: b.length, truncated: true, marker: 'IEND' };
  }

  function jpegEnd(b) {
    let p = 2;
    while (p + 1 < b.length) {
      if (b[p] !== 0xff) { p++; continue; }
      const m = b[p + 1];
      if (m === 0xff) { p++; continue; }
      if (m === 0xd9) return { end: p + 2, marker: 'EOI' };
      if (m === 0 || m === 0x01 || m === 0xd8 || (m >= 0xd0 && m <= 0xd7)) { p += 2; continue; }
      if (p + 4 > b.length) break;
      p += 2 + u16be(b, p + 2);
      if (m === 0xda) {
        // Энтропийно-кодированные данные идут до следующего маркера (кроме RSTn и 0xFF00).
        while (p + 1 < b.length && !(b[p] === 0xff && b[p + 1] !== 0 && !(b[p + 1] >= 0xd0 && b[p + 1] <= 0xd7))) p++;
      }
    }
    return { end: b.length, truncated: true, marker: 'EOI' };
  }

  function gifEnd(b) {
    if (b.length < 13) return null;
    let p = 13;
    if (b[10] & 0x80) p += 3 * (1 << ((b[10] & 7) + 1));
    const skipSub = () => {
      while (p < b.length) { const n = b[p++]; if (!n) return true; p += n; }
      return false;
    };
    while (p < b.length) {
      const t = b[p++];
      if (t === 0x3b) return { end: p, marker: 'GIF trailer 3B' };
      if (t === 0x21) { p++; if (!skipSub()) break; }
      else if (t === 0x2c) {
        const f = b[p + 8];
        p += 9;
        if (f & 0x80) p += 3 * (1 << ((f & 7) + 1));
        p++;
        if (!skipSub()) break;
      } else break;
    }
    return { end: b.length, truncated: true, marker: 'GIF trailer 3B' };
  }

  function zipEnd(b) {
    const e = NS.Zip.findEocd(b);
    if (e < 0) return null;
    return { end: Math.min(b.length, e + 22 + NS.u16le(b, e + 20)), marker: 'EOCD' };
  }

  function pdfEnd(b) {
    const marker = sig('%%EOF');
    let last = -1;
    for (let i = NS.indexOfBytes(b, marker, 0); i >= 0; i = NS.indexOfBytes(b, marker, i + 1)) last = i;
    if (last < 0) return null;
    let end = last + 5;
    if (b[end] === 13) end++;
    if (b[end] === 10) end++;
    return { end, marker: '%%EOF' };
  }

  function sevenZipEnd(b) {
    if (b.length < 32) return null;
    const end = 32 + u64le(b, 12) + u64le(b, 20);
    return end <= b.length ? { end, marker: '7z header' } : { end: b.length, truncated: true, marker: '7z header' };
  }

  function riffEnd(b) {
    const end = 8 + u32le(b, 4);
    return end <= b.length ? { end, marker: 'RIFF size' } : { end: b.length, truncated: true, marker: 'RIFF size' };
  }

  function bmpEnd(b) {
    const end = u32le(b, 2);
    return end >= 14 && end <= b.length ? { end, marker: 'BMP size' } : null;
  }

  function oggEnd(b) {
    let p = 0;
    while (p + 27 <= b.length && ascii(b, p, p + 4) === 'OggS') {
      const segs = b[p + 26];
      if (p + 27 + segs > b.length) break;
      let size = 0;
      for (let i = 0; i < segs; i++) size += b[p + 27 + i];
      p += 27 + segs + size;
    }
    return { end: Math.min(p, b.length), marker: 'Ogg pages' };
  }

  function isoEnd(b) {
    let p = 0;
    while (p + 8 <= b.length) {
      let size = u32be(b, p);
      if (size === 1 && p + 16 <= b.length) size = u32be(b, p + 8) * 4294967296 + u32be(b, p + 12);
      else if (size === 0) return { end: b.length, marker: 'MP4 boxes' };
      if (size < 8 || !/^[\x20-\x7e]{4}$/.test(ascii(b, p + 4, p + 8))) break;
      p += size;
    }
    return { end: Math.min(p, b.length), marker: 'MP4 boxes' };
  }

  function classEnd(b) {
    const r = NS.ClassFile.parse(b);
    return { end: r.end, marker: 'class attributes' };
  }

  const END_FINDERS = {
    png: pngEnd, jpeg: jpegEnd, gif: gifEnd, zip: zipEnd, jar: zipEnd, apk: zipEnd, ooxml: zipEnd, odf: zipEnd,
    pdf: pdfEnd, '7z': sevenZipEnd, wav: riffEnd, avi: riffEnd, webp: riffEnd, riff: riffEnd, bmp: bmpEnd,
    ogg: oggEnd, mp4: isoEnd, mov: isoEnd, m4a: isoEnd, heif: isoEnd, class: classEnd,
  };

  /**
   * Где заканчивается основная структура формата.
   * @returns {{end:number, marker:string, truncated?:boolean, tail:number}|null} tail — число лишних байт после конца
   */
  function findEnd(bytes, formatId) {
    const f = END_FINDERS[formatId];
    if (!f) return null;
    let r;
    try { r = f(bytes); } catch (e) { return null; }
    if (!r) return null;
    return Object.assign({ tail: Math.max(0, bytes.length - r.end) }, r);
  }

  // ---------- вложенные файлы ----------
  // Сигнатуры для поиска внутри данных. Только достаточно длинные/проверяемые, чтобы не плодить шум.
  const EMBED = [
    { id: 'png', name: 'PNG', sig: MAGIC[0].sig },
    { id: 'jpeg', name: 'JPEG', sig: [0xff, 0xd8, 0xff], check: (b, i) => [0xe0, 0xe1, 0xe2, 0xdb, 0xee, 0xc0, 0xc4].includes(b[i + 3]) },
    { id: 'gif', name: 'GIF', sig: sig('GIF8'), check: (b, i) => (b[i + 4] === 0x37 || b[i + 4] === 0x39) && b[i + 5] === 0x61 },
    { id: 'zip', name: 'ZIP/JAR', sig: sig('PK\x03\x04') },
    { id: 'rar', name: 'RAR', sig: [...sig('Rar!'), 0x1a, 0x07] },
    { id: '7z', name: '7-Zip', sig: MAGIC.find((m) => m.id === '7z').sig },
    { id: 'pdf', name: 'PDF', sig: sig('%PDF-'), check: (b, i) => b[i + 5] === 0x31 || b[i + 5] === 0x32 },
    { id: 'gzip', name: 'gzip', sig: [0x1f, 0x8b, 0x08], check: (b, i) => (b[i + 3] & 0xe0) === 0 && (b[i + 9] <= 13 || b[i + 9] === 255) },
    { id: 'class', name: 'Java class', sig: [0xca, 0xfe, 0xba, 0xbe, 0, 0], check: (b, i) => b[i + 7] >= 45 && b[i + 7] <= 80 },
    { id: 'ogg', name: 'Ogg', sig: [...sig('OggS'), 0, 2] },
    { id: 'riff', name: 'RIFF (WAV/AVI/WebP)', sig: sig('RIFF'), check: (b, i) => /^(WAVE|AVI |WEBP)$/.test(ascii(b, i + 8, i + 12)) },
    { id: 'mp4', name: 'MP4/MOV', sig: sig('ftyp'), delta: -4, check: (b, i) => i >= 4 && u32be(b, i - 4) >= 12 && u32be(b, i - 4) < 256 },
    { id: 'elf', name: 'ELF', sig: [0x7f, 0x45, 0x4c, 0x46], check: (b, i) => (b[i + 4] === 1 || b[i + 4] === 2) && b[i + 5] <= 2 },
    { id: 'sqlite', name: 'SQLite', sig: MAGIC.find((m) => m.id === 'sqlite').sig },
    { id: 'xz', name: 'XZ', sig: MAGIC.find((m) => m.id === 'xz').sig },
    { id: 'zstd', name: 'Zstandard', sig: MAGIC.find((m) => m.id === 'zstd').sig },
  ];
  const EMBED_BY_FIRST = new Map();
  for (const e of EMBED) {
    const k = e.sig[0];
    EMBED_BY_FIRST.set(k, (EMBED_BY_FIRST.get(k) || []).concat(e));
  }

  /** Найти вложенные сигнатуры (кроме смещения 0). @returns {{offset:number,id:string,name:string}[]} */
  function scanEmbedded(bytes, limit) {
    const max = limit || 64;
    const hits = [];
    for (let i = 1; i < bytes.length && hits.length < max; i++) {
      const cands = EMBED_BY_FIRST.get(bytes[i]);
      if (!cands) continue;
      for (const e of cands) {
        if (!startsWith(bytes, e.sig, i) || (e.check && !e.check(bytes, i))) continue;
        hits.push({ offset: i + (e.delta || 0), id: e.id, name: e.name });
        break;
      }
    }
    return hits;
  }

  /** Вырезать файл, начинающийся по смещению: до конца его структуры или до конца данных. */
  function carve(bytes, offset) {
    const sub = bytes.subarray(offset);
    const fmt = detect(sub);
    const end = findEnd(sub, fmt.id);
    return { bytes: end ? sub.subarray(0, end.end) : sub, format: fmt, exact: !!end };
  }

  /** Энтропия Шеннона в битах на байт (по выборке не больше 4 МБ). */
  function entropy(bytes) {
    const n = Math.min(bytes.length, 4194304);
    if (!n) return 0;
    const freq = new Float64Array(256);
    for (let i = 0; i < n; i++) freq[bytes[i]]++;
    let e = 0;
    for (let i = 0; i < 256; i++) if (freq[i]) { const p = freq[i] / n; e -= p * Math.log2(p); }
    return e;
  }

  NS.Signatures = { detect, findEnd, scanEmbedded, carve, entropy, looksNbt, classifyZip };
})(typeof self !== 'undefined' ? self : this);
