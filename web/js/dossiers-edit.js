// Досье: форма редактирования своего досье. Форма читается целиком при сохранении (read()), строки списков
// добавляются и удаляются прямо в DOM. Встроенные досье сюда не попадают: их сначала дублируют.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const { h } = G.DossierView;

  function field(label, control) {
    const wrap = h('label', 'field dos-field');
    wrap.append(h('span', 'field-label', label), control);
    return wrap;
  }
  function input(value, placeholder) {
    const el = h('input');
    el.type = 'text';
    el.value = value || '';
    el.spellcheck = false;
    if (placeholder) el.placeholder = placeholder;
    return el;
  }
  function area(value, rows, placeholder) {
    const el = h('textarea');
    el.rows = rows || 2;
    el.value = value || '';
    el.spellcheck = false;
    if (placeholder) el.placeholder = placeholder;
    return el;
  }
  function select(options, value) {
    const el = h('select');
    for (const [v, label] of options) { const o = h('option', '', label); o.value = v; el.appendChild(o); }
    el.value = value;
    return el;
  }
  const removeButton = (row) => {
    const b = h('button', 'icon', '×');
    b.type = 'button';
    b.title = T('Убрать строку', 'Remove the row');
    b.onclick = () => row.remove();
    return b;
  };

  /** Список строк: rows.add(data) добавляет строку, read() собирает значения из DOM. */
  function listEditor(title, makeRow, readRow, items, addLabel) {
    const box = h('fieldset', 'dos-fieldset');
    box.appendChild(h('legend', '', title));
    const rows = h('div', 'dos-rows');
    const add = (data) => { const row = h('div', 'dos-row'); makeRow(row, data); row.appendChild(removeButton(row)); rows.appendChild(row); };
    items.forEach(add);
    const btn = h('button', 'btn small', addLabel);
    btn.type = 'button';
    btn.onclick = () => add({});
    box.append(rows, btn);
    return { el: box, read: () => [...rows.children].map(readRow) };
  }

  const sourcesEditor = (items) => listEditor(T('Источники', 'Sources'), (row, s) => {
    row._f = { name: input(s.name, T('Название', 'Name')), url: input(s.url, 'https://…'), rel: select(G.Dossiers.RELIABILITY, s.reliability || 'unknown'), note: input(s.note, T('Заметка', 'Note')) };
    row.append(row._f.name, row._f.url, row._f.rel, row._f.note);
  }, (row) => ({ name: row._f.name.value, url: row._f.url.value, reliability: row._f.rel.value, note: row._f.note.value }), items, T('+ источник', '+ source'));

  const stagesEditor = (items) => listEditor(T('Цепочка этапов: артефакт → приём → результат', 'Chain of stages: artifact → technique → result'), (row, s) => {
    row._f = { artifact: area(s.artifact, 2, T('Артефакт', 'Artifact')), technique: area(s.technique, 2, T('Приём', 'Technique')), result: area(s.result, 2, T('Результат', 'Result')), status: select(G.Dossiers.STAGE_STATUS, s.status || 'verified'), note: input(s.note, T('Заметка / источник расхождения', 'Note / the discrepancy')) };
    row.append(row._f.artifact, row._f.technique, row._f.result, row._f.status, row._f.note);
  }, (row) => ({ artifact: row._f.artifact.value, technique: row._f.technique.value, result: row._f.result.value, status: row._f.status.value, note: row._f.note.value }), items, T('+ этап', '+ stage'));

  const techniquesEditor = (items) => listEditor(T('Приёмы', 'Techniques'), (row, t) => {
    row._f = { name: input(t.name, T('Приём', 'Technique')), example: input(t.example, T('Пример', 'Example')) };
    row.append(row._f.name, row._f.example);
  }, (row) => ({ name: row._f.name.value, example: row._f.example.value }), items, T('+ приём', '+ technique'));

  const openEditor = (items) => listEditor(T('Открытые вопросы', 'Open questions'), (row, q) => {
    row._f = { text: input(typeof q === 'string' ? q : '', T('Вопрос', 'Question')) };
    row.append(row._f.text);
  }, (row) => row._f.text.value, items, T('+ вопрос', '+ question'));

  /** Выбор связанных примеров или досок: список флажков с поиском. entries: [{ id, label, group }]. */
  function linkPicker(title, entries, selected, searchLabel) {
    const box = h('fieldset', 'dos-fieldset');
    box.appendChild(h('legend', '', title));
    const chosen = new Set(selected);
    const search = input('', searchLabel);
    const list = h('div', 'dos-picklist');
    const render = () => {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      let lastGroup = null;
      for (const e of entries) {
        if (q && !(e.label + ' ' + (e.group || '')).toLowerCase().includes(q) && !chosen.has(e.id)) continue;
        if (e.group && e.group !== lastGroup) { list.appendChild(h('div', 'menu-group', e.group)); lastGroup = e.group; }
        const row = h('label', 'dos-pick');
        const cb = h('input');
        cb.type = 'checkbox';
        cb.checked = chosen.has(e.id);
        cb.onchange = () => { if (cb.checked) chosen.add(e.id); else chosen.delete(e.id); };
        row.append(cb, h('span', '', e.label));
        list.appendChild(row);
      }
      if (!list.children.length) list.appendChild(h('div', 'muted small', T('Ничего не найдено', 'Nothing found')));
    };
    search.oninput = render;
    render();
    box.append(search, list);
    // Выбранные, которых больше нет в списке (например, пример убран из сборки), сохраняются как есть.
    return { el: box, read: () => [...chosen] };
  }

  /** presetEntries() → примеры по ARG; boardEntries() → доски проекта. Возвращает { el, read() → сырое досье }. */
  function build(draft, deps) {
    const el = h('form', 'dos-form');
    el.onsubmit = (e) => e.preventDefault();
    const f = {
      title: input(draft.title, T('Название досье', 'Dossier title')), period: input(draft.period), platform: input(draft.platform),
      creators: input(draft.creators), status: input(draft.status), summary: area(draft.summary, 5),
    };
    el.append(field(T('Название', 'Title'), f.title), field(T('Период', 'Period'), f.period), field(T('Платформа', 'Platform'), f.platform),
      field(T('Создатели / статус организатора', 'Creators / organiser status'), f.creators), field(T('Статус расследования', 'Investigation status'), f.status), field(T('Краткое описание', 'Summary'), f.summary));
    const sources = sourcesEditor(draft.sources);
    const stages = stagesEditor(draft.stages);
    const techniques = techniquesEditor(draft.techniques);
    const open = openEditor(draft.open);
    const presets = linkPicker(T('Связанные примеры', 'Linked examples'), deps.presetEntries(), draft.presets, T('Найти пример…', 'Find an example…'));
    const boards = linkPicker(T('Связанные доски проекта', 'Linked project boards'), deps.boardEntries(), draft.boards, T('Найти доску…', 'Find a board…'));
    [stages, sources, techniques, open, presets, boards].forEach((x) => el.appendChild(x.el));
    return {
      el,
      read: () => ({
        id: draft.id, title: f.title.value, period: f.period.value, platform: f.platform.value, creators: f.creators.value, status: f.status.value, summary: f.summary.value,
        sources: sources.read(), stages: stages.read(), techniques: techniques.read(), open: open.read(), presets: presets.read(), boards: boards.read(),
      }),
    };
  }

  G.DossierEdit = { build };
})(typeof self !== 'undefined' ? self : this);
