// DTMF-детектор: Гёрцель на 8 частотах, пары «строка + столбец» → цифры 0–9, *, #, A–D.
// Выдаёт строку цифр (можно подать на «Телефон: нажатия → буквы») и список тонов с качеством.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);

  const LOW = [697, 770, 852, 941];
  const HIGH = [1209, 1336, 1477, 1633];
  const KEYS = [['1', '2', '3', 'A'], ['4', '5', '6', 'B'], ['7', '8', '9', 'C'], ['*', '0', '#', 'D']];
  const MIN_DOMINANCE = 2;      // сильнейшая частота группы минимум вдвое выше второй (≈6 дБ)
  const SURE_DOMINANCE = 3;     // ниже — помечаем тон как неуверенный
  const MAX_TWIST = 4;          // допустимый перекос уровней строки/столбца (≈12 дБ)
  const MIN_TONE_FRACTION = 0.45; // доля энергии окна, приходящаяся на пару частот

  function groupBest(amps) {
    let bi = 0;
    for (let i = 1; i < amps.length; i++) if (amps[i] > amps[bi]) bi = i;
    let second = 0;
    for (let i = 0; i < amps.length; i++) if (i !== bi && amps[i] > second) second = amps[i];
    return { index: bi, amp: amps[bi], dominance: second > 0 ? amps[bi] / second : Infinity };
  }

  /** Классификация одного окна → {digit, quality, twist} или null. */
  function classifyWindow(samples, start, len, sr, win, minLevel) {
    let ms = 0;
    for (let i = start; i < Math.min(samples.length, start + len); i++) ms += samples[i] * samples[i];
    ms /= len;
    if (ms < minLevel * minLevel / 2) return null;
    const lo = LOW.map((f) => G.DSP.goertzel(samples, start, len, f, sr, win));
    const hi = HIGH.map((f) => G.DSP.goertzel(samples, start, len, f, sr, win));
    const L = groupBest(lo), H = groupBest(hi);
    if (L.amp < minLevel || H.amp < minLevel) return null;
    if (L.dominance < MIN_DOMINANCE || H.dominance < MIN_DOMINANCE) return null;
    const twist = H.amp / L.amp;
    if (twist > MAX_TWIST || twist < 1 / MAX_TWIST) return null;
    if ((L.amp * L.amp + H.amp * H.amp) / 2 < MIN_TONE_FRACTION * ms) return null;
    return { digit: KEYS[L.index][H.index], low: LOW[L.index], high: HIGH[H.index], quality: Math.min(L.dominance, H.dominance), twistDb: 20 * Math.log10(twist) };
  }

  /**
   * @param samples Float32Array моно @param sr частота дискретизации
   * @param o {winMs, hopMs, minToneMs, minLevel, groupGapMs, start, end}
   */
  function detect(samples, sr, o) {
    const opt = Object.assign({ winMs: 30, hopMs: 5, minToneMs: 40, minLevel: 0.01, groupGapMs: 0, start: 0, end: 0 }, o || {});
    if (sr < 4000) throw new Error(T('Для DTMF нужна частота дискретизации не ниже 4 кГц', 'DTMF needs a sample rate of at least 4 kHz'));
    const a = Math.floor(opt.start * sr), b = opt.end > 0 ? Math.min(samples.length, Math.floor(opt.end * sr)) : samples.length;
    const len = Math.round(sr * opt.winMs / 1000), hop = Math.max(1, Math.round(sr * opt.hopMs / 1000));
    if (b - a < len) throw new Error(T('Слишком короткий фрагмент для DTMF', 'Segment too short for DTMF'));
    const win = G.DSP.windowFn('hann', len);
    const labels = [];
    for (let s = a; s + len <= b; s += hop) labels.push(classifyWindow(samples, s, len, sr, win, opt.minLevel));
    for (let i = 1; i < labels.length - 1; i++) {   // одиночный провал внутри тона не разрывает его
      if (!labels[i] && labels[i - 1] && labels[i + 1] && labels[i - 1].digit === labels[i + 1].digit) labels[i] = labels[i - 1];
    }
    const hopSec = hop / sr, tones = [];
    let i = 0;
    while (i < labels.length) {
      if (!labels[i]) { i++; continue; }
      let j = i;
      while (j + 1 < labels.length && labels[j + 1] && labels[j + 1].digit === labels[i].digit) j++;
      const span = labels.slice(i, j + 1);
      const durMs = (j - i + 1) * hopSec * 1000;
      if (durMs >= opt.minToneMs - opt.hopMs) {
        const q = span.reduce((s, x) => s + x.quality, 0) / span.length;
        const tw = Math.max.apply(null, span.map((x) => Math.abs(x.twistDb)));
        tones.push({ digit: labels[i].digit, start: a / sr + (i * hop + len / 2) / sr, dur: durMs / 1000, low: labels[i].low, high: labels[i].high, quality: q, twistDb: tw, unsure: q < SURE_DOMINANCE || tw > 8 });
      }
      i = j + 1;
    }
    let digits = '';
    tones.forEach((t, k) => {
      if (k > 0 && opt.groupGapMs > 0 && (t.start - tones[k - 1].start - tones[k - 1].dur) * 1000 >= opt.groupGapMs) digits += ' ';
      digits += t.digit;
    });
    return { ok: tones.length > 0, digits, tones, count: tones.length, unsureCount: tones.filter((t) => t.unsure).length };
  }

  G.DTMF = { LOW, HIGH, KEYS, detect, classifyWindow };
})(typeof self !== 'undefined' ? self : this);
