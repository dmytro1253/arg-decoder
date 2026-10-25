// Тесты пакета «Файлы и хеши»: хеши, сигнатуры, хвосты, deflate, ZIP/ZipCrypto, .class, строки, лог, ноды.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { loadEngine } = require('./load');
const B = require('./fixtures/files/builders');

const FILES = ['artifacts.js', 'files/bytes.js', 'files/hash.js', 'files/hash-ops.js', 'files/inflate.js', 'files/signatures.js', 'files/hexview.js',
  'files/strings.js', 'files/classfile.js', 'files/zip.js', 'files/archive.js', 'files/logview.js', 'files/ui.js',
  'files/node-inspector.js', 'files/node-strings.js', 'files/node-archive.js', 'files/node-log.js'];

const { ctx, run } = loadEngine(FILES);
ctx.I18n.lang = 'ru'; // сообщения проверяем по-русски
const N = ctx.ArgFiles;
const plain = (x) => JSON.parse(JSON.stringify(x)); // значения из vm-контекста — другой realm
const u8 = (b) => new Uint8Array(b);
const hex = (b) => Buffer.from(b).toString('hex');

async function artifact(buf, name) {
  const id = await ctx.Artifacts.addDataUrl(N.toDataUrl(u8(buf), 'application/octet-stream'), name || 'f.bin', 'application/octet-stream');
  return ctx.Artifacts.handle(id);
}
const nodeCompute = (type, inputs, params) => {
  const def = ctx.NodeTypes[type];
  const full = Object.fromEntries(def.params.map((p) => [p.key, p.default]));
  const node = { params: { ...full, ...params }, state: {} };
  return { value: def.compute(inputs, node.params, node), node };
};
const bytesOfHandle = (h) => Buffer.from(N.artifactBytes(h));

// ---------- хеши ----------
test('хеши совпадают с эталоном Node на границах блоков', () => {
  for (const len of [0, 1, 3, 55, 56, 63, 64, 111, 112, 119, 128, 129, 1000, 70000]) {
    const buf = Buffer.alloc(len, 'ab');
    for (const alg of ['md5', 'sha1', 'sha256', 'sha512']) {
      assert.equal(N.Hash.hashHex(alg, u8(buf)), crypto.createHash(alg).update(buf).digest('hex'), alg + ' len ' + len);
    }
  }
});

