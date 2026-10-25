// Отрисовка графа: ноды, провода, перетаскивание, масштаб, вывод значений.
(function (G) {
  'use strict';
  const C = G.Codec;
  const T = G.T;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const MAX_PREVIEW = 4000;
  const CAT_CLASS = {
    'Кодировки': 'c-enc', 'Сдвиги': 'c-shift', 'Шифры с ключом': 'c-key', 'Перестановки': 'c-perm', 'Текст': 'c-text',
    'Объединение': 'c-join', 'Ввод и вывод': 'c-io', 'Проверка': 'c-check', 'Авто': 'c-auto',
    'ARG и Minecraft': 'c-arg', 'Скрытое': 'c-hidden',
    'Изображения': 'c-img', 'Звук и видео': 'c-av', 'Файлы': 'c-file', 'Хеши': 'c-hash',
  };
  const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  class GraphView {
    constructor(root, graph, hooks) {
      this.root = root;
      this.graph = graph;
      this.hooks = hooks || {};
      this.pan = { x: 40, y: 40 };
      this.zoom = 1;
      this.nodeEls = new Map();
      this.selected = null;
      this.evalTimer = null;
      this.world = h('div', 'world');
      this.svg = document.createElementNS(SVGNS, 'svg');
      this.svg.classList.add('wires');
      this.tempPath = document.createElementNS(SVGNS, 'path');
      this.tempPath.classList.add('wire', 'temp');
      this.svg.appendChild(this.tempPath);
      this.world.appendChild(this.svg);
      root.appendChild(this.world);
      this.bindCanvas();
      this.applyTransform();
    }

    // ---------- координаты ----------
    applyTransform() {
      this.world.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
      this.root.style.backgroundPosition = `${this.pan.x}px ${this.pan.y}px`;
      this.root.style.backgroundSize = `${24 * this.zoom}px ${24 * this.zoom}px`;
      if (this.annotations) this.annotations.onTransform();
      if (this.hooks.onCamera) this.hooks.onCamera();
    }

    toWorld(clientX, clientY) {
      const r = this.root.getBoundingClientRect();
      return { x: (clientX - r.left - this.pan.x) / this.zoom, y: (clientY - r.top - this.pan.y) / this.zoom };
    }

    viewCenter() {
      const r = this.root.getBoundingClientRect();
      return this.toWorld(r.left + r.width * 0.4, r.top + r.height * 0.35);
    }

    portCenter(el) {
      const r = el.getBoundingClientRect();
      return this.toWorld(r.left + r.width / 2, r.top + r.height / 2);
    }

    // ---------- события холста ----------
    bindCanvas() {
      const root = this.root;
      root.addEventListener('pointerdown', (e) => {
        if (e.button === 2) return;
        const port = e.target.closest('.port');
        if (port && e.button !== 0) return;
        if (port) { this.startWire(e, port); return; }
        const head = e.target.closest('.node-head');
        if (head && !e.target.closest('button') && e.button === 0) { this.startNodeDrag(e, head.parentElement); return; }
        const nodeEl = e.target.closest('.node');
        if (nodeEl) { if (!(this.selection && this.selection.has(nodeEl.dataset.id))) this.select(nodeEl.dataset.id); return; }
        if (e.button === 0 || e.button === 1) this.startPan(e);
      });
      root.addEventListener('wheel', (e) => {
        if (e.target.closest('.node-out pre, textarea, .auto-list, .hits, select')) return;
        e.preventDefault();
        const before = this.toWorld(e.clientX, e.clientY);
        this.zoom = Math.min(1.6, Math.max(0.3, this.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
        const r = root.getBoundingClientRect();
        this.pan.x = e.clientX - r.left - before.x * this.zoom;
        this.pan.y = e.clientY - r.top - before.y * this.zoom;
        this.applyTransform();
      }, { passive: false });
      root.addEventListener('dblclick', (e) => {
        if (e.target.closest('.node')) return;
        if (this.hooks.onBackgroundDblClick) this.hooks.onBackgroundDblClick(this.toWorld(e.clientX, e.clientY), e);
      });
      root.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/node-type') || e.dataTransfer.types.includes('Files')) e.preventDefault(); });
      root.addEventListener('drop', (e) => {
        const p = this.toWorld(e.clientX, e.clientY);
        // Файлы с компьютера становятся нодами-артефактами.
        if (e.dataTransfer.files && e.dataTransfer.files.length && G.Artifacts) {
          e.preventDefault();
          Array.from(e.dataTransfer.files).forEach((file, i) => this.addArtifactFile(file, p.x - 20 + i * 30, p.y - 15 + i * 30));
          return;
        }
        const type = e.dataTransfer.getData('text/node-type');
        if (!type) return;
        e.preventDefault();
        this.addNode(type, p.x - 20, p.y - 15);
      });
    }

    drag(e, onMove, onUp) {
      const move = (ev) => onMove(ev);
      const up = (ev) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        window.removeEventListener('blur', up);
        if (onUp) onUp(ev);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      window.addEventListener('blur', up);
    }

    startPan(e) {
      const start = { x: e.clientX, y: e.clientY, px: this.pan.x, py: this.pan.y };
      this.select(null);
      this.root.classList.add('panning');
      this.drag(e, (ev) => {
        this.pan.x = start.px + ev.clientX - start.x;
        this.pan.y = start.py + ev.clientY - start.y;
        this.applyTransform();
      }, () => this.root.classList.remove('panning'));
    }

    startNodeDrag(e, el) {
      const node = this.graph.nodes.get(el.dataset.id);
      this.select(node.id);
      const start = { x: e.clientX, y: e.clientY, nx: node.x, ny: node.y };
      this.drag(e, (ev) => {
        node.x = Math.round(start.nx + (ev.clientX - start.x) / this.zoom);
        node.y = Math.round(start.ny + (ev.clientY - start.y) / this.zoom);
        el.style.left = node.x + 'px';
        el.style.top = node.y + 'px';
        this.drawWires();
      }, () => this.changed());
    }

    startWire(e, port) {
      e.preventDefault();
      const nodeId = port.closest('.node').dataset.id;
      let fromId = nodeId;
      if (port.classList.contains('port-in')) {
        // Тянем за занятый вход — отсоединяем провод и ведём его от источника.
        const link = this.graph.disconnect(nodeId, Number(port.dataset.port));
        if (!link) return;
        fromId = link.from;
        this.drawWires();
        this.requestEval();
      }
      const fromEl = this.nodeEls.get(fromId).querySelector('.port-out');
      const a = this.portCenter(fromEl);
      this.drag(e, (ev) => {
        const b = this.toWorld(ev.clientX, ev.clientY);
        this.tempPath.setAttribute('d', this.curve(a, b));
      }, (ev) => {
        this.tempPath.setAttribute('d', '');
        if (ev.type !== 'pointerup') return;
        const target = document.elementFromPoint(ev.clientX, ev.clientY);
        const inPort = target && target.closest('.port-in');
        if (!inPort) return;
        const toId = inPort.closest('.node').dataset.id;
        if (!this.graph.connect(fromId, toId, Number(inPort.dataset.port))) { this.toast(T('Так соединить нельзя (получится цикл)', 'Cannot connect these (it would make a cycle)')); return; }
        this.drawWires();
        this.requestEval();
      });
    }

    select(id) {
      if (this.selected && this.nodeEls.has(this.selected)) this.nodeEls.get(this.selected).classList.remove('selected');
      this.selected = id;
      if (id && this.nodeEls.has(id)) this.nodeEls.get(id).classList.add('selected');
    }

    // ---------- ноды ----------
    async addArtifactFile(file, x, y) {
      const id = await G.Artifacts.addBlob(file, file.name);
      return this.addNode('artifact', x, y, { artifact: id });
    }

    addNode(type, x, y, params) {
      const node = this.graph.addNode(type, x, y, params);
      this.renderNode(node);
      this.select(node.id);
      this.requestEval();
      return node;
    }

    // Останавливает фоновые задачи ноды (перебор маски, авто-расшифровку).
    stopNode(node) {
      if (!node || !node.state) return;
      if (node.state.cancel && typeof node.state.cancel === 'object') node.state.cancel.stop = true;
      else if (node.state.running) node.state.cancel = true;
    }

    stopAll() { for (const node of this.graph.nodes.values()) this.stopNode(node); }

    removeNode(id) {
      this.stopNode(this.graph.nodes.get(id));
      this.graph.removeNode(id);
      const el = this.nodeEls.get(id);
      if (el) el.remove();
      this.nodeEls.delete(id);
      if (this.selected === id) this.selected = null;
      this.drawWires();
      this.requestEval();
    }

    renderAll() {
      for (const el of this.nodeEls.values()) el.remove();
      this.nodeEls.clear();
      this.selected = null;
      for (const node of this.graph.nodes.values()) this.renderNode(node);
      this.evaluate();
    }

    renderNode(node) {
      const def = G.typeDef(node.type);
      const el = h('div', 'node ' + (CAT_CLASS[def.cat] || '') + (def.wide ? ' wide' : '') + (def.big ? ' big' : ''));
      el.dataset.id = node.id;
      el.style.left = node.x + 'px';
      el.style.top = node.y + 'px';

      const head = h('div', 'node-head');
      head.append(h('span', 'dot'), h('span', 'title', def.name));
      const info = h('button', 'icon', '?');
      info.title = (G.Help && G.Help.short(node.type)) || def.desc || def.name;
      info.dataset.helpFor = node.id;
      info.onclick = (e) => {
        e.stopPropagation();
        if (G.Help) G.Help.toggle(node.type, info, (text) => this.toast(text, 6000));
        else this.toast(def.desc || def.name, 6000);
      };
      const del = h('button', 'icon', '×');
      del.title = T('Удалить ноду (Delete)', 'Delete the node (Delete)');
      del.onclick = () => this.removeNode(node.id);
      head.append(info, del);
      if (!def.noOutput) {
        const out = h('span', 'port port-out');
        out.title = T('Выход: протяни к входу другой ноды', 'Output: drag to the input of another node');
        head.appendChild(out);
      }
      el.appendChild(head);

      const inputs = def.inputs || [];
      if (inputs.length) {
        const ins = h('div', 'node-ins');
        inputs.forEach((label, i) => {
          const row = h('div', 'in-row');
          const port = h('span', 'port port-in');
          port.dataset.port = i;
          port.title = i === 0 ? T('Вход', 'Input') : T('Необязательный вход «' + label + '» — заменяет параметр', 'Optional input "' + label + '" replaces the parameter');
          row.append(port, h('span', 'in-label', label + (i > 0 && def.optionalFrom !== undefined ? T(' (необяз.)', ' (optional)') : '')));
          ins.appendChild(row);
        });
        el.appendChild(ins);
      }

      const body = h('div', 'node-body');
      for (const p of def.params || []) body.appendChild(this.paramField(node, p));
      if (def.update) body.appendChild(h('div', 'special'));
      if (!def.noOutput) {
        const out = h('div', 'node-out');
        const bar = h('div', 'out-bar');
        const meta = h('span', 'out-meta');
        const hexBtn = h('button', 'icon small', 'HEX');
        hexBtn.title = T('Показать коды символов', 'Show character codes');
        hexBtn.onclick = () => { node.state.hex = !node.state.hex; this.updateOutput(node); };
        const copy = h('button', 'icon small', '⧉');
        copy.title = T('Копировать значение', 'Copy the value');
        copy.onclick = () => this.copy(this.graph.results.get(node.id));
        bar.append(meta, hexBtn, copy);
        out.append(bar, h('div', 'out-media hidden'), h('pre', 'out-text'), h('div', 'out-warn hidden'), h('div', 'out-links'));
        body.appendChild(out);
      }
      el.appendChild(body);
      this.world.appendChild(el);
      this.nodeEls.set(node.id, el);
      return el;
    }

    // Ползунок для числового параметра: min/max/step/unit берутся из описания, двойной щелчок сбрасывает на default.
    // Во время перетаскивания вычисление запускается не чаще раза за кадр (requestEvalFrame), а не с задержкой 120 мс.
    rangeField(node, p) {
      const wrap = h('div', 'field field-range');
      const min = Number.isFinite(p.min) ? p.min : 0;
      const max = Number.isFinite(p.max) ? p.max : 100;
      const step = p.step > 0 ? p.step : 1;
      const unit = p.unit ? ' ' + p.unit : '';
      const head = h('div', 'range-head');
      const label = h('span', 'field-label', p.label || p.key);
      const value = h('span', 'range-value');
      head.append(label, value);
      const slider = h('input', 'range-slider');
      slider.type = 'range';
      Object.assign(slider, { min, max, step });
      slider.setAttribute('aria-label', p.label || p.key);
      const box = h('input', 'range-num');
      box.type = 'number';
      Object.assign(box, { min, max, step });
      box.setAttribute('aria-label', (p.label || p.key) + T(' (точное значение)', ' (exact value)'));
      const reset = T('Двойной щелчок — вернуть ', 'Double-click to reset to ') + p.default + unit;
      slider.title = reset;
      const show = (v) => {
        value.textContent = G.RangeParam.format(v, step) + unit;
        slider.value = v;
        if (document.activeElement !== box) box.value = v;
      };
      const apply = (raw, live) => {
        const n = Number(raw);
        if (raw === '' || !Number.isFinite(n)) return;
        node.params[p.key] = G.RangeParam.clamp(p.int ? Math.round(n) : n, min, max);
        show(node.params[p.key]);
        if (live) this.requestEvalFrame(); else this.requestEval();
      };
      slider.addEventListener('input', () => apply(slider.value, true));
      box.addEventListener('input', () => { if (box.value !== '' && Number(box.value) >= min && Number(box.value) <= max) apply(box.value, false); });
      box.addEventListener('change', () => { apply(box.value === '' ? p.default : box.value, false); box.value = node.params[p.key]; });
      slider.addEventListener('dblclick', () => apply(p.default, true));
      show(Number.isFinite(Number(node.params[p.key])) ? Number(node.params[p.key]) : p.default);
      wrap.append(head, h('div', 'range-row'));
      wrap.lastChild.append(slider, box);
      return wrap;
    }

    paramField(node, p) {
      if (p.type === 'hidden') return h('span', 'hidden');
      if (p.type === 'range') return this.rangeField(node, p);
      const wrap = h('label', 'field' + (p.type === 'bool' ? ' check' : ''));
      let input;
      if (p.type === 'select') {
        input = h('select');
        for (const [v, label] of p.options) {
          const o = h('option', '', label);
          o.value = v;
          input.appendChild(o);
        }
        input.value = String(node.params[p.key]);
      } else if (p.type === 'bool') {
        input = h('input');
        input.type = 'checkbox';
        input.checked = !!node.params[p.key];
      } else if (p.type === 'textarea') {
        input = h('textarea');
        input.value = node.params[p.key];
        input.rows = node.type === 'note' ? 7 : 3;
        input.spellcheck = false;
      } else {
        input = h('input');
        input.type = p.type === 'number' ? 'number' : 'text';
        input.value = node.params[p.key];
        input.spellcheck = false;
      }
      input.addEventListener(p.type === 'select' || p.type === 'bool' ? 'change' : 'input', () => {
        node.params[p.key] = p.type === 'bool' ? input.checked : p.type === 'number' ? Number(input.value) : input.value;
        this.requestEval();
      });
      if (p.type === 'bool') wrap.append(input, h('span', '', p.label));
      else { if (p.label) wrap.appendChild(h('span', 'field-label', p.label)); wrap.appendChild(input); }
      return wrap;
    }

    // ---------- вычисление и вывод ----------
    requestEval() {
      clearTimeout(this.evalTimer);
      this.evalTimer = setTimeout(() => this.evaluate(), 120);
    }

    // Живой предпросмотр при перетаскивании ползунка: одно вычисление на кадр, без задержки requestEval.
    requestEvalFrame() {
      if (this.frameQueued) return;
      this.frameQueued = true;
      const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 16);
      raf(() => { this.frameQueued = false; clearTimeout(this.evalTimer); this.evaluate(); });
    }

    evaluate() {
      const results = this.graph.evaluate();
      for (const node of this.graph.nodes.values()) {
        this.updateOutput(node);
        const def = G.typeDef(node.type);
        if (def.update) def.update(node, results.get(node.id), this.nodeEls.get(node.id).querySelector('.node-body'), this);
      }
      this.markCulprits();
      this.drawWires();
      this.changed();
      // Подписчики вне холста (гид примера) узнают о новых результатах, в том числе после асинхронного OCR.
      this.root.dispatchEvent(new CustomEvent('graph-evaluated'));
    }

    updateOutput(node) {
      const el = this.nodeEls.get(node.id);
      const res = this.graph.results.get(node.id);
      if (!el || !res) return;
      const pre = el.querySelector('.out-text');
      if (!pre) return;
      const meta = el.querySelector('.out-meta');
      const links = el.querySelector('.out-links');
      const warn = el.querySelector('.out-warn');
      el.classList.toggle('has-error', !!res.error);
      links.innerHTML = '';
      this.showWarnings(warn, res.warnings);
      if (res.error) { pre.textContent = '⚠ ' + res.error; meta.textContent = T('ошибка', 'error'); return; }
      const media = el.querySelector('.out-media');
      // Картинку и звук показывает нода «Результат»: у нод обработки своё превью, дублировать его не нужно.
      const isFile = node.type === 'view' && res.value !== undefined && !res.error && G.Artifacts && G.Artifacts.isHandle(res.value);
      if (media) { media.classList.toggle('hidden', !isFile); if (!isFile) { media.innerHTML = ''; media.dataset.key = ''; } }
      if (res.value === undefined) { pre.textContent = res.empty ? T('— подключи вход —', '— connect an input —') : '—'; meta.textContent = ''; return; }
      if (isFile && media) { this.showArtifact(media, pre, meta, res.value); return; }
      const v = String(res.value);
      const shown = node.state.hex ? C.toHexView(v) : C.visible(v);
      pre.textContent = shown.length > MAX_PREVIEW ? shown.slice(0, MAX_PREVIEW) + ' …' : shown;
      meta.textContent = Array.from(v).length + T(' симв.', ' chars');
      this.renderLinks(links, v);
    }

    // Выход — файл (картинка, звук, архив…): картинка рисуется, звук играет, для прочего — имя, тип и размер.
    showArtifact(media, pre, meta, handle) {
      const A = G.Artifacts;
      const a = A.get(A.idOf(handle));
      if (!a) { pre.textContent = handle; meta.textContent = ''; return; }
      const size = a.size ? ' · ' + (a.size > 1048576 ? (a.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(a.size / 1024)) + ' KB') : '';
      pre.textContent = a.name || '';
      meta.textContent = (a.width && a.height ? a.width + '×' + a.height : a.kind) + size;
      if (media.dataset.key === handle) return;
      media.dataset.key = handle;
      media.innerHTML = '';
      if (a.kind === 'image') {
        let px = null;
        try { px = G.ImgStore && G.ImgStore.get(handle); } catch (e) { px = null; }
        if (px) {
          const c = h('canvas', 'out-image');
          c.width = px.width; c.height = px.height;
          c.getContext('2d').putImageData(new ImageData(px.data, px.width, px.height), 0, 0);
          media.appendChild(c);
          meta.textContent = px.width + '×' + px.height + size;
        } else if (a.dataUrl) {
          const img = h('img', 'out-image');
          img.src = a.dataUrl; img.alt = a.name || '';
          media.appendChild(img);
        } else media.dataset.key = '';   // пиксели ещё декодируются — нарисуем при следующем пересчёте
      } else if ((a.kind === 'audio' || a.kind === 'video') && a.dataUrl) {
        const el = h(a.kind, 'out-image');
        el.controls = true; el.src = a.dataUrl;
        media.appendChild(el);
      } else if (a.kind === 'text') {
        const bytes = A.bytes(a.id);
        const text = bytes ? new TextDecoder('utf-8').decode(bytes.subarray(0, MAX_PREVIEW)) : '';
        pre.textContent = text + (bytes && bytes.length > MAX_PREVIEW ? ' …' : '');
      }
      // Любой файл можно сохранить: промежуточный архив, распакованный текст, картинку после обработки.
      const save = h('button', 'btn small out-save', T('⬇ Скачать ', '⬇ Download ') + (a.name || ''));
      save.title = T('Сохранить этот файл на компьютер', 'Save this file to the computer');
      save.onclick = () => this.downloadArtifact(handle);
      media.appendChild(save);
    }

    // Скачивание файла-результата: исходные байты, а у картинок после обработки — PNG из пикселей.
    downloadArtifact(handle) {
      const A = G.Artifacts;
      const a = A.get(A.idOf(handle));
      if (!a) return;
      const link = h('a');
      link.download = a.name || 'file';
      const done = (url, revoke) => { link.href = url; document.body.appendChild(link); link.click(); link.remove(); if (revoke) setTimeout(() => URL.revokeObjectURL(url), 1000); };
      if (a.dataUrl) { done(a.dataUrl); return; }
      let px = null;
      try { px = a.kind === 'image' && G.ImgStore ? G.ImgStore.get(handle) : null; } catch (e) { px = null; }
      if (px) {
        const c = h('canvas');
        c.width = px.width; c.height = px.height;
        c.getContext('2d').putImageData(new ImageData(px.data, px.width, px.height), 0, 0);
        if (!/\.png$/i.test(link.download)) link.download += '.png';
        c.toBlob((blob) => blob && done(URL.createObjectURL(blob), true), 'image/png');
        return;
      }
      const bytes = A.bytes(a.id);
      if (bytes) done(URL.createObjectURL(new Blob([bytes], { type: a.mime || 'application/octet-stream' })), true);
    }

    // Предупреждения операции (потеря данных при разборе): значок ⚠ и текст под выводом.
    showWarnings(box, warnings) {
      const list = Array.isArray(warnings) ? warnings.filter(Boolean) : [];
      box.classList.toggle('hidden', !list.length);
      box.textContent = list.length ? '⚠ ' + list.join('\n\u26a0 ') : '';
      box.title = T('Предупреждение: часть данных могла быть потеряна', 'Warning: some data may have been lost');
    }

    // Подсвечивает ноду, из-за ошибки которой не считается текущая («Ошибка на входе: нода N»).
    markCulprits() {
      for (const el of this.nodeEls.values()) el.classList.remove('culprit');
      for (const res of this.graph.results.values()) {
        const culprit = res && res.inputError && this.nodeEls.get(res.inputError.nodeId);
        if (culprit) culprit.classList.add('culprit');
      }
    }

    // Ссылки, YouTube ID и Drive ID в значении — кликабельные.
    renderLinks(box, v, limit) {
      for (const l of G.Links.detect(v).filter((x) => x.confidence >= 2).slice(0, limit || 3)) box.appendChild(this.linkRow(l));
    }

    // Строка найденной ссылки: сервис, адрес, кнопка проверки.
    linkRow(l) {
      const row = h('div', 'link-row conf-' + l.confidence);
      row.append(h('span', 'link-service', l.service + (l.note ? ' · ' + l.note : '')), this.link(l.url, l.url.replace(/^https?:\/\//, '')));
      const ytId = l.serviceId === 'youtube' ? G.Links.youtubeIdFrom(l.url) : null;
      if (ytId || l.check === 'http') {
        const btn = h('button', 'btn tiny', T('проверить', 'check'));
        btn.onclick = async () => {
          btn.textContent = '…';
          if (ytId) { btn.replaceWith(this.youtubeCard(ytId, await G.API.youtube(ytId))); return; }
          btn.replaceWith(this.linkStatus(await G.API.link(l.url)));
        };
        row.appendChild(btn);
      }
      return row;
    }

    linkStatus(r) {
      const text = {
        found: T('страница существует (HTTP ' + r.http + ')', 'page exists (HTTP ' + r.http + ')'),
        not_found: T('не найдено (HTTP ' + r.http + ')', 'not found (HTTP ' + r.http + ')'),
        redirect: T('ведёт на ', 'redirects to ') + (r.location || '?'),
        denied: T('доступ закрыт (HTTP ' + r.http + ') — страница может существовать', 'access denied (HTTP ' + r.http + ') — the page may exist'),
      }[r.status] || (r.message || T('ошибка проверки', 'check failed'));
      return h('span', 'link-status ' + r.status, text);
    }

    link(href, text) {
      const a = h('a', 'out-link', text);
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      return a;
    }

    youtubeCard(id, r) {
      const card = h('div', 'yt-card ' + r.status);
      if (r.status === 'found') {
        if (r.thumbnail) {
          const img = h('img');
          img.src = r.thumbnail;
          img.alt = '';
          img.loading = 'lazy';
          card.appendChild(img);
        }
        const info = h('div', 'yt-info');
        info.append(this.link('https://www.youtube.com/watch?v=' + id, r.title || id), h('div', 'muted', r.author || ''));
        if (G.API.isAuthor(r)) info.appendChild(h('span', 'badge', T('канал автора', 'author channel')));
        card.appendChild(info);
      } else if (r.status === 'denied') {
        card.textContent = id + T(': доступ закрыт (HTTP ' + (r.http || 403) + ') — видео может существовать', ': access denied (HTTP ' + (r.http || 403) + ') — the video may exist');
      } else if (r.status === 'not_found') {
        card.textContent = id + T(': видео недоступно (HTTP ', ': video unavailable (HTTP ') + (r.http || 404) + ')';
      } else {
        card.textContent = id + ': ' + (r.message || T('ошибка проверки', 'check failed'));
      }
      return card;
    }

    renderResults(container, results, opts) {
      container.innerHTML = '';
      if (!results.length) { container.appendChild(h('div', 'muted', T('Пока ничего осмысленного', 'Nothing meaningful yet'))); return; }
      const note = this.verdictNote(results, opts.verdict);
      if (note) container.appendChild(h('div', 'result-warning', note));
      for (const r of results) {
        const item = h('div', 'result' + (opts.selected === r.text ? ' selected' : ''));
        const top = h('div', 'result-top');
        top.append(h('span', 'score', Math.round(r.rank)), h('span', 'result-text mono', C.visible(r.text).slice(0, 160)));
        const chain = h('div', 'result-chain', G.Solver.describeChain(r.chain));
        const tags = h('div', 'tags');
        for (const t of this.resultBadges(r).concat(r.tags).concat(r.words.length ? [T('слова: ', 'words: ') + r.words.slice(0, 4).join(', ')] : [])) tags.appendChild(h('span', 'tag', t));
        const actions = h('div', 'result-actions');
        const expand = h('button', 'btn tiny accent', T('В граф', 'To graph'));
        expand.title = T('Развернуть цепочку нодами', 'Expand the chain as nodes');
        expand.onclick = (e) => { e.stopPropagation(); opts.onExpand(r); };
        const copy = h('button', 'btn tiny', T('Копировать', 'Copy'));
        copy.onclick = (e) => { e.stopPropagation(); this.copy({ value: r.text }); };
        actions.append(expand, copy);
        if (G.Scorer.YT_ID.test(r.text)) {
          const yt = h('button', 'btn tiny', 'YouTube?');
          yt.onclick = async (e) => {
            e.stopPropagation();
            yt.textContent = '…';
            yt.replaceWith(this.youtubeCard(r.text, await G.API.youtube(r.text)));
          };
          actions.appendChild(yt);
        }
        item.append(top, chain, tags, actions);
        if (opts.onPick) item.onclick = () => {
          container.querySelectorAll('.result.selected').forEach((x) => x.classList.remove('selected'));
          item.classList.add('selected');
          opts.onPick(r);
        };
        container.appendChild(item);
      }
    }

    // Итог поиска словами: ответ не определён, распознан только формат, есть лишь гипотезы.
    verdictNote(results, verdict) {
      const v = verdict || results.verdict || (results.every((r) => r.confident === false) ? 'undetermined' : 'solved');
      if (v === 'undetermined') return T('Ответ не определён: ни один вариант не подтверждён. Ниже — гипотезы; нужен ключ, контекст или другой материал.', 'Answer not determined: no candidate is confirmed. Below are hypotheses; a key, context or another artifact is needed.');
      if (v === 'format') return T('Распознан формат (хеш, контейнер или идентификатор), открытого текста нет. Сверь кандидатов или найди ключ.', 'A format is recognised (hash, container or identifier); there is no plaintext. Check candidates or find the key.');
      if (v === 'decoded') return T('Слой формата снят точно, без угадывания, но результат не подтверждён как ответ: он короткий, не читается или сам похож на следующий слой. Проверь варианты ниже.', 'The format layer was decoded exactly, with no guessing, but the result is not confirmed as the answer: it is short, unreadable or looks like another layer. Check the candidates below.');
      if (v === 'candidates') return T('Есть правдоподобные варианты, но доказательств мало (короткий текст, угаданные параметры или расшифрована часть входа). Проверь их.', 'There are plausible candidates but little evidence (short text, guessed parameters or only part of the input decoded). Verify them.');
      return '';
    }

    // Пометки результата: статус, «как есть», ключ из банка проекта, откуда вырезан кусок текста.
    resultBadges(r) {
      const out = [];
      if (r.status && G.SolverEvidence) out.push(G.SolverEvidence.LABEL[r.status]());
      if (r.asIs) out.push(T('как есть', 'as is'));
      if (r.userKey) out.push(T('ключ проекта: ', 'project key: ') + r.userKey);
      if (r.source) out.push(T('из текста: ', 'from text: ') + (r.source.kind || '') + (r.source.line ? T(' · строка ', ' · line ') + r.source.line : ''));
      return out;
    }

    // Разворачивает цепочку операций нодами, начиная от источника данных ноды nodeId.
    materializeFromNode(nodeId, chain) {
      const node = this.graph.nodes.get(nodeId);
      const el = this.nodeEls.get(nodeId);
      const link = this.graph.linkInto(nodeId, 0);
      let sourceId = link ? link.from : null;
      const startY = node.y + (el ? el.offsetHeight : 200) + 50;
      if (!sourceId) sourceId = this.addNode('input', node.x, startY, { text: node.state.input || '' }).id;
      this.materializeChain(sourceId, chain, node.x, startY);
    }

    materializeChain(sourceId, chain, x, y) {
      let prev = sourceId;
      let cx = x;
      for (const step of chain) {
        const n = this.graph.addNode('op:' + step.op, cx, y, step.params);
        this.renderNode(n);
        this.graph.connect(prev, n.id, 0);
        prev = n.id;
        cx += 280;
      }
      const results = this.graph.evaluate();
      const finalValue = results.get(prev) && results.get(prev).value;
      const endType = finalValue && G.API.extractYouTubeId(finalValue) ? 'youtube' : 'view';
      const end = this.graph.addNode(endType, cx, y);
      this.renderNode(end);
      this.graph.connect(prev, end.id, 0);
      this.select(end.id);
      this.evaluate();
      this.focusOn(x, y, cx + 260);
    }

    focusOn(x, y, x2) {
      const r = this.root.getBoundingClientRect();
      const width = (x2 || x + 300) - x;
      this.zoom = Math.max(0.45, Math.min(1, (r.width - 80) / Math.max(width, 1)));
      this.pan.x = 40 - x * this.zoom;
      this.pan.y = r.height * 0.3 - y * this.zoom;
      this.applyTransform();
      this.drawWires();
    }

    // Габарит всего содержимого доски: ноды и рисунки (мировые координаты).
    contentBounds() {
      const boxes = [...this.graph.nodes.values()].map((n) => ({ x: n.x, y: n.y, w: 300, h: 260 }));
      const art = this.annotations && this.annotations.bounds();
      if (art) boxes.push(art);
      if (!boxes.length) return null;
      const minX = Math.min(...boxes.map((b) => b.x)), minY = Math.min(...boxes.map((b) => b.y));
      return { minX, minY, maxX: Math.max(...boxes.map((b) => b.x + b.w)), maxY: Math.max(...boxes.map((b) => b.y + b.h)) };
    }

    fitAll() {
      const b = this.contentBounds();
      if (!b) return;
      const { minX, minY, maxX, maxY } = b;
      const r = this.root.getBoundingClientRect();
      // Карточка поверх холста справа (гид примера) не должна закрывать ноды: вписываем их левее неё.
      const cover = this.root.parentElement && this.root.parentElement.querySelector('[data-covers-right]:not(.hidden):not(.collapsed)');
      const inset = cover && r.width > 900 ? cover.getBoundingClientRect().width + 24 : 0;
      this.zoom = Math.max(0.3, Math.min(1, (r.width - inset - 60) / (maxX - minX), (r.height - 60) / (maxY - minY)));
      this.pan.x = 30 - minX * this.zoom;
      this.pan.y = 30 - minY * this.zoom;
      this.applyTransform();
      this.drawWires();
    }

    // ---------- провода ----------
    curve(a, b) {
      const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
      return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
    }

    drawWires() {
      for (const p of [...this.svg.querySelectorAll('path.wire:not(.temp)')]) p.remove();
      for (const l of this.graph.links) {
        const fromEl = this.nodeEls.get(l.from), toEl = this.nodeEls.get(l.to);
        if (!fromEl || !toEl) continue;
        const outPort = fromEl.querySelector('.port-out');
        const inPort = toEl.querySelector(`.port-in[data-port="${l.port}"]`);
        if (!outPort || !inPort) continue;
        const path = document.createElementNS(SVGNS, 'path');
        path.classList.add('wire');
        const res = this.graph.results.get(l.from);
        if (res && res.error) path.classList.add('error');
        else if (!res || res.value === undefined) path.classList.add('empty');
        path.setAttribute('d', this.curve(this.portCenter(outPort), this.portCenter(inPort)));
        this.svg.insertBefore(path, this.tempPath);
      }
    }

    // ---------- служебное ----------
    copy(res) {
      if (!res || res.value === undefined) return;
      navigator.clipboard.writeText(String(res.value)).then(() => this.toast(T('Скопировано', 'Copied')), () => this.toast(T('Не удалось скопировать', 'Could not copy')));
    }

    toast(text, ms) { if (this.hooks.toast) this.hooks.toast(text, ms); }
    changed() { if (this.hooks.onChange) this.hooks.onChange(); }
  }

  G.GraphView = GraphView;
  G.CAT_CLASS = CAT_CLASS;
})(typeof self !== 'undefined' ? self : this);
