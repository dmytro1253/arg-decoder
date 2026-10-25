// Тесты модуля «Изображения»: чистая обработка, метаданные, PNG-кодировщик, SGA, шрифт Minecraft, QR, OCR.
// Приёмочные тесты на реальных фото используют Python/Pillow (tests/fixtures/decode.js) и пропускаются без него.
// Настоящий tesseract в Node подключается только если задана переменная ARGDEC_TESSERACT_DIR (папка node_modules
// с tesseract.js 5.x); в браузере OCR проверяется вручную (см. work/integration/image.md).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const { loadFixture, FIXTURES } = require('./fixtures/decode.js');

const WEB = path.join(__dirname, '..', 'web');
const FILES = ['js/image/imgproc.js', 'js/image/pngenc.js', 'data/sga-templates.js', 'data/pixel-font-digits.js', 'js/image/sga.js', 'js/image/pixelfont.js',
  'js/image/imgmeta.js', 'vendor/jsqr/jsQR.js', 'js/image/qr.js', 'js/image/ocr.js'];

function load() {
  const ctx = { TextDecoder, TextEncoder, console, Blob, Response, DecompressionStream };
  ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), ctx, { filename: f });
  return ctx;
}

const G = load();
const P = G.ImgProc;
const px = (w, h, rgba) => ({ width: w, height: h, data: Uint8ClampedArray.from(rgba) });
const solid = (w, h, c) => P.create(w, h, c);
const fixture = (t, name) => { const img = loadFixture(name); if (!img) { t.skip('нет Python/Pillow для декодирования ' + name); } return img; };
const toPlain = (arr) => Array.from(arr);
const plain = (x) => JSON.parse(JSON.stringify(x)); // значения из vm-контекста имеют чужие прототипы

// ---------- imgproc ----------
test('imgproc: яркость, инверсия и серый не меняют исходник и не трогают альфу', () => {
  const src = px(2, 1, [10, 20, 30, 200, 250, 250, 250, 255]);
  const copy = toPlain(src.data);
  const b = P.brightness(src, 20);
  assert.deepStrictEqual(toPlain(b.data), [30, 40, 50, 200, 255, 255, 255, 255]);
  assert.deepStrictEqual(toPlain(P.invert(src).data), [245, 235, 225, 200, 5, 5, 5, 255]);
  const g = P.grayscale(px(1, 1, [255, 0, 0, 255]));
  assert.strictEqual(g.data[0], g.data[1]);
  assert.strictEqual(g.data[0], 54);
  assert.deepStrictEqual(toPlain(src.data), copy);
});

test('imgproc: контраст, гамма, уровни', () => {
  const mid = px(1, 1, [128, 128, 128, 255]);
  assert.strictEqual(P.contrast(mid, 50).data[0], 128);
  assert.ok(P.contrast(px(1, 1, [200, 200, 200, 255]), 50).data[0] > 200);
  assert.ok(P.gamma(px(1, 1, [64, 64, 64, 255]), 2).data[0] > 64);
  assert.throws(() => P.gamma(mid, 0));
  const lv = P.levels(px(3, 1, [10, 10, 10, 255, 50, 50, 50, 255, 90, 90, 90, 255]), 10, 90);
  assert.deepStrictEqual([lv.data[0], lv.data[4], lv.data[8]], [0, 128, 255]);
  assert.throws(() => P.levels(mid, 100, 100));
});

test('imgproc: поднятие теней раскрывает почти чёрный', () => {
  const dark = px(2, 1, [3, 3, 3, 255, 8, 8, 8, 255]);
  const lifted = P.shadowLift(dark, 100);
  assert.ok(lifted.data[0] > 30, 'значение 3 должно стать заметным: ' + lifted.data[0]);
  assert.ok(lifted.data[4] - lifted.data[0] > 8, 'разница между 3 и 8 должна вырасти');
  assert.deepStrictEqual(toPlain(P.shadowLift(dark, 0).data), toPlain(dark.data));
});

