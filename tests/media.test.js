// Тесты пакета «Звук и видео»: DSP, WAV, спектрограмма, Морзе, DTMF, SSTV на СИНТЕТИЧЕСКИХ сигналах.
// Браузер не нужен: всё считается на Float32Array.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadEngine } = require('./load');
const synth = require('./fixtures/audio/synth');

const MEDIA = path.join(__dirname, '..', 'web', 'js', 'media');
const FIXTURES = path.join(__dirname, 'fixtures', 'audio');
const PURE = ['dsp.js', 'wav.js', 'spectro-render.js', 'morse-audio.js', 'dtmf.js', 'sstv.js', 'video-math.js'];

const { ctx } = loadEngine();
ctx.T = (ru) => ru;
for (const f of PURE) vm.runInContext(fs.readFileSync(path.join(MEDIA, f), 'utf8'), ctx, { filename: f });
const { DSP, Wav, SpectroRender, MorseAudio, DTMF, SSTV, VideoMath } = ctx;
// Слой нод (без DOM): хранилище артефактов, ввод-вывод звука и сами ноды.
ctx.NodeTypes = ctx.NodeTypes || {};
for (const f of ['../artifacts.js', 'ui-util.js', 'audio-io.js', 'spectrogram-node.js', 'signal-nodes.js', 'video-node.js']) {
  vm.runInContext(fs.readFileSync(path.join(MEDIA, f), 'utf8'), ctx, { filename: f });
}
const NT = ctx.NodeTypes, A = ctx.Artifacts;

const LATIN = MorseAudio.LATIN;
const invert = (t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [v, k]));
const ENCODE = invert(LATIN);

function fixture(name) {
  const file = path.join(FIXTURES, name);
  if (!fs.existsSync(file)) synth.writeFixtures(ENCODE, FIXTURES);
  return Wav.parse(new Uint8Array(fs.readFileSync(file)));
}

const sine = (f, sr, n, a = 1) => Float32Array.from({ length: n }, (_, i) => a * Math.sin(2 * Math.PI * f * i / sr));

// ---------- DSP ----------
test('БПФ совпадает с прямым ДПФ', () => {
  const n = 16, x = Array.from({ length: n }, (_, i) => Math.sin(i * 1.3) + 0.5 * Math.cos(i * 0.4));
  const re = Float64Array.from(x), im = new Float64Array(n);
  DSP.fft(re, im);
  for (let k = 0; k < n; k++) {
    let sr = 0, si = 0;
    for (let t = 0; t < n; t++) { sr += x[t] * Math.cos(2 * Math.PI * k * t / n); si -= x[t] * Math.sin(2 * Math.PI * k * t / n); }
    assert.ok(Math.abs(re[k] - sr) < 1e-9 && Math.abs(im[k] - si) < 1e-9, 'бин ' + k);
  }
});

test('БПФ отвергает размер не степень двойки', () => {
  assert.throws(() => DSP.fft(new Float64Array(12), new Float64Array(12)), /степенью двойки/);
});

test('STFT: синус амплитуды 1 даёт ≈0 дБ в нужном бине для всех окон', () => {
  const sr = 8000, size = 1024, f = 62.5 * 40;   // ровно на бин 320
  for (const w of ['hann', 'hamming', 'blackman', 'rect']) {
    const sp = DSP.stft(sine(f, sr, 8000), { size, hop: 512, window: w, sampleRate: sr });
    const k = Math.round(f / (sr / size)), row = 3 * sp.bins;
    assert.ok(Math.abs(sp.db[row + k]) < 0.5, w + ': ' + sp.db[row + k]);
    assert.ok(sp.db[row + k + 40] < -40, w + ' утечка');
  }
});

test('STFT: нечётное число кадров и короткий сигнал не ломаются', () => {
  const sp = DSP.stft(sine(500, 8000, 3000), { size: 256, hop: 256, window: 'hann', sampleRate: 8000 });
  assert.equal(sp.frames, Math.floor((3000 - 256) / 256) + 1);
  const short = DSP.stft(sine(500, 8000, 100), { size: 256, hop: 64, window: 'hann', sampleRate: 8000 });
  assert.equal(short.frames, 1);
});

