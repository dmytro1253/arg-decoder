// Ноды распознавания (категория «Изображения»): OCR (tesseract.js локально + режим шрифта Minecraft),
// QR/штрих-код и SGA (алфавит стола зачарований). Выход — текст. Область (кнопка «Область» в просмотрщике)
// ограничивает распознавание нужным местом — для больших скриншотов это почти обязательно.
(function (G) {
  'use strict';

  const N = G.ImgNodes;
  const { T, h, CAT } = N;
  const IN = () => [T('изображение', 'image')];

  // Просмотрщик с выбором области: общий для трёх нод.
  function recogViewer(node, ui) {
    return G.ImgViewer.create({
      height: 230, select: true, beforeAfter: false, histogram: false,
      onRegion: (r) => { N.setRegion(node, r); ui.requestEval(); },
    });
  }

  function setupBase(node, body, ui, build) {
    node.state.requestEval = () => ui.requestEval();
    return N.box(node, body, (el) => {
      const viewer = recogViewer(node, ui);
      const info = h('div', 'img-status small muted');
      const out = build(el, viewer, info) || {};
      return Object.assign({ viewer, info }, out);
    });
  }

  function showInput(u, node, res, p) {
    const inp = res.value !== undefined || node.state.inp ? node.state.inp : null;
    if (inp) { u.viewer.setImage(inp.px); u.viewer.setRegion(inp.region); }
    return inp;
  }

  // ---------- OCR ----------
  const LANGS = [['eng', 'English'], ['rus', 'Русский'], ['ukr', 'Українська'], ['eng+rus', 'English + Русский'], ['rus+eng', 'Русский + English'], ['ukr+eng', 'Українська + English'], ['eng+rus+ukr', 'EN + RU + UK']]; // i18n-ok: данные

  const pixelOk = (r) => r.glyphs.length >= 3 && r.unknown / r.glyphs.length <= 0.15;

  // Режим Minecraft: обычный шрифт (цифры) по сетке пикселей — быстрый и точный на скриншотах игры.
  function pixelRead(view) {
    if (!G.PixelFont) return null;
    const r = G.PixelFont.recognize(view);
    return pixelOk(r) ? r : null;
  }

  G.NodeTypes.img_ocr = {
    name: T('Изображение: OCR (текст)', 'Image: OCR (text)'), cat: CAT, wide: true, inputs: IN(),
    desc: T('Распознаёт текст на картинке локально, без интернета, при запуске через локальный сервер. Порядок «авто»: шрифт Minecraft (цифры по сетке пикселей) → RapidOCR (ONNX; ставится вместе с программой) как есть, затем с автоконтрастом → tesseract.js с перебором предобработок. Сырые ответы всех веток, рамки строк и убранные обрывки сохраняются; символы не исправляются (O не становится 0, Ґ не становится Г). Для больших скриншотов выдели область кнопкой «Область».',
      'Recognises text locally, with no internet, when running through the local server. The auto order: Minecraft font (digits from the pixel grid) → RapidOCR (ONNX; installed with the program) as is, then with auto contrast → tesseract.js trying several preprocessing variants. Raw answers of every branch, line boxes and removed fragments are kept; characters are not corrected (O does not become 0, Ґ does not become Г). For large screenshots select a region with the Region button.'),
    params: [
      { key: 'engine', label: T('Движок', 'Engine'), type: 'select', default: 'auto', options: [['auto', T('авто (Minecraft → RapidOCR → tesseract)', 'auto (Minecraft → RapidOCR → tesseract)')], ['rapidocr', 'RapidOCR'], ['tesseract', 'tesseract.js'], ['minecraft', T('шрифт Minecraft (цифры)', 'Minecraft font (digits)')]] },
      { key: 'lang', label: T('Язык', 'Language'), type: 'select', default: 'eng', options: LANGS },
      { key: 'digits', label: T('Только цифры', 'Digits only'), type: 'bool', default: false },
      { key: 'preset', label: T('Предобработка', 'Preprocessing'), type: 'select', default: 'auto', options: [['auto', T('авто (перебор)', 'auto (try several)')], ['plain', T('как есть + увеличение', 'as is + upscale')], ['contrast', T('автоконтраст', 'auto contrast')], ['denoise', T('автоконтраст + сглаживание', 'auto contrast + denoise')], ['dark', T('поднять тени (тёмные кадры)', 'lift shadows (dark frames)')], ['binary', T('чёрно-белое', 'black & white')], ['invert', T('инверсия', 'invert')]] },
      { key: 'lines', label: T('Строки на выходе', 'Lines in the output'), type: 'select', default: 'keep', options: [['keep', T('как на картинке', 'as in the picture')], ['join', T('склеить в одну (без пробелов)', 'join into one (no spaces)')], ['space', T('через пробел', 'separated by spaces')]] },
    ].concat(N.REGION_PARAMS),
    compute([v], p, node) {
      const inp = N.input(v, p);
      if (!inp) return undefined;
      node.state.inp = inp;
      const sig = [v, JSON.stringify(inp.region), p.engine, p.lang, p.digits, p.preset].join('|');
      node.state.sig = sig;
      // Перенесённую по ширине страницы строку (цифры в книге) удобно сразу склеить для следующих нод.
      const out = (t) => (p.lines === 'join' ? t.replace(/\s*\n\s*/g, '') : p.lines === 'space' ? t.replace(/\s*\n\s*/g, ' ') : t);
      const done = node.state.result;
      if (done && done.sig === sig) return out(done.text);
      if (p.engine === 'auto' || p.engine === 'minecraft') {
        const r = pixelRead(inp.view);
        if (r) { node.state.result = { sig, text: r.text, how: T('шрифт Minecraft', 'Minecraft font') + ' · ' + r.glyphs.length + ' ' + T('глифов', 'glyphs'), overlays: r.glyphs }; return out(r.text); }
        if (p.engine === 'minecraft') throw new Error(T('Шрифт Minecraft не распознан: выдели область с текстом (высота цифры 7 пикселей игры)', 'Minecraft font not recognised: select the text region (digits are 7 game pixels tall)'));
      }
      return undefined;
    },
    update(node, res, body, ui) {
      const u = setupBase(node, body, ui, (el, viewer, info) => {
        const run = h('button', 'btn small accent', T('Распознать', 'Recognise'));
        const bar = h('div', 'img-status small muted');
        const avail = G.Ocr.availability();
        if (!avail.ok) { bar.textContent = avail.reason; bar.classList.add('img-err'); }
        run.onclick = () => runTesseract(node, ui, u2());
        const u2 = () => node.state.ui;
        el.append(viewer.el, run, info, bar);
        return { run, bar };
      });
      if (res.error) { N.status(u.info, res.error, 'error'); }
      const inp = showInput(u, node, res, node.params);
      if (!inp) { if (!res.error) N.status(u.info, res.empty ? T('Подключи изображение', 'Connect an image') : T('Декодирую…', 'Decoding…')); return; }
      const r = node.state.result;
      if (r && r.sig === node.state.sig) {
        N.status(u.info, r.how);
        u.viewer.setOverlays((r.overlays || []).map((g) => ({ x: (inp.region ? inp.region.x : 0) + g.x, y: (inp.region ? inp.region.y : 0) + g.y, w: g.w, h: g.h, color: g.known ? '#5ee08c' : '#ff6b6b', label: g.ch })));
      } else if (!node.state.running && !res.error) {
        N.status(u.info, T('Нажми «Распознать». Для скриншотов Minecraft выбери движок «шрифт Minecraft».', 'Press Recognise. For Minecraft screenshots pick the Minecraft font engine.'));
        u.viewer.setOverlays([]);
      }
    },
  };

  async function runTesseract(node, ui, u) {
    if (node.state.running) return;
    const inp = node.state.inp;
    if (!inp) { ui.toast(T('Сначала подключи изображение', 'Connect an image first')); return; }
    const avail = G.Ocr.availability();
    if (!avail.ok) { ui.toast(avail.reason, 6000); return; }
    const p = node.params, sig = node.state.sig;
    node.state.running = true;
    u.run.disabled = true;
    N.status(u.info, T('Распознаю… первый запуск грузит движок и словарь (несколько секунд)', 'Recognising… the first run loads the engine and language data (a few seconds)'));
    try {
      const tesseract = p.engine === 'rapidocr' ? null : G.Ocr.browserEngine((m) => { if (m && m.status) u.bar.textContent = m.status + (m.progress !== undefined ? ' ' + Math.round(m.progress * 100) + '%' : ''); });
      const opts = { lang: p.lang, digits: !!p.digits, preset: p.preset };
      const r = p.engine === 'tesseract' ? Object.assign(await G.Ocr.recognize(inp.view, opts, tesseract), { variant: null, branches: [] })
        : await G.Ocr.recognizeAuto(inp.view, opts, { rapid: G.Ocr.rapidEngine(), tesseract });
      node.state.result = { sig, text: r.text, how: describeOcr(r, p), overlays: rapidOverlays(r), lines: r.lines, branches: r.branches, dropped: r.dropped || [] };
      u.bar.textContent = (r.warnings || []).join(' · ');
      ui.requestEval();
    } catch (e) {
      N.status(u.info, T('Ошибка OCR: ', 'OCR error: ') + ((e && e.message) || String(e)), 'error');
    } finally {
      node.state.running = false;
      u.run.disabled = false;
    }
  }

  // Строка состояния: какой движок и ветка дали ответ, что пробовали до неё.
  function describeOcr(r, p) {
    const head = r.engine === 'rapidocr'
      ? 'RapidOCR · ' + (r.variant === 'raw' ? T('как есть', 'as is') : T('автоконтраст', 'auto contrast')) + ' · ' + T('строк', 'lines') + ': ' + (r.lines || []).length
      : `tesseract · ${p.lang} · ${T('пресет', 'preset')}: ${r.preset} · ${T('уверенность', 'confidence')}: ${Math.round(r.confidence || 0)}%`;
    const before = (r.branches || []).filter((b) => !b.ok).map((b) => b.engine + (b.variant ? ' ' + b.variant : '') + ': ' + (b.note || (b.text ? T('не подошло', 'rejected') : T('пусто', 'empty'))));
    return head + (before.length ? ' · ' + T('до этого: ', 'tried before: ') + before.join('; ') : '');
  }

  // Рамки RapidOCR в координатах исходной картинки (ветка «как есть»); у предобработанных — масштаб другой.
  function rapidOverlays(r) {
    if (r.engine !== 'rapidocr' || r.variant !== 'raw') return [];
    return (r.lines || []).map((l) => ({ x: l.bbox.x0, y: l.bbox.y0, w: l.bbox.x1 - l.bbox.x0, h: l.bbox.y1 - l.bbox.y0, known: true, ch: '' }));
  }

  // ---------- QR / штрих-код ----------
  G.NodeTypes.img_qr = {
    name: T('Изображение: QR / штрих-код', 'Image: QR / barcode'), cat: CAT, wide: true, inputs: IN(),
    desc: T('Читает QR-коды (jsQR, локально); другие штрих-коды — если браузер поддерживает BarcodeDetector (кнопка «Другие коды»). Перебирает инверсию, автоуровни и масштаб; найденный код обводится на картинке. Для QR на большом кадре выдели область.',
      'Reads QR codes (jsQR, local); other barcodes only if the browser has BarcodeDetector (the Other codes button). Tries invert, auto-levels and scaling; the found code is outlined. For a QR in a large frame select a region.'),
    params: N.REGION_PARAMS.slice(),
    compute([v], p, node) {
      const inp = N.input(v, p);
      if (!inp) return undefined;
      node.state.inp = inp;
      const sig = v + '|' + JSON.stringify(inp.region);
      if (node.state.qrSig !== sig) { node.state.qrSig = sig; const one = G.Qr.decodeQr(inp.view); node.state.found = one ? [one] : []; }
      const found = node.state.found;
      if (!found.length) throw new Error(T('QR-код не найден (попробуй выделить область или обработать изображение выше по графу)', 'No QR code found (try selecting a region or preprocessing the image upstream)'));
      return found[0].text;
    },
    update(node, res, body, ui) {
      const u = setupBase(node, body, ui, (el, viewer, info) => {
        const more = h('button', 'btn tiny', T('Другие коды (BarcodeDetector)', 'Other codes (BarcodeDetector)'));
        more.onclick = async () => {
          if (!node.state.inp) return;
          const extra = await G.Qr.decodeBarcodes(node.state.inp.view);
          if (!extra.length) { ui.toast(T('Другие коды не найдены или BarcodeDetector недоступен', 'No other codes found or BarcodeDetector is unavailable')); return; }
          node.state.found = (node.state.found || []).concat(extra);
          ui.toast(extra.map((x) => x.format + ': ' + x.text).join('\n'), 8000);
          ui.requestEval();
        };
        el.append(viewer.el, info, more);
      });
      const inp = showInput(u, node, res, node.params);
      if (!inp) { N.status(u.info, res.error || (res.empty ? T('Подключи изображение', 'Connect an image') : T('Декодирую…', 'Decoding…')), res.error ? 'error' : undefined); return; }
      const found = node.state.found || [];
      const ox = inp.region ? inp.region.x : 0, oy = inp.region ? inp.region.y : 0;
      u.viewer.setOverlays(found.filter((f) => f.points && f.points.length).map((f) => {
        const xs = f.points.map((q) => q.x), ys = f.points.map((q) => q.y);
        const x0 = Math.min(...xs), y0 = Math.min(...ys);
        return { x: ox + x0, y: oy + y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0, color: '#ffd34d', label: f.format };
      }));
      if (res.error) N.status(u.info, res.error, 'error');
      else N.status(u.info, found.map((f) => `${f.format} (${f.variant})`).join(', '));
    },
  };

  // ---------- SGA ----------
  function sgaReport(r, ru) {
    const verified = new Set(r.glyphs.filter((g) => g.known && !g.verified).map((g) => g.ch));
    const parts = [T('глифов', 'glyphs') + ': ' + r.glyphs.length, T('не распознано', 'unknown') + ': ' + r.unknown, T('масштаб', 'scale') + ': ×' + r.scale.toFixed(2)];
    if (verified.size) parts.push(T('по непроверенным шаблонам', 'by unverified templates') + ': ' + Array.from(verified).join(' '));
    if (ru) parts.push(T('Если текст русский в латинской раскладке: ', 'If the text is Russian typed on a Latin layout: ') + ru.replace(/\n/g, ' / '));
    return parts.join(' · ');
  }

  G.NodeTypes.img_sga = {
    name: T('Изображение: SGA (стол зачарований)', 'Image: SGA (enchanting table)'), cat: CAT, wide: true, inputs: IN(),
    desc: T('Читает «галактический» шрифт Minecraft: бинаризация по цвету → строки → сетка пикселей шрифта → подбор шаблонов (составные знаки тоже). Выдаёт латинские буквы клавиш; знаки, не совпавшие с шаблоном, дают «?». Если автор набирал русский текст в латинской раскладке (gjl[jlbn = подходит), включи «Выход: кириллица». На картинке — рамки глифов: зелёные уверенные, жёлтые по непроверенным шаблонам, красные не распознаны.',
      'Reads the Minecraft "Standard Galactic" font: colour binarisation → lines → font pixel grid → template matching (multi-part glyphs too). Outputs the Latin letters of the keys; glyphs without a template give "?". If the author typed Russian on a Latin layout (gjl[jlbn = подходит), enable "Output: Cyrillic". Overlay: green confident glyphs, yellow from unverified templates, red unknown.'),
    params: [
      { key: 'threshold', label: T('Порог яркости, 0–255 (0 — авто)', 'Brightness threshold, 0–255 (0 = auto)'), type: 'range', min: 0, max: 255, step: 1, int: true, default: 0 },
      { key: 'scale', label: T('Пикселей на «пиксель шрифта» (0 — авто)', 'Image pixels per font pixel (0 = auto)'), type: 'range', min: 0, max: 64, step: 1, unit: 'px', default: 0 },
      { key: 'output', label: T('Выход', 'Output'), type: 'select', default: 'latin', options: [['latin', T('латиница (буквы клавиш)', 'Latin (key letters)')], ['ru', T('кириллица (раскладка ЙЦУКЕН)', 'Cyrillic (ЙЦУКЕН layout)')]] },
    ].concat(N.REGION_PARAMS),
    compute([v], p, node) {
      const inp = N.input(v, p);
      if (!inp) return undefined;
      node.state.inp = inp;
      const sig = [v, JSON.stringify(inp.region), p.threshold, p.scale].join('|');
      if (node.state.sgaSig !== sig) {
        node.state.sgaSig = sig;
        node.state.sga = G.Sga.recognize(inp.view, { threshold: Number(p.threshold) > 0 ? Number(p.threshold) : null, scale: Number(p.scale) > 0 ? Number(p.scale) : 0 });
      }
      const r = node.state.sga;
      if (!r.glyphs.length) throw new Error(T('SGA-знаки не найдены: проверь цвет и выдели область с текстом', 'No SGA glyphs found: check the colour and select the text region'));
      return p.output === 'ru' ? G.Sga.ruLayout(r.text) : r.text;
    },
    update(node, res, body, ui) {
      const u = setupBase(node, body, ui, (el, viewer, info) => {
        const list = h('pre', 'img-dump');
        el.append(viewer.el, info, list);
        return { list };
      });
      const inp = showInput(u, node, res, node.params);
      if (!inp) { N.status(u.info, res.error || (res.empty ? T('Подключи изображение', 'Connect an image') : T('Декодирую…', 'Decoding…')), res.error ? 'error' : undefined); return; }
      const r = node.state.sga;
      if (!r) { if (res.error) N.status(u.info, res.error, 'error'); return; }
      const ox = inp.region ? inp.region.x : 0, oy = inp.region ? inp.region.y : 0;
      u.viewer.setOverlays(r.glyphs.map((g) => ({ x: ox + g.x, y: oy + g.y, w: g.w, h: g.h, label: g.ch, color: !g.known ? '#ff6b6b' : g.verified && g.conf > 0.85 ? '#5ee08c' : '#f5b84a' })));
      N.status(u.info, res.error || sgaReport(r, r.glyphs.length ? G.Sga.ruLayout(r.text) : ''), res.error ? 'error' : undefined);
      u.list.textContent = r.glyphs.filter((g) => !g.known || g.conf < 0.9 || !g.verified).slice(0, 12).map((g) => `${g.ch}  x=${ox + g.x} y=${oy + g.y}  ${g.known ? Math.round(g.conf * 100) + '%' + (g.verified ? '' : ' (' + T('шаблон не проверен', 'unverified template') + ')') : T('нет шаблона', 'no template')}`).join('\n');
    },
  };
})(typeof self !== 'undefined' ? self : this);
