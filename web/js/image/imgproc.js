// Чистая обработка изображений над {width, height, data: Uint8ClampedArray} (RGBA, 4 байта на пиксель).
// Без DOM: работает и в браузере, и в Node (тесты). Исходное изображение никогда не меняется —
// каждая операция возвращает новый объект. Рецепт (список шагов) даёт воспроизводимый ключ кэша.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);

  const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  function create(width, height, fill) {
    const data = new Uint8ClampedArray(width * height * 4);
    if (fill) for (let i = 0; i < data.length; i += 4) { data[i] = fill[0]; data[i + 1] = fill[1]; data[i + 2] = fill[2]; data[i + 3] = fill.length > 3 ? fill[3] : 255; }
    return { width, height, data };
  }

  const clone = (img) => ({ width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) });

  function check(img) {
    if (!img || !(img.width > 0) || !(img.height > 0) || !img.data || img.data.length !== img.width * img.height * 4) {
      throw new Error(T('Некорректное изображение (ожидается RGBA)', 'Invalid image (RGBA expected)'));
    }
    return img;
  }

  // Применяет таблицу значений 0..255 к цветовым каналам (альфа не трогается).
  function applyLut(img, lutR, lutG, lutB) {
    check(img);
    const out = clone(img);
    const d = out.data;
    const g = lutG || lutR, b = lutB || lutR;
    for (let i = 0; i < d.length; i += 4) { d[i] = lutR[d[i]]; d[i + 1] = g[d[i + 1]]; d[i + 2] = b[d[i + 2]]; }
    return out;
  }

  function lutFrom(fn) {
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) lut[i] = Math.round(clamp255(fn(i)));
    return lut;
  }

  // ---------- тон и цвет ----------
  /** Яркость: amount от -255 до 255 прибавляется к каждому каналу. */
  const brightness = (img, amount) => applyLut(img, lutFrom((v) => v + Number(amount || 0)));

  /** Контраст: amount от -100 до 100 (процентов), классическая формула с точкой 128. */
  function contrast(img, amount) {
    const c = Math.max(-100, Math.min(100, Number(amount || 0))) * 2.55;
    const f = (259 * (c + 255)) / (255 * (259 - c));
    return applyLut(img, lutFrom((v) => f * (v - 128) + 128));
  }

  /** Гамма: g > 1 осветляет полутона, g < 1 затемняет. */
  function gamma(img, g) {
    const k = Number(g);
    if (!(k > 0)) throw new Error(T('Гамма должна быть больше нуля', 'Gamma must be greater than zero'));
    return applyLut(img, lutFrom((v) => 255 * Math.pow(v / 255, 1 / k)));
  }

  /** Уровни: чёрная и белая точка (0..255), необязательная гамма. */
  function levels(img, black, white, g) {
    const b = Number(black), w = Number(white);
    if (!(w > b)) throw new Error(T('Белая точка должна быть больше чёрной', 'The white point must be above the black point'));
    const k = g === undefined ? 1 : Number(g);
    return applyLut(img, lutFrom((v) => 255 * Math.pow(clamp255((v - b) / (w - b) * 255) / 255, 1 / k)));
  }

  /** Подъём теней («высветлить»): логарифмическая кривая, strength 0..100 (0 — без изменений). */
  function shadowLift(img, strength) {
    const s = Math.max(0, Number(strength || 0));
    if (s === 0) return clone(check(img));
    const k = Math.pow(10, s / 25); // 100 → ×10 000: тени почти чёрного поднимаются до видимого
    const denom = Math.log(1 + k);
    return applyLut(img, lutFrom((v) => 255 * Math.log(1 + (k * v) / 255) / denom));
  }

  /** Гистограммы каналов и яркости: { r, g, b, a, luma } — массивы по 256. */
  function histogram(img) {
    check(img);
    const h = { r: new Uint32Array(256), g: new Uint32Array(256), b: new Uint32Array(256), a: new Uint32Array(256), luma: new Uint32Array(256) };
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      h.r[d[i]]++; h.g[d[i + 1]]++; h.b[d[i + 2]]++; h.a[d[i + 3]]++;
      h.luma[Math.round(luma(d[i], d[i + 1], d[i + 2]))]++;
    }
    return h;
  }

  function percentile(hist, total, frac) {
    let acc = 0;
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > total * frac) return i; }
    return 255;
  }

  /** Автоуровни: растягивает диапазон, отрезая clipPercent процентов с каждого края. */
  function autoLevels(img, clipPercent, perChannel) {
    const h = histogram(img);
    const total = img.width * img.height;
    const frac = Math.max(0, Number(clipPercent === undefined ? 0.5 : clipPercent)) / 100;
    const range = (hist) => {
      let lo = percentile(hist, total, frac), hi = 255 - percentile(hist.slice().reverse(), total, frac);
      if (hi <= lo) { lo = 0; hi = 255; }
      return [lo, hi];
    };
    const stretch = ([lo, hi]) => lutFrom((v) => ((v - lo) / (hi - lo)) * 255);
    if (perChannel) return applyLut(img, stretch(range(h.r)), stretch(range(h.g)), stretch(range(h.b)));
    return applyLut(img, stretch(range(h.luma)));
  }

  /** Выравнивание гистограммы по яркости; цвет сохраняется через масштаб каналов. */
  function equalize(img) {
    const h = histogram(img);
    const total = img.width * img.height;
    const cdf = new Float64Array(256);
    let acc = 0, first = -1;
    for (let i = 0; i < 256; i++) { acc += h.luma[i]; cdf[i] = acc; if (first < 0 && h.luma[i]) first = i; }
    const lo = cdf[first];
    const map = lutFrom((v) => (total === lo ? v : ((cdf[v] - lo) / (total - lo)) * 255));
    const out = clone(img);
    const d = out.data;
    for (let i = 0; i < d.length; i += 4) {
      const y = Math.round(luma(d[i], d[i + 1], d[i + 2]));
      if (y === 0) { d[i] = d[i + 1] = d[i + 2] = map[0]; continue; }
      const k = map[y] / y;
      d[i] = clamp255(d[i] * k); d[i + 1] = clamp255(d[i + 1] * k); d[i + 2] = clamp255(d[i + 2] * k);
    }
    return out;
  }

  const invert = (img) => applyLut(img, lutFrom((v) => 255 - v));

  /** Оттенки серого: 'luma' (взвешенно), 'avg', 'max', 'min'. */
  function grayscale(img, mode) {
    check(img);
    const out = clone(img);
    const d = out.data;
    const m = mode || 'luma';
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const y = m === 'avg' ? (r + g + b) / 3 : m === 'max' ? Math.max(r, g, b) : m === 'min' ? Math.min(r, g, b) : luma(r, g, b);
      d[i] = d[i + 1] = d[i + 2] = Math.round(y);
    }
    return out;
  }

  /** Порог Отсу по яркости: возвращает число 0..255. */
  function otsu(img) {
    const h = histogram(img).luma;
    const total = img.width * img.height;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * h[i];
    let wB = 0, sumB = 0, best = 0, bestVar = -1;
    for (let t = 0; t < 256; t++) {
      wB += h[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * h[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > bestVar) { bestVar = between; best = t; }
    }
    return best;
  }

  /** Бинаризация: пиксели с яркостью > t становятся белыми. t = null → порог Отсу. */
  function threshold(img, t) {
    check(img);
    const level = t === null || t === undefined ? otsu(img) : Number(t);
    const out = clone(img);
    const d = out.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = luma(d[i], d[i + 1], d[i + 2]) > level ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    return out;
  }

  // ---------- каналы и биты ----------
  const CH_INDEX = { r: 0, g: 1, b: 2, a: 3 };

  /** Показать один канал серым: 'r' | 'g' | 'b' | 'a' | 'luma'. */
  function channel(img, name) {
    check(img);
    const out = clone(img);
    const d = out.data;
    const idx = CH_INDEX[name];
    if (idx === undefined && name !== 'luma') throw new Error(T('Неизвестный канал: ', 'Unknown channel: ') + name);
    for (let i = 0; i < d.length; i += 4) {
      const v = idx === undefined ? Math.round(luma(d[i], d[i + 1], d[i + 2])) : d[i + idx];
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    return out;
  }

  /** Битовая плоскость: бит bit (0 — младший) канала name, чёрно-белая картинка. */
  function bitPlane(img, name, bit) {
    check(img);
    const idx = CH_INDEX[name];
    const b = Math.floor(Number(bit));
    if (idx === undefined) throw new Error(T('Неизвестный канал: ', 'Unknown channel: ') + name);
    if (!(b >= 0 && b <= 7)) throw new Error(T('Номер бита от 0 до 7', 'The bit number must be from 0 to 7'));
    const out = clone(img);
    const d = out.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (d[i + idx] >> b) & 1 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    return out;
  }

  /**
   * LSB-извлечение. Параметры: channels — строка из букв r g b a (порядок обхода), bits — сколько
   * младших бит каждого канала брать (1..8), bitOrder 'msb' | 'lsb' (в каком порядке собирать биты
   * в байт), scan 'row' | 'col' (построчно или по столбцам), skip — сколько битов пропустить в начале,
   * invert — инвертировать биты. Возвращает Uint8Array (неполный последний байт отбрасывается).
   */
  function lsbExtract(img, opts) {
    check(img);
    const o = Object.assign({ channels: 'rgb', bits: 1, bitOrder: 'msb', scan: 'row', skip: 0, invert: false }, opts || {});
    const chans = String(o.channels).toLowerCase().split('').filter((c) => CH_INDEX[c] !== undefined).map((c) => CH_INDEX[c]);
    if (!chans.length) throw new Error(T('Выбери хотя бы один канал (r, g, b, a)', 'Pick at least one channel (r, g, b, a)'));
    const nbits = Math.max(1, Math.min(8, Math.floor(Number(o.bits) || 1)));
    const w = img.width, h = img.height, d = img.data;
    const totalBits = w * h * chans.length * nbits;
    const skip = Math.max(0, Math.floor(Number(o.skip) || 0));
    const out = new Uint8Array(Math.max(0, Math.floor((totalBits - skip) / 8)));
    let bitPos = 0;
    const push = (bit) => {
      if (bitPos++ < skip) return;
      const n = bitPos - 1 - skip;
      const byteIdx = n >> 3;
      if (byteIdx >= out.length) return;
      const within = n & 7;
      const v = o.invert ? bit ^ 1 : bit;
      if (v) out[byteIdx] |= o.bitOrder === 'lsb' ? 1 << within : 0x80 >> within;
    };
    const visit = (x, y) => {
      const p = (y * w + x) * 4;
      for (const c of chans) {
        const v = d[p + c];
        // Несколько бит канала берём от старшего из выбранных к младшему (как в stegsolve).
        for (let k = nbits - 1; k >= 0; k--) push((v >> k) & 1);
      }
    };
    if (o.scan === 'col') { for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) visit(x, y); }
    else { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) visit(x, y); }
    return out;
  }

  /** Байты → строка latin1 (по символу на байт), удобно передавать по графу. */
  function bytesToLatin1(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return s;
  }

  // ---------- геометрия ----------
  function rotate(img, degrees) {
    check(img);
    const deg = ((Math.round(Number(degrees) / 90) * 90) % 360 + 360) % 360;
    if (deg === 0) return clone(img);
    const { width: w, height: h, data: s } = img;
    const swap = deg !== 180;
    const out = create(swap ? h : w, swap ? w : h);
    const d = out.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let nx, ny;
        if (deg === 90) { nx = h - 1 - y; ny = x; } else if (deg === 180) { nx = w - 1 - x; ny = h - 1 - y; } else { nx = y; ny = w - 1 - x; }
        const si = (y * w + x) * 4, di = (ny * out.width + nx) * 4;
        d[di] = s[si]; d[di + 1] = s[si + 1]; d[di + 2] = s[si + 2]; d[di + 3] = s[si + 3];
      }
    }
    return out;
  }

  function flip(img, horizontal) {
    check(img);
    const { width: w, height: h, data: s } = img;
    const out = create(w, h);
    const d = out.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = (y * w + x) * 4;
        const di = (horizontal ? y * w + (w - 1 - x) : (h - 1 - y) * w + x) * 4;
        d[di] = s[si]; d[di + 1] = s[si + 1]; d[di + 2] = s[si + 2]; d[di + 3] = s[si + 3];
      }
    }
    return out;
  }

  /** Обрезка по прямоугольнику (границы подгоняются под размеры картинки). */
  function crop(img, x, y, width, height) {
    check(img);
    const x0 = Math.max(0, Math.min(img.width - 1, Math.floor(Number(x) || 0)));
    const y0 = Math.max(0, Math.min(img.height - 1, Math.floor(Number(y) || 0)));
    const w = Math.max(1, Math.min(img.width - x0, Math.floor(Number(width) || img.width)));
    const h = Math.max(1, Math.min(img.height - y0, Math.floor(Number(height) || img.height)));
    const out = create(w, h);
    for (let row = 0; row < h; row++) {
      const from = ((y0 + row) * img.width + x0) * 4;
      out.data.set(img.data.subarray(from, from + w * 4), row * w * 4);
    }
    return out;
  }

  /** Масштабирование без сглаживания (пиксели остаются квадратами). factor > 0, можно дробный. */
  function scaleNearest(img, factor) {
    check(img);
    const k = Number(factor);
    if (!(k > 0)) throw new Error(T('Масштаб должен быть больше нуля', 'The scale must be greater than zero'));
    const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
    if (w * h > 64e6) throw new Error(T('Слишком большой результат масштабирования', 'The scaled result is too large'));
    const out = create(w, h);
    const s = img.data, d = out.data;
    for (let y = 0; y < h; y++) {
      const sy = Math.min(img.height - 1, Math.floor(y / k));
      for (let x = 0; x < w; x++) {
        const sx = Math.min(img.width - 1, Math.floor(x / k));
        const si = (sy * img.width + sx) * 4, di = (y * w + x) * 4;
        d[di] = s[si]; d[di + 1] = s[si + 1]; d[di + 2] = s[si + 2]; d[di + 3] = s[si + 3];
      }
    }
    return out;
  }


  /** Масштабирование с билинейной интерполяцией (для OCR мелкого текста). */
  function scaleSmooth(img, factor) {
    check(img);
    const k = Number(factor);
    if (!(k > 0)) throw new Error(T('Масштаб должен быть больше нуля', 'The scale must be greater than zero'));
    const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
    if (w * h > 64e6) throw new Error(T('Слишком большой результат масштабирования', 'The scaled result is too large'));
    const out = create(w, h);
    const s = img.data, d = out.data, W = img.width, H = img.height;
    for (let y = 0; y < h; y++) {
      const fy = Math.max(0, Math.min(H - 1, (y + 0.5) / k - 0.5));
      const y0 = Math.floor(fy), y1 = Math.min(H - 1, y0 + 1), ty = fy - y0;
      for (let x = 0; x < w; x++) {
        const fx = Math.max(0, Math.min(W - 1, (x + 0.5) / k - 0.5));
        const x0 = Math.floor(fx), x1 = Math.min(W - 1, x0 + 1), tx = fx - x0;
        const di = (y * w + x) * 4;
        for (let c = 0; c < 4; c++) {
          const a = s[(y0 * W + x0) * 4 + c] * (1 - tx) + s[(y0 * W + x1) * 4 + c] * tx;
          const b = s[(y1 * W + x0) * 4 + c] * (1 - tx) + s[(y1 * W + x1) * 4 + c] * tx;
          d[di + c] = a * (1 - ty) + b * ty;
        }
      }
    }
    return out;
  }

  /** Простое сглаживание (блочное усреднение радиуса r) для подавления JPEG-шума. */
  function boxBlur(img, r) {
    check(img);
    const rad = Math.max(0, Math.floor(Number(r) || 0));
    if (!rad) return clone(img);
    const { width: W, height: H, data: s } = img;
    const out = create(W, H);
    const d = out.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum0 = 0, sum1 = 0, sum2 = 0, n = 0;
        for (let yy = Math.max(0, y - rad); yy <= Math.min(H - 1, y + rad); yy++) {
          for (let xx = Math.max(0, x - rad); xx <= Math.min(W - 1, x + rad); xx++) {
            const i = (yy * W + xx) * 4;
            sum0 += s[i]; sum1 += s[i + 1]; sum2 += s[i + 2]; n++;
          }
        }
        const di = (y * W + x) * 4;
        d[di] = sum0 / n; d[di + 1] = sum1 / n; d[di + 2] = sum2 / n; d[di + 3] = s[di + 3];
      }
    }
    return out;
  }

  /** Пиксель (x, y) как [r, g, b, a] или null вне границ. */
  function sample(img, x, y) {
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return null;
    const i = (Math.floor(y) * img.width + Math.floor(x)) * 4;
    return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
  }

  // ---------- реестр шагов (рецепт) ----------
  // id → { name, params: [{ key, default }], run(img, p) }. Нода хранит список { op, ...params }.
  const num = (v, d) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
  const OPS = {
    brightness: { run: (img, p) => brightness(img, num(p.amount, 0)) },
    contrast: { run: (img, p) => contrast(img, num(p.amount, 0)) },
    gamma: { run: (img, p) => gamma(img, num(p.value, 1)) },
    levels: { run: (img, p) => levels(img, num(p.black, 0), num(p.white, 255), num(p.gamma, 1)) },
    shadowLift: { run: (img, p) => shadowLift(img, num(p.strength, 50)) },
    autoLevels: { run: (img, p) => autoLevels(img, num(p.clip, 0.5), !!p.perChannel) },
    equalize: { run: (img) => equalize(img) },
    invert: { run: (img) => invert(img) },
    grayscale: { run: (img, p) => grayscale(img, p.mode) },
    threshold: { run: (img, p) => threshold(img, p.auto ? null : num(p.level, 128)) },
    channel: { run: (img, p) => channel(img, p.name || 'luma') },
    bitPlane: { run: (img, p) => bitPlane(img, p.name || 'r', num(p.bit, 0)) },
    rotate: { run: (img, p) => rotate(img, num(p.degrees, 0)) },
    flipH: { run: (img) => flip(img, true) },
    flipV: { run: (img) => flip(img, false) },
    crop: { run: (img, p) => crop(img, num(p.x, 0), num(p.y, 0), num(p.w, img.width), num(p.h, img.height)) },
    scale: { run: (img, p) => (p.smooth ? scaleSmooth(img, num(p.factor, 1)) : scaleNearest(img, num(p.factor, 1))) },
    blur: { run: (img, p) => boxBlur(img, num(p.radius, 1)) },
  };

  /** Применить рецепт [{ op, ...params }] по порядку. Неизвестная операция — ошибка. */
  function applyRecipe(img, steps) {
    let cur = check(img);
    for (const step of steps || []) {
      const op = OPS[step && step.op];
      if (!op) throw new Error(T('Неизвестная операция обработки: ', 'Unknown processing operation: ') + (step && step.op));
      cur = op.run(cur, step);
    }
    return cur;
  }

  /** Стабильный текстовый ключ рецепта — для кэша производных версий. */
  const recipeKey = (steps) => JSON.stringify((steps || []).map((s) => Object.keys(s).sort().map((k) => [k, s[k]])));

  G.ImgProc = {
    create, clone, check, luma, applyLut, histogram, sample,
    brightness, contrast, gamma, levels, shadowLift, autoLevels, equalize, invert, grayscale, otsu, threshold,
    channel, bitPlane, lsbExtract, bytesToLatin1, rotate, flip, crop, scaleNearest, scaleSmooth, boxBlur,
    OPS, applyRecipe, recipeKey,
  };
})(typeof self !== 'undefined' ? self : this);
