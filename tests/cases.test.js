// Примеры по ARG (presets-arg-*.js): каждый вычисляется без ошибок, кроме намеренно отрицательных,
// и содержит известный ответ из отчётов. Проверка на обоих языках интерфейса.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFull } = require('./load');

for (const lang of ['en', 'ru']) {
  const ctx = loadFull(lang);
  const cases = ctx.Presets.filter((p) => p.arg);

  test(`[${lang}] примеров по ARG достаточно и у каждого есть группа, описание и заметка об источнике`, () => {
    assert.ok(cases.length >= 20, 'примеров: ' + cases.length);
    const ids = new Set();
    for (const p of cases) {
      assert.ok(!ids.has(p.id), 'повтор id ' + p.id);
      ids.add(p.id);
      assert.ok(ctx.ArgCases.get(p.arg), 'неизвестный ARG ' + p.arg + ' у ' + p.id);
      assert.ok(p.title && p.desc, p.id + ': нет названия или описания');
      assert.ok(p.nodes.some((n) => n.type === 'note' && /Source:|Источник:/.test(n.params.text)), p.id + ': нет заметки с источником');
      assert.ok(p.auto || p.manual, p.id + ': нужно либо auto, либо manual с причиной');
    }
  });

  for (const preset of cases) {
    test(`[${lang}] пример «${preset.id}» вычисляется`, () => {
      const g = new ctx.Graph();
      const report = g.load({ nodes: preset.nodes, links: preset.links });
      assert.equal(report.skipped.length, 0, 'пропущены ноды');
      assert.equal(report.warnings.length, 0, 'предупреждения загрузки: ' + report.warnings.map((w) => w.message).join('; '));
      const res = g.evaluate();
      const expectedErrors = new Set(preset.expectErrors || []);
      // Ошибка, пришедшая вниз по цепочке от ожидаемой, тоже ожидаема.
      const allowed = (id) => expectedErrors.has(id) || (res.get(id).inputError && allowed(res.get(id).inputError.nodeId));
      for (const [id, r] of res) {
        if (allowed(id)) assert.ok(r.error, `нода ${id} должна давать ожидаемую ошибку`);
        else assert.equal(r.error, null, `нода ${id} (${g.nodes.get(id).type}): ${r.error}`);
      }
      for (const id of expectedErrors) assert.ok(res.get(id).error, `в ноде ${id} ожидалась ошибка`);
      const values = [...res.values()].map((r) => r.value).filter((v) => typeof v === 'string');
      for (const want of preset.expect || []) assert.ok(values.includes(want), `нет «${want}», есть: ${values.join(' | ')}`);
      // Сообщения операций переводятся: точные фразы проверяем на английском интерфейсе.
      if (lang === 'en') for (const part of preset.expectContains || []) assert.ok(values.some((v) => v.includes(part)), `нет фрагмента «${part}», есть: ${values.join(' | ')}`);
    });
  }
}

test('отрицательный пример AlphaVer: hex-подобный токен даёт понятную ошибку, а не текст', () => {
  const ctx = loadFull('en');
  const preset = ctx.Presets.find((p) => p.id === 'av-token-not-hex');
  const g = new ctx.Graph();
  g.load({ nodes: preset.nodes, links: preset.links });
  const res = g.evaluate();
  assert.match(res.get(preset.expectErrors[0]).error, /Odd number of hex digits/);
});

test('расхождения источников помечены у примеров и называются честно', () => {
  const ctx = loadFull('en');
  const flagged = ctx.Presets.filter((p) => p.discrepancy).map((p) => p.id).sort();
  assert.deepEqual(Array.from(flagged), ['em-vigenere', 'or-lenore', 'ox-anagram', 'pt-fox-md5']);
  const lenore = ctx.Presets.find((p) => p.id === 'or-lenore');
  assert.ok(lenore.nodes.some((n) => n.type === 'note' && /BEUORE/.test(n.params.text) && /BEFORE/.test(n.params.text)));
});

test('калькулятор: точная арифметика Cicada и простые множители', () => {
  const ctx = loadFull('en');
  const run = (expr, mode) => ctx.CipherOps.BY_ID.calc.run([expr], { mode: mode || 'value' });
  assert.equal(run('509 × 503 × 3301'), '845145127');
  assert.equal(run('845145127', 'factors'), '503 × 509 × 3301');
  assert.equal(run('(7+3)^2 - 4 % 3'), '99');
  assert.equal(run('2^100'), '1267650600228229401496703205376');
  assert.throws(() => run('7 / 2'), /not exact/);
  assert.throws(() => run('1 / 0'), /zero/);
  assert.throws(() => run('2 + a'), /Unexpected character/);
  assert.throws(() => run('(1+2'), /not closed/);
  assert.throws(() => run('1', 'factors'), /from 2/);
});
