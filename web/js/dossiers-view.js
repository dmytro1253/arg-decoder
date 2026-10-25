// Досье: режим просмотра. Только DOM (textContent, без innerHTML): текст досье может прийти из импортированного файла.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);

  const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
  };

  /** Внешняя ссылка: только http(s), открывается в новой вкладке без передачи opener. */
  function externalLink(text, href, cls) {
    const safe = G.Dossiers ? G.Dossiers.safeUrl(href) : '';
    if (!safe) return h('span', cls || '', text);
    const a = h('a', cls || '', text);
    a.href = safe;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  const metaRow = (label, value) => {
    if (!value) return null;
    const row = h('div', 'dos-meta-row');
    row.append(h('span', 'dos-meta-label', label), h('span', '', value));
    return row;
  };

  function section(title, count) {
    const box = h('section', 'dos-section');
    box.appendChild(h('h3', '', title + (count ? ' · ' + count : '')));
    return box;
  }

  function renderSources(d) {
    if (!d.sources.length) return null;
    const box = section(T('Источники и надёжность', 'Sources and reliability'), d.sources.length);
    for (const s of d.sources) {
      const row = h('div', 'dos-source');
      const head = h('div', 'dos-source-head');
      head.append(s.url ? externalLink(s.name || s.url, s.url) : h('b', '', s.name), h('span', 'dos-badge rel-' + s.reliability, G.Dossiers.reliabilityLabel(s.reliability)));
      row.appendChild(head);
      if (s.note) row.appendChild(h('div', 'muted small', s.note));
      box.appendChild(row);
    }
    return box;
  }

  function renderStages(d) {
    if (!d.stages.length) return null;
    const box = section(T('Цепочка этапов', 'Chain of stages'), d.stages.length);
    d.stages.forEach((st, i) => {
      const row = h('div', 'dos-stage st-' + st.status);
      const head = h('div', 'dos-stage-head');
      head.append(h('span', 'dos-stage-no', String(i + 1)), h('span', 'dos-badge st-' + st.status, G.Dossiers.statusLabel(st.status)));
      row.appendChild(head);
      const flow = h('div', 'dos-flow');
      flow.append(h('div', 'dos-flow-art mono-ish', st.artifact || '—'), h('div', 'dos-flow-arrow', '→'), h('div', 'dos-flow-tech', st.technique || '—'), h('div', 'dos-flow-arrow', '→'), h('div', 'dos-flow-res mono-ish', st.result || '—'));
      row.appendChild(flow);
      if (st.note) row.appendChild(h('div', 'dos-stage-note', st.note));
      box.appendChild(row);
    });
    return box;
  }

  function renderList(title, items, render) {
    if (!items.length) return null;
    const box = section(title, items.length);
    const ul = h('div', 'dossier-list');
    items.forEach((x) => ul.appendChild(render(x)));
    box.appendChild(ul);
    return box;
  }

  /** Связанные примеры и доски: кнопки открытия. ctx: { openPreset, openPresets, openBoard, boards }. */
  function renderLinks(d, ctx) {
    const presets = G.Dossiers.presetsOf(d);
    const boards = (ctx.boards ? ctx.boards() : []).filter((b) => (d.boards || []).includes(b.id));
    const missing = (d.presets || []).length - presets.length;
    if (!presets.length && !boards.length && !missing) return null;
    const box = section(T('Связанные примеры и доски', 'Linked examples and boards'));
    if (presets.length) {
      const all = h('button', 'btn small accent', T('Открыть все примеры (' + presets.length + ')', 'Open all examples (' + presets.length + ')'));
      all.onclick = () => ctx.openPresets(presets);
      box.appendChild(all);
      for (const p of presets) {
        const row = h('button', 'dos-link-row');
        row.append(h('b', '', p.title), h('span', 'muted small', p.desc || ''));
        row.onclick = () => ctx.openPreset(p);
        box.appendChild(row);
      }
    }
    if (missing > 0) box.appendChild(h('div', 'muted small', T('Примеров нет в этой сборке: ' + missing, 'Examples missing in this build: ' + missing)));
    for (const b of boards) {
      const row = h('button', 'dos-link-row');
      row.append(h('b', '', T('Доска: ', 'Board: ') + b.name));
      row.onclick = () => ctx.openBoard(b.id);
      box.appendChild(row);
    }
    return box;
  }

  /** Полный вид досье. */
  function render(d, ctx) {
    const root = h('div', 'dos-view');
    const head = h('div', 'dos-head');
    head.append(h('h2', 'dos-title', d.title), h('span', 'dos-badge ' + (d.builtin ? 'dos-builtin' : 'dos-custom'), d.builtin ? T('встроенное · только чтение', 'built-in · read-only') : T('своё', 'custom')));
    root.appendChild(head);
    const meta = h('div', 'dos-meta');
    [[T('Период', 'Period'), d.period], [T('Платформа', 'Platform'), d.platform], [T('Создатели', 'Creators'), d.creators], [T('Статус', 'Status'), d.status]].forEach(([k, v]) => { const r = metaRow(k, v); if (r) meta.appendChild(r); });
    root.appendChild(meta);
    if (d.summary) root.appendChild(h('p', 'dos-summary', d.summary));
    const parts = [
      renderLinks(d, ctx),
      renderStages(d),
      renderSources(d),
      renderList(T('Приёмы', 'Techniques'), d.techniques, (t) => { const row = h('div', 'd-row'); row.append(h('b', '', t.name), h('div', 'muted mono-ish', t.example)); return row; }),
      renderList(T('Открытые вопросы', 'Open questions'), d.open, (q) => h('div', 'd-step', q)),
    ];
    parts.filter(Boolean).forEach((p) => root.appendChild(p));
    return root;
  }

  G.DossierView = { h, externalLink, render };
})(typeof self !== 'undefined' ? self : this);
