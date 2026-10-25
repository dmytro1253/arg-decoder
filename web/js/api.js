// Обращения к локальному серверу (server.py): проверка YouTube ID через oEmbed.
// При открытии index.html напрямую (file://) сервер недоступен — всё остальное работает.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const cache = new Map();
  const listeners = [];
  // Эти статусы окончательные и кэшируются; «denied» (HTTP 401/403) и ошибки — нет: это не «не найдено».
  const CACHEABLE = new Set(['found', 'not_found']);
  const offlineMessage = () => T('Запусти программу через «Запуск.bat», чтобы проверять ссылки', 'Start the program through the launcher (Запуск.bat / start.sh) to check links');

  const API = {
    online: false,
    checked: false,

    ready: null,

    ping() {
      API.ready = API.doPing();
      return API.ready;
    },

    async doPing() {
      if (location.protocol === 'file:') { API.online = false; API.checked = true; notify(); return false; }
      try {
        const r = await fetch('/api/ping', { cache: 'no-store' });
        API.online = r.ok;
      } catch (e) {
        API.online = false;
      }
      API.checked = true;
      notify();
      return API.online;
    },

    onChange(fn) { listeners.push(fn); },

    /** @returns {Promise<{status:'found'|'not_found'|'denied'|'error'|'offline', title?:string, author?:string, authorUrl?:string, thumbnail?:string, http?:number, message?:string}>} */
    async youtube(id) {
      if (!G.Scorer.YT_ID.test(id)) return { status: 'error', message: T('Это не 11-символьный YouTube ID', 'This is not an 11-character YouTube ID') };
      if (cache.has(id)) return cache.get(id);
      if (!API.online) return { status: 'offline', message: offlineMessage() };
      let res;
      try {
        const r = await fetch('/api/youtube?id=' + encodeURIComponent(id), { cache: 'no-store' });
        res = await r.json();
        if (res && res.message) res = { ...res, message: G.I18n.server(res.message) };
      } catch (e) {
        res = { status: 'error', message: T('Сервер не ответил', 'The server did not respond') };
      }
      if (CACHEABLE.has(res.status)) cache.set(id, res);
      return res;
    },

    /** Проверка существования страницы на известном сервисе (Catbox, Pastebin, Drive…). */
    async link(url) {
      if (cache.has(url)) return cache.get(url);
      if (!API.online) return { status: 'offline', message: offlineMessage() };
      let res;
      try {
        const r = await fetch('/api/link?url=' + encodeURIComponent(url), { cache: 'no-store' });
        res = await r.json();
        if (res && res.message) res = { ...res, message: G.I18n.server(res.message) };
      } catch (e) {
        res = { status: 'error', message: T('Сервер не ответил', 'The server did not respond') };
      }
      if (res.status !== 'error' && res.status !== 'denied') cache.set(url, res);
      return res;
    },

    // ---------- встроенный подбор Виженера (Python-движок) и диагностика ----------
    async post(path, body) {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-ARG-Decoder': '1' }, body: JSON.stringify(body || {}) });
      const data = await r.json().catch(() => ({ error: T('Сервер вернул не JSON (HTTP ' + r.status + ')', 'The server returned non-JSON (HTTP ' + r.status + ')') }));
      if (!r.ok || data.error) throw new Error(G.I18n.server(data.error) || 'HTTP ' + r.status);
      return data;
    },

    async get(path) {
      const r = await fetch(path, { cache: 'no-store' });
      const data = await r.json().catch(() => ({ error: T('Сервер вернул не JSON (HTTP ' + r.status + ')', 'The server returned non-JSON (HTTP ' + r.status + ')') }));
      if (!r.ok || data.error) throw new Error(G.I18n.server(data.error) || 'HTTP ' + r.status);
      return data;
    },

    diagnostics() { return API.get('/api/diagnostics'); },
    vigStart(params) { return API.post('/api/vigenere', params); },
    vigStatus(id) { return API.get('/api/vigenere/status?id=' + encodeURIComponent(id)); },
    vigStop(id) { return API.post('/api/vigenere/stop?id=' + encodeURIComponent(id), {}); },

    /**
     * Единый машинный статус задания Python-движка: 'running' | 'done' | 'error' | 'cancelled' | 'unknown'.
     * Сервер отвечает кодами «идёт / готово / ошибка / остановлено»; неизвестное значение — не успех, а ошибка протокола.
     */
    engineStatus(raw) {
      const s = String(raw === undefined || raw === null ? '' : raw).toLowerCase();
      if (s === 'идёт' || s === 'ожидает' || s === 'running' || s === 'waiting') return 'running'; // i18n-ok: коды сервера
      if (s === 'готово' || s === 'done') return 'done'; // i18n-ok: коды сервера
      if (s === 'ошибка' || s === 'error') return 'error'; // i18n-ok: коды сервера
      if (s === 'остановлено' || s === 'stopped' || s === 'cancelled') return 'cancelled'; // i18n-ok: коды сервера
      return 'unknown';
    },
    /** Причина сбоя из ответа движка: последняя строка журнала или неизвестный статус. */
    engineFailure(status) {
      const log = (status && status.log) || [];
      const last = log.length ? String(log[log.length - 1]) : '';
      if (API.engineStatus(status && status.status) === 'unknown') return T('неизвестный статус движка: ', 'unknown engine status: ') + (status && status.status);
      return G.I18n && G.I18n.server ? G.I18n.server(last) : last;
    },
    ocrStatus() { return API.get('/api/ocr/status'); },

    /** Есть ли на сервере рабочий движок Виженера (numpy + модели). */
    async pythonEngine() {
      if (!API.online) return false;
      try {
        const d = await API.diagnostics();
        API.lastDiagnostics = d;
        return d.libraries.numpy.ok && d.engine.status === 'загружен'; // i18n-ok: данные
      } catch (e) {
        return false;
      }
    },

    /**
     * Канал найденного видео — канал автора активного профиля? Сравнение точное: handle (@name) или
     * ID канала из authorUrl, либо полное имя автора; подстроки («notmslan») не считаются.
     */
    isAuthor(res) {
      const p = G.AuthorProfile;
      if (!res || res.status !== 'found' || !p || !p.authorMatch) return false;
      const m = p.authorMatch;
      const url = String(res.authorUrl || '').trim();
      const handle = (url.match(/youtube\.com\/@([^/?#\s]+)/i) || [])[1];
      const channelId = (url.match(/youtube\.com\/channel\/([^/?#\s]+)/i) || [])[1];
      const lower = (list) => (list || []).map((x) => String(x).toLowerCase());
      if (handle && lower(m.handles).includes(decodeURIComponent(handle).toLowerCase())) return true;
      if (channelId && (m.channelIds || []).includes(channelId)) return true;
      const name = String(res.author || '').trim().toLowerCase();
      return !!name && lower(m.names).includes(name);
    },
  };

  function notify() { for (const fn of listeners) fn(API.online); }

  // Достаёт YouTube ID из строки: сам ID или любая ссылка (общий разбор — Links.youtubeIdFrom).
  API.extractYouTubeId = function (text) {
    return G.Links ? G.Links.youtubeIdFrom(text) : null;
  };

  G.API = API;
})(typeof self !== 'undefined' ? self : this);