test('imgproc: автоуровни, выравнивание, порог и Отсу', () => {
  const data = [];
  for (let i = 0; i < 100; i++) { const v = i < 50 ? 20 : 40; data.push(v, v, v, 255); }
  const img = px(100, 1, data);
  const al = P.autoLevels(img, 0, false);
  assert.strictEqual(al.data[0], 0);
  assert.strictEqual(al.data[4 * 99], 255);
  const eq = P.equalize(img);
  assert.ok(eq.data[4 * 99] > eq.data[0]);
  const t = P.otsu(img);
  assert.ok(t >= 20 && t < 40, 'Отсу между двумя уровнями: ' + t);
  const thr = P.threshold(img, null);
  assert.strictEqual(thr.data[0], 0);
  assert.strictEqual(thr.data[4 * 99], 255);
  assert.strictEqual(P.threshold(img, 100).data[4 * 99], 0);
});

test('imgproc: каналы и битовые плоскости', () => {
  const img = px(1, 1, [0b10101010, 0b00001111, 7, 90]);
  assert.strictEqual(P.channel(img, 'g').data[0], 15);
  assert.strictEqual(P.channel(img, 'a').data[2], 90);
  assert.strictEqual(P.bitPlane(img, 'r', 1).data[0], 255);
  assert.strictEqual(P.bitPlane(img, 'r', 0).data[0], 0);
  assert.throws(() => P.bitPlane(img, 'x', 0));
  assert.throws(() => P.bitPlane(img, 'r', 8));
});

// Запись строки в младшие биты RGB построчно (MSB первым).
function embed(text, w, h) {
  const img = solid(w, h, [100, 150, 200, 255]);
  const bits = [];
  for (const b of Buffer.from(text, 'latin1')) for (let k = 7; k >= 0; k--) bits.push((b >> k) & 1);
  let i = 0;
  for (let p = 0; p < w * h && i < bits.length; p++) for (const c of [0, 1, 2]) if (i < bits.length) img.data[p * 4 + c] = (img.data[p * 4 + c] & 0xfe) | bits[i++];
  return img;
}

test('imgproc: LSB-извлечение читает спрятанный текст и учитывает порядок/обход/пропуск', () => {
  const img = embed('silentraven', 10, 4);
  assert.strictEqual(P.bytesToLatin1(P.lsbExtract(img, { channels: 'rgb' }).subarray(0, 11)), 'silentraven');
  // пропуск 8 бит снимает первый байт
  assert.strictEqual(P.bytesToLatin1(P.lsbExtract(img, { channels: 'rgb', skip: 8 }).subarray(0, 10)), 'ilentraven');
  // LSB-first даёт другие байты; инверсия — дополнение
  const lsbFirst = P.lsbExtract(img, { bitOrder: 'lsb' });
  assert.notStrictEqual(lsbFirst[0], 's'.charCodeAt(0));
  assert.strictEqual(P.lsbExtract(img, { invert: true })[0], 255 - 's'.charCodeAt(0));
  // обход по столбцам отличается на неоднородной картинке
  assert.strictEqual(P.lsbExtract(solid(2, 2, [1, 0, 0, 255]), { channels: 'r', scan: 'col' }).length, 0);
  assert.throws(() => P.lsbExtract(img, { channels: 'x' }));
  // две плоскости за раз: старший из двух бит идёт первым
  const two = P.lsbExtract(px(4, 1, [3, 0, 0, 255, 0, 0, 0, 255, 3, 0, 0, 255, 0, 0, 0, 255]), { channels: 'r', bits: 2 });
  assert.strictEqual(two[0], 0b11001100);
});