test('Гёрцель измеряет амплитуду и не видит чужую частоту', () => {
  const sr = 8000, x = sine(770, sr, 2000, 0.3);
  assert.ok(Math.abs(DSP.goertzel(x, 0, 800, 770, sr, DSP.windowFn('hann', 800)) - 0.3) < 0.01);
  assert.ok(DSP.goertzel(x, 0, 800, 1209, sr, DSP.windowFn('hann', 800)) < 0.01);
});

test('каналы: mono, left, right, L−R, reverse', () => {
  const L = Float32Array.from([1, 2, 3]), R = Float32Array.from([3, 2, 1]);
  assert.deepEqual(Array.from(DSP.mixdown([L, R], 'mono')), [2, 2, 2]);
  assert.deepEqual(Array.from(DSP.mixdown([L, R], 'left')), [1, 2, 3]);
  assert.deepEqual(Array.from(DSP.mixdown([L, R], 'right')), [3, 2, 1]);
  assert.deepEqual(Array.from(DSP.mixdown([L, R], 'diff')), [-2, 0, 2]);
  assert.throws(() => DSP.mixdown([L], 'diff'), /стерео/);
  assert.deepEqual(Array.from(DSP.reverse(L)), [3, 2, 1]);
});

test('ресемплинг сохраняет частоту тона', () => {
  const x = sine(1000, 16000, 16000), y = DSP.resample(x, 16000, 8000);
  assert.equal(y.length, 8000);
  assert.ok(Math.abs(DSP.dominantFrequency(y, 8000, 100, 3500, 2048).freq - 1000) < 5);
  const up = DSP.resample(y, 8000, 16000);
  assert.ok(Math.abs(DSP.dominantFrequency(up, 16000, 100, 7000, 2048).freq - 1000) < 5);
});

// ---------- WAV ----------
test('WAV: запись и чтение 16 бит, стерео', () => {
  const L = sine(440, 8000, 800, 0.5), R = sine(880, 8000, 800, 0.25);
  const back = Wav.parse(Wav.encode([L, R], 8000));
  assert.equal(back.sampleRate, 8000);
  assert.equal(back.channels.length, 2);
  assert.ok(Math.abs(back.channels[0][100] - L[100]) < 1e-3 && Math.abs(back.channels[1][100] - R[100]) < 1e-3);
  assert.throws(() => Wav.parse(new Uint8Array([1, 2, 3, 4])), /не WAV/);
});

test('WAV: 8 и 24 бита и float32 читаются', () => {
  const mk = (fmtCode, bits, bytes) => {
    const out = new Uint8Array(44 + bytes.length), v = new DataView(out.buffer);
    out.set([82, 73, 70, 70], 0); v.setUint32(4, 36 + bytes.length, true); out.set([87, 65, 86, 69, 102, 109, 116, 32], 8);
    v.setUint32(16, 16, true); v.setUint16(20, fmtCode, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true);
    v.setUint32(28, 8000 * bits / 8, true); v.setUint16(32, bits / 8, true); v.setUint16(34, bits, true);
    out.set([100, 97, 116, 97], 36); v.setUint32(40, bytes.length, true); out.set(bytes, 44);
    return out;
  };
  assert.ok(Math.abs(Wav.parse(mk(1, 8, [128, 255, 0])).channels[0][1] - 127 / 128) < 1e-6);
  assert.ok(Math.abs(Wav.parse(mk(1, 24, [0, 0, 0x40, 0, 0, 0xc0])).channels[0][1] + 0.5) < 1e-6);
  const f32 = new Uint8Array(new Float32Array([0.25, -0.5]).buffer);
  assert.deepEqual(Array.from(Wav.parse(mk(3, 32, f32)).channels[0]), [0.25, -0.5]);
});