test('известные векторы: Portal MD5, abc, CRC32', () => {
  assert.equal(run('hash_md5', '(425) 822-5251'), '9459c6cac8c203b8128b7cc63068d4fd');
  assert.equal(run('hash_sha1', 'abc'), 'a9993e364706816aba3e25717850c26c9cd0d89d');
  assert.equal(run('hash_sha256', 'abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(run('hash_crc32', '123456789'), 'cbf43926');
  assert.equal(run('hash_md5', 'x', { upper: true }), crypto.createHash('md5').update('x').digest('hex').toUpperCase());
});

test('кодировка текста для хеша задаётся явно', () => {
  assert.equal(run('hash_md5', 'я', { enc: 'cp1251' }), crypto.createHash('md5').update(Buffer.from([0xff])).digest('hex'));
  assert.equal(run('hash_md5', 'я', { enc: 'utf8' }), crypto.createHash('md5').update('я').digest('hex'));
  assert.equal(run('hash_md5', ' a ', { strip: true }), crypto.createHash('md5').update('a').digest('hex'));
});

test('проверка хеша: совпадение, отсутствие, определение алгоритма по длине', () => {
  const digest = '9459c6cac8c203b8128b7cc63068d4fd';
  const ok = run('hash_check', ['(425) 111-1111\n(425) 822-5251\n', digest]);
  assert.match(ok, /СОВПАДЕНИЕ \[MD5\]: "\(425\) 822-5251"/);
  assert.match(run('hash_check', ['nope', digest]), /НЕТ СОВПАДЕНИЯ/);
  const sha = crypto.createHash('sha256').update('secret').digest('hex');
  assert.match(run('hash_check', ['secret', sha.toUpperCase()]), /SHA-256/);
  assert.match(run('hash_check', ['secret', 'md5: ' + crypto.createHash('md5').update('secret').digest('hex').match(/../g).join(':')]), /СОВПАДЕНИЕ/);
  assert.equal(run('hash_check', ['a\nsecret', sha], { output: 'match' }), 'secret');
  assert.throws(() => run('hash_check', ['a', digest], { output: 'match' }), /Нет совпадений/);
  assert.throws(() => run('hash_check', ['a', 'zzz']), /Нужен дайджест/);
});

test('определитель хеша объясняет, что хеши проверяют, а не расшифровывают', () => {
  const r = run('hash_identify', '9459c6cac8c203b8128b7cc63068d4fd\n9b4c383a911ec');
  assert.match(r, /MD5/);
  assert.match(r, /NTLM/);
  assert.match(r, /не расшифровывают/);
  assert.match(r, /Нечётное число hex-цифр/); // AlphaVer: 13 hex
  assert.match(run('hash_identify', 'a'.repeat(64)), /SHA-256/);
});

// ---------- сигнатуры и хвосты ----------
test('определение формата по сигнатуре', () => {
  const S = N.Signatures;
  const id = (buf) => S.detect(u8(buf)).id;
  assert.equal(id(B.makePng()), 'png');
  assert.equal(id(B.makeJpeg()), 'jpeg');
  assert.equal(id(B.makeGif()), 'gif');
  assert.equal(id(B.makeZip([{ name: 'a.txt', data: 'hi' }])), 'zip');
  assert.equal(id(B.makeZip([{ name: 'META-INF/MANIFEST.MF', data: 'x' }])), 'jar');
  assert.equal(id(B.makeClass('A', [])), 'class');
  assert.equal(id(Buffer.from('%PDF-1.7\n')), 'pdf');
  assert.equal(id(Buffer.concat([Buffer.from('Rar!\x1a\x07\x00'), Buffer.alloc(8)])), 'rar4');
  assert.equal(id(Buffer.concat([Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]), Buffer.alloc(30)])), '7z');
  assert.equal(id(Buffer.concat([Buffer.from('RIFF'), Buffer.from([36, 0, 0, 0]), Buffer.from('WAVEfmt '), Buffer.alloc(20)])), 'wav');
  assert.equal(id(Buffer.concat([Buffer.from('OggS\0\x02'), Buffer.alloc(30)])), 'ogg');
  assert.equal(id(Buffer.concat([Buffer.from('ID3'), Buffer.alloc(20)])), 'mp3');
  assert.equal(id(Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(20)])), 'mp4');
  assert.equal(id(Buffer.from('просто текст, plain text\n')), 'text');
  assert.equal(id(Buffer.from('BM and some text')), 'text'); // «BM» без валидного заголовка — не BMP
  assert.equal(id(Buffer.from([0xde, 0xad, 0xbe, 0xef, 0, 1, 2, 3, 0, 0, 0, 0])), 'unknown');
});

test('NBT и gzip с NBT внутри', () => {
  const nbt = Buffer.concat([Buffer.from([0x0a, 0, 4]), Buffer.from('Data'), Buffer.from([3, 0, 1]), Buffer.from('x'), Buffer.from([0, 0, 0, 7, 0])]);
  assert.equal(N.Signatures.detect(u8(nbt)).id, 'nbt');
  const gz = N.Signatures.detect(u8(zlib.gzipSync(nbt)));
  assert.equal(gz.id, 'gzip');
  assert.match(gz.name, /NBT/);
});

test('данные после конца: PNG IEND, JPEG EOI, GIF, ZIP EOCD', () => {
  const S = N.Signatures;
  const secret = 'SECRET-TAIL';
  for (const [make, idName, marker] of [[B.makePng, 'png', 'IEND'], [B.makeJpeg, 'jpeg', 'EOI']]) {
    const clean = S.findEnd(u8(make()), idName);
    assert.equal(clean.tail, 0, idName);
    const withTail = make(secret);
    const e = S.findEnd(u8(withTail), idName);
    assert.equal(e.tail, secret.length, idName);
    assert.equal(e.marker, marker);
    assert.equal(Buffer.from(withTail).subarray(e.end).toString(), secret);
  }
  assert.equal(S.findEnd(u8(B.makeGif('zz')), 'gif').tail, 2);
  const zip = B.makeZip([{ name: 'a', data: 'b' }], { comment: 'hello' });
  assert.equal(S.findEnd(u8(Buffer.concat([zip, Buffer.from('tail!')])), 'zip').tail, 5);
  assert.equal(S.findEnd(u8(zip), 'zip').tail, 0);
});