test('imgproc: поворот, отражение, обрезка, масштаб, гистограмма', () => {
  const img = px(2, 1, [1, 0, 0, 255, 2, 0, 0, 255]);
  const r90 = P.rotate(img, 90);
  assert.deepStrictEqual([r90.width, r90.height, r90.data[0], r90.data[4]], [1, 2, 1, 2]);
  const r180 = P.rotate(img, 180);
  assert.deepStrictEqual([r180.data[0], r180.data[4]], [2, 1]);
  assert.deepStrictEqual(toPlain(P.rotate(P.rotate(img, 90), 270).data), toPlain(img.data));
  assert.deepStrictEqual([P.flip(img, true).data[0], P.flip(img, true).data[4]], [2, 1]);
  const c = P.crop(px(3, 1, [1, 0, 0, 255, 2, 0, 0, 255, 3, 0, 0, 255]), 1, 0, 5, 5);
  assert.deepStrictEqual([c.width, c.height, c.data[0]], [2, 1, 2]);
  const s = P.scaleNearest(img, 3);
  assert.deepStrictEqual([s.width, s.height, s.data[0], s.data[4 * 3]], [6, 3, 1, 2]);
  assert.strictEqual(P.histogram(img).r[2], 1);
  assert.deepStrictEqual(plain(P.sample(img, 1, 0)), [2, 0, 0, 255]);
  assert.strictEqual(P.sample(img, 5, 0), null);
  assert.throws(() => P.check({ width: 2, height: 2, data: new Uint8ClampedArray(3) }));
});

test('imgproc: рецепт применяется по порядку и даёт стабильный ключ', () => {
  const img = px(1, 1, [100, 100, 100, 255]);
  const steps = [{ op: 'invert' }, { op: 'brightness', amount: 10 }];
  assert.strictEqual(P.applyRecipe(img, steps).data[0], 165);
  assert.strictEqual(P.recipeKey(steps), P.recipeKey([{ op: 'invert' }, { amount: 10, op: 'brightness' }]));
  assert.throws(() => P.applyRecipe(img, [{ op: 'nope' }]), /Неизвестная операция/);
});

test('imgproc: билинейное масштабирование и сглаживание', () => {
  const img = px(2, 1, [0, 0, 0, 255, 100, 100, 100, 255]);
  const s = P.scaleSmooth(img, 2);
  assert.strictEqual(s.width, 4);
  assert.ok(s.data[4] > 0 && s.data[4] < s.data[12]);
  const b = P.boxBlur(px(3, 1, [0, 0, 0, 255, 90, 90, 90, 255, 0, 0, 0, 255]), 1);
  assert.strictEqual(b.data[0], 45);
});