// ---------- Спектрограмма ----------
function render(audio, o) {
  const size = o.size || 1024;
  const sp = DSP.stft(audio.samples, { size, hop: o.hop || size / 4, window: 'hann', sampleRate: audio.sampleRate });
  return { sp, img: SpectroRender.render(sp, Object.assign({ autolevel: true, range: 60, cmap: 'gray' }, o)) };
}

test('спектрограмма чирпа: гребень идёт вверх по частоте', () => {
  const a = fixture('synthetic-chirp-300-3000hz.wav');
  const { img } = render({ samples: a.channels[0], sampleRate: a.sampleRate }, { height: 200, fmin: 0, fmax: 4000 });
  const ridge = (x) => { let best = 0; for (let y = 1; y < img.height; y++) if (SpectroRender.luma(img, x, y) > SpectroRender.luma(img, x, best)) best = y; return best; };
  const early = ridge(Math.floor(img.width * 0.1)), mid = ridge(Math.floor(img.width * 0.5)), late = ridge(Math.floor(img.width * 0.9));
  assert.ok(early > mid && mid > late, [early, mid, late].join(','));
  const freqAt = (y) => 4000 * (1 - (y + 0.5) / img.height);
  assert.ok(Math.abs(freqAt(mid) - 1650) < 150, 'середина чирпа ' + freqAt(mid));
});

test('логарифмическая шкала растягивает низкие частоты', () => {
  const x = sine(200, 8000, 16000, 0.5);
  const sp = DSP.stft(x, { size: 2048, hop: 512, window: 'hann', sampleRate: 8000 });
  const row = (scale) => {
    const img = SpectroRender.render(sp, { height: 200, fmin: 50, fmax: 4000, scale, autolevel: true, range: 50, cmap: 'gray' });
    let best = 0;
    for (let y = 1; y < img.height; y++) if (SpectroRender.luma(img, 5, y) > SpectroRender.luma(img, 5, best)) best = y;
    return best / img.height;
  };
  assert.ok(row('log') < row('linear') - 0.2, 'на лог-шкале 200 Гц заметно выше от нижнего края');
});

test('слово PG56, нарисованное в спектрограмме, восстанавливается по картинке', () => {
  const a = fixture('synthetic-spectrogram-text-PG56.wav');
  const info = synth.spectrogramText('PG56');
  const size = 1024, hop = 128;
  const sp = DSP.stft(a.channels[0], { size, hop, window: 'hann', sampleRate: a.sampleRate });
  const img = SpectroRender.render(sp, { height: 350, fmin: 1250, fmax: 3250, scale: 'linear', autolevel: true, range: 40, cmap: 'gray' });
  const frameOfTime = (t) => Math.round((t * a.sampleRate - size / 2) / hop);
  const lead = info.layout.leadMs / 1000, col = info.layout.colMs / 1000;
  const cells = [];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < info.cols; c++) {
      const x = Math.round(frameOfTime(lead + (c + 0.5) * col) * img.width / sp.frames);
      const f = info.layout.topHz - r * info.layout.stepHz;
      const y = Math.round((3250 - f) / 2000 * img.height);
      cells.push({ on: info.rows[r][c] === '1', v: SpectroRender.luma(img, Math.min(img.width - 1, x), y) });
    }
  }
  const on = cells.filter((c) => c.on).map((c) => c.v), off = cells.filter((c) => !c.on).map((c) => c.v);
  const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  const thr = (mean(on) + mean(off)) / 2;
  const correct = cells.filter((c) => (c.v > thr) === c.on).length / cells.length;
  assert.ok(mean(on) > mean(off) + 100, 'контраст ' + mean(on) + ' / ' + mean(off));
  assert.ok(correct > 0.97, 'совпало клеток: ' + correct);
});

