// Цифровая обработка сигналов без зависимостей: БПФ, STFT, Гёрцель, огибающие, ресемплинг.
// Все функции чистые и работают на Float32Array — их можно проверять в Node без браузера.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const TWO_PI = Math.PI * 2;
  const DB_FLOOR = -200;
  const FFT_SIZES = [256, 512, 1024, 2048, 4096, 8192];

  const isPow2 = (n) => Number.isInteger(n) && n >= 2 && (n & (n - 1)) === 0;

  // ---------- БПФ radix-2 ----------
  const plans = new Map();
  function plan(n) {
    let p = plans.get(n);
    if (p) return p;
    if (!isPow2(n)) throw new Error(T('Размер БПФ должен быть степенью двойки, получено ' + n, 'FFT size must be a power of two, got ' + n));
    const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2), rev = new Uint32Array(n);
    for (let k = 0; k < n / 2; k++) { cos[k] = Math.cos(TWO_PI * k / n); sin[k] = Math.sin(TWO_PI * k / n); }
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
      rev[i] = r;
    }
    p = { cos, sin, rev };
    plans.set(n, p);
    return p;
  }

  /** Прямое БПФ на месте: X[k] = Σ x[n]·e^{-2πikn/N}. re и im — массивы одинаковой длины-степени двойки. */
  function fft(re, im) {
    const n = re.length;
    const { cos, sin, rev } = plan(n);
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1, step = n / len;
      for (let i = 0; i < n; i += len) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const wr = cos[k], wi = -sin[k];
          const a = i + j, b = a + half;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
        }
      }
    }
  }

  // ---------- Окна ----------
  const WINDOWS = { hann: 'Hann', hamming: 'Hamming', blackman: 'Blackman', rect: 'rect' };
  const winCache = new Map();
  /** Периодическое окно длины n (то, что нужно для спектрального анализа). */
  function windowFn(type, n) {
    const key = type + ':' + n;
    if (winCache.has(key)) return winCache.get(key);
    if (!Object.prototype.hasOwnProperty.call(WINDOWS, type)) throw new Error(T('Неизвестное окно: ' + type, 'Unknown window: ' + type));
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = TWO_PI * i / n;
      if (type === 'hann') w[i] = 0.5 - 0.5 * Math.cos(x);
      else if (type === 'hamming') w[i] = 0.54 - 0.46 * Math.cos(x);
      else if (type === 'blackman') w[i] = 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x);
      else w[i] = 1;
    }
    winCache.set(key, w);
    return w;
  }

  const toDb = (mag) => (mag > 1e-10 ? 20 * Math.log10(mag) : DB_FLOOR);

  // ---------- STFT ----------
  /**
   * Короткое преобразование Фурье. Амплитуда нормирована: синус с амплитудой 1 даёт ≈ 0 дБ.
   * Два реальных кадра упаковываются в одно комплексное БПФ (вдвое быстрее).
   * @returns {{size,hop,bins,frames,start,sampleRate,db:Float32Array}} db[frame*bins+bin] в дБ
   */
  function stft(samples, o) {
    const size = o.size, hop = Math.max(1, Math.round(o.hop));
    if (!isPow2(size) || size < 64 || size > 32768) throw new Error(T('Недопустимый размер БПФ', 'Invalid FFT size'));
    const win = windowFn(o.window || 'hann', size);
    const start = Math.max(0, Math.floor(o.start || 0));
    const end = Math.min(samples.length, o.end === undefined ? samples.length : Math.floor(o.end));
    const frames = Math.max(1, Math.floor((end - start - size) / hop) + 1);
    const bins = size / 2 + 1;
    let wsum = 0;
    for (let i = 0; i < size; i++) wsum += win[i];
    const norm = 2 / wsum;
    const db = new Float32Array(frames * bins);
    const re = new Float64Array(size), im = new Float64Array(size);
    for (let f = 0; f < frames; f += 2) {
      const hasB = f + 1 < frames;
      const a0 = start + f * hop, b0 = a0 + hop;
      for (let i = 0; i < size; i++) {
        const ia = a0 + i, ib = b0 + i;
        re[i] = ia < end ? samples[ia] * win[i] : 0;
        im[i] = hasB && ib < end ? samples[ib] * win[i] : 0;
      }
      fft(re, im);
      const oa = f * bins, ob = oa + bins;
      for (let k = 0; k < bins; k++) {
        const nk = (size - k) % size;
        const zr = re[k], zi = im[k], nr = re[nk], ni = -im[nk];
        db[oa + k] = toDb(Math.hypot((zr + nr) / 2, (zi + ni) / 2) * norm);
        if (hasB) db[ob + k] = toDb(Math.hypot((zr - nr) / 2, (zi - ni) / 2) * norm);
      }
    }
    return { size, hop, bins, frames, start, sampleRate: o.sampleRate || 0, db };
  }

  // ---------- Гёрцель ----------
  /** Амплитуда синуса частоты freq в окне [start, start+len): синус амплитуды A даёт ≈ A. */
  function goertzel(samples, start, len, freq, sampleRate, win) {
    const coeff = 2 * Math.cos(TWO_PI * freq / sampleRate);
    let s1 = 0, s2 = 0, wsum = 0;
    const end = Math.min(samples.length, start + len);
    for (let i = start; i < end; i++) {
      const w = win ? win[i - start] : 1;
      wsum += w;
      const s = samples[i] * w + coeff * s1 - s2;
      s2 = s1; s1 = s;
    }
    if (wsum === 0) return 0;
    const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
    return 2 * Math.sqrt(Math.max(0, power)) / wsum;
  }

  /** Огибающая тона на частоте freq: амплитуды с шагом hopMs (окно winMs, окно Ханна). */
  function toneEnvelope(samples, sampleRate, freq, winMs, hopMs, start, end) {
    const win = Math.max(8, Math.round(sampleRate * winMs / 1000));
    const hop = Math.max(1, Math.round(sampleRate * hopMs / 1000));
    const a = Math.max(0, Math.floor(start || 0)), b = Math.min(samples.length, end === undefined ? samples.length : Math.floor(end));
    const n = Math.max(0, Math.floor((b - a - win) / hop) + 1);
    const out = new Float32Array(n);
    const w = windowFn('hann', win);
    for (let i = 0; i < n; i++) out[i] = goertzel(samples, a + i * hop, win, freq, sampleRate, w);
    return { env: out, hopSec: hop / sampleRate, winSec: win / sampleRate, t0: a / sampleRate };
  }

  /** Среднеквадратичная огибающая. */
  function rmsEnvelope(samples, win, hop) {
    const n = Math.max(0, Math.floor((samples.length - win) / hop) + 1);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      const a = i * hop;
      for (let j = 0; j < win; j++) s += samples[a + j] * samples[a + j];
      out[i] = Math.sqrt(s / win);
    }
    return out;
  }

  // ---------- Каналы и простые преобразования ----------
  const CHANNEL_MODES = ['mono', 'left', 'right', 'diff'];
  /** Выбор канала: mono (среднее), left, right, diff (L−R). channels — массив Float32Array. */
  function mixdown(channels, mode) {
    if (!channels || !channels.length) throw new Error(T('Нет аудиоданных', 'No audio data'));
    const n = channels[0].length;
    const L = channels[0], R = channels[1] || channels[0];
    const out = new Float32Array(n);
    if (mode === 'left') out.set(L);
    else if (mode === 'right') out.set(R);
    else if (mode === 'diff') {
      if (channels.length < 2) throw new Error(T('Для L−R нужен стерео-файл', 'L−R needs a stereo file'));
      for (let i = 0; i < n; i++) out[i] = L[i] - R[i];
    } else if (mode === 'mono' || mode === undefined) {
      for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < channels.length; c++) s += channels[c][i]; out[i] = s / channels.length; }
    } else throw new Error(T('Неизвестный режим канала: ' + mode, 'Unknown channel mode: ' + mode));
    return out;
  }

  function reverse(samples) {
    const n = samples.length, out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = samples[n - 1 - i];
    return out;
  }

  function slice(samples, a, b) {
    const s = Math.max(0, Math.floor(a)), e = Math.min(samples.length, Math.floor(b));
    return samples.slice(s, Math.max(s, e));
  }

  function peak(samples) {
    let m = 0;
    for (let i = 0; i < samples.length; i++) { const v = Math.abs(samples[i]); if (v > m) m = v; }
    return m;
  }

  function normalize(samples, target) {
    const p = peak(samples), out = new Float32Array(samples.length);
    const g = p > 0 ? (target || 0.95) / p : 1;
    for (let i = 0; i < samples.length; i++) out[i] = samples[i] * g;
    return out;
  }

  /** Перцентиль (0–100) по массиву; для длинных массивов берётся равномерная выборка. */
  function percentile(arr, p, maxSample) {
    const lim = maxSample || 200000;
    const step = Math.max(1, Math.floor(arr.length / lim));
    const v = [];
    for (let i = 0; i < arr.length; i += step) v.push(arr[i]);
    if (!v.length) return 0;
    v.sort((a, b) => a - b);
    return v[Math.min(v.length - 1, Math.max(0, Math.round((p / 100) * (v.length - 1))))];
  }

  // ---------- Ресемплинг (оконный sinc) ----------
  function resample(samples, rateIn, rateOut) {
    if (!(rateIn > 0) || !(rateOut > 0)) throw new Error(T('Некорректная частота дискретизации', 'Invalid sample rate'));
    if (rateIn === rateOut) return Float32Array.from(samples);
    const ratio = rateOut / rateIn;
    const cutoff = Math.min(1, ratio);
    const half = Math.ceil(12 / cutoff);
    const n = Math.floor(samples.length * ratio);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const pos = i / ratio, c = Math.floor(pos);
      let acc = 0;
      for (let j = c - half + 1; j <= c + half; j++) {
        if (j < 0 || j >= samples.length) continue;
        const x = pos - j, ax = Math.abs(x) / half;
        if (ax >= 1) continue;
        const arg = Math.PI * x * cutoff;
        const sinc = x === 0 ? 1 : Math.sin(arg) / arg;
        acc += samples[j] * cutoff * sinc * (0.5 + 0.5 * Math.cos(Math.PI * ax));
      }
      out[i] = acc;
    }
    return out;
  }

  /** Пик спектра в диапазоне [fmin, fmax] по усреднённой мощности кадров с параболическим уточнением. */
  function dominantFrequency(samples, sampleRate, fmin, fmax, size) {
    const sz = size || 4096;
    const sp = stft(samples, { size: sz, hop: sz >> 1, window: 'hann', sampleRate });
    const acc = new Float64Array(sp.bins);
    for (let f = 0; f < sp.frames; f++) for (let k = 0; k < sp.bins; k++) acc[k] += Math.pow(10, sp.db[f * sp.bins + k] / 10);
    const binHz = sampleRate / sz;
    const lo = Math.max(1, Math.floor(fmin / binHz)), hi = Math.min(sp.bins - 2, Math.ceil(fmax / binHz));
    let best = lo;
    for (let k = lo; k <= hi; k++) if (acc[k] > acc[best]) best = k;
    const a = Math.log(acc[best - 1] + 1e-30), b = Math.log(acc[best] + 1e-30), c = Math.log(acc[best + 1] + 1e-30);
    const d = a - 2 * b + c;
    const shift = d !== 0 ? 0.5 * (a - c) / d : 0;
    return { freq: (best + Math.max(-0.5, Math.min(0.5, shift))) * binHz, level: acc[best] };
  }

  G.DSP = {
    FFT_SIZES, WINDOWS, CHANNEL_MODES, DB_FLOOR,
    isPow2, fft, windowFn, toDb, stft, goertzel, toneEnvelope, rmsEnvelope,
    mixdown, reverse, slice, peak, normalize, percentile, resample, dominantFrequency,
  };
})(typeof self !== 'undefined' ? self : this);
