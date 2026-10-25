// Слой аннотаций доски: карандаш, стрелки, рамки, эллипсы, подписи и картинки поверх сетки, под нодами.
// Отделён от проводов данных: стрелка-аннотация — это заметка, она никогда не соединяет порты.
// Фигуры хранятся в мировых координатах (двигаются и масштабируются вместе с графом), входят в отмену/повтор и в файл проекта.
(function (G) {
  'use strict';
  const M = G.AnnotModel;
  const T = G.T;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const HIT_PX = 6;
  const HANDLE_PX = 9;
  const POINT_STEP_PX = 2;
  const NUDGE = 1;
  const NUDGE_BIG = 10;
  const COPY_OFFSET = 24;
  const IMAGE_MAX_W = 360;
  const UI_COLOR = '#5ee08c';
  const TOOL_KEYS = { v: 'select', h: 'hand', p: 'pen', a: 'arrow', r: 'rect', o: 'ellipse', t: 'text', i: 'image', e: 'eraser' };

  const svgEl = (tag, attrs) => {
    const el = document.createElementNS(SVGNS, tag);
    for (const k of Object.keys(attrs || {})) el.setAttribute(k, attrs[k]);
    return el;
  };
  const textSizeFor = (width) => 14 + width * 2;
  const isEditable = (el) => !!el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable);

  function strokeAttrs(s) {
    const a = { stroke: s.color, 'stroke-width': s.width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' };
    if (s.dash) a['stroke-dasharray'] = `${s.width * 2.5} ${s.width * 2}`;
    return a;
  }

  // ---------- элементы SVG для фигур ----------
  function buildText(s) {
    const el = svgEl('text', { fill: s.color, 'font-size': s.size, 'font-family': 'Segoe UI, system-ui, sans-serif' });
    el.style.whiteSpace = 'pre';
    s.text.split('\n').forEach((line, i) => {
      const ts = svgEl('tspan', { x: s.x, y: s.y + s.size * 0.95 + i * s.size * 1.25 });
      ts.textContent = line || ' ';
      el.appendChild(ts);
    });
    return el;
  }

  function buildImage(s) {
    const a = s.artifact && G.Artifacts ? G.Artifacts.get(s.artifact) : null;
    if (a && a.dataUrl) {
      const img = svgEl('image', { x: s.x, y: s.y, width: s.w, height: s.h, preserveAspectRatio: 'none' });
      img.setAttribute('href', a.dataUrl);
      return img;
    }
    const g = svgEl('g');
    g.append(svgEl('rect', { x: s.x, y: s.y, width: s.w, height: s.h, fill: 'rgba(255,255,255,0.05)', stroke: s.color, 'stroke-dasharray': '6 4' }));
    const label = svgEl('text', { x: s.x + 8, y: s.y + 22, fill: s.color, 'font-size': 14 });
    label.textContent = T('картинка не найдена', 'picture not found') + (s.name ? ': ' + s.name : '');
    g.appendChild(label);
    return g;
  }

  function buildShape(s) {
    let el;
    switch (s.type) {
      case 'pen': el = svgEl('path', { ...strokeAttrs(s), d: M.pathData(s.points) }); break;
      case 'arrow': {
        el = svgEl('g');
        el.append(svgEl('line', { ...strokeAttrs({ ...s, dash: s.dash }), x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 }),
          svgEl('polygon', { points: M.arrowHead(s).map((p) => p.join(',')).join(' '), fill: s.color, stroke: s.color, 'stroke-width': 1, 'stroke-linejoin': 'round' }));
        break;
      }
      case 'rect': el = svgEl('rect', { ...strokeAttrs(s), x: s.x, y: s.y, width: s.w, height: s.h, rx: 3 }); break;
      case 'ellipse': el = svgEl('ellipse', { ...strokeAttrs(s), cx: s.x + s.w / 2, cy: s.y + s.h / 2, rx: s.w / 2, ry: s.h / 2 }); break;
      case 'text': el = buildText(s); break;
      default: el = buildImage(s);
    }
    if ((s.type === 'rect' || s.type === 'ellipse') && s.fill) { el.setAttribute('fill', s.color); el.setAttribute('fill-opacity', '0.14'); }
    el.dataset.id = s.id;
    return el;
  }

  // ---------- слой ----------
  class AnnotationLayer {
    constructor(view, hooks) {
      this.view = view;
      this.hooks = hooks || {};
      this.shapes = [];
      this.selection = new Set();
      this.tool = 'select';
      this.active = false;
      this.style = { color: M.DEFAULT_COLOR, width: M.DEFAULT_WIDTH, dash: false, fill: false };
      this.cache = new Map();
      this.draft = null;
      this.marquee = null;
      this.editor = null;
      this.editingId = null;
      this.spaceDown = false;
      this.svg = svgEl('svg', { class: 'annot' });
      this.ui = svgEl('g', { class: 'annot-ui' });
      this.svg.appendChild(this.ui);
      view.world.insertBefore(this.svg, view.svg);
      view.annotations = this;
      this.bind();
    }

    // ---------- данные ----------
    load(list) {
      this.cancelEditor();
      this.shapes = M.normalizeList(list);
      this.selection = new Set();
      this.render();
    }

    toJSON() { return JSON.parse(JSON.stringify(this.shapes)); }
    bounds() { return M.unionBox(this.shapes); }
    selected() { return this.shapes.filter((s) => this.selection.has(s.id)); }

    // ---------- режим и инструмент ----------
    setActive(on) {
      this.active = !!on;
      if (!this.active) { this.commitEditor(); this.selection.clear(); }
      this.view.root.classList.toggle('draw-mode', this.active);
      this.setTool(this.tool);
    }

    setTool(tool) {
      this.commitEditor();
      this.tool = tool;
      const cls = this.view.root.classList;
      for (const c of [...cls]) if (c.startsWith('tool-')) cls.remove(c);
      if (this.active) cls.add('tool-' + tool);
      this.renderOverlay();
      this.notify();
    }

    setStyle(patch) {
      this.style = { ...this.style, ...patch };
      const sel = this.selected().filter((s) => !s.locked);
      if (sel.length) {
        const ids = new Set(sel.map((s) => s.id));
        const keys = Object.keys(patch);
        this.shapes = this.shapes.map((s) => (ids.has(s.id) ? this.restyle(s, patch, keys) : s));
        this.commit();
      }
      this.notify();
    }

    restyle(s, patch, keys) {
      const next = { ...s };
      for (const k of keys) {
        if (k === 'fill' && s.type !== 'rect' && s.type !== 'ellipse') continue;
        if (k === 'width' && s.type === 'text') next.size = textSizeFor(patch.width);
        else if (k === 'width' && s.type === 'image') continue;
        else next[k] = patch[k];
      }
      return M.normalize(next) || s;
    }

    notify() { if (this.hooks.onState) this.hooks.onState(this); }

    commit() {
      this.render();
      this.notify();
      this.view.changed();
    }

    // ---------- события ----------
    bind() {
      const root = this.view.root;
      root.addEventListener('pointerdown', (e) => this.onPointerDown(e), true);
      root.addEventListener('dblclick', (e) => this.onDblClick(e), true);
      root.addEventListener('drop', (e) => this.onDrop(e), true);
      document.addEventListener('keydown', (e) => { if (e.code === 'Space' && this.active && !isEditable(document.activeElement)) { this.spaceDown = true; e.preventDefault(); } });
      document.addEventListener('keyup', (e) => { if (e.code === 'Space') this.spaceDown = false; });
      if (G.Artifacts) G.Artifacts.onChange(() => this.render());
    }

    world(e) { return this.view.toWorld(e.clientX, e.clientY); }
    tol() { return HIT_PX / this.view.zoom; }

    onPointerDown(e) {
      if (!this.active || e.button === 2) return;
      if (e.target.closest('.annot-editor')) return;
      e.stopPropagation();
      e.preventDefault();
      this.commitEditor();
      if (e.button === 1 || this.spaceDown || this.tool === 'hand') { this.panDrag(e); return; }
      if (e.button !== 0) return;
      const p = this.world(e);
      const down = {
        select: this.downSelect, pen: this.downPen, arrow: this.downShape, rect: this.downShape, ellipse: this.downShape,
        text: this.downText, image: this.downImage, eraser: this.downEraser,
      }[this.tool];
      if (down) down.call(this, e, p);
    }

    onDblClick(e) {
      if (!this.active) return;
      e.stopPropagation();
      const p = this.world(e);
      const idx = M.hitTop(this.shapes, p.x, p.y, this.tol());
      if (idx >= 0 && this.shapes[idx].type === 'text' && !this.shapes[idx].locked) this.openEditor(this.shapes[idx], p);
    }

    onDrop(e) {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (!this.active || !files || !files.length) return;
      e.preventDefault();
      e.stopPropagation();
      const p = this.world(e);
      Array.from(files).forEach((f, i) => this.placeFile(f, { x: p.x + i * 24, y: p.y + i * 24 }));
    }

    panDrag(e) {
      const v = this.view;
      const start = { x: e.clientX, y: e.clientY, px: v.pan.x, py: v.pan.y };
      v.root.classList.add('panning');
      v.drag(e, (ev) => {
        v.pan.x = start.px + ev.clientX - start.x;
        v.pan.y = start.py + ev.clientY - start.y;
        v.applyTransform();
      }, () => v.root.classList.remove('panning'));
    }

    // ---------- выделение, перенос, масштаб ----------
    downSelect(e, p) {
      const handle = this.handleAt(p);
      if (handle) { this.beginResize(e, handle); return; }
      const idx = M.hitTop(this.shapes, p.x, p.y, this.tol());
      if (idx < 0) {
        if (!e.shiftKey) this.selection = new Set();
        this.notify();
        this.beginMarquee(e, p);
        return;
      }
      const id = this.shapes[idx].id;
      if (e.shiftKey) { if (this.selection.has(id)) this.selection.delete(id); else this.selection.add(id); }
      else if (!this.selection.has(id)) this.selection = new Set([id]);
      this.notify();
      this.renderOverlay();
      this.beginMove(e);
    }

    beginMove(e) {
      const originals = this.selected().filter((s) => !s.locked);
      if (!originals.length) return;
      const ids = new Map(originals.map((s) => [s.id, s]));
      const start = { x: e.clientX, y: e.clientY };
      let moved = false;
      this.view.drag(e, (ev) => {
        const dx = (ev.clientX - start.x) / this.view.zoom, dy = (ev.clientY - start.y) / this.view.zoom;
        if (!moved && Math.hypot(dx, dy) * this.view.zoom < 3) return;
        moved = true;
        this.shapes = this.shapes.map((s) => (ids.has(s.id) ? M.move(ids.get(s.id), dx, dy) : s));
        this.render();
      }, () => { if (moved) this.commit(); });
    }

    handleList() {
      if (!this.active || this.tool !== 'select') return [];
      const sel = this.selected().filter((s) => !s.locked);
      if (!sel.length) return [];
      if (sel.length === 1 && sel[0].type === 'arrow') {
        return [{ name: 'p1', x: sel[0].x1, y: sel[0].y1, round: true }, { name: 'p2', x: sel[0].x2, y: sel[0].y2, round: true }];
      }
      const pts = M.handlePoints(M.unionBox(sel));
      return M.HANDLE_NAMES.map((name) => ({ name, x: pts[name][0], y: pts[name][1] }));
    }

    handleAt(p) {
      const r = HANDLE_PX / this.view.zoom;
      const found = this.handleList().find((h) => Math.abs(h.x - p.x) <= r && Math.abs(h.y - p.y) <= r);
      return found ? found.name : null;
    }

    beginResize(e, handle) {
      const originals = this.selected().filter((s) => !s.locked);
      const box0 = M.unionBox(originals);
      const allImages = originals.every((s) => s.type === 'image');
      const start = { x: e.clientX, y: e.clientY };
      const ids = new Map(originals.map((s) => [s.id, s]));
      this.view.drag(e, (ev) => {
        const dx = (ev.clientX - start.x) / this.view.zoom, dy = (ev.clientY - start.y) / this.view.zoom;
        let next;
        if (handle === 'p1' || handle === 'p2') next = this.moveArrowEnd(originals[0], handle, dx, dy, ev.shiftKey);
        else next = this.scaleAll(originals, box0, M.applyHandle(box0, handle, dx, dy), handle, ev.shiftKey !== allImages);
        const map = new Map(next.map((s) => [s.id, s]));
        this.shapes = this.shapes.map((s) => (ids.has(s.id) ? map.get(s.id) : s));
        this.render();
      }, () => this.commit());
    }

    moveArrowEnd(arrow, handle, dx, dy, snap) {
      const base = handle === 'p1' ? [arrow.x1, arrow.y1] : [arrow.x2, arrow.y2];
      let nx = base[0] + dx, ny = base[1] + dy;
      if (snap) {
        const other = handle === 'p1' ? [arrow.x2, arrow.y2] : [arrow.x1, arrow.y1];
        [nx, ny] = M.snapAngle(other[0], other[1], nx, ny);
      }
      return [handle === 'p1' ? { ...arrow, x1: nx, y1: ny } : { ...arrow, x2: nx, y2: ny }];
    }

    scaleAll(originals, box0, target, handle, keepRatio) {
      let nb = target;
      if (keepRatio && box0.w > 0 && box0.h > 0) {
        const k = Math.max(nb.w / box0.w, nb.h / box0.h);
        nb = { x: handle.includes('w') ? box0.x + box0.w - box0.w * k : nb.x, y: handle.includes('n') ? box0.y + box0.h - box0.h * k : nb.y, w: box0.w * k, h: box0.h * k };
      }
      const sx = box0.w > 0 ? nb.w / box0.w : 1, sy = box0.h > 0 ? nb.h / box0.h : 1;
      return originals.map((s) => {
        const b = M.bbox(s);
        return M.fit(s, { x: nb.x + (b.x - box0.x) * sx, y: nb.y + (b.y - box0.y) * sy, w: b.w * sx, h: b.h * sy });
      });
    }

    beginMarquee(e, p0) {
      const additive = e.shiftKey;
      const base = new Set(this.selection);
      this.view.drag(e, (ev) => {
        const p = this.world(ev);
        this.marquee = { x: Math.min(p0.x, p.x), y: Math.min(p0.y, p.y), w: Math.abs(p.x - p0.x), h: Math.abs(p.y - p0.y) };
        const hit = this.shapes.filter((s) => M.touchesRect(s, this.marquee)).map((s) => s.id);
        this.selection = new Set(additive ? [...base, ...hit] : hit);
        this.renderOverlay();
      }, () => { this.marquee = null; this.renderOverlay(); this.notify(); });
    }

    // ---------- рисование ----------
    downPen(e, p) {
      const step = POINT_STEP_PX / this.view.zoom;
      this.draft = M.make('pen', { ...this.style, points: [[p.x, p.y]] });
      this.view.drag(e, (ev) => {
        const q = this.world(ev);
        const last = this.draft.points[this.draft.points.length - 1];
        if (Math.hypot(q.x - last[0], q.y - last[1]) < step) return;
        this.draft = { ...this.draft, points: [...this.draft.points, [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10]] };
        this.renderOverlay();
      }, () => this.finishDraft());
    }

    shapeFromDrag(type, a, b, shift) {
      if (type === 'arrow') {
        const [x2, y2] = shift ? M.snapAngle(a.x, a.y, b.x, b.y) : [b.x, b.y];
        return M.make('arrow', { ...this.style, x1: a.x, y1: a.y, x2, y2 });
      }
      let w = b.x - a.x, h = b.y - a.y;
      if (shift) { const side = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * side; h = Math.sign(h || 1) * side; }
      return M.make(type, { ...this.style, x: Math.min(a.x, a.x + w), y: Math.min(a.y, a.y + h), w: Math.abs(w), h: Math.abs(h) });
    }

    downShape(e, p) {
      const type = this.tool;
      this.view.drag(e, (ev) => {
        this.draft = this.shapeFromDrag(type, p, this.world(ev), ev.shiftKey);
        this.renderOverlay();
      }, () => {
        const b = this.draft && M.bbox(this.draft);
        const tiny = !b || Math.hypot(b.w, b.h) * this.view.zoom < 6;
        if (tiny) this.draft = null;
        this.finishDraft();
      });
    }

    finishDraft() {
      const shape = this.draft;
      this.draft = null;
      if (!shape) { this.render(); return; }
      this.shapes = [...this.shapes, shape];
      this.commit();
    }

    downEraser(e, p) {
      let erased = false;
      const erase = (q) => {
        const idx = M.hitTop(this.shapes.filter((s) => !s.locked), q.x, q.y, this.tol());
        if (idx < 0) return;
        const target = this.shapes.filter((s) => !s.locked)[idx];
        this.shapes = this.shapes.filter((s) => s.id !== target.id);
        this.selection.delete(target.id);
        erased = true;
        this.render();
      };
      erase(p);
      this.view.drag(e, (ev) => erase(this.world(ev)), () => { if (erased) this.commit(); });
    }

    // ---------- подписи ----------
    downText(e, p) {
      const idx = M.hitTop(this.shapes, p.x, p.y, this.tol());
      const hitShape = idx >= 0 && this.shapes[idx].type === 'text' && !this.shapes[idx].locked ? this.shapes[idx] : null;
      this.openEditor(hitShape, p);
    }

    openEditor(shape, p) {
      this.commitEditor();
      const v = this.view;
      const at = shape ? { x: shape.x, y: shape.y } : p;
      const size = shape ? shape.size : textSizeFor(this.style.width);
      const ta = document.createElement('textarea');
      ta.className = 'annot-editor';
      ta.value = shape ? shape.text : '';
      ta.spellcheck = false;
      ta.placeholder = T('Текст…', 'Text…');
      Object.assign(ta.style, { left: v.pan.x + at.x * v.zoom + 'px', top: v.pan.y + at.y * v.zoom + 'px', fontSize: size * v.zoom + 'px', color: shape ? shape.color : this.style.color });
      const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; ta.style.width = Math.max(120, ta.scrollWidth) + 'px'; };
      ta.addEventListener('input', fit);
      ta.addEventListener('blur', () => this.commitEditor());
      ta.addEventListener('keydown', (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Escape') { ev.preventDefault(); this.cancelEditor(); }
        if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); this.commitEditor(); }
      });
      v.root.appendChild(ta);
      this.editor = { ta, shape, at, size };
      this.editingId = shape ? shape.id : null;
      this.render();
      fit();
      ta.focus();
      ta.select();
    }

    cancelEditor() {
      if (!this.editor) return;
      const { ta } = this.editor;
      this.editor = null;
      this.editingId = null;
      ta.remove();
      this.render();
    }

    commitEditor() {
      if (!this.editor) return;
      const { ta, shape, at, size } = this.editor;
      const text = ta.value;
      this.editor = null;
      this.editingId = null;
      ta.remove();
      if (shape) {
        if (text === shape.text) { this.render(); return; }
        this.shapes = text.trim() ? this.shapes.map((s) => (s.id === shape.id ? { ...s, text } : s)) : this.shapes.filter((s) => s.id !== shape.id);
        this.commit();
      } else if (text.trim()) {
        const created = M.make('text', { ...this.style, x: at.x, y: at.y, text, size });
        this.shapes = [...this.shapes, created];
        this.commit();
      } else this.render();
    }

    // ---------- картинки ----------
    downImage(e, p) {
      this.imagePoint = p;
      if (this.hooks.onPickImage) this.hooks.onPickImage(e);
    }

    /** Кладёт картинку-артефакт на доску; at — мировая точка (по умолчанию центр вида). */
    async addImageArtifact(artifactId, at) {
      const a = G.Artifacts && G.Artifacts.get(artifactId);
      if (!a || a.kind !== 'image') { this.toast(T('Это не картинка', 'This is not an image')); return null; }
      const size = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth || 200, h: img.naturalHeight || 150 });
        img.onerror = () => resolve({ w: 200, h: 150 });
        img.src = a.dataUrl;
      });
      const k = Math.min(1, IMAGE_MAX_W / size.w);
      const point = at || this.imagePoint || this.view.viewCenter();
      const shape = M.make('image', { artifact: artifactId, name: a.name, x: point.x, y: point.y, w: size.w * k, h: size.h * k, color: this.style.color });
      this.shapes = [...this.shapes, shape];
      this.selection = new Set([shape.id]);
      this.imagePoint = null;
      this.commit();
      return shape;
    }

    /** Файл с компьютера или из буфера: картинка становится объектом доски, остальное — нодой-артефактом. */
    async placeFile(file, at) {
      try {
        if (/^image\//.test(file.type)) {
          const id = await G.Artifacts.addBlob(file, file.name || T('вставленная картинка', 'pasted picture'));
          await this.addImageArtifact(id, at);
        } else await this.view.addArtifactFile(file, at.x, at.y);
      } catch (err) {
        this.toast(T('Не удалось добавить файл: ', 'Could not add the file: ') + err.message);
      }
    }

    toast(text) { this.view.toast(text); }

    // ---------- действия над выделением ----------
    deleteSelection() {
      const del = this.selected().filter((s) => !s.locked);
      if (!del.length) {
        if (this.selection.size) this.toast(T('Заблокированные фигуры не удаляются: сними замок', 'Locked shapes are not deleted: unlock first'));
        return 0;
      }
      const ids = new Set(del.map((s) => s.id));
      this.shapes = this.shapes.filter((s) => !ids.has(s.id));
      this.selection = new Set([...this.selection].filter((id) => !ids.has(id)));
      this.commit();
      return del.length;
    }

    toggleLock() {
      const sel = this.selected();
      if (!sel.length) return;
      const lock = sel.some((s) => !s.locked);
      const ids = new Set(sel.map((s) => s.id));
      this.shapes = this.shapes.map((s) => (ids.has(s.id) ? { ...s, locked: lock } : s));
      this.commit();
    }

    duplicateSelection() {
      const copies = this.selected().map((s) => ({ ...M.move(s, COPY_OFFSET, COPY_OFFSET), id: M.newId(), locked: false }));
      if (!copies.length) return 0;
      this.shapes = [...this.shapes, ...copies];
      this.selection = new Set(copies.map((s) => s.id));
      this.commit();
      return copies.length;
    }

    reorder(front) {
      const ids = new Set(this.selection);
      if (!ids.size) return;
      const picked = this.shapes.filter((s) => ids.has(s.id)), rest = this.shapes.filter((s) => !ids.has(s.id));
      this.shapes = front ? [...rest, ...picked] : [...picked, ...rest];
      this.commit();
    }

    selectAll() {
      this.selection = new Set(this.shapes.map((s) => s.id));
      this.renderOverlay();
      this.notify();
    }

    nudge(dx, dy) {
      const ids = new Set(this.selected().filter((s) => !s.locked).map((s) => s.id));
      if (!ids.size) return;
      this.shapes = this.shapes.map((s) => (ids.has(s.id) ? M.move(s, dx, dy) : s));
      this.commit();
    }

    /** Клавиши режима рисования. Возвращает true, если нажатие обработано. */
    handleKey(e) {
      if (!this.active || isEditable(document.activeElement)) return false;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Delete' || e.key === 'Backspace') { this.deleteSelection(); return true; }
      if (e.key === 'Escape') {
        if (!this.selection.size && this.tool === 'select') return false;
        this.selection = new Set();
        this.setTool('select');
        return true;
      }
      if (mod) {
        if (e.code === 'KeyA') { this.selectAll(); return true; }
        if (e.code === 'KeyD') { this.duplicateSelection(); return true; }
        return false;
      }
      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (arrows && this.selection.size) { const k = e.shiftKey ? NUDGE_BIG : NUDGE; this.nudge(arrows[0] * k, arrows[1] * k); return true; }
      const tool = TOOL_KEYS[e.key.toLowerCase()];
      if (tool && !e.altKey && e.key.length === 1) { this.setTool(tool); return true; }
      return false;
    }

    onTransform() { if (this.active || this.selection.size) this.renderOverlay(); }

    // ---------- отрисовка ----------
    render() {
      const keep = new Set();
      const order = [];
      for (const s of this.shapes) {
        keep.add(s.id);
        const hasArt = s.type === 'image' ? !!(G.Artifacts && G.Artifacts.has(s.artifact)) : null;
        let entry = this.cache.get(s.id);
        if (!entry || entry.shape !== s || entry.hasArt !== hasArt) {
          if (entry) entry.el.remove();
          entry = { shape: s, el: buildShape(s), hasArt };
          this.cache.set(s.id, entry);
        }
        entry.el.style.opacity = s.id === this.editingId ? '0' : '';
        order.push(entry.el);
      }
      for (const [id, entry] of this.cache) if (!keep.has(id)) { entry.el.remove(); this.cache.delete(id); }
      order.forEach((el, i) => { if (this.svg.children[i] !== el) this.svg.insertBefore(el, this.svg.children[i] || this.ui); });
      this.renderOverlay();
    }

    renderOverlay() {
      const ui = this.ui;
      while (ui.firstChild) ui.removeChild(ui.firstChild);
      if (this.draft) ui.appendChild(buildShape(this.draft));
      if (!this.active) return;
      const z = this.view.zoom;
      const outline = (b, extra) => svgEl('rect', { x: b.x, y: b.y, width: b.w, height: b.h, fill: 'none', stroke: UI_COLOR, 'stroke-width': 1.4, 'vector-effect': 'non-scaling-stroke', ...(extra || {}) });
      if (this.tool === 'select') {
        for (const s of this.selected()) {
          const b = M.bbox(s);
          const pad = 3 / z;
          ui.appendChild(outline({ x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad }, { 'stroke-dasharray': '5 3', opacity: s.locked ? 0.45 : 1 }));
        }
        this.renderLockBadge(ui, z);
        this.renderHandles(ui, z);
      }
      if (this.marquee) ui.appendChild(outline(this.marquee, { fill: 'rgba(94,224,140,0.08)', 'stroke-dasharray': '4 3' }));
    }

    renderLockBadge(ui, z) {
      const locked = this.selected().filter((s) => s.locked);
      if (!locked.length) return;
      const b = M.unionBox(locked);
      const t = svgEl('text', { x: b.x - 4 / z, y: b.y - 6 / z, 'font-size': 14 / z, fill: UI_COLOR });
      t.textContent = '🔒';
      ui.appendChild(t);
    }

    renderHandles(ui, z) {
      const r = HANDLE_PX / z;
      for (const h of this.handleList()) {
        const attrs = { fill: '#0b0f0d', stroke: UI_COLOR, 'stroke-width': 1.6, 'vector-effect': 'non-scaling-stroke' };
        ui.appendChild(h.round ? svgEl('circle', { ...attrs, cx: h.x, cy: h.y, r: r * 0.6 }) : svgEl('rect', { ...attrs, x: h.x - r / 2, y: h.y - r / 2, width: r, height: r }));
      }
    }
  }

  G.AnnotationLayer = AnnotationLayer;
  G.AnnotationLayer.textSizeFor = textSizeFor;
})(typeof self !== 'undefined' ? self : this);