test('палитры: разные, из 256 цветов, серая инверсия для OCR тёмным по светлому', () => {
  const inferno = SpectroRender.lut('inferno'), inv = SpectroRender.lut('grayinv');
  assert.equal(inferno.length, 768);
  assert.deepEqual(Array.from(inv.slice(0, 3)), [255, 255, 255]);
  assert.deepEqual(Array.from(inv.slice(765)), [0, 0, 0]);
  assert.throws(() => SpectroRender.lut('нет-такой'), /палитра/);
});

// ---------- Морзе ----------
test('Морзе OLDROOT 700 Гц из WAV-фикстуры: точки/тире и текст', () => {
  const a = fixture('synthetic-morse-OLDROOT-700hz.wav');
  const r = MorseAudio.detect(a.channels[0], a.sampleRate, {});
  assert.ok(r.ok);
  assert.ok(Math.abs(r.freq - 700) < 10, 'частота ' + r.freq);
  assert.equal(r.morse, '--- .-.. -.. .-. --- --- -');
  assert.equal(r.text, 'OLDROOT');
  assert.ok(Math.abs(r.wpm - 20) < 2, 'wpm ' + r.wpm);
  assert.equal(r.unsureCount, 0);
});

test('Морзе: другие скорости, заданная частота и шум', () => {
  for (const [wpm, freq, noise] of [[12, 600, 0.05], [28, 1000, 0.03], [20, 440, 0.1]]) {
    const a = synth.morse('SOS 73', ENCODE, { wpm, freq, noise, sr: 8000 });
    const auto = MorseAudio.detect(a.samples, a.sampleRate, {});
    const fixed = MorseAudio.detect(a.samples, a.sampleRate, { freq });
    assert.equal(auto.text, 'SOS 73', wpm + ' wpm auto');
    assert.equal(fixed.text, 'SOS 73', wpm + ' wpm fixed');
    assert.ok(Math.abs(auto.freq - freq) < 15);
  }
});

test('Морзе: интервал start/end выбирает часть записи', () => {
  const a = synth.morse('CQ TEST', ENCODE, { wpm: 20 });
  const full = MorseAudio.detect(a.samples, a.sampleRate, {});
  assert.equal(full.text, 'CQ TEST');
  const cut = MorseAudio.detect(a.samples, a.sampleRate, { start: 0, end: full.elements.find((e) => e.kind === 'word').start });
  assert.equal(cut.text, 'CQ');
});

test('Морзе: сомнительные элементы получают маркеры', () => {
  const u = 60, f = 700, seg = [[0, 300]];
  const add = (ms) => { seg.push([f, ms, 0.6], [0, u]); };
  [u, 3 * u, u, 2.1 * u, 3 * u, u].forEach(add);   // третий элемент «тире» почти вдвое короче нормы
  const a = { samples: synth.renderTones(seg.concat([[0, 300]]), 8000, 4), sampleRate: 8000 };
  const r = MorseAudio.detect(a.samples, a.sampleRate, {});
  assert.ok(r.unsureCount >= 1);
  assert.match(r.morseMarked, /\?/);
  assert.ok(!/\?/.test(r.morse), 'чистый вывод без маркеров');
});

test('Морзе: тишина и белый шум не дают текста', () => {
  const r = synth.rng(11);
  const noise = Float32Array.from({ length: 16000 }, () => (r() - 0.5) * 0.2);
  assert.equal(MorseAudio.detect(noise, 8000, {}).ok, false);
  assert.throws(() => MorseAudio.detect(new Float32Array(10), 8000, {}), /короткий/);
});

test('Морзе: ручная единица времени и кириллица', () => {
  const a = synth.morse('E', ENCODE, { wpm: 15 });
  const r = MorseAudio.detect(a.samples, a.sampleRate, { unit: 80, lang: 'ru' });
  assert.equal(r.morse, '.');
  assert.equal(r.text, 'Е');
});

// ---------- DTMF ----------
test('DTMF 425822 из WAV-фикстуры', () => {
  const a = fixture('synthetic-dtmf-425822.wav');
  const r = DTMF.detect(a.channels[0], a.sampleRate, {});
  assert.equal(r.digits, '425822');
  assert.equal(r.tones.length, 6);
  assert.equal(r.unsureCount, 0);
});