// ---------- PNG-кодировщик ----------
test('PngEnc: результат читается zlib и содержит те же пиксели', () => {
  const img = px(3, 2, [1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255, 13, 14, 15, 255, 16, 17, 18, 128]);
  const png = Buffer.from(G.PngEnc.encode(img));
  assert.deepStrictEqual(toPlain(png.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = png.subarray(png.indexOf('IDAT') + 4, png.indexOf('IEND') - 8);
  const raw = zlib.inflateSync(idat);
  assert.strictEqual(raw.length, 2 * (1 + 12));
  assert.deepStrictEqual(toPlain(raw.subarray(1, 13)), toPlain(img.data.subarray(0, 12)));
  assert.strictEqual(G.PngEnc.crc32(Buffer.from('IEND'), 0, 4), 0xae426082);
});

// ---------- метаданные ----------
function pngWithChunks(extra, trailing) {
  const base = Buffer.from(G.PngEnc.encode(solid(2, 2, [9, 9, 9, 255])));
  const iend = base.length - 12;
  const chunk = (type, body) => {
    const b = Buffer.alloc(12 + body.length);
    b.writeUInt32BE(body.length, 0); b.write(type, 4, 'latin1'); body.copy(b, 8);
    b.writeUInt32BE(G.PngEnc.crc32(b, 4, 8 + body.length), 8 + body.length);
    return b;
  };
  return Buffer.concat([base.subarray(0, iend), ...extra.map(([t, b]) => chunk(t, b)), base.subarray(iend), trailing || Buffer.alloc(0)]);
}

test('ImgMeta: PNG tEXt/iTXt/zTXt и данные после IEND', async () => {
  const z = zlib.deflateSync(Buffer.from('сжатый секрет', 'utf8'));
  const file = pngWithChunks([
    ['tEXt', Buffer.concat([Buffer.from('Comment\0'), Buffer.from('hello')])],
    ['iTXt', Buffer.concat([Buffer.from('Title\0\0\0ru\0\0', 'latin1'), Buffer.from('привет', 'utf8')])],
    ['zTXt', Buffer.concat([Buffer.from('Packed\0\0'), z])],
  ], Buffer.concat([Buffer.from('PK\x03\x04'), Buffer.from('secret.txt')]));
  const m = G.ImgMeta.parse(new Uint8Array(file));
  assert.strictEqual(m.format, 'png');
  assert.deepStrictEqual([m.width, m.height], [2, 2]);
  assert.strictEqual(m.texts.find((t) => t.key === 'Comment').value, 'hello');
  assert.strictEqual(m.texts.find((t) => t.key === 'Title').value, 'привет');
  assert.ok(m.trailing && m.trailing.length === 14);
  assert.strictEqual(m.trailing.signatures[0].name, 'ZIP/JAR/DOCX');
  await G.ImgMeta.inflateTexts(m, async (d) => new Uint8Array(zlib.inflateSync(Buffer.from(d))));
  assert.strictEqual(m.texts.find((t) => t.key === 'Packed').value, 'сжатый секрет');
  const report = G.ImgMeta.report(m);
  assert.match(report, /Comment: hello/);
  assert.match(report, /ZIP/);
});

test('ImgMeta: JPEG-комментарий, EXIF-текст и хвост после EOI', () => {
  const com = Buffer.from('hidden comment');
  const exifBody = Buffer.concat([
    Buffer.from('Exif\0\0'), Buffer.from('MM\0*', 'latin1'), Buffer.from([0, 0, 0, 8]),
    Buffer.from([0, 1]), // 1 запись
    Buffer.from([0x01, 0x0e, 0, 2, 0, 0, 0, 7, 0, 0, 0, 26]), // ImageDescription, ASCII, 7 байт @26
    Buffer.from([0, 0, 0, 0]), Buffer.from('secret\0'),
  ]);
  const seg = (m, body) => Buffer.concat([Buffer.from([0xff, m, (body.length + 2) >> 8, (body.length + 2) & 255]), body]);
  const sof = Buffer.from([8, 0, 5, 0, 7, 1, 1, 0x11, 0]);
  const file = Buffer.concat([Buffer.from([0xff, 0xd8]), seg(0xe1, exifBody), seg(0xfe, com), seg(0xc0, sof), seg(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])), Buffer.from([0x12, 0xff, 0x00, 0x34]), Buffer.from([0xff, 0xd9]), Buffer.from('TAIL-DATA')]);
  const m = G.ImgMeta.parse(new Uint8Array(file));
  assert.strictEqual(m.format, 'jpeg');
  assert.deepStrictEqual([m.width, m.height], [7, 5]);
  assert.deepStrictEqual(plain(m.comments), ['hidden comment']);
  assert.ok(m.exif.tags.some((t) => t.name === 'ImageDescription' && t.value === 'secret'), JSON.stringify(m.exif));
  assert.strictEqual(m.trailing.length, 9);
  assert.strictEqual(m.trailing.preview, 'TAIL-DATA');
});

