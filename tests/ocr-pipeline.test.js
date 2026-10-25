// OCR: потери строк, голосование, обрывки шума и порядок движков «авто» (RapidOCR → tesseract) на подставных движках.
// Настоящие движки проверяются отдельным прогоном (отчёт), здесь — логика выбора и сохранения ответа.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFull } = require('./load');

const G = loadFull('en');
const img = { width: 300, height: 120, data: new Uint8ClampedArray(300 * 120 * 4).fill(200) };
const box = (y) => ({ x0: 10, y0: y, x1: 200, y1: y + 20 });

// Подставной tesseract: первый проход по пресету — строки с рамками; второй проход (PSM 7) — текст строки по рамке.
function fakeTesseract(byPreset, refine) {
  let preset = 0;
  const order = ['dark', 'dark70', 'denoise', 'contrast', 'plain'];
  return {
    async recognize(i, o) {
      if (o.psm === 7) return refine ? refine(i) : { text: '', confidence: 0 };
      const r = byPreset[order[preset++ % order.length]] || { text: '', confidence: 0, lines: [] };
      return r;
    },
  };
}
const page = (lines, conf) => ({ text: lines.map((l) => l[0]).join('\n'), confidence: conf, lines: lines.map(([text, y]) => ({ text, confidence: conf, bbox: box(y) })) });

test('короткие строки 42 и 007 не теряются: уточнение по строкам не выбрасывает исходные', async () => {
  const p = page([['12345678901234567890', 10], ['42', 40], ['007', 70]], 80);
  const eng = fakeTesseract({ dark: p, dark70: p, denoise: p, contrast: p, plain: p });
  const r = await G.Ocr.recognize(img, { digits: true }, eng);
  assert.equal(r.text, '12345678901234567890\n42\n007');
  assert.ok(r.lines.every((l) => l.raw && l.bbox), 'у каждой строки сырой текст и рамка');
});

test('0001 рядом с длинным номером остаётся, если её видят разные семейства предобработок в том же месте', async () => {
  const p = page([['99999999999999999999', 10], ['0001', 40]], 70);
  const r = await G.Ocr.recognize(img, { digits: true }, fakeTesseract({ dark: p, dark70: p, denoise: p, contrast: p, plain: p }));
  assert.equal(r.text, '99999999999999999999\n0001');
  assert.equal(r.dropped.length, 0);
});

test('одиночная цифра шума в разных местах убирается, но остаётся в dropped с предупреждением', async () => {
  const long = '93144543205528206014464714442592281447331445442055144530';
  const r = await G.Ocr.recognize(img, { digits: true }, fakeTesseract({
    dark: page([[long, 10], ['7', 300]], 34), dark70: page([['7', 500]], 27), denoise: page([['7', 700]], 20), contrast: page([['3', 300]], 23), plain: page([['1', 900]], 24),
  }));
  assert.equal(r.text, long);
  assert.equal(r.dropped.length, 1);
  assert.ok(r.warnings.length >= 1);
});

test('голосование: пара родственных пресетов с нулевой уверенностью не побеждает полный ответ двух других семейств', async () => {
  const wrong = page([['011476', 10]], 0);
  const right = (c) => page([['01234567890123456789', 10]], c);
  const r = await G.Ocr.recognize(img, { digits: true }, fakeTesseract({ dark: wrong, dark70: wrong, denoise: page([['0147567', 10]], 0), contrast: right(36), plain: right(32) }));
  assert.equal(r.text, '01234567890123456789');
});

test('видимые пробелы внутри кода не штрафуются', () => {
  const cands = [{ text: '0123 4567', confidence: 80, preset: 'contrast', score: 0 }, { text: '01234867', confidence: 80, preset: 'dark', score: 0 }];
  for (const c of cands) c.score = (c.text.match(/\d/g) || []).length * c.confidence;
  const { best } = G.Ocr.choose(cands, { digits: true });
  assert.equal(best.text, '0123 4567');
});

test('символы не исправляются: O, I, Ґ, Ї и ведущие нули доходят как распознаны', async () => {
  const p = page([['O0 I1 Ґанок Їжак 007', 10]], 90);
  const r = await G.Ocr.recognize(img, { digits: false }, fakeTesseract({ dark: p, dark70: p, denoise: p, contrast: p, plain: p }));
  assert.equal(r.text, 'O0 I1 Ґанок Їжак 007');
});

// Подставной RapidOCR: как ответ сервера /api/ocr.
const fakeRapid = (answers, ready = true) => {
  const calls = [];
  return { calls, async status() { return { ready, note: ready ? '' : 'Не установлен RapidOCR' }; }, async recognize(i, o) { calls.push(o.lang); return answers.shift(); } };
};

test('авто: RapidOCR как есть принят первым, сырые ответы веток сохранены', async () => {
  const rapid = fakeRapid([{ status: 'ok', text: '12345678901234567890\n42\n007', lines: [{ text: '42', bbox: box(40) }] }]);
  const r = await G.Ocr.recognizeAuto(img, { digits: true }, { rapid, tesseract: null });
  assert.equal(r.engine, 'rapidocr');
  assert.equal(r.variant, 'raw');
  assert.equal(r.text, '12345678901234567890\n42\n007');
});

test('авто: в режиме цифр ответ с буквами не принимается и не вычищается — следующая ветка', async () => {
  const rapid = fakeRapid([{ status: 'ok', text: '0O12', lines: [] }, { status: 'ok', text: '0012', lines: [] }]);
  const r = await G.Ocr.recognizeAuto(img, { digits: true }, { rapid, tesseract: null });
  assert.equal(r.variant, 'contrast');
  assert.equal(r.text, '0012');
  assert.equal(r.branches[0].text, '0O12', 'отклонённый сырой ответ сохранён');
});

test('авто: без RapidOCR — tesseract с причиной в ветках; украинский идёт в кириллическую модель', async () => {
  const p = page([['Ґанок', 10]], 90);
  const r = await G.Ocr.recognizeAuto(img, { lang: 'ukr' }, { rapid: fakeRapid([], false), tesseract: fakeTesseract({ dark: p, dark70: p, denoise: p, contrast: p, plain: p }) });
  assert.equal(r.engine, 'tesseract');
  assert.match(r.branches[0].note, /RapidOCR/);
  assert.equal(G.Ocr.rapidLang('ukr+eng'), 'cyrillic');
  assert.equal(G.Ocr.rapidLang('eng'), 'en');
});

test('авто: отмена останавливает перебор', async () => {
  const cancel = { stop: true };
  await assert.rejects(() => G.Ocr.recognizeAuto(img, { cancel }, { rapid: fakeRapid([], true), tesseract: fakeTesseract({}) }), /остановлен|stopped/i);
});
