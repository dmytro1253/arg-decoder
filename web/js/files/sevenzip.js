// Распаковка RAR (4 и 5, в том числе с зашифрованными заголовками), 7z (в том числе AES) и прочих форматов 7-Zip
// локально в браузере: 7-Zip 24.09, собранный в WebAssembly (web/vendor/7z-wasm, LGPL + ограничение unRAR).
// Библиотека грузится по требованию; всё происходит в памяти (файловая система Emscripten), на диск ничего
// не пишется. Пароль всегда передаётся явно (-p), чтобы 7-Zip не спрашивал его через окно браузера.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const MAX_TOTAL = 256 * 1024 * 1024;   // суммарный объём распакованного в одной операции
  const MAX_ENTRIES = 5000;
  let loading = null;

  function vendorUrl(name) {
    const tag = Array.prototype.find.call((G.document && G.document.scripts) || [], (x) => /vendor\/7z-wasm\/7zz\.umd\.js/.test(x.src));
    const base = tag ? tag.src.replace(/7zz\.umd\.js.*$/, '') : new URL('vendor/7z-wasm/', G.document.baseURI).href;
    return base + name;
  }

  /** Работает ли распаковка здесь; иначе понятная причина (из file:// браузер не загрузит wasm). */
  function availability() {
    if (G.SevenZipFactory || typeof G.SevenZip === 'function') return { ok: true };
    if (!G.document) return { ok: false, reason: T('Нет браузера', 'No browser') };
    if (G.location && G.location.protocol === 'file:') return { ok: false, reason: T('RAR/7z не распаковываются из file://: браузер не загрузит wasm. Запусти программу через Start (локальный сервер).', 'RAR/7z cannot be extracted from file://: the browser will not load wasm. Start the app with Start (local server).') };
    return { ok: true };
  }

  async function factory() {
    if (G.SevenZipFactory) return G.SevenZipFactory;
    if (typeof G.SevenZip === 'function') return G.SevenZip;
    const a = availability();
    if (!a.ok) throw new Error(a.reason);
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = G.document.createElement('script');
        s.src = vendorUrl('7zz.umd.js');
        s.onload = () => (typeof G.SevenZip === 'function' ? resolve(G.SevenZip) : reject(new Error('7zz.umd.js')));
        s.onerror = () => { loading = null; reject(new Error(T('Не загрузился web/vendor/7z-wasm/7zz.umd.js', 'web/vendor/7z-wasm/7zz.umd.js did not load'))); };
        G.document.head.appendChild(s);
      });
    }
    return loading;
  }

  // Новый экземпляр на операцию: состояние CLI и файловой системы не переходит между архивами.
  async function run(bytes, args) {
    const make = await factory();
    const out = [];
    const opts = { print: (s) => out.push(s), printErr: (s) => out.push(s) };
    if (G.document && !G.SevenZipFactory) opts.locateFile = (f) => vendorUrl(f);   // в Node wasm лежит рядом с модулем
    const z = await make(opts);
    z.FS.writeFile('/archive', bytes);
    let code;
    try { code = z.callMain(args.concat(['/archive'])); } catch (e) {
      // Исключение C++ внутри wasm приходит числом: 7-Zip прервался на данных (чаще всего — неверный пароль к данным).
      code = typeof e.status === 'number' ? e.status : 2;
      out.push(typeof e === 'number' ? 'Data Error: 7-Zip aborted while decoding (wrong password or damaged data)' : String(e.message || e));
    }
    return { z, code, out };
  }

  function explain(out) {
    const text = out.join('\n');
    if (/Wrong password|Cannot open encrypted archive/i.test(text)) return T('Неверный пароль (или архив с зашифрованными заголовками и пароль не указан)', 'Wrong password (or an archive with encrypted headers and no password given)');
    if (/Can ?not open the file as archive|Is not archive/i.test(text)) return T('7-Zip не открыл файл как архив: формат не поддерживается или файл повреждён', '7-Zip could not open the file as an archive: unsupported format or a damaged file');
    if (/wrong password or damaged data/.test(text)) return T('Неверный пароль к данным или архив повреждён (7-Zip прервал распаковку)', 'Wrong password for the data or a damaged archive (7-Zip aborted extraction)');
    if (/Unexpected end of archive|Headers Error|CRC Failed|Data Error/i.test(text)) return T('Архив повреждён или неполон: ', 'The archive is damaged or incomplete: ') + (text.match(/(Unexpected end of archive|Headers Error|CRC Failed[^\n]*|Data Error[^\n]*)/i) || [''])[0];
    return T('7-Zip завершился с ошибкой: ', '7-Zip failed: ') + (out.filter((l) => /error/i.test(l)).slice(0, 2).join(' ') || text.slice(-200));
  }

  /** Записи из вывода «7zz l -slt»: путь, размер, сжатый размер, папка, шифрование, метод. */
  function parseList(out) {
    const entries = [];
    let cur = null;
    let started = false;
    for (const line of out) {
      if (/^-{5,}$/.test(line.trim())) { started = true; continue; }
      if (!started) continue;
      const m = line.match(/^([A-Za-z ]+?) = (.*)$/);
      if (!m) { if (cur && cur.path !== undefined) entries.push(cur); cur = null; continue; }
      cur = cur || {};
      const [, k, v] = m;
      if (k === 'Path') cur.path = v;
      else if (k === 'Size') cur.size = Number(v) || 0;
      else if (k === 'Packed Size') cur.packed = Number(v) || 0;
      else if (k === 'Folder') cur.dir = v === '+';
      else if (k === 'Attributes' && /D/.test(v.split(' ')[0] || '')) cur.dir = true;
      else if (k === 'Encrypted') cur.encrypted = v === '+';
      else if (k === 'Method') cur.method = v;
    }
    if (cur && cur.path !== undefined) entries.push(cur);
    return entries;
  }

  /** Список записей. Ошибки (пароль, формат) — исключение с понятным текстом. */
  async function list(bytes, password) {
    const { code, out } = await run(bytes, ['l', '-slt', '-bd', '-y', '-p' + (password || '')]);
    if (code !== 0) throw new Error(explain(out));
    const type = (out.find((l) => /^Type = /.test(l)) || '').replace('Type = ', '');
    const headers = out.some((l) => /^Headers Encrypted|^Encrypted = \+/.test(l));
    return { type, entries: parseList(out).slice(0, MAX_ENTRIES), headersEncrypted: headers };
  }

  /** Все файлы архива в памяти: [{ path, bytes }]. Сумма ограничена MAX_TOTAL. */
  async function extractAll(bytes, password) {
    await list(bytes, password);   // пароль к заголовкам и формат проверяются до распаковки — с понятной ошибкой
    const { z, code, out } = await run(bytes, ['x', '-bd', '-y', '-o/out', '-p' + (password || '')]);
    if (code !== 0) throw new Error(explain(out));
    const files = [];
    let total = 0;
    const walk = (dir, rel) => {
      for (const name of z.FS.readdir(dir)) {
        if (name === '.' || name === '..') continue;
        const full = dir + '/' + name;
        const st = z.FS.stat(full);
        if (z.FS.isDir(st.mode)) { walk(full, rel + name + '/'); continue; }
        total += st.size;
        if (total > MAX_TOTAL || files.length >= MAX_ENTRIES) throw new Error(T('Распакованное больше предела (256 МБ или 5000 файлов)', 'Extracted data exceed the limit (256 MB or 5000 files)'));
        files.push({ path: rel + name, bytes: z.FS.readFile(full) });
      }
    };
    walk('/out', '');
    return files;
  }

  G.ArgFiles = G.ArgFiles || {};
  G.ArgFiles.SevenZip = { availability, list, extractAll, parseList, explain };
})(typeof self !== 'undefined' ? self : this);
