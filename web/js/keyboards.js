// Панель «Клавиатуры»: плавающая панель с вкладками (SGA, Брайль, Морзе, руны, греческий, пигпен, спецсимволы, двойники).
// Знак вставляется в позицию курсора последнего активного поля ввода (с событием input). Данные раскладок — в kb-core.js,
// sga-keyboard.js, kb-layouts.js и kb-special.js; здесь только интерфейс.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const Core = G.KbCore;
  const POS_KEY = 'argdec.kb.pos';
  const OLD_POS_KEY = 'argdec.sga.pos';
  const TAB_KEY = 'argdec.kb.tab';
  const CAPTIONS_KEY = 'argdec.sga.captions';
  const FONT = '"Segoe UI Symbol", "Segoe UI Historic", "Gadugi", "Noto Sans Symbols 2", "Noto Sans Runic", "Noto Sans Canadian Aboriginal", "Cambria Math", sans-serif';
  const PREVIEW_MAX = 300;

  const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const store = {
    get(k) { try { return G.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { G.localStorage.setItem(k, v); } catch (e) { /* настройки панели не критичны */ } },
  };
  const TEXT_TYPES = ['', 'text', 'search', 'url', 'email', 'tel'];
  const isTextField = (el) => !!el && ((el.tagName === 'TEXTAREA') || (el.tagName === 'INPUT' && TEXT_TYPES.includes(el.type))) && !el.readOnly && !el.disabled;

  const state = {
    panel: null, body: null, lastField: null, scratch: null, selections: new WeakMap(), opts: {}, targetLabel: null,
    tabId: null, alt: {}, lang: {}, buttons: new Map(), preview: null, tabs: new Map(), searchText: {},
  };

  const layout = () => Core.get(state.tabId) || Core.list()[0];
  const usesAlt = (lay) => !!(lay.alt && state.alt[lay.id]);
  const insOf = (key, lay) => (usesAlt(lay) && key.insAlt !== undefined ? key.insAlt : key.ins);

  // ---------- вставка в поле ----------
  function fieldName(el) {
    if (!el || el === state.scratch) return T('черновик панели', 'panel scratchpad');
    const label = el.closest('.field') && el.closest('.field').querySelector('.field-label');
    const node = el.closest('.node') && el.closest('.node').querySelector('.title');
    if (node) return T('нода «', 'node "') + node.textContent + (label && label.textContent ? ' · ' + label.textContent : '') + T('»', '"');
    return el.placeholder ? '«' + el.placeholder.slice(0, 28) + '»' : T('поле ввода', 'input field');
  }

  function remember(el) {
    try { state.selections.set(el, [el.selectionStart, el.selectionEnd]); } catch (e) { /* у некоторых типов input нет выделения */ }
  }

  function target() {
    const el = state.lastField;
    return el && el.isConnected ? el : state.scratch;
  }

  function selectionOf(el) {
    if (document.activeElement === el) return [el.selectionStart, el.selectionEnd];
    return state.selections.get(el) || [el.value.length, el.value.length];
  }

  function refreshTarget() {
    if (state.targetLabel) state.targetLabel.textContent = T('Вставка в: ', 'Insert into: ') + fieldName(target());
    updatePreview();
  }

  /** Вставляет строку в позицию курсора (заменяя выделение) и сообщает полю событием input. */
  function insertText(str, keepFocus) {
    const el = target();
    if (!el) return;
    const [start, end] = selectionOf(el);
    if (!keepFocus && document.activeElement !== el) { el.focus({ preventScroll: true }); el.setSelectionRange(start, end); }
    let done = false;
    if (document.activeElement === el) { try { done = document.execCommand('insertText', false, str); } catch (e) { done = false; } }
    if (!done) {
      el.setRangeText(str, start, end, 'end');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    remember(el);
    updatePreview();
  }

  function backspace(keepFocus) {
    const el = target();
    if (!el) return;
    const [start, end] = selectionOf(el);
    const res = Core.deleteBackward(el.value, start, end, (state.panel ? layout().tokens : null) || []);
    if (res.text === el.value) return;
    if (!keepFocus && document.activeElement !== el) el.focus({ preventScroll: true });
    el.value = res.text;
    el.setSelectionRange(res.caret, res.caret);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    remember(el);
    updatePreview();
  }

  // ---------- расшифровка поля ----------
  function updatePreview() {
    const box = state.preview;
    const lay = state.panel && layout();
    if (!box || !lay || !lay.decode) { if (box) box.hidden = true; return; }
    const el = target();
    box.hidden = false;
    let text;
    try { text = lay.decode(el ? el.value : '', state.lang[lay.id] || (lay.langs && lay.langs[0][0])); } catch (e) { text = '⚠ ' + (e.message || e); }
    text = String(text);
    box.querySelector('.kb-preview-text').textContent = text.length > PREVIEW_MAX ? text.slice(0, PREVIEW_MAX) + ' …' : (text || '—');
  }

  // ---------- сетка клавиш ----------
  function keyButton(key, lay) {
    const b = h('button', 'kb-key' + (key.mono ? ' mono' : ''));
    b.type = 'button';
    b.title = key.title || key.ins;
    if (key.swatch) { const sw = h('span', 'kb-sw'); sw.style.background = key.swatch; b.appendChild(sw); }
    b.append(h('span', 'kb-g', key.glyph), h('span', 'kb-c', key.cap || ''));
    b.onclick = () => insertText(insOf(key, lay));
    return b;
  }

  function buildSections(lay, showCaptions) {
    const wrap = h('div', 'kb-sections');
    state.buttons.clear();
    for (const sec of lay.sections) {
      const box = h('div', 'kb-section');
      if (sec.title) box.appendChild(h('div', 'kb-section-title', sec.title));
      const grid = h('div', 'kb-grid' + (showCaptions ? '' : ' no-captions'));
      grid.style.gridTemplateColumns = 'repeat(' + (lay.cols || 8) + ', 1fr)';
      for (const key of sec.keys) {
        const b = keyButton(key, lay);
        state.buttons.set(key, b);
        grid.appendChild(b);
      }
      box.appendChild(grid);
      wrap.appendChild(box);
    }
    return wrap;
  }

  function applySearch(lay, query) {
    const { hits, last } = Core.matchKeys(lay, query);
    const active = !!query.trim();
    for (const [key, b] of state.buttons) {
      b.classList.toggle('hit', hits.has(key));
      b.classList.toggle('hit-last', key === last);
      b.hidden = !!(lay.filter && active && !hits.has(key));
    }
    for (const box of state.body.querySelectorAll('.kb-section')) {
      box.hidden = !!(lay.filter && active && !box.querySelector('.kb-key:not([hidden])'));
    }
  }

  function buildSearch(lay) {
    const search = h('input', 'kb-search');
    search.setAttribute('data-sga-ignore', '1');
    search.placeholder = lay.search || '';
    search.spellcheck = false;
    search.value = state.searchText[lay.id] || '';
    search.oninput = () => { state.searchText[lay.id] = search.value; applySearch(lay, search.value); };
    search.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key !== 'Enter' || !search.value) return;
      e.preventDefault();
      const first = Core.matchKeys(lay, search.value).last;
      let out = '';
      try { out = lay.encode && !lay.filter ? lay.encode(search.value) : (first ? insOf(first, lay) : ''); } catch (err) { out = ''; if (state.opts.toast) state.opts.toast(err.message || String(err)); }
      if (out) insertText(out, true);
      search.value = '';
      search.oninput();
    };
    return search;
  }

  // ---------- конструктор ячейки Брайля ----------
  function buildBrailleBuilder() {
    const L = G.KbLayouts;
    const dots = new Set();
    const box = h('div', 'kb-builder');
    box.tabIndex = 0;
    box.setAttribute('aria-label', T('Конструктор ячейки Брайля: клавиши 1–6 переключают точки, Enter вставляет', 'Braille cell builder: keys 1–6 toggle dots, Enter inserts'));
    const pad = h('div', 'kb-dots');
    const out = h('div', 'kb-cell');
    const meaning = h('div', 'kb-cell-meaning');
    const buttons = new Map();
    const refresh = () => {
      const cell = L.cellFromDots(Array.from(dots));
      out.textContent = cell;
      const en = G.GlyphTables.braille.decode(cell, 'en');
      const ru = G.GlyphTables.braille.decode(cell, 'ru');
      meaning.textContent = (dots.size ? T('точки ', 'dots ') + Array.from(dots).sort().join('') : T('нет точек', 'no dots')) + (dots.size ? ' · EN: ' + en + ' · RU: ' + ru : '');
      for (const [d, b] of buttons) { b.classList.toggle('on', dots.has(d)); b.setAttribute('aria-pressed', dots.has(d) ? 'true' : 'false'); }
    };
    const toggle = (d) => { if (dots.has(d)) dots.delete(d); else dots.add(d); refresh(); };
    for (const d of [1, 4, 2, 5, 3, 6]) {
      const b = h('button', 'kb-dot', String(d));
      b.type = 'button';
      b.title = T('Точка ', 'Dot ') + d;
      b.onclick = () => toggle(d);
      buttons.set(d, b);
      pad.appendChild(b);
    }
    const commit = () => {
      if (!dots.size) return;
      insertText(L.cellFromDots(Array.from(dots)), true);
      dots.clear();
      refresh();
    };
    const insertBtn = h('button', 'btn small', T('Вставить ячейку', 'Insert cell'));
    insertBtn.type = 'button';
    insertBtn.onclick = commit;
    const clearBtn = h('button', 'btn small', T('Сбросить точки', 'Reset dots'));
    clearBtn.type = 'button';
    clearBtn.onclick = () => { dots.clear(); refresh(); };
    box.addEventListener('keydown', (e) => {
      if (/^[1-6]$/.test(e.key)) { e.preventDefault(); toggle(Number(e.key)); } else if (e.key === 'Enter') { e.preventDefault(); commit(); } else if (e.key === 'Backspace') { e.preventDefault(); backspace(true); } else if (e.key === 'Escape') { dots.clear(); refresh(); }
    });
    const side = h('div', 'kb-builder-side');
    side.append(out, meaning, insertBtn, clearBtn);
    box.append(pad, side);
    refresh();
    return box;
  }

  // ---------- управление раскладкой ----------
  function buildControls(lay) {
    const row = h('div', 'kb-controls');
    if (lay.alt) {
      const label = h('label', 'kb-opt');
      const cb = h('input');
      cb.type = 'checkbox';
      cb.checked = !!state.alt[lay.id];
      cb.onchange = () => { state.alt[lay.id] = cb.checked; store.set('argdec.kb.alt.' + lay.id, cb.checked ? '1' : '0'); };
      label.append(cb, h('span', '', lay.alt.label));
      row.appendChild(label);
    }
    if (lay.langs && lay.decode) {
      const label = h('label', 'kb-opt');
      const sel = h('select', 'kb-lang');
      for (const [v, name] of lay.langs) { const o = h('option', '', name); o.value = v; sel.appendChild(o); }
      sel.value = state.lang[lay.id] || lay.langs[0][0];
      sel.onchange = () => { state.lang[lay.id] = sel.value; updatePreview(); };
      label.append(h('span', '', T('Расшифровка: ', 'Decode as: ')), sel);
      row.appendChild(label);
    }
    return row;
  }

  function renderLayout() {
    const lay = layout();
    const capsOn = store.get(CAPTIONS_KEY) !== '0';
    state.body.innerHTML = '';
    if (!(lay.id in state.alt)) state.alt[lay.id] = store.get('argdec.kb.alt.' + lay.id) === '1';
    const search = buildSearch(lay);
    state.body.append(h('div', 'kb-note', lay.note || ''), search);
    const controls = buildControls(lay);
    if (controls.childNodes.length) state.body.appendChild(controls);
    if (lay.widget === 'braille' && G.KbLayouts) state.body.appendChild(buildBrailleBuilder());
    state.body.appendChild(buildSections(lay, capsOn));
    if (lay.decode) {
      state.preview = h('div', 'kb-preview');
      state.preview.append(h('span', 'kb-preview-label', T('Читается как: ', 'Reads as: ')), h('span', 'kb-preview-text'));
      state.body.appendChild(state.preview);
    } else { state.preview = null; }
    applySearch(lay, search.value);
    for (const [id, b] of state.tabs) { b.classList.toggle('active', id === lay.id); b.setAttribute('aria-selected', id === lay.id ? 'true' : 'false'); }
    state.panel.setAttribute('aria-label', lay.name);
    updatePreview();
  }

  function selectTab(id) {
    if (!Core.get(id)) return;
    state.tabId = id;
    store.set(TAB_KEY, id);
    if (state.panel) renderLayout();
  }

  function enableDrag(panel, handle) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, label, input')) return;
      e.preventDefault();
      const r = panel.getBoundingClientRect();
      const off = { x: e.clientX - r.left, y: e.clientY - r.top };
      const move = (ev) => {
        const x = Math.max(0, Math.min(window.innerWidth - 80, ev.clientX - off.x));
        const y = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - off.y));
        Object.assign(panel.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        store.set(POS_KEY, JSON.stringify({ left: panel.style.left, top: panel.style.top }));
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }

  function buildActions(scratch, opts) {
    const row = h('div', 'kb-row');
    const btn = (text, title, fn) => { const b = h('button', 'btn small', text); b.type = 'button'; b.title = title; b.onclick = fn; row.appendChild(b); return b; };
    btn(T('Пробел', 'Space'), T('Вставить пробел', 'Insert a space'), () => insertText(' '));
    btn('⌫', T('Стереть знак целиком (даже если он из нескольких символов)', 'Delete a whole glyph (even a multi-character one)'), () => backspace());
    btn(T('Копировать', 'Copy'), T('Копировать черновик', 'Copy the scratchpad'), () => {
      navigator.clipboard.writeText(scratch.value).then(() => opts.toast && opts.toast(T('Скопировано', 'Copied')), () => opts.toast && opts.toast(T('Не удалось скопировать', 'Could not copy')));
    });
    btn(T('В ноду «Ввод»', 'To an Input node'), T('Создать ноду «Ввод» с текстом черновика', 'Create an Input node with the scratchpad text'), () => {
      if (scratch.value && opts.createInput) opts.createInput(scratch.value);
    });
    btn(T('Очистить', 'Clear'), T('Очистить черновик', 'Clear the scratchpad'), () => { scratch.value = ''; scratch.dispatchEvent(new Event('input', { bubbles: true })); });
    return row;
  }

  function buildHead() {
    const head = h('div', 'kb-head');
    const capsLabel = h('label', 'kb-caps');
    const caps = h('input');
    caps.type = 'checkbox';
    caps.checked = store.get(CAPTIONS_KEY) !== '0';
    caps.onchange = () => { store.set(CAPTIONS_KEY, caps.checked ? '1' : '0'); renderLayout(); };
    capsLabel.append(caps, h('span', '', T('подписи', 'captions')));
    capsLabel.title = T('Показывать подпись под знаком', 'Show a caption under each key');
    const close = h('button', 'icon', '×');
    close.title = T('Закрыть', 'Close');
    close.onclick = () => toggle(false);
    head.append(h('b', '', T('⌨ Клавиатуры', '⌨ Keyboards')), capsLabel, close);
    return head;
  }

  function buildTabs() {
    const tabs = h('div', 'kb-tabs');
    tabs.setAttribute('role', 'tablist');
    state.tabs.clear();
    for (const lay of Core.list()) {
      const b = h('button', 'kb-tab', lay.tab);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.title = lay.name;
      b.onclick = () => selectTab(lay.id);
      state.tabs.set(lay.id, b);
      tabs.appendChild(b);
    }
    return tabs;
  }

  function buildPanel(opts) {
    const panel = h('div', 'kb-panel');
    panel.setAttribute('role', 'dialog');
    // Подписи и кнопки — шрифтом интерфейса (у Cambria Math кириллица с засечками), знаки — набором символьных шрифтов.
    panel.style.setProperty('--kb-font', FONT);
    const head = buildHead();
    state.targetLabel = h('div', 'kb-target');
    const scratch = h('textarea', 'kb-scratch');
    scratch.rows = 2;
    scratch.spellcheck = false;
    scratch.placeholder = T('Черновик: набирай знаки здесь, затем копируй', 'Scratchpad: compose glyphs here, then copy');
    state.scratch = scratch;
    if (!state.lastField) state.lastField = scratch;
    state.body = h('div', 'kb-body');
    state.panel = panel;
    const saved = store.get(TAB_KEY);
    state.tabId = state.tabId || (Core.get(saved) ? saved : Core.list()[0].id);
    panel.append(head, buildTabs(), state.targetLabel, scratch, state.body, buildActions(scratch, opts));
    panel.addEventListener('mousedown', (e) => { if (!e.target.closest('textarea, input, select, .kb-builder')) e.preventDefault(); });
    enableDrag(panel, head);
    const pos = store.get(POS_KEY) || store.get(OLD_POS_KEY);
    if (pos) { try { const p = JSON.parse(pos); if (p && p.left) Object.assign(panel.style, { left: p.left, top: p.top, right: 'auto', bottom: 'auto' }); } catch (e) { /* позиция по умолчанию */ } }
    renderLayout();
    return panel;
  }

  function bindFocusTracking() {
    document.addEventListener('focusin', (e) => {
      const el = e.target;
      if (!isTextField(el) || el.hasAttribute('data-sga-ignore')) return;
      if (state.panel && state.panel.contains(el) && el !== state.scratch) return;
      state.lastField = el;
      refreshTarget();
    });
    document.addEventListener('focusout', (e) => { if (e.target === state.lastField) remember(e.target); });
    for (const ev of ['keyup', 'mouseup', 'select']) document.addEventListener(ev, (e) => { if (e.target === state.lastField) remember(e.target); });
    document.addEventListener('input', (e) => { if (state.panel && e.target === state.lastField) updatePreview(); });
  }

  let bound = false;
  function mount(opts) {
    state.opts = opts || {};
    if (!bound) { bindFocusTracking(); bound = true; }
    return G.Keyboards;
  }

  /** Открывает или закрывает панель; tabId (необязательно) выбирает вкладку при открытии. */
  function toggle(force, tabId) {
    const open = force === undefined ? !(state.panel && state.panel.isConnected) : !!force;
    if (open && !(state.panel && state.panel.isConnected)) {
      if (tabId && Core.get(tabId)) state.tabId = tabId;
      state.panel = buildPanel(state.opts);
      document.body.appendChild(state.panel);
      refreshTarget();
    } else if (open && tabId) { selectTab(tabId); } else if (!open && state.panel) { state.panel.remove(); state.panel = null; }
    if (state.opts.onToggle) state.opts.onToggle(open);
    return open;
  }

  G.Keyboards = { mount, toggle, insertText, selectTab, layouts: () => Core.list() };
})(typeof self !== 'undefined' ? self : this);