test('ImgMeta: GIF-комментарий и неизвестный формат', () => {
  const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.from([2, 0, 3, 0, 0, 0, 0]), Buffer.from([0x21, 0xfe, 4]), Buffer.from('note'), Buffer.from([0]), Buffer.from([0x3b]), Buffer.from('XYZ')]);
  const m = G.ImgMeta.parse(new Uint8Array(gif));
  assert.strictEqual(m.format, 'gif');
  assert.deepStrictEqual(plain(m.comments), ['note']);
  assert.strictEqual(m.trailing.length, 3);
  assert.strictEqual(G.ImgMeta.parse(new Uint8Array([1, 2, 3])).format, 'unknown');
});

test('ImgMeta: реальные файлы разбираются без ошибок', () => {
  for (const [name, w, h, format] of [['vrfneo.jpg', 1284, 1308, 'jpeg'], ['image.png', 463, 536, 'png'], ['photo_2026-08-02_14-24-45.jpg', 778, 443, 'jpeg']]) {
    const m = G.ImgMeta.parse(new Uint8Array(fs.readFileSync(path.join(FIXTURES, name))));
    assert.deepStrictEqual([m.format, m.width, m.height], [format, w, h], name);
    assert.strictEqual(m.trailing, null, name + ' не должен иметь хвоста');
  }
});

// ---------- шаблоны ----------
test('шаблоны SGA: 26 букв, 7 строк, битмапы различаются', () => {
  const list = G.SgaTemplates.templates;
  const letters = new Set(list.filter((t) => /[a-z]/.test(t.ch)).map((t) => t.ch));
  assert.strictEqual(letters.size, 26);
  for (const t of list) { assert.strictEqual(t.rows.length, 7, t.ch); assert.ok(t.rows.every((r) => r.length === t.rows[0].length), t.ch); }
  const seen = new Map();
  for (const t of list) { const k = t.rows.join('/'); assert.ok(!seen.has(k), t.ch + ' повторяет ' + seen.get(k)); seen.set(k, t.ch); }
  assert.ok(list.filter((t) => t.verified).length >= 24, 'должно быть ≥ 24 проверенных глифа');
  assert.deepStrictEqual(plain(list.filter((t) => !t.verified && /[a-z]/.test(t.ch)).map((t) => t.ch).sort()), ['n', 'o', 'r', 'u']);
});

test('ruLayout: латиница в раскладке ЙЦУКЕН → кириллица', () => {
  assert.strictEqual(G.Sga.ruLayout('gjl[jlbn'), 'подходит');
  assert.strictEqual(G.Sga.ruLayout('nt,z; `'), 'тебяж ё');
  assert.strictEqual(G.Sga.ruLayout('Ghbdtn 123'), 'Привет 123');
});

// ---------- SGA на реальных фото ----------
test('SGA: фото 2026-08-02 читается целиком', (t) => {
  const img = fixture(t, 'photo_2026-08-02_14-24-45.jpg');
  if (!img) return;
  const r = G.Sga.recognize(img);
  assert.strictEqual(r.unknown, 0);
  assert.strictEqual(r.glyphs.length, 94);
  assert.strictEqual(r.text, ['gmtcf gjl[jlbn r abyfkmyjve frne', 'crjhj z ehfdyjdtie xfib dtcjd', 'cthlwt nmvs pjd`n nt,z', 'cktleq pf rhfcysv wdtnrjv'].join('\n'));
  assert.strictEqual(G.Sga.ruLayout(r.text), ['пьеса подходит к финальному акту', 'скоро я уравновешу чаши весов', 'сердце тьмы зовёт тебя', 'следуй за красным цветком'].join('\n'));
  assert.ok(r.glyphs.every((g) => g.conf >= 0.9), 'уверенность всех глифов ≥ 90%');
});

test('SGA: фото 2026-10-18 читается целиком (тёмный фон с силуэтом)', (t) => {
  const img = fixture(t, 'photo_2026-10-18_23-16-05.jpg');
  if (!img) return;
  const r = G.Sga.recognize(img);
  assert.strictEqual(r.unknown, 0);
  assert.strictEqual(r.text, ['nt,t ye;ty kbim rk.x', 'jy hfp,bn yf nhb xfcnb', 'elfxb'].join('\n'));
  assert.strictEqual(G.Sga.ruLayout(r.text), ['тебе нужен лишь ключ', 'он разбит на три части', 'удачи'].join('\n'));
});

