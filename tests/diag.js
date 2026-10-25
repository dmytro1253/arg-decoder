// Отладка: node tests/diag.js "<шифр>" [ожидаемое] [глубина] [профиль] [ключи через запятую]
const { loadEngine } = require('./load');
const { ctx } = loadEngine();
(async () => {
  const [input, want, depth, profile, keys] = process.argv.slice(2);
  if (profile) ctx.Profiles.setActive(profile);
  for (const k of (keys || '').split(',').filter(Boolean)) ctx.KeyBank.add(k, 'diag');
  const t0 = Date.now();
  const r = await ctx.Solver.solve(input, { depth: Number(depth) || 3, beam: 160, timeLimit: 60000 });
  const idx = want ? r.findIndex((x) => x.text === want) : -1;
  console.log('результатов', r.length, 'позиция ожидаемого', idx, 'уверенно', r.confident, 'за', Date.now() - t0, 'мс');
  for (const x of r.slice(0, 8)) console.log(x.rank.toFixed(1), JSON.stringify(x.text).slice(0, 60), '|', ctx.Solver.describeChain(x.chain), '|', x.tags.join(','));
  if (idx > 7) console.log('ожидаемое:', r[idx].rank.toFixed(1), ctx.Solver.describeChain(r[idx].chain));
})();
