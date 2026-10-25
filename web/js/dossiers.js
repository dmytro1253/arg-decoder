// Досье расследований: модель данных, встроенные (только чтение) и свои досье проекта.
// Досье = { id, title, period, platform, creators, status, summary, sources[], stages[], techniques[], open[], presets[], boards[] }.
// Встроенные досье регистрируются файлами dossiers-data-*.js; свои хранятся в файле проекта (project.dossiers)
// и сохраняются автосохранением рабочего пространства. Здесь нет DOM — всё проверяется тестами Node.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const FORMAT = 'argdec-dossier';
  const VERSION = 1;
  const MAX_ITEMS = 200;
  const MAX_SHORT = 300;
  const MAX_LONG = 8000;
  const MAX_CUSTOM = 500;
  let counter = 0;

  /** Надёжность источника: от самой высокой к самой низкой (подписи — на языке интерфейса). */
  const RELIABILITY = [
    ['very-high', T('очень высокая', 'very high')],
    ['high', T('высокая', 'high')],
    ['mid-high', T('средне-высокая', 'medium-high')],
    ['mid', T('средняя', 'medium')],
    ['low-mid', T('средне-низкая', 'medium-low')],
    ['low', T('низкая', 'low')],
    ['unknown', T('не оценена', 'not rated')],
  ];
  /** Статус этапа цепочки. */
  const STAGE_STATUS = [
    ['verified', T('проверено точно', 'verified exactly')],
    ['discrepancy', T('расхождение источника', 'source discrepancy')],
    ['unresolved', T('не разгадано', 'unresolved')],
    ['noinput', T('точный вход недоступен', 'exact input unavailable')],
    ['hypothesis', T('гипотеза', 'hypothesis')],
    ['context', T('нужен контекст или внешний шаг', 'needs context or an outside step')],
  ];
  const RELIABILITY_IDS = RELIABILITY.map((x) => x[0]);
  const STATUS_IDS = STAGE_STATUS.map((x) => x[0]);

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const str = (v, max) => String(v === undefined || v === null ? '' : v).slice(0, max || MAX_SHORT);
  const arr = (v) => (Array.isArray(v) ? v.slice(0, MAX_ITEMS) : []);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const uniq = (list) => [...new Set(list)];
  /** Ссылки показываются только если это http(s): остальное (javascript:, data:) отбрасывается. */
  const safeUrl = (v) => { const u = str(v, 500).trim(); return /^https?:\/\/[^\s]+$/i.test(u) ? u : ''; };

  function newId() {
    counter += 1;
    return 'c-' + Date.now().toString(36) + counter.toString(36) + Math.floor(Math.random() * 46656).toString(36);
  }

  // ---------- нормализация ----------
  function normalizeSource(raw) {
    const s = isObj(raw) ? raw : { name: raw };
    return { name: str(s.name), url: safeUrl(s.url), reliability: RELIABILITY_IDS.includes(s.reliability) ? s.reliability : 'unknown', note: str(s.note, MAX_LONG) };
  }
  function normalizeStage(raw) {
    const s = isObj(raw) ? raw : {};
    return { artifact: str(s.artifact, MAX_LONG), technique: str(s.technique, MAX_LONG), result: str(s.result, MAX_LONG), status: STATUS_IDS.includes(s.status) ? s.status : 'verified', note: str(s.note, MAX_LONG) };
  }
  function normalizeTechnique(raw) {
    if (Array.isArray(raw)) return { name: str(raw[0]), example: str(raw[1], MAX_LONG) };
    const t = isObj(raw) ? raw : { name: raw };
    return { name: str(t.name), example: str(t.example, MAX_LONG) };
  }

  /** Любой вход → досье текущей формы. opts.builtin помечает встроенное. Пустое название — ошибка. */
  function normalize(raw, opts) {
    if (!isObj(raw)) throw new Error(T('это не досье', 'this is not a dossier'));
    const d = {
      id: str(raw.id, 80).trim() || newId(),
      title: str(raw.title, 160).trim(),
      period: str(raw.period), platform: str(raw.platform), creators: str(raw.creators), status: str(raw.status),
      summary: str(raw.summary, MAX_LONG),
      sources: arr(raw.sources).map(normalizeSource).filter((s) => s.name || s.url),
      stages: arr(raw.stages).map(normalizeStage).filter((s) => s.artifact || s.technique || s.result),
      techniques: arr(raw.techniques).map(normalizeTechnique).filter((t) => t.name),
      open: arr(raw.open).map((x) => str(x, MAX_LONG)).filter((x) => x.trim()),
      presets: uniq(arr(raw.presets).map((x) => str(x, 80)).filter(Boolean)),
      boards: uniq(arr(raw.boards).map((x) => str(x, 80)).filter(Boolean)),
      builtin: !!(opts && opts.builtin),
    };
    if (raw.arg) d.arg = str(raw.arg, 40);
    if (!d.title) throw new Error(T('у досье нет названия', 'the dossier has no title'));
    return d;
  }

  function normalizeList(list) {
    const out = [];
    const seen = new Set();
    for (const raw of arr(list)) {
      let d;
      try { d = normalize(raw); } catch (e) { continue; }
      d.builtin = false;
      if (seen.has(d.id)) d.id = newId();
      seen.add(d.id);
      out.push(d);
      if (out.length >= MAX_CUSTOM) break;
    }
    return out;
  }

  // ---------- реестр ----------
  const builtins = [];
  let custom = [];
  const listeners = [];
  const notify = () => { for (const fn of listeners) { try { fn(); } catch (e) { /* слушатель не должен ломать досье */ } } };

  const freeze = (d) => Object.freeze(Object.assign(d, { sources: Object.freeze(d.sources), stages: Object.freeze(d.stages) }));

  const Dossiers = {
    FORMAT, VERSION, RELIABILITY, STAGE_STATUS,
    reliabilityLabel: (id) => (RELIABILITY.find((x) => x[0] === id) || RELIABILITY[RELIABILITY.length - 1])[1],
    statusLabel: (id) => (STAGE_STATUS.find((x) => x[0] === id) || STAGE_STATUS[0])[1],
    safeUrl, normalize, normalizeList,

    /** Регистрирует встроенное досье (только чтение). */
    register(spec) {
      const d = freeze(normalize(spec, { builtin: true }));
      if (builtins.some((b) => b.id === d.id)) throw new Error('duplicate dossier id ' + d.id);
      builtins.push(d);
      return d;
    },
    builtinList() { return builtins.slice(); },
    customList() { return clone(custom); },
    list() { return builtins.concat(custom); },
    get(id) { return builtins.find((d) => d.id === id) || custom.find((d) => d.id === id) || null; },
    isBuiltin(id) { return builtins.some((d) => d.id === id); },

    /** Заменяет свои досье (загрузка проекта). Слушателей не зовёт: это не правка пользователя. */
    setCustom(list) { custom = normalizeList(list); },

    /** Создаёт или обновляет СВОЁ досье. Встроенные перезаписывать нельзя. */
    save(raw) {
      const id = raw && raw.id;
      if (id && Dossiers.isBuiltin(id)) throw new Error(T('Встроенное досье нельзя изменить — сделайте копию', 'A built-in dossier cannot be changed: make a copy'));
      const d = normalize(raw);
      d.builtin = false;
      const at = custom.findIndex((x) => x.id === d.id);
      if (at < 0 && custom.length >= MAX_CUSTOM) throw new Error(T('Слишком много своих досье', 'Too many custom dossiers'));
      custom = at < 0 ? custom.concat([d]) : custom.map((x, i) => (i === at ? d : x));
      notify();
      return clone(d);
    },

    create(partial) {
      const base = Object.assign({ title: T('Новое досье', 'New dossier') }, partial || {}, { id: undefined });
      return Dossiers.save(base);
    },

    remove(id) {
      if (Dossiers.isBuiltin(id)) throw new Error(T('Встроенное досье удалить нельзя', 'A built-in dossier cannot be deleted'));
      const next = custom.filter((d) => d.id !== id);
      if (next.length === custom.length) return false;
      custom = next;
      notify();
      return true;
    },

    /** Копия любого досье (в том числе встроенного) — свой редактируемый экземпляр. */
    duplicate(id) {
      const src = Dossiers.get(id);
      if (!src) throw new Error(T('Нет такого досье', 'No such dossier'));
      const copy = clone(src);
      delete copy.arg;
      return Dossiers.save(Object.assign(copy, { id: undefined, title: str(src.title, 140) + T(' (копия)', ' (copy)') }));
    },

    /** Одно досье → JSON-файл (общий формат с отметкой версии). */
    exportJSON(id) {
      const d = Dossiers.get(id);
      if (!d) throw new Error(T('Нет такого досье', 'No such dossier'));
      const copy = clone(d);
      delete copy.builtin;
      return JSON.stringify({ format: FORMAT, version: VERSION, dossier: copy }, null, 2);
    },
    fileName(id) {
      const d = Dossiers.get(id);
      const safe = str(d ? d.title : 'dossier', 40).replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '') || 'dossier';
      return 'dossier-' + safe + '.json';
    },

    /** Импорт: JSON-файл досье добавляется как своё; id перевыдаётся, если он занят. */
    importJSON(text) {
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error(T('файл не читается как JSON', 'the file is not valid JSON')); }
      const raw = isObj(data) && data.format === FORMAT ? data.dossier : (isObj(data) && data.title ? data : null);
      if (!raw) throw new Error(T('это не файл досье', 'this is not a dossier file'));
      if (isObj(data) && Number(data.version) > VERSION) throw new Error(T('файл создан более новой версией программы', 'the file was made by a newer version'));
      const d = normalize(raw);
      const taken = Dossiers.get(d.id);
      return Dossiers.save(Object.assign(d, { id: taken ? undefined : d.id }));
    },

    /** Примеры досье, которые есть в этой сборке (устаревшие id молча пропускаются). */
    presetsOf(d) {
      const all = G.Presets || [];
      return (d.presets || []).map((id) => all.find((p) => p.id === id)).filter(Boolean);
    },

    onChange(fn) { listeners.push(fn); },
  };

  G.Dossiers = Dossiers;
})(typeof self !== 'undefined' ? self : this);
