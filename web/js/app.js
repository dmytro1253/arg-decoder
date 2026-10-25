// Сборка интерфейса: палитра нод, верхняя панель, боковая панель (авто, досье, ключи), проект и доски.
// Меню примеров — examples-menu.js, вкладка «Досье» — dossiers-ui.js.
(function (G) {
  'use strict';
  const T = G.T;
  const $ = (sel) => document.querySelector(sel);
  const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  // Внутренние имена категорий остаются русскими (по ним красятся ноды), показываются — на языке интерфейса.
  const CAT_ORDER = ['Ввод и вывод', 'Авто', 'Проверка', 'Кодировки', 'Сдвиги', 'Шифры с ключом', 'ARG и Minecraft', 'Скрытое', 'Перестановки', 'Текст', 'Объединение', 'Изображения', 'Звук и видео', 'Файлы', 'Хеши'];
  const catLabel = (cat) => ({
    'Ввод и вывод': T('Ввод и вывод', 'Input & output'), 'Авто': T('Авто', 'Auto'), 'Проверка': T('Проверка', 'Checks'),
    'Кодировки': T('Кодировки', 'Encodings'), 'Сдвиги': T('Сдвиги', 'Shifts'), 'Шифры с ключом': T('Шифры с ключом', 'Keyed ciphers'),
    'ARG и Minecraft': T('ARG и Minecraft', 'ARG & Minecraft'), 'Скрытое': T('Скрытое', 'Hidden'), 'Перестановки': T('Перестановки', 'Permutations'),
    'Текст': T('Текст', 'Text'), 'Объединение': T('Объединение', 'Join'), 'Изображения': T('Изображения', 'Images'),
    'Звук и видео': T('Звук и видео', 'Audio & video'), 'Файлы': T('Файлы', 'Files'), 'Хеши': T('Хеши', 'Hashes'),
  }[cat] || cat);

  const graph = new G.Graph();
  let view;
  let annot;
  let ws;

  // ---------- язык интерфейса ----------
  // В index.html русский текст — сам элемент, английский — атрибуты data-t, data-t-title, data-t-ph, data-t-html.
  function localizeDom() {
    document.documentElement.lang = G.I18n.lang;
    if (G.I18n.lang === 'uk') {
      const uk = G.I18n.uk;
      document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = uk(el.textContent.trim()); });
      document.querySelectorAll('[data-t-html]').forEach((el) => { el.innerHTML = uk(el.innerHTML.trim()); });
      document.querySelectorAll('[title]').forEach((el) => { if (/[А-Яа-яЁё]/.test(el.title)) el.title = uk(el.title); });
      document.querySelectorAll('[placeholder]').forEach((el) => { if (/[А-Яа-яЁё]/.test(el.placeholder)) el.placeholder = uk(el.placeholder); });
      document.querySelectorAll('[aria-label]').forEach((el) => { if (/[А-Яа-яЁё]/.test(el.getAttribute('aria-label'))) el.setAttribute('aria-label', uk(el.getAttribute('aria-label'))); });
      return;
    }
    if (G.I18n.lang !== 'en') return;
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = el.dataset.t; });
    document.querySelectorAll('[data-t-html]').forEach((el) => { el.innerHTML = el.dataset.tHtml; });
    document.querySelectorAll('[data-t-title]').forEach((el) => { el.title = el.dataset.tTitle; });
    document.querySelectorAll('[data-t-ph]').forEach((el) => { el.placeholder = el.dataset.tPh; });
    document.querySelectorAll('[data-t-aria]').forEach((el) => { el.setAttribute('aria-label', el.dataset.tAria); });
  }

  function bindLanguage() {
    document.querySelectorAll('.lang-btn').forEach((btn) => {
      const on = btn.dataset.lang === G.I18n.lang;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
      btn.onclick = () => {
        if (btn.dataset.lang === G.I18n.lang) return;
        if (ws) ws.flush();
        G.I18n.set(btn.dataset.lang);
      };
    });
  }

  // ---------- всплывающие сообщения ----------
  let toastTimer = null;
  function toast(text, ms) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2600);
  }

  // ---------- список всех типов нод ----------
  function allTypes() {
    const list = Object.keys(G.NodeTypes).map((k) => ({ type: k, def: G.NodeTypes[k] }));
    for (const op of G.CipherOps.OPS) list.push({ type: 'op:' + op.id, def: G.typeDef('op:' + op.id) });
    return list;
  }

  function buildPalette(filter) {
    const box = $('#palette-list');
    box.innerHTML = '';
    const q = (filter || '').trim().toLowerCase();
    const items = allTypes().filter(({ def }) => !q || def.name.toLowerCase().includes(q) || (def.desc || '').toLowerCase().includes(q));
    // Категории пакетов расширений, которых нет в CAT_ORDER, выводятся в конце.
    const extra = [...new Set(items.map((x) => x.def.cat))].filter((c) => !CAT_ORDER.includes(c));
    for (const cat of CAT_ORDER.concat(extra)) {
      const inCat = items.filter((x) => x.def.cat === cat);
      if (!inCat.length) continue;
      const group = h('div', 'pal-group');
      group.appendChild(h('div', 'pal-cat', catLabel(cat)));
      for (const { type, def } of inCat) {
        const item = h('div', 'pal-item', def.name);
        item.style.borderLeftColor = 'var(--' + (G.CAT_CLASS[cat] || 'c-text') + ')';
        item.title = (G.Help && G.Help.short(type)) || def.desc || '';
        item.draggable = true;
        item.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/node-type', type));
        item.onclick = () => {
          const c = view.viewCenter();
          view.addNode(type, c.x + (Math.random() * 40 - 20), c.y + (Math.random() * 40 - 20));
        };
        group.appendChild(item);
      }
      box.appendChild(group);
    }
  }

  // ---------- быстрое добавление по двойному клику ----------
  function openQuickAdd(pos, e) {
    const qa = $('#quickadd');
    const input = qa.querySelector('input');
    const list = qa.querySelector('.qa-list');
    const helpLine = qa.querySelector('.qa-help');
    const showHelp = (type, def) => { helpLine.textContent = (G.Help && G.Help.short(type)) || def.desc || ''; };
    const setActive = (row) => {
      list.querySelectorAll('.qa-item.active').forEach((x) => x.classList.remove('active'));
      row.classList.add('active');
      showHelp(row.dataset.type, G.typeDef(row.dataset.type));
    };
    qa.style.left = e.clientX + 'px';
    qa.style.top = e.clientY + 'px';
    qa.classList.remove('hidden');
    input.value = '';
    const render = () => {
      list.innerHTML = '';
      const q = input.value.trim().toLowerCase();
      allTypes().filter(({ def }) => !q || def.name.toLowerCase().includes(q)).slice(0, 12).forEach(({ type, def }, i) => {
        const row = h('div', 'qa-item' + (i === 0 ? ' active' : ''), def.name);
        row.dataset.type = type;
        row.appendChild(h('span', 'muted', ' · ' + catLabel(def.cat)));
        row.title = (G.Help && G.Help.short(type)) || def.desc || '';
        row.onclick = () => { view.addNode(type, pos.x, pos.y); closeQuickAdd(); };
        row.onmouseenter = () => setActive(row);
        list.appendChild(row);
      });
      const first = list.querySelector('.qa-item.active');
      if (first) showHelp(first.dataset.type, G.typeDef(first.dataset.type)); else helpLine.textContent = '';
    };
    input.oninput = render;
    input.onkeydown = (ev) => {
      if (ev.key === 'Enter') { const cur = list.querySelector('.qa-item.active') || list.querySelector('.qa-item'); if (cur) cur.click(); }
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        const rows = [...list.querySelectorAll('.qa-item')];
        const at = rows.findIndex((r) => r.classList.contains('active'));
        const next = rows[(at + (ev.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length];
        if (next) { setActive(next); next.scrollIntoView({ block: 'nearest' }); }
      }
      if (ev.key === 'Escape') closeQuickAdd();
    };
    render();
    setTimeout(() => input.focus(), 0);
  }
  function closeQuickAdd() { $('#quickadd').classList.add('hidden'); }

  // ---------- меню примеров: все примеры, по группам, с поиском; пример открывается на новой доске ----------
  function openPresetBoard(preset) {
    ws.openPreset(preset);
    toast(T('Пример открыт на новой доске', 'Example opened on a new board'));
  }

  function openPresetBoards(presets) {
    presets.forEach((p) => ws.openPreset(p));
    toast(T('Открыто досок: ' + presets.length, 'Boards opened: ' + presets.length));
  }

  function initExamples() {
    G.ExamplesMenu.mount({ menu: $('#preset-menu'), button: $('#btn-presets'), openPreset: openPresetBoard, openMany: openPresetBoards });
  }

  // ---------- боковая панель: быстрая авто-расшифровка ----------
  let sideCancel = null;
  async function runSideAuto() {
    const text = $('#side-input').value;
    const btn = $('#side-run');
    const status = $('#side-status');
    const list = $('#side-results');
    if (sideCancel) { sideCancel.stop = true; return; }
    if (!text.trim()) { toast(T('Вставь шифр в поле', 'Paste a cipher into the field')); return; }
    sideCancel = { stop: false };
    btn.textContent = T('■ Стоп', '■ Stop');
    const started = Date.now();
    const show = (results, final) => {
      status.textContent = (final ? T('Готово', 'Done') : T('Ищу…', 'Searching…')) + T(' · вариантов ', ' · variants ') + results.length + ' · ' + ((Date.now() - started) / 1000).toFixed(1) + T(' с', ' s')
        + (final && results.engines && G.SolverEngines ? (G.SolverEngines.describe(results.engines) ? ' · ' + G.SolverEngines.describe(results.engines) : '') : '');
      view.renderResults(list, results.slice(0, 30), { verdict: results.verdict, onExpand: (r) => expandToGraph(text, r.chain) });
      const ids = results.filter((r) => G.Scorer.YT_ID.test(r.text)).slice(0, 25);
      $('#side-check-ids').classList.toggle('hidden', !ids.length || !final);
      $('#side-check-ids').onclick = () => checkIds(ids.map((r) => r.text));
    };
    try {
      const results = await G.Solver.solve(text, { depth: Number($('#side-depth').value), beam: 160, timeLimit: 45000, cancel: sideCancel }, (info) => show(info.results, false));
      show(results, true);
    } catch (e) {
      status.textContent = T('Ошибка поиска: ', 'Search error: ') + e.message;
    } finally {
      sideCancel = null;
      btn.textContent = T('⚡ Расшифровать', '⚡ Decrypt');
    }
  }

  let vigCancel = null;
  async function runSideVig() {
    const text = $('#side-input').value;
    const btn = $('#side-vig');
    const status = $('#side-status');
    const list = $('#side-results');
    if (vigCancel) { vigCancel.stop = true; return; }
    if (!text.trim()) { toast(T('Вставь шифр в поле', 'Paste a cipher into the field')); return; }
    vigCancel = { stop: false };
    btn.textContent = T('■ Стоп', '■ Stop');
    const started = Date.now();
    const show = (rows, stage) => {
      status.textContent = T('Виженер: ', 'Vigenère: ') + stage + ' · ' + ((Date.now() - started) / 1000).toFixed(1) + T(' с', ' s');
      view.renderResults(list, G.vigRowsToResults(rows).slice(0, 20), { onExpand: (r) => expandToGraph(text, r.chain) });
    };
    try {
      if (await G.API.pythonEngine()) {
        const out = await G.VigPython.run(text, { cancel: vigCancel }, (info) => show(info.rows, info.stage));
        show(out.rows, G.VigPython.outcome(out) + ' (Python, ' + (out.gpu ? 'GPU' : 'CPU') + ', ' + out.seconds + T(' с)', ' s)'));
      } else {
        const out = await G.VigenereAuto.run(text, { variants: ['vigenere', 'beaufort'], cancel: vigCancel }, (info) => show(info.rows, T('браузер · ', 'browser · ') + info.stage));
        show(out.rows, (vigCancel.stop ? T('остановлено', 'stopped') : T('готово', 'done')) + T(' (браузер)', ' (browser)'));
        status.textContent += '. ' + G.vigHintsText(out.hints);
      }
    } catch (e) {
      status.textContent = T('Ошибка подбора: ', 'Solver error: ') + e.message;
    } finally {
      vigCancel = null;
      btn.textContent = T('🔑 Подобрать ключ Виженера', '🔑 Find the Vigenère key');
    }
  }

  async function checkIds(ids) {
    if (!G.API.online) { toast(T('Проверка YouTube работает только при запуске через Запуск.bat', 'YouTube checks work only when started through the launcher (Запуск.bat / start.sh)')); return; }
    const box = $('#side-id-results');
    box.innerHTML = '';
    box.appendChild(h('div', 'muted', T('Проверяю ' + ids.length + ' ID…', 'Checking ' + ids.length + ' IDs…')));
    let found = 0;
    for (const id of ids) {
      const r = await G.API.youtube(id);
      if (r.status === 'found') { found++; box.appendChild(view.youtubeCard(id, r)); }
    }
    box.firstChild.textContent = T('Проверено ' + ids.length + ', доступных видео: ' + found, 'Checked ' + ids.length + ', videos available: ' + found);
  }

  function expandToGraph(text, chain) {
    const maxY = graph.nodes.size ? Math.max(...[...graph.nodes.values()].map((n) => n.y)) + 320 : 40;
    const minX = graph.nodes.size ? Math.min(...[...graph.nodes.values()].map((n) => n.x)) : 40;
    const input = view.addNode('input', minX, maxY, { text });
    view.materializeChain(input.id, chain, minX + 300, maxY);
    toast(T('Цепочка добавлена в граф', 'The chain was added to the graph'));
  }

  // ---------- досье и ключи ----------
  function initDossiers() {
    G.DossierUI.mount($('#tab-dossier'), {
      toast,
      openPreset: openPresetBoard,
      openPresets: openPresetBoards,
      openBoard: (id) => ws.switchTo(id),
      boards: () => ws.project.boards.map((b) => ({ id: b.id, name: b.name })),
      download: (text, name) => ws.download(text, name),
    });
  }

  // Банк ключей проекта: список с происхождением каждого ключа, добавление и удаление.
  function buildKeys() {
    const list = $('#keybank-list');
    list.innerHTML = '';
    const bank = G.KeyBank;
    if (!bank) return;
    const entries = bank.list();
    if (!entries.length) list.appendChild(h('div', 'muted small', T('В банке пока нет ключей.', 'The bank has no keys yet.')));
    for (const e of entries) {
      // «Островок» с крестиком; найденные программой ключи (не введённые вручную) — с пунктирной рамкой.
      const chip = h('span', 'kbank-chip' + (e.source === 'user' ? '' : ' auto'));
      const when = e.added ? new Date(e.added).toLocaleString(G.I18n && G.I18n.locale ? G.I18n.locale() : undefined) : '';
      chip.title = (e.source === 'user' ? T('введён вручную', 'typed by hand') : e.source) + (when ? ' · ' + when : '');
      const del = h('button', 'kbank-x', '×');
      del.type = 'button';
      del.title = T('Убрать ключ «', 'Remove the key “') + e.value + T('»', '”');
      del.setAttribute('aria-label', del.title);
      del.onclick = () => bank.remove(e.value);
      chip.append(h('span', 'kbank-value', e.value), del);
      list.appendChild(chip);
    }
    const p = G.AuthorProfile;
    const own = bank.values();
    $('#keys-base').textContent = ((p && p.baseKeys) || []).filter((k) => !own.includes(k)).join(', ') || '—';
  }

  function bindKeys() {
    $('#keys-save').onclick = () => {
      const words = $('#keys-input').value.split(/\n|,/).map((x) => x.trim()).filter(Boolean);
      for (const w of words) G.KeyBank.add(w, 'user');
      $('#keys-input').value = '';
      if (words.length) toast(T('Ключи добавлены — авто-расшифровка будет их пробовать', 'Keys added — auto-decryption will try them'));
    };
    // Enter добавляет, Shift+Enter — новая строка (несколько ключей сразу).
    $('#keys-input').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); $('#keys-save').click(); } });
    $('#keys-clear').onclick = () => { if (G.KeyBank.list().length && confirm(T('Убрать все ключи проекта?', 'Remove all project keys?'))) G.KeyBank.clear(); };
    if (G.KeyBank.onChange) G.KeyBank.onChange(buildKeys);
  }

  function bindTabs() {
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.onclick = () => {
        document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.tab-pane').forEach((p) => p.classList.toggle('hidden', p.id !== tab.dataset.tab));
        $('#side').classList.remove('collapsed');
      };
    });
    $('#btn-side').onclick = () => $('#side').classList.toggle('collapsed');
  }

  // ---------- верхняя панель и клавиши ----------
  const setPressed = (sel, on) => { const el = $(sel); el.classList.toggle('active', on); el.setAttribute('aria-pressed', String(on)); };

  function bindToolbar() {
    $('#btn-new').onclick = () => ws.newProject();
    $('#btn-restore').onclick = () => ws.restorePrevious();
    $('#btn-save').onclick = () => ws.saveFile();
    $('#btn-open').onclick = () => $('#file-open').click();
    $('#file-open').onchange = (e) => { if (e.target.files[0]) ws.openFile(e.target.files[0]); e.target.value = ''; };
    $('#btn-fit').onclick = () => view.fitAll();
    $('#btn-undo').onclick = () => { if (!view.undo()) toast(T('Отменять нечего', 'Nothing to undo')); };
    $('#btn-redo').onclick = () => { if (!view.redo()) toast(T('Повторять нечего', 'Nothing to redo')); };
    $('#btn-layout').onclick = () => view.autoLayout();
    $('#btn-draw').onclick = () => annot.setActive(!annot.active);
    $('#btn-sga').onclick = () => G.Keyboards.toggle();
    $('#side-run').onclick = runSideAuto;
    $('#side-vig').onclick = runSideVig;
    $('#side-input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runSideAuto(); });
    $('#palette-search').oninput = (e) => buildPalette(e.target.value);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#quickadd')) closeQuickAdd(); });
  }

  function onKeyDown(e) {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    const mod = e.ctrlKey || e.metaKey;
    const key = e.code;
    if (mod && key === 'KeyS') { e.preventDefault(); ws.saveFile(); return; }
    if (mod && e.shiftKey && key === 'KeyT' && !typing) { e.preventDefault(); ws.restoreClosed(); return; }
    if (annot.handleKey(e)) { e.preventDefault(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && view.deleteSelection()) e.preventDefault();
    if (e.key === 'Escape') { closeQuickAdd(); view.select(null); }
    // Выделенный мышью текст копируется как обычно, а не как ноды. Копирование и вставка нод — в clipboard-paste.js.
    const textSelected = String(window.getSelection() || '').length > 0;
    if (typing || !mod || textSelected) return;
    if (key === 'KeyZ' && !e.shiftKey) { e.preventDefault(); view.undo(); }
    if (key === 'KeyY' || (key === 'KeyZ' && e.shiftKey)) { e.preventDefault(); view.redo(); }
    if (key === 'KeyD') { e.preventDefault(); view.duplicateSelection(); }
    if (key === 'KeyA') { e.preventDefault(); view.selectAll(); }
  }

  function bindServerStatus() {
    const pill = $('#server-status');
    G.API.onChange((online) => {
      pill.classList.toggle('online', online);
      pill.textContent = online ? T('● Проверка YouTube: работает', '● YouTube check: on') : T('● Проверка YouTube: выкл.', '● YouTube check: off');
      pill.title = online ? T('Локальный сервер запущен, ID можно проверять', 'The local server is running, IDs can be checked')
        : T('Открой программу через «Запуск.bat», чтобы проверять ссылки. Всё остальное работает и так.', 'Start the program through the launcher to check links. Everything else works without it.');
    });
    G.API.ping();
    if (G.Updates) G.Updates.init();
  }

  // ---------- запуск ----------
  function safeLocalStorage() {
    try { void window.localStorage.length; return window.localStorage; } catch (e) {
      return { getItem: () => null, setItem: () => { throw new Error('storage unavailable'); }, removeItem: () => {} };
    }
  }

  function initWorkspace() {
    const store = G.Project.createStore({ local: safeLocalStorage(), idb: G.Project.browserIdb() });
    ws = new G.Workspace({
      graph, view, annot, store, toast,
      tabsFactory: (handlers) => G.BoardTabs.create($('#boardbar'), handlers),
    });
    G.workspace = ws;
    // Кнопка «Открыть пример» в карточке справки открывает пресет на новой доске.
    if (G.Help) G.Help.openExample = openPresetBoard;
    G.Artifacts.onChange(() => ws.scheduleSave());
    if (G.KeyBank && G.KeyBank.onChange) G.KeyBank.onChange(() => ws.scheduleSave());
    if (G.Dossiers) G.Dossiers.onChange(() => ws.scheduleSave());
    if (G.Profiles && G.Profiles.onChange) G.Profiles.onChange(() => { G.DossierUI.refresh(); buildKeys(); });
  }

  // Пакет файлов: «→ в новую ноду Ввод» и сохранённые артефакты превращаются в ноды рядом с центром вида.
  function bindFilesHooks() {
    if (!G.ArgFiles) return;
    const spawn = (type, params) => { const c = view.viewCenter(); return view.addNode(type, c.x + 30, c.y + 30, params); };
    G.ArgFiles.hooks = G.ArgFiles.hooks || {};
    G.ArgFiles.hooks.sendToInput = (text) => { spawn('input', { text }); toast(T('Создана нода «Ввод»', 'Input node created')); };
    G.ArgFiles.hooks.artifactSaved = (handle) => {
      const id = G.Artifacts.idOf(handle);
      if (id) spawn('artifact', { artifact: id });
    };
  }

  function initDrawing() {
    annot = new G.AnnotationLayer(view, {});
    G.AnnotToolbar.mount($('#canvas-col'), annot);
    const toolbarSync = annot.hooks.onState;
    annot.hooks.onState = (a) => { toolbarSync(a); setPressed('#btn-draw', a.active); };
    G.Keyboards.mount({
      toast,
      createInput: (text) => { const c = view.viewCenter(); view.addNode('input', c.x, c.y, { text }); toast(T('Создана нода «Ввод»', 'Input node created')); },
      onToggle: (open) => setPressed('#btn-sga', open),
    });
    G.ClipboardPaste.mount({ view, annot, toast });
  }

  async function init() {
    localizeDom();
    bindLanguage();
    view = new G.GraphView($('#canvas'), graph, {
      toast,
      onChange: () => ws && ws.scheduleSave(),
      onCamera: () => ws && ws.scheduleSave(),
      onBackgroundDblClick: openQuickAdd,
    });
    initDrawing();
    G.Scorer.init();
    initWorkspace();
    buildPalette('');
    initExamples();
    initDossiers();
    buildKeys();
    bindKeys();
    bindFilesHooks();
    bindTabs();
    bindToolbar();
    bindServerStatus();
    G.debugToast = toast;
    G.Debug.init();
    window.addEventListener('resize', () => view.drawWires());
    await ws.start(G.Presets[0]);
    applyUrlParams();
  }

  // Ссылки вида ?preset=em-vig&tab=tab-dossier: открыть пример на новой доске и нужную вкладку панели.
  function applyUrlParams() {
    let params;
    try { params = new URLSearchParams(location.search); } catch (e) { return; }
    const presetId = params.get('preset');
    const preset = presetId && G.Presets.find((p) => p.id === presetId);
    if (preset) ws.openPreset(preset);
    const tab = params.get('tab');
    const tabBtn = tab && document.querySelector('.tab[data-tab="' + tab.replace(/[^\w-]/g, '') + '"]');
    if (tabBtn) tabBtn.click();
  }

  document.addEventListener('DOMContentLoaded', init);
})(typeof self !== 'undefined' ? self : this);
