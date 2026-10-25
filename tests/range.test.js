// Параметры-ползунки (type: 'range'): проверка при загрузке графа, границы в описаниях нод, совместимость со старыми проектами.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFull } = require('./load');

const ctx = loadFull('ru');
const CO = ctx.CipherOps;
const RP = ctx.RangeParam;

const rangeParams = () => Object.entries(ctx.NodeTypes).flatMap(([type, def]) => (def.params || []).filter((p) => p.type === 'range').map((p) => ({ type, p })));
const loaded = (type, params) => {
  const g = new ctx.Graph();
  g.load({ version: 2, nodes: [{ id: 'n1', type, x: 0, y: 0, params }], links: [] });
  return g;
};

test('RangeParam: границы и подпись значения по шагу', () => {
  assert.equal(RP.clamp(500, -255, 255), 255);
  assert.equal(RP.clamp(-9, 0, 5), 0);
  assert.equal(RP.format(1, 0.05), '1.00');
  assert.equal(RP.format(-12, 1), '−12');
  assert.equal(RP.format(0.3, 0.1), '0.3');
});

test('range проверяется как number с min/max', () => {
  const schema = [{ key: 'v', label: 'V', type: 'range', min: 0, max: 10, step: 1, int: true, default: 5 }];
  assert.equal(CO.normalizeParams(schema, { v: 7 }).values.v, 7);
  assert.equal(CO.normalizeParams(schema, { v: '7' }).values.v, 7, 'число строкой из старого проекта');
  for (const bad of [11, -1, 2.5, 'abc', NaN, null]) {
    const r = CO.normalizeParams(schema, { v: bad });
    assert.equal(r.values.v, 5, String(bad) + ' → значение по умолчанию');
    assert.equal(r.problems.length, 1);
  }
  assert.equal(CO.normalizeParams(schema, {}).values.v, 5);
});

test('загрузка графа: ползунок вне границ заменяется значением по умолчанию с предупреждением', () => {
  const g = loaded('img_adjust', { brightness: 9999, contrast: 30, gamma: '2' });
  const n = g.nodes.get('n1');
  assert.equal(n.params.brightness, 0);
  assert.equal(n.params.contrast, 30);
  assert.equal(n.params.gamma, 2);
  assert.ok(g.loadReport.warnings.some((w) => w.kind === 'param' && w.key === 'brightness'));
});

test('совместимость: бит плоскости, сохранённый строкой "3", читается', () => {
  const n = loaded('img_bits', { name: 'g', bit: '3' }).nodes.get('n1');
  assert.equal(n.params.bit, 3);
  assert.equal(loaded('img_bits', { name: 'g' }).nodes.get('n1').params.bit, 0);
});

test('все ползунки в реестре заданы корректно', () => {
  const all = rangeParams();
  assert.ok(all.length >= 18, 'ползунков: ' + all.length);
  for (const { type, p } of all) {
    const id = type + '.' + p.key;
    assert.ok(Number.isFinite(p.min) && Number.isFinite(p.max) && p.min < p.max, id + ': min < max');
    assert.ok(p.step > 0 && p.step <= p.max - p.min, id + ': шаг');
    assert.ok(p.default >= p.min && p.default <= p.max, id + ': значение по умолчанию в границах');
    assert.ok(p.label && p.label.length > 2, id + ': подпись');
    assert.equal(CO.normalizeParams([p], { [p.key]: p.default }).problems.length, 0, id);
  }
  const keysOf = (t) => rangeParams().filter((x) => x.type === t).map((x) => x.p.key);
  assert.deepEqual(keysOf('img_adjust').sort(), ['black', 'brightness', 'contrast', 'gamma', 'lift', 'thrLevel', 'white']);
  assert.ok(keysOf('spectrogram').includes('range') && keysOf('spectrogram').includes('gamma'));
});

test('ползунок на основном экране: есть двойной щелчок-сброс и requestEvalFrame', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'web', 'js', 'graph-view.js'), 'utf8');
  assert.ok(src.includes("p.type === 'range'") && src.includes("addEventListener('dblclick'") && src.includes('requestEvalFrame'));
});
