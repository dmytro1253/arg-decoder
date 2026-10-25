// Генераторы СИНТЕТИЧЕСКИХ звуков для тестов (не записи из ARG): Морзе, DTMF, чирп,
// слово «нарисованное» в спектрограмме и SSTV-сигнал. Всё детерминировано (свой ГПСЧ).
const fs = require('node:fs');
const path = require('node:path');

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addNoise(samples, level, seed) {
  if (!level) return samples;
  const r = rng(seed || 1);
  for (let i = 0; i < samples.length; i++) samples[i] += level * (r() + r() + r() - 1.5) * 0.8;
  return samples;
}

/** Сегменты [частота Гц или 0 для тишины, длительность мс, амплитуда] → непрерывная по фазе волна. */
function renderTones(segments, sr, fadeMs) {
  let total = 0;
  for (const s of segments) total += s[1];
  const out = new Float32Array(Math.round(total * sr / 1000) + 1);
  let n = 0, phase = 0, endMs = 0;
  const fade = Math.round((fadeMs || 0) * sr / 1000);
  for (const [freq, ms, amp] of segments) {
    endMs += ms;
    const target = Math.min(out.length, Math.round(endMs * sr / 1000));
    const first = n;
    for (; n < target; n++) {
      let a = amp === undefined ? 1 : amp;
      if (fade) { const k = Math.min(n - first, target - 1 - n); if (k < fade) a *= 0.5 - 0.5 * Math.cos(Math.PI * k / fade); }
      out[n] = freq ? a * Math.sin(phase) : 0;
      phase += 2 * Math.PI * freq / sr;
    }
  }
  return out.subarray(0, n);
}

/** Морзе: table — карта «символ → код». Единица = 1.2 / wpm секунды. */
function morse(text, table, o) {
  const opt = Object.assign({ freq: 700, wpm: 20, sr: 8000, noise: 0, lead: 0.3, amp: 0.6, seed: 7 }, o);
  const unit = 1200 / opt.wpm;
  const seg = [[0, opt.lead * 1000]];
  const words = text.toUpperCase().split(' ');
  words.forEach((w, wi) => {
    Array.from(w).forEach((ch, ci) => {
      const code = table[ch];
      if (!code) throw new Error('нет кода для ' + ch);
      Array.from(code).forEach((el, ei) => {
        seg.push([opt.freq, el === '.' ? unit : 3 * unit, opt.amp]);
        if (ei < code.length - 1) seg.push([0, unit]);
      });
      if (ci < w.length - 1) seg.push([0, 3 * unit]);
    });
    if (wi < words.length - 1) seg.push([0, 7 * unit]);
  });
  seg.push([0, opt.lead * 1000]);
  return { samples: addNoise(renderTones(seg, opt.sr, 4), opt.noise, opt.seed), sampleRate: opt.sr };
}

const DTMF_LOW = [697, 770, 852, 941], DTMF_HIGH = [1209, 1336, 1477, 1633];
const DTMF_KEYS = '123A456B789C*0#D';

function dtmf(digits, o) {
  const opt = Object.assign({ sr: 8000, toneMs: 100, pauseMs: 60, amp: 0.4, noise: 0, seed: 3 }, o);
  const total = digits.length * (opt.toneMs + opt.pauseMs) + 200 + 600 * (digits.split(' ').length - 1);
  const out = new Float32Array(Math.round(total * opt.sr / 1000));
  let pos = Math.round(0.1 * opt.sr);
  for (const ch of digits) {
    if (ch === ' ') { pos += Math.round(0.6 * opt.sr); continue; }
    const idx = DTMF_KEYS.indexOf(ch);
    const lo = DTMF_LOW[idx >> 2], hi = DTMF_HIGH[idx & 3];
    const len = Math.round(opt.toneMs * opt.sr / 1000);
    for (let i = 0; i < len && pos + i < out.length; i++) {
      const env = Math.min(1, i / 40, (len - i) / 40);
      out[pos + i] = opt.amp * env * (Math.sin(2 * Math.PI * lo * i / opt.sr) + Math.sin(2 * Math.PI * hi * i / opt.sr)) / 2;
    }
    pos += Math.round((opt.toneMs + opt.pauseMs) * opt.sr / 1000);
  }
  return { samples: addNoise(out, opt.noise, opt.seed), sampleRate: opt.sr };
}

