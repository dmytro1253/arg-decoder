// RAR/7z: настоящая распаковка 7-Zip WebAssembly (web/vendor/7z-wasm) на образцах libarchive и на 7z с AES.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadFull } = require('./load');

const ctx = loadFull('en');
// В Node Emscripten записывает код выхода 7-Zip в process.exitCode; для раннера тестов это был бы сбой файла.
const real7z = require('../web/vendor/7z-wasm/7zz.umd.js');
ctx.SevenZipFactory = async (opts) => {
  const m = await real7z(opts);
  const callMain = m.callMain;
  m.callMain = (args) => { const before = process.exitCode; try { return callMain(args); } finally { process.exitCode = before; } };
  return m;
};
const Z = ctx.ArgFiles.SevenZip;
const fx = (name) => new Uint8Array(fs.readFileSync(path.join(__dirname, 'fixtures', 'archives', name)));
const text = (b) => Buffer.from(b).toString('utf8');

test('RAR 4 и RAR 5 без пароля: список и содержимое', async () => {
  const r4 = await Z.list(fx('libarchive-rar4.rar'), '');
  assert.ok(r4.entries.some((e) => e.path === 'test.txt'));
  const files = await Z.extractAll(fx('libarchive-rar5-stored.rar'), '');
  assert.equal(files.length, 1);
  assert.equal(files[0].path, 'helloworld.txt');
  assert.match(text(files[0].bytes), /hello/i);
});

test('RAR с зашифрованными заголовками: верный пароль открывает, неверный называется прямо', async () => {
  for (const name of ['libarchive-rar4-encrypted-headers.rar', 'libarchive-rar5-encrypted-headers.rar']) {
    const r = await Z.list(fx(name), 'password');
    assert.deepEqual(Array.from(r.entries.map((e) => e.path)).sort(), ['a.txt', 'b.txt', 'c.txt', 'd.txt'], name);
    await assert.rejects(() => Z.list(fx(name), 'wrong'), /Wrong password|Неверный пароль/);
    await assert.rejects(() => Z.list(fx(name), ''), /Wrong password|Неверный пароль/);
  }
});

test('7z с AES и шифрованием заголовков: собственный архив туда и обратно', async () => {
  const make = await ctx.SevenZipFactory({ print: () => {}, printErr: () => {} });
  make.FS.writeFile('/note.txt', 'Ґанок, їжак: 0042');
  make.callMain(['a', '-bd', '-pключ', '-mhe=on', '/s.7z', '/note.txt']);
  const arc = make.FS.readFile('/s.7z');
  const files = await Z.extractAll(arc, 'ключ');
  assert.equal(text(files[0].bytes), 'Ґанок, їжак: 0042');
  await assert.rejects(() => Z.extractAll(arc, 'нет'), /Wrong password|Неверный пароль/);
});

test('не архив — понятная ошибка, а не зависание', async () => {
  await assert.rejects(() => Z.list(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), ''), /не открыл|could not open|failed|ошибкой/i);
});

test('настоящий RAR Killing Floor 2 (ARGDEC_ORIGINALS): заголовки зашифрованы, без пароля — честный отказ', { skip: !process.env.ARGDEC_ORIGINALS && !fs.existsSync(path.join(__dirname, '..', '..', 'work', 'arg-extra-audit-2026-10-23', 'sources', 'kf2-Package.rar')) }, async () => {
  const dir = process.env.ARGDEC_ORIGINALS || path.join(__dirname, '..', '..', 'work', 'arg-extra-audit-2026-10-23');
  const bytes = new Uint8Array(fs.readFileSync(path.join(dir, 'sources', 'kf2-Package.rar')));
  await assert.rejects(() => Z.list(bytes, ''), /Wrong password|Неверный пароль/);
});