test('DTMF: все 16 клавиш, шум и повтор одной цифры', () => {
  const keys = '123A456B789C*0#D';
  const a = synth.dtmf(keys, { noise: 0.05 });
  assert.equal(DTMF.detect(a.samples, a.sampleRate, {}).digits, keys);
  const rep = synth.dtmf('1122', { toneMs: 80, pauseMs: 50 });
  assert.equal(DTMF.detect(rep.samples, rep.sampleRate, {}).digits, '1122');
});

test('DTMF: паузы группируют цифры пробелами для мультитапа', () => {
  const a = synth.dtmf('44 33 555');
  assert.equal(DTMF.detect(a.samples, a.sampleRate, { groupGapMs: 400 }).digits, '44 33 555');
  assert.equal(DTMF.detect(a.samples, a.sampleRate, {}).digits, '4433555');
});

test('DTMF: одиночный тон, речь-подобный шум и тишина не дают цифр', () => {
  assert.equal(DTMF.detect(sine(697, 8000, 8000, 0.5), 8000, {}).digits, '');
  const r = synth.rng(5), noise = Float32Array.from({ length: 16000 }, () => (r() - 0.5) * 0.6);
  assert.equal(DTMF.detect(noise, 8000, {}).digits, '');
  assert.equal(DTMF.detect(new Float32Array(8000), 8000, {}).digits, '');
});

// ---------- SSTV ----------
function meanError(decoded, src, lines) {
  let sum = 0, n = 0;
  for (let y = 0; y < lines; y++) {
    for (let x = 6; x < src.width - 6; x++) {
      for (let c = 0; c < 3; c++) { sum += Math.abs(decoded.image.data[(y * src.width + x) * 4 + c] - src.data[(y * src.width + x) * 4 + c]); n++; }
    }
  }
  return sum / n;
}

for (const [key, lines, sr] of [['robot36', 60, 11025], ['martin1', 40, 11025], ['scottie1', 40, 11025], ['martin2', 40, 8000]]) {
  test('SSTV ' + key + ': VIS, режим и картинка (синтетический сигнал)', () => {
    const m = SSTV.MODES[key];
    const src = synth.testImage(m.width, m.height);
    const a = synth.sstv(SSTV.MODES, key, src, sr, lines, { noise: 0.02 });
    const r = SSTV.decode(a.samples, a.sampleRate, {});
    assert.equal(r.modeKey, key);
    assert.equal(r.vis, m.vis);
    assert.equal(r.parityOk, true);
    assert.equal(r.lines, lines);
    assert.equal(r.missed, 0);
    const err = meanError(r, src, lines);
    assert.ok(err < 12, 'средняя ошибка ' + err.toFixed(1));
  });
}

test('SSTV: сдвиг частоты кварца компенсируется по лидеру', () => {
  const m = SSTV.MODES.martin1, src = synth.testImage(m.width, m.height);
  const a = synth.sstv(SSTV.MODES, 'martin1', src, 11025, 30, { freqShift: 45 });
  const r = SSTV.decode(a.samples, a.sampleRate, {});
  assert.ok(Math.abs(r.freqOffset - 45) < 15, 'смещение ' + r.freqOffset);
  assert.ok(meanError(r, src, 30) < 12);
});

test('SSTV: без VIS режим выбирается по периоду строк, вручную — тоже можно', () => {
  const m = SSTV.MODES.martin1, src = synth.testImage(m.width, m.height);
  const a = synth.sstv(SSTV.MODES, 'martin1', src, 11025, 30);
  const cut = a.samples.subarray(Math.round(1.2 * 11025));
  const auto = SSTV.decode(cut, 11025, {});
  assert.equal(auto.modeKey, 'martin1');
  assert.equal(auto.detectedBy, 'period');
  assert.equal(auto.missed, 0);   // отрезок короче картинки: качество считается от полной высоты, пропусков нет
  assert.ok(auto.warnings.some((w) => /VIS/.test(w)));
  assert.ok(meanError(auto, src, 29) < 12);
  const r = SSTV.decode(cut, 11025, { mode: 'martin1' });
  assert.equal(r.vis, null);
  assert.ok(r.warnings.length >= 1);
  assert.ok(meanError(r, src, 29) < 12);
});

