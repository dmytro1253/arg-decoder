// Аудит 25.10.2026: жизненный цикл ключей (ARG-001/009), «есть что терять» и резервная копия (ARG-004/005),
// честные статусы Python-движка (ARG-002/003), подготовка пробелов и мусорные «вероятно» (ARG-006/007).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFull } = require('./load');

const G = loadFull('en');
const P = G.Project;

function memStorage() {
  const map = new Map();
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}
const plain = (v) => JSON.parse(JSON.stringify(v));   // объекты из контекста vm → обычные для deepEqual
const art = (id, text) => ({ id, name: id + '.txt', mime: 'text/plain', dataUrl: 'data:text/plain;base64,' + Buffer.from(text).toString('base64') });

test('ключи: банк → файл проекта → банк сохраняет значение, источник и время; старый проект со строками открывается', () => {
  G.KeyBank.clear();
  G.KeyBank.add('lantern', 'video title');
  const saved = plain(G.KeyBank.toJSON());
  const back = P.parse(P.serialize(P.create({}), [], G.KeyBank.toJSON()));
  G.KeyBank.clear();
  G.KeyBank.load(back.keys);
  assert.deepEqual(plain(G.KeyBank.toJSON()), saved);
  const old = P.normalize({ format: P.FORMAT, version: 1, boards: [], keys: ['LUCY'] });
  G.KeyBank.load(old.keys);
  assert.deepEqual(plain(G.KeyBank.values()), ['LUCY']);
  assert.equal(G.KeyBank.sourceOf('LUCY'), 'user');
});

test('ключи: автосохранение (память браузера) и снова в банк', async () => {
  const local = memStorage();
  const keys = [{ value: 'zombie', source: 'лог, строка 14', added: 1700000000000 }];
  await P.createStore({ local, idb: null }).save({ ...P.create({}), keys }, []);
  const loaded = await P.createStore({ local, idb: null }).load();
  assert.deepEqual(plain(loaded.project.keys), keys);
});

test('восстановленный ключ действительно используется авто-поиском', async () => {
  const text = 'meet me at the old stone bridge tonight';
  const cipher = G.CipherOps.BY_ID.vigenere.run([text], { key: 'lantern', dir: 'enc', alpha: 'en', skip: true });
  G.Profiles.setActive('neutral');
  G.KeyBank.clear();
  G.KeyBank.load(P.parse(P.serialize(P.create({}), [], [{ value: 'lantern', source: 'video title', added: 1 }])).keys);
  const res = await G.Solver.solve(cipher, { depth: 2, beam: 120, timeLimit: 10000, engines: false });
  assert.equal(res[0].text, text);
  assert.equal(res[0].userKey, 'lantern');
  G.KeyBank.clear();
});

test('проект с одними ключами или своим досье — не пустой; действительно пустой — пустой', () => {
  assert.equal(P.hasContent(P.create({})), false);
  assert.equal(P.hasContent(P.create({ keys: ['lantern'] })), true);
  assert.equal(P.hasContent({ ...P.create({}), dossiers: [{ id: 'd1', title: 'Моё досье' }] }), true);
});

test('резервная копия прошлого проекта: доски, ключи и вложения возвращаются; отдельно от автосохранения', async () => {
  const local = memStorage();
  const store = P.createStore({ local, idb: null });
  const prev = P.create({ name: 'Дело', boards: [{ name: 'A' }, { name: 'B' }], keys: [{ value: 'k1', source: 'user', added: 5 }] });
  const res = await store.saveBackup(prev, [art('a1', 'улика')]);
  assert.equal(res.ok, true);
  await store.save(P.create({ name: 'Новый' }), []);
  const back = await store.loadBackup();
  assert.equal(back.project.name, 'Дело');
  assert.equal(back.project.boards.length, 2);
  assert.deepEqual(plain(back.project.keys), [{ value: 'k1', source: 'user', added: 5 }]);
  assert.equal(back.project.artifacts.length, 1);
  assert.equal((await store.load()).project.name, 'Новый', 'автосохранение не тронуто');
});

test('статусы движка: коды сервера, английские и неизвестный (не успех)', () => {
  const s = G.API.engineStatus;
  assert.deepEqual(['идёт', 'готово', 'ошибка', 'остановлено', 'done', 'error', 'cancelled', 'что-то'].map(s), ['running', 'done', 'error', 'cancelled', 'done', 'error', 'cancelled', 'unknown']);
});

