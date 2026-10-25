// Тесты рабочего пространства: проект с досками, миграция, хранение с запасным вариантом, аннотации, клавиатура SGA.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadEngine } = require('./load');

const WEB = path.join(__dirname, '..', 'web', 'js');
const { ctx, run } = loadEngine();
for (const f of ['annotations-model.js', 'project.js', 'kb-core.js', 'sga-keyboard.js']) vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), ctx, { filename: f });
const eq = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b); // объекты из vm-контекста сравниваем как обычный JSON
const P = ctx.Project;
const M = ctx.AnnotModel;
const SGA = ctx.SgaKeyboard;

const graphOf = (n) => ({ version: 2, nodes: Array.from({ length: n }, (_, i) => ({ id: 'n' + (i + 1), type: 'input', x: i * 10, y: 0, params: { text: 'a' + i } })), links: [] });
const dataUrl = (s) => 'data:text/plain;base64,' + Buffer.from(s).toString('base64');
const art = (id, body) => ({ id, kind: 'text', name: id + '.txt', mime: 'text/plain', dataUrl: dataUrl(body), size: body.length, created: null, sha256: null });

// Хранилище в памяти с ограничением объёма — для проверки запасного пути при переполнении.
function memStorage(limit) {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem(k, v) {
      const total = [...map].filter(([key]) => key !== k).reduce((n, [, val]) => n + val.length, 0) + v.length;
      if (limit !== undefined && total > limit) throw new Error('QuotaExceededError');
      map.set(k, String(v));
    },
    removeItem: (k) => { map.delete(k); },
  };
}
function memIdb(fail) {
  const map = new Map();
  return {
    map,
    get: async (k) => map.get(k),
    set: async (k, v) => { if (fail) throw new Error('idb broken'); map.set(k, v); },
    remove: async (k) => { map.delete(k); },
  };
}

test('новый проект: одна пустая доска, версия и идентификаторы', () => {
  const p = P.create({});
  assert.equal(p.boards.length, 1);
  assert.equal(p.activeBoardId, p.boards[0].id);
  assert.equal(p.version, P.VERSION);
  assert.equal(p.boards[0].graph.nodes.length, 0);
  eq(p.boards[0].annotations, []);
  assert.equal(p.boards[0].view.zoom, 1);
});

test('миграция: старый граф {nodes, links} становится проектом из одной доски', () => {
  const p = P.normalize(graphOf(3));
  assert.equal(p.boards.length, 1);
  assert.equal(p.boards[0].graph.nodes.length, 3);
  assert.throws(() => P.normalize({ foo: 1 }));
  assert.throws(() => P.normalize(null));
});

test('нормализация проекта: дубли id, мусорные доски, неверная активная доска', () => {
  const p = P.normalize({ boards: [{ id: 'b1', name: 'A', graph: graphOf(1) }, { id: 'b1', name: 'B' }, 5, null], activeBoardId: 'нет' });
  assert.equal(p.boards.length, 2);
  assert.notEqual(p.boards[0].id, p.boards[1].id);
  assert.equal(p.activeBoardId, p.boards[0].id);
  assert.equal(P.normalize({ boards: [] }).boards.length, 1);
});

test('файл из более новой версии отклоняется понятной ошибкой', () => {
  assert.throws(() => P.normalize({ version: 99, boards: [{}] }), /newer|нов/i);
});

test('пустая сохранённая доска остаётся пустой (не подменяется примером)', async () => {
  const local = memStorage();
  const store = P.createStore({ local, idb: null });
  const empty = P.create({ boards: [{ name: 'Пусто', graph: P.emptyGraph() }] });
  await store.save(empty, []);
  const loaded = await P.createStore({ local, idb: null }).load();
  assert.equal(loaded.project.boards[0].graph.nodes.length, 0);
});

