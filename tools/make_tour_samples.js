// Образцы для примеров «Звук»: SSTV Robot 36 с QR-кодом, Морзе и DTMF (из синтетических фикстур тестов).
//   node tools/make_tour_samples.js   → web/samples/sstv-robot36.js, morse-oldroot.js, dtmf-425822.js
// QR-матрица лежит в tests/fixtures/qr-nightjar.json (сделана один раз библиотекой segno, уровень коррекции H).
// Всё детерминировано: повторный запуск даёт те же байты, тест сверяет образцы с этим генератором.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const synth = require('../tests/fixtures/audio/synth');

const ROOT = path.join(__dirname, '..');
const SAMPLES = path.join(ROOT, 'web', 'samples');
const SSTV_RATE = 8000;          // Robot 36 укладывается в 1500–2300 Гц, 8 кГц хватает с запасом
const QR_SCALE = 7;              // 25 модулей + 4 модуля поля с каждой стороны = 33 × 7 = 231 пиксель ≤ 240
const QR_QUIET = 4;

function loadSstv() {
  const ctx = vm.createContext({ T: (ru) => ru, Math, Float32Array, Float64Array, Uint8ClampedArray, Array, Object });
  ctx.self = ctx;
  for (const f of ['dsp.js', 'sstv.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'web', 'js', 'media', f), 'utf8'), ctx, { filename: f });
  return ctx.SSTV;
}

/** Картинка 320×240: QR по центру на светлом фоне, по бокам тёмные полосы, как у кадра с позывным. */
function qrImage(width, height) {
  const qr = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'qr-nightjar.json'), 'utf8'));
  const n = qr.matrix.length + 2 * QR_QUIET;
  const size = n * QR_SCALE;
  const x0 = Math.floor((width - size) / 2);
  const y0 = Math.floor((height - size) / 2);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      let c = [32, 44, 64];   // фон кадра
      const qx = Math.floor((x - x0) / QR_SCALE) - QR_QUIET;
      const qy = Math.floor((y - y0) / QR_SCALE) - QR_QUIET;
      if (x >= x0 && x < x0 + size && y >= y0 && y < y0 + size) {
        const dark = qx >= 0 && qy >= 0 && qx < qr.matrix.length && qy < qr.matrix.length && qr.matrix[qy][qx] === '1';
        c = dark ? [0, 0, 0] : [255, 255, 255];
      }
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
  }
  return { width, height, data, text: qr.text };
}

/** WAV, 8 бит без знака, моно: втрое меньше 16-битного, декодеру этого достаточно. */
function wav8(samples, rate) {
  const out = Buffer.alloc(44 + samples.length);
  out.write('RIFF', 0); out.writeUInt32LE(36 + samples.length, 4); out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22); out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate, 28); out.writeUInt16LE(1, 32); out.writeUInt16LE(8, 34); out.write('data', 36);
  out.writeUInt32LE(samples.length, 40);
  for (let i = 0; i < samples.length; i++) out[44 + i] = Math.max(0, Math.min(255, Math.round(128 + samples[i] * 127)));
  return out;
}

function sampleFile(id, name, bytes, comment) {
  return '// ' + comment + '\n// Сгенерирован tools/make_tour_samples.js. Грузится по требованию, см. js/samples.js.\n'
    + '(self.ArgSamples = self.ArgSamples || {})[' + JSON.stringify(id) + '] = { name: ' + JSON.stringify(name)
    + ", mime: 'audio/wav', data: '" + bytes.toString('base64') + "' };\n";
}

