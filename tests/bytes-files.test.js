// Байты, файлы и переходы между ними (аудит 2026-10-23): XOR одинаков в графе и авто-поиске,
// общий разбор ключа XOR, точная разметка книжного шифра, сохранение кадров видео, склейка файлов, биты → картинка.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFull } = require('./load');

const ctx = loadFull('en');
const op = (id) => ctx.CipherOps.BY_ID[id];
const defaults = (id) => Object.fromEntries(op(id).params.map((p) => [p.key, p.default]));
const run = (id, input, params = {}) => op(id).run(Array.isArray(input) ? input : [input], { ...defaults(id), ...params });
const hexOf = (s) => Buffer.from(s, 'latin1').toString('hex');
const latin1 = (buf) => Buffer.from(buf).toString('latin1');

test('авто-поиск применяет XOR с теми же значениями по умолчанию, что граф (UTF-8 сохраняется)', async () => {
  const plain = 'the quick brown fox sees a small café near the river bank';
  const cipher = Buffer.from(plain, 'utf8').map((b) => b ^ 23);
  ctx.Profiles.setActive('neutral');
  ctx.KeyBank.clear();
  const res = await ctx.Solver.solve(Buffer.from(cipher).toString('hex'), { depth: 3, beam: 160, timeLimit: 30000 });
  const hit = res.find((r) => r.text === plain);
  assert.ok(hit, 'нет точного открытого текста; сверху: ' + res.slice(0, 3).map((r) => r.text).join(' | '));
  assert.ok(hit.chain.some((c) => c.op === 'xor'));
  // Тот же шаг в графе даёт те же байты.
  const graph = run('xor', run('hex_decode', Buffer.from(cipher).toString('hex')), { key: '23', fmt: 'num' });
  assert.equal(Buffer.from(graph, 'latin1').toString('utf8'), plain);
});

test('XOR с пропуском знаков: тот же строгий разбор ключа, что у обычного XOR', () => {
  assert.throws(() => run('xor_keep', 'AB', { key: 'bad', fmt: 'num' }), /not an integer|не целое/);
  assert.throws(() => run('xor_keep', 'AB', { key: '1f2', fmt: 'hex', strict: true }), /Odd|Нечётное/);
  assert.equal(hexOf(run('xor', 'AB', { key: '1f2', fmt: 'hex' })), hexOf(run('xor_keep', 'AB', { key: '1f2', fmt: 'hex', keep: 'none' })));
});

test('XOR с пропуском пробелов, точек и запятых сохраняет их в байтовой строке, а UTF-8 байты шифрует', () => {
  const plain = Buffer.from('la canción. sí', 'utf8');
  const cipher = latin1(plain.map((b) => (/[\s.,]/.test(String.fromCharCode(b)) ? b : b ^ 23)));
  const out = run('xor_keep', cipher, { key: '23', fmt: 'num', keep: 'asciipunct' });
  assert.equal(Buffer.from(out, 'latin1').toString('utf8'), 'la canción. sí');
});

test('книжный шифр: точная разметка символов и полей по одному пробелу', () => {
  assert.equal(run('book_cipher', ['5', 'one  two'], { unit: 'letters', exact: 'chars' }), ' ');
  assert.equal(run('book_cipher', ['5', 'one  two'], { unit: 'letters' }), 'w');   // обычный режим не изменился
  assert.equal(run('book_cipher', ['3', 'one  two three'], { unit: 'words', exact: 'fields' }), 'two');
  assert.equal(run('book_cipher', ['2', 'one  two three'], { unit: 'words', exact: 'fields' }), '');
  assert.equal(run('book_cipher', ['0', 'alpha beta'], { unit: 'words', base: '0' }), 'alpha');
});

test('кадр, извлечённый из видео, переживает сохранение и загрузку проекта', async () => {
  const A = ctx.Artifacts;
  const video = await A.addDataUrl('data:video/mp4;base64,AA==', 'v.mp4', 'video/mp4');
  const frame = A.addDerived('test-frame', 'image', { width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255]) }, { name: 'frame.png', mime: 'image/png', dataUrl: 'data:image/png;base64,AA==' });
  A.keep(A.handle(frame));
  const p = { ...Object.fromEntries(ctx.NodeTypes.video_frames.params.map((q) => [q.key, q.default])), last: A.handle(frame) };
  const saved = A.toJSON();
  A.clear();
  A.load(saved);
  assert.equal(ctx.NodeTypes.video_frames.compute([A.handle(video)], p, { state: {} }), A.handle(frame));
});

