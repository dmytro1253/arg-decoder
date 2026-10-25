// Картинки-образцы для примеров: нода «Файл» с params.sample получает настоящий артефакт при открытии примера.
// Сами картинки лежат в web/samples/<id>.js и подгружаются тегом <script> только по требованию: так они не
// утяжеляют запуск и работают даже при открытии index.html как файла (fetch из file:// браузеры запрещают).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const SAFE_ID = /^[a-z0-9-]{1,40}$/;
  const pending = new Map();

  function store() { return G.ArgSamples || {}; }

  /** Подгружает web/samples/<id>.js. @returns {Promise<{name, mime, data}>} */
  function load(id) {
    if (!SAFE_ID.test(id)) return Promise.reject(new Error(T('Неверное имя образца: ', 'Bad sample name: ') + id));
    if (store()[id]) return Promise.resolve(store()[id]);
    if (pending.has(id)) return pending.get(id);
    const p = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'samples/' + id + '.js';
      s.onload = () => (store()[id] ? resolve(store()[id]) : reject(new Error(T('Образец пуст: ', 'Sample is empty: ') + id)));
      s.onerror = () => { pending.delete(id); reject(new Error(T('Не найден образец: ', 'Sample not found: ') + id)); };
      document.head.appendChild(s);
    });
    pending.set(id, p);
    return p;
  }

  /** Есть ли в примере ноды, которым нужна картинка-образец. */
  function needs(preset) {
    return !!preset && Array.isArray(preset.nodes) && preset.nodes.some((n) => n.params && n.params.sample);
  }

  /** Новый список нод: каждый params.sample заменён ссылкой на только что добавленный артефакт. */
  async function resolve(preset) {
    const ids = new Map();
    for (const n of preset.nodes) {
      const sid = n.params && n.params.sample;
      if (!sid || ids.has(sid)) continue;
      const s = await load(sid);
      ids.set(sid, await G.Artifacts.addDataUrl('data:' + s.mime + ';base64,' + s.data, s.name, s.mime));
    }
    return preset.nodes.map((n) => {
      if (!n.params || !n.params.sample) return n;
      const { sample, ...rest } = n.params;
      return { ...n, params: { ...rest, artifact: ids.get(sample) } };
    });
  }

  G.Samples = { load, needs, resolve };
})(typeof self !== 'undefined' ? self : this);
