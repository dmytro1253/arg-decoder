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

function build() {
  const SSTV = loadSstv();
  const m = SSTV.MODES.robot36;
  const img = qrImage(m.width, m.height);
  const sig = synth.sstv(SSTV.MODES, 'robot36', img, SSTV_RATE, m.height, { noise: 0.015, seed: 36 });
  const fixtures = path.join(ROOT, 'tests', 'fixtures', 'audio');
  return {
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

module.exports = { build };
