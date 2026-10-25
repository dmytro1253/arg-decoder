// Приёмка на оригинальных материалах завершённых ARG (аудит 2026-10-23). Файлы не входят в репозиторий:
// путь задаёт ARGDEC_ORIGINALS (папка аудита с sources/ и outputs/); без неё тесты пропускаются.
// MP3 в аудите переведён в PCM ffmpeg только как адаптер (в браузере это делает WebAudio); декодирует код приложения.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadFull } = require('./load');

const DIR = process.env.ARGDEC_ORIGINALS || path.join(__dirname, '..', '..', 'work', 'arg-extra-audit-2026-10-23');
const has = (rel) => fs.existsSync(path.join(DIR, rel));
const ctx = loadFull('en');
if (has('outputs')) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'web', 'vendor', 'jsqr', 'jsQR.js'), 'utf8'), ctx);

function rgba(rel) {
  const b = fs.readFileSync(path.join(DIR, rel));
  return { width: b.readUInt32LE(0), height: b.readUInt32LE(4), data: new Uint8ClampedArray(b.buffer.slice(b.byteOffset + 8, b.byteOffset + b.length)) };
}

test('SSTV: три оригинальных MP3 Dr. Langeskov декодируются без ручного выбора режима', { skip: !has('outputs/langeskov-boot.mp3.pcm.wav') }, () => {
  for (const name of ['boot', 'signature', '74647075756a66']) {
    const a = ctx.Wav.parse(new Uint8Array(fs.readFileSync(path.join(DIR, 'outputs', 'langeskov-' + name + '.mp3.pcm.wav'))));
    const r = ctx.SSTV.decode(ctx.DSP.mixdown(a.channels, 'mono'), a.sampleRate, { mode: 'auto' });
    assert.equal(r.modeKey, 'scottie1', name);
    assert.equal(r.detectedBy, 'period', name);
    assert.equal(r.lines, 256, name);
    assert.ok(r.quality >= 0.9, name + ' quality ' + r.quality);
  }
});

test('QR: тёмный QR 76543 со стёртыми ориентирами читается восстановлением, фото тайника — напрямую', { skip: !has('outputs/76543-dark.png.rgba') }, () => {
  const dark = ctx.Qr.decodeQr(rgba('outputs/76543-dark.png.rgba'));
  assert.ok(dark && dark.repaired, 'нужна пометка о восстановлении');
  assert.equal(dark.text, 'Your key is primes');
  const photo = ctx.Qr.decodeQr(rgba('outputs/76543-physical-qr.png.rgba'));
  assert.equal(photo.text, 'Oh hello. Say my name.');
  assert.ok(!photo.repaired);
});

test('архив: настоящий RAR Killing Floor 2 — понятная диагностика зашифрованных заголовков', { skip: !has('sources/kf2-Package.rar') }, () => {
  const bytes = new Uint8Array(fs.readFileSync(path.join(DIR, 'sources', 'kf2-Package.rar')));
  assert.throws(() => ctx.ArgFiles.Archive.open(bytes), /password-encrypted|зашифрованы паролем/);
});

test('склейка: половины PDF Dr. Langeskov дают целый PDF с совпадающей заявленной длиной', { skip: !has('sources/langeskov-cipresso.wav') }, async () => {
  const A = ctx.Artifacts;
  const part = async (name, mime) => A.addDataUrl('data:' + mime + ';base64,' + fs.readFileSync(path.join(DIR, 'sources', name)).toString('base64'), name, mime);
  const a = await part('langeskov-garden-landscaping.pdfaa', 'application/octet-stream');
  const b = await part('langeskov-cipresso.wav', 'audio/wav');
  const node = { state: {} };
  const handle = ctx.NodeTypes.file_concat.compute([A.handle(a), A.handle(b)], { name: '' }, node);
  const bytes = ctx.ArgFiles.artifactBytes(handle);
  assert.equal(bytes.length, 924346);
  assert.equal(node.state.info.fmt, 'PDF');
  assert.equal(Buffer.from(bytes.subarray(bytes.length - 6)).toString('latin1').trim(), '%%EOF');
});
