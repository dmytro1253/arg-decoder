// Морзе из звука: поиск тона, огибающая, порог (Оцу), оценка единицы времени, точки/тире,
// буквы и слова с пометками неуверенных мест. Чистая математика на Float32Array.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);

  const LATIN = {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
    '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
    '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y', '--..': 'Z',
    '-----': '0', '.----': '1', '..---': '2', '...--': '3', '....-': '4', '.....': '5', '-....': '6', '--...': '7', '---..': '8', '----.': '9',
    '.-.-.-': '.', '--..--': ',', '..--..': '?', '.----.': "'", '-.-.--': '!', '-..-.': '/', '-.--.': '(', '-.--.-': ')',
    '.-...': '&', '---...': ':', '-.-.-.': ';', '-...-': '=', '.-.-.': '+', '-....-': '-', '..--.-': '_', '.-..-.': '"', '.--.-.': '@',
  };

  const MIN_TONE_MS = 10;       // короче — считаем выбросом
  const MIN_GAP_MS = 10;        // короче — склеиваем соседние тона
  const DASH_AT = 2;            // граница точка/тире в единицах
  const UNSURE_TONE = [1.5, 2.6];
  const UNSURE_LETTER_GAP = [1.5, 2.6];
  const UNSURE_WORD_GAP = [4, 6];
  const DEFAULT_WORD_AT = 5;
  const MIN_CONTRAST = 3;       // меньше — в записи нет устойчивого тона

  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
  const inRange = (r, [lo, hi]) => r >= lo && r <= hi;

  /** Порог Оцу по гистограмме значений огибающей. */
  function otsu(values) {
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < values.length; i++) { if (values[i] < min) min = values[i]; if (values[i] > max) max = values[i]; }
    if (!(max > min)) return { thr: max, min, max };
    const NB = 128, hist = new Float64Array(NB);
    for (let i = 0; i < values.length; i++) hist[Math.min(NB - 1, Math.floor((values[i] - min) / (max - min) * NB))]++;
    const total = values.length;
    let sumAll = 0;
    for (let b = 0; b < NB; b++) sumAll += b * hist[b];
    let wB = 0, sumB = 0, best = 0, bestVar = -1;
    for (let b = 0; b < NB; b++) {
      wB += hist[b];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += b * hist[b];
      const mB = sumB / wB, mF = (sumAll - sumB) / wF;
      const v = wB * wF * (mB - mF) * (mB - mF);
      if (v > bestVar) { bestVar = v; best = b; }
    }
    return { thr: min + (best + 1) / NB * (max - min), min, max };
  }

  /** Отношение среднего уровня выше порога к среднему ниже: у шума ≈2, у настоящего тона на порядок больше. */
  function toneContrast(values, thr) {
    let hi = 0, lo = 0, nh = 0, nl = 0;
    for (let i = 0; i < values.length; i++) { if (values[i] >= thr) { hi += values[i]; nh++; } else { lo += values[i]; nl++; } }
    if (!nh || !nl) return 0;
    return (hi / nh) / Math.max(lo / nl, 1e-9);
  }

  /** k-средних в одномерном случае; возвращает центры по возрастанию. */
  function kmeans1d(values, k) {
    if (!values.length) return [];
    let centers = Array.from({ length: k }, (_, i) => Math.min(...values) + (Math.max(...values) - Math.min(...values)) * (k === 1 ? 0.5 : i / (k - 1)));
    for (let iter = 0; iter < 30; iter++) {
      const sums = new Array(k).fill(0), cnt = new Array(k).fill(0);
      for (const v of values) {
        let bi = 0;
        for (let c = 1; c < k; c++) if (Math.abs(v - centers[c]) < Math.abs(v - centers[bi])) bi = c;
        sums[bi] += v; cnt[bi]++;
      }
      const next = centers.map((c, i) => (cnt[i] ? sums[i] / cnt[i] : c));
      if (next.every((c, i) => Math.abs(c - centers[i]) < 1e-9)) break;
      centers = next;
    }
    return centers.sort((a, b) => a - b);
  }

  /** Превращает булевы отсчёты огибающей в чередующиеся отрезки {on, start, dur} (секунды). */
  function toRuns(env, hopSec, t0, rise, fall) {
    const runs = [];
    let on = false, since = 0;
    for (let i = 0; i < env.length; i++) {
      const now = on ? env[i] >= fall : env[i] >= rise;
      if (now !== on) { runs.push({ on, start: t0 + since * hopSec, dur: (i - since) * hopSec }); on = now; since = i; }
    }
    runs.push({ on, start: t0 + since * hopSec, dur: (env.length - since) * hopSec });
    return runs;
  }

  /** Убирает выбросы: короткие тона отбрасываются, короткие паузы между тонами склеиваются. */
  function cleanRuns(runs) {
    let out = runs.map((r) => ({ ...r }));
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < out.length; i++) {
        const r = out[i], ms = r.dur * 1000;
        const short = (r.on && ms < MIN_TONE_MS) || (!r.on && ms < MIN_GAP_MS && i > 0 && i < out.length - 1);
        if (!short) continue;
        const prev = out[i - 1], next = out[i + 1];
        if (prev) { prev.dur += r.dur + (next && next.on === prev.on ? next.dur : 0); out.splice(i, next && next.on === prev.on ? 2 : 1); }
        else if (next) { next.start = r.start; next.dur += r.dur; out.splice(i, 1); }
        changed = true;
        break;
      }
    }
    while (out.length && !out[0].on) out.shift();
    while (out.length && !out[out.length - 1].on) out.pop();
    return out;
  }

  /** Оценка единицы времени по длинам тонов и пауз (секунды). */
  function estimateUnit(tones, gaps) {
    const notes = [];
    if (!tones.length) return { unit: 0, notes };
    const tc = kmeans1d(tones, 2);
    if (tc.length === 2 && tc[1] / tc[0] >= 2 && tc[1] / tc[0] <= 4.5) return { unit: (tc[0] + tc[1] / 3) / 2, notes };
    const c = median(tones);
    const gc = gaps.length ? kmeans1d(gaps, 2) : [];
    const g1 = gc.length === 2 && gc[1] / gc[0] >= 1.8 ? gc[0] : median(gaps);
    notes.push('single-length');
    if (!g1) return { unit: c, notes };
    const r = c / g1;
    if (r >= 0.6 && r <= 1.6) return { unit: (c + g1) / 2, notes };
    if (r >= 2.2 && r <= 4) return { unit: g1, notes };
    notes.push('unit-guess');
    return { unit: c, notes };
  }

  /** Классификация элементов и сборка кода. */
  function classify(runs, unit, wordAt) {
    const els = [];
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i], ratio = r.dur / unit;
      if (r.on) els.push({ kind: ratio >= DASH_AT ? 'dash' : 'dot', start: r.start, dur: r.dur, ratio, unsure: inRange(ratio, UNSURE_TONE) });
      else if (ratio < DASH_AT) els.push({ kind: 'gap', start: r.start, dur: r.dur, ratio, unsure: inRange(ratio, UNSURE_LETTER_GAP) && ratio >= DASH_AT - 0.35 });
      else if (ratio < wordAt) els.push({ kind: 'letter', start: r.start, dur: r.dur, ratio, unsure: inRange(ratio, UNSURE_LETTER_GAP) || inRange(ratio, UNSURE_WORD_GAP) });
      else els.push({ kind: 'word', start: r.start, dur: r.dur, ratio, unsure: inRange(ratio, UNSURE_WORD_GAP) });
    }
    return els;
  }

  /** Разбивает элементы на слова → буквы {code, unsure, start}. */
  function toLetters(els) {
    const words = [[]];
    let cur = { code: '', unsure: false, start: 0 };
    const flush = () => { if (cur.code) words[words.length - 1].push(cur); cur = { code: '', unsure: false, start: 0 }; };
    for (const e of els) {
      if (e.kind === 'dot' || e.kind === 'dash') {
        if (!cur.code) cur.start = e.start;
        cur.code += e.kind === 'dot' ? '.' : '-';
        if (e.unsure) cur.unsure = true;
      } else if (e.kind === 'gap') {
        if (e.unsure) cur.unsure = true;
      } else if (e.kind === 'letter' || e.kind === 'word') {
        flush();
        const last = words[words.length - 1];
        if (last.length && last[last.length - 1]) last[last.length - 1].gapUnsure = e.unsure;
        if (e.kind === 'word') words.push([]);
      }
    }
    flush();
    return words.filter((w) => w.length);
  }

  function lookup(code, lang) {
    if (lang === 'ru') {
      const dec = G.Codec && G.Codec.MORSE_DEC && G.Codec.MORSE_DEC.ru;
      if (!dec) throw new Error(T('Таблица кириллического Морзе недоступна', 'Cyrillic Morse table is unavailable'));
      return dec.get ? dec.get(code) : dec[code];
    }
    return LATIN[code];
  }

  function render(words, lang, mark) {
    const morse = words.map((w) => w.map((l) => l.code + (mark && l.unsure ? '?' : '')).join(' ')).join(' / ');
    const text = words.map((w) => w.map((l) => {
      const ch = lookup(l.code, lang);
      const base = ch === undefined ? '?' : ch.toUpperCase();
      const marked = mark && l.unsure && ch !== undefined ? '{' + base + '}' : base;
      return marked + (mark && l.gapUnsure ? '¦' : '');
    }).join('')).join(' ');
    return { morse, text };
  }

  /**
   * @param samples Float32Array (моно) @param sr частота дискретизации
   * @param o {freq,fmin,fmax,threshold,unit,lang,start,end,winMs,mark}
   */
  function detect(samples, sr, o) {
    const opt = Object.assign({ freq: 0, fmin: 200, fmax: 3000, threshold: 0, unit: 0, lang: 'en', start: 0, end: 0, winMs: 8, mark: false }, o || {});
    const a = Math.floor((opt.start || 0) * sr), b = opt.end > 0 ? Math.floor(opt.end * sr) : samples.length;
    if (b - a < sr * 0.1) throw new Error(T('Слишком короткий фрагмент для Морзе', 'Segment too short for Morse'));
    const seg = samples.subarray ? samples.subarray(a, b) : samples.slice(a, b);
    const fmax = Math.min(opt.fmax, sr / 2 - 100);
    const freq = opt.freq > 0 ? opt.freq : G.DSP.dominantFrequency(seg, sr, opt.fmin, fmax, 4096).freq;
    const { env, hopSec, winSec } = G.DSP.toneEnvelope(seg, sr, freq, opt.winMs, 2);
    if (env.length < 10) throw new Error(T('Слишком короткий фрагмент для Морзе', 'Segment too short for Morse'));
    const t0 = a / sr + winSec / 2;
    const ot = otsu(env);
    let rise = opt.threshold > 0 ? opt.threshold * ot.max : ot.thr;
    if (!(ot.max > 0) || (opt.threshold <= 0 && toneContrast(env, ot.thr) < MIN_CONTRAST)) {
      return { ok: false, freq, error: T('Устойчивого тона не найдено', 'No stable tone found'), envelope: { env, hopSec, t0 }, thresholds: { rise, fall: rise }, elements: [], morse: '', text: '', letters: 0, unsureCount: 0 };
    }
    const fall = rise * 0.8;
    const runs = cleanRuns(toRuns(env, hopSec, t0, rise, fall));
    const tones = runs.filter((r) => r.on).map((r) => r.dur);
    const gaps = runs.filter((r) => !r.on).map((r) => r.dur);
    const est = opt.unit > 0 ? { unit: opt.unit / 1000, notes: ['manual-unit'] } : estimateUnit(tones, gaps);
    if (!(est.unit > 0)) {
      return { ok: false, freq, error: T('Не найдено ни одного сигнала', 'No signal elements found'), envelope: { env, hopSec, t0 }, thresholds: { rise, fall }, elements: [], morse: '', text: '', letters: 0, unsureCount: 0 };
    }
    const wordAt = wordThreshold(gaps, est.unit);
    const elements = classify(runs, est.unit, wordAt);
    const words = toLetters(elements);
    const plain = render(words, opt.lang, false);
    const marked = render(words, opt.lang, true);
    const unsureCount = elements.filter((e) => e.unsure).length;
    return {
      ok: true, freq, unitMs: est.unit * 1000, wpm: 1.2 / est.unit, notes: est.notes,
      thresholds: { rise, fall, noise: ot.min, peak: ot.max }, envelope: { env, hopSec, t0 },
      elements, words, morse: plain.morse, text: plain.text, morseMarked: marked.morse, textMarked: marked.text,
      letters: words.reduce((n, w) => n + w.length, 0), unsureCount,
    };
  }

  /** Граница «пауза между буквами / между словами»: кластеры длинных пауз или 5 единиц. */
  function wordThreshold(gaps, unit) {
    const inter = gaps.filter((g) => g >= DASH_AT * unit);
    const c = kmeans1d(inter, 2);
    if (c.length === 2 && c[1] / c[0] >= 1.8) return Math.sqrt(c[0] * c[1]) / unit;
    return DEFAULT_WORD_AT;
  }

  G.MorseAudio = { LATIN, detect, otsu, kmeans1d, estimateUnit, cleanRuns, toRuns };
})(typeof self !== 'undefined' ? self : this);
