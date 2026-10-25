// Вкладка «Отладка»: сводка состояния вверху (интерфейс, сервер, Python-подбор, OCR, данные), затем подробности:
// проверки интерфейса, сервер и Python, распознавание и архивы, данные и модели, проект и хранилище, журнал ошибок.
// Кнопка копирует полный отчёт (JSON) для разработчика.
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
  const REQUIRED_DATA = ['words_en.txt', 'words_ru.txt', 'words_uk.txt', 'corpus_en.txt', 'corpus_ru.txt', 'corpus_uk.txt'];

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

  // ---------- самопроверка интерфейса: модули, данные и короткие контрольные примеры ----------
  const MODULES = ['Codec', 'CipherOps', 'Scorer', 'Links', 'Solver', 'SolverEvidence', 'SolverEngines', 'SolverCrackers', 'VigenereCrack',
    'VigenereAuto', 'VigPython', 'Graph', 'GraphView', 'NodeTypes', 'Presets', 'Dossiers', 'KeyBank', 'Profiles', 'Ocr', 'PixelFont', 'Qr',
    'Decompress', 'Enigma', 'Samples', 'I18n', 'API'];

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
    const wrong = () => T('неверный результат', 'wrong result');
    check(T('Модули интерфейса', 'Interface modules'), () => {
      const missing = MODULES.filter((n) => !G[n]).concat(G.ArgFiles && G.ArgFiles.SevenZip ? [] : ['ArgFiles.SevenZip']);
      must(!missing.length, T('не загружены: ', 'not loaded: ') + missing.join(', '));
      return T('все ', 'all ') + (MODULES.length + 1) + T(' на месте', ' present');
    });
    check(T('Языковые модели браузера', 'Browser language models'), () => {
      must(G.LANG_DATA, T('lang-data.js не загружен', 'lang-data.js is not loaded'));
      G.Scorer.init();
      const sizes = Object.entries(G.Scorer.MODELS).filter(([k]) => k !== 'ready').map(([k, m]) => {
        must(m.table.length === m.n ** 4, T('таблица ', 'table ') + k + T(' повреждена', ' is corrupted'));
        return k + ' ' + m.n + '⁴ · ' + m.words.size.toLocaleString(LOCALE);
      });
      must(sizes.length >= 4, T('нет части языков', 'some languages are missing'));
      return sizes.join(', ');
    });
    check(T('Реестры', 'Registries'), () => G.CipherOps.OPS.length + T(' операций (в авто-поиске ', ' operations (') + G.CipherOps.OPS.filter((o) => o.probes).length
      + T('), ', ' in Auto), ') + Object.keys(G.NodeTypes).length + T(' спец-нод, ', ' special nodes, ') + G.Presets.length + T(' примеров, ', ' examples, ')
      + (G.Dossiers ? G.Dossiers.list().length : 0) + T(' досье', ' dossiers'));
    check(T('Виженер: h2njbrLB5kj → j2itqqQI5mk', 'Vigenère: h2njbrLB5kj → j2itqqQI5mk'), () => must(run('vigenere', 'h2njbrLB5kj', { key: 'yfqlbvtyz' }) === 'j2itqqQI5mk', wrong()));
    check(T('Пары +23 → URL → CP1251: КТО ТЫ?', 'Pairs +23 → URL → CP1251: КТО ТЫ?'), () => must(run('url_decode', run('dec_codes', '14444214452714444620144527144543142847', { width: '2', shift: 23 }), { enc: 'cp1251' }) === 'КТО ТЫ?' /* i18n-ok */, wrong()));
    check(T('Энигма I: AAAAA → BDZGO', 'Enigma I: AAAAA → BDZGO'), () => must(run('enigma', 'AAAAA') === 'BDZGO', wrong()));
    check(T('RC4: Key / Plaintext', 'RC4: Key / Plaintext'), () => must(Array.from(run('rc4', 'Plaintext', { key: 'Key' }), (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('') === 'bbf316e8d940af0ad3', wrong()));
    check(T('zlib: распаковка с Adler-32', 'zlib: decompression with Adler-32'), () => must(run('decompress', run('base64_decode', 'eJzzSM3JyVcozy/KSQEAGKsEPQ=='), { strict: true }) === 'Hello world', wrong()));
    check(T('Стол зачарований туда-обратно', 'Enchanting table round trip'), () => must(run('sga_decode', run('sga_encode', 'herobrine')) === 'herobrine', wrong()));
    check(T('Детектор ссылок', 'Link detector'), () => must(G.Links.detect('hxxps://files[.]catbox[.]moe/1gukbv.png')[0].serviceId === 'catbox', T('не распознал Catbox', 'did not recognise Catbox')));
    check(T('Хранилище браузера', 'Browser storage'), () => {
      try { localStorage.setItem('argdec.test', '1'); localStorage.removeItem('argdec.test'); return T('автосохранение работает', 'autosave works'); } catch (e) { throw new Error(T('недоступно — проект не будет сохраняться между запусками', 'unavailable: the project will not be kept between sessions')); }
    });
    return checks;
  }

  // ---------- состояние браузера: проект, хранилище, OCR и архивы на стороне страницы ----------
  async function browserState() {
    const state = { storage: null, project: null, tesseract: null, sevenZip: null, backup: null };
    try { if (navigator.storage && navigator.storage.estimate) state.storage = await navigator.storage.estimate(); } catch (e) { state.storage = null; }
    const ws = G.workspace || window.workspace;
    if (ws && ws.project) {
      const p = ws.project;
      state.project = {
        name: p.name, boards: p.boards.length, nodes: p.boards.reduce((n, b) => n + b.graph.nodes.length, 0),
        keys: G.KeyBank ? G.KeyBank.list().length : 0, artifacts: G.Artifacts ? G.Artifacts.toJSON().length : 0,
        dossiers: (p.dossiers || []).length,
      };
      if (ws.store && ws.store.loadBackup) { try { const b = await ws.store.loadBackup(); state.backup = b ? { name: b.project.name, savedAt: b.savedAt } : null; } catch (e) { state.backup = null; } }
    }
    state.tesseract = G.Ocr ? G.Ocr.availability() : { ok: false, reason: 'Ocr' };
    state.sevenZip = G.ArgFiles && G.ArgFiles.SevenZip ? G.ArgFiles.SevenZip.availability() : { ok: false, reason: '7-Zip' };
    return state;
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
  // Карточка сводки: состояние (ok / warn / bad / wait), заголовок и одна строка пояснения.
  const card = (state, title, detail) => {
    const c = h('div', 'dbg-card ' + state);
    c.append(h('div', 'dbg-card-title', title), h('div', 'dbg-card-detail', detail));
    return c;
  };

  let last = { selftest: [], server: null, serverError: null, browser: null };
  let timer = null;

  async function refresh() {
    last.selftest = selfTest();
    last.server = null;
    last.serverError = null;
    if (!G.API.checked) await G.API.ready;
    if (G.API.online) {
      try { last.server = await G.API.diagnostics(); } catch (e) { last.serverError = e.message; }
    }
    last.browser = await browserState();
    render();
    // Статусы сервера — значения протокола, не интерфейсный текст.
    const pending = last.server && (last.server.hashing.status === 'идёт' || last.server.hashing.status === 'ожидает' || // i18n-ok
      Object.values(last.server.models).some((m) => m.status === 'загружается' || m.status === 'ожидает')); // i18n-ok
    clearTimeout(timer);
    if (pending && !document.querySelector('#tab-debug').classList.contains('hidden')) timer = setTimeout(refresh, REFRESH_MS);
  }

  function summary(box) {
    const s = last.server;
    const failed = last.selftest.filter((c) => !c.ok).length;
    const grid = h('div', 'dbg-cards');
    grid.appendChild(card(failed ? 'bad' : 'ok', T('Интерфейс', 'Interface'), failed ? T('не прошло проверок: ', 'checks failed: ') + failed : T('все проверки прошли', 'all checks passed')));
    if (location.protocol === 'file:') grid.appendChild(card('warn', T('Сервер', 'Server'), T('страница открыта как файл', 'opened as a file')));
    else grid.appendChild(card(s ? 'ok' : 'bad', T('Сервер', 'Server'), s ? T('версия ', 'version ') + s.app.version : T('не отвечает', 'not responding')));
    const engineOk = s && s.libraries.numpy.ok && s.engine.status === 'загружен'; // i18n-ok: данные
    grid.appendChild(card(!s ? 'wait' : engineOk ? 'ok' : 'bad', T('Python-подбор', 'Python solver'), !s ? '—' : engineOk ? (s.gpu.cuda ? 'CUDA' : 'CPU') + ' · numpy ' + s.libraries.numpy.version : T('недоступен', 'unavailable')));
    const ocr = s && s.ocr;
    grid.appendChild(card(!s ? 'wait' : ocr && ocr.ready ? 'ok' : 'warn', 'OCR', !s ? '—' : ocr && ocr.ready ? 'RapidOCR + tesseract.js' : T('только tesseract.js', 'tesseract.js only')));
    const ds = s && s.datasource;
    const dsText = !ds ? '—' : ds.source === 'release' ? T('архив релиза ', 'release archive ') + (ds.version || '') : ds.source === 'sources' ? T('из первоисточников', 'from the original sources') : T('неполные', 'incomplete');
    grid.appendChild(card(!ds ? 'wait' : ds.source === 'release' || ds.source === 'sources' ? 'ok' : 'bad', T('Словари', 'Dictionaries'), dsText));
    box.appendChild(grid);
  }

  function renderServer(box, s) {
    section(box, T('Сервер и Python', 'Server and Python'));
    if (location.protocol === 'file:') box.appendChild(row(false, T('Сервер', 'Server'), T('страница открыта как файл — запусти программу через Start, чтобы работали проверка ссылок, полный движок и RapidOCR', 'the page is opened as a file: start the program with Start so link checks, the full engine and RapidOCR work')));
    else if (!G.API.online) box.appendChild(row(false, T('Сервер', 'Server'), T('не отвечает — окно консоли закрыто или сервер упал', 'not responding: the console window was closed or the server crashed')));
    else if (last.serverError) box.appendChild(row(false, T('Диагностика сервера', 'Server diagnostics'), last.serverError));
    if (!s) return;
    box.appendChild(row(true, T('Сервер', 'Server'), T('версия ', 'version ') + s.app.version + T(', работает ', ', up for ') + s.app.uptime + T(' с', ' s')));
    const st = s.setup || {};
    box.appendChild(row(st.done ? true : null, T('Первая установка', 'First setup'), st.done ? T('выполнена ', 'done ') + (st.date || '') + T(' · версия установки ', ' · setup version ') + st.version : T('ещё не выполнялась (запуск не через Start)', 'not done yet (not started with Start)')));
    box.appendChild(row(s.python.ok, 'Python ' + s.python.version, s.python.platform + T(', ядер: ', ', cores: ') + s.python.cpus));
    const np = s.libraries.numpy;
    box.appendChild(row(np.ok, 'numpy', np.ok ? np.version : np.error + T(' — полный движок Виженера недоступен', ' — the full Vigenère engine is unavailable')));
    const g = s.gpu;
    box.appendChild(row(g.torch.ok ? true : null, 'PyTorch', g.torch.ok ? g.torch.version + (g.torch.note ? ' · ' + srv(g.torch.note) : '') : T('не установлен (необязательно)', 'not installed (optional)')));
    box.appendChild(row(g.cuda ? true : null, 'CUDA', g.cuda ? 'CUDA ' + g.cuda_version + ': ' + g.devices.map((d) => d.name + ' (' + mb(d.memory_mb * 1048576) + ')').join(', ') : (srv(g.hint) || T('нет', 'none'))));
    box.appendChild(row(s.engine.status === 'загружен' /* i18n-ok */, T('Встроенный подбор Виженера', 'Built-in Vigenère solver'), srv(s.engine.error || s.engine.status)));
    const jobs = s.jobs || [];
    if (jobs.length) box.appendChild(row(null, T('Задания подбора', 'Solver jobs'), jobs.map((j) => j.id.slice(0, 6) + ': ' + srv(j.status)).join(', ')));
  }

  function renderRecognition(box, s, b) {
    section(box, T('Распознавание и архивы', 'Recognition and archives'));
    const ocr = s && s.ocr;
    if (ocr) {
      const pk = ocr.packages || {};
      box.appendChild(row(ocr.ready, 'RapidOCR', ocr.ready ? 'rapidocr ' + pk.rapidocr + ' · onnxruntime ' + pk.onnxruntime : srv(ocr.note)));
      for (const m of ocr.models || []) box.appendChild(row(m.ok, T('модель ', 'model ') + m.name, m.ok ? mb(m.bytes) : T('нет — python setup_ocr.py', 'missing: python setup_ocr.py')));
    } else box.appendChild(row(null, 'RapidOCR', T('нужен локальный сервер', 'needs the local server')));
    if (b) {
      box.appendChild(row(b.tesseract.ok, 'tesseract.js', b.tesseract.ok ? T('готов (eng, rus, ukr)', 'ready (eng, rus, ukr)') : b.tesseract.reason));
      box.appendChild(row(b.sevenZip.ok, T('7-Zip (RAR, 7z)', '7-Zip (RAR, 7z)'), b.sevenZip.ok ? T('WebAssembly, грузится по требованию', 'WebAssembly, loaded on demand') : b.sevenZip.reason));
    }
  }

  function renderData(box, s) {
    if (!s) return;
    section(box, T('Словари и данные', 'Dictionaries and data'));
    const ds = s.datasource || {};
    const dsText = ds.source === 'release' ? T('архив релиза ', 'release archive ') + (ds.version || '') + T(', совпадает с манифестом', ', matches the manifest')
      : ds.source === 'sources' ? T('скачаны из первоисточников (модели строятся на месте)', 'downloaded from the original sources (models are built locally)')
        : ds.source === 'incomplete' ? T('неполные, нет: ', 'incomplete, missing: ') + (ds.missing || []).join(', ') : srv(ds.error || ds.source || '');
    box.appendChild(row(ds.source === 'release' || ds.source === 'sources' ? true : ds.source ? false : null, T('Источник данных', 'Data source'), dsText));
    box.appendChild(row(s.data.exists, T('Папка данных', 'Data folder'), s.data.dir));
    const hs = s.hashing;
    box.appendChild(row(hs.status === 'готово' ? true : hs.status === 'ошибка' ? false : null, T('Хеширование SHA-256', 'SHA-256 hashing'), srv(hs.status) + (hs.seconds != null ? ', ' + hs.seconds + T(' с', ' s') : ''))); // i18n-ok: данные
    const names = new Set(s.data.files.map((f) => f.name));
    const missing = REQUIRED_DATA.filter((n) => !names.has(n));
    box.appendChild(row(!missing.length, T('Обязательные файлы', 'Required files'), missing.length ? T('нет: ', 'missing: ') + missing.join(', ') : T('все на месте', 'all present')));
    const details = h('details', 'dbg-more');
    details.appendChild(h('summary', '', T('Файлы и хеши', 'Files and hashes') + ' (' + s.data.files.length + ')'));
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
    details.appendChild(table);
    box.appendChild(details);

    section(box, T('Языковые модели Python', 'Python language models'));
    for (const [key, m] of Object.entries(s.models)) {
      const ok = m.status === 'готова' ? true : m.status === 'ошибка' || m.status === 'нет движка' ? false : null; // i18n-ok: данные
      const detail = m.status === 'готова' // i18n-ok: данные
        ? `${srv(m.source)}, ${m.seconds}${T(' с', ' s')}, ${T('слов', 'words')} ${Number(m.words).toLocaleString(LOCALE)}, ${T('отпечаток', 'fingerprint')} ${m.signature}`
        : srv(m.error || m.status);
      box.appendChild(row(ok, key, detail));
    }
  }

  function renderProject(box, b) {
    if (!b) return;
    section(box, T('Проект и хранилище', 'Project and storage'));
    const p = b.project;
    if (p) box.appendChild(row(true, '«' + p.name + '»', T('досок ', 'boards ') + p.boards + T(', нод ', ', nodes ') + p.nodes + T(', ключей ', ', keys ') + p.keys + T(', вложений ', ', attachments ') + p.artifacts + T(', своих досье ', ', own dossiers ') + p.dossiers));
    box.appendChild(row(b.backup ? true : null, T('Резервная копия прошлого проекта', 'Backup of the previous project'), b.backup ? '«' + b.backup.name + '»' + (b.backup.savedAt ? ' · ' + new Date(b.backup.savedAt).toLocaleString(LOCALE) : '') : T('нет', 'none')));
    if (b.storage && b.storage.quota) box.appendChild(row(b.storage.usage < b.storage.quota * 0.9, T('Память браузера', 'Browser storage'), mb(b.storage.usage || 0) + T(' из ', ' of ') + mb(b.storage.quota)));
  }

  function render() {
    const box = document.querySelector('#debug-body');
    box.innerHTML = '';
    const s = last.server;
    summary(box);
    section(box, T('Проверки интерфейса', 'Interface checks'));
    for (const c of last.selftest) box.appendChild(row(c.ok, c.name, c.detail));
    renderServer(box, s);
    renderRecognition(box, s, last.browser);
    renderData(box, s);
    renderProject(box, last.browser);

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
      when: new Date().toISOString(), page: location.href, userAgent: navigator.userAgent, language: G.I18n ? G.I18n.lang : null,
      selftest: last.selftest, server: last.server, serverError: last.serverError, browser: last.browser, interfaceErrors: ErrorLog.items,
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
