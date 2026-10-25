// Ноды обработки изображений (категория «Изображения»): тона и цвет, геометрия и обрезка, битовые плоскости,
// LSB-извлечение, метаданные. Вход и выход — ручки артефактов "artifact:<id>" (кроме LSB и метаданных: они
// выдают текст). Исходное изображение не меняется: результат — производный артефакт, кэш по рецепту.
(function (G) {
  'use strict';

  const N = G.ImgNodes;
  const { T, h, CAT } = N;
  const P = () => G.ImgProc;
  const IN = () => [T('изображение', 'image')];

  // ---------- общая фабрика нод «картинка → картинка» ----------
  /**
   * def: { name, desc, params, steps(p) → [{op,...}], select: bool (выбор области кадрирования),
   *        baseName }. Просмотрщик показывает результат, кнопка «До/после» — исходник.
   */
  function imageOpNode(def) {
    return {
      name: def.name, cat: CAT, desc: def.desc, wide: true, inputs: IN(),
      params: def.params.concat(def.select ? N.REGION_PARAMS.map((q) => Object.assign({}, q, { key: 'c' + q.key.slice(1) })) : []),
      compute(inputs, p, node) {
        const px = G.ImgStore.get(inputs[0]);
        if (!px) return undefined;
        const steps = def.steps(p);
        const key = def.id + '|' + P().recipeKey(steps);
        const handle = G.ImgStore.derive(inputs[0], key, () => P().applyRecipe(px, steps), def.name);
        node.state.src = px;
        node.state.out = G.ImgStore.get(handle);
        return handle;
      },
      update(node, res, body, ui) {
        node.state.requestEval = () => ui.requestEval();
        const u = N.box(node, body, (el) => {
          const viewer = G.ImgViewer.create({
            height: 230,
            select: !!def.select,
            altLabel: def.select ? T('Результат', 'Result') : undefined,
            onRegion: def.select ? (r) => { node.params.cx = r ? r.x : 0; node.params.cy = r ? r.y : 0; node.params.cw = r ? r.w : 0; node.params.ch = r ? r.h : 0; ui.requestEval(); } : null,
          });
          const info = h('div', 'img-status small muted');
          const dl = h('button', 'btn tiny', T('Скачать PNG', 'Download PNG'));
          dl.onclick = () => { if (node.state.out) download(node.state.out, 'image.png'); };
          el.append(viewer.el, info, dl);
          return { viewer, info };
        });
        if (res.error) { N.status(u.info, res.error, 'error'); return; }
        if (res.value === undefined) { N.status(u.info, res.empty ? T('Подключи изображение', 'Connect an image') : T('Декодирую…', 'Decoding…')); return; }
        const out = node.state.out, src = node.state.src;
        if (def.select) {
          const r = node.params.cw > 0 ? { x: node.params.cx, y: node.params.cy, w: node.params.cw, h: node.params.ch } : null;
          u.viewer.setImage(src, out);
          u.viewer.setRegion(r);
        } else u.viewer.setImage(out, src);
        N.status(u.info, `${out.width}×${out.height}`);
      },
    };
  }

  function download(img, name) {
    const a = document.createElement('a');
    a.href = G.ImgStore.pngDataUrl(img);
    a.download = name;
    a.click();
  }

  // ---------- тона и цвет ----------
  const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

  G.NodeTypes.img_adjust = imageOpNode({
    id: 'adjust',
    name: T('Изображение: тона и цвет', 'Image: tones and colour'),
    desc: T('Яркость, контраст, гамма, уровни, поднятие теней («высветлить»), автоуровни, инверсия, оттенки серого, порог, канал R/G/B/A. Порядок: канал → серый → уровни → тени → гамма → яркость/контраст → авто → инверсия → порог. «До/после» сравнивает с исходником. Оригинал не меняется.',
      'Brightness, contrast, gamma, levels, shadow lift, auto-levels, invert, grayscale, threshold, R/G/B/A channel. Order: channel → gray → levels → shadows → gamma → brightness/contrast → auto → invert → threshold. Before/after compares with the original. The original is never modified.'),
    params: [
      { key: 'channel', label: T('Канал', 'Channel'), type: 'select', default: 'all', options: [['all', T('все', 'all')], ['r', 'R'], ['g', 'G'], ['b', 'B'], ['a', 'Alpha'], ['luma', T('яркость', 'luma')]] },
      { key: 'gray', label: T('Оттенки серого', 'Grayscale'), type: 'bool', default: false },
      { key: 'black', label: T('Чёрная точка, 0–254', 'Black point, 0–254'), type: 'range', min: 0, max: 254, step: 1, int: true, default: 0 },
      { key: 'white', label: T('Белая точка, 1–255', 'White point, 1–255'), type: 'range', min: 1, max: 255, step: 1, int: true, default: 255 },
      { key: 'lift', label: T('Поднять тени, %', 'Shadow lift, %'), type: 'range', min: 0, max: 100, step: 1, unit: '%', default: 0 },
      { key: 'gamma', label: T('Гамма, 0.1–5', 'Gamma, 0.1–5'), type: 'range', min: 0.1, max: 5, step: 0.05, default: 1 },
      { key: 'brightness', label: T('Яркость, −255…255', 'Brightness, −255…255'), type: 'range', min: -255, max: 255, step: 1, int: true, default: 0 },
      { key: 'contrast', label: T('Контраст, −100…100', 'Contrast, −100…100'), type: 'range', min: -100, max: 100, step: 1, int: true, default: 0 },
      { key: 'auto', label: T('Авто', 'Auto'), type: 'select', default: 'none', options: [['none', T('нет', 'none')], ['levels', T('автоуровни', 'auto-levels')], ['levelsRgb', T('автоуровни по каналам', 'auto-levels per channel')], ['equalize', T('выравнивание гистограммы', 'histogram equalize')]] },
      { key: 'invert', label: T('Инвертировать', 'Invert'), type: 'bool', default: false },
      { key: 'thr', label: T('Порог', 'Threshold'), type: 'select', default: 'none', options: [['none', T('нет', 'none')], ['fixed', T('фиксированный', 'fixed')], ['otsu', T('Отсу (авто)', 'Otsu (auto)')]] },
      { key: 'thrLevel', label: T('Уровень порога, 0–255', 'Threshold level, 0–255'), type: 'range', min: 0, max: 255, step: 1, int: true, default: 128 },
    ],
    steps(p) {
      const s = [];
      if (p.channel && p.channel !== 'all') s.push({ op: 'channel', name: p.channel });
      if (p.gray) s.push({ op: 'grayscale', mode: 'luma' });
      if (num(p.black, 0) > 0 || num(p.white, 255) < 255) s.push({ op: 'levels', black: num(p.black, 0), white: Math.max(num(p.black, 0) + 1, num(p.white, 255)), gamma: 1 });
      if (num(p.lift, 0) > 0) s.push({ op: 'shadowLift', strength: num(p.lift, 0) });
      if (num(p.gamma, 1) !== 1) s.push({ op: 'gamma', value: Math.max(0.1, Math.min(5, num(p.gamma, 1))) });
      if (num(p.brightness, 0) !== 0) s.push({ op: 'brightness', amount: num(p.brightness, 0) });
      if (num(p.contrast, 0) !== 0) s.push({ op: 'contrast', amount: num(p.contrast, 0) });
      if (p.auto === 'levels') s.push({ op: 'autoLevels', clip: 0.5, perChannel: false });
      if (p.auto === 'levelsRgb') s.push({ op: 'autoLevels', clip: 0.5, perChannel: true });
      if (p.auto === 'equalize') s.push({ op: 'equalize' });
      if (p.invert) s.push({ op: 'invert' });
      if (p.thr === 'fixed') s.push({ op: 'threshold', auto: false, level: num(p.thrLevel, 128) });
      if (p.thr === 'otsu') s.push({ op: 'threshold', auto: true });
      return s;
    },
  });

  // ---------- геометрия и обрезка ----------
  G.NodeTypes.img_geom = imageOpNode({
    id: 'geom',
    name: T('Изображение: обрезка и поворот', 'Image: crop and rotate'),
    desc: T('Обрезка по области (кнопка «Область» и перетаскивание по картинке), поворот на 90/180/270°, отражения, увеличение без сглаживания. Порядок: обрезка → поворот → отражение → масштаб. Кнопка «Результат» показывает итог.',
      'Crop by region (the Region button, then drag), rotate by 90/180/270°, flips, nearest-neighbour scaling. Order: crop → rotate → flip → scale. The Result button shows the output.'),
    select: true,
    params: [
      { key: 'rotate', label: T('Поворот', 'Rotate'), type: 'select', default: '0', options: [['0', '0°'], ['90', '90° →'], ['180', '180°'], ['270', '270° (90° ←)']] },
      { key: 'flipH', label: T('Отразить по горизонтали', 'Flip horizontally'), type: 'bool', default: false },
      { key: 'flipV', label: T('Отразить по вертикали', 'Flip vertically'), type: 'bool', default: false },
      { key: 'scale', label: T('Увеличить в … раз', 'Scale by …'), type: 'range', min: 0.1, max: 16, step: 0.1, unit: '×', default: 1 },
    ],
    steps(p) {
      const s = [];
      if (num(p.cw, 0) > 0 && num(p.ch, 0) > 0) s.push({ op: 'crop', x: num(p.cx, 0), y: num(p.cy, 0), w: num(p.cw, 0), h: num(p.ch, 0) });
      if (num(p.rotate, 0)) s.push({ op: 'rotate', degrees: num(p.rotate, 0) });
      if (p.flipH) s.push({ op: 'flipH' });
      if (p.flipV) s.push({ op: 'flipV' });
      const k = Math.max(0.1, Math.min(16, num(p.scale, 1)));
      if (k !== 1) s.push({ op: 'scale', factor: k });
      return s;
    },
  });

  // ---------- битовые плоскости ----------
  G.NodeTypes.img_bits = imageOpNode({
    id: 'bits',
    name: T('Изображение: битовая плоскость', 'Image: bit plane'),
    desc: T('Показывает один бит выбранного канала как чёрно-белую картинку (бит 0 — младший). Так ищут скрытые узоры, спрятанные в младших битах (стеганография LSB). Скрытые данные в JPEG после пересохранения теряются — берите исходный файл.',
      'Shows one bit of the chosen channel as a black-and-white image (bit 0 is the least significant). Used to spot patterns hidden in low bits (LSB steganography). JPEG re-saving destroys such data, so use the original file.'),
    params: [
      { key: 'name', label: T('Канал', 'Channel'), type: 'select', default: 'r', options: [['r', 'R'], ['g', 'G'], ['b', 'B'], ['a', 'Alpha']] },
      { key: 'bit', label: T('Бит (0 — младший … 7)', 'Bit (0 = lowest … 7)'), type: 'range', min: 0, max: 7, step: 1, int: true, default: 0 },
    ],
    steps: (p) => [{ op: 'bitPlane', name: p.name || 'r', bit: num(p.bit, 0) }],
  });

  // ---------- LSB-извлечение ----------
  function printableRatio(bytes) {
    if (!bytes.length) return 0;
    let ok = 0;
    for (const b of bytes) if ((b >= 32 && b < 127) || b === 10 || b === 13 || b === 9) ok++;
    return ok / bytes.length;
  }

  function hexDump(bytes, n) {
    const rows = [];
    for (let i = 0; i < Math.min(bytes.length, n); i += 16) {
      const part = Array.from(bytes.subarray(i, Math.min(i + 16, bytes.length)));
      rows.push(part.map((b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(47) + '  ' + part.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join(''));
    }
    return rows.join('\n');
  }

  G.NodeTypes.img_lsb = {
    name: T('Изображение: LSB-извлечение', 'Image: LSB extraction'), cat: CAT, wide: true, inputs: IN(),
    desc: T('Собирает младшие биты пикселей в байты. Каналы (порядок обхода), число бит, порядок бит в байте, обход по строкам или столбцам, пропуск бит. Выход — строка latin1 (по символу на байт); подходит для Base64/hex/ASCII-текстов.',
      'Collects the low bits of pixels into bytes. Channels (traversal order), number of bits, bit order within a byte, row or column scan, skip. Output is a latin1 string (one char per byte), ready for Base64/hex/ASCII chains.'),
    params: [
      { key: 'channels', label: T('Каналы (r g b a в нужном порядке)', 'Channels (r g b a in order)'), type: 'text', default: 'rgb' },
      { key: 'bits', label: T('Сколько младших бит, 1–8', 'Low bits per channel, 1–8'), type: 'range', min: 1, max: 8, step: 1, int: true, default: 1 },
      { key: 'bitOrder', label: T('Порядок бит в байте', 'Bit order in a byte'), type: 'select', default: 'msb', options: [['msb', T('старший первым (MSB)', 'MSB first')], ['lsb', T('младший первым (LSB)', 'LSB first')]] },
      { key: 'scan', label: T('Обход', 'Scan'), type: 'select', default: 'row', options: [['row', T('по строкам', 'by rows')], ['col', T('по столбцам', 'by columns')]] },
      { key: 'skip', label: T('Пропустить бит в начале', 'Skip bits at start'), type: 'number', default: 0 },
      { key: 'invert', label: T('Инвертировать биты', 'Invert bits'), type: 'bool', default: false },
      { key: 'limit', label: T('Макс. байт на выходе (0 — все)', 'Max output bytes (0 = all)'), type: 'number', default: 0 },
    ],
    compute([v], p, node) {
      const px = G.ImgStore.get(v);
      if (!px) return undefined;
      let bytes = P().lsbExtract(px, { channels: p.channels, bits: p.bits, bitOrder: p.bitOrder, scan: p.scan, skip: p.skip, invert: p.invert });
      const lim = Math.max(0, Math.floor(num(p.limit, 0)));
      if (lim && bytes.length > lim) bytes = bytes.subarray(0, lim);
      node.state.bytes = bytes;
      return P().bytesToLatin1(bytes);
    },
    update(node, res, body, ui) {
      node.state.requestEval = () => ui.requestEval();
      const u = N.box(node, body, (el) => {
        const info = h('div', 'img-status small muted');
        const dump = h('pre', 'img-dump');
        el.append(info, dump);
        return { info, dump };
      });
      if (res.error) { N.status(u.info, res.error, 'error'); u.dump.textContent = ''; return; }
      if (res.value === undefined) { N.status(u.info, res.empty ? T('Подключи изображение', 'Connect an image') : T('Декодирую…', 'Decoding…')); u.dump.textContent = ''; return; }
      const b = node.state.bytes;
      const ratio = printableRatio(b);
      const verdict = ratio > 0.9 ? T('похоже на текст', 'looks like text') : ratio > 0.6 ? T('частично читаемо', 'partly readable') : T('похоже на шум или двоичные данные', 'looks like noise or binary data');
      N.status(u.info, `${N.fmtBytes(b.length)} · ${T('читаемых', 'printable')}: ${Math.round(ratio * 100)}% · ${verdict}`);
      u.dump.textContent = hexDump(b, 96);
    },
  };

  // ---------- метаданные ----------
  G.NodeTypes.img_meta = {
    name: T('Изображение: метаданные', 'Image: metadata'), cat: CAT, wide: true, inputs: IN(),
    desc: T('Размер, формат, текстовые чанки PNG (tEXt/zTXt/iTXt), комментарии JPEG/GIF, EXIF-текст и данные, дописанные после конца изображения (с поиском сигнатур ZIP, PNG и др.). Выход — текстовый отчёт.',
      'Size, format, PNG text chunks (tEXt/zTXt/iTXt), JPEG/GIF comments, EXIF text and data appended after the end of the image (with ZIP/PNG/etc. signature scan). Output is a text report.'),
    params: [],
    compute([v], p, node) {
      const orig = G.ImgStore.sourceOf(v);
      const id = G.Artifacts.idOf(orig);
      if (node.state.metaFor !== id) {
        const bytes = id && G.Artifacts.bytes(id);
        if (!bytes) throw new Error(T('Нет исходных байтов файла', 'The original file bytes are not available'));
        node.state.metaFor = id; node.state.bytes = bytes; node.state.meta = G.ImgMeta.parse(bytes);
      }
      const meta = node.state.meta;
      if (meta.texts.some((t) => t.compressed && t.value === null) && !node.state.inflating) {
        node.state.inflating = true;
        G.ImgMeta.inflateTexts(meta).then(() => { node.state.inflating = false; if (node.state.requestEval) node.state.requestEval(); });
      }
      return G.ImgMeta.report(meta, T);
    },
    update(node, res, body, ui) {
      node.state.requestEval = () => ui.requestEval();
      const u = N.box(node, body, (el) => {
        const info = h('div', 'img-status small muted');
        const tail = h('button', 'btn tiny hidden', T('Сохранить хвост как файл', 'Save trailing data as a file'));
        tail.onclick = async () => {
          const m = node.state.meta;
          if (!m || !m.trailing) return;
          await G.Artifacts.addBlob(new Blob([node.state.bytes.subarray(m.trailing.offset)]), 'trailing-data.bin');
          ui.toast(T('Хвост добавлен в артефакты — перетащи ноду «Артефакт» или выбери файл в ней', 'Trailing data added to artifacts'));
        };
        el.append(info, tail);
        return { info, tail };
      });
      if (res.error) { N.status(u.info, res.error, 'error'); return; }
      if (res.value === undefined) { N.status(u.info, res.empty ? T('Подключи изображение', 'Connect an image') : T('Декодирую…', 'Decoding…')); return; }
      const m = node.state.meta;
      N.status(u.info, `${m.format} · ${N.fmtBytes(m.size)}` + (m.width ? ` · ${m.width}×${m.height}` : '') + (m.trailing ? ' · ' + T('есть данные после конца', 'data after end') + ': ' + N.fmtBytes(m.trailing.length) : ''));
      u.tail.classList.toggle('hidden', !m.trailing);
    },
  };

  G.ImgNodes.imageOpNode = imageOpNode;
  G.ImgNodes.hexDump = hexDump;
})(typeof self !== 'undefined' ? self : this);