function chirp(f0, f1, seconds, sr, amp) {
  const n = Math.round(seconds * sr), out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const f = f0 + (f1 - f0) * i / n;
    out[i] = (amp || 0.5) * Math.sin(phase);
    phase += 2 * Math.PI * f / sr;
  }
  return { samples: out, sampleRate: sr };
}

// ---------- Слово в спектрограмме: шрифт 5×7 ----------
const GLYPHS = {
  P: ['1111.', '1...1', '1...1', '1111.', '1....', '1....', '1....'],
  G: ['.111.', '1...1', '1....', '1.111', '1...1', '1...1', '.111.'],
  5: ['11111', '1....', '1111.', '....1', '....1', '1...1', '.111.'],
  6: ['.111.', '1....', '1....', '1111.', '1...1', '1...1', '.111.'],
  S: ['.111.', '1...1', '1....', '.111.', '....1', '1...1', '.111.'],
  I: ['.111.', '..1..', '..1..', '..1..', '..1..', '..1..', '.111.'],
  L: ['1....', '1....', '1....', '1....', '1....', '1....', '11111'],
  E: ['11111', '1....', '1....', '1111.', '1....', '1....', '11111'],
  N: ['1...1', '11..1', '1.1.1', '1..11', '1...1', '1...1', '1...1'],
  T: ['11111', '..1..', '..1..', '..1..', '..1..', '..1..', '..1..'],
  R: ['1111.', '1...1', '1...1', '1111.', '1.1..', '1..1.', '1...1'],
  A: ['.111.', '1...1', '1...1', '11111', '1...1', '1...1', '1...1'],
  V: ['1...1', '1...1', '1...1', '1...1', '1...1', '.1.1.', '..1..'],
};

/** Битовая карта слова: массив строк «1/0» высотой 7 (между буквами пустой столбец). */
function textBitmap(text) {
  const rows = Array.from({ length: 7 }, () => '');
  Array.from(text).forEach((ch, i) => {
    const g = GLYPHS[ch];
    if (!g) throw new Error('нет глифа ' + ch);
    for (let r = 0; r < 7; r++) rows[r] += (i ? '0' : '') + g[r].replace(/\./g, '0');
  });
  return rows;
}

const TEXT_AUDIO = { sr: 16000, topHz: 3000, stepHz: 250, colMs: 40, leadMs: 200 };

function spectrogramText(text, o) {
  const opt = Object.assign({}, TEXT_AUDIO, o);
  const rows = textBitmap(text);
  const cols = rows[0].length;
  const total = Math.round((cols * opt.colMs + 2 * opt.leadMs) * opt.sr / 1000);
  const out = new Float32Array(total);
  const lead = Math.round(opt.leadMs * opt.sr / 1000), colLen = Math.round(opt.colMs * opt.sr / 1000);
  for (let r = 0; r < rows.length; r++) {
    const f = opt.topHz - r * opt.stepHz;
    for (let c = 0; c < cols; c++) {
      if (rows[r][c] !== '1') continue;
      for (let i = 0; i < colLen; i++) {
        const w = Math.min(1, i / 48, (colLen - i) / 48);
        const n = lead + c * colLen + i;
        out[n] += 0.09 * w * Math.sin(2 * Math.PI * f * n / opt.sr);
      }
    }
  }
  return { samples: out, sampleRate: opt.sr, rows, cols, layout: opt };
}

// ---------- SSTV ----------
const clamp8 = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgbToYcc = (r, g, b) => [16 + 0.257 * r + 0.504 * g + 0.098 * b, 128 + 0.439 * r - 0.368 * g - 0.071 * b, 128 - 0.148 * r - 0.291 * g + 0.439 * b];
const hz = (v) => 1500 + (clamp8(v) / 255) * 800;

/** Тестовая картинка: цветные полосы сверху, градиент снизу. */
function testImage(width, height) {
  const bars = [[255, 255, 255], [255, 255, 0], [0, 255, 255], [0, 255, 0], [255, 0, 255], [255, 0, 0], [0, 0, 255], [0, 0, 0]];
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      let c;
      if (y < height * 0.6) c = bars[Math.floor(x * 8 / width)];
      else { const g = Math.round(x * 255 / (width - 1)); c = [g, g, g]; }
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
  }
  return { width, height, data };
}