test('SSTV: шум без сигнала даёт ошибку, а не картинку', () => {
  const r = synth.rng(9), noise = Float32Array.from({ length: 44100 }, () => (r() - 0.5) * 0.4);
  assert.throws(() => SSTV.decode(noise, 11025, {}), /VIS/);
  assert.throws(() => SSTV.decode(noise, 4000, {}), /8 кГц/);
});

// ---------- Файлы ----------
test('фикстуры подписаны как синтетические и читаются', () => {
  const names = fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.wav'));
  assert.ok(names.length >= 4);
  for (const n of names) assert.match(n, /^synthetic-/, n);
  assert.ok(fixture('synthetic-dtmf-425822.wav').duration > 1);
});

test('браузерные файлы пакета разбираются без синтаксических ошибок', () => {
  for (const f of fs.readdirSync(MEDIA).filter((x) => x.endsWith('.js'))) {
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(path.join(MEDIA, f), 'utf8'), { filename: f }), f);
  }
});

// ---------- Видео: арифметика кадров ----------
test('кадры видео: время середины кадра и обратный перевод', () => {
  assert.ok(Math.abs(VideoMath.frameToTime(0, 25) - 0.02) < 1e-9);
  for (const fps of [24, 25, 29.97, 30, 60]) for (const f of [0, 1, 7, 100, 1234]) assert.equal(VideoMath.timeToFrame(VideoMath.frameToTime(f, fps), fps), f);
  assert.throws(() => VideoMath.frameToTime(1, 0), /Частота кадров/);
  assert.equal(VideoMath.frameCount(10, 30), 300);
});

test('контактный лист: кадры через N, лимит и раскладка', () => {
  assert.deepEqual(Array.from(VideoMath.sheetFrames(0, 100, 25, 48)), [0, 25, 50, 75, 100]);
  assert.equal(VideoMath.sheetFrames(0, 100000, 1, 1000).length, VideoMath.MAX_SHEET_FRAMES);
  assert.throws(() => VideoMath.sheetFrames(0, 10, 0), /Шаг/);
  assert.throws(() => VideoMath.sheetFrames(50, 10, 5), /нет кадров/);
  const lay = VideoMath.sheetLayout(7, 3, 160, 90, 14);
  assert.equal(lay.rows, 3);
  assert.equal(lay.width, 480);
  assert.equal(lay.height, 3 * 104);
  assert.deepEqual({ ...lay.at(4) }, { x: 160, y: 104 });
});

// ---------- Ноды ----------
const defaults = (type, over) => ({ ...Object.fromEntries(NT[type].params.map((q) => [q.key, q.default])), ...over });
const node = () => ({ id: 'n1', state: {} });
function audioHandle(key, audio) {
  return A.handle(A.addDerived(key, 'audio', { sampleRate: audio.sampleRate, channels: [audio.samples] }, { name: key + '.wav' }));
}

test('ноды пакета зарегистрированы в категории «Звук и видео» и описаны на двух языках', () => {
  for (const type of ['spectrogram', 'morse_audio', 'dtmf_audio', 'sstv_audio', 'video_frames']) {
    const d = NT[type];
    assert.ok(d, type);
    assert.equal(d.cat, 'Звук и видео');
    assert.ok(d.name && d.desc && d.inputs.length === 1);
    for (const q of d.params) assert.ok(q.key && q.type && 'default' in q, type + '.' + q.key);
  }
});