// Подменённый сервер: vigStart → задание, vigStatus → заданный ответ.
function fakeServer(answer) {
  const api = G.API;
  const saved = { online: api.online, pythonEngine: api.pythonEngine, vigStart: api.vigStart, vigStatus: api.vigStatus, vigStop: api.vigStop };
  Object.assign(api, { online: true, pythonEngine: async () => true, vigStart: async () => ({ id: 'j1', status: 'идёт', rows: [], log: [] }), vigStatus: async () => answer, vigStop: async () => ({}) });
  G.SolverEngines.resetCache();
  return () => { Object.assign(api, saved); G.SolverEngines.resetCache(); };
}

test('авто-поиск: «ошибка» сервера — ошибка с причиной, а не done; частичные кандидаты сохраняются', async () => {
  const row = { plain: 'hello', key: 'abc', alpha: 'en-26', keylen: 3 };
  for (const [answer, status, rows] of [
    [{ status: 'ошибка', rows: [], log: ['simulated engine error'] }, 'error', 0],
    [{ status: 'ошибка', rows: [row], log: ['simulated engine error'] }, 'error', 1],
    [{ status: 'странно', rows: [], log: [] }, 'error', 0],
    [{ status: 'остановлено', rows: [], log: [] }, 'cancelled', 0],
    [{ status: 'готово', rows: [row], log: [] }, 'done', 1],
  ]) {
    const restore = fakeServer(answer);
    try {
      const q = G.SolverEngines.queue({ budgetMs: 5000 });
      q.add('wklv lv d whvw phvvdjh iru wkh hqjlqh', { readable: false, linkConfirmed: false });
      const { rows: got, reports } = await q.wait(5000);
      assert.equal(reports[0].status, status, answer.status);
      assert.equal(got.length, rows, answer.status);
      if (status === 'error') assert.ok(reports[0].note, 'причина сбоя в отчёте: ' + answer.status);
    } finally { restore(); }
  }
});

test('панель Виженера: сбой с частичными результатами не подписывается «готово»', async () => {
  let restore = fakeServer({ status: 'ошибка', rows: [{ plain: 'hello', key: 'abc', alpha: 'en-26', keylen: 3, score: 1 }], log: ['out of memory'] });
  try {
    const out = await G.VigPython.run('wklv lv d whvw', {});
    assert.equal(out.state, 'error');
    assert.equal(out.rows.length, 1);
    assert.match(G.VigPython.outcome(out), /error|ошибка/i);
    assert.match(G.VigPython.outcome(out), /out of memory/);
  } finally { restore(); }
  restore = fakeServer({ status: 'ошибка', rows: [], log: ['broken'] });
  try { await assert.rejects(() => G.VigPython.run('wklv', {}), /broken/); } finally { restore(); }
});

async function solve(input) {
  G.Profiles.setActive('neutral');
  G.KeyBank.clear();
  return G.Solver.solve(input, { depth: 3, beam: 160, timeLimit: 15000, engines: false });
}

test('подготовка пробелов не создаёт уверенного решения из обычной фразы', async () => {
  for (const phrase of ['The river is quiet and the bridge is closed.', 'Ріка тиха, а міст сьогодні зачинено.']) {
    const res = await solve(phrase);
    const prepOnly = res.filter((r) => r.chain.length && r.chain.every((c) => c.op === 'ws_prep'));
    assert.ok(prepOnly.every((r) => r.status !== 'confident'), phrase);
    assert.notEqual(res.verdict, 'solved', phrase);
  }
  const hex = await solve('48 65 6c 6c 6f 20 77 6f 72 6c 64');
  assert.equal(hex[0].text, 'Hello world');
  assert.equal(hex[0].status, 'confident');
});

test('мусорные кандидаты не становятся «вероятно», настоящие короткие ответы остаются', async () => {
  for (const input of ['qjzxvkwp', '7e9ca731', 'RZQXJ KPVZT WQFNB XJGLD']) {
    const res = await solve(input);
    assert.ok(res.slice(0, 5).every((r) => r.status !== 'likely' && r.status !== 'confident'), input + ': ' + res.slice(0, 3).map((r) => r.status + ' ' + r.text).join(' | '));
  }
  const short = await solve('b2ggbm8gOig=');
  assert.equal(short[0].text, 'oh no :(');
});
