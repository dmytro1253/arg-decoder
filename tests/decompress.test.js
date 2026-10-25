// Распаковка zlib / gzip / raw deflate: форматы, предел размера, контрольные суммы, файлы, связность графа
// (Base64 → XOR с ключом со второго входа → распаковка → UTF-8) и слепой Auto. Данные — от Python (fixtures).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFull } = require('./load');
const FX = require('./fixtures/compress-chains.json');

const G = loadFull('en');
const op = G.CipherOps.BY_ID.decompress;
const bin = (b64) => Buffer.from(b64, 'base64').toString('latin1');
const utf8 = (s) => Buffer.from(s, 'latin1').toString('utf8');
const run = (v, p) => op.run([v], Object.assign({ format: 'auto', maxMb: 16, strict: true }, p));

test('форматы: авто по заголовку и ручной выбор (zlib, gzip, raw)', () => {
  assert.equal(utf8(run(bin(FX.small.zlib))), FX.small.text);
  assert.equal(utf8(run(bin(FX.small.gzip))), FX.small.text);
  assert.equal(utf8(run(bin(FX.small.zlib), { format: 'zlib' })), FX.small.text);
  assert.equal(utf8(run(bin(FX.small.gzip), { format: 'gzip' })), FX.small.text);
  assert.throws(() => run(bin(FX.small.gzip), { format: 'zlib' }), /zlib/);
  assert.throws(() => run('plain text, not compressed'), /deflate|сжат/i);
});

test('предел размера результата защищает от «бомбы» (3 МБ нулей из 4 КБ)', () => {
  assert.throws(() => run(bin(FX.bomb_zlib_b64), { maxMb: 1 }), /слишком велик|too large/i);
  assert.equal(run(bin(FX.bomb_zlib_b64), { maxMb: 4 }).length, 3 * 1048576);
  assert.throws(() => run(bin(FX.small.zlib), { maxMb: 0 }), /МБ|MB/);
});

test('контрольная сумма: испорченный zlib — ошибка в строгом режиме, предупреждение в мягком', () => {
  const b = Buffer.from(FX.small.zlib, 'base64');
  b[b.length - 1] ^= 1;   // испорчена только Adler-32: данные распаковываются
  const broken = b.toString('latin1');
  assert.throws(() => run(broken), /контрольная сумма|checksum/i);
  const node = { state: { warnings: [] } };
  assert.equal(utf8(op.run([broken], { format: 'auto', maxMb: 16, strict: false }, node)), FX.small.text);
});

test('файл-артефакт: распаковка и XOR читают байты файла, а не текст ручки', async () => {
  const A = G.Artifacts;
  const raw = Buffer.from(FX.xor_zlib.b64, 'base64');
  const id = await A.addDataUrl('data:application/octet-stream;base64,' + raw.toString('base64'), 'clue.bin', 'application/octet-stream');
  const handle = A.handle(id);
  const x = G.CipherOps.BY_ID.xor.run([handle], { key: FX.xor_zlib.key, fmt: 'hex', enc: 'auto', strict: true });
  assert.equal(utf8(run(x)), FX.xor_zlib.text);
  const gid = await A.addDataUrl('data:application/gzip;base64,' + FX.small.gzip, 'clue.gz', 'application/gzip');
  assert.equal(utf8(run(A.handle(gid))), FX.small.text);
});

test('граф: Base64 → XOR (ключ со второго входа) → распаковка → UTF-8', () => {
  const g = new G.Graph();
  const input = g.addNode('input', 0, 0); input.params.text = FX.xor_zlib.b64;
  const key = g.addNode('input', 0, 100); key.params.text = FX.xor_zlib.key;
  const b64 = g.addNode('op:base64_decode', 200, 0);
  const xor = g.addNode('op:xor', 400, 0); xor.params.fmt = 'hex';
  const inf = g.addNode('op:decompress', 600, 0);
  const txt = g.addNode('op:bytes_decode', 800, 0); txt.params.enc = 'utf8';
  g.connect(input.id, b64.id, 0);
  g.connect(b64.id, xor.id, 0);
  g.connect(key.id, xor.id, 1);
  g.connect(xor.id, inf.id, 0);
  g.connect(inf.id, txt.id, 0);
  const res = g.evaluate();
  assert.equal(res.get(txt.id).error, null);
  assert.equal(res.get(txt.id).value, FX.xor_zlib.text);
});

test('Auto вслепую: Base64/HEX → (XOR) → zlib/gzip/raw → UTF-8, ключ XOR выводится из заголовка', async () => {
  for (const c of FX.chains) {
    G.Profiles.setActive('neutral');
    G.KeyBank.clear();
    const res = await G.Solver.solve(c.input, { depth: 3, beam: 160, timeLimit: 20000, engines: false });
    assert.equal(res[0].text, c.expect, c.id);
    // С заголовком и контрольной суммой — уверенно; сырой deflate без заголовка под XOR — не выше «вероятно».
    if (/raw/.test(c.id) && /xor/.test(c.id)) assert.notEqual(res[0].status, 'confident', c.id);
    else assert.equal(res[0].status, 'confident', c.id);
  }
});
