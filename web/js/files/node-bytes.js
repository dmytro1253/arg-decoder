// Явные переходы между текстом, байтами и файлами-артефактами, которых не хватало цепочкам (аудит 2026-10-23):
//  • «Байты → файл»: байтовая строка (после HEX/Base64/XOR…) или текст становится артефактом с MIME по сигнатуре;
//  • «Файл → байты»: артефакт превращается обратно в байтовую строку, hex или Base64 для текстовых операций;
//  • «Склейка файлов»: бинарная склейка частей (половины PDF и т. п.) в новый артефакт с границами частей;
//  • «Биты → картинка»: строки из 0/1 становятся картинкой-артефактом (дальше QR, OCR, обработка).
// Исходные байты не меняются; текстовый Join остаётся текстовым — у этих нод другой контракт.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = G.ArgFiles;
  const NT = G.NodeTypes || (G.NodeTypes = {});
  const MAX_PARTS = 4;
  const MAX_BITS_SIDE = 2048;

  const status = (body, text, cls) => {
    let box = body.querySelector('.special');
    if (!box) { box = document.createElement('div'); box.className = 'special'; body.appendChild(box); }
    box.textContent = text || '';
    box.className = 'special small ' + (cls || 'muted');
  };

  /** Байты значения из графа по выбранному чтению: как есть, UTF-8, hex или Base64. */
  function readBytes(value, how) {
    if (NS.isHandle(value)) return NS.artifactBytes(value);
    const text = String(value === undefined || value === null ? '' : value);
    if (how === 'hex') return NS.hexToBytes(text);
    if (how === 'base64') {
      const bin = atob(text.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/'));
      return Uint8Array.from(bin, (c) => c.charCodeAt(0));
    }
    if (how === 'utf8') return NS.encodeString(text, 'utf8');
    return NS.bytesAuto(text);
  }

  const READ_OPTIONS = [['auto', T('байтовая строка как есть (UTF-8, если есть символы > 255)', 'byte string as is (UTF-8 if any character > 255)')], ['utf8', T('текст → UTF-8', 'text → UTF-8')], ['hex', 'HEX'], ['base64', 'Base64']];

  /** Имя файла: заданное или по сигнатуре. */
  function nameFor(bytes, wanted, fallback) {
    const fmt = NS.Signatures.detect(bytes);
    const name = String(wanted || '').trim() || fallback + (fmt.ext ? '.' + fmt.ext : '.bin');
    return { name, fmt, mime: fmt.mime || 'application/octet-stream' };
  }

  NT.bytes_to_file = {
    name: T('Байты → файл', 'Bytes → file'), cat: 'Файлы', inputs: [T('байты/текст', 'bytes/text')],
    desc: T('Делает из байтовой строки (результат HEX, Base64, XOR…) или текста файл-артефакт. Тип определяется по сигнатуре, поэтому дальше подключаются инспектор файлов, картинки, звук, архивы.',
      'Turns a byte string (the output of HEX, Base64, XOR…) or text into a file artifact. The type comes from the signature, so the file inspector, images, audio and archives can follow.'),
    params: [
      { key: 'read', label: T('Вход читать как', 'Read the input as'), type: 'select', options: READ_OPTIONS, default: 'auto' },
      { key: 'name', label: T('Имя файла (пусто — по сигнатуре)', 'File name (empty = from the signature)'), type: 'text', default: '' },
    ],
    compute([v], p, node) {
      if (v === undefined || v === '') throw new Error(T('Подключи байты или текст', 'Connect bytes or text'));
      const bytes = readBytes(v, p.read);
      const f = nameFor(bytes, p.name, 'data');
      node.state.info = { size: bytes.length, fmt: f.fmt.name };
      return NS.derive('b2f_' + NS.keyOf(f.name + '|' + NS.toBase64(bytes.subarray(0, 4096)) + '|' + bytes.length), f.name, bytes, f.mime);
    },
    update(node, res, body) {
      const i = node.state.info;
      status(body, res.error ? res.error : i ? T('Файл: ', 'File: ') + i.fmt + ' · ' + NS.fmtSize(i.size) : '', res.error ? 'fx-warn' : 'muted');
    },
  };

  NT.file_to_bytes = {
    name: T('Файл → байты', 'File → bytes'), cat: 'Файлы', inputs: [T('файл', 'file')],
    desc: T('Превращает файл-артефакт в байтовую строку (для XOR, хешей, сдвигов), hex или Base64. Байты не меняются.',
      'Turns a file artifact into a byte string (for XOR, hashes, shifts), hex or Base64. The bytes are unchanged.'),
    params: [
      { key: 'as', label: T('Выход', 'Output'), type: 'select', options: [['bytes', T('байтовая строка', 'byte string')], ['hex', 'HEX'], ['base64', 'Base64'], ['utf8', T('текст UTF-8', 'UTF-8 text')]], default: 'bytes' },
      { key: 'limit', label: T('Максимум байт', 'Max bytes'), type: 'number', default: 4194304 },
    ],
    compute([v], p, node) {
      const all = NS.requireArtifactBytes(v);
      const max = Math.max(1, Number(p.limit) || 4194304);
      const bytes = all.length > max ? all.subarray(0, max) : all;
      node.state.info = { size: all.length, cut: all.length > max };
      if (p.as === 'hex') return NS.toHex(bytes, ' ');
      if (p.as === 'base64') return NS.toBase64(bytes);
      if (p.as === 'utf8') return NS.decodeUtf8(bytes);
      return NS.decodeLatin1(bytes);
    },
    update(node, res, body) {
      const i = node.state.info;
      status(body, res.error ? res.error : i ? NS.fmtSize(i.size) + (i.cut ? T(' · обрезано по лимиту', ' · cut at the limit') : '') : '', res.error || (i && i.cut) ? 'fx-warn' : 'muted');
    },
  };

  NT.file_concat = {
    name: T('Склейка файлов (байты)', 'Join files (bytes)'), cat: 'Файлы',
    inputs: [T('часть 1', 'part 1'), T('часть 2', 'part 2'), T('часть 3', 'part 3'), T('часть 4', 'part 4')],
    noInputOk: true,
    desc: T('Склеивает части как байты по порядку входов: артефакты (например, «.pdfaa» + «.wav», который на деле продолжение PDF) или байтовые строки. Выход — новый файл с типом по сигнатуре; показываются размеры и границы частей.',
      'Joins the parts as bytes in input order: artifacts (for example “.pdfaa” + a “.wav” that is really the rest of the PDF) or byte strings. The output is a new file typed by its signature; part sizes and boundaries are shown.'),
    params: [
      { key: 'name', label: T('Имя результата (пусто — по сигнатуре)', 'Result name (empty = from the signature)'), type: 'text', default: '' },
    ],
    compute(inputs, p, node) {
      const parts = inputs.slice(0, MAX_PARTS).map((v, i) => ({ v, i })).filter((x) => x.v !== undefined && x.v !== '');
      if (parts.length < 2) throw new Error(T('Подключи хотя бы две части', 'Connect at least two parts'));
      const bytes = parts.map((x) => NS.bytesAuto(x.v));
      const joined = NS.concat(bytes);
      const f = nameFor(joined, p.name, 'joined');
      let offset = 0;
      node.state.info = { size: joined.length, fmt: f.fmt.name, parts: bytes.map((b, k) => { const r = { port: parts[k].i + 1, start: offset, size: b.length, fmt: NS.Signatures.detect(b).name }; offset += b.length; return r; }), declared: pdfDeclaredLength(joined) };
      return NS.derive('cat_' + NS.keyOf(bytes.map((b) => b.length + ':' + NS.toBase64(b.subarray(0, 512))).join('|') + '|' + f.name), f.name, joined, f.mime);
    },
    update(node, res, body) {
      const i = node.state.info;
      if (res.error || !i) { status(body, res.error || '', 'fx-warn'); return; }
      const lines = [T('Итог: ', 'Result: ') + i.fmt + ' · ' + NS.fmtSize(i.size)]
        .concat(i.parts.map((x) => T('часть ', 'part ') + x.port + ': ' + T('с байта ', 'from byte ') + x.start + ', ' + NS.fmtSize(x.size) + ' · ' + x.fmt));
      if (i.declared) lines.push(T('PDF заявляет длину ', 'The PDF declares length ') + i.declared + (i.declared === i.size ? T(' — совпадает', ' — matches') : T(' — не совпадает', ' — does not match')));
      status(body, lines.join('\n'), i.declared && i.declared !== i.size ? 'fx-warn' : 'muted');
      body.querySelector('.special').style.whiteSpace = 'pre-line';
    },
  };

  /** Длина из словаря /L линеаризованного PDF (если есть) — проверка, что части собраны целиком. */
  function pdfDeclaredLength(bytes) {
    if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) return null;
    const head = NS.decodeLatin1(bytes.subarray(0, 2048));
    const m = head.match(/\/Linearized[^>]*\/L\s+(\d+)/);
    return m ? Number(m[1]) : null;
  }

  /** Сетка битов из текста: строки — ряды; без переводов строк режется по ширине. */
  function bitGrid(text, p) {
    const on = String(p.on || '1');
    const off = String(p.off || '0');
    const rowsRaw = String(text).split(/\r?\n/).map((r) => Array.from(r).filter((c) => c === on || c === off).join('')).filter(Boolean);
    let rows;
    const width = Math.floor(Number(p.width) || 0);
    if (rowsRaw.length > 1 && !width) rows = rowsRaw;
    else {
      const flat = rowsRaw.join('');
      const w = width || Math.round(Math.sqrt(flat.length));
      if (!w || flat.length < w) throw new Error(T('Слишком мало битов для картинки', 'Too few bits for an image'));
      rows = [];
      for (let i = 0; i + w <= flat.length; i += w) rows.push(flat.slice(i, i + w));
      if (flat.length % w) rows.push(flat.slice(flat.length - (flat.length % w)).padEnd(w, off));
    }
    const w = Math.max(...rows.map((r) => r.length));
    if (w > MAX_BITS_SIDE || rows.length > MAX_BITS_SIDE) throw new Error(T('Сетка больше ' + MAX_BITS_SIDE + ' клеток по стороне', 'The grid exceeds ' + MAX_BITS_SIDE + ' cells per side'));
    let grid = rows.map((r) => Array.from(r.padEnd(w, off), (c) => (c === on ? 1 : 0)));
    if (p.order === 'cols') grid = grid[0].map((_, x) => grid.map((row) => row[x]));
    if (p.flipH) grid = grid.map((row) => row.slice().reverse());
    if (p.flipV) grid = grid.slice().reverse();
    return grid;
  }

  /** Сетка → RGBA: «включённый» бит чёрный (или белый при инверсии), с полями и масштабом. */
  function gridPixels(grid, p) {
    const scale = Math.max(1, Math.min(32, Math.floor(Number(p.scale) || 8)));
    const margin = Math.max(0, Math.min(16, Math.floor(Number(p.margin) || 0)));
    const gw = grid[0].length, gh = grid.length;
    const width = (gw + 2 * margin) * scale, height = (gh + 2 * margin) * scale;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const dark = grid[y][x] ? !p.invert : !!p.invert;
      if (!dark) continue;
      for (let dy = 0; dy < scale; dy++) {
        const row = ((y + margin) * scale + dy) * width;
        for (let dx = 0; dx < scale; dx++) {
          const o = (row + (x + margin) * scale + dx) * 4;
          data[o] = data[o + 1] = data[o + 2] = 0;
        }
      }
    }
    return { width, height, data };
  }

  NT.bits_to_image = {
    name: T('Биты → картинка', 'Bits → image'), cat: 'Изображения', inputs: [T('биты', 'bits')],
    desc: T('Строки из 0 и 1 (или своих символов) становятся картинкой-артефактом: ширина, порядок (по строкам или столбцам), отражения, инверсия, масштаб и белые поля. Дальше подключается «QR и штрих-коды», OCR или обработка.',
      'Rows of 0 and 1 (or your own characters) become an image artifact: width, order (by rows or columns), flips, inversion, scale and a white margin. Then connect “QR and barcodes”, OCR or processing.'),
    params: [
      { key: 'width', label: T('Ширина в клетках (0 — по строкам или квадрат)', 'Width in cells (0 = by lines or square)'), type: 'number', default: 0 },
      { key: 'on', label: T('Символ «чёрной» клетки', 'Character of a “black” cell'), type: 'text', default: '1' },
      { key: 'off', label: T('Символ «белой» клетки', 'Character of a “white” cell'), type: 'text', default: '0' },
      { key: 'order', label: T('Порядок', 'Order'), type: 'select', options: [['rows', T('по строкам', 'by rows')], ['cols', T('по столбцам (транспонировать)', 'by columns (transpose)')]], default: 'rows' },
      { key: 'flipH', label: T('Отразить по горизонтали', 'Flip horizontally'), type: 'bool', default: false },
      { key: 'flipV', label: T('Отразить по вертикали', 'Flip vertically'), type: 'bool', default: false },
      { key: 'invert', label: T('Инвертировать', 'Invert'), type: 'bool', default: false },
      { key: 'scale', label: T('Пикселей на клетку', 'Pixels per cell'), type: 'number', default: 8 },
      { key: 'margin', label: T('Белое поле, клеток (для QR нужно 4)', 'White margin, cells (QR needs 4)'), type: 'number', default: 4 },
    ],
    compute([v], p, node) {
      if (v === undefined || v === '') throw new Error(T('Подключи строки из битов', 'Connect rows of bits'));
      const grid = bitGrid(v, p);
      const px = gridPixels(grid, p);
      node.state.info = { cols: grid[0].length, rows: grid.length };
      const key = 'bits_' + NS.keyOf(String(v).slice(0, 20000) + JSON.stringify([p.width, p.on, p.off, p.order, p.flipH, p.flipV, p.invert, p.scale, p.margin]));
      const meta = { name: T('биты.png', 'bits.png'), mime: 'image/png', width: px.width, height: px.height };
      const A = G.Artifacts;
      if (!A.has('d_' + key)) {
        A.addDerived(key, 'image', px, meta);
        const item = A.get('d_' + key);
        if (G.ImgStore && G.ImgStore.pngDataUrl) Object.defineProperty(item, 'dataUrl', { configurable: true, enumerable: false, get() { return G.ImgStore.pngDataUrl(px); } });
      }
      return A.handle('d_' + key);
    },
    update(node, res, body) {
      const i = node.state.info;
      status(body, res.error ? res.error : i ? T('Сетка ', 'Grid ') + i.cols + '×' + i.rows : '', res.error ? 'fx-warn' : 'muted');
    },
  };

  G.ArgFiles.BitImage = { bitGrid, gridPixels, pdfDeclaredLength };
})(typeof self !== 'undefined' ? self : this);
