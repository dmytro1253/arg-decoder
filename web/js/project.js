// Проект расследования: несколько досок (вкладок), общий банк улик и ключей, версионируемый формат файла.
// Здесь только чистая логика (без DOM) и слой хранения с подменяемыми хранилищами — всё проверяется тестами Node.
(function (G) {
  'use strict';
  const FORMAT = 'argdec-project';
  const VERSION = 1;
  const STORAGE_KEY = 'argdec.project';
  const ARTIFACTS_KEY = 'argdec.project.artifacts';
  const LEGACY_KEY = 'argdec.graph';
  const LEGACY_BACKUP_KEY = 'argdec.graph.bak';
  const FILE_EXT = '.argproj.json';
  const IDB_NAME = 'argdec';
  const IDB_STORE = 'kv';
  const IDB_ARTIFACTS = 'artifacts';
  // Улики крупнее этого порога (в символах JSON) сразу уходят в IndexedDB: localStorage ограничен ~5 МБ.
  const LOCAL_ARTIFACTS_LIMIT = 1500000;
  const MAX_CLOSED = 20;
  const DEFAULT_VIEW = { pan: { x: 40, y: 40 }, zoom: 1 };
  const ZOOM_MIN = 0.3;
  const ZOOM_MAX = 1.6;
  let counter = 0;

  const T = (ru, en) => (G.T ? G.T(ru, en) : ru);
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const clone = (v) => JSON.parse(JSON.stringify(v));

  function newId(prefix) {
    counter += 1;
    return prefix + Date.now().toString(36) + counter.toString(36) + Math.floor(Math.random() * 46656).toString(36);
  }

  const GRAPH_VERSION = 2;
  const emptyGraph = () => ({ version: GRAPH_VERSION, nodes: [], links: [] });

  // ---------- нормализация ----------
  function normalizeView(v) {
    const pan = isObj(v) && isObj(v.pan) ? v.pan : {};
    const px = Number(pan.x), py = Number(pan.y), z = Number(isObj(v) ? v.zoom : NaN);
    return {
      pan: { x: Number.isFinite(px) ? px : DEFAULT_VIEW.pan.x, y: Number.isFinite(py) ? py : DEFAULT_VIEW.pan.y },
      zoom: Number.isFinite(z) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) : DEFAULT_VIEW.zoom,
    };
  }

  function normalizeGraph(g) {
    if (!isObj(g) || !Array.isArray(g.nodes)) return emptyGraph();
    return { version: Number.isFinite(Number(g.version)) ? Number(g.version) : 1, nodes: clone(g.nodes), links: Array.isArray(g.links) ? clone(g.links) : [] };
  }

  function normalizeAnnotations(list) {
    return G.AnnotModel ? G.AnnotModel.normalizeList(list) : (Array.isArray(list) ? clone(list) : []);
  }

  function createBoard(opts) {
    const o = opts || {};
    return {
      id: typeof o.id === 'string' && o.id ? o.id : newId('b'),
      name: String(o.name || T('Доска', 'Board')).slice(0, 80),
      graph: normalizeGraph(o.graph),
      view: normalizeView(o.view),
      annotations: normalizeAnnotations(o.annotations),
      // Из какого примера создана доска — для карточки-гида (пусто у обычных досок).
      presetId: typeof o.presetId === 'string' ? o.presetId.slice(0, 80) : '',
    };
  }

  function normalizeBoards(list) {
    const seen = new Set();
    const boards = [];
    for (const raw of Array.isArray(list) ? list : []) {
      if (!isObj(raw)) continue;
      const b = createBoard(raw);
      boards.push(seen.has(b.id) ? { ...b, id: newId('b') } : b);
      seen.add(boards[boards.length - 1].id);
    }
    return boards;
  }

  function normalizeArtifacts(list) {
    return (Array.isArray(list) ? list : []).filter((a) => isObj(a) && typeof a.id === 'string' && typeof a.dataUrl === 'string' && a.dataUrl.startsWith('data:'));
  }

  function normalizeKeys(list) {
    return (Array.isArray(list) ? list : []).filter((k) => typeof k === 'string' && k.trim()).map((k) => k.trim());
  }

  // Свои досье проекта: нормализует модель досье (dossiers.js), а если она не загружена — отбрасывает всё, кроме объектов с названием.
  function normalizeDossiers(list) {
    if (G.Dossiers) return G.Dossiers.normalizeList(list);
    return (Array.isArray(list) ? list : []).filter((d) => isObj(d) && typeof d.title === 'string' && d.title.trim()).map(clone);
  }

  /** Новый проект. Без досок создаётся одна пустая. */
  function create(opts) {
    const o = opts || {};
    const now = new Date().toISOString();
    let boards = normalizeBoards(o.boards);
    if (!boards.length) boards = [createBoard({ name: T('Доска 1', 'Board 1') })];
    return {
      format: FORMAT,
      version: VERSION,
      id: o.id || newId('p'),
      name: String(o.name || T('Расследование', 'Investigation')).slice(0, 80),
      boards,
      activeBoardId: boards.some((b) => b.id === o.activeBoardId) ? o.activeBoardId : boards[0].id,
      artifacts: normalizeArtifacts(o.artifacts),
      keys: normalizeKeys(o.keys),
      dossiers: normalizeDossiers(o.dossiers),
      created: o.created || now,
      updated: o.updated || now,
    };
  }

  /** Старый одиночный граф ({nodes, links}) становится проектом из одной доски. */
  function fromLegacyGraph(graph, name) {
    if (!isObj(graph) || !Array.isArray(graph.nodes)) throw new Error(T('в файле нет списка нод', 'the file has no node list'));
    return create({ boards: [{ name: name || T('Доска 1', 'Board 1'), graph }] });
  }

  /** Любой допустимый вход (проект любой версии или старый граф) → проект текущей версии. */
  function normalize(data) {
    if (!isObj(data)) throw new Error(T('это не файл проекта', 'this is not a project file'));
    if (Array.isArray(data.boards)) {
      if (Number(data.version) > VERSION) throw new Error(T('файл создан более новой версией программы (формат ' + data.version + ')', 'the file was made by a newer version (format ' + data.version + ')'));
      return create(data);
    }
    if (Array.isArray(data.nodes)) return fromLegacyGraph(data);
    throw new Error(T('это не файл проекта и не граф', 'this is neither a project nor a graph file'));
  }

  const isProjectData = (data) => isObj(data) && Array.isArray(data.boards);

  // ---------- операции над досками (иммутабельно) ----------
  const touch = (p) => ({ ...p, updated: new Date().toISOString() });
  const boardIndex = (p, id) => p.boards.findIndex((b) => b.id === id);
  const activeBoard = (p) => p.boards.find((b) => b.id === p.activeBoardId) || p.boards[0];

  function uniqueName(p, base) {
    const taken = new Set(p.boards.map((b) => b.name));
    if (!taken.has(base)) return base;
    for (let i = 2; ; i++) if (!taken.has(base + ' ' + i)) return base + ' ' + i;
  }

  function defaultBoardName(p) {
    let n = p.boards.length + 1;
    const taken = new Set(p.boards.map((b) => b.name));
    while (taken.has(T('Доска ', 'Board ') + n)) n++;
    return T('Доска ', 'Board ') + n;
  }

  function setActive(p, id) {
    return boardIndex(p, id) < 0 ? p : touch({ ...p, activeBoardId: id });
  }

  function addBoard(p, board, opts) {
    const o = opts || {};
    const b = board.id && boardIndex(p, board.id) < 0 ? board : { ...board, id: newId('b') };
    const at = o.index === undefined ? p.boards.length : Math.max(0, Math.min(p.boards.length, o.index));
    const boards = [...p.boards.slice(0, at), b, ...p.boards.slice(at)];
    return touch({ ...p, boards, activeBoardId: o.activate === false ? p.activeBoardId : b.id });
  }

  /** Удаляет доску. Последняя доска не пропадает, а заменяется пустой. Возвращает проект и данные для восстановления. */
  function removeBoard(p, id) {
    const index = boardIndex(p, id);
    if (index < 0) return { project: p, removed: null };
    const removed = { board: p.boards[index], index };
    let boards = p.boards.filter((b) => b.id !== id);
    if (!boards.length) boards = [createBoard({ name: T('Доска 1', 'Board 1') })];
    const next = boards[Math.min(index, boards.length - 1)];
    const activeBoardId = p.activeBoardId === id ? next.id : p.activeBoardId;
    return { project: touch({ ...p, boards, activeBoardId }), removed };
  }

  function restoreBoard(p, removed) {
    if (!removed || !removed.board) return p;
    // Если после закрытия единственной доски появилась автоматическая пустая — она уступает место.
    const only = p.boards.length === 1 && removed.index === 0 && isPristineBoard(p.boards[0]) ? [] : p.boards;
    return addBoard({ ...p, boards: only }, removed.board, { index: removed.index, activate: true });
  }

  function renameBoard(p, id, name) {
    const clean = String(name || '').trim().slice(0, 80);
    if (!clean || boardIndex(p, id) < 0) return p;
    return touch({ ...p, boards: p.boards.map((b) => (b.id === id ? { ...b, name: clean } : b)) });
  }

  function updateBoard(p, id, patch) {
    if (boardIndex(p, id) < 0) return p;
    return { ...p, boards: p.boards.map((b) => (b.id === id ? { ...b, ...patch } : b)) };
  }

  function duplicateBoard(p, id) {
    const index = boardIndex(p, id);
    if (index < 0) return { project: p, board: null };
    const src = p.boards[index];
    const board = { ...clone(src), id: newId('b'), name: uniqueName(p, src.name + T(' (копия)', ' (copy)')) };
    return { project: addBoard(p, board, { index: index + 1 }), board };
  }

  function moveBoard(p, id, toIndex) {
    const from = boardIndex(p, id);
    if (from < 0) return p;
    const to = Math.max(0, Math.min(p.boards.length - 1, toIndex));
    if (from === to) return p;
    const boards = p.boards.slice();
    const [b] = boards.splice(from, 1);
    boards.splice(to, 0, b);
    return touch({ ...p, boards });
  }

  const isPristineBoard = (b) => !b.graph.nodes.length && !b.annotations.length;
  /** Есть ли в проекте что терять: ноды, рисунки, улики. */
  function hasContent(p) {
    return p.boards.length > 1 || p.boards.some((b) => !isPristineBoard(b)) || p.artifacts.length > 0;
  }

  // ---------- файл проекта ----------
  function withPayload(p, artifacts, keys) {
    return { ...p, artifacts: normalizeArtifacts(artifacts || p.artifacts), keys: normalizeKeys(keys || p.keys) };
  }

  function serialize(p, artifacts, keys) {
    return JSON.stringify(withPayload(p, artifacts, keys), null, 1);
  }

  function parse(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error(T('файл не читается как JSON: ', 'the file is not valid JSON: ') + e.message); }
    return normalize(data);
  }

  function fileName(p, date) {
    const safe = String(p.name || 'project').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 40) || 'project';
    return safe + '-' + (date || new Date().toISOString().slice(0, 10)) + FILE_EXT;
  }

  /** Отпечаток набора улик: если он не изменился, тяжёлую запись улик пропускаем. */
  const artifactsSignature = (list) => list.map((a) => a.id + ':' + a.dataUrl.length).join('|');

  // ---------- хранение: localStorage + IndexedDB ----------
  function browserIdb(factory) {
    const idb = factory || (typeof indexedDB !== 'undefined' ? indexedDB : null);
    if (!idb) return null;
    const open = () => new Promise((resolve, reject) => {
      const req = idb.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB'));
    });
    const run = async (mode, fn) => {
      const db = await open();
      try {
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, mode);
          const req = fn(tx.objectStore(IDB_STORE));
          tx.oncomplete = () => resolve(req ? req.result : undefined);
          tx.onerror = () => reject(tx.error || new Error('IndexedDB'));
          tx.onabort = () => reject(tx.error || new Error('IndexedDB'));
        });
      } finally { db.close(); }
    };
    return {
      get: (key) => run('readonly', (s) => s.get(key)),
      set: (key, value) => run('readwrite', (s) => s.put(value, key)),
      remove: (key) => run('readwrite', (s) => s.delete(key)),
    };
  }

  const errText = (e) => (e && e.message) || String(e);

  /**
   * Хранилище проекта. backends: { local: Storage-подобный объект, idb: {get,set,remove} | null }.
   * Структура: основной ключ — проект без улик; улики — отдельным ключом (localStorage) или в IndexedDB.
   */
  function createStore(backends) {
    const local = backends.local;
    const idb = backends.idb || null;
    let lastSig = null;
    let lastMode = 'local';

    const lsGet = (k) => { try { return local.getItem(k); } catch (e) { return null; } };
    const lsRemove = (k) => { try { local.removeItem(k); } catch (e) { /* не страшно */ } };

    async function storeArtifacts(list, warnings) {
      const sig = artifactsSignature(list);
      if (sig === lastSig) return lastMode;
      let mode = 'none';
      if (list.length) {
        const text = JSON.stringify(list);
        if (text.length <= LOCAL_ARTIFACTS_LIMIT) {
          try { local.setItem(ARTIFACTS_KEY, text); mode = 'local'; } catch (e) { mode = 'idb'; }
        } else mode = 'idb';
        if (mode === 'idb') {
          if (!idb) { mode = 'lost'; warnings.push(T('Улики слишком велики для памяти браузера. Сохрани проект в файл (Ctrl+S), иначе вложения пропадут после перезагрузки.', 'Evidence files are too large for browser storage. Save the project to a file (Ctrl+S) or attachments will be lost on reload.')); }
          else {
            try { await idb.set(IDB_ARTIFACTS, text); lsRemove(ARTIFACTS_KEY); } catch (e) {
              mode = 'lost';
              warnings.push(T('Не удалось сохранить улики в IndexedDB (' + errText(e) + '). Сохрани проект в файл (Ctrl+S).', 'Could not store evidence in IndexedDB (' + errText(e) + '). Save the project to a file (Ctrl+S).'));
            }
          }
        } else if (idb) { idb.remove(IDB_ARTIFACTS).catch(() => {}); }
      } else {
        lsRemove(ARTIFACTS_KEY);
        if (idb) idb.remove(IDB_ARTIFACTS).catch(() => {});
      }
      lastSig = mode === 'lost' ? null : sig; // потерянное пробуем сохранить снова при следующем автосохранении
      lastMode = mode;
      return mode;
    }

    /** Сохраняет проект. Не бросает: возвращает { ok, mode, warnings }. */
    async function save(project, artifacts) {
      const warnings = [];
      const list = normalizeArtifacts(artifacts);
      const mode = await storeArtifacts(list, warnings);
      const main = { ...project, artifacts: [], keys: normalizeKeys(project.keys), artifactsIn: mode, artifactCount: list.length };
      try {
        local.setItem(STORAGE_KEY, JSON.stringify(main));
      } catch (e) {
        warnings.push(T('Память браузера заполнена — проект не сохранён автоматически. Сохрани его в файл (Ctrl+S).', 'Browser storage is full — the project was not autosaved. Save it to a file (Ctrl+S).'));
        return { ok: false, mode, warnings };
      }
      return { ok: warnings.length === 0, mode, warnings };
    }

    /** Читает проект и улики. Возвращает null, если ничего не сохранено. */
    async function load() {
      const warnings = [];
      const raw = lsGet(STORAGE_KEY);
      if (raw) {
        let data;
        try { data = JSON.parse(raw); } catch (e) { data = null; warnings.push(T('Сохранённый проект повреждён и пропущен.', 'The saved project is damaged and was skipped.')); }
        if (data) {
          const project = normalize(data);
          const artifacts = await readArtifacts(data.artifactsIn, data.artifactCount, warnings);
          lastSig = artifactsSignature(artifacts);
          lastMode = data.artifactsIn === 'lost' ? 'local' : (data.artifactsIn || 'none');
          return { project: { ...project, artifacts }, artifacts, warnings, migrated: false };
        }
      }
      return migrateLegacy(warnings);
    }

    async function readArtifacts(where, count, warnings) {
      let text = null;
      try {
        if (where === 'idb') text = idb ? await idb.get(IDB_ARTIFACTS) : null;
        else if (where === 'local') text = lsGet(ARTIFACTS_KEY);
      } catch (e) { text = null; }
      if (!text) {
        if (count || where === 'lost') warnings.push(T('Вложения проекта не найдены в памяти браузера. Открой сохранённый файл проекта.', 'Project attachments were not found in browser storage. Open the saved project file.'));
        return [];
      }
      try { return normalizeArtifacts(JSON.parse(text)); } catch (e) {
        warnings.push(T('Вложения проекта повреждены.', 'Project attachments are damaged.'));
        return [];
      }
    }

    // Старый одиночный граф переносится один раз: копия остаётся в резервном ключе.
    function migrateLegacy(warnings) {
      const raw = lsGet(LEGACY_KEY);
      if (!raw) return null;
      let graph;
      try { graph = JSON.parse(raw); } catch (e) { graph = null; }
      if (!graph || !Array.isArray(graph.nodes)) return null;
      const project = fromLegacyGraph(graph);
      try { local.setItem(LEGACY_BACKUP_KEY, raw); local.removeItem(LEGACY_KEY); } catch (e) { warnings.push(T('Старый граф перенесён, но резервную копию записать не удалось.', 'The old graph was migrated but a backup copy could not be written.')); }
      return { project, artifacts: [], warnings, migrated: true };
    }

    return { save, load };
  }

  G.Project = {
    FORMAT, VERSION, STORAGE_KEY, ARTIFACTS_KEY, LEGACY_KEY, LEGACY_BACKUP_KEY, FILE_EXT, MAX_CLOSED, LOCAL_ARTIFACTS_LIMIT,
    newId, emptyGraph, createBoard, create, fromLegacyGraph, normalize, isProjectData,
    activeBoard, boardIndex, uniqueName, defaultBoardName, setActive, addBoard, removeBoard, restoreBoard,
    renameBoard, updateBoard, duplicateBoard, moveBoard, hasContent, isPristineBoard, touch,
    withPayload, serialize, parse, fileName, artifactsSignature,
    browserIdb, createStore,
  };
})(typeof self !== 'undefined' ? self : this);
