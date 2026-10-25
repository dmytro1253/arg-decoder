// Меню «Примеры»: все примеры сразу, по группам (ARG), с поиском. Каждый пример открывается на новой доске
// независимо от активного профиля и выбранного досье. У каждой группы есть «Открыть все».
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  /** Группы меню: «Начало», затем разборы ARG в порядке реестра, затем остальные в порядке появления. */
  function groupPresets(presets) {
    const START = T('Начало', 'Start');
    const groups = new Map();
    for (const p of presets) {
      const key = p.group || START;
      if (!groups.has(key)) groups.set(key, { name: key, arg: p.arg || null, items: [] });
      groups.get(key).items.push(p);
    }
    const rank = (g) => (g.name === START ? -2 : g.arg ? G.ArgCases.order(g.arg) : 1000);
    return [...groups.values()].map((g, i) => ({ g, i })).sort((a, b) => rank(a.g) - rank(b.g) || a.i - b.i).map((x) => x.g);
  }

  /** Подходит ли пример запросу: название, описание, группа, id и название ARG. */
  function matches(p, query) {
    if (!query) return true;
    const arg = p.arg && G.ArgCases ? G.ArgCases.name(p.arg) : '';
    return [p.title, p.desc, p.group, p.id, arg].some((s) => String(s || '').toLowerCase().includes(query));
  }

  function mount(opts) {
    const { menu, button, openPreset, openMany } = opts;
    const search = h('input', 'search ex-search');
    search.placeholder = T('Найти пример: шифр, ARG, слово…', 'Find an example: cipher, ARG, word…');
    search.spellcheck = false;
    const list = h('div', 'ex-list');
    menu.append(search, list);

    const close = () => menu.classList.add('hidden');

    function render() {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      let shown = 0;
      for (const group of groupPresets(G.Presets)) {
        const items = group.items.filter((p) => matches(p, q) || (q && String(group.name).toLowerCase().includes(q)));
        if (!items.length) continue;
        const head = h('div', 'menu-group ex-group');
        head.appendChild(h('span', '', group.name));
        if (items.length > 1) {
          const all = h('button', 'ex-all', T('Открыть все (' + items.length + ')', 'Open all (' + items.length + ')'));
          all.type = 'button';
          all.title = T('Открыть каждый пример этой группы на своей доске', 'Open every example of this group on its own board');
          all.onclick = (e) => { e.stopPropagation(); close(); openMany(items); };
          head.appendChild(all);
        }
        list.appendChild(head);
        for (const p of items) {
          const item = h('div', 'menu-item');
          item.append(h('b', '', p.title), h('span', 'muted', p.desc));
          item.onclick = () => { close(); openPreset(p); };
          list.appendChild(item);
          shown++;
        }
      }
      if (!shown) list.appendChild(h('div', 'muted small ex-empty', T('Ничего не найдено', 'Nothing found')));
    }

    search.oninput = render;
    search.onkeydown = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter') { const first = list.querySelector('.menu-item'); if (first) first.click(); }
    };
    menu.addEventListener('click', (e) => e.stopPropagation());
    button.onclick = (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
      if (!menu.classList.contains('hidden')) { search.value = ''; render(); setTimeout(() => search.focus(), 0); }
    };
    document.addEventListener('click', close);
    render();
    return { render };
  }

  G.ExamplesMenu = { mount, groupPresets, matches };
})(typeof self !== 'undefined' ? self : this);