test('вложенные файлы и вырезка: ZIP, приклеенный к PNG', () => {
  const zip = B.makeZip([{ name: 'hidden.txt', data: 'flag{png-zip}', method: 'deflate' }]);
  const poly = B.makePng(zip);
  const S = N.Signatures;
  const emb = S.scanEmbedded(u8(poly));
  const hit = emb.find((e) => e.id === 'zip');
  assert.ok(hit);
  assert.equal(hit.offset, B.makePng().length);
  const carved = S.carve(u8(poly), hit.offset);
  assert.equal(carved.format.id, 'zip');
  assert.equal(Buffer.from(carved.bytes).equals(zip), true);
  // Архив открывается и прямо из полиглота (смещения учитывают данные перед ним).
  const a = N.Archive.open(u8(poly));
  assert.equal(a.entries[0].name, 'hidden.txt');
  assert.equal(Buffer.from(a.read(a.entries[0])).toString(), 'flag{png-zip}');
});

// ---------- deflate ----------
test('чистый inflate совпадает с zlib (fixed/dynamic/stored)', async () => {
  const text = Buffer.from('The quick brown fox jumps over the lazy dog. '.repeat(500) + crypto.randomBytes(3000).toString('hex'));
  for (const level of [0, 1, 6, 9]) {
    const packed = zlib.deflateRawSync(text, { level });
    assert.equal(Buffer.from(N.Inflate.inflateRaw(u8(packed))).equals(text), true, 'level ' + level);
  }
  assert.equal(Buffer.from(N.Inflate.inflateRaw(u8(zlib.deflateRawSync(Buffer.from('a'), { strategy: zlib.constants.Z_FIXED })))).toString(), 'a');
  ctx.DecompressionStream = DecompressionStream;
  const big = zlib.deflateRawSync(Buffer.alloc(200000, 'xyz'));
  assert.equal((await N.Inflate.inflateRawAsync(u8(big))).length, 200000);
  delete ctx.DecompressionStream;
  assert.equal((await N.Inflate.inflateRawAsync(u8(big))).length, 200000); // запасной путь
  assert.throws(() => N.Inflate.inflateRaw(u8(Buffer.from([0xff, 0xff, 0xff]))), /deflate/);
  assert.throws(() => N.Inflate.inflateRaw(u8(zlib.deflateRawSync(Buffer.alloc(5000))), { maxOut: 1000 }), /слишком велики/);
  assert.equal(Buffer.from(N.Inflate.gunzip(u8(zlib.gzipSync('hi'))).data).toString(), 'hi');
});

// ---------- ZIP ----------
const SAMPLE = [
  { name: 'readme.txt', data: 'stored text', method: 'store' },
  { name: 'dir/', data: '' },
  { name: 'dir/deflated.txt', data: 'abcabcabc'.repeat(100), method: 'deflate' },
  { name: 'привет.txt', data: 'utf8 name', method: 'deflate' },
];

test('ZIP: список и извлечение stored + deflated', () => {
  const zip = u8(B.makeZip(SAMPLE, { comment: 'cmt' }));
  const a = N.Archive.open(zip);
  assert.equal(a.type, 'zip');
  assert.equal(a.comment, 'cmt');
  assert.deepEqual(plain(a.entries.map((e) => e.name)), SAMPLE.map((e) => e.name));
  assert.equal(a.entries[2].methodName, 'deflate');
  assert.equal(Buffer.from(a.read(a.entries[0])).toString(), 'stored text');
  assert.equal(Buffer.from(a.read(a.entries[2])).toString(), 'abcabcabc'.repeat(100));
  assert.equal(a.entries[3].name, 'привет.txt');
  assert.equal(N.Archive.listing(a).split('\n').length, SAMPLE.length + 1);
  assert.equal(N.Archive.findEntry(a.entries, '#0').name, 'readme.txt');
  assert.equal(N.Archive.findEntry(a.entries, 'deflated.txt').name, 'dir/deflated.txt');
});

test('ZIP: повреждённая запись даёт ошибку CRC, восстановление без каталога', () => {
  const buf = Buffer.from(B.makeZip([{ name: 'a.txt', data: 'AAAAAAAA' }]));
  const bad = Buffer.from(buf);
  bad[30 + 5] ^= 1; // байт данных
  const a = N.Archive.open(u8(bad));
  assert.throws(() => a.read(a.entries[0]), /CRC32/);
  const rec = N.Archive.open(u8(B.makeZip([{ name: 'a.txt', data: 'AAAA' }, { name: 'b.txt', data: 'BBBB', method: 'deflate' }], { noCentral: true })));
  assert.equal(rec.entries.length, 2);
  assert.match(rec.note, /восстановлены/);
  assert.equal(Buffer.from(rec.read(rec.entries[1])).toString(), 'BBBB');
});

