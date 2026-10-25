// Обновления программы. При запуске страница спрашивает сервер, есть ли новая версия (сервер ходит на GitHub
// не чаще раза в 6 часов и только если проверка не выключена), и показывает полосу «Доступна версия…».
// Скачивание, проверка подписи Ed25519 и каждого файла идут на сервере (updater.py); установка — в запускаторе
// при перезапуске, с резервной копией и откатом. Страница ничего не устанавливает сама и адресов не передаёт.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const srv = (text) => (G.I18n && G.I18n.server ? G.I18n.server(text) : text);
  const AUTO_KEY = 'argdec.update.auto';
  const SKIP_KEY = 'argdec.update.skip';
  const POLL_MS = 700;
  const RESTART_POLL_MS = 1000;
  const RESTART_WAIT_MS = 90000;
  const RELEASE_PAGE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/releases\//;

  const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const mb = (bytes) => (bytes / 1048576).toFixed(1);
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* без хранилища настройка живёт до перезагрузки */ } },
  };

  const Updates = {
    check: null,      // последний ответ /api/update/check
    status: null,     // последний ответ /api/update/status
    phase: 'idle',    // idle | downloading | verifying | ready | restarting | error
    error: null,
    listeners: [],

    autoEnabled() { return store.get(AUTO_KEY) !== '0'; },
    setAuto(on) { store.set(AUTO_KEY, on ? '1' : '0'); },
    onChange(fn) { Updates.listeners.push(fn); },
    notify() { Updates.listeners.forEach((fn) => fn()); renderBar(); },

    async refreshStatus() {
      if (!G.API.online) return null;
      try { Updates.status = await G.API.get('/api/update/status'); } catch (e) { Updates.status = null; }
      return Updates.status;
    },

    /** Узнать, есть ли новая версия. force — спросить GitHub сейчас, а не взять ответ последних 6 часов. */
    async runCheck(force) {
      if (!G.API.online) return null;
      try {
        Updates.check = await G.API.get('/api/update/check' + (force ? '?force=1' : ''));
      } catch (e) {
        Updates.check = { status: 'error', error: e.message };
      }
      await Updates.refreshStatus();
      const st = Updates.status && Updates.status.state;
      if (st && st.phase === 'ready' && Updates.status.pending) Updates.phase = 'ready';
      Updates.notify();
      return Updates.check;
    },

    async install() {
      Updates.phase = 'verifying';
      Updates.error = null;
      Updates.notify();
      try {
        await G.API.post('/api/update/download', {});
      } catch (e) {
        return fail(e.message);
      }
      return pollDownload();
    },

    async restart() {
      const ws = G.workspace || window.workspace;
      if (ws && ws.saveNow) { try { await ws.saveNow(); } catch (e) { /* автосохранение и так идёт; перезапуск не отменяем */ } }
      let res;
      try { res = await G.API.post('/api/update/restart', {}); } catch (e) { return fail(e.message); }
      if (res.manual) { Updates.phase = 'manual'; Updates.notify(); return res; }
      Updates.phase = 'restarting';
      Updates.notify();
      waitForVersion(res.version, Date.now());
      return res;
    },

    skip(version) { store.set(SKIP_KEY, version); renderBar(); },
  };

  function fail(message) {
    Updates.phase = 'error';
    Updates.error = srv(message);
    Updates.notify();
    return null;
  }

  async function pollDownload() {
    const s = await Updates.refreshStatus();
    const st = s && s.state;
    const noServer = T('сервер не ответил', 'the server did not respond');
    if (!st) return fail(noServer);
    if (st.phase === 'error') return fail(st.error);
    Updates.phase = st.phase === 'ready' ? 'ready' : st.phase === 'downloading' ? 'downloading' : 'verifying';
    Updates.notify();
    if (Updates.phase !== 'ready') setTimeout(pollDownload, POLL_MS);
    return st;
  }

  // Сервер выключается, запускатор ставит обновление и запускает новую версию; ждём её и перезагружаем страницу.
  async function waitForVersion(version, started) {
    try {
      const r = await fetch('/api/ping', { cache: 'no-store' });
      const data = await r.json();
      if (data.version === version) { location.reload(); return; }
    } catch (e) { /* сервер ещё перезапускается */ }
    const lost = T('программа не вернулась после перезапуска — запусти её снова (обновление установится при запуске или будет откачено)', 'the program did not come back after the restart: start it again (the update is installed at start or rolled back)');
    if (Date.now() - started > RESTART_WAIT_MS) return fail(lost);
    setTimeout(() => waitForVersion(version, started), RESTART_POLL_MS);
    return null;
  }

  function progressText() {
    const st = (Updates.status && Updates.status.state) || {};
    if (Updates.phase === 'downloading' && st.total) return T('Скачиваю обновление: ', 'Downloading the update: ') + Math.floor(100 * st.done / st.total) + '% (' + mb(st.done) + T(' из ', ' of ') + mb(st.total) + T(' МБ)', ' MB)');
    if (Updates.phase === 'downloading') return T('Скачиваю обновление…', 'Downloading the update…');
    return T('Проверяю подпись и каждый файл…', 'Checking the signature and every file…');
  }

  function button(text, cls, onClick) {
    const b = h('button', 'btn small ' + (cls || ''), text);
    b.onclick = onClick;
    return b;
  }

  function releaseLink(c) {
    if (!c || !RELEASE_PAGE.test(c.page || '')) return null;
    const a = h('a', 'update-link', T('Страница релиза', 'Release page'));
    a.href = c.page;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  function renderBar() {
    const bar = document.querySelector('#update-bar');
    if (!bar) return;
    bar.innerHTML = '';
    const c = Updates.check;
    const st = Updates.status || {};
    const busy = Updates.phase === 'downloading' || Updates.phase === 'verifying';
    let show = true;
    if (busy) bar.append(h('span', 'update-text', progressText()));
    else if (Updates.phase === 'ready') {
      const v = (st.pending && st.pending.version) || (c && c.latest) || '';
      if (st.launcher) bar.append(h('span', 'update-text', T('Обновление ' + v + ' скачано и проверено.', 'Update ' + v + ' is downloaded and verified.')), button(T('Перезапустить и установить', 'Restart and install'), 'accent', Updates.restart));
      else bar.append(h('span', 'update-text', T('Обновление ' + v + ' скачано и проверено. Закрой окно программы и запусти Start снова — оно установится при запуске.', 'Update ' + v + ' is downloaded and verified. Close the program window and run Start again: it is installed at start.')));
    } else if (Updates.phase === 'manual') bar.append(h('span', 'update-text', T('Закрой окно программы и запусти Start снова — обновление установится при запуске.', 'Close the program window and run Start again: the update is installed at start.')));
    else if (Updates.phase === 'restarting') bar.append(h('span', 'update-text', T('Устанавливаю обновление и перезапускаю программу… Страница обновится сама.', 'Installing the update and restarting… The page reloads by itself.')));
    else if (Updates.phase === 'error') bar.append(h('span', 'update-text', T('Обновление не удалось: ', 'The update failed: ') + Updates.error), button(T('Повторить', 'Retry'), '', Updates.install), button('×', '', () => { Updates.phase = 'idle'; renderBar(); }));
    else if (c && c.status === 'update' && store.get(SKIP_KEY) !== c.latest) {
      bar.append(h('span', 'update-text', T('Доступна версия ' + c.latest + ' (у тебя ' + c.current + ').', 'Version ' + c.latest + ' is available (you have ' + c.current + ').')));
      if (c.notes) {
        const notes = h('details', 'update-notes');
        notes.append(h('summary', '', T('Что нового', "What's new")), h('pre', '', c.notes));
        bar.append(notes);
      }
      if (c.can_install) bar.append(button(T('Обновить', 'Update'), 'accent', Updates.install));
      else bar.append(h('span', 'update-text muted', srv(c.mode_reason || '')));
      const link = releaseLink(c);
      if (link) bar.append(link);
      bar.append(button(T('Позже', 'Later'), '', () => Updates.skip(c.latest)));
    } else show = false;
    bar.classList.toggle('hidden', !show);
  }

  async function init() {
    if (!G.API.checked) await G.API.ready;
    if (!G.API.online) return;
    await Updates.refreshStatus();
    const st = Updates.status && Updates.status.state;
    if (st && (st.phase === 'downloading' || st.phase === 'verifying')) { Updates.phase = st.phase; pollDownload(); }
    else if (Updates.status && Updates.status.pending) Updates.phase = 'ready';
    if (Updates.autoEnabled()) await Updates.runCheck(false);
    else Updates.notify();
  }

  G.Updates = Object.assign(Updates, { init, renderBar });
})(typeof self !== 'undefined' ? self : this);
