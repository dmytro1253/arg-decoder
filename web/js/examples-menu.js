// Меню «Примеры»: группы-папки в двух разделах — «Разборы ARG» и «Техники и обучение». Папки свёрнуты
// (раскрытые запоминаются), поиск раскрывает те, где есть совпадения, и ищет ещё и по названиям нод примера.
// Каждый пример открывается на новой доске независимо от активного профиля. У каждой группы есть «Открыть все».
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

  /** Названия нод примера (операции и спецноды): по ним тоже ищем — «SSTV», «OCR», «Бифид». */
  function nodeNames(p) {
    if (p._nodeNames) return p._nodeNames;
    const names = new Set();
    for (const n of p.nodes || []) {
      const op = /^op:/.test(n.type) && G.CipherOps ? G.CipherOps.BY_ID[n.type.slice(3)] : null;
      const def = !op && G.NodeTypes ? G.NodeTypes[n.type] : null;
      if (op) names.add(op.name);
      else if (def && !['input', 'view', 'note', 'artifact'].includes(n.type)) names.add(def.name);
    }
    Object.defineProperty(p, '_nodeNames', { value: [...names].join(' · '), enumerable: false });
    return p._nodeNames;
  }

  /** Подходит ли пример запросу: название, описание, группа, id, название ARG и ноды внутри. */
  function matches(p, query) {
    if (!query) return true;
    const arg = p.arg && G.ArgCases ? G.ArgCases.name(p.arg) : '';
    return [p.title, p.desc, p.group, p.id, arg, nodeNames(p)].some((s) => String(s || '').toLowerCase().includes(query));
  }

  const OPEN_KEY = 'argdec.examples.open';
  const loadOpen = () => { try { return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) || '[]')); } catch (e) { return new Set(); } };
  const saveOpen = (set) => { try { localStorage.setItem(OPEN_KEY, JSON.stringify([...set])); } catch (e) { /* без хранилища — до перезагрузки */ } };

  function mount(opts) {
    const { menu, button, openPreset, openMany } = opts;
    const search = h('input', 'search ex-search');
    search.placeholder = T('Найти пример: шифр, ARG, слово…', 'Find an example: cipher, ARG, word…');
    search.spellcheck = false;
    const list = h('div', 'ex-list');
    menu.append(search, list);

    const close = () => menu.classList.add('hidden');

    const opened = loadOpen();

    function item(p) {
      const it = h('div', 'menu-item');
      it.append(h('b', '', p.title), h('span', 'muted', p.desc));
      it.onclick = () => { close(); openPreset(p); };
      return it;
    }

    function render() {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      let shown = 0;
      const START = T('Начало', 'Start');
      const all = groupPresets(G.Presets);
      // «Начало» (пример-старт) — самым первым пунктом, без папки.
      for (const g of all.filter((x) => x.name === START)) for (const p of g.items.filter((x) => matches(x, q))) { list.appendChild(item(p)); shown++; }
      const groups = all.filter((x) => x.name !== START);
      const sections = [
        [T('Разборы ARG', 'ARG walkthroughs'), groups.filter((g) => g.arg)],
        [T('Техники и обучение', 'Techniques and practice'), groups.filter((g) => !g.arg)],
      ];
      for (const [title, part] of sections) {
        const visible = part.map((group) => ({ group, items: group.items.filter((p) => matches(p, q) || (q && String(group.name).toLowerCase().includes(q))) })).filter((x) => x.items.length);
        if (!visible.length) continue;
        list.appendChild(h('div', 'ex-section', title));
        for (const { group, items } of visible) {
          const isOpen = !!q || opened.has(group.name);
          const head = h('div', 'menu-group ex-group ex-folder' + (isOpen ? ' open' : ''));
          head.setAttribute('role', 'button');
          head.setAttribute('aria-expanded', String(isOpen));
          head.appendChild(h('span', 'ex-folder-name', (isOpen ? '▾ ' : '▸ ') + group.name + ' · ' + items.length));
          head.onclick = () => {
            if (q) return;
            if (opened.has(group.name)) opened.delete(group.name); else opened.add(group.name);
            saveOpen(opened);
            render();
          };
          if (items.length > 1) {
            const all = h('button', 'ex-all', T('Открыть все (' + items.length + ')', 'Open all (' + items.length + ')'));
            all.type = 'button';
            all.title = T('Открыть каждый пример этой группы на своей доске', 'Open every example of this group on its own board');
            all.onclick = (e) => { e.stopPropagation(); close(); openMany(items); };
            head.appendChild(all);
          }
          list.appendChild(head);
          if (!isOpen) continue;
          for (const p of items) { list.appendChild(item(p)); shown++; }
        }
      }
      if (!list.children.length) list.appendChild(h('div', 'muted small ex-empty', T('Ничего не найдено', 'Nothing found')));
      return shown;
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

  G.ExamplesMenu = { mount, groupPresets, matches, nodeNames };
})(typeof self !== 'undefined' ? self : this);