test('ZIP: пароль ZipCrypto (шифратор написан в тесте)', () => {
  const zip = u8(B.makeZip([
    { name: 'secret.txt', data: 'imgur9F0A3un', password: 'hunter2' },
    { name: 'secret2.txt', data: 'deflated secret '.repeat(20), method: 'deflate', password: 'пароль' },
  ]));
  const a = N.Archive.open(zip);
  assert.equal(a.entries[0].encrypted, true);
  assert.throws(() => a.read(a.entries[0]), (e) => e.code === 'password' && /пароль/.test(e.message));
  assert.throws(() => a.read(a.entries[0], 'wrong'), (e) => e.code === 'password');
  assert.equal(Buffer.from(a.read(a.entries[0], 'hunter2')).toString(), 'imgur9F0A3un');
  assert.equal(Buffer.from(a.read(a.entries[1], 'пароль')).toString(), 'deflated secret '.repeat(20));
});

test('ZIP: AES отклоняется, RAR/7z отправляются в ноду «Архив RAR/7z»', () => {
  const aes = N.Archive.open(u8(B.makeZip([{ name: 'x', data: 'y', aes: true }])));
  assert.equal(aes.entries[0].aes, true);
  assert.throws(() => aes.read(aes.entries[0], 'p'), (e) => e.code === 'unsupported' && /AES/.test(e.message));
  const rar = u8(Buffer.concat([Buffer.from('Rar!\x1a\x07\x01\x00'), Buffer.alloc(20)]));
  assert.throws(() => N.Archive.open(rar), /RAR.*Архив RAR\/7z/);
  const z7 = u8(Buffer.concat([Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]), Buffer.alloc(30)]));
  assert.throws(() => N.Archive.open(z7), /7-Zip.*Архив RAR\/7z/);
  assert.throws(() => N.Archive.open(u8(Buffer.from('plain text file'))), /Не архив/);
});

test('вложенные архивы: путь через !', () => {
  const inner = B.makeZip([{ name: 'deep/flag.txt', data: 'FLAG', method: 'deflate' }]);
  const outer = u8(B.makeZip([{ name: 'inner.zip', data: inner }]));
  const r = N.Archive.resolve(outer, 'inner.zip!deep/flag.txt');
  assert.equal(Buffer.from(r.bytes).toString(), 'FLAG');
  assert.throws(() => N.Archive.resolve(outer, 'inner.zip!nope'), /нет записи/);
});

test('ZIP: извлечение асинхронно через DecompressionStream', async () => {
  const big = Buffer.alloc(100000, 'q');
  const a = N.Archive.open(u8(B.makeZip([{ name: 'big', data: big, method: 'deflate' }])));
  ctx.DecompressionStream = DecompressionStream;
  const out = await a.readAsync(a.entries[0]);
  delete ctx.DecompressionStream;
  assert.equal(out.length, 100000);
});

// ---------- .class / JAR ----------
test('.class: константы, строки и конец структуры', () => {
  const cls = B.makeClass('mod/Main', ['imgur9F0A3un', 'https://example.org/x']);
  const c = N.ClassFile.parse(u8(cls));
  assert.equal(c.thisClass, 'mod/Main');
  assert.deepEqual(plain(c.strings), ['imgur9F0A3un', 'https://example.org/x']);
  assert.equal(c.end, cls.length);
  assert.equal(N.Signatures.findEnd(u8(Buffer.concat([cls, Buffer.from('xx')])), 'class').tail, 2);
  assert.match(N.ClassFile.describe(u8(cls)), /imgur9F0A3un/);
  assert.throws(() => N.ClassFile.parse(u8(cls.subarray(0, 40))), /оборван/);
});

