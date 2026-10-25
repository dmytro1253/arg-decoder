// Полоса вкладок-досок над холстом: переключение, новая, переименование (двойной клик), перетаскивание порядка,
// закрытие, возврат закрытой, контекстное меню. Состоянием проекта не владеет — только рисует и сообщает обработчикам.
(function (G) {
  'use strict';
  const T = G.T;
  const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const DRAG_TYPE = 'text/board-id';

  /**
   * @param {HTMLElement} bar контейнер полосы
   * @param {object} on обработчики: switch(id), create(), rename(id, name), duplicate(id), close(id), move(id, index), restore(), exportBoard(id)
   */
  function create(bar, on) {
    bar.classList.add('boardbar');
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', T('Доски проекта', 'Project boards'));
    const tabs = h('div', 'board-tabs');
    const add = h('button', 'bt-btn', '+');
    add.title = T('Новая пустая доска', 'New empty board');
    add.setAttribute('aria-label', add.title);
    add.onclick = () => on.create();
    const restore = h('button', 'bt-btn hidden', '↶');
    restore.title = T('Вернуть закрытую доску', 'Reopen the closed board');
    restore.setAttribute('aria-label', restore.title);
    restore.onclick = () => on.restore();
    const status = h('span', 'bt-status');
    status.setAttribute('role', 'status');
    bar.append(tabs, add, restore, status);

    let menu = null;
    let model = { boards: [], activeId: null };

    function closeMenu() { if (menu) { menu.remove(); menu = null; } }

    function openMenu(e, board) {
      e.preventDefault();
      closeMenu();
      menu = h('div', 'board-menu');
      const i = model.boards.findIndex((b) => b.id === board.id);
      const item = (label, fn, disabled) => {
        const b = h('button', 'bm-item', label);
        b.disabled = !!disabled;
        b.onclick = () => { closeMenu(); fn(); };
        menu.appendChild(b);
      };
      item(T('Переименовать', 'Rename'), () => startRename(board.id));
      item(T('Дублировать', 'Duplicate'), () => on.duplicate(board.id));
      item(T('Сдвинуть влево', 'Move left'), () => on.move(board.id, i - 1), i === 0);
      item(T('Сдвинуть вправо', 'Move right'), () => on.move(board.id, i + 1), i === model.boards.length - 1);
      item(T('Сохранить доску как граф (.json)', 'Export the board as a graph (.json)'), () => on.exportBoard(board.id));
      item(T('Закрыть', 'Close'), () => on.close(board.id));
      Object.assign(menu.style, { left: Math.min(e.clientX, window.innerWidth - 230) + 'px', top: e.clientY + 'px' });
      document.body.appendChild(menu);
      setTimeout(() => document.addEventListener('pointerdown', (ev) => { if (menu && !menu.contains(ev.target)) closeMenu(); }, { once: true }), 0);
    }

    function startRename(id) {
      const tab = tabs.querySelector(`.board-tab[data-id="${id}"]`);
      if (!tab) return;
      const nameEl = tab.querySelector('.bt-name');
      const input = h('input', 'bt-rename');
      input.value = nameEl.textContent;
      input.maxLength = 80;
      input.setAttribute('aria-label', T('Название доски', 'Board name'));
      tab.draggable = false;
      nameEl.replaceWith(input);
      input.focus();
      input.select();
      let done = false;
      const finish = (save) => {
        if (done) return;
        done = true;
        if (save && input.value.trim()) on.rename(id, input.value.trim()); else render(model.boards, model.activeId);
      };
      input.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); };
      input.onblur = () => finish(true);
      input.onpointerdown = (e) => e.stopPropagation();
    }

    // ---------- перетаскивание порядка ----------
    function dropIndex(clientX) {
      const els = [...tabs.querySelectorAll('.board-tab')];
      let idx = els.length;
      for (let i = 0; i < els.length; i++) {
        const r = els[i].getBoundingClientRect();
        if (clientX < r.left + r.width / 2) { idx = i; break; }
      }
      return { idx, els };
    }

    function clearMarks() { tabs.querySelectorAll('.drop-before, .drop-after').forEach((t) => t.classList.remove('drop-before', 'drop-after')); }

    tabs.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      clearMarks();
      const { idx, els } = dropIndex(e.clientX);
      if (idx < els.length) els[idx].classList.add('drop-before'); else if (els.length) els[els.length - 1].classList.add('drop-after');
    });
    tabs.addEventListener('dragleave', (e) => { if (!tabs.contains(e.relatedTarget)) clearMarks(); });
    tabs.addEventListener('drop', (e) => {
      const id = e.dataTransfer.getData(DRAG_TYPE);
      if (!id) return;
      e.preventDefault();
      clearMarks();
      const from = model.boards.findIndex((b) => b.id === id);
      let to = dropIndex(e.clientX).idx;
      if (to > from) to -= 1;
      if (from >= 0 && to !== from) on.move(id, to);
    });

    function buildTab(board) {
      const active = board.id === model.activeId;
      const tab = h('div', 'board-tab' + (active ? ' active' : ''));
      tab.dataset.id = board.id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = 0;
      tab.draggable = true;
      tab.title = board.name + T('\nДвойной клик — переименовать, перетащи — изменить порядок', '\nDouble-click to rename, drag to reorder');
      const name = h('span', 'bt-name', board.name);
      const close = h('button', 'bt-close', '×');
      close.title = T('Закрыть доску (можно вернуть)', 'Close the board (can be reopened)');
      close.setAttribute('aria-label', close.title);
      close.onclick = (e) => { e.stopPropagation(); on.close(board.id); };
      close.onpointerdown = (e) => e.stopPropagation();
      tab.append(name, close);
      tab.onclick = () => { if (!active) on.switch(board.id); };
      tab.ondblclick = () => startRename(board.id);
      tab.oncontextmenu = (e) => openMenu(e, board);
      tab.onkeydown = (e) => {
        if (e.target !== tab) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); on.switch(board.id); }
        if (e.key === 'F2') { e.preventDefault(); startRename(board.id); }
      };
      tab.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData(DRAG_TYPE, board.id);
        e.dataTransfer.effectAllowed = 'move';
        tab.classList.add('dragging');
      });
      tab.addEventListener('dragend', () => { tab.classList.remove('dragging'); clearMarks(); });
      return tab;
    }

    function render(boards, activeId, closedCount) {
      model = { boards, activeId };
      if (closedCount !== undefined) restore.classList.toggle('hidden', !closedCount);
      tabs.innerHTML = '';
      boards.forEach((b) => tabs.appendChild(buildTab(b)));
      const act = tabs.querySelector('.board-tab.active');
      if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    /** kind: 'ok' | 'warn' */
    function setStatus(text, kind) {
      status.textContent = text;
      status.className = 'bt-status' + (kind === 'warn' ? ' warn' : '');
      status.title = text;
    }

    return { render, setStatus, startRename };
  }

  G.BoardTabs = { create };
})(typeof self !== 'undefined' ? self : this);