test('SGA: шумовая картинка не даёт ложного текста и не падает', () => {
  const noise = P.create(120, 80, [20, 20, 20, 255]);
  for (let i = 0; i < noise.data.length; i += 4) if ((i * 2654435761) % 7 === 0) noise.data[i] = noise.data[i + 2] = 200;
  const r = G.Sga.recognize(noise);
  assert.ok(r.unknown >= r.glyphs.length - 1 || r.glyphs.length === 0);
  assert.strictEqual(G.Sga.recognize(solid(30, 30, [0, 0, 0, 255])).text, '');
});

// ---------- шрифт Minecraft ----------
test('шрифт Minecraft: цифры книги (страницы 1 и 2) и подсказки с курсивом', (t) => {
  const page2 = fixture(t, 'image.png');
  const page1 = fixture(t, 'image1.png');
  const tip = fixture(t, '2025-06-29_02.11.16.png');
  if (!page1 || !page2 || !tip) return;
  const read = (img, x, y, w, h) => G.PixelFont.recognize(P.crop(img, x, y, w, h));
  const p2 = read(page2, 55, 78, 350, 80);
  assert.strictEqual(p2.text, '1446461446451447441\n4464314464614442614\n4630144645144444');
  assert.strictEqual(p2.unknown, 0);
  const p1 = read(page1, 40, 78, 360, 90);
  assert.strictEqual(p1.text, '7891912393988978142\n8458794858523927691\n787486');
  const tp = read(tip, 920, 318, 910, 36);
  assert.strictEqual(tp.unknown, 0);
  assert.strictEqual(tp.text, '14462514472514463314444214474314452714464314463014');
  assert.ok(tp.glyphs.every((g) => g.italic), 'подсказка набрана курсивом');
});

// ---------- vrfneo: тени ----------
test('vrfneo.jpg: поднятие теней/уровни делают почти невидимые цифры контрастными', (t) => {
  const img = fixture(t, 'vrfneo.jpg');
  if (!img) return;
  const band = P.crop(img, 100, 45, 800, 40);
  const contrastOf = (i) => { const h = P.histogram(i).luma; let lo = 0, hi = 255; while (!h[lo]) lo++; while (!h[hi]) hi--; return hi - lo; };
  assert.ok(contrastOf(band) < 20, 'исходный контраст полосы мал: ' + contrastOf(band));
  assert.ok(contrastOf(P.shadowLift(band, 100)) > 25, 'после поднятия теней диапазон заметно шире');
  assert.ok(contrastOf(P.autoLevels(P.shadowLift(band, 100), 0.5, false)) > 200, 'тени + автоуровни дают полный контраст');
  const lv = P.levels(band, 5, 17, 1);
  assert.ok(contrastOf(lv) > 200);
  const dark = G.Ocr.preprocess(img, 'dark');
  assert.ok(dark.width >= img.width);
});

// ---------- QR ----------
test('QR: тёмный на светлом и инвертированный', (t) => {
  for (const name of ['qr-test.png', 'qr-test-inverted.png']) {
    const img = fixture(t, name);
    if (!img) return;
    const r = G.Qr.decodeQr(img);
    assert.ok(r, name + ': QR не найден');
    assert.strictEqual(r.text, 'ARG test: silentraven https://example.org/x?id=42');
    assert.strictEqual(r.points.length, 4);
  }
  assert.strictEqual(G.Qr.decodeQr(solid(50, 50, [128, 128, 128, 255])), null);
});

