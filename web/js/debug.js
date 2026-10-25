// Вкладка «Отладка»: что загружено в интерфейсе, что есть на сервере (Python, numpy, torch,
// CUDA, словари, хеши, модели) и журнал ошибок. Кнопка копирует полный отчёт.
(function (G) {
  'use strict';
  const srv = (text) => (G.I18n && G.I18n.server ? G.I18n.server(text) : text);
  const T = G.T || ((ru) => ru);
  const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const LOCALE = G.I18n && G.I18n.locale ? G.I18n.locale() : 'ru-RU';
  const REFRESH_MS = 2000;
  const MAX_ERRORS = 200;

  // ---------- журнал ошибок интерфейса ----------
  const ErrorLog = {
    items: [],
    listeners: [],
    push(where, err) {
      const message = err && err.message ? err.message : String(err);
      ErrorLog.items.push({ time: new Date().toLocaleTimeString(LOCALE), where, message, trace: (err && err.stack) || '' });
      if (ErrorLog.items.length > MAX_ERRORS) ErrorLog.items.shift();
      ErrorLog.listeners.forEach((fn) => fn());
    },
    clear() { ErrorLog.items = []; ErrorLog.listeners.forEach((fn) => fn()); },
  };
  window.addEventListener('error', (e) => ErrorLog.push(T('Интерфейс: ', 'Interface: ') + (e.filename || '').split('/').pop() + ':' + (e.lineno || '?'), e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => ErrorLog.push(T('Интерфейс: необработанное обещание', 'Interface: unhandled promise rejection'), e.reason));

  // ---------- самопроверка интерфейса ----------
  function selfTest() {
    const checks = [];
    const check = (name, fn) => {
      try {
        const detail = fn();
        checks.push({ name, ok: true, detail: detail === true || detail === undefined ? '' : String(detail) });
      } catch (e) {
        checks.push({ name, ok: false, detail: e.message });
      }
    };
    const must = (cond, msg) => { if (!cond) throw new Error(msg); };
    const run = (id, input, params) => {
      const op = G.CipherOps.BY_ID[id];
      const full = Object.fromEntries(op.params.map((p) => [p.key, p.default]));
      return op.run([input], Object.assign(full, params || {}));
    };
    check(T('Модули интерфейса', 'Interface modules'), () => {
      const missing = ['Codec', 'CipherOps', 'Scorer', 'Links', 'Solver', 'VigenereCrack', 'VigenereAuto', 'VigPython', 'Graph', 'GraphView', 'NodeTypes', 'Presets', 'AuthorProfile', 'API']
        .filter((n) => !G[n]);
      must(!missing.length, T('не загружены: ', 'not loaded: ') + missing.join(', '));
      return T('все 14 на месте', 'all 14 present');
    });
    check(T('Языковые данные (квадграммы)', 'Language data (quadgrams)'), () => {
      must(G.LANG_DATA, T('lang-data.js не загружен', 'lang-data.js is not loaded'));
      G.Scorer.init();
      const en = G.Scorer.MODELS.en, ru = G.Scorer.MODELS.ru;
      must(en && en.table.length === 26 ** 4, T('английская таблица повреждена', 'the English table is corrupted'));
      must(ru && ru.table.length === 32 ** 4, T('русская таблица повреждена', 'the Russian table is corrupted'));
      return 'en 26⁴, ru 32⁴';
    });
    check(T('Словари интерфейса', 'Interface dictionaries'), () => {
      const en = G.Scorer.MODELS.en.words.size, ru = G.Scorer.MODELS.ru.words.size;
      must(en > 1000 && ru > 1000, T('словари пустые', 'the dictionaries are empty'));
      return 'en ' + en.toLocaleString(LOCALE) + T(' слов, ru ', ' words, ru ') + ru.toLocaleString(LOCALE) + T(' слов', ' words');
    });
    check(T('Операции (ноды-функции)', 'Operations (function nodes)'), () => G.CipherOps.OPS.length + T(' операций, ', ' operations, ') + Object.keys(G.NodeTypes).length + T(' спец-нод, ', ' special nodes, ') + G.Presets.length + T(' примеров', ' examples'));
    check(T('Виженер: h2njbrLB5kj → j2itqqQI5mk', 'Vigenère: h2njbrLB5kj → j2itqqQI5mk'), () => must(run('vigenere', 'h2njbrLB5kj', { key: 'yfqlbvtyz' }) === 'j2itqqQI5mk', T('неверный результат', 'wrong result')));
    check('HEX +23: → kGPojSSzbH8', () => must(run('char_shift', run('hex_decode', '54303958533C3C634B3121'), { n: 23 }) === 'kGPojSSzbH8', T('неверный результат', 'wrong result')));
    check(T('Пары +23 → URL → CP1251: КТО ТЫ?', 'Pairs +23 → URL → CP1251: КТО ТЫ?'), () => must(run('url_decode', run('dec_codes', '14444214452714444620144527144543142847', { width: '2', shift: 23 }), { enc: 'cp1251' }) === 'КТО ТЫ?' /* i18n-ok */, T('неверный результат', 'wrong result')));
    check(T('Стол зачарований туда-обратно', 'Enchanting table round trip'), () => must(run('sga_decode', run('sga_encode', 'herobrine')) === 'herobrine', T('неверный результат', 'wrong result')));
    check(T('Детектор ссылок', 'Link detector'), () => must(G.Links.detect('hxxps://files[.]catbox[.]moe/1gukbv.png')[0].serviceId === 'catbox', T('не распознал Catbox', 'did not recognise Catbox')));
    check(T('Хранилище браузера', 'Browser storage'), () => {
      try { localStorage.setItem('argdec.test', '1'); localStorage.removeItem('argdec.test'); return T('автосохранение работает', 'autosave works'); } catch (e) { throw new Error(T('недоступно — граф не будет сохраняться между запусками', 'unavailable: the graph will not be kept between sessions')); }
    });
    return checks;
  }

  // ---------- отрисовка ----------
  const mark = (ok) => h('span', 'dbg-mark ' + (ok === true ? 'ok' : ok === false ? 'bad' : 'wait'), ok === true ? '✓' : ok === false ? '✗' : '…');
  const row = (ok, name, detail) => {
    const r = h('div', 'dbg-row');
    r.append(mark(ok), h('span', 'dbg-name', name), h('span', 'dbg-detail', detail || ''));
    return r;
  };
  const section = (box, title) => { box.appendChild(h('h3', '', title)); };
  const mb = (bytes) => (bytes / 1048576).toFixed(bytes > 10485760 ? 0 : 1) + T(' МБ', ' MB');

  let last = { selftest: [], server: null, serverError: null };
  let timer = null;

  async function refresh() {
    last.selftest = selfTest();
    last.server = null;
    last.serverError = null;
    if (!G.API.checked) await G.API.ready;
    if (G.API.online) {
      try { last.server = await G.API.diagnostics(); } catch (e) { last.serverError = e.message; }
    }
    render();
    // Статусы сервера — значения протокола, не интерфейсный текст.
    const pending = last.server && (last.server.hashing.status === 'идёт' || last.server.hashing.status === 'ожидает' || // i18n-ok
      Object.values(last.server.models).some((m) => m.status === 'загружается' || m.status === 'ожидает')); // i18n-ok
    clearTimeout(timer);
    if (pending && !document.querySelector('#tab-debug').classList.contains('hidden')) timer = setTimeout(refresh, REFRESH_MS);
  }

  function render() {
    const box = document.querySelector('#debug-body');
    box.innerHTML = '';
    section(box, T('Интерфейс', 'Interface'));
    for (const c of last.selftest) box.appendChild(row(c.ok, c.name, c.detail));

    section(box, T('Сервер и Python', 'Server and Python'));
    if (location.protocol === 'file:') box.appendChild(row(false, T('Сервер', 'Server'), T('страница открыта как файл — запусти программу через «Запуск», чтобы работали проверка ссылок и полный движок', 'the page is opened as a file: start the program through the launcher so link checks and the full engine work')));
    else if (!G.API.online) box.appendChild(row(false, T('Сервер', 'Server'), T('не отвечает — окно консоли закрыто или сервер упал', 'not responding: the console window was closed or the server crashed')));
    else if (last.serverError) box.appendChild(row(false, T('Диагностика сервера', 'Server diagnostics'), last.serverError));
    const s = last.server;
    if (s) {
      box.appendChild(row(true, T('Сервер', 'Server'), T('версия ', 'version ') + s.app.version + T(', работает ', ', up for ') + s.app.uptime + T(' с', ' s')));
      box.appendChild(row(s.python.ok, 'Python ' + s.python.version, s.python.platform + T(', ядер: ', ', cores: ') + s.python.cpus));
      const np = s.libraries.numpy;
      box.appendChild(row(np.ok, 'numpy', np.ok ? np.version : np.error + T(' — полный движок Виженера недоступен', ' — the full Vigenère engine is unavailable')));
      const g = s.gpu;
      box.appendChild(row(g.torch.ok ? true : null, 'PyTorch', g.torch.ok ? g.torch.version + (g.torch.note ? ' · ' + srv(g.torch.note) : '') : T('не установлен (необязательно)', 'not installed (optional)')));
      box.appendChild(row(g.cuda ? true : null, 'CUDA', g.cuda ? 'CUDA ' + g.cuda_version + ': ' + g.devices.map((d) => d.name + ' (' + mb(d.memory_mb * 1048576) + ')').join(', ') : (srv(g.hint) || T('нет', 'none'))));
      box.appendChild(row(s.engine.status === 'загружен' /* i18n-ok */, T('Встроенный подбор Виженера', 'Built-in Vigenère solver'), srv(s.engine.error || s.engine.status)));

      section(box, T('Языковые модели', 'Language models'));
      for (const [key, m] of Object.entries(s.models)) {
        const ok = m.status === 'готова' ? true : m.status === 'ошибка' || m.status === 'нет движка' ? false : null; // i18n-ok: данные
        const detail = m.status === 'готова' // i18n-ok: данные
          ? `${srv(m.source)}, ${m.seconds}${T(' с', ' s')}, ${T('слов', 'words')} ${Number(m.words).toLocaleString(LOCALE)}, ${T('отпечаток', 'fingerprint')} ${m.signature}`
          : srv(m.error || m.status);
        box.appendChild(row(ok, key, detail));
      }

      section(box, T('Словари и данные', 'Dictionaries and data'));
      box.appendChild(row(s.data.exists, T('Папка данных', 'Data folder'), s.data.dir));
      const hs = s.hashing;
      box.appendChild(row(hs.status === 'готово' ? true : hs.status === 'ошибка' ? false : null, T('Хеширование SHA-256', 'SHA-256 hashing'), srv(hs.status) + (hs.seconds != null ? ', ' + hs.seconds + T(' с', ' s') : ''))); // i18n-ok: данные
      const need = ['words_en.txt', 'words_ru.txt', 'words_uk.txt', 'corpus_en.txt', 'corpus_ru.txt', 'corpus_uk.txt'];
      const names = new Set(s.data.files.map((f) => f.name));
      const missing = need.filter((n) => !names.has(n));
      box.appendChild(row(!missing.length, T('Обязательные файлы', 'Required files'), missing.length ? T('нет: ', 'missing: ') + missing.join(', ') : T('все на месте', 'all present')));
      const table = h('table', 'stats dbg-files');
      for (const f of s.data.files) {
        const tr = table.insertRow();
        tr.insertCell().textContent = f.name;
        tr.insertCell().textContent = mb(f.bytes);
        const hash = hs.files[f.name];
        const cell = tr.insertCell();
        cell.textContent = hash ? hash.slice(0, 16) + '…' : '—';
        cell.title = hash || '';
        cell.className = 'mono';
      }
      box.appendChild(table);
    }

    section(box, T('Ошибки', 'Errors'));
    const errors = ErrorLog.items.map((e) => ({ ...e, side: T('интерфейс', 'interface') })).concat(((s && s.errors) || []).map((e) => ({ ...e, side: T('сервер', 'server') })));
    const field = h('textarea', 'dbg-errors');
    field.readOnly = true;
    field.rows = 8;
    field.value = errors.length ? errors.map((e) => `[${e.time}] ${e.side} · ${e.where}: ${e.message}${e.trace ? '\n' + e.trace.trim() : ''}`).join('\n\n') : T('Ошибок нет.', 'No errors.');
    box.appendChild(field);
  }

  function report() {
    return JSON.stringify({
      when: new Date().toISOString(), page: location.href, userAgent: navigator.userAgent,
      selftest: last.selftest, server: last.server, serverError: last.serverError, interfaceErrors: ErrorLog.items,
    }, null, 2);
  }

  function init() {
    document.querySelector('#debug-refresh').onclick = refresh;
    document.querySelector('#debug-copy').onclick = () => navigator.clipboard.writeText(report()).then(
      () => G.debugToast && G.debugToast(T('Отчёт скопирован — его можно прислать разработчику', 'Report copied: you can send it to the developer')),
      () => G.debugToast && G.debugToast(T('Не удалось скопировать', 'Could not copy')));
    document.querySelector('#debug-clear').onclick = () => { ErrorLog.clear(); render(); };
    document.querySelector('.tab[data-tab="tab-debug"]').addEventListener('click', refresh);
    ErrorLog.listeners.push(() => {
      const tab = document.querySelector('.tab[data-tab="tab-debug"]');
      tab.classList.toggle('has-errors', ErrorLog.items.length > 0);
      if (!document.querySelector('#tab-debug').classList.contains('hidden')) render();
    });
  }

  G.ErrorLog = ErrorLog;
  G.Debug = { init, refresh, selfTest };
})(typeof self !== 'undefined' ? self : this);