test('операции над досками: добавить, переименовать, дублировать, переставить', () => {
  let p = P.create({ boards: [{ name: 'Один', graph: graphOf(2) }] });
  const first = p.boards[0].id;
  p = P.addBoard(p, P.createBoard({ name: 'Два' }));
  assert.equal(p.boards.length, 2);
  assert.equal(p.activeBoardId, p.boards[1].id);
  p = P.renameBoard(p, first, '  Новое имя ');
  assert.equal(p.boards[0].name, 'Новое имя');
  assert.equal(P.renameBoard(p, first, '   ').boards[0].name, 'Новое имя');
  const dup = P.duplicateBoard(p, first);
  assert.equal(dup.project.boards.length, 3);
  assert.notEqual(dup.board.id, first);
  assert.equal(dup.project.boards[1].id, dup.board.id);
  assert.equal(dup.board.graph.nodes.length, 2);
  dup.board.graph.nodes[0].params.text = 'изменено';
  assert.notEqual(p.boards[0].graph.nodes[0].params.text, 'изменено', 'копия не делит данные с оригиналом');
  const moved = P.moveBoard(dup.project, dup.board.id, 2);
  assert.equal(moved.boards[2].id, dup.board.id);
  assert.equal(P.moveBoard(moved, 'нет', 0), moved);
});

test('иммутабельность: операции не меняют исходный проект', () => {
  const p = P.create({});
  const snapshot = JSON.stringify(p);
  P.addBoard(p, P.createBoard({ name: 'X' }));
  P.renameBoard(p, p.boards[0].id, 'Y');
  P.removeBoard(p, p.boards[0].id);
  assert.equal(JSON.stringify(p), snapshot);
});

