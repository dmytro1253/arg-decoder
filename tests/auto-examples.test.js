// Авто-поиск на каждом примере: исходная строка подаётся в Solver.solve (глубина 3, луч 160, нейтральный профиль,
// ключи, которые раскрывает сам ARG, — в банк ключей), ответ должен оказаться первым (или в первой тройке там, где это оправдано).
// Примеры, которые авто-поиск решить не может по существу (внешний ключ, картинка/звук, действие в игре),
// помечены в самом примере полем manual с причиной и из проверки исключены.
// Таблица рангов: AUTO_TABLE=1 node --test tests/auto-examples.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFull } = require('./load');

const ctx = loadFull('en');
const MAX_TOP = 3;
const table = [];

function runs(preset) {
  const a = preset.auto;
  return [a].concat(a.also || []).map((x) => ({ profile: 'neutral', keys: [], top: 1, ...x }));
}

test('у каждого примера есть либо auto, либо manual с причиной', () => {
  for (const p of ctx.Presets) {
    assert.ok(p.auto || (typeof p.manual === 'string' && p.manual.length > 15), p.id + ': нет ни auto, ни причины manual');
    assert.ok(!(p.auto && p.manual), p.id + ': auto и manual одновременно');
  }
});

for (const preset of ctx.Presets.filter((p) => p.auto)) {
  runs(preset).forEach((run, i) => {
    test(`авто-поиск решает «${preset.id}»${i ? ' (#' + (i + 1) + ')' : ''}: «${run.expect.slice(0, 40)}»`, async () => {
      ctx.Profiles.setActive(run.profile);
      ctx.KeyBank.clear();
      for (const k of run.keys) ctx.KeyBank.add(k, 'ARG');
      try {
        const res = await ctx.Solver.solve(run.input, { depth: 3, beam: 160, timeLimit: 30000 });
        const rank = res.findIndex((r) => r.text === run.expect) + 1;
        table.push([preset.id + (i ? '#' + (i + 1) : ''), run.profile, rank]);
        assert.ok(run.top <= MAX_TOP, 'top больше ' + MAX_TOP + ' нужно обосновать отдельно');
        const shown = res.slice(0, 4).map((r) => JSON.stringify(r.text.slice(0, 40)) + '[' + ctx.Solver.describeChain(r.chain) + ']').join(' | ');
        assert.ok(rank >= 1 && rank <= run.top, `ответ на месте ${rank || '—'}, нужно ≤ ${run.top}. Сверху: ${shown}`);
      } finally {
        ctx.Profiles.setActive('neutral');
        ctx.KeyBank.clear();
      }
    });
  });
}

test('таблица рангов (AUTO_TABLE=1)', () => {
  if (process.env.AUTO_TABLE) console.log(table.map((r) => r.join('\t')).join('\n'));
});
