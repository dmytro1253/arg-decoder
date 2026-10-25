// Метаданные файла-картинки по байтам: формат, размеры, PNG-чанки (tEXt/zTXt/iTXt), комментарии JPEG/GIF,
// EXIF-текст и данные, дописанные после конца изображения (IEND / EOI / GIF-трейлер).
// Чистый код над Uint8Array — работает в браузере и в Node. Ничего не меняет в исходных байтах.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);

  const SIG_PNG = [137, 80, 78, 71, 13, 10, 26, 10];
  const latin1 = (b, s, e) => { let t = ''; for (let i = s; i < e; i++) t += String.fromCharCode(b[i]); return t; };
  const utf8 = (b, s, e) => { try { return new TextDecoder('utf-8').decode(b.subarray(s, e)); } catch (err) { return latin1(b, s, e); } };
  const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const startsWith = (b, sig, o) => sig.every((v, i) => b[(o || 0) + i] === v);
  const MAX_TEXT = 4000;

  const FILE_SIGNATURES = [
    ['ZIP/JAR/DOCX', [0x50, 0x4b, 0x03, 0x04]], ['PNG', SIG_PNG], ['JPEG', [0xff, 0xd8, 0xff]], ['GIF', [0x47, 0x49, 0x46, 0x38]],
    ['RAR', [0x52, 0x61, 0x72, 0x21]], ['7z', [0x37, 0x7a, 0xbc, 0xaf]], ['PDF', [0x25, 0x50, 0x44, 0x46]], ['gzip', [0x1f, 0x8b, 0x08]],
    ['OGG', [0x4f, 0x67, 0x67, 0x53]], ['MP3 (ID3)', [0x49, 0x44, 0x33]], ['ELF', [0x7f, 0x45, 0x4c, 0x46]], ['WAV/RIFF', [0x52, 0x49, 0x46, 0x46]],
  ];

  function detectFormat(b) {
    if (startsWith(b, SIG_PNG)) return 'png';
    if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
    if (latin1(b, 0, 6) === 'GIF87a' || latin1(b, 0, 6) === 'GIF89a') return 'gif';
    if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
    if (latin1(b, 0, 4) === 'RIFF' && latin1(b, 8, 12) === 'WEBP') return 'webp';
    return 'unknown';
  }

  /** Сигнатуры известных форматов в хвосте (не в первом байте — там сам файл). */
  function scanSignatures(b, from) {
    const found = [];
    for (let i = from; i < b.length - 3; i++) {
      for (const [name, sig] of FILE_SIGNATURES) if (startsWith(b, sig, i)) found.push({ name, offset: i });
    }
    return found.slice(0, 20);
  }

  function printable(b, s, e) {
    const n = Math.min(e - s, 160);
    let t = '';
    for (let i = 0; i < n; i++) { const c = b[s + i]; t += c >= 32 && c < 127 ? String.fromCharCode(c) : '.'; }
    return t;
  }

  function trailing(b, end) {
    if (end >= b.length) return null;
    return { offset: end, length: b.length - end, preview: printable(b, end, b.length), signatures: scanSignatures(b, end) };
  }

  // ---------- PNG ----------
  function parsePng(b) {
    const info = { chunks: [], texts: [], width: null, height: null, end: b.length, notes: [] };
    let o = 8, ended = false;
    while (o + 12 <= b.length) {
      const len = u32(b, o), type = latin1(b, o + 4, o + 8);
      if (o + 12 + len > b.length) { info.notes.push(T('Чанк ' + type + ' обрезан в конце файла', 'Chunk ' + type + ' is cut off at the end of the file')); break; }
      info.chunks.push({ name: type, offset: o, length: len });
      const body = o + 8;
      if (type === 'IHDR') { info.width = u32(b, body); info.height = u32(b, body + 4); info.bitDepth = b[body + 8]; info.colorType = b[body + 9]; info.interlace = b[body + 12]; }
      else if (type === 'tEXt') {
        let z = body; while (z < body + len && b[z] !== 0) z++;
        info.texts.push({ kind: 'tEXt', key: latin1(b, body, z), value: latin1(b, z + 1, body + len).slice(0, MAX_TEXT) });
      } else if (type === 'zTXt') {
        let z = body; while (z < body + len && b[z] !== 0) z++;
        info.texts.push({ kind: 'zTXt', key: latin1(b, body, z), compressed: b.subarray(z + 2, body + len), value: null });
      } else if (type === 'iTXt') {
        let z = body; while (z < body + len && b[z] !== 0) z++;
        const flag = b[z + 1];
        let p = z + 3; while (p < body + len && b[p] !== 0) p++; p++; // язык
        while (p < body + len && b[p] !== 0) p++; p++; // переведённый ключ
        const item = { kind: 'iTXt', key: latin1(b, body, z), value: null };
        if (flag) item.compressed = b.subarray(p, body + len); else item.value = utf8(b, p, body + len).slice(0, MAX_TEXT);
        info.texts.push(item);
      }
      o += 12 + len;
      if (type === 'IEND') { ended = true; break; }
    }
    info.end = o;
    if (!ended) info.notes.push(T('Нет чанка IEND — файл оборван или повреждён', 'No IEND chunk: the file is truncated or damaged'));
    return info;
  }

  // ---------- EXIF (минимальный разбор TIFF) ----------
  const EXIF_TEXT_TAGS = { 0x010e: 'ImageDescription', 0x010f: 'Make', 0x0110: 'Model', 0x0131: 'Software', 0x0132: 'DateTime', 0x013b: 'Artist', 0x8298: 'Copyright', 0x9286: 'UserComment', 0x9003: 'DateTimeOriginal', 0xa430: 'CameraOwnerName' };
  const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 };

  function parseExif(b, start, end) {
    const out = { tags: [], gps: false };
    if (latin1(b, start, start + 6) !== 'Exif\0\0') return out;
    const t = start + 6;
    const le = latin1(b, t, t + 2) === 'II';
    const r16 = (o) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
    const r32 = (o) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : u32(b, o));
    const seen = new Set();
    const readIfd = (off, depth) => {
      if (depth > 3 || seen.has(off) || t + off + 2 > end) return;
      seen.add(off);
      const count = r16(t + off);
      for (let i = 0; i < Math.min(count, 200); i++) {
        const e = t + off + 2 + i * 12;
        if (e + 12 > end) return;
        const tag = r16(e), type = r16(e + 2), n = r32(e + 4);
        const size = (TYPE_SIZE[type] || 1) * n;
        const vo = size <= 4 ? e + 8 : t + r32(e + 8);
        if (tag === 0x8769) readIfd(r32(e + 8), depth + 1);
        else if (tag === 0x8825) { out.gps = true; }
        else if (EXIF_TEXT_TAGS[tag] && vo + size <= end && size > 0) {
          let s = vo, en = vo + size;
          if (tag === 0x9286 && size > 8) s += 8; // префикс кодировки UserComment
          const text = latin1(b, s, en).replace(/\0+$/, '').trim();
          if (text) out.tags.push({ name: EXIF_TEXT_TAGS[tag], value: text.slice(0, MAX_TEXT) });
        }
      }
    };
    readIfd(r32(t + 4), 0);
    return out;
  }

  // ---------- JPEG ----------
  function parseJpeg(b) {
    const info = { segments: [], comments: [], exif: null, xmp: null, width: null, height: null, end: b.length, notes: [] };
    let o = 2;
    while (o + 2 <= b.length) {
      if (b[o] !== 0xff) { info.notes.push(T('Нарушена структура JPEG по смещению ', 'Broken JPEG structure at offset ') + o); break; }
      const marker = b[o + 1];
      if (marker === 0xff) { o++; continue; }
      if (marker === 0xd9) { o += 2; break; }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { o += 2; continue; }
      if (o + 4 > b.length) break;
      const len = (b[o + 2] << 8) | b[o + 3];
      const body = o + 4, bodyEnd = o + 2 + len;
      info.segments.push({ marker: 'FF' + marker.toString(16).toUpperCase(), offset: o, length: len + 2 });
      if (marker === 0xfe) info.comments.push(utf8(b, body, bodyEnd).slice(0, MAX_TEXT));
      else if (marker === 0xe1 && latin1(b, body, body + 6) === 'Exif\0\0') info.exif = parseExif(b, body, bodyEnd);
      else if (marker === 0xe1 && latin1(b, body, body + 28).startsWith('http://ns.adobe.com/xap')) info.xmp = utf8(b, body + 29, bodyEnd).slice(0, MAX_TEXT);
      else if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) { info.height = (b[body + 1] << 8) | b[body + 2]; info.width = (b[body + 3] << 8) | b[body + 4]; }
      o = bodyEnd;
      if (marker === 0xda) { // данные скана: до следующего маркера, не RSTn и не FF00
        while (o + 1 < b.length) {
          if (b[o] === 0xff && b[o + 1] !== 0 && !(b[o + 1] >= 0xd0 && b[o + 1] <= 0xd7) && b[o + 1] !== 0xff) break;
          o++;
        }
      }
    }
    info.end = Math.min(o, b.length);
    if (!(b[info.end - 2] === 0xff && b[info.end - 1] === 0xd9)) info.notes.push(T('Не найден маркер конца JPEG (EOI)', 'The JPEG end marker (EOI) was not found'));
    return info;
  }

  // ---------- GIF ----------
  function skipSubBlocks(b, o) { while (o < b.length && b[o] !== 0) o += b[o] + 1; return o + 1; }

  function parseGif(b) {
    const info = { comments: [], width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8), end: b.length, notes: [] };
    let o = 13;
    if (b[10] & 0x80) o += 3 * (1 << ((b[10] & 7) + 1));
    while (o < b.length) {
      const t = b[o];
      if (t === 0x3b) { o++; break; }
      if (t === 0x21) {
        if (b[o + 1] === 0xfe) {
          let p = o + 2, text = '';
          while (p < b.length && b[p] !== 0) { text += latin1(b, p + 1, p + 1 + b[p]); p += b[p] + 1; }
          info.comments.push(text.slice(0, MAX_TEXT));
        }
        o = skipSubBlocks(b, o + 2);
      } else if (t === 0x2c) {
        const flags = b[o + 9];
        o += 10;
        if (flags & 0x80) o += 3 * (1 << ((flags & 7) + 1));
        o = skipSubBlocks(b, o + 1);
      } else { info.notes.push(T('Неожиданный байт в GIF по смещению ', 'Unexpected byte in GIF at offset ') + o); break; }
    }
    info.end = Math.min(o, b.length);
    return info;
  }

  /** Разбор файла. Возвращает объект с полями format, width, height, texts, comments, trailing, notes, chunks... */
  function parse(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const format = detectFormat(b);
    const out = { format, size: b.length, width: null, height: null, texts: [], comments: [], chunks: [], exif: null, xmp: null, trailing: null, notes: [] };
    let info = null;
    if (format === 'png') info = parsePng(b);
    else if (format === 'jpeg') info = parseJpeg(b);
    else if (format === 'gif') info = parseGif(b);
    else out.notes.push(format === 'unknown' ? T('Формат не распознан по сигнатуре', 'The format was not recognised by its signature') : T('Для формата ' + format + ' разбор структуры не реализован', 'Structure parsing is not implemented for ' + format));
    if (info) {
      Object.assign(out, { width: info.width, height: info.height, texts: info.texts || [], comments: info.comments || [], chunks: info.chunks || info.segments || [], exif: info.exif || null, xmp: info.xmp || null });
      out.notes.push(...info.notes);
      if (format === 'png') Object.assign(out, { bitDepth: info.bitDepth, colorType: info.colorType, interlace: info.interlace });
      out.trailing = trailing(b, info.end);
    }
    return out;
  }

  /** Раскрывает сжатые zTXt/iTXt (нужен DecompressionStream или опция inflate: Uint8Array → Promise<Uint8Array>). */
  async function inflateTexts(meta, inflate) {
    const fn = inflate || (async (data) => {
      if (typeof DecompressionStream === 'undefined') throw new Error(T('DecompressionStream недоступен', 'DecompressionStream is not available'));
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    });
    for (const t of meta.texts) {
      if (!t.compressed || t.value !== null) continue;
      try { t.value = utf8(await fn(t.compressed), 0, undefined).slice(0, MAX_TEXT); } catch (e) { t.value = T('(не удалось распаковать: ', '(could not decompress: ') + e.message + ')'; }
    }
    return meta;
  }

  /** Человекочитаемый отчёт по метаданным (для выхода ноды). */
  function report(meta, T) {
    const t = T || ((ru) => ru);
    const L = [];
    L.push(t('Формат', 'Format') + ': ' + meta.format + ', ' + meta.size + ' B' + (meta.width ? ', ' + meta.width + '×' + meta.height : ''));
    for (const x of meta.texts) L.push(x.kind + ' ' + x.key + ': ' + (x.value === null ? t('(сжато)', '(compressed)') : x.value));
    meta.comments.forEach((c, i) => L.push(t('Комментарий', 'Comment') + ' #' + (i + 1) + ': ' + c));
    if (meta.exif) for (const e of meta.exif.tags) L.push('EXIF ' + e.name + ': ' + e.value);
    if (meta.exif && meta.exif.gps) L.push(t('EXIF: есть GPS-координаты', 'EXIF: GPS data present'));
    if (meta.xmp) L.push('XMP: ' + meta.xmp.slice(0, 300));
    if (meta.trailing) {
      L.push(t('Данные после конца изображения', 'Data after end of image') + ': ' + meta.trailing.length + ' B @' + meta.trailing.offset + ' «' + meta.trailing.preview + '»');
      for (const s of meta.trailing.signatures) L.push('  ' + t('сигнатура', 'signature') + ' ' + s.name + ' @' + s.offset);
    }
    for (const n of meta.notes) L.push('! ' + n);
    return L.join('\n');
  }

  G.ImgMeta = { parse, inflateTexts, report, detectFormat };
})(typeof self !== 'undefined' ? self : this);
