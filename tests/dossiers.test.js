// Досье: встроенные данные целостны (ссылки на примеры, источники, статусы), свои досье создаются, правятся,
// копируются, удаляются, переносятся через JSON и хранятся в файле проекта. Меню примеров показывает всё.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFull } = require('./load');

const ctx = loadFull('en');
const D = ctx.Dossiers;
const reset = () => D.setCustom([]);
const plain = (v) => JSON.parse(JSON.stringify(v));

test('для каждого ARG из реестра есть встроенное досье и оно полное', () => {
  const ids = D.builtinList().map((d) => d.id);
  for (const arg of ctx.ArgCases.list) assert.ok(ids.includes(arg.id), 'нет досье ' + arg.id);
  assert.ok(!ids.includes('standard'), 'id «standard» зарезервирован за досье профиля');
  for (const d of D.builtinList()) {
    assert.ok(d.title && d.period && d.platform && d.creators && d.status && d.summary, d.id + ': не заполнены поля');
    assert.ok(d.sources.length >= 1 && d.stages.length >= 1 && d.techniques.length >= 1 && d.open.length >= 1, d.id + ': пустые разделы');
    assert.equal(d.builtin, true);
    for (const s of d.sources) {
      assert.ok(s.name && s.reliability !== 'unknown', d.id + ': источник без надёжности ' + s.name);
      assert.ok(!s.url || /^https?:\/\//.test(s.url), d.id + ': небезопасная ссылка');
    }
    for (const st of d.stages) assert.ok(D.STAGE_STATUS.some((x) => x[0] === st.status), d.id + ': статус ' + st.status);
  }
});

test('ссылки досье на примеры существуют, а каждый пример по ARG привязан к своему досье', () => {
  const presetIds = new Set(ctx.Presets.map((p) => p.id));
  const linked = new Map();
  for (const d of D.builtinList()) {
    for (const id of d.presets) {
      assert.ok(presetIds.has(id), d.id + ': нет примера ' + id);
      const preset = ctx.Presets.find((p) => p.id === id);
      assert.equal(preset.arg, d.arg, id + ': пример принадлежит другому ARG');
      linked.set(id, d.id);
    }
  }
  for (const p of ctx.Presets.filter((x) => x.arg)) assert.ok(linked.has(p.id), 'пример ' + p.id + ' не привязан к досье');
});

test('честные пометки в досье: расхождения и нерешённые этапы названы', () => {
  const stages = (id) => D.get(id).stages;
  assert.ok(stages('oldroot').some((s) => s.status === 'discrepancy' && /BEUORE/.test(s.result)));
  assert.ok(stages('endermite').some((s) => s.status === 'discrepancy' && /Variant Beaufort/.test(s.note)));
  assert.ok(stages('endermite').some((s) => s.status === 'unresolved' && /PG56/.test(s.result)));
  assert.ok(stages('portal').some((s) => s.status === 'discrepancy' && /9e107d9d372bb6826bd81d3542a419d6/.test(s.note)));
  assert.ok(stages('oxenfree').some((s) => s.status === 'discrepancy' && /extra I/.test(s.note)));
  assert.ok(stages('sombra').some((s) => /Salted__/.test(s.result)));
  assert.ok(stages('alphaver').some((s) => s.status === 'noinput'));
  assert.ok(stages('oldroot').some((s) => s.status === 'hypothesis'));
});

test('встроенные досье только для чтения, но копируются в редактируемую копию', () => {
  reset();
  assert.throws(() => D.save({ id: 'oldroot', title: 'x' }), /cannot be changed/);
  assert.throws(() => D.remove('oldroot'), /cannot be deleted/);
  const copy = D.duplicate('oldroot');
  assert.notEqual(copy.id, 'oldroot');
  assert.equal(copy.builtin, false);
  assert.match(copy.title, /OldRoot Mystery \(copy\)/);
  assert.equal(copy.stages.length, D.get('oldroot').stages.length);
  const edited = D.save({ ...copy, summary: 'мои заметки' });
  assert.equal(D.get(copy.id).summary, 'мои заметки');
  assert.equal(edited.id, copy.id);
  assert.notEqual(D.get('oldroot').summary, 'мои заметки');
  assert.equal(D.customList().length, 1);
  reset();
});

test('создание, правка и удаление своего досье', () => {
  reset();
  let fired = 0;
  D.onChange(() => { fired += 1; });
  const d = D.create({ title: 'Мой ARG' });
  assert.match(d.id, /^c-/);
  const saved = D.save({
    id: d.id, title: 'Мой ARG', period: '2026', platform: 'web', creators: 'аноним', status: 'в работе', summary: 'описание',
    sources: [{ name: 'Тред', url: 'https://example.com/t', reliability: 'mid', note: 'n' }],
    stages: [{ artifact: 'ZH DUH', technique: 'Caesar −3', result: 'WE ARE', status: 'verified', note: '' }, { artifact: '', technique: '', result: '' }],
    techniques: [{ name: 'Caesar', example: 'ZH → WE' }], open: ['вопрос', '  '], presets: ['or-caesar-waiting', 'or-caesar-waiting'], boards: ['b1'],
  });
  assert.equal(saved.stages.length, 1, 'пустой этап отбрасывается');
  assert.deepEqual(plain(saved.open), ['вопрос']);
  assert.deepEqual(plain(saved.presets), ['or-caesar-waiting']);
  assert.equal(D.list().length, D.builtinList().length + 1);
  assert.equal(D.presetsOf(saved)[0].id, 'or-caesar-waiting');
  assert.throws(() => D.save({ id: d.id, title: '   ' }), /no title/);
  assert.equal(D.remove(d.id), true);
  assert.equal(D.remove(d.id), false);
  assert.ok(fired >= 3, 'слушатель вызывается при правках');
  reset();
});

test('небезопасные ссылки и мусор в полях отбрасываются', () => {
  reset();
  const d = D.create({ title: 'T', sources: [{ name: 'a', url: 'javascript:alert(1)' }, { name: 'b', url: 'data:text/html,x' }, { name: 'c', url: 'https://ok.example/x' }], stages: [{ artifact: 'a', status: 'bogus' }] });
  assert.deepEqual(plain(d.sources.map((s) => s.url)), ['', '', 'https://ok.example/x']);
  assert.equal(d.stages[0].status, 'verified');
  assert.equal(D.safeUrl(' https://a.b/c '), 'https://a.b/c');
  assert.equal(D.safeUrl('ftp://a.b'), '');
  reset();
});

test('экспорт и импорт одного досье в JSON', () => {
  reset();
  const original = D.duplicate('hermatrix');
  const text = D.exportJSON(original.id);
  const file = JSON.parse(text);
  assert.equal(file.format, 'argdec-dossier');
  assert.equal(file.dossier.builtin, undefined);
  assert.match(D.fileName(original.id), /^dossier-.*\.json$/);
  // Тот же id занят — импорт получает новый.
  const imported = D.importJSON(text);
  assert.notEqual(imported.id, original.id);
  assert.equal(imported.title, original.title);
  assert.equal(imported.builtin, false);
  // Встроенный id при импорте тоже переназначается.
  const fromBuiltin = D.importJSON(D.exportJSON('oldroot'));
  assert.notEqual(fromBuiltin.id, 'oldroot');
  assert.equal(D.isBuiltin(fromBuiltin.id), false);
  assert.throws(() => D.importJSON('не json'), /not valid JSON/);
  assert.throws(() => D.importJSON('{"a":1}'), /not a dossier file/);
  assert.throws(() => D.importJSON(JSON.stringify({ format: 'argdec-dossier', version: 99, dossier: { title: 'x' } })), /newer version/);
  // Голый объект досье без обёртки тоже принимается.
  assert.equal(D.importJSON(JSON.stringify({ title: 'Голое' })).title, 'Голое');
  reset();
});

test('свои досье хранятся в файле проекта и в автосохранении', async () => {
  reset();
  const mine = D.create({ title: 'Хранимое', summary: 'живёт в проекте', presets: ['a11-hex'] });
  const P = ctx.Project;
  // Рабочее пространство кладёт customList() в проект перед сохранением.
  const project = { ...P.create({}), dossiers: D.customList() };
  const text = P.serialize(project, [], []);
  assert.equal(JSON.parse(text).dossiers[0].title, 'Хранимое');
  const parsed = P.parse(text);
  assert.equal(parsed.dossiers.length, 1);
  assert.equal(parsed.dossiers[0].id, mine.id);
  // Автосохранение: localStorage-подобное хранилище.
  const mem = new Map();
  const local = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const store = P.createStore({ local, idb: null });
  await store.save(project, []);
  reset();
  assert.equal(D.customList().length, 0);
  const loaded = await store.load();
  D.setCustom(loaded.project.dossiers);
  assert.equal(D.customList().length, 1);
  assert.equal(D.get(mine.id).summary, 'живёт в проекте');
  // Старый проект без досье открывается пустым списком; битые записи пропускаются.
  assert.deepEqual(plain(P.parse(JSON.stringify({ boards: [{ name: 'b', graph: { nodes: [], links: [] } }] })).dossiers), []);
  assert.equal(P.create({ dossiers: [null, 5, { title: '' }, { title: 'ok' }] }).dossiers.length, 1);
  reset();
});

test('меню примеров показывает все примеры, по группам ARG, и ищет', () => {
  const groups = ctx.ExamplesMenu.groupPresets(ctx.Presets);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  assert.equal(total, ctx.Presets.length, 'каждый пример в какой-то группе');
  const names = Array.from(groups, (g) => g.name);
  assert.equal(names[0], 'Start');
  const argOrder = Array.from(groups.filter((g) => g.arg), (g) => g.arg);
  assert.deepEqual(argOrder, Array.from(ctx.ArgCases.list, (a) => a.id).filter((id) => argOrder.includes(id)), 'порядок ARG как в реестре');
  assert.ok(argOrder.length >= 10);
  // Группы ARG идут раньше учебных и дела mslan.
  assert.ok(names.indexOf('OldRoot') < names.indexOf('Universal examples'));
  // Примеры дела mslan видны независимо от активного профиля.
  ctx.Profiles.setActive('neutral');
  assert.ok(groups.some((g) => g.items.some((p) => p.profile === 'mslan')));
  const search = (q) => ctx.Presets.filter((p) => ctx.ExamplesMenu.matches(p, q.toLowerCase()));
  assert.ok(search('cicada').some((p) => p.id === 'cic-shift'));
  assert.ok(search('md5').some((p) => p.id === 'pt-md5-phone'));
  assert.ok(search('lenore').some((p) => p.id === 'or-lenore'));
  assert.equal(search('no-such-thing-xyz').length, 0);
  assert.equal(search('').length, ctx.Presets.length);
});
