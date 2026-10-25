// OCR изображений: предобработка (чистая, тестируется в Node) + запуск локального tesseract.js.
// Движок инъектируется: engine.recognize(img, { lang, whitelist, psm }) → { text, confidence, lines: [{ text, confidence, bbox }] }.
// Браузерный движок (browserEngine) грузит tesseract.js из web/vendor/tesseract/ — без CDN, но только по http(s):
// из file:// браузер не даёт запустить Web Worker и прочитать wasm/traineddata.
(function (G) {
  'use strict';

  const T = G.T || ((ru) => ru);
  const P = () => G.ImgProc;

  const PRESETS = ['auto', 'plain', 'contrast', 'denoise', 'dark', 'dark70', 'binary', 'invert'];
  const MAX_SIDE = 4200;

  // Перцентиль яркости (0..1) по подмножеству пикселей, не ярче limit.
  function lumaPercentile(img, frac, limit) {
    const h = P().histogram(img).luma;
    let total = 0;
    for (let i = 0; i <= limit; i++) total += h[i];
    let acc = 0;
    for (let i = 0; i <= limit; i++) { acc += h[i]; if (acc >= total * frac) return i; }
    return limit;
  }

  /** «Детали в тенях»: чёрная/белая точки по самым тёмным quantile (25% или 70%) пикселей; всё яркое уходит в белый. */
  function darkDetail(img, quantile) {
    const h = P().histogram(img).luma;
    const total = img.width * img.height;
    let acc = 0, cap = 255, p99 = 255, got99 = false;
    for (let i = 0; i < 256; i++) {
      acc += h[i];
      if (cap === 255 && acc >= total * (quantile || 0.25)) cap = i;
      if (!got99 && acc >= total * 0.99) { p99 = i; got99 = true; }
    }
    // Вырезка тёмного кадра целиком (вся картинка тёмная): растягиваем весь её диапазон.
    if (p99 <= 64) cap = 255;
    const limit = p99 <= 64 ? p99 + 2 : cap;
    const black = Math.max(0, lumaPercentile(img, 0.005, limit) - 1);
    const white = Math.max(black + 2, lumaPercentile(img, 0.999, limit) + 1);
    return P().levels(img, black, white, 1);
  }

  /** Масштаб «ближайшим соседом»: factor = 0 → авто (мелкие картинки увеличиваются в 2–4 раза). */
  function upscale(img, factor) {
    const side = Math.max(img.width, img.height);
    let k = Number(factor) > 0 ? Number(factor) : side < 500 ? 4 : side < 900 ? 3 : side < 1500 ? 2 : 1;
    k = Math.min(k, MAX_SIDE / side);
    return k > 1.01 ? P().scaleNearest(img, k) : img;
  }

  // Делает текст тёмным на светлом: если фон тёмный (среднее < 128), инвертируем.
  function darkOnLight(img) {
    const h = P().histogram(img).luma;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * h[i];
    return sum / (img.width * img.height) < 128 ? P().invert(img) : img;
  }

  /** Предобработка по пресету: plain | contrast | denoise | dark | binary | invert. Возвращает новое изображение. */
  function preprocess(img, preset, scale) {
    const p = P();
    const gray = p.grayscale(img);
    let out;
    switch (preset) {
      case 'contrast': out = darkOnLight(p.autoLevels(gray, 0.5, false)); break;
      case 'denoise': out = darkOnLight(p.boxBlur(p.autoLevels(gray, 0.5, false), 1)); break;
      case 'dark70': out = p.invert(p.boxBlur(darkDetail(gray, 0.7), 1)); break;
      case 'dark': out = p.invert(p.boxBlur(darkDetail(gray), 1)); break; // blur гасит JPEG-шум после сильного растяжения
      case 'binary': out = darkOnLight(p.threshold(p.autoLevels(gray, 0.5, false), null)); break;
      case 'invert': out = p.invert(gray); break;
      default: out = darkOnLight(gray);
    }
    return upscale(out, scale);
  }

  const digitsOnly = (s) => (s.match(/\d/g) || []).length;
  const compactKey = (s) => String(s).replace(/\s+/g, '');
  // Родственные предобработки ошибаются одинаково: их согласие — одно подтверждение, а не два.
  const FAMILY = { dark: 'dark', dark70: 'dark', contrast: 'levels', denoise: 'levels', binary: 'levels', plain: 'plain', invert: 'plain' };
  const FRAGMENT_SHARE = 0.4;     // строка с долей цифр меньше этой от самой длинной — подозрение на обрывок шума
  const REFINE_KEEP = 0.8;        // уточнённая строка заменяет исходную, только если не потеряла символы

  // Оценка кандидата: больше распознанных символов и выше уверенность — лучше. Пробелы не штрафуются:
  // у верного кода бывают видимые промежутки, а надёжность цифр от них не зависит.
  function score(res, opts) {
    const chars = opts.digits ? digitsOnly(res.text) : res.text.replace(/\s/g, '').length;
    return chars * Math.max(1, res.confidence || 0);
  }

  function boxOf(line) { return line.bbox && line.bbox.x1 > line.bbox.x0 ? line.bbox : null; }
  const charsOf = (t, opts) => (opts.digits ? digitsOnly(t) : compactKey(t).length);

  // Второй проход: каждая найденная строка вырезается с полями, увеличивается и читается как одна строка (PSM 7).
  // Уточняется каждая строка отдельно, любой длины (42, 007 — тоже строки); если уточнение потеряло символы
  // или ничего не дало, остаётся исходная строка. Ни одна строка первого прохода не пропадает.
  async function refineLines(res, pre, engine, base, opts) {
    const source = (res.lines || []).filter((l) => l.text && l.text.trim());
    const lines = source.length ? source : String(res.text || '').split('\n').filter((t) => t.trim()).map((t) => ({ text: t, confidence: res.confidence }));
    const out = [];
    for (const l of lines) {
      const raw = l.text.trim();
      const b = boxOf(l);
      let refined = null;
      if (b) {
        const padY = Math.round((b.y1 - b.y0) * 0.6 + 4), padX = Math.round((b.y1 - b.y0) * 0.6 + 4);
        const crop = P().crop(pre, b.x0 - padX, b.y0 - padY, b.x1 - b.x0 + 2 * padX, b.y1 - b.y0 + 2 * padY);
        const k = Math.max(1, Math.min(4, Math.round(80 / Math.max(1, b.y1 - b.y0))));
        const one = await engine.recognize(k > 1 ? P().scaleNearest(crop, k) : crop, Object.assign({}, base, { psm: 7 }));
        refined = { text: String(one.text || '').trim().replace(/\n+/g, ' '), confidence: one.confidence };
      }
      const keepRefined = refined && refined.text && charsOf(refined.text, opts) >= Math.max(1, charsOf(raw, opts) * REFINE_KEEP)
        && (!opts.digits || digitsOnly(refined.text) >= digitsOnly(raw));
      out.push({
        text: keepRefined ? refined.text : raw, confidence: keepRefined ? refined.confidence : l.confidence, bbox: b,
        raw, source: keepRefined ? 'refined' : 'raw', alternatives: refined && refined.text !== raw ? [refined.text] : [],
      });
    }
    return out;
  }

  /** Голосование: группа одинаковых текстов побеждает лучший по оценке, только если её подтверждают разные семейства
   *  предобработок, уверенность не нулевая на фоне содержательного результата и символов не меньше. */
  function choose(cands, opts) {
    let best = null;
    for (const c of cands) if (!best || c.score > best.score) best = c;
    const groups = new Map();
    for (const c of cands) {
      const k = compactKey(c.text);
      if (!k) continue;
      const g = groups.get(k) || { families: new Set(), conf: 0, items: [] };
      g.families.add(FAMILY[c.preset] || c.preset);
      g.conf = Math.max(g.conf, c.confidence || 0);
      g.items.push(c);
      groups.set(k, g);
    }
    let agreed = 0;
    for (const [k, g] of groups) {
      if (g.families.size < 2 || g.families.size <= agreed) continue;
      const enough = charsOf(k, opts) >= REFINE_KEEP * charsOf(best.text, opts);
      const believable = g.conf > 0 || !(best.confidence > 0);
      if (enough && believable) { best = g.items.slice().sort((a, b) => b.score - a.score)[0]; agreed = g.families.size; }
    }
    return { best, agreed };
  }

  const overlaps = (a, b) => Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0);

  /** В режиме «только цифры» короткая строка рядом с длинной — либо настоящая (42, 0001), либо обрывок шума.
   *  Настоящую видят разные семейства предобработок; обрывок, который нашла одна ветка, уходит в dropped. */
  function filterFragments(best, cands) {
    const max = Math.max(0, ...best.lines.map((l) => digitsOnly(l.text)));
    const kept = [], dropped = [];
    for (const l of best.lines) {
      if (digitsOnly(l.text) >= max * FRAGMENT_SHARE) { kept.push(l); continue; }
      const key = compactKey(l.text);
      // Подтверждение — та же строка в том же месте (рамки в одном масштабе: увеличение зависит только от размера).
      const same = (x) => (compactKey(x.text) === key || compactKey(x.raw || '') === key) && (!l.bbox || !x.bbox || overlaps(l.bbox, x.bbox));
      const families = new Set(cands.filter((c) => c.lines.some(same)).map((c) => FAMILY[c.preset] || c.preset));
      (families.size >= 2 ? kept : dropped).push(Object.assign({}, l, { support: families.size }));
    }
    return { kept, dropped };
  }

  /**
   * Распознаёт текст. opts: { lang: 'eng+rus', digits: bool, preset, scale, psm, keepFragments }.
   * Для preset 'auto' перебираются несколько предобработок и выбирается лучший результат;
   * каждый кандидат уточняется вторым проходом по строкам. Возвращает { text, confidence, preset, tried, lines
   * (текст, сырой текст, рамка, альтернативы), candidates, dropped, warnings }.
   */
  async function recognize(img, opts, engine) {
    const o = Object.assign({ lang: 'eng', digits: false, preset: 'auto', scale: 0, psm: 6 }, opts || {});
    if (!engine) throw new Error(T('Нет движка OCR', 'No OCR engine'));
    P().check(img);
    const base = { lang: o.lang, whitelist: o.digits ? '0123456789' : '', psm: o.psm };
    const presets = o.preset === 'auto' ? ['dark', 'dark70', 'denoise', 'contrast', 'plain'] : [o.preset];
    const tried = [];
    const cands = [];
    for (const preset of presets) {
      if (o.cancel && o.cancel.stop) break;
      const pre = preprocess(img, preset, o.scale);
      const res = await engine.recognize(pre, base);
      const lines = o.preset === 'auto' || o.psm === 6 ? await refineLines(res, pre, engine, base, o)
        : String(res.text || '').split('\n').filter((t) => t.trim()).map((t) => ({ text: t.trim(), raw: t.trim(), confidence: res.confidence, bbox: null, source: 'raw', alternatives: [] }));
      const cand = { text: lines.map((l) => l.text).join('\n'), raw: String(res.text || '').trim(), confidence: res.confidence, preset, lines };
      cand.score = score(cand, o);
      tried.push({ preset, chars: cand.text.length, lines: lines.length, confidence: Math.round(cand.confidence || 0), text: cand.text.slice(0, 80) });
      cands.push(cand);
    }
    if (!cands.length) throw new Error(T('OCR остановлен', 'OCR stopped'));
    const { best, agreed } = choose(cands, o);
    const warnings = [];
    let lines = best.lines, dropped = [];
    if (o.digits && !o.keepFragments) {
      const f = filterFragments(best, cands);
      lines = f.kept;
      dropped = f.dropped;
      if (dropped.length) warnings.push(T('убраны короткие строки, которые нашла только одна предобработка: ', 'removed short lines seen by a single preprocessing only: ') + dropped.map((l) => l.text).join(', '));
    }
    const most = Math.max(...cands.map((c) => c.lines.length));
    if (most > lines.length) warnings.push(T('другая предобработка нашла больше строк: ', 'another preprocessing found more lines: ') + most + T(' против ', ' vs ') + lines.length);
    return {
      text: lines.map((l) => l.text).join('\n'), confidence: best.confidence, preset: best.preset, tried, agreed,
      lines, raw: best.raw, dropped, warnings, engine: 'tesseract',
      candidates: cands.map((c) => ({ preset: c.preset, text: c.text, raw: c.raw, confidence: c.confidence })),
    };
  }

  // ---------- RapidOCR (локальный сервер, ONNX) и общий порядок движков ----------
  const rapidLang = (lang) => (/rus|ukr/.test(String(lang)) ? 'cyrillic' : 'en');

  /** Движок RapidOCR через локальный сервер: { status(), recognize(img, { lang }) → { status, text, lines, ms, engine } }. */
  function rapidEngine() {
    let ready = null;
    return {
      async status() {
        if (!G.API || !G.API.online) return { ready: false, note: T('нет локального сервера', 'no local server') };
        if (!ready) ready = G.API.get('/api/ocr/status').catch((e) => ({ ready: false, note: e.message }));
        return ready;
      },
      async recognize(img, o) {
        const png = 'data:image/png;base64,' + bytesToBase64(G.PngEnc.encode(img));
        return G.API.post('/api/ocr', { image: png, lang: rapidLang(o.lang) });
      },
    };
  }

  function bytesToBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
  }

  // Ответ ветки годится: не пуст; для «только цифры» — только цифры и пробелы (ничего не вычищаем, просто не принимаем).
  const acceptable = (text, o) => !!text && !!text.trim() && (!o.digits || /^[\d\s]+$/.test(text));

  /**
   * Порядок движков «авто»: RapidOCR как есть → RapidOCR с автоконтрастом → tesseract с перебором предобработок.
   * Шрифт Minecraft проверяется раньше, в ноде. Каждая ветка сохраняется в branches с сырым ответом;
   * первая подходящая даёт результат. engines: { rapid, tesseract }; opts: { lang, digits, preset, cancel, budgetMs }.
   */
  async function recognizeAuto(img, opts, engines) {
    const o = Object.assign({ lang: 'eng', digits: false, preset: 'auto' }, opts || {});
    const deadline = Date.now() + (o.budgetMs || 120000);
    const branches = [];
    const rapid = engines.rapid;
    const st = rapid ? await rapid.status() : { ready: false, note: T('RapidOCR не подключён', 'RapidOCR is not connected') };
    if (st.ready) {
      for (const variant of ['raw', 'contrast']) {
        if ((o.cancel && o.cancel.stop) || Date.now() > deadline) break;
        const input = variant === 'raw' ? img : preprocess(img, 'contrast', 0);
        let r;
        try { r = await rapid.recognize(input, o); } catch (e) { r = { status: 'error', note: e.message }; }
        const ok = r.status === 'ok' && acceptable(r.text, o);
        branches.push({ engine: 'rapidocr', variant, ok, text: r.text || '', note: r.note || '', ms: r.ms });
        if (ok) return { text: r.text, lines: r.lines, engine: 'rapidocr', variant, detail: r.engine, branches, warnings: [] };
      }
    } else branches.push({ engine: 'rapidocr', ok: false, note: G.I18n && G.I18n.server ? G.I18n.server(st.note || '') : st.note || '' });
    if (!engines.tesseract) throw new Error(T('Ни один движок OCR не дал результата', 'No OCR engine produced a result'));
    if (o.cancel && o.cancel.stop) throw new Error(T('OCR остановлен', 'OCR stopped'));
    const t = await recognize(img, o, engines.tesseract);
    branches.push({ engine: 'tesseract', variant: t.preset, ok: acceptable(t.text, o), text: t.text });
    return Object.assign(t, { engine: 'tesseract', variant: t.preset, branches });
  }

  // ---------- браузерный движок (tesseract.js из web/vendor) ----------
  const workers = new Map();

  // Папка vendor/tesseract/ определяется по тегу <script> самой библиотеки (не зависит от адреса страницы).
  function vendorUrl(name) {
    const tag = Array.prototype.find.call(G.document.scripts || [], (x) => /vendor\/tesseract\/tesseract\.min\.js/.test(x.src));
    const base = tag ? tag.src.replace(/tesseract\.min\.js.*$/, '') : new URL('vendor/tesseract/', G.document.baseURI).href;
    return base + name;
  }

  /** Работает ли OCR в этом окружении; иначе — понятная причина. */
  function availability() {
    if (!G.document) return { ok: false, reason: T('Нет браузера', 'No browser') };
    if (G.location && G.location.protocol === 'file:') {
      return { ok: false, reason: T('OCR не работает из file://: браузер блокирует Web Worker и чтение wasm. Запусти программу через Запуск.bat (локальный сервер).', 'OCR does not work from file://: the browser blocks Web Workers and wasm loading. Start the app through the launcher (local server).') };
    }
    if (!G.Tesseract) return { ok: false, reason: T('tesseract.js не загружен (web/vendor/tesseract/tesseract.min.js)', 'tesseract.js is not loaded (web/vendor/tesseract/tesseract.min.js)') };
    return { ok: true };
  }

  async function getWorker(lang, logger) {
    const a = availability();
    if (!a.ok) throw new Error(a.reason);
    if (!workers.has(lang)) {
      workers.set(lang, G.Tesseract.createWorker(lang, 1, {
        workerPath: vendorUrl('worker.min.js'),
        corePath: vendorUrl('core'),
        langPath: vendorUrl('lang'),
        gzip: false, cacheMethod: 'none', logger: (m) => { if (logger) logger(m); },
      }).catch((e) => { workers.delete(lang); throw e; }));
    }
    return workers.get(lang);
  }

  function toBlob(img) {
    const canvas = G.document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob'))), 'image/png'));
  }

  function browserEngine(logger) {
    let queue = Promise.resolve();
    return {
      recognize(img, o) {
        const job = queue.then(async () => {
          const worker = await getWorker(o.lang || 'eng', logger);
          await worker.setParameters({ tessedit_char_whitelist: o.whitelist || '', tessedit_pageseg_mode: String(o.psm || 6), preserve_interword_spaces: '1' });
          const r = await worker.recognize(await toBlob(img), {}, { blocks: true });
          const d = r.data;
          const lines = d.lines || ((d.blocks || []).flatMap((b) => (b.paragraphs || []).flatMap((p) => p.lines || [])));
          return { text: d.text || '', confidence: d.confidence || 0, lines: lines.map((l) => ({ text: l.text || '', confidence: l.confidence || 0, bbox: l.bbox })) };
        });
        queue = job.catch(() => {});
        return job;
      },
    };
  }

  G.Ocr = { PRESETS, preprocess, recognize, recognizeAuto, rapidEngine, rapidLang, browserEngine, availability, darkDetail, upscale, choose };
})(typeof self !== 'undefined' ? self : this);
