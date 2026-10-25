// Перенесённая по строкам длинная строка (OCR страницы книги): авто-поиск склеивает строки сам, без траты шага.
// Обычный многострочный текст склейкой не трогается. SSTV без VIS из примера Dr. Langeskov декодируется по периоду строк.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadFull } = require('./load');

const G = loadFull('ru');
const BOOK = '8193938992142842142\n7471427477982857892\n2376749375889723868\n8781427472680948475\n9523898780';

test('OCR книги: пять строк цифр → авто-поиск находит ссылку Catbox (и с CRLF, и с пробелами по краям)', async () => {
  G.Profiles.setActive('neutral');
  G.KeyBank.clear();
  for (const input of [BOOK, BOOK + '\n', '  ' + BOOK.replace(/\n/g, '\r\n') + ' ']) {
    const res = await G.Solver.solve(input, { depth: 3, beam: 160, timeLimit: 15000, engines: false });
    assert.equal(res[0].text, 'https://files.catbox.moe/1gukbv.png', JSON.stringify(input.slice(0, 30)));
    assert.equal(res[0].chain[0].op, 'ws_prep');
  }
});

test('склейка строк — только для одного перенесённого токена', () => {
  const wrapped = G.TextPrep.wrappedToken;
  assert.equal(wrapped(BOOK), true);
  assert.equal(wrapped('VGhlIGtlZXBlciBsZWZ0IG9u\nZSBsYXN0IGVudHJ5OiB0aGUg\nbGFtcA=='), true);
  assert.equal(wrapped('hello world\nthis is text'), false, 'пробелы внутри строк');
  assert.equal(wrapped('12345678\n1234\n123456789012'), false, 'строки разной длины — не перенос');
  assert.equal(wrapped('ZH DUH\nZDLWLQJ'), false);
  assert.equal(wrapped('12345678'), false, 'одна строка');
});

test('SSTV Scottie S1 без VIS (пример Dr. Langeskov): режим по периоду строк, картинка без сдвига каналов', () => {
  const ctx = vm.createContext({ T: (ru) => ru });
  ctx.self = ctx;
  for (const f of ['dsp.js', 'wav.js', 'sstv.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'web', 'js', 'media', f), 'utf8'), ctx);
  const box = { self: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'web', 'samples', 'sstv-scottie-keypad.js'), 'utf8'), box);
  const s = box.self.ArgSamples['sstv-scottie-keypad'];
  const w = ctx.Wav.parse(new Uint8Array(Buffer.from(s.data, 'base64')));
  const r = ctx.SSTV.decode(w.channels[0], w.sampleRate, {});
  assert.equal(r.modeKey, 'scottie1');
  assert.equal(r.detectedBy, 'period');
  assert.equal(r.missed, 0);
  // Сверка с исходной картинкой клавиатуры (той, что синтезирована в звук).
  const src = require('../tools/make_tour_samples.js').keypadImage(320, 256);
  let diff = 0, n = 0;
  for (let y = 4; y < 145; y++) for (let x = 6; x < 314; x++) for (let c = 0; c < 3; c++) { const o = (y * 320 + x) * 4 + c; diff += Math.abs(r.image.data[o] - src.data[o]); n++; }
  assert.ok(diff / n < 12, 'средняя ошибка ' + (diff / n).toFixed(1));
});
