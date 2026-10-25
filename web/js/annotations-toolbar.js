// Панель инструментов рисования: инструменты, цвет, толщина, замок, порядок, выбор картинки-улики.
(function (G) {
  'use strict';
  const T = G.T;
  const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const COLORS = ['#ff9f43', '#ff5c7a', '#ffd34d', '#5ee08c', '#4fd1ff', '#5aa9ff', '#c58bff', '#ffffff'];
  const WIDTHS = [2, 3, 5, 8, 14];

  const TOOLS = () => [
    ['select', '↖', T('Выбрать, двигать, менять размер (V)', 'Select, move, resize (V)')],
    ['hand', '✋', T('Сдвиг холста (H, или пробел)', 'Pan the board (H, or Space)')],
    ['pen', '✏', T('Карандаш (P)', 'Pencil (P)')],
    ['arrow', '↗', T('Стрелка-заметка (A). Не соединяет ноды: это пометка', 'Note arrow (A). Does not connect nodes: it is only a mark')],
    ['rect', '▭', T('Рамка (R). Shift — квадрат', 'Frame (R). Shift for a square')],
    ['ellipse', '◯', T('Эллипс (O). Shift — круг', 'Ellipse (O). Shift for a circle')],
    ['text', 'T', T('Подпись (T). Двойной клик по подписи — править; Ctrl+Enter — готово', 'Label (T). Double-click a label to edit; Ctrl+Enter to finish')],
    ['image', '🖼', T('Картинка на доске (I): улика из проекта или файл', 'Picture on the board (I): a project artifact or a file')],
    ['eraser', '🧹', T('Ластик (E): стирает фигуры, к которым прикоснулся', 'Eraser (E): removes shapes you touch')],
  ];

  function mount(parent, layer) {
    const bar = h('div', 'annot-toolbar hidden');
    const toolBtns = new Map();
    const groupTools = h('div', 'at-group');
    for (const [id, icon, title] of TOOLS()) {
      const b = h('button', 'at-btn', icon);
      b.title = title;
      b.setAttribute('aria-label', title);
      b.onclick = () => (id === 'image' ? (layer.imagePoint = null, layer.setTool('image'), openPicker(b)) : layer.setTool(id));
      toolBtns.set(id, b);
      groupTools.appendChild(b);
    }

    const groupStyle = h('div', 'at-group');
    const swatches = COLORS.map((c) => {
      const b = h('button', 'at-swatch');
      b.style.background = c;
      b.title = c;
      b.onclick = () => layer.setStyle({ color: c });
      groupStyle.appendChild(b);
      return b;
    });
    const custom = h('input', 'at-color');
    custom.type = 'color';
    custom.title = T('Свой цвет', 'Custom colour');
    custom.oninput = () => layer.setStyle({ color: custom.value });
    const width = h('select', 'at-width');
    width.title = T('Толщина линии (для подписи — размер текста)', 'Line width (text size for labels)');
    for (const w of WIDTHS) { const o = h('option', '', '● ' + w); o.value = w; width.appendChild(o); }
    width.onchange = () => layer.setStyle({ width: Number(width.value) });
    groupStyle.append(custom, width);

    const dash = h('button', 'at-btn', '╌');
    dash.title = T('Пунктир', 'Dashed line');
    dash.onclick = () => layer.setStyle({ dash: !baseStyle().dash });
    const fill = h('button', 'at-btn', '▨');
    fill.title = T('Заливка рамки и эллипса', 'Fill for frames and ellipses');
    fill.onclick = () => layer.setStyle({ fill: !baseStyle().fill });

    const groupActions = h('div', 'at-group');
    const act = (icon, title, fn) => { const b = h('button', 'at-btn', icon); b.title = title; b.onclick = fn; groupActions.appendChild(b); return b; };
    const lock = act('🔒', T('Заблокировать / разблокировать выбранное', 'Lock / unlock the selection'), () => layer.toggleLock());
    const dup = act('⧉', T('Дублировать (Ctrl+D)', 'Duplicate (Ctrl+D)'), () => layer.duplicateSelection());
    const front = act('⤒', T('На передний план', 'Bring to front'), () => layer.reorder(true));
    const back = act('⤓', T('На задний план', 'Send to back'), () => layer.reorder(false));
    const del = act('🗑', T('Удалить выбранное (Delete)', 'Delete the selection (Delete)'), () => layer.deleteSelection());
    const done = h('button', 'at-btn at-done', T('Готово', 'Done'));
    done.title = T('Выйти из режима рисования', 'Leave drawing mode');
    done.onclick = () => layer.setActive(false);
    const groupLine = h('div', 'at-group');
    groupLine.append(dash, fill);
    bar.append(groupTools, groupStyle, groupLine, groupActions, done);
    parent.appendChild(bar);

    function baseStyle() {
      const first = layer.selected()[0];
      return first ? { color: first.color, width: first.width, dash: first.dash, fill: !!first.fill } : layer.style;
    }

    function sync() {
      bar.classList.toggle('hidden', !layer.active);
      for (const [id, b] of toolBtns) b.classList.toggle('active', id === layer.tool);
      const s = baseStyle();
      swatches.forEach((b, i) => b.classList.toggle('active', COLORS[i].toLowerCase() === String(s.color).toLowerCase()));
      if (/^#[0-9a-f]{6}$/i.test(s.color)) custom.value = s.color;
      const first = layer.selected()[0];
      width.value = String(first && first.type === 'text' ? Math.max(2, Math.round((first.size - 14) / 2)) : s.width);
      if (![...width.options].some((o) => o.value === width.value)) width.value = String(WIDTHS[1]);
      dash.classList.toggle('active', !!s.dash);
      fill.classList.toggle('active', !!s.fill);
      const sel = layer.selected();
      lock.classList.toggle('active', sel.length > 0 && sel.every((x) => x.locked));
      for (const b of [lock, dup, front, back, del]) b.disabled = !sel.length;
    }

    // ---------- выбор картинки ----------
    let pop = null;
    function closePicker() { if (pop) { pop.remove(); pop = null; } }
    function pickItem(a) {
      const b = h('button', 'at-art');
      const img = h('img');
      img.src = a.dataUrl;
      img.alt = '';
      b.append(img, h('span', '', a.name));
      b.onclick = () => { closePicker(); layer.addImageArtifact(a.id, layer.imagePoint); };
      return b;
    }
    function openPicker() {
      closePicker();
      pop = h('div', 'annot-pop');
      const images = G.Artifacts ? G.Artifacts.list('image') : [];
      pop.appendChild(h('div', 'muted small', images.length ? T('Картинки проекта:', 'Project pictures:') : T('В проекте пока нет картинок.', 'The project has no pictures yet.')));
      const list = h('div', 'at-art-list');
      images.forEach((a) => list.appendChild(pickItem(a)));
      pop.appendChild(list);
      const file = h('input');
      file.type = 'file';
      file.accept = 'image/*';
      file.hidden = true;
      file.onchange = () => { const f = file.files && file.files[0]; closePicker(); if (f) layer.placeFile(f, layer.imagePoint || layer.view.viewCenter()); };
      const upload = h('button', 'btn small', T('Загрузить файл…', 'Upload a file…'));
      upload.onclick = () => file.click();
      pop.append(upload, file, h('div', 'muted small', T('Можно также перетащить картинку на доску или вставить её через Ctrl+V.', 'You can also drop a picture on the board or paste it with Ctrl+V.')));
      parent.appendChild(pop);
      setTimeout(() => document.addEventListener('pointerdown', (e) => { if (pop && !pop.contains(e.target)) closePicker(); }, { once: true }), 0);
    }

    layer.hooks.onState = sync;
    layer.hooks.onPickImage = () => openPicker();
    sync();
    return { sync, el: bar };
  }

  G.AnnotToolbar = { mount };
})(typeof self !== 'undefined' ? self : this);