// Телефонная клавиатура 3×4 своим шрифтом 5×7 — картинка для SSTV Scottie S1 без VIS (реконструкция этапа
// Dr. Langeskov: оригинальные картинки недоступны, рисунок сделан заново).
const KEY_FONT = {
  1: ['..1..', '.11..', '..1..', '..1..', '..1..', '..1..', '.111.'], 2: ['.111.', '1...1', '....1', '...1.', '..1..', '.1...', '11111'],
  3: ['1111.', '....1', '....1', '.111.', '....1', '....1', '1111.'], 4: ['...1.', '..11.', '.1.1.', '1..1.', '11111', '...1.', '...1.'],
  5: ['11111', '1....', '1111.', '....1', '....1', '1...1', '.111.'], 6: ['.111.', '1....', '1....', '1111.', '1...1', '1...1', '.111.'],
  7: ['11111', '....1', '...1.', '..1..', '.1...', '.1...', '.1...'], 8: ['.111.', '1...1', '1...1', '.111.', '1...1', '1...1', '.111.'],
  9: ['.111.', '1...1', '1...1', '.1111', '....1', '....1', '.111.'], 0: ['.111.', '1...1', '1..11', '1.1.1', '11..1', '1...1', '.111.'],
  '*': ['.....', '1.1.1', '.111.', '11111', '.111.', '1.1.1', '.....'], '#': ['.1.1.', '.1.1.', '11111', '.1.1.', '11111', '.1.1.', '.1.1.'],
};
const KEYPAD_LINES = 150;   // передаётся только верх картинки, где клавиатура: так звук короче (64 с)

function keypadImage(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  const put = (x, y, c) => { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= width || y >= height) return; const o = (y * width + x) * 4; data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255; };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) put(x, y, [40, 46, 58]);
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  const KW = 64, KH = 30, GAP = 6, X0 = (width - (3 * KW + 2 * GAP)) / 2, Y0 = 8, SCALE = 3;
  keys.forEach((k, i) => {
    const kx = X0 + (i % 3) * (KW + GAP), ky = Y0 + Math.floor(i / 3) * (KH + GAP);
    for (let y = 0; y < KH; y++) for (let x = 0; x < KW; x++) put(kx + x, ky + y, x < 2 || y < 2 || x >= KW - 2 || y >= KH - 2 ? [150, 160, 175] : [225, 228, 232]);
    const g = KEY_FONT[k], gx = kx + (KW - 5 * SCALE) / 2, gy = ky + (KH - 7 * SCALE) / 2;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === '1') for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) put(gx + c * SCALE + dx, gy + r * SCALE + dy, [20, 24, 30]);
  });
  return { width, height, data };
}

function build() {
  const SSTV = loadSstv();
  const m = SSTV.MODES.robot36;
  const img = qrImage(m.width, m.height);
  const sig = synth.sstv(SSTV.MODES, 'robot36', img, SSTV_RATE, m.height, { noise: 0.015, seed: 36 });
  const fixtures = path.join(ROOT, 'tests', 'fixtures', 'audio');
  // Scottie S1 без VIS-заголовка: VIS и стартовая синхронизация вырезаны, режим узнаётся по периоду строк.
  const sc = SSTV.MODES.scottie1;
  const pad = synth.sstv(SSTV.MODES, 'scottie1', keypadImage(sc.width, sc.height), SSTV_RATE, KEYPAD_LINES, { noise: 0.015, seed: 60 });
  const noVis = pad.samples.subarray(Math.round(1.2 * pad.sampleRate));
  return {
    'sstv-scottie-keypad': sampleFile('sstv-scottie-keypad', 'sstv-scottie.wav', wav8(noVis, pad.sampleRate),
      'SSTV Scottie S1 без VIS (8 кГц, 8 бит): телефонная клавиатура, реконструкция этапа Dr. Langeskov'),
    'sstv-robot36': sampleFile('sstv-robot36', 'sstv-robot36.wav', wav8(sig.samples, sig.sampleRate),
      'SSTV Robot 36 (8 кГц, 8 бит): картинка с QR-кодом «' + img.text + '»'),
    'morse-oldroot': sampleFile('morse-oldroot', 'morse-oldroot.wav', fs.readFileSync(path.join(fixtures, 'synthetic-morse-OLDROOT-700hz.wav')),
      'Морзе 700 Гц, 20 WPM: OLDROOT (копия tests/fixtures/audio/synthetic-morse-OLDROOT-700hz.wav)'),
    'dtmf-425822': sampleFile('dtmf-425822', 'dtmf-425822.wav', fs.readFileSync(path.join(fixtures, 'synthetic-dtmf-425822.wav')),
      'Тоны DTMF: 425822 (копия tests/fixtures/audio/synthetic-dtmf-425822.wav)'),
  };
}

if (require.main === module) {
  for (const [id, text] of Object.entries(build())) {
    fs.writeFileSync(path.join(SAMPLES, id + '.js'), text);
    console.log(id, Math.round(text.length / 1024) + ' KB');
  }
}

module.exports = { build, keypadImage };
