// Нода «Просмотр лога»: большой текст с номерами строк, поиском и подсветкой hex/base64/URL/координат/§-кодов.
// Выделенный фрагмент можно отправить в новую ноду «Ввод» (NS.ui.sendToInput; подключает лид).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = G.ArgFiles;
  const U = NS.ui;
  const LV = NS.LogView;
  const NT = G.NodeTypes || (G.NodeTypes = {});

  const PAGE_LINES = 200;
  const MAX_SHOWN_CHARS = 1500;
  const TYPE_LABEL = { hex: 'HEX', b64: 'Base64', url: 'URL', coord: T('координаты', 'coords'), mc: '§', uuid: 'UUID' };

  function textOf(v) {
    return NS.isHandle(v) ? NS.decodeUtf8(NS.artifactBytes(v)) : String(v);
  }

  const EXTRACT_OPTIONS = [['all', T('Все типы', 'All types')], ['hex', 'HEX'], ['b64', 'Base64'], ['url', 'URL'], ['coord', T('Координаты', 'Coordinates')], ['uuid', 'UUID']];

  function compute([v], p, node) {
    const text = textOf(v);
    node.state.text = text;
    if (p.output === 'filter') {
      if (!String(p.search).trim()) return text;
      return LV.filterText(text, p.search, { regex: p.regex, ignoreCase: p.ignoreCase, context: Math.max(0, Math.floor(Number(p.context)) || 0), invert: p.invert });
    }
    if (p.output === 'extract') {
      const found = LV.extractCandidates(text, p.types === 'all' ? null : [p.types]);
      return found.map((f) => (p.withInfo ? f.type + '\t' + f.line + '\t' : '') + f.text).join('\n');
    }
    return text;
  }

  // ---------- вёрстка строки с подсветкой ----------
  function lineNode(line, no, isHit) {
    const row = U.h('div', 'fx-line' + (isHit ? ' fx-hit' : ''));
    row.dataset.line = String(no);
    row.appendChild(U.h('span', 'fx-ln', String(no)));
    const tx = U.h('span', 'fx-tx');
    const shown = line.length > MAX_SHOWN_CHARS ? line.slice(0, MAX_SHOWN_CHARS) : line;
    let pos = 0;
    for (const s of LV.highlightLine(shown)) {
      if (s.start > pos) tx.appendChild(document.createTextNode(shown.slice(pos, s.start)));
      const span = U.h('span', 'fx-' + s.type, shown.slice(s.start, s.end));
      span.dataset.type = s.type;
      tx.appendChild(span);
      pos = s.end;
    }
    tx.appendChild(document.createTextNode(shown.slice(pos) + (line.length > shown.length ? '… (+' + (line.length - shown.length) + ')' : '')));
    row.appendChild(tx);
    return row;
  }

  function viewer(node, ui) {
    const st = node.state.view || (node.state.view = { page: 0, q: '', regex: false, hitIdx: -1 });
    const lines = node.state.text.split(/\r?\n/);
    const pages = Math.max(1, Math.ceil(lines.length / PAGE_LINES));
    const wrap = U.h('div', 'fx-log');
    const q = U.input('text', st.q, T('поиск', 'search'));
    const info = U.h('span', 'muted small');
    const view = U.h('div', 'fx-lines');
    const bar = U.h('div', 'fx-selbar');
    bar.hidden = true;
    let hits = [];

    const draw = () => {
      st.page = Math.min(Math.max(0, st.page), pages - 1);
      const hitSet = new Set(hits);
      view.innerHTML = '';
      const from = st.page * PAGE_LINES;
      for (let i = from; i < Math.min(lines.length, from + PAGE_LINES); i++) view.appendChild(lineNode(lines[i], i + 1, hitSet.has(i)));
      pageLabel.textContent = (st.page + 1) + ' / ' + pages + ' · ' + lines.length + T(' строк', ' lines');
    };
    const goLine = (i) => { st.page = Math.floor(i / PAGE_LINES); draw(); const el = view.querySelector('[data-line="' + (i + 1) + '"]'); if (el) el.scrollIntoView({ block: 'center' }); };
    const search = (step) => {
      try {
        st.q = q.value;
        if (!step) { hits = LV.searchLines(lines, q.value, { regex: st.regex, ignoreCase: true }); st.hitIdx = -1; }
        if (!hits.length) { info.textContent = q.value ? T('Не найдено', 'Not found') : ''; draw(); return; }
        st.hitIdx = (st.hitIdx + (step || 1) + hits.length) % hits.length;
        info.textContent = (st.hitIdx + 1) + '/' + hits.length;
        goLine(hits[st.hitIdx]);
      } catch (e) { info.textContent = e.message; }
    };

    const regexBox = U.h('input'); regexBox.type = 'checkbox'; regexBox.checked = st.regex;
    regexBox.onchange = () => { st.regex = regexBox.checked; search(0); };
    const pageLabel = U.h('span', 'muted small');
    q.onkeydown = (ev) => { if (ev.key === 'Enter') search(ev.shiftKey ? -1 : (hits.length && st.q === q.value ? 1 : 0)); };
    const lineJump = U.input('number', '', T('строка', 'line'));
    lineJump.onchange = () => { const n = parseInt(lineJump.value, 10); if (n >= 1 && n <= lines.length) goLine(n - 1); };

    const nav = U.h('div', 'fx-row');
    nav.append(U.button('◀', () => { st.page--; draw(); }, 'tiny'), pageLabel, U.button('▶', () => { st.page++; draw(); }, 'tiny'), lineJump);
    const find = U.h('div', 'fx-row');
    const rx = U.h('label', 'muted small'); rx.append(regexBox, document.createTextNode(' regex'));
    find.append(q, U.button('▲', () => search(-1), 'tiny'), U.button('▼', () => search(1), 'tiny'), rx, info);

    // Выделение: сам диапазон или клик по подсвеченному фрагменту целиком.
    const showSel = () => {
      const text = String(window.getSelection ? window.getSelection() : '').trim();
      bar.hidden = !text || !view.contains(window.getSelection().anchorNode);
      bar.dataset.text = text;
      bar.firstChild.textContent = text.length > 40 ? text.slice(0, 37) + '…' : text;
    };
    view.addEventListener('click', (ev) => {
      const t = ev.target;
      if (t && t.dataset && t.dataset.type) {
        const r = document.createRange();
        r.selectNodeContents(t);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      }
      showSel();
    });
    view.addEventListener('mouseup', showSel);
    bar.append(U.h('span', 'fx-seltext'),
      U.button(T('→ новый Ввод', '→ new Input'), () => { U.sendToInput(bar.dataset.text, ui); bar.hidden = true; }, 'accent tiny'),
      U.button(T('копировать', 'copy'), () => U.copy(bar.dataset.text, ui), 'tiny'));

    wrap.append(find, nav, bar, view);
    draw();
    if (st.q) search(0);
    return wrap;
  }

  function legend() {
    const row = U.h('div', 'fx-row fx-legend');
    Object.keys(TYPE_LABEL).forEach((k) => row.appendChild(U.h('span', 'fx-' + k, TYPE_LABEL[k])));
    return row;
  }

  NT.log_view = {
    name: T('Просмотр лога', 'Log viewer'), cat: 'Файлы', wide: true,
    inputs: [T('текст/лог', 'text/log')],
    desc: T('Большой текст или лог-артефакт: номера строк, поиск, подсветка hex/Base64/URL/координат/§-кодов. Выделенное можно отправить в новый «Ввод». Выход: весь текст, строки с совпадениями (с контекстом) или список найденных кандидатов.',
      'A large text or log artifact: line numbers, search, highlighting of hex/Base64/URLs/coordinates/§ codes. A selection can be sent to a new Input. Output: the whole text, matching lines (with context) or a list of detected candidates.'),
    params: [
      { key: 'output', label: T('Выход', 'Output'), type: 'select', default: 'text', options: [['text', T('Весь текст', 'Whole text')], ['filter', T('Строки с совпадением', 'Matching lines')], ['extract', T('Найденные кандидаты', 'Detected candidates')]] },
      { key: 'search', label: T('Фильтр строк', 'Line filter'), type: 'text', default: '' },
      { key: 'regex', label: T('Фильтр — регулярное выражение', 'Filter is a regular expression'), type: 'bool', default: false },
      { key: 'ignoreCase', label: T('Без учёта регистра', 'Ignore case'), type: 'bool', default: true },
      { key: 'invert', label: T('Инвертировать', 'Invert'), type: 'bool', default: false },
      { key: 'context', label: T('Строк контекста', 'Context lines'), type: 'number', default: 0 },
      { key: 'types', label: T('Что извлекать', 'What to extract'), type: 'select', options: EXTRACT_OPTIONS, default: 'all' },
      { key: 'withInfo', label: T('С типом и номером строки', 'With type and line number'), type: 'bool', default: false },
    ],
    compute,
    update(node, res, body, ui) {
      const box = body.querySelector('.special') || body.appendChild(U.h('div', 'special'));
      const text = node.state.text;
      if (text === undefined) { box.innerHTML = ''; delete box.dataset.len; node.state.shown = null; return; }
      if (node.state.shown === text) return; // тот же лог — не перерисовываем и не теряем позицию
      node.state.shown = text;
      box.innerHTML = '';
      box.append(legend(), viewer(node, ui));
    },
  };
})(typeof self !== 'undefined' ? self : this);