// ---------- OCR: предобработка и логика выбора ----------
test('OCR: предобработка даёт тёмный текст на светлом и увеличивает мелкое', () => {
  const small = solid(100, 40, [10, 10, 10, 255]);
  for (let x = 20; x < 60; x++) for (let y = 15; y < 20; y++) { const i = (y * 100 + x) * 4; small.data[i] = small.data[i + 1] = small.data[i + 2] = 240; }
  for (const preset of G.Ocr.PRESETS.filter((p) => p !== 'auto')) {
    const out = G.Ocr.preprocess(small, preset);
    assert.ok(out.width >= small.width, preset);
    assert.ok(P.histogram(out).luma.reduce((a, c, i) => a + c * i, 0) / (out.width * out.height) > 100 || preset === 'binary' || preset === 'invert', preset + ' должен быть светлым фоном');
  }
  assert.strictEqual(G.Ocr.upscale(small, 0).width, 400);
});

test('OCR: auto выбирает результат с наибольшим числом цифр и вызывает второй проход по строкам', async () => {
  const img = solid(200, 100, [30, 30, 30, 255]);
  const calls = [];
  const engine = {
    async recognize(i, o) {
      calls.push(o.psm);
      if (o.psm === 7) return { text: '12345678', confidence: 90, lines: [] };
      return { text: '1234 5678\njunk', confidence: 60, lines: [{ text: '1234 5678', confidence: 60, bbox: { x0: 10, y0: 10, x1: 120, y1: 30 } }] };
    },
  };
  const r = await G.Ocr.recognize(img, { digits: true }, engine);
  assert.strictEqual(r.text, '12345678');
  assert.ok(calls.includes(7), 'второй проход PSM 7');
  assert.ok(r.tried.length >= 3);
  await assert.rejects(() => G.Ocr.recognize(img, {}, null), /движка|engine/i);
});

// ---------- OCR настоящим tesseract (по желанию) ----------
const TESS_DIR = process.env.ARGDEC_TESSERACT_DIR;

function nodeEngine(Tesseract) {
  const workers = {};
  return {
    async recognize(img, o) {
      const lang = o.lang || 'eng';
      if (!workers[lang]) workers[lang] = await Tesseract.createWorker(lang, 1, { langPath: path.join(WEB, 'vendor', 'tesseract', 'lang'), gzip: false, cacheMethod: 'none' });
      const w = workers[lang];
      await w.setParameters({ tessedit_char_whitelist: o.whitelist || '', tessedit_pageseg_mode: String(o.psm || 6), preserve_interword_spaces: '1' });
      const r = await w.recognize(Buffer.from(G.PngEnc.encode(img)), {}, { blocks: true });
      const d = r.data;
      const lines = d.lines || (d.blocks || []).flatMap((b) => (b.paragraphs || []).flatMap((p) => p.lines || []));
      return { text: d.text || '', confidence: d.confidence || 0, lines: lines.map((l) => ({ text: l.text, confidence: l.confidence, bbox: l.bbox })) };
    },
    async close() { for (const k of Object.keys(workers)) await workers[k].terminate(); },
  };
}

test('OCR (tesseract, ARGDEC_TESSERACT_DIR): vrfneo.jpg — цифры из неба', { skip: !TESS_DIR && 'задай ARGDEC_TESSERACT_DIR, чтобы запустить настоящий tesseract', timeout: 240000 }, async (t) => {
  const img = fixture(t, 'vrfneo.jpg');
  if (!img) return;
  const engine = nodeEngine(require(path.join(TESS_DIR, 'tesseract.js')));
  try {
    const lifted = P.crop(img, 100, 40, 800, 60);
    const expected = '93144543205528206014464714442592281447331445442055144530';
    const r = await G.Ocr.recognize(lifted, { digits: true, preset: 'auto' }, engine);
    assert.strictEqual(r.text.replace(/\D/g, ''), expected);
    const whole = await G.Ocr.recognize(img, { digits: true, preset: 'auto' }, engine); // без обрезки, ~20 с
    assert.strictEqual(whole.text.replace(/\D/g, ''), expected);
  } finally { await engine.close(); }
});
