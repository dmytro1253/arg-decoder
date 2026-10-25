// Единый интерфейс архивов: ZIP/JAR (список, извлечение, пароль, вложенные архивы), одиночный gzip,
// честная диагностика RAR/7z. Операции над содержимым: путь «a.zip!inner.jar!X.class», поиск по всем записям.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = (G.ArgFiles = G.ArgFiles || {});

  const NESTED_SEP = '!';
  const MAX_GREP_ENTRY = 32 * 1048576;
  const MAX_DEPTH = 6;

  const UNSUPPORTED_ARCHIVES = {
    rar4: 'RAR', rar5: 'RAR', '7z': '7-Zip', bzip2: 'bzip2', xz: 'XZ', zstd: 'Zstandard', tar: 'tar',
  };

  function unsupported(format, detail) {
    const e = new Error(T(
      format + ': эта нода читает только ZIP/JAR/gzip. Подключи файл к ноде «Архив RAR/7z (7-Zip)» — она распаковывает ' + format + ' локально (и с паролем).',
      format + ': this node reads ZIP/JAR/gzip only. Connect the file to the Archive RAR/7z (7-Zip) node: it extracts ' + format + ' locally (with a password too).') + (detail ? ' ' + detail : ''));
    e.code = 'unsupported';
    return e;
  }

  /** Что видно в заголовках RAR4 без распаковки: зашифрованы ли заголовки, имена, размеры, метод сжатия. */
  function rar4Info(b) {
    const u16 = (o) => b[o] | (b[o + 1] << 8), u32 = (o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
    let i = 7;
    const files = [];
    while (i + 7 <= b.length && files.length < 50) {
      const type = b[i + 2], flags = u16(i + 3), size = u16(i + 5);
      if (size < 7) break;
      if (type === 0x73 && (flags & 0x80)) return T('Заголовки зашифрованы паролем (RAR -hp): без пароля не видно даже имён файлов.', 'The headers are password-encrypted (RAR -hp): even the file names are hidden without the password.');
      let add = (flags & 0x8000) ? u32(i + 7) : 0;
      if (type === 0x74) {
        const packed = u32(i + 7), unpacked = u32(i + 11), method = b[i + 25], nameLen = u16(i + 26);
        const name = Array.from(b.subarray(i + 32, i + 32 + nameLen), (c) => String.fromCharCode(c)).join('');
        files.push(name + ' (' + unpacked + T(' байт, ', ' bytes, ') + (method === 0x30 ? T('без сжатия', 'stored') : T('сжат', 'compressed')) + ((flags & 4) ? T(', зашифрован', ', encrypted') : '') + ')');
        add = packed;
      }
      i += size + add;
    }
    return files.length ? T('Файлы в архиве: ', 'Files in the archive: ') + files.join('; ') : '';
  }

  /**
   * Открыть контейнер. @returns {{type:string, entries:object[], read:(entry:object,password?:string)=>Uint8Array, readAsync, comment?:string, note?:string}}
   */
  function open(bytes) {
    const fmt = NS.Signatures.detect(bytes);
    const zipLike = ['zip', 'jar', 'apk', 'ooxml', 'odf'].includes(fmt.id);
    // Полиглоты (PNG+ZIP, JPEG+ZIP): архив ищем и в файлах, которые начинаются не с PK.
    let z = null;
    if (zipLike || (!UNSUPPORTED_ARCHIVES[fmt.id] && NS.Zip.findEocd(bytes) >= 0)) {
      try { z = NS.Zip.open(bytes); } catch (e) { if (zipLike) throw e; }
    }
    if (z) {
      const note = (z.recovered ? T('Каталог ZIP повреждён или отсутствует — записи восстановлены по локальным заголовкам. ', 'The ZIP directory is damaged or missing — entries were recovered from local headers. ') : '')
        + (z.prefix ? T('Перед архивом ' + z.prefix + ' байт посторонних данных. ', z.prefix + ' bytes of foreign data precede the archive. ') : '');
      return {
        type: 'zip', format: fmt, entries: z.entries, comment: z.comment, note,
        read: (e, pw) => NS.Zip.extract(bytes, e, pw),
        readAsync: (e, pw) => NS.Zip.extractAsync(bytes, e, pw),
      };
    }
    if (fmt.id === 'gzip' || /^gzip/.test(fmt.name)) {
      const g = NS.Inflate.gunzip(bytes);
      const entry = { index: 0, name: g.name || 'data', size: g.data.length, csize: bytes.length, methodName: 'deflate', encrypted: false, isDir: false, flags: 0 };
      return { type: 'gzip', format: fmt, entries: [entry], read: () => g.data, readAsync: async () => g.data, note: '' };
    }
    if (UNSUPPORTED_ARCHIVES[fmt.id]) throw unsupported(UNSUPPORTED_ARCHIVES[fmt.id], fmt.id === 'rar4' ? rar4Info(bytes) : '');
    throw new Error(T('Не архив: определено «' + fmt.name + '»', 'Not an archive: detected “' + fmt.name + '”'));
  }

  /** Найти запись по имени (точно), затем по индексу «#3», затем по окончанию пути. */
  function findEntry(entries, ref) {
    const q = String(ref).trim();
    if (!q) return null;
    const byName = entries.find((e) => e.name === q);
    if (byName) return byName;
    if (/^#\d+$/.test(q)) return entries[parseInt(q.slice(1), 10)] || null;
    const tails = entries.filter((e) => e.name.endsWith('/' + q) || e.name.toLowerCase() === q.toLowerCase());
    return tails.length === 1 ? tails[0] : null;
  }

  /**
   * Достать запись по пути с вложенностью: «outer.zip!inner/file.txt». Пароль применяется к каждому уровню.
   * @returns {{bytes:Uint8Array, name:string}}
   */
  function resolve(bytes, path, password) {
    let rest = String(path);
    let cur = bytes;
    let name = '';
    for (let depth = 0; rest; depth++) {
      if (depth >= MAX_DEPTH) throw new Error(T('Слишком глубокая вложенность архивов', 'Archives are nested too deeply'));
      const a = open(cur);
      // Имя записи само может содержать «!», поэтому сначала пробуем остаток целиком, затем по разделителям.
      let e = findEntry(a.entries, rest);
      let next = '';
      for (let i = rest.indexOf(NESTED_SEP); !e && i >= 0; i = rest.indexOf(NESTED_SEP, i + 1)) {
        e = findEntry(a.entries, rest.slice(0, i));
        if (e) next = rest.slice(i + 1);
      }
      if (!e) throw new Error(T('В архиве нет записи «' + rest + '»', 'No entry “' + rest + '” in the archive'));
      cur = a.read(e, password);
      name = e.name;
      rest = next;
    }
    return { bytes: cur, name };
  }

  const baseName = (n) => n.replace(/\/+$/, '').split('/').pop() || n;

  // ---------- вывод ----------
  function listing(a) {
    const lines = [];
    if (a.note) lines.push(a.note.trim());
    if (a.comment) lines.push(T('Комментарий: ', 'Comment: ') + a.comment);
    a.entries.forEach((e) => {
      const flags = [e.encrypted ? (e.aes ? 'AES!' : T('пароль', 'password')) : '', e.recovered ? T('восст.', 'recovered') : ''].filter(Boolean).join(',');
      lines.push([e.name, e.isDir ? '<dir>' : e.size, e.methodName, flags].join('\t'));
    });
    return lines.join('\n');
  }

  function textLikeStrings(bytes) {
    const items = NS.Strings.extractStrings(bytes, { minLen: 4, kinds: 'all', limit: 2000 }).items;
    return items.map((s) => s.text);
  }

  /** Строки одной записи для поиска: у .class — константы, иначе все строки. */
  function entryStrings(name, bytes) {
    if (/\.class$/i.test(name) || (bytes.length > 4 && NS.u32be(bytes, 0) === 0xcafebabe)) {
      try { return NS.ClassFile.allStrings(bytes); } catch (e) { /* битый класс — ищем как в обычном файле */ }
    }
    return textLikeStrings(bytes);
  }

  /**
   * Поиск по содержимому всех записей (рекурсивно по вложенным архивам).
   * @returns {{lines:string[], scanned:number, skipped:string[]}}
   */
  function grep(bytes, pattern, password, opts) {
    let re;
    try { re = new RegExp(pattern, 'i'); } catch (e) { throw new Error(T('Неверное регулярное выражение: ', 'Invalid regular expression: ') + e.message); }
    const max = (opts && opts.maxLines) || 500;
    const lines = [];
    const skipped = [];
    let scanned = 0;
    const walk = (buf, prefix, depth) => {
      const a = open(buf);
      for (const e of a.entries) {
        if (e.isDir || lines.length >= max) continue;
        const label = prefix + e.name;
        if (re.test(e.name)) lines.push(label + '  ' + T('(имя)', '(name)'));
        let data;
        try {
          if (e.size > MAX_GREP_ENTRY) throw new Error('large');
          data = a.read(e, password);
        } catch (err) { skipped.push(label + ': ' + (err.code === 'password' ? T('нужен пароль', 'password needed') : err.message)); continue; }
        scanned++;
        for (const s of entryStrings(e.name, data)) if (re.test(s) && lines.length < max) lines.push(label + ': ' + (s.length > 200 ? s.slice(0, 200) + '…' : s));
        if (depth < MAX_DEPTH && /\.(zip|jar|apk|war|docx|xlsx|pptx)$/i.test(e.name)) {
          try { walk(data, label + NESTED_SEP, depth + 1); } catch (err) { /* вложенный файл не архив */ }
        }
      }
    };
    walk(bytes, '', 0);
    return { lines, scanned, skipped };
  }

  NS.Archive = { open, findEntry, resolve, listing, grep, entryStrings, baseName, NESTED_SEP, UNSUPPORTED_ARCHIVES };
})(typeof self !== 'undefined' ? self : this);