test('JAR: поиск ID по всем записям, включая константы .class', () => {
  const jar = u8(B.makeZip([
    { name: 'META-INF/MANIFEST.MF', data: 'Manifest-Version: 1.0\n' },
    { name: 'mod/Main.class', data: B.makeClass('mod/Main', ['imgur9F0A3un']), method: 'deflate' },
    { name: 'assets/lang.txt', data: 'nothing here', method: 'deflate' },
  ]));
  assert.equal(N.Signatures.detect(jar).id, 'jar');
  const r = N.Archive.grep(jar, 'imgur\\w+');
  assert.deepEqual(plain(r.lines), ['mod/Main.class: imgur9F0A3un']);
  assert.equal(r.scanned, 3);
});

// ---------- строки и лог ----------
test('строки: ASCII, UTF-8, UTF-16LE, фильтр и минимальная длина', () => {
  const data = Buffer.concat([
    Buffer.from([0, 1, 2]), Buffer.from('hello_world'), Buffer.from([0xff, 0]),
    Buffer.from('привет мир', 'utf8'), Buffer.from([0, 0]),
    Buffer.from('wide text', 'utf16le'), Buffer.from([1, 2, 3, 4]), Buffer.from('ab'),
  ]);
  const S = N.Strings;
  const all = S.extractStrings(u8(data), { minLen: 4 }).items;
  const by = (k) => all.filter((s) => s.kind === k).map((s) => s.text);
  assert.deepEqual(plain(by('ascii')), ['hello_world']);
  assert.deepEqual(plain(by('utf8')), ['привет мир']);
  assert.ok(by('utf16le').includes('wide text'));
  assert.equal(all.some((s) => s.text === 'ab'), false);
  assert.deepEqual(plain(S.extractStrings(u8(data), { kinds: 'ascii', regex: 'WORLD' }).items.map((s) => s.text)), ['hello_world']);
  assert.throws(() => S.extractStrings(u8(data), { regex: '(' }), /регулярное/);
  assert.equal(S.extractStrings(u8(data), { minLen: 20 }).items.length, 0);
  assert.match(S.formatStrings(all.slice(0, 1), true), /^0x[0-9A-F]{8} \[ascii\]/);
});

test('лог: подсветка hex/base64/URL/координат/§ и извлечение кандидатов', () => {
  const LV = N.LogView;
  const line = 'pos x=12 y=64 z=-300 id 9b4c383a911ec1a2 url https://imgur.com/9F0A3un §a§lBold Zm9vYmFyQmF6UXV4MTIz';
  const spans = LV.highlightLine(line).map((s) => [s.type, line.slice(s.start, s.end)]);
  assert.deepEqual(plain(spans.map((s) => s[0])), ['coord', 'hex', 'url', 'mc', 'mc', 'b64']);
  assert.equal(spans[1][1], '9b4c383a911ec1a2');
  assert.ok(spans[0][1].startsWith('x=12'));
  const found = LV.extractCandidates('a 0xDEADBEEF\nb deadbeefcafebabe\nc 0xDEADBEEF\nd 123456789012', ['hex']);
  assert.deepEqual(plain(found.map((f) => f.text)), ['0xDEADBEEF', 'deadbeefcafebabe']);
  const ctxText = LV.filterText('a\nfoo\nb\nc\nd\nfoo2\ne', 'foo', { context: 1 });
  assert.match(ctxText, /2│ foo/);
  assert.match(ctxText, /--/);
  assert.equal(LV.filterText('a\nb', 'a', { invert: true }), '2│ b');
});

// ---------- ноды графа ----------
test('нода «Инспектор файла»: отчёт, хвост как артефакт, вырезка', async () => {
  const zip = B.makeZip([{ name: 's.txt', data: 'zzz' }]);
  const h = await artifact(B.makePng(zip), 'photo.png');
  const rep = nodeCompute('file_inspect', [h], {}).value;
  assert.match(rep, /Формат: PNG/);
  assert.match(rep, /ДАННЫЕ ПОСЛЕ КОНЦА: \d+ байт, похоже на ZIP/);
  assert.match(rep, /SHA-256: [0-9a-f]{64}/);
  assert.equal(nodeCompute('file_inspect', [h], { output: 'sha256' }).value, crypto.createHash('sha256').update(B.makePng(zip)).digest('hex'));
  const tail = nodeCompute('file_inspect', [h], { output: 'tail' }).value;
  assert.ok(ctx.Artifacts.isHandle(tail));
  assert.equal(bytesOfHandle(tail).equals(zip), true);
  assert.equal(tail, nodeCompute('file_inspect', [h], { output: 'tail' }).value); // детерминированный id
  const carved = nodeCompute('file_inspect', [h], { output: 'carve', carve: B.makePng().length }).value;
  assert.equal(bytesOfHandle(carved).equals(zip), true);
  const clean = await artifact(B.makePng(), 'clean.png');
  assert.throws(() => nodeCompute('file_inspect', [clean], { output: 'tail' }), /данных нет/);
  assert.throws(() => nodeCompute('file_inspect', ['plain text'], {}), /артефакт/);
});

