// Качество поиска в нейтральном профиле (по умолчанию): приёмка из аудита 2026-10-19.
// Глубина 3, луч 160; ожидаемые ответы заданы независимо от реализации.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadEngine } = require('./load');

const { ctx } = loadEngine();
const solve = (input, opts) => ctx.Solver.solve(input, { depth: 3, beam: 160, timeLimit: 30000, ...(opts || {}) });
const reset = () => { ctx.Profiles.setActive('neutral'); ctx.KeyBank.clear(); };

test('по умолчанию действует нейтральный профиль', () => {
  assert.equal(ctx.Profiles.active().id, 'neutral');
  assert.equal(ctx.AuthorProfile.id, 'neutral');
  assert.equal(ctx.AuthorProfile.keys.length, 0);
  assert.equal(ctx.AuthorProfile.bonuses.favorites, 0);
});

const FIRST = [
  ['41414141', 'AAAA'],
  ['616C6C', 'all'],
  ['476F6E65', 'Gone'],
  ['73746f70', 'stop'],
  ['raqrezvgr', 'endermite'],
  ['wfvwjealw', 'endermite'],
  ['ZH DUH ZDLWLQJ', 'WE ARE WAITING'],
  ['WUDSSHG LQ D SULVRQ RI ZRRG', 'TRAPPED IN A PRISON OF WOOD'],
];
for (const [input, want] of FIRST) {
  test('нейтральный профиль: «' + input + '» → «' + want + '» первым', async () => {
    reset();
    const res = await solve(input);
    assert.equal(res[0].text, want, res.slice(0, 5).map((r) => r.text + ' [' + ctx.Solver.describeChain(r.chain) + ']').join(' | '));
  });
}

const KEYED = [
  ['lrot dq xeiefh', 'help me please', 'ENDERMITE'],
  ['PRW QV RZXI', 'LET ME FREE', 'ENDERMITE'],
  ['LMVCCIKB', 'ASTEROID', 'LUCY'],
];
for (const [input, want, key] of KEYED) {
  test('ключ «' + key + '» из банка проекта: «' + input + '» → «' + want + '» первым', async () => {
    reset();
    ctx.KeyBank.add(key, 'test');
    const res = await solve(input);
    assert.equal(res[0].text, want, res.slice(0, 5).map((r) => r.text).join(' | '));
    assert.ok(res.some((r) => r.userKey === key.toLowerCase()), 'результат ключа проекта должен быть в выдаче');
    reset();
  });
}

test('без ключа в банке правильная фраза не выдумывается', async () => {
  reset();
  const res = await solve('LMVCCIKB');
  assert.notEqual(res[0].text, 'ASTEROID');
});

test('эквивалентное объяснение: однобуквенный Виженер показывается как Цезарь', async () => {
  reset();
  const res = await solve('ZH DUH ZDLWLQJ');
  assert.equal(res[0].chain.map((c) => c.op).join(), 'caesar');
  const step = ctx.Solver.canonicalStep({ op: 'vigenere', params: { key: 'd', dir: 'dec', alpha: 'en', skip: true } }, 'ZH DUH');
  assert.deepEqual(JSON.parse(JSON.stringify(step)), { op: 'caesar', params: { alpha: 'en', n: -3 } });
});

test('«как есть»: уже читаемый текст и прямая ссылка не исключаются', async () => {
  reset();
  const res = await solve('the door is open');
  assert.equal(res[0].text, 'the door is open');
  assert.equal(res[0].asIs, true);
  assert.equal(res[0].chain.length, 0);
  // Уже читаемый вход — вероятный ответ, но не доказанный: в нём может прятаться ещё один слой.
  assert.equal(res[0].status, 'likely');
  assert.equal(res.verdict, 'candidates');
  const link = await solve('https://files.catbox.moe/1gukbv.png');
  assert.equal(link[0].text, 'https://files.catbox.moe/1gukbv.png');
  assert.equal(link[0].asIs, true);
  assert.equal(link.confident, true);
});

test('честное «убедительного результата нет»', async () => {
  reset();
  const res = await solve('qzxjvkw', { depth: 2 });
  assert.equal(res.confident, false);
  assert.equal(typeof res.threshold, 'number');
});

test('короткая естественная фраза не режется штрафом за частую букву', () => {
  reset();
  // 4 «e» из 12 букв (33%) — норма для короткой фразы.
  const short = ctx.Scorer.analyze('help me please', []);
  assert.ok(short.natural > 0.5, 'natural=' + short.natural);
  assert.ok(ctx.Scorer.topLetterLimit(12) > 0.34);
  assert.ok(ctx.Scorer.topLetterLimit(500) < 0.22 + 1e-9 || ctx.Scorer.topLetterLimit(500) < 0.2);
});

test('подготовка пробелов — явный шаг цепочки, оригинал сохраняется', async () => {
  reset();
  const res = await solve('kGP ojS Szb H8', { depth: 2 });
  const hit = res.find((r) => r.text === 'kGPojSSzbH8');
  assert.ok(hit, 'вариант без пробелов должен быть в выдаче');
  assert.equal(hit.chain.map((c) => c.op).join(), 'ws_prep');
  const layout = await solve('yfq lbv tyz');
  assert.ok(layout.some((r) => r.text === 'найдименя'));
  assert.ok(layout.some((r) => r.text === 'най дим еня'), 'вариант с пробелами тоже остаётся');
});

test('кандидаты из лога: hex внутри строки даёт stop с позицией в исходнике', async () => {
  reset();
  const log = 'jimmyy1[local:E:73746f70] logged in with entity id 65';
  const res = await solve(log);
  assert.equal(res[0].text, 'stop');
  assert.equal(res[0].chain[0].op, 'extract_candidates');
  assert.equal(res[0].source.start, log.indexOf('73746f70'));
  assert.equal(res[0].source.line, 1);
});

test('числа по модулю 26 дают текст (код с 27 и 30)', async () => {
  reset();
  const input = '27 12 12 15 6 20 8 5 4 15 20 19 1 18 5 6 9 14 1 12 12 25\n19 20 1 18 20 9 14 7 20 15 3 15 14 14 5 3 20,\n23 8 15 11 14 5 23 30 15 12 16 8 9 14 19 23 5 18 5 8 9\n4 9 14 7 19 15 13 21 3 8?';
  const res = await solve(input, { depth: 2 });
  assert.equal(res[0].text, 'ALLOFTHEDOTSAREFINALLYSTARTINGTOCONNECT WHOKNEWDOLPHINSWEREHIDINGSOMUCH');
});

test('нейтральный профиль не знает ключей mslan, профиль mslan — знает', async () => {
  reset();
  const neutral = await solve('h2njbrLB5kj', { depth: 1 });
  assert.ok(!neutral.some((r) => r.text === 'j2itqqQI5mk'));
  ctx.Profiles.setActive('mslan');
  const mslan = await solve('h2njbrLB5kj', { depth: 1 });
  assert.ok(mslan.some((r) => r.text === 'j2itqqQI5mk'));
  reset();
});

test('неоправданные шифрования не получают награды: stop ≠ pots', async () => {
  reset();
  const res = await solve('73746f70');
  assert.ok(res.findIndex((r) => r.text === 'stop') < res.findIndex((r) => r.text === 'pots') || !res.some((r) => r.text === 'pots'));
});