test('закрытие и возврат доски на прежнее место', () => {
  let p = P.create({ boards: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
  const b = p.boards[1];
  p = P.setActive(p, b.id);
  const res = P.removeBoard(p, b.id);
  assert.equal(res.project.boards.length, 2);
  assert.notEqual(res.project.activeBoardId, b.id);
  assert.equal(res.removed.index, 1);
  const back = P.restoreBoard(res.project, res.removed);
  eq(back.boards.map((x) => x.name), ['A', 'B', 'C']);
  assert.equal(back.activeBoardId, b.id);
});

test('закрытие последней доски создаёт пустую, а возврат её заменяет', () => {
  const p = P.create({ boards: [{ name: 'Единственная', graph: graphOf(2) }] });
  const res = P.removeBoard(p, p.boards[0].id);
  assert.equal(res.project.boards.length, 1);
  assert.equal(res.project.boards[0].graph.nodes.length, 0);
  const back = P.restoreBoard(res.project, res.removed);
  assert.equal(back.boards.length, 1);
  assert.equal(back.boards[0].graph.nodes.length, 2);
});

test('уникальное имя доски', () => {
  const p = P.create({ boards: [{ name: 'Лог' }, { name: 'Лог 2' }] });
  assert.equal(P.uniqueName(p, 'Лог'), 'Лог 3');
  assert.equal(P.uniqueName(p, 'Аудио'), 'Аудио');
});

test('файл проекта: круг сохранения с вложениями, ключами и аннотациями', () => {
  const shape = M.make('rect', { x: 1, y: 2, w: 30, h: 20, color: '#ff0000' });
  let p = P.create({ name: 'Дело/1', boards: [{ name: 'Лог', graph: graphOf(2), annotations: [shape], view: { pan: { x: 5, y: 6 }, zoom: 0.8 } }] });
  const text = P.serialize(p, [art('a1', 'привет')], [{ value: 'KEY', source: 'video title', added: 1700000000000 }]);
  const back = P.parse(text);
  assert.equal(back.name, 'Дело/1');
  assert.equal(back.artifacts.length, 1);
  assert.equal(Buffer.from(back.artifacts[0].dataUrl.split(',')[1], 'base64').toString(), 'привет');
  eq(back.keys, [{ value: 'KEY', source: 'video title', added: 1700000000000 }], 'ключ сохраняется с источником и временем');
  assert.equal(back.boards[0].annotations[0].type, 'rect');
  assert.equal(back.boards[0].view.zoom, 0.8);
  eq(back.boards[0].view.pan, { x: 5, y: 6 });
  assert.equal(back.boards[0].graph.version, 2, 'версия графа сохраняется');
  assert.match(P.fileName(p, '2026-10-20'), /^Дело_1-2026-10-20\.argproj\.json$/);
  assert.throws(() => P.parse('не json'), /JSON/);
});

test('вложения без dataURL отбрасываются, ключи очищаются (старый формат строк переносится)', () => {
  const p = P.create({ artifacts: [{ id: 'x', dataUrl: 'http://evil' }, art('ok', 'z'), null], keys: [' a ', '', 5, 'b', 'B', { value: 'c', source: 'лог' }, { source: 'x' }] });
  eq(p.artifacts.map((a) => a.id), ['ok']);
  eq(p.keys.map((k) => k.value), ['a', 'b', 'c'], 'пустые, нестроки и дубликаты без учёта регистра отброшены');
  eq(p.keys.map((k) => k.source), ['user', 'user', 'лог']);
});

test('автосохранение: проект и улики возвращаются после перезагрузки', async () => {
  const local = memStorage();
  const store = P.createStore({ local, idb: null });
  const p = P.create({ boards: [{ name: 'A', graph: graphOf(1) }] });
  const res = await store.save({ ...p, keys: [{ value: 'k', source: 'user' }].map((k) => k.value) }, [art('a1', 'data')]);
  assert.equal(res.ok, true);
  assert.equal(res.mode, 'local');
  const loaded = await P.createStore({ local, idb: null }).load();
  assert.equal(loaded.project.boards[0].graph.nodes.length, 1);
  assert.equal(loaded.artifacts.length, 1);
  assert.equal(loaded.migrated, false);
});

test('миграция один раз: argdec.graph переносится и убирается в резервный ключ', async () => {
  const local = memStorage();
  local.setItem(P.LEGACY_KEY, JSON.stringify(graphOf(4)));
  const loaded = await P.createStore({ local, idb: null }).load();
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.project.boards[0].graph.nodes.length, 4);
  assert.equal(local.getItem(P.LEGACY_KEY), null);
  assert.ok(local.getItem(P.LEGACY_BACKUP_KEY));
  assert.equal(await P.createStore({ local, idb: null }).load(), null, 'повторно без проекта миграция не нужна');
});

test('пусто в хранилище: load возвращает null; повреждённый проект даёт предупреждение', async () => {
  assert.equal(await P.createStore({ local: memStorage(), idb: null }).load(), null);
  const local = memStorage();
  local.setItem(P.STORAGE_KEY, '{оборвано');
  assert.equal(await P.createStore({ local, idb: null }).load(), null);
});

test('большие улики уходят в IndexedDB и возвращаются оттуда', async () => {
  const local = memStorage();
  const idb = memIdb();
  const store = P.createStore({ local, idb });
  const big = art('big', 'x'.repeat(P.LOCAL_ARTIFACTS_LIMIT));
  const res = await store.save(P.create({}), [big]);
  assert.equal(res.mode, 'idb');
  assert.equal(local.getItem(P.ARTIFACTS_KEY), null);
  const loaded = await P.createStore({ local, idb }).load();
  assert.equal(loaded.artifacts.length, 1);
  assert.equal(loaded.artifacts[0].id, 'big');
});

test('переполнение localStorage: улики переезжают в IndexedDB', async () => {
  const local = memStorage(60000);
  const idb = memIdb();
  const store = P.createStore({ local, idb });
  const res = await store.save(P.create({}), [art('a', 'y'.repeat(80000))]);
  assert.equal(res.mode, 'idb');
  assert.equal(res.ok, true);
  assert.equal(idb.map.size, 1);
});

test('нет IndexedDB и нет места: предупреждение вместо исключения, проект всё равно сохраняется', async () => {
  const local = memStorage(60000);
  const store = P.createStore({ local, idb: null });
  const res = await store.save(P.create({}), [art('a', 'y'.repeat(80000))]);
  assert.equal(res.ok, false);
  assert.ok(res.warnings.length > 0);
  assert.ok(local.getItem(P.STORAGE_KEY), 'сам проект записан');
});

test('сбой IndexedDB: предупреждение, а повтор пробует сохранить улики снова', async () => {
  const local = memStorage();
  const bad = memIdb(true);
  const store = P.createStore({ local, idb: bad });
  const big = art('big', 'x'.repeat(P.LOCAL_ARTIFACTS_LIMIT));
  const first = await store.save(P.create({}), [big]);
  assert.equal(first.ok, false);
  assert.equal(first.mode, 'lost');
  bad.set = async (k, v) => { bad.map.set(k, v); };
  const second = await store.save(P.create({}), [big]);
  assert.equal(second.mode, 'idb');
  assert.equal(second.ok, true);
});

test('полностью переполненное хранилище: save не бросает', async () => {
  const store = P.createStore({ local: memStorage(10), idb: null });
  const res = await store.save(P.create({}), []);
  assert.equal(res.ok, false);
  assert.ok(res.warnings.length);
});

// ---------- аннотации ----------
test('аннотации: проверка и нормализация фигур', () => {
  assert.equal(M.normalize({ type: 'нет' }), null);
  assert.equal(M.normalize({ type: 'pen', points: [] }), null);
  assert.equal(M.normalize({ type: 'text', text: '   ' }), null);
  const r = M.normalize({ type: 'rect', x: '5', y: 1, w: -40, h: 0, color: 'javascript:1', width: 999 });
  assert.equal(r.w, 40);
  assert.equal(r.h, M.MIN_SIZE);
  assert.equal(r.color, M.DEFAULT_COLOR);
  assert.equal(r.width, 40);
  const list = M.normalizeList([{ type: 'arrow', id: 'a' }, { type: 'arrow', id: 'a' }, null, 7]);
  assert.equal(list.length, 2);
  assert.notEqual(list[0].id, list[1].id);
});

test('аннотации: перенос и масштабирование не мутируют исходную фигуру', () => {
  const pen = M.make('pen', { points: [[0, 0], [10, 10], [20, 0]] });
  const moved = M.move(pen, 5, 5);
  eq(pen.points[0], [0, 0]);
  eq(moved.points[0], [5, 5]);
  const fitted = M.fit(pen, { x: 0, y: 0, w: 40, h: 20 });
  eq(M.bbox(fitted), { x: 0, y: 0, w: 40, h: 20 });
  const arrow = M.make('arrow', { x1: 0, y1: 0, x2: 10, y2: 10 });
  const big = M.fit(arrow, { x: 0, y: 0, w: 100, h: 100 });
  assert.equal(big.x2, 100);
  const text = M.make('text', { text: 'ab', x: 0, y: 0, size: 20 });
  assert.equal(M.fit(text, { x: 0, y: 0, w: 10, h: M.bbox(text).h * 2 }).size, 40);
});

test('аннотации: попадание курсора в линию, рамку и текст', () => {
  const line = M.make('arrow', { x1: 0, y1: 0, x2: 100, y2: 0, width: 2 });
  assert.ok(M.hit(line, 50, 3, 4));
  assert.ok(!M.hit(line, 50, 30, 4));
  const frame = M.make('rect', { x: 0, y: 0, w: 100, h: 100, width: 2 });
  assert.ok(M.hit(frame, 0, 50, 3), 'на границе');
  assert.ok(!M.hit(frame, 50, 50, 3), 'пустая рамка не ловит клик внутри');
  const filled = M.make('rect', { x: 0, y: 0, w: 100, h: 100, fill: true });
  assert.ok(M.hit(filled, 50, 50, 3));
  const oval = M.make('ellipse', { x: 0, y: 0, w: 100, h: 60, width: 2 });
  assert.ok(M.hit(oval, 50, 0, 3));
  assert.ok(!M.hit(oval, 50, 30, 3));
  const text = M.make('text', { text: 'привет', x: 10, y: 10, size: 20 });
  assert.ok(M.hit(text, 20, 20, 2));
  assert.equal(M.hitTop([filled, line], 50, 0, 3), 1, 'верхняя фигура — последняя в списке');
});

test('аннотации: ручки габарита не переворачивают и не схлопывают фигуру', () => {
  const box = { x: 10, y: 10, w: 100, h: 50 };
  eq(M.applyHandle(box, 'se', 20, 10), { x: 10, y: 10, w: 120, h: 60 });
  const squeezed = M.applyHandle(box, 'e', -500, 0);
  assert.equal(squeezed.w, M.MIN_SIZE);
  const nw = M.applyHandle(box, 'nw', 10, 10);
  eq(nw, { x: 20, y: 20, w: 90, h: 40 });
});

test('аннотации: стрелка с Shift ложится на углы кратные 45 градусам', () => {
  const [x, y] = M.snapAngle(0, 0, 100, 10);
  assert.equal(Math.round(y), 0);
  assert.ok(x > 99);
  const [dx, dy] = M.snapAngle(0, 0, 50, 45);
  assert.equal(Math.round(dx), Math.round(dy));
});

test('аннотации: путь карандаша и наконечник стрелки', () => {
  assert.equal(M.pathData([]), '');
  assert.match(M.pathData([[0, 0], [10, 10], [20, 0]]), /^M0,0 Q10,10 15,5 L20,0$/);
  assert.equal(M.arrowHead(M.make('arrow', { x1: 0, y1: 0, x2: 50, y2: 0 })).length, 3);
});

// ---------- клавиатура SGA ----------
test('SGA: 26 знаков и строки совпадают с таблицей в ops-arg.js', () => {
  assert.equal(SGA.GLYPHS.length, 26);
  for (const g of SGA.GLYPHS) assert.equal(g.glyph, run('sga_encode', g.latin), 'буква ' + g.latin);
  const word = 'thequickbrownfoxjumpsoverlazydog';
  assert.equal(run('sga_decode', SGA.encode(word)), word);
});

test('SGA: регистра нет, остальные символы сохраняются', () => {
  assert.equal(SGA.encode('IDAbC'), SGA.encode('idabc'));
  assert.equal(SGA.encode('a 1!'), SGA.GLYPHS[0].glyph + ' 1!');
});

test('SGA: backspace стирает знак целиком, даже из нескольких символов', () => {
  const t = SGA.GLYPHS.find((g) => g.latin === 't').glyph;
  const a = SGA.GLYPHS[0].glyph;
  const x = SGA.GLYPHS.find((g) => g.latin === 'x').glyph;
  const p = SGA.GLYPHS.find((g) => g.latin === 'p').glyph;
  assert.ok(t.length > 1 && x.length > 1);
  const s = a + t;
  eq(SGA.deleteBackward(s, s.length), { text: a, caret: a.length });
  assert.equal(SGA.deleteBackward(a + x, (a + x).length).text, a);
  assert.equal(SGA.deleteBackward(a + p + a, (a + p).length).text, a + a);
  eq(SGA.deleteBackward('abc', 3), { text: 'ab', caret: 2 });
  eq(SGA.deleteBackward('abc', 0), { text: 'abc', caret: 0 });
  eq(SGA.deleteBackward('abcdef', 1, 4), { text: 'aef', caret: 1 }, 'выделение удаляется целиком');
  const o = SGA.GLYPHS.find((g) => g.latin === 'o').glyph;
  assert.equal(SGA.deleteBackward(a + o, (a + o).length).text, a, 'символ вне BMP стирается целиком');
});

test('SGA: подсветка букв по набранному тексту и по готовым знакам', () => {
  eq([...SGA.matchLetters('Cab!')].sort(), ['a', 'b', 'c']);
  assert.ok(SGA.matchLetters(SGA.GLYPHS[5].glyph).has('f'));
});

test('новые файлы рабочего пространства короче 800 строк', () => {
  for (const f of ['project.js', 'annotations.js', 'annotations-model.js', 'annotations-toolbar.js', 'kb-core.js', 'sga-keyboard.js', 'kb-layouts.js', 'kb-special.js', 'keyboards.js', 'workspace.js', 'board-tabs.js', 'clipboard-paste.js', 'app.js', 'graph-view.js']) {
    const lines = fs.readFileSync(path.join(WEB, f), 'utf8').split('\n').length;
    assert.ok(lines < 800, f + ': ' + lines);
  }
});
