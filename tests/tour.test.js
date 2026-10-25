// Тур по нодам (presets-tour.js): по одному примеру на операцию и на каждую ноду звука, картинок и файлов.
// Каждый пример даёт свой ответ на обоих языках; звук и файлы разбираются на настоящих образцах из web/samples;
// и каждая нода программы есть хотя бы в одном примере.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadFull } = require('./load');

const SAMPLES = path.join(__dirname, '..', 'web', 'samples');
// Без настоящего видеофайла (образец раздул бы репозиторий) — нода покадрового просмотра проверяется в media.test.js.
const NOT_IN_EXAMPLES = new Set(['video_frames']);
// Служебные ноды, которые не показывают отдельной функции.
const SERVICE = new Set(['input', 'view', 'note', 'artifact']);
// Пиксели картинок, метаданные PNG и 7-Zip (WebAssembly) — только в браузере; эти примеры здесь лишь загружаются.
const BROWSER_ONLY = new Set(['tour-lsb', 'tour-bit-plane', 'tour-xor-images', 'tour-png-meta', 'tour-rar-password']);

function sample(id) {
  const box = { self: {} };
  vm.runInNewContext(fs.readFileSync(path.join(SAMPLES, id + '.js'), 'utf8'), box);
  return box.self.ArgSamples[id];
}

/** Граф примера с образцами-артефактами; звук декодируется заранее, как это делает браузер при открытии. */
async function evaluate(ctx, preset) {
  const nodes = [];
  for (const n of preset.nodes) {
    if (!(n.params && n.params.sample)) { nodes.push(n); continue; }
    const s = sample(n.params.sample);
    const id = await ctx.Artifacts.addDataUrl('data:' + s.mime + ';base64,' + s.data, s.name, s.mime);
    if (ctx.Artifacts.get(id).kind === 'audio') await ctx.AudioIO.load(ctx.Artifacts.handle(id));
    nodes.push({ ...n, params: { artifact: id } });
  }
  const g = new ctx.Graph();
  const report = g.load({ nodes, links: preset.links });
  assert.equal(report.skipped.length, 0, preset.id + ': пропущены ноды');
  assert.equal(report.warnings.length, 0, preset.id + ': ' + report.warnings.map((w) => w.message).join('; '));
  return { g, res: g.evaluate() };
}

const values = (res) => [...res.values()].map((r) => r.value).filter((v) => typeof v === 'string');

for (const lang of ['ru', 'en']) {
  const ctx = loadFull(lang);
  // Без браузера: картинка SSTV кладётся в хранилище как пиксели, превью-холст не нужен.
  ctx.ImageData = ctx.ImageData || class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } };
  const tour = ctx.Presets.filter((p) => p.id.startsWith('tour-'));

  test(`[${lang}] тур: отдельный пример на каждую технику, с заметкой, ответом и нодой «Результат»`, () => {
    assert.ok(tour.length >= 95, 'примеров ' + tour.length);
    const ids = new Set();
    for (const p of tour) {
      assert.ok(!ids.has(p.id), 'повтор ' + p.id);
      ids.add(p.id);
      assert.ok(p.title && p.desc && p.manual && p.group, p.id);
      assert.ok(p.nodes.some((n) => n.type === 'note'), p.id + ': нет заметки');
      assert.ok(p.nodes.some((n) => n.type === 'view'), p.id + ': нет ноды «Результат»');
      assert.ok(p.expect || p.expectContains || p.expectBrowser, p.id + ': не указан ответ');
      assert.ok(p.nodes.length <= 12, p.id + ': слишком много нод для одного примера (' + p.nodes.length + ')');
    }
  });

  for (const preset of tour.filter((p) => !BROWSER_ONLY.has(p.id))) {
    test(`[${lang}] тур «${preset.id}»: вычисляется и даёт свой ответ`, async () => {
      const { g, res } = await evaluate(ctx, preset);
      for (const [id, r] of res) assert.equal(r.error, null, `${preset.id}: нода ${id} (${g.nodes.get(id).type}): ${r.error}`);
      for (const want of preset.expect || []) assert.ok(values(res).includes(want), `${preset.id}: нет «${want}»: ${values(res).join(' | ').slice(0, 300)}`);
      for (const part of preset.expectContains || []) assert.ok(values(res).some((v) => v.includes(part)), `${preset.id}: нет фрагмента «${part}»`);
    });
  }

  for (const preset of tour.filter((p) => BROWSER_ONLY.has(p.id))) {
    test(`[${lang}] тур «${preset.id}»: загружается (вычисляется в браузере)`, async () => { await evaluate(ctx, preset); });
  }
}

test('каждая операция и каждая нода программы есть хотя бы в одном примере', () => {
  const ctx = loadFull('en');
  const used = new Set();
  for (const p of ctx.Presets) for (const n of p.nodes || []) used.add(n.type);
  const ops = ctx.CipherOps.OPS.map((o) => 'op:' + o.id).filter((t) => !used.has(t));
  assert.equal(ops.join(', '), '', 'операции без примера');
  const special = Object.keys(ctx.NodeTypes).filter((t) => typeof ctx.NodeTypes[t] === 'object' && ctx.NodeTypes[t].compute
    && !SERVICE.has(t) && !NOT_IN_EXAMPLES.has(t) && !used.has(t));
  assert.equal(special.join(', '), '', 'ноды без примера');
});

test('образцы звука совпадают с генератором (tools/make_tour_samples.js)', () => {
  const built = require('../tools/make_tour_samples.js').build();
  for (const [id, text] of Object.entries(built)) assert.equal(fs.readFileSync(path.join(SAMPLES, id + '.js'), 'utf8'), text, id);
});