test('нода «Архив»: список, извлечение, пароль, class, поиск', async () => {
  const inner = B.makeZip([{ name: 'n.txt', data: 'nested!' }]);
  const zip = await artifact(B.makeZip([
    { name: 'a.txt', data: 'plain', method: 'deflate' },
    { name: 'lock.txt', data: 'locked', password: 'pw' },
    { name: 'in.zip', data: inner },
    { name: 'M.class', data: B.makeClass('M', ['imgur9F0A3un']) },
  ]), 'x.zip');
  const list = nodeCompute('file_archive', [zip], {}).value;
  assert.match(list, /a\.txt\t5\tdeflate/);
  assert.match(list, /lock\.txt\t6\tstored\tпароль/);
  const e = nodeCompute('file_archive', [zip], { output: 'extract', entry: 'a.txt' }).value;
  assert.equal(bytesOfHandle(e).toString(), 'plain');
  assert.throws(() => nodeCompute('file_archive', [zip], { output: 'extract', entry: 'lock.txt' }), /пароль/);
  const l = nodeCompute('file_archive', [zip], { output: 'extract', entry: 'lock.txt', password: 'pw' }).value;
  assert.equal(bytesOfHandle(l).toString(), 'locked');
  const nested = nodeCompute('file_archive', [zip], { output: 'extract', entry: 'in.zip!n.txt' }).value;
  assert.equal(bytesOfHandle(nested).toString(), 'nested!');
  assert.match(nodeCompute('file_archive', [zip], { output: 'class', entry: 'M.class' }).value, /imgur9F0A3un/);
  assert.match(nodeCompute('file_archive', [zip], { output: 'search', pattern: 'imgur' }).value, /M\.class: imgur9F0A3un/);
  const direct = await artifact(B.makeClass('Solo', ['abcdefgh']), 'Solo.class');
  assert.match(nodeCompute('file_archive', [direct], { output: 'class' }).value, /abcdefgh/);
  const rar = await artifact(Buffer.concat([Buffer.from('Rar!\x1a\x07\x00'), Buffer.alloc(30)]), 'a.rar');
  assert.throws(() => nodeCompute('file_archive', [rar], {}), /RAR/);
});

test('ноды «Строки» и «Лог»', async () => {
  const h = await artifact(Buffer.concat([Buffer.from([0, 0]), Buffer.from('needle_in_haystack'), Buffer.from([0, 0, 0])]), 's.bin');
  assert.equal(nodeCompute('file_strings', [h], {}).value, 'needle_in_haystack');
  assert.equal(nodeCompute('file_strings', ['text строка'], { kinds: 'ascii', minLen: 4 }).value, 'text ');
  const log = 'line one\nid=deadbeef12345678\nline three https://a.b/c\n';
  assert.equal(nodeCompute('log_view', [log], {}).value, log);
  assert.equal(nodeCompute('log_view', [log], { output: 'filter', search: 'three' }).value, '3│ line three https://a.b/c');
  assert.equal(nodeCompute('log_view', [log], { output: 'extract', types: 'hex' }).value, 'deadbeef12345678');
  assert.equal(nodeCompute('log_view', [log], { output: 'extract', types: 'url' }).value, 'https://a.b/c');
  const art = await artifact(Buffer.from('из артефакта'), 'l.log');
  assert.equal(nodeCompute('log_view', [art], {}).value, 'из артефакта');
});

test('все операции пакета зарегистрированы в нужных категориях', () => {
  const ids = ['hash_md5', 'hash_sha1', 'hash_sha256', 'hash_sha512', 'hash_crc32', 'hash_all', 'hash_check', 'hash_identify'];
  for (const id of ids) assert.equal(ctx.CipherOps.BY_ID[id].cat, 'Хеши', id);
  for (const t of ['file_inspect', 'file_strings', 'file_archive', 'log_view']) assert.equal(ctx.NodeTypes[t].cat, 'Файлы', t);
});