test('нода Морзе: точки/тире, текст и ошибка на шуме', () => {
  const h = audioHandle('t_morse', synth.morse('SOS', ENCODE, { wpm: 20 }));
  assert.equal(NT.morse_audio.compute([h], defaults('morse_audio'), node()), '... --- ...');
  assert.equal(NT.morse_audio.compute([h], defaults('morse_audio', { out: 'text' }), node()), 'SOS');
  assert.match(NT.morse_audio.compute([h], defaults('morse_audio', { out: 'report' }), node()), /WPM/);
  const r = synth.rng(2);
  const noise = audioHandle('t_noise', { sampleRate: 8000, samples: Float32Array.from({ length: 16000 }, () => (r() - 0.5) * 0.2) });
  assert.throws(() => NT.morse_audio.compute([noise], defaults('morse_audio'), node()), /тона/);
});

test('нода DTMF: цифры и группировка пробелами', () => {
  const h = audioHandle('t_dtmf', synth.dtmf('425822'));
  assert.equal(NT.dtmf_audio.compute([h], defaults('dtmf_audio'), node()), '425822');
  const g = audioHandle('t_dtmf2', synth.dtmf('44 33'));
  assert.equal(NT.dtmf_audio.compute([g], defaults('dtmf_audio', { groupGap: 400 }), node()), '44 33');
});

test('нода SSTV: возвращает картинку-артефакт 320×256', () => {
  const m = SSTV.MODES.martin2, src = synth.testImage(m.width, m.height);
  const h = audioHandle('t_sstv', synth.sstv(SSTV.MODES, 'martin2', src, 8000, 12));
  const out = NT.sstv_audio.compute([h], defaults('sstv_audio'), node());
  assert.ok(A.isHandle(out));
  const art = A.get(A.idOf(out));
  assert.equal(art.kind, 'image');
  assert.equal(art.width, 320);
});

test('нода спектрограммы: картинка и WAV выделения как артефакты', () => {
  const a = fixture('synthetic-spectrogram-text-PG56.wav');
  const h = audioHandle('t_spec', { sampleRate: a.sampleRate, samples: a.channels[0] });
  const n = node();
  const img = NT.spectrogram.compute([h], defaults('spectrogram', { selA: 0.2, selB: 0.8 }), n);
  const art = A.get(A.idOf(img));
  assert.equal(art.kind, 'image');
  assert.equal(art.height, 512);
  assert.ok(art.width >= 600, 'ширина ' + art.width);
  assert.equal(NT.spectrogram.compute([h], defaults('spectrogram', { selA: 0.2, selB: 0.8 }), n), img, 'кэш по параметрам');
  const wav = NT.spectrogram.compute([h], defaults('spectrogram', { out: 'audio', selA: 0.2, selB: 0.7 }), n);
  const w = A.runtimeGet(A.idOf(wav));
  assert.equal(A.get(A.idOf(wav)).kind, 'audio');
  assert.ok(Math.abs(w.channels[0].length / w.sampleRate - 0.5) < 0.01);
});

test('аудио-ноды: неверный тип артефакта и асинхронное декодирование WAV', async () => {
  const pic = A.handle(A.addDerived('t_pic', 'image', null, { name: 'x.png' }));
  assert.throws(() => NT.spectrogram.compute([pic], defaults('spectrogram'), node()), /аудио- или видеофайл/);
  const bytes = Wav.encode([sine(440, 8000, 8000, 0.5)], 8000);
  const h = A.handle(A.addDerived('t_raw', 'audio', null, { name: 'raw.wav', dataUrl: 'data:audio/wav;base64,' + Wav.toBase64(bytes) }));
  const n = node();
  let pending = null;
  try { NT.dtmf_audio.compute([h], defaults('dtmf_audio'), n); } catch (e) { pending = e; }
  assert.ok(pending && pending.pending, 'сначала «декодирую…»');
  await n.state.wait;
  assert.throws(() => NT.dtmf_audio.compute([h], defaults('dtmf_audio'), n), /DTMF-тонов не найдено/);
});
