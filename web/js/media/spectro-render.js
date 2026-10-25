// Отрисовка спектрограммы в RGBA-массив {width,height,data}: чистая функция без canvas,
// поэтому тот же код рисует экран, экспортирует картинку-артефакт и проверяется в тестах.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);

  // Опорные цвета палитр (линейная интерполяция между точками).
  const STOPS = {
    inferno: [[0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99], [212, 72, 66], [245, 125, 21], [250, 193, 39], [252, 255, 164]],
    magma: [[0, 0, 4], [28, 16, 68], [79, 18, 123], [129, 37, 129], [181, 54, 122], [229, 80, 100], [251, 135, 97], [254, 194, 135], [252, 253, 191]],
    viridis: [[68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142], [38, 130, 142], [31, 158, 137], [53, 183, 121], [109, 205, 89], [180, 222, 44], [253, 231, 37]],
    hot: [[0, 0, 0], [230, 0, 0], [255, 210, 0], [255, 255, 255]],
    ice: [[0, 0, 0], [0, 40, 110], [0, 140, 220], [160, 230, 255], [255, 255, 255]],
    gray: [[0, 0, 0], [255, 255, 255]],
    grayinv: [[255, 255, 255], [0, 0, 0]],
  };
  const CMAP_NAMES = {
    inferno: ['Inferno', 'Inferno'], magma: ['Magma', 'Magma'], viridis: ['Viridis', 'Viridis'], hot: ['Жар', 'Hot'], // i18n-ok: данные
    ice: ['Лёд', 'Ice'], gray: ['Серая', 'Gray'], grayinv: ['Серая (тёмное на светлом, для OCR)', 'Gray inverted (dark on light, for OCR)'], // i18n-ok: данные
  };

  const lutCache = new Map();
  /** Таблица 256×RGB для палитры. */
  function lut(name) {
    if (lutCache.has(name)) return lutCache.get(name);
    const stops = STOPS[name];
    if (!stops) throw new Error(T('Неизвестная палитра: ' + name, 'Unknown colour map: ' + name));
    const out = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * (stops.length - 1), a = Math.min(stops.length - 2, Math.floor(x)), t = x - a;
      for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(stops[a][c] * (1 - t) + stops[a + 1][c] * t);
    }
    lutCache.set(name, out);
    return out;
  }

  /** Для каждой строки изображения — диапазон бинов спектра (строка 0 = верхняя частота). */
  function rowMap(height, bins, binHz, fmin, fmax, scale) {
    const nyq = (bins - 1) * binHz;
    const hi = Math.min(Math.max(fmax || nyq, binHz * 2), nyq);
    const lo = Math.max(0, Math.min(fmin || 0, hi - binHz));
    const logLo = Math.max(lo, 20, binHz);
    const freqAt = (u) => (scale === 'log'
      ? logLo * Math.pow(hi / logLo, 1 - u)
      : hi - u * (hi - lo));
    const rows = [];
    for (let y = 0; y < height; y++) {
      const fTop = freqAt(y / height), fBot = freqAt((y + 1) / height), fMid = freqAt((y + 0.5) / height);
      rows.push({ lo: fBot / binHz, hi: fTop / binHz, mid: fMid / binHz });
    }
    return { rows, fmin: scale === 'log' ? logLo : lo, fmax: hi };
  }

  /** Значение в дБ для строки: максимум по охваченным бинам или интерполяция между соседними. */
  function sampleRow(db, base, bins, r) {
    if (r.hi - r.lo >= 1) {
      const a = Math.max(0, Math.ceil(r.lo)), b = Math.min(bins - 1, Math.floor(r.hi));
      let m = -Infinity;
      for (let k = a; k <= b; k++) if (db[base + k] > m) m = db[base + k];
      return m === -Infinity ? db[base + Math.min(bins - 1, Math.round(r.mid))] : m;
    }
    const k0 = Math.max(0, Math.min(bins - 2, Math.floor(r.mid))), t = Math.max(0, Math.min(1, r.mid - k0));
    return db[base + k0] * (1 - t) + db[base + k0 + 1] * t;
  }

  /**
   * @param spec {db,frames,bins,size,sampleRate} результат DSP.stft
   * @param o {width?,height,fmin,fmax,scale,dbmin,dbmax,autolevel,range,gamma,cmap}
   * @returns {{width,height,data:Uint8ClampedArray,lo,hi,fmin,fmax}}
   */
  function render(spec, o) {
    const height = Math.max(8, Math.round(o.height || 256));
    const width = Math.max(1, Math.round(o.width || spec.frames));
    const binHz = spec.sampleRate / spec.size;
    const map = rowMap(height, spec.bins, binHz, o.fmin, o.fmax, o.scale === 'log' ? 'log' : 'linear');
    const vals = new Float32Array(width * height);
    for (let x = 0; x < width; x++) {
      const f0 = Math.floor(x * spec.frames / width), f1 = Math.max(f0, Math.min(spec.frames - 1, Math.ceil((x + 1) * spec.frames / width) - 1));
      for (let y = 0; y < height; y++) {
        let m = -Infinity;
        for (let f = f0; f <= f1; f++) { const v = sampleRow(spec.db, f * spec.bins, spec.bins, map.rows[y]); if (v > m) m = v; }
        vals[y * width + x] = m;
      }
    }
    // Автоуровни: верх — 99.9-й перцентиль, низ — на range дБ ниже; иначе явные dbmin/dbmax.
    let hi = Number.isFinite(o.dbmax) ? o.dbmax : -10, lo = Number.isFinite(o.dbmin) ? o.dbmin : -100;
    if (o.autolevel) {
      hi = G.DSP.percentile(vals, 99.9);
      lo = hi - (o.range > 0 ? o.range : 80);
    }
    if (!(hi > lo)) hi = lo + 1;
    const gamma = o.gamma > 0 ? o.gamma : 1;
    const table = lut(o.cmap || 'inferno');
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < vals.length; i++) {
      let u = (vals[i] - lo) / (hi - lo);
      u = u <= 0 ? 0 : u >= 1 ? 1 : Math.pow(u, gamma);
      const k = Math.round(u * 255) * 3;
      data[i * 4] = table[k]; data[i * 4 + 1] = table[k + 1]; data[i * 4 + 2] = table[k + 2]; data[i * 4 + 3] = 255;
    }
    return { width, height, data, lo, hi, fmin: map.fmin, fmax: map.fmax };
  }

  /** Яркость пикселя (0–255) — удобно для проверок в тестах. */
  const luma = (img, x, y) => {
    const i = (y * img.width + x) * 4;
    return 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
  };

  G.SpectroRender = { CMAP_NAMES, lut, render, luma, rowMap };
})(typeof self !== 'undefined' ? self : this);
