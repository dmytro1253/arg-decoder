// Тесты модели графа: соединения, циклы, загрузка файлов.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadEngine } = require('./load');

const { ctx } = loadEngine();
ctx.NodeTypes = { input: { name: 'Ввод', inputs: [], params: [{ key: 'text', default: '' }], compute: (_, p) => p.text } };

function chain() {
  const g = new ctx.Graph();
  const a = g.addNode('input', 0, 0, { text: 'h2njbrLB5kj' });
  const b = g.addNode('op:vigenere', 0, 0, { key: 'yfqlbvtyz' });
  const c = g.addNode('op:reverse', 0, 0);
  return { g, a, b, c };
}

test('связь, создающая цикл, запрещена', () => {
  const { g, b, c } = chain();
  assert.ok(g.connect(b.id, c.id, 0));
  assert.equal(g.connect(c.id, b.id, 0), false);
});

test('одна нода может питать и вход, и порт ключа', () => {
  const { g, a, b } = chain();
  assert.ok(g.connect(a.id, b.id, 0));
  assert.ok(g.connect(a.id, b.id, 1));
});

test('вычисление цепочки', () => {
  const { g, a, b } = chain();
  g.connect(a.id, b.id, 0);
  assert.equal(g.evaluate().get(b.id).value, 'j2itqqQI5mk');
});

test('битый файл не портит текущий граф', () => {
  const { g } = chain();
  assert.throws(() => g.load(null));
  assert.throws(() => g.load({ links: [] }));
  assert.equal(g.nodes.size, 3);
  g.load({ nodes: [{ id: 'n1', type: 'input', x: 'abc' }, { id: 'n2' }, { id: 'n3', type: 'нет такой' }], links: [{ from: 'n1', to: 'zz' }] });
  assert.equal(g.nodes.size, 1);
  assert.equal(g.nodes.get('n1').x, 0);
  assert.equal(g.links.length, 0);
});

test('URL-декодирование не падает на одном неверном куске UTF-8', () => {
  const op = ctx.CipherOps.BY_ID.url_decode;
  assert.equal(op.run(['a%C2b%D0%B0'], { enc: 'utf8', plus: true }), 'a%C2bа');
});
