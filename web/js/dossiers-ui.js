// Вкладка «Досье»: выбор досье, просмотр, создание, правка, копирование, удаление, импорт и экспорт.
// «Стандартное» досье — прежнее досье профиля расследования (ключи, приёмы, цепочка) — остаётся как есть.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const { h, externalLink } = G.DossierView;
  const STANDARD = 'standard';
  const LS_SELECTED = 'argdec.dossier';

  let box = null;
  let deps = null;
  let selected = STANDARD;
  let mode = 'view';          // 'view' | 'edit'
  let editor = null;

  const store = {
    get() { try { return G.localStorage ? G.localStorage.getItem(LS_SELECTED) : null; } catch (e) { return null; } },
    set(v) { try { if (G.localStorage) G.localStorage.setItem(LS_SELECTED, v); } catch (e) { /* без хранилища выбор живёт до перезагрузки */ } },
  };

  const notify = (text) => { if (deps && deps.toast) deps.toast(text); };

  // ---------- стандартное досье профиля ----------
  function profilePicker() {
    const wrap = h('div', 'profile-pick');
    wrap.appendChild(h('label', 'field-label', T('Профиль расследования', 'Investigation profile')));
    if (!G.Profiles) return wrap;
    const sel = h('select');
    for (const pr of G.Profiles.list()) { const o = h('option', '', pr.name); o.value = pr.id; sel.appendChild(o); }
    sel.value = G.Profiles.active().id;
    sel.onchange = () => { try { G.Profiles.setActive(sel.value); } catch (e) { notify(e.message); } };
    wrap.append(sel);
    return wrap;
  }

  function renderStandard(into) {
    const p = G.AuthorProfile;
    into.appendChild(profilePicker());
    if (!p) return;
    const head = h('div', 'dossier-head');
    head.appendChild(p.channelUrl ? externalLink(p.name + ' · ' + p.channel, p.channelUrl) : h('b', '', p.name));
    if (p.channelId) head.appendChild(h('div', 'muted', T('ID канала: ', 'Channel ID: ') + p.channelId));
    if (p.description) head.appendChild(h('div', 'muted small', p.description));
    into.appendChild(head);
    const section = (title, rows, render) => {
      if (!Array.isArray(rows) || !rows.length) return;
      into.appendChild(h('h3', '', title));
      const ul = h('div', 'dossier-list');
      rows.forEach((r) => ul.appendChild(render(r)));
      into.appendChild(ul);
    };
    const pair = ([name, ex]) => { const row = h('div', 'd-row'); row.append(h('b', '', name), h('div', 'muted', ex)); return row; };
    section(T('Решённая цепочка', 'Solved chain'), p.chain, ([title, id, how]) => {
      const row = h('div', 'd-row');
      row.append(h('b', '', title), externalLink(id, 'https://www.youtube.com/watch?v=' + id, 'mono'), h('div', 'muted', how));
      return row;
    });
    section(T('Приёмы', 'Techniques'), p.techniques, ([name, ex]) => { const row = h('div', 'd-row'); row.append(h('b', '', name), h('div', 'muted mono-ish', ex)); return row; });
    section(T('Открытые вопросы', 'Open questions'), p.open, pair);
    section(T('Приёмы других ARG', 'Techniques from other ARGs'), p.foreign, pair);
    section(T('Порядок проверки', 'Checklist'), p.workflow, (step) => h('div', 'd-step', step));
    // Примеры, привязанные к активному профилю (дело mslan), открываются отсюда же.
    const own = p.id === (G.Profiles && G.Profiles.DEFAULT) ? [] : (G.Presets || []).filter((x) => x.profile === p.id);
    if (own.length) {
      into.appendChild(h('h3', '', T('Примеры этого профиля', 'Examples of this profile') + ' · ' + own.length));
      const all = h('button', 'btn small accent', T('Открыть все примеры (' + own.length + ')', 'Open all examples (' + own.length + ')'));
      all.onclick = () => deps.openPresets(own);
      into.appendChild(all);
    }
  }

  // ---------- выбор и действия ----------
  function option(value, label) { const o = h('option', '', label); o.value = value; return o; }

  function buildSelector() {
    const wrap = h('div', 'dos-picker');
    wrap.appendChild(h('label', 'field-label', T('Досье', 'Dossier')));
    const sel = h('select', 'dos-select');
    sel.appendChild(option(STANDARD, T('Стандартное: профиль расследования', 'Standard: the investigation profile')));
    const builtin = h('optgroup');
    builtin.label = T('Разборы ARG (только чтение)', 'ARG case studies (read-only)');
    G.Dossiers.builtinList().forEach((d) => builtin.appendChild(option(d.id, d.title)));
    sel.appendChild(builtin);
    const mine = G.Dossiers.customList();
    if (mine.length) {
      const grp = h('optgroup');
      grp.label = T('Мои досье', 'My dossiers');
      mine.forEach((d) => grp.appendChild(option(d.id, d.title)));
      sel.appendChild(grp);
    }
    sel.value = selected === STANDARD || G.Dossiers.get(selected) ? selected : STANDARD;
    sel.onchange = () => select(sel.value);
    wrap.appendChild(sel);
    return wrap;
  }

  function button(label, cls, onClick, title) {
    const b = h('button', 'btn small ' + (cls || ''), label);
    b.type = 'button';
    if (title) b.title = title;
    b.onclick = onClick;
    return b;
  }

  function buildToolbar(d) {
    const bar = h('div', 'dos-toolbar');
    bar.append(button(T('+ Новое', '+ New'), 'accent', createNew, T('Создать своё досье', 'Create your own dossier')), button(T('Импорт…', 'Import…'), '', importFile, T('Открыть досье из JSON-файла', 'Open a dossier from a JSON file')));
    if (d) {
      if (!d.builtin) bar.appendChild(button(T('Править', 'Edit'), '', () => { mode = 'edit'; render(); }));
      bar.appendChild(button(d.builtin ? T('Копия для правки', 'Copy to edit') : T('Дублировать', 'Duplicate'), '', () => duplicate(d.id), d.builtin ? T('Встроенное досье только для чтения: сделать редактируемую копию', 'A built-in dossier is read-only: make an editable copy') : ''));
      bar.appendChild(button(T('Экспорт', 'Export'), '', () => exportOne(d.id), T('Сохранить это досье в JSON-файл', 'Save this dossier to a JSON file')));
      if (!d.builtin) bar.appendChild(button(T('Удалить', 'Delete'), 'danger', () => remove(d)));
    }
    return bar;
  }

  function select(id) {
    selected = id;
    mode = 'view';
    store.set(id);
    render();
  }

  function createNew() {
    const d = G.Dossiers.create({});
    selected = d.id;
    mode = 'edit';
    store.set(d.id);
    render();
  }

  function duplicate(id) {
    try {
      const copy = G.Dossiers.duplicate(id);
      selected = copy.id;
      mode = 'view';
      store.set(copy.id);
      render();
      notify(T('Создана редактируемая копия', 'An editable copy was created'));
    } catch (e) { notify(e.message); }
  }

  function remove(d) {
    if (!confirm(T('Удалить досье «' + d.title + '»? Это нельзя отменить.', 'Delete the dossier “' + d.title + '”? This cannot be undone.'))) return;
    try { G.Dossiers.remove(d.id); } catch (e) { notify(e.message); return; }
    selected = STANDARD;
    mode = 'view';
    render();
  }

  function exportOne(id) {
    try { deps.download(G.Dossiers.exportJSON(id), G.Dossiers.fileName(id)); notify(T('Досье сохранено в файл', 'The dossier was saved to a file')); } catch (e) { notify(e.message); }
  }

  function importFile() {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = '.json,application/json';
    picker.onchange = () => {
      const file = picker.files && picker.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onerror = () => notify(T('Не удалось прочитать файл', 'Could not read the file'));
      reader.onload = () => {
        try {
          const d = G.Dossiers.importJSON(String(reader.result));
          selected = d.id;
          mode = 'view';
          store.set(d.id);
          render();
          notify(T('Досье «' + d.title + '» импортировано', 'The dossier “' + d.title + '” was imported'));
        } catch (e) { notify(T('Не открыть: ', 'Cannot open: ') + e.message); }
      };
      reader.readAsText(file);
    };
    picker.click();
  }

  // ---------- редактор ----------
  function presetEntries() {
    const list = (G.Presets || []).slice().sort((a, b) => (G.ArgCases ? G.ArgCases.order(a.arg) - G.ArgCases.order(b.arg) : 0));
    return list.map((p) => ({ id: p.id, label: p.title, group: p.group || T('Начало', 'Start') }));
  }
  const boardEntries = () => (deps.boards() || []).map((b) => ({ id: b.id, label: b.name }));

  function renderEditor(d) {
    const wrap = h('div', 'dos-edit');
    wrap.appendChild(h('h2', 'dos-title', T('Правка досье', 'Edit the dossier')));
    editor = G.DossierEdit.build(d, { presetEntries, boardEntries });
    wrap.appendChild(editor.el);
    const bar = h('div', 'dos-toolbar dos-sticky');
    bar.append(button(T('Сохранить', 'Save'), 'accent', saveEditor), button(T('Отмена', 'Cancel'), '', () => { mode = 'view'; render(); }));
    wrap.appendChild(bar);
    return wrap;
  }

  function saveEditor() {
    try {
      const saved = G.Dossiers.save(editor.read());
      selected = saved.id;
      mode = 'view';
      render();
      notify(T('Досье сохранено', 'The dossier was saved'));
    } catch (e) { notify(e.message); }
  }

  // ---------- сборка вкладки ----------
  function render() {
    if (!box) return;
    box.innerHTML = '';
    editor = null;
    box.appendChild(buildSelector());
    const d = selected === STANDARD ? null : G.Dossiers.get(selected);
    // Выбранного досье может ещё не быть (свои досье подгружаются вместе с проектом): выбор запоминаем, показываем стандартное.
    box.appendChild(buildToolbar(d));
    if (!d) { renderStandard(box); return; }
    if (mode === 'edit' && !d.builtin) { box.appendChild(renderEditor(d)); return; }
    box.appendChild(G.DossierView.render(d, {
      openPreset: deps.openPreset, openPresets: deps.openPresets, openBoard: deps.openBoard, boards: deps.boards,
    }));
  }

  /**
   * @param {HTMLElement} el контейнер вкладки
   * @param {{toast, openPreset, openPresets, openBoard, boards, download}} d зависимости приложения
   */
  function mount(el, d) {
    box = el;
    deps = d;
    const saved = store.get();
    if (saved) selected = saved;
    render();
  }

  G.DossierUI = { mount, refresh: render, select, STANDARD };
})(typeof self !== 'undefined' ? self : this);
