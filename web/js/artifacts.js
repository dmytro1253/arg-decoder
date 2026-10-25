// Хранилище артефактов расследования: изображения, звук, видео, файлы.
// В графе значения — строки, поэтому артефакт передаётся между нодами «ручкой» вида
// "artifact:<id>". Исходные байты хранятся неизменными (dataURL), производные версии —
// только в памяти и пересчитываются по рецепту.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const PREFIX = 'artifact:';
  const items = new Map();      // id -> { id, kind, name, mime, dataUrl, size, created, sha256?, derived? }
  const runtime = new Map();    // id -> кэш декодированных объектов (ImageBitmap, AudioBuffer…)
  const listeners = [];
  let nextId = 1;

  const KINDS = ['image', 'audio', 'video', 'file', 'text'];

  function kindFromMime(mime, name) {
    const m = (mime || '').toLowerCase();
    if (m.startsWith('image/')) return 'image';
    if (m.startsWith('audio/')) return 'audio';
    if (m.startsWith('video/')) return 'video';
    if (m.startsWith('text/') || /\.(txt|log|json|md|csv)$/i.test(name || '')) return 'text';
    return 'file';
  }

  function notify() { listeners.forEach((fn) => { try { fn(); } catch (e) { /* слушатель не должен ломать хранилище */ } }); }

  function readAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error(T('Не удалось прочитать файл', 'Could not read the file')));
      r.readAsDataURL(blob);
    });
  }

  async function sha256(dataUrl) {
    try {
      const bytes = dataUrlToBytes(dataUrl);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      return null; // crypto.subtle недоступен (например, file://) — хеш не обязателен
    }
  }

  function dataUrlToBytes(dataUrl) {
    const comma = dataUrl.indexOf(',');
    const meta = dataUrl.slice(0, comma);
    const body = dataUrl.slice(comma + 1);
    if (/;base64/i.test(meta)) {
      const bin = atob(body);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new TextEncoder().encode(decodeURIComponent(body));
  }

  const Artifacts = {
    PREFIX, KINDS,

    /** Добавить исходный артефакт из File/Blob. @returns {Promise<string>} id */
    async addBlob(blob, name) {
      const dataUrl = await readAsDataUrl(blob);
      return Artifacts.addDataUrl(dataUrl, name || blob.name || T('файл', 'file'), blob.type);
    },

    /** Добавить исходный артефакт из dataURL. @returns {Promise<string>} id */
    async addDataUrl(dataUrl, name, mime) {
      const realMime = mime || (dataUrl.match(/^data:([^;,]+)/) || [])[1] || 'application/octet-stream';
      const id = 'a' + Date.now().toString(36) + (nextId++).toString(36);
      const item = { id, kind: kindFromMime(realMime, name), name: name || id, mime: realMime, dataUrl, size: Math.round(dataUrl.length * 0.75), created: new Date().toISOString(), sha256: null };
      items.set(id, item);
      sha256(dataUrl).then((h) => { item.sha256 = h; notify(); });
      notify();
      return id;
    },

    /** Производная версия (результат обработки) — только в памяти, не сохраняется. */
    addDerived(key, kind, value, meta) {
      const id = 'd_' + key;
      items.set(id, Object.assign({ id, kind, name: (meta && meta.name) || id, derived: true, created: new Date().toISOString() }, meta || {}));
      runtime.set(id, value);
      return id;
    },

    get(id) { return items.get(id) || null; },
    has(id) { return items.has(id); },
    list(kind) { return [...items.values()].filter((a) => !a.derived && (!kind || a.kind === kind)); },
    remove(id) { items.delete(id); runtime.delete(id); notify(); },

    handle(id) { return PREFIX + id; },
    isHandle(v) { return typeof v === 'string' && v.startsWith(PREFIX); },
    idOf(v) { return Artifacts.isHandle(v) ? v.slice(PREFIX.length) : null; },
    /** Артефакт по значению из графа или ошибка с понятным текстом. */
    require(v, kind) {
      const id = Artifacts.idOf(v);
      const a = id && items.get(id);
      if (!a) throw new Error(kind ? T('Нужен вход-артефакт: ', 'An artifact input is required: ') + kind : T('Нужен вход-артефакт', 'An artifact input is required'));
      if (kind && a.kind !== kind) throw new Error(T('Ожидался артефакт «' + kind + '», а пришёл «' + a.kind + '»', 'Expected an artifact of kind “' + kind + '” but got “' + a.kind + '”'));
      return a;
    },

    runtimeGet(id) { return runtime.get(id); },
    runtimeSet(id, value) { runtime.set(id, value); },
    bytes(id) { const a = items.get(id); return a && a.dataUrl ? dataUrlToBytes(a.dataUrl) : null; },

    onChange(fn) { listeners.push(fn); },

    /** Пометить производный артефакт как улику: он сохранится с проектом (кадр видео, лист, извлечённый звук). */
    keep(handleOrId) {
      const a = items.get(Artifacts.idOf(handleOrId) || handleOrId);
      if (a) a.keep = true;
      notify();
    },

    /** Исходные артефакты и сохранённые улики; прочие производные пересчитываются по графу. */
    toJSON() {
      const kept = [...items.values()].filter((a) => a.derived && a.keep && a.dataUrl);
      return Artifacts.list().concat(kept).map(({ id, kind, name, mime, dataUrl, size, created, sha256: h }) => ({ id, kind, name, mime, dataUrl, size, created, sha256: h }));
    },

    load(list) {
      for (const a of Array.isArray(list) ? list : []) {
        if (!a || typeof a.id !== 'string' || typeof a.dataUrl !== 'string' || !a.dataUrl.startsWith('data:')) continue;
        items.set(a.id, { id: a.id, kind: KINDS.includes(a.kind) ? a.kind : 'file', name: String(a.name || a.id), mime: String(a.mime || ''), dataUrl: a.dataUrl, size: Number(a.size) || 0, created: a.created || null, sha256: a.sha256 || null });
      }
      notify();
    },

    clear() { items.clear(); runtime.clear(); notify(); },
    dataUrlToBytes,
  };

  G.Artifacts = Artifacts;
})(typeof self !== 'undefined' ? self : this);
