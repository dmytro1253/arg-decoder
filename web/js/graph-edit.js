// Редактирование графа: выделение нескольких нод (Shift/Ctrl+клик, рамка с Shift),
// перенос группы, копирование и вставка, отмена/повтор, авто-раскладка.
(function (G) {
  'use strict';
  const P = G.GraphView.prototype;
  const HISTORY_LIMIT = 80;
  const HISTORY_DELAY = 450;
  const COL_GAP = 60;
  const ROW_GAP = 30;
  const basePan = P.startPan;
  const baseRenderAll = P.renderAll;
  const baseRemoveNode = P.removeNode;
  const baseChanged = P.changed;

  // ---------- выделение ----------
  P.selectionSet = function () {
    if (!this.selection) this.selection = new Set();
    return this.selection;
  };

  P.select = function (id, additive) {
    const sel = this.selectionSet();
    const mark = (nid, on) => { const el = this.nodeEls.get(nid); if (el) el.classList.toggle('selected', on); };
    if (!additive) { for (const s of sel) mark(s, false); sel.clear(); }
    if (id) {
      if (additive && sel.has(id)) { sel.delete(id); mark(id, false); } else { sel.add(id); mark(id, true); }
    }
    this.selected = id && sel.has(id) ? id : [...sel].pop() || null;
  };

  P.selectAll = function () {
    for (const id of this.graph.nodes.keys()) if (!this.selectionSet().has(id)) this.select(id, true);
  };

  P.startNodeDrag = function (e, el) {
    const id = el.dataset.id;
    if (e.shiftKey || e.ctrlKey || e.metaKey) { this.select(id, true); return; }
    if (!this.selectionSet().has(id)) this.select(id);
    else this.selected = id;
    const moving = [...this.selectionSet()].map((nid) => this.graph.nodes.get(nid)).filter(Boolean);
    const start = { x: e.clientX, y: e.clientY, pos: moving.map((n) => [n.x, n.y]) };
    this.drag(e, (ev) => {
      const dx = (ev.clientX - start.x) / this.zoom, dy = (ev.clientY - start.y) / this.zoom;
      moving.forEach((n, i) => {
        n.x = Math.round(start.pos[i][0] + dx);
        n.y = Math.round(start.pos[i][1] + dy);
        const nel = this.nodeEls.get(n.id);
        nel.style.left = n.x + 'px';
        nel.style.top = n.y + 'px';
      });
      this.drawWires();
    }, () => this.changed());
  };

  // Shift + перетаскивание по пустому месту — рамка выделения.
  P.startPan = function (e) {
    if (!e.shiftKey) { basePan.call(this, e); return; }
    const box = document.createElement('div');
    box.className = 'select-box';
    this.root.appendChild(box);
    const r = this.root.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const rect = (ev) => {
      const x = ev.clientX - r.left, y = ev.clientY - r.top;
      return { l: Math.min(sx, x), t: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) };
    };
    this.drag(e, (ev) => {
      const b = rect(ev);
      Object.assign(box.style, { left: b.l + 'px', top: b.t + 'px', width: b.w + 'px', height: b.h + 'px' });
    }, (ev) => {
      const b = rect(ev);
      box.remove();
      for (const [id, el] of this.nodeEls) {
        const nr = el.getBoundingClientRect();
        const nx = nr.left - r.left, ny = nr.top - r.top;
        if (nx < b.l + b.w && nx + nr.width > b.l && ny < b.t + b.h && ny + nr.height > b.t && !this.selectionSet().has(id)) this.select(id, true);
      }
    });
  };

  P.renderAll = function () {
    this.selectionSet().clear();
    baseRenderAll.call(this);
  };

  P.removeNode = function (id) {
    this.selectionSet().delete(id);
    baseRemoveNode.call(this, id);
  };

  P.deleteSelection = function () {
    const ids = [...this.selectionSet()];
    for (const id of ids) this.removeNode(id);
    return ids.length;
  };

  // ---------- копирование ----------
  P.copySelection = function () {
    const ids = new Set(this.selectionSet());
    if (!ids.size) return 0;
    const nodes = [...ids].map((id) => this.graph.nodes.get(id)).filter(Boolean).map((n) => ({ id: n.id, type: n.type, x: n.x, y: n.y, params: JSON.parse(JSON.stringify(n.params)) }));
    const links = this.graph.links.filter((l) => ids.has(l.from) && ids.has(l.to)).map((l) => ({ ...l }));
    this.clipboard = { nodes, links };
    try { localStorage.setItem('argdec.clipboard', JSON.stringify(this.clipboard)); } catch (e) { /* буфер останется в памяти */ }
    return nodes.length;
  };

  P.paste = function (offset) {
    let clip = this.clipboard;
    if (!clip) { try { clip = JSON.parse(localStorage.getItem('argdec.clipboard') || 'null'); } catch (e) { clip = null; } }
    if (!clip || !Array.isArray(clip.nodes) || !clip.nodes.length) return 0;
    const links = Array.isArray(clip.links) ? clip.links.filter((l) => l && l.from != null && l.to != null) : [];
    const shift = offset === undefined ? 40 : offset;
    const map = new Map();
    this.select(null);
    for (const n of clip.nodes) {
      if (!n || typeof n.type !== 'string' || !G.typeDef(n.type)) continue;
      const x = (Number(n.x) || 0) + shift, y = (Number(n.y) || 0) + shift;
      const params = n.params && typeof n.params === 'object' ? JSON.parse(JSON.stringify(n.params)) : {};
      const copy = this.graph.addNode(n.type, x, y, params);
      map.set(n.id, copy.id);
      this.renderNode(copy);
      this.select(copy.id, true);
    }
    for (const l of links) if (map.has(l.from) && map.has(l.to)) this.graph.connect(map.get(l.from), map.get(l.to), Number(l.port) || 0);
    this.clipboard = { nodes: clip.nodes.filter((n) => n && n.type).map((n) => ({ ...n, x: (Number(n.x) || 0) + shift, y: (Number(n.y) || 0) + shift })), links };
    this.requestEval();
    return map.size;
  };

  P.duplicateSelection = function () {
    return this.copySelection() ? this.paste() : 0;
  };

  // ---------- отмена и повтор ----------
  P.historyState = function () {
    if (!this.history) this.history = { stack: [], index: -1, timer: null };
    return this.history;
  };

  // Состояние доски для отмены: граф и (если есть) слой аннотаций.
  P.captureState = function () {
    const state = { graph: this.graph.toJSON() };
    if (this.annotations) state.annotations = this.annotations.toJSON();
    return state;
  };

  P.snapshotNow = function () {
    const h = this.historyState();
    clearTimeout(h.timer);
    h.timer = null;
    const snap = JSON.stringify(this.captureState());
    if (h.stack[h.index] === snap) return;
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push(snap);
    if (h.stack.length > HISTORY_LIMIT) h.stack.shift();
    h.index = h.stack.length - 1;
  };

  P.recordHistory = function () {
    const h = this.historyState();
    if (this.restoring) return;
    clearTimeout(h.timer);
    h.timer = setTimeout(() => this.snapshotNow(), HISTORY_DELAY);
  };

  P.changed = function () {
    this.recordHistory();
    baseChanged.call(this);
  };

  P.restoreHistory = function (step) {
    const h = this.historyState();
    // Правка, которую ещё не успели записать, тоже должна отменяться.
    if (h.timer) this.snapshotNow();
    clearTimeout(this.evalTimer);
    const target = h.index + step;
    if (target < 0 || target >= h.stack.length) return false;
    h.index = target;
    this.restoring = true;
    try {
      this.stopAll();
      const state = JSON.parse(h.stack[target]);
      // Старые снимки хранили только граф без обёртки.
      this.graph.load(state.graph || state);
      if (this.annotations) this.annotations.load(state.annotations || []);
      this.renderAll();
    } finally {
      this.restoring = false;
      clearTimeout(h.timer);
      h.timer = null;
    }
    return true;
  };

  P.undo = function () { return this.restoreHistory(-1); };
  P.redo = function () { return this.restoreHistory(1); };

  // Перекрываются ли ноды (после асинхронных результатов ноды вырастают: список архива, картинка, OCR).
  P.hasOverlap = function () {
    const boxes = [...this.graph.nodes.values()].map((n) => { const el = this.nodeEls.get(n.id); return el ? { x: n.x, y: n.y, w: el.offsetWidth, h: el.offsetHeight } : null; }).filter(Boolean);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.x < b.x + b.w - 4 && b.x < a.x + a.w - 4 && a.y < b.y + b.h - 4 && b.y < a.y + a.h - 4) return true;
      }
    }
    return false;
  };

  // ---------- авто-раскладка ----------
  // Столбцы по глубине (самый длинный путь от источника), внутри столбца — по порядку связей.
  P.autoLayout = function () {
    const nodes = [...this.graph.nodes.values()];
    if (!nodes.length) return;
    const depth = new Map();
    const visit = (id, seen) => {
      if (depth.has(id)) return depth.get(id);
      if (seen.has(id)) return 0;
      seen.add(id);
      const parents = this.graph.links.filter((l) => l.to === id).map((l) => l.from);
      const d = parents.length ? Math.max(...parents.map((p) => visit(p, seen) + 1)) : 0;
      depth.set(id, d);
      return d;
    };
    for (const n of nodes) visit(n.id, new Set());
    const columns = [];
    for (const n of nodes) (columns[depth.get(n.id)] = columns[depth.get(n.id)] || []).push(n);
    let x = 40;
    for (const col of columns) {
      if (!col) continue;
      col.sort((a, b) => a.y - b.y);
      let y = 40, width = 0;
      for (const n of col) {
        const el = this.nodeEls.get(n.id);
        n.x = x;
        n.y = y;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        y += el.offsetHeight + ROW_GAP;
        width = Math.max(width, el.offsetWidth);
      }
      x += width + COL_GAP;
    }
    this.drawWires();
    this.changed();
    this.fitAll();
  };
})(typeof self !== 'undefined' ? self : this);
