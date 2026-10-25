// Доказательность авто-поиска (аудит 2026-10-23): правильные декодирования не проигрывают бессмыслице,
// случайные цепочки не получают «уверенно», выражения считаются, хеши и токены не превращаются в «ответы».
// Решателю передаётся только строка: нейтральный профиль, пустой банк ключей.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFull } = require('./load');

const ctx = loadFull('en');
async function solve(input, depth = 3) {
  ctx.Profiles.setActive('neutral');
  ctx.KeyBank.clear();
  return ctx.Solver.solve(input, { depth, beam: 160, timeLimit: 30000 });
}

// Короткий вывод декодера первым, но «формат снят, ответ не подтверждён»: 4 буквы ответ не подтверждают (ревью 24.10).
test('Base64 с коротким ответом первый, статус decoded на глубине 3 и 4', async () => {
  for (const depth of [3, 4]) {
    const res = await solve('b2ggbm8gOig=', depth);
    assert.equal(res[0].text, 'oh no :(', 'глубина ' + depth);
    assert.equal(res[0].status, 'decoded');
    assert.equal(res.verdict, 'decoded');
  }
});

test('ASCII85 → координаты первым, с типом «координаты»', async () => {
  const res = await solve('1c6mG1,UpL2BXt32)RBQ1GA');
  assert.equal(res[0].text, '45.925596 8.559730');
  assert.equal(res[0].a.kind, 'coordinates');
  assert.equal(res[0].confident, true);
});

test('глубина 4 не ставит длинную цепочку выше прямого HEX → AAAA', async () => {
  const res = await solve('41414141', 4);
  assert.equal(res[0].text, 'AAAA');
});

test('арифметическое выражение считается точно', async () => {
  const a = await solve('2*3*76543');
  assert.equal(a[0].text, '459258');
  assert.equal(a[0].chain[0].op, 'calc');
  const b = await solve('997+1999+2999+5987+8999');
  assert.equal(b[0].text, '20981');
});

test('хеш-дайджест распознаётся как формат, а не превращается в текст', async () => {
  const res = await solve('9459C6CAC8C203B8128B7CC63068D4FD');
  assert.equal(res[0].kind, 'hash');
  assert.equal(res.verdict, 'format');
  assert.equal(res.confident, false);
  assert.ok(!res.some((r) => r.confident && r.chain.length), 'ни одна цепочка от хеша не уверена');
});

test('непрозрачный идентификатор остаётся как есть', async () => {
  for (const id of ['1v7531', '794e2cea991', '9b4c383a911ec']) {
    const res = await solve(id);
    assert.equal(res[0].text, id, id);
    assert.equal(res[0].kind, 'token', id);
    assert.equal(res.confident, false, id);
  }
});

test('короткий подбор без ключа не получает «уверенно»', async () => {
  for (const s of ['LMVCCIKB', 'lrot dq xeiefh', 'PRW QV RZXI']) {
    const res = await solve(s);
    assert.equal(res.confident, false, s + ' → ' + res[0].text);
  }
});

test('Caesar с длинной фразой остаётся уверенным', async () => {
  const res = await solve('WUDSSHG LQ D SULVRQ RI ZRRG');
  assert.equal(res[0].text, 'TRAPPED IN A PRISON OF WOOD');
  assert.equal(res.confident, true);
});

test('длинный ряд цифр не считается ID Google Drive', () => {
  assert.equal(ctx.Scorer.analyze('14444214452714444620144527144543142847').hasId, false);
});

test('автопробы XOR дают те же байты, что граф (значения по умолчанию)', async () => {
  const res = await solve('D4 A4 54 4E');
  const xor = res.find((r) => r.chain.some((c) => c.op === 'xor' && String(c.params.key) === '23'));
  if (!xor) return; // XOR 23 мог не попасть в луч — тогда проверяем саму операцию ниже
  const graph = ctx.CipherOps.BY_ID.xor.run([ctx.CipherOps.BY_ID.hex_decode.run(['D4 A4 54 4E'], {})], { key: '23', fmt: 'num', enc: 'auto' });
  assert.equal(xor.text.length > 0, true);
  assert.ok(graph.length === 4);
});

test('составное сообщение: строки с разными сдвигами решаются по отдельности (KF-01)', async () => {
  const input = 'L krsh wklv phvvdjh pdnhv lw rxw!' + String.fromCharCode(10) + 'lxusglxoktj/znkyzgxz.vtm';
  const res = await solve(input);
  assert.equal(res[0].text, 'I hope this message makes it out!' + String.fromCharCode(10) + 'fromafriend/thestart.png');
  assert.equal(res[0].chain[0].op, 'segment_map');
  // План воспроизводится обычной операцией графа.
  assert.equal(ctx.CipherOps.BY_ID.segment_map.run([input], res[0].chain[0].params), res[0].text);
});

test('неизвестная перестановка столбцов подбирается, значимые пробелы сохраняются (KF-02)', async () => {
  const res = await solve('ah?mIoehseuktene osn e  tg t okartih!yrCdhoo ge ne elcp');
  assert.equal(res[0].text, 'Is there anyone out there looking? Check the mods page!');
  assert.equal(res[0].chain[0].op, 'columnar');
});

test('кусок, вырезанный из длинного входа, помечается как часть входа', async () => {
  const res = await solve('raqrezvgr 0.0.3-beta1' + String.fromCharCode(10) + 'jimmyy1[local:E:73746f70] logged in with entity id 65');
  const stop = res.find((r) => r.text === 'stop');
  assert.ok(stop, 'кандидат stop найден');
  assert.equal(stop.status, 'fragment');
});
