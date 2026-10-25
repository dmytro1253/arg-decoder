// Примеры с картинками: образцы на месте и совпадают с фикстурами, нода «Файл» получает артефакт;
// перевод ответов сервера для английского интерфейса.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadFull } = require('./load');

const WEB = path.join(__dirname, '..', 'web');
const ctx = loadFull('en');
const images = ctx.Presets.filter((p) => ctx.Samples.needs(p));

function sampleData(id) {
  const box = { self: {} };
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(WEB, 'samples', id + '.js'), 'utf8'), box);
  return box.self.ArgSamples[id];
}

test('примеры с картинками есть, у каждого причина manual и заметка об источнике', () => {
  assert.deepEqual([...images.map((p) => p.id)].sort(), ['audio-spectrogram', 'dl-sstv', 'img-book-digits', 'img-sga-key', 'img-sga-poem', 'img-vrfneo', 'tour-bit-plane', 'tour-dtmf', 'tour-lsb', 'tour-morse-audio', 'tour-png-meta', 'tour-rar-password', 'tour-sstv', 'tour-strings', 'tour-xor-images', 'tour-zip-in-png']);
  for (const p of images) {
    assert.ok(typeof p.manual === 'string' && p.manual.length > 15, p.id);
    assert.ok(p.nodes.some((n) => n.type === 'note' && /Source:/.test(n.params.text)), p.id);
  }
});

test('образцы в web/samples совпадают с фикстурами тестов', () => {
  const pairs = { 'sga-poem': 'photo_2026-08-02_14-24-45.jpg', 'sga-key': 'photo_2026-10-18_23-16-05.jpg', vrfneo: 'vrfneo.jpg', 'book-digits': 'mslan-book-digits.jpg' };
  for (const [id, fixture] of Object.entries(pairs)) {
    const s = sampleData(id);
    assert.equal(s.mime, 'image/jpeg');
    assert.ok(Buffer.from(s.data, 'base64').equals(fs.readFileSync(path.join(__dirname, 'fixtures', fixture))), id);
  }
  const wav = sampleData('spectro-pg56');
  assert.equal(wav.mime, 'audio/wav');
  assert.ok(Buffer.from(wav.data, 'base64').equals(fs.readFileSync(path.join(__dirname, 'fixtures', 'audio', 'synthetic-spectrogram-text-PG56.wav'))));
});

test('resolve подставляет артефакт вместо params.sample и не меняет исходный пример', async () => {
  const preset = images.find((p) => p.id === 'img-sga-poem');
  const before = JSON.stringify(preset.nodes);
  ctx.ArgSamples = { 'sga-poem': sampleData('sga-poem') };
  const added = [];
  const realAdd = ctx.Artifacts.addDataUrl;
  ctx.Artifacts.addDataUrl = async (url, name) => { added.push(name); return 'a-test'; };
  try {
    const nodes = await ctx.Samples.resolve(preset);
    const art = nodes.find((n) => n.type === 'artifact');
    assert.equal(art.params.artifact, 'a-test');
    assert.equal(art.params.sample, undefined);
    assert.deepEqual([...added], ['sga-poem.jpg']);
    assert.equal(JSON.stringify(preset.nodes), before);
    assert.equal(ctx.Samples.needs({ nodes }), false);
  } finally {
    ctx.Artifacts.addDataUrl = realAdd;
  }
});

test('load отвергает имена образцов с путями', async () => {
  await assert.rejects(ctx.Samples.load('../x'), /sample name/);
});

test('ответы сервера переводятся в английском интерфейсе, неизвестные остаются как есть', () => {
  const s = ctx.I18n.server;
  assert.equal(s('готова'), 'ready');
  assert.equal(s('кэш'), 'cache');
  assert.equal(s('Параметр top должен быть от 1 до 50'), 'Parameter top must be from 1 to 50');
  assert.equal(s('Нет связи: timeout'), 'No connection: timeout');
  assert.equal(s('что-то новое'), 'что-то новое');
  assert.equal(s(undefined), undefined);
  ctx.I18n.lang = 'ru';
  try { assert.equal(s('готова'), 'готова'); } finally { ctx.I18n.lang = 'en'; }
});