function visSegments(code) {
  const seg = [[1900, 300], [1200, 10], [1900, 300], [1200, 30]];
  let ones = 0;
  for (let k = 0; k < 7; k++) { const b = (code >> k) & 1; ones += b; seg.push([b ? 1100 : 1300, 30]); }
  seg.push([ones % 2 ? 1100 : 1300, 30]);
  seg.push([1200, 30]);
  return seg;
}

/** Кодирует картинку в SSTV. modes — таблица режимов из sstv.js; lines — сколько строк передавать. */
function sstv(modes, key, img, sr, lines, o) {
  const m = modes[key], opt = Object.assign({ startSync: true, noise: 0, seed: 5, freqShift: 0 }, o);
  const L = Math.min(lines || m.height, m.height);
  const seg = [...visSegments(m.vis), ...(m.midSync && opt.startSync ? [[1200, m.sync], [1500, 1.5]] : [])];
  const px = (y, x) => { const i = (y * img.width + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
  const pushScan = (values, ms) => values.forEach((v) => seg.push([hz(v), ms / values.length]));
  for (let y = 0; y < L; y++) {
    const row = Array.from({ length: m.width }, (_, x) => px(y, x));
    if (m.kind === 'robot') {
      const pair = y & ~1;
      const chroma = Array.from({ length: m.width }, (_, x) => {
        const a = rgbToYcc(...px(pair, x)), b = rgbToYcc(...px(Math.min(pair + 1, img.height - 1), x));
        return (y & 1) ? (a[2] + b[2]) / 2 : (a[1] + b[1]) / 2;
      });
      seg.push([1200, 9], [1500, 3]);
      pushScan(row.map((p) => rgbToYcc(...p)[0]), 88);
      seg.push([(y & 1) ? 2300 : 1500, 4.5], [1900, 1.5]);
      pushScan(chroma, 44);
    } else if (m.midSync) {
      seg.push([1500, 1.5]);
      pushScan(row.map((p) => p[1]), m.scan); seg.push([1500, 1.5]);
      pushScan(row.map((p) => p[2]), m.scan);
      seg.push([1200, m.sync], [1500, 1.5]);
      pushScan(row.map((p) => p[0]), m.scan);
    } else {
      seg.push([1200, m.sync], [1500, 0.572]);
      pushScan(row.map((p) => p[1]), m.scan); seg.push([1500, 0.572]);
      pushScan(row.map((p) => p[2]), m.scan); seg.push([1500, 0.572]);
      pushScan(row.map((p) => p[0]), m.scan); seg.push([1500, 0.572]);
    }
  }
  const shifted = opt.freqShift ? seg.map(([f, ms]) => [f + opt.freqShift, ms]) : seg;
  const samples = addNoise(renderTones([[0, 200], ...shifted, [0, 200]], sr, 0), opt.noise, opt.seed);
  for (let i = 0; i < samples.length; i++) samples[i] *= 0.7;
  return { samples, sampleRate: sr };
}

// ---------- Запись файлов-фикстур ----------
function wavBytes(channels, sr) {
  const n = channels[0].length, nch = channels.length;
  const out = Buffer.alloc(44 + n * nch * 2);
  out.write('RIFF', 0); out.writeUInt32LE(36 + n * nch * 2, 4); out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(nch, 22); out.writeUInt32LE(sr, 24);
  out.writeUInt32LE(sr * nch * 2, 28); out.writeUInt16LE(nch * 2, 32); out.writeUInt16LE(16, 34); out.write('data', 36);
  out.writeUInt32LE(n * nch * 2, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < nch; c++) out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, channels[c][i])) * 32767), 44 + (i * nch + c) * 2);
  return out;
}

const FILES = {
  'synthetic-morse-OLDROOT-700hz.wav': (table) => morse('OLDROOT', table, { freq: 700, wpm: 20, noise: 0.02 }),
  'synthetic-dtmf-425822.wav': () => dtmf('425822', { noise: 0.01 }),
  'synthetic-chirp-300-3000hz.wav': () => chirp(300, 3000, 2, 8000, 0.5),
  'synthetic-spectrogram-text-PG56.wav': () => spectrogramText('PG56'),
};

function writeFixtures(table, dir) {
  const target = dir || __dirname;
  for (const [name, make] of Object.entries(FILES)) {
    const r = make(table);
    fs.writeFileSync(path.join(target, name), wavBytes([r.samples], r.sampleRate));
  }
}

module.exports = { rng, renderTones, morse, dtmf, chirp, spectrogramText, textBitmap, testImage, sstv, wavBytes, writeFixtures, FILES, TEXT_AUDIO };
