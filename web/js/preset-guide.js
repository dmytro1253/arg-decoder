// Карточка-гид для досок, открытых из примеров: что это за ARG, где был шифр, шаги цепочки с
// результатом каждого шага, ожидаемый ответ, почему пример решается вручную, расхождения источника.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const HIDDEN_KEY = 'argdec.guide.hidden';
  const MAX_OUT = 90;
  const REFRESH_MS = 250;
  const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  function hiddenSet() {
    try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')); } catch (e) { return new Set(); }
  }
  function setHidden(boardId, hidden) {
    const s = hiddenSet();
    if (hidden) s.add(boardId); else s.delete(boardId);
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...s].slice(-200))); } catch (e) { /* без хранилища — до перезагрузки */ }
  }

  function short(v) {
    // Ручка артефакта «artifact:<id>» ничего не говорит читателю: показываем имя файла или «картинка».
    if (G.Artifacts && G.Artifacts.isHandle && G.Artifacts.isHandle(v)) {
      const a = G.Artifacts.get(G.Artifacts.idOf(v));
      return a ? '📎 ' + a.name : T('🖼 обработанная картинка', '🖼 processed image');
    }
    const s = String(v === undefined ? '' : v).replace(/\s+/g, ' ');
    return s.length > MAX_OUT ? s.slice(0, MAX_OUT) + '…' : s;
  }

  /** Ноды в порядке потока данных: сначала входы, потом зависимые. */
  function orderNodes(graph) {
    const incoming = new Map();
    for (const l of graph.links) {
      if (!incoming.has(l.to)) incoming.set(l.to, []);
      incoming.get(l.to).push(l.from);
    }
    const out = [];
    const seen = new Set();
    const visit = (id) => {
      if (seen.has(id) || !graph.nodes.has(id)) return;
      seen.add(id);
      for (const from of incoming.get(id) || []) visit(from);
      out.push(graph.nodes.get(id));
    };
    const roots = [...graph.nodes.values()].sort((a, b) => a.y - b.y || a.x - b.x);
    for (const n of roots) visit(n.id);
    return out;
  }

  function describeNode(node) {
    if (node.type.startsWith('op:') && G.Solver && G.Solver.describeChain) {
      return G.Solver.describeChain([{ op: node.type.slice(3), params: node.params }]);
    }
    const def = G.typeDef(node.type);
    return def ? def.name : node.type;
  }

  function steps(view) {
    const graph = view.graph;
    const list = [];
    for (const node of orderNodes(graph)) {
      if (node.type === 'note') continue;
      const res = graph.results.get(node.id) || {};
      if (node.type === 'input') {
        list.push({ kind: 'input', text: T('Исходная строка', 'Source string'), value: node.params.text });
      } else if (node.type === 'view' || node.type === 'youtube') {
        continue;
      } else {
        let text = describeNode(node);
        // Ключ, пришедший по проводу во второй вход, подписываем значением, а не пустым параметром.
        const keyLink = graph.linkInto(node.id, 1);
        const keyRes = keyLink && graph.results.get(keyLink.from);
        if (keyRes && keyRes.value !== undefined) text = text + T(' · ключ со входа: ', ' · key from input: ') + short(keyRes.value);
        list.push({ kind: res.error ? 'error' : 'op', text, value: res.error ? '⚠ ' + res.error : res.value });
      }
    }
    return list;
  }

  function notes(view) {
    return [...view.graph.nodes.values()].filter((n) => n.type === 'note' && n.params.text).map((n) => n.params.text);
  }

  function presetFor(board) {
    return board && board.presetId && Array.isArray(G.Presets) ? G.Presets.find((p) => p.id === board.presetId) : null;
  }

  function container() {
    let el = document.getElementById('preset-guide');
    if (!el) {
      el = h('aside', 'preset-guide hidden');
      el.id = 'preset-guide';
      el.dataset.coversRight = '1'; // fitAll вписывает ноды левее карточки
      const canvas = document.getElementById('canvas');
      (canvas && canvas.parentElement ? canvas.parentElement : document.body).appendChild(el);
    }
    return el;
  }

  function runAuto(preset) {
    const input = document.getElementById('side-input');
    const run = document.getElementById('side-run');
    if (!input || !run || !preset.auto) return;
    for (const key of preset.auto.keys || []) if (G.KeyBank && G.KeyBank.add) G.KeyBank.add(key, T('ключ из примера', 'key from the example'));
    input.value = preset.auto.input;
    const autoTab = document.querySelector('.tab[data-tab="tab-auto"]');
    if (autoTab) autoTab.click();
    run.click();
  }

  function render(el, board, preset, view) {
    el.innerHTML = '';
    const head = h('div', 'guide-head');
    head.append(h('span', 'guide-arg', preset.arg || preset.group || T('Пример', 'Example')), h('b', 'guide-title', preset.title));
    const close = h('button', 'icon', '×');
    close.title = T('Свернуть гид', 'Collapse the guide');
    close.onclick = () => { setHidden(board.id, true); show(board, view); };
    head.appendChild(close);
    el.appendChild(head);
    if (preset.desc) el.appendChild(h('p', 'guide-desc', preset.desc));
    // Как решается этот пример: слепой авто-поиск, ручное решение с ключом или этап, где нужен человек.
    const how = preset.solve || (preset.auto ? 'auto' : 'context');
    const SOLVE = {
      auto: T('Слепой авто-поиск решает сам: ключи и ответ ему не передаются', 'The blind auto search solves it: no keys or answer are given to it'),
      'auto-server': T('Слепой авто-поиск с локальным Python-движком (нужен запущенный сервер)', 'Blind auto search with the local Python engine (the server must run)'),
      key: T('Ручное решение с ключом, добытым на предыдущем этапе', 'A manual solution with a key obtained at an earlier stage'),
      context: T('Нужен контекст или действие человека; программа делает вычислительную часть', 'Needs context or a human step; the program does the computing part'),
    };
    el.appendChild(h('div', 'guide-solve guide-solve-' + how, SOLVE[how] || SOLVE.context));

    const list = steps(view);
    if (list.length) {
      el.appendChild(h('div', 'guide-sub', T('Как решается — шаг за шагом', 'How it is solved — step by step')));
      const ol = h('ol', 'guide-steps');
      for (const s of list) {
        const li = h('li', 'guide-step ' + s.kind);
        li.appendChild(h('span', 'guide-op', s.text));
        if (s.value !== undefined && s.value !== '') li.appendChild(h('code', 'guide-val', short(s.value)));
        ol.appendChild(li);
      }
      el.appendChild(ol);
    }

    const answer = (preset.auto && preset.auto.expect) || (Array.isArray(preset.expect) ? preset.expect.join(' · ') : preset.expect);
    if (answer) {
      const a = h('div', 'guide-answer');
      a.append(h('span', '', T('Ответ: ', 'Answer: ')), h('code', '', short(answer)));
      el.appendChild(a);
    }
    if (preset.manual) el.appendChild(h('div', 'guide-manual', T('Вручную: ', 'Manual: ') + preset.manual));
    if (preset.discrepancy) el.appendChild(h('div', 'guide-warn', T('Расхождение источника: ', 'Source discrepancy: ') + preset.discrepancy));
    for (const text of notes(view)) el.appendChild(h('div', 'guide-note', text));

    const actions = h('div', 'guide-actions');
    if (preset.auto && preset.auto.input) {
      const b = h('button', 'btn small accent', T('⚡ Проверить авто-поиском', '⚡ Try auto search'));
      b.title = T('Подставить исходную строку в панель «Авто» и запустить поиск', 'Put the source string into the Auto panel and run the search');
      b.onclick = () => runAuto(preset);
      actions.appendChild(b);
    }
    const tip = h('span', 'muted small', T('Меняй параметры нод — результат пересчитывается сразу.', 'Change node parameters — results update instantly.'));
    actions.appendChild(tip);
    el.appendChild(actions);
  }

  function show(board, view) {
    const el = container();
    const preset = presetFor(board);
    if (!preset) { el.classList.add('hidden'); if (current) current.board = null; return; }
    el.classList.remove('hidden');
    // Во вкладке «Досье» сразу показываем досье того ARG, из которого взят пример.
    if (G.Dossiers && G.DossierUI && G.DossierUI.select) {
      const dossier = G.Dossiers.list().find((d) => Array.isArray(d.presets) && d.presets.includes(preset.id));
      if (dossier) { try { G.DossierUI.select(dossier.id); } catch (e) { /* досье не критично для гида */ } }
    }
    if (hiddenSet().has(board.id)) {
      el.classList.add('collapsed');
      el.innerHTML = '';
      const b = h('button', 'btn small', T('📖 Гид примера', '📖 Example guide'));
      b.onclick = () => { setHidden(board.id, false); show(board, view); };
      el.appendChild(b);
      return;
    }
    el.classList.remove('collapsed');
    // Шаги показывают результаты нод — ждём первого вычисления графа, потом обновляем после каждого пересчёта.
    requestAnimationFrame(() => render(el, board, preset, view));
    follow(el, board, preset, view);
  }

  let current = null;
  function follow(el, board, preset, view) {
    if (current && current.view !== view) current.view.root.removeEventListener('graph-evaluated', current.onEval);
    if (!current || current.view !== view) {
      const onEval = () => {
        clearTimeout(onEval.timer);
        onEval.timer = setTimeout(() => {
          const c = current;
          if (c && c.board && !c.el.classList.contains('hidden') && !c.el.classList.contains('collapsed')) render(c.el, c.board, c.preset, c.view);
        }, REFRESH_MS);
      };
      view.root.addEventListener('graph-evaluated', onEval);
      current = { view, onEval };
    }
    Object.assign(current, { el, board, preset });
  }

  G.PresetGuide = { show, steps, orderNodes };
})(typeof self !== 'undefined' ? self : this);