test('склейка файлов: две половины PDF дают целый файл, а не склеенные ручки', async () => {
  const A = ctx.Artifacts;
  const body = '%PDF-1.4\n1 0 obj <</Linearized 1/L 60>> endobj\n' + 'x'.repeat(4) + '\n%%EOF';
  const head = Buffer.from(body.slice(0, 30), 'latin1'), tail = Buffer.from(body.slice(30), 'latin1');
  const a = await A.addDataUrl('data:application/octet-stream;base64,' + head.toString('base64'), 'doc.pdfaa');
  const b = await A.addDataUrl('data:audio/wav;base64,' + tail.toString('base64'), 'part.wav');
  const node = { state: {} };
  const handle = ctx.NodeTypes.file_concat.compute([A.handle(a), A.handle(b)], { name: '' }, node);
  const bytes = ctx.ArgFiles.artifactBytes(handle);
  assert.equal(latin1(bytes), body);
  assert.equal(node.state.info.parts.length, 2);
  assert.equal(node.state.info.parts[1].start, 30);
  assert.match(A.get(A.idOf(handle)).name, /\.pdf$/);
  // Текстовый Join остаётся текстовым: его контракт не меняли.
  assert.match(run('join', [A.handle(a), A.handle(b)], { sep: '' }), /^artifact:/);
});

test('байты → файл и файл → байты сохраняют байты точно', () => {
  const raw = '\u0089PNG\r\n\u001a\n\u0000ÿ';
  const handle = ctx.NodeTypes.bytes_to_file.compute([raw], { read: 'auto', name: '' }, { state: {} });
  const back = ctx.NodeTypes.file_to_bytes.compute([handle], { as: 'bytes', limit: 1000 }, { state: {} });
  assert.equal(back, raw);
  assert.match(ctx.Artifacts.get(ctx.Artifacts.idOf(handle)).name, /\.png$/);
  assert.equal(ctx.NodeTypes.file_to_bytes.compute([handle], { as: 'hex', limit: 1000 }, { state: {} }), '89 50 4e 47 0d 0a 1a 0a 00 ff');
});

test('биты → картинка: настоящий артефакт-изображение с полями и масштабом', () => {
  const node = { state: {} };
  const handle = ctx.NodeTypes.bits_to_image.compute(['101\n010\n111'], { width: 0, on: '1', off: '0', order: 'rows', scale: 2, margin: 1, invert: false, flipH: false, flipV: false }, node);
  const a = ctx.Artifacts.get(ctx.Artifacts.idOf(handle));
  assert.equal(a.kind, 'image');
  const px = ctx.Artifacts.runtimeGet(a.id);
  assert.equal(px.width, (3 + 2) * 2);
  assert.equal(px.data[((1 * 2) * px.width + 1 * 2) * 4], 0, 'клетка (0,0) чёрная');
  assert.equal(px.data[((1 * 2) * px.width + 2 * 2) * 4], 255, 'клетка (1,0) белая');
  const flat = ctx.ArgFiles.BitImage.bitGrid('110011', { width: 3, on: '1', off: '0' });
  assert.deepEqual(JSON.parse(JSON.stringify(flat)), [[1, 1, 0], [0, 1, 1]]);
});

test('две картинки → одна: разность, XOR и сдвиг B', () => {
  const px = (w, h, f) => ({ width: w, height: h, data: Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => (i % 4 === 3 ? 255 : f(i >> 2))) });
  const a = px(2, 1, () => 200), b = px(2, 1, (i) => (i ? 50 : 200));
  assert.deepEqual([...ctx.ImgCombine.combine(a, b, { mode: 'difference' }).data.slice(0, 8)], [0, 0, 0, 255, 150, 150, 150, 255]);
  assert.equal(ctx.ImgCombine.combine(a, b, { mode: 'xor' }).data[4], 200 ^ 50);
  // B сдвинут на 1 px вправо: в первом пикселе B нет — остаётся A.
  assert.equal(ctx.ImgCombine.combine(a, b, { mode: 'difference', dx: 1 }).data[0], 200);
});

test('байты → звук: форматы отсчёта и смещение заголовка', () => {
  const r = ctx.RawPcm.decodeRaw(Uint8Array.from([9, 9, 0, 128, 255]), { format: 'u8', channels: 1, rate: 8000, offset: 2 });
  assert.deepEqual([...r.channels[0]].map((v) => Math.round(v * 100) / 100), [-1, 0, 0.99]);
  const s16 = ctx.RawPcm.decodeRaw(Uint8Array.from([0x00, 0x80, 0xff, 0x7f]), { format: 's16le', channels: 1, rate: 8000, offset: 0 });
  assert.deepEqual([...s16.channels[0]].map((v) => Math.round(v * 1000) / 1000), [-1, 1]);
  assert.throws(() => ctx.RawPcm.decodeRaw(Uint8Array.from([1]), { format: 's16le', channels: 1, rate: 8000, offset: 0 }), /bytes|байт/);
});
