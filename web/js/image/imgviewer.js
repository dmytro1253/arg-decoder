// Просмотрщик изображения для нод: масштаб колесом, сдвиг перетаскиванием, пиксельная сетка, координаты и RGB под
// курсором (клик — закрепить пипетку), переключатель «до/после», гистограмма и выделение области перетаскиванием.
// Рисует из {width,height,data}, не трогая исходные байты. Наружу — элемент el и небольшие методы.
(function (G) {
  'use strict';

  const T = G.T || ((ru) => ru);
  const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const hex2 = (v) => v.toString(16).padStart(2, '0');
  const MIN_ZOOM = 0.05, MAX_ZOOM = 64, GRID_FROM = 8;

  function create(options) {
    const opt = Object.assign({ height: 220, histogram: true, beforeAfter: true, select: false, onRegion: null }, options || {});
    const root = h('div', 'imgv');
    const bar = h('div', 'imgv-bar');
    const stage = h('div', 'imgv-stage');
    stage.style.height = opt.height + 'px';
    const canvas = h('canvas', 'imgv-canvas');
    stage.appendChild(canvas);
    const info = h('div', 'imgv-info muted small', T('Наведи на пиксель', 'Hover a pixel'));
    const histCanvas = h('canvas', 'imgv-hist');
    histCanvas.width = 256; histCanvas.height = 48;

    const st = { img: null, before: null, showBefore: false, zoom: 1, ox: 0, oy: 0, overlays: [], region: null, picked: null, selecting: false, fitted: false };
    const off = document.createElement('canvas');

    const btn = (label, title, fn) => { const b = h('button', 'btn tiny', label); b.title = title; b.onclick = fn; bar.appendChild(b); return b; };
    btn('−', T('Уменьшить', 'Zoom out'), () => zoomAt(1 / 1.5, stage.clientWidth / 2, stage.clientHeight / 2));
    btn('+', T('Увеличить', 'Zoom in'), () => zoomAt(1.5, stage.clientWidth / 2, stage.clientHeight / 2));
    btn('1:1', T('Масштаб 100%', 'Actual size'), () => { st.zoom = 1; center(); draw(); });
    btn(T('Вписать', 'Fit'), T('Вписать в окно', 'Fit to window'), () => { fit(); draw(); });
    const baBtn = opt.beforeAfter ? btn(opt.altLabel || T('До/после', 'Before/after'), opt.altLabel ? T('Переключить вид', 'Switch view') : T('Показать исходное изображение (до обработки)', 'Show the original image (before processing)'), () => { st.showBefore = !st.showBefore; baBtn.classList.toggle('active', st.showBefore); draw(); }) : null;
    const selBtn = opt.select ? btn(T('Область', 'Region'), T('Выделить область перетаскиванием; повторный клик — снять выделение', 'Drag to select a region; click again to clear'), () => {
      if (st.region) { setRegion(null); if (opt.onRegion) opt.onRegion(null); selBtn.classList.remove('active'); return; }
      st.selecting = !st.selecting;
      selBtn.classList.toggle('active', st.selecting);
      stage.classList.toggle('imgv-selecting', st.selecting);
    }) : null;

    const shown = () => (st.showBefore && st.before ? st.before : st.img);

    function fit() {
      const s = shown();
      if (!s || !stage.clientWidth) return;
      st.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(stage.clientWidth / s.width, stage.clientHeight / s.height) * 0.98));
      center();
    }
    function center() {
      const s = shown();
      if (!s) return;
      st.ox = (stage.clientWidth - s.width * st.zoom) / 2;
      st.oy = (stage.clientHeight - s.height * st.zoom) / 2;
    }
    function zoomAt(k, px, py) {
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, st.zoom * k));
      const f = z / st.zoom;
      st.ox = px - (px - st.ox) * f; st.oy = py - (py - st.oy) * f; st.zoom = z;
      draw();
    }
    const toImage = (px, py) => ({ x: Math.floor((px - st.ox) / st.zoom), y: Math.floor((py - st.oy) / st.zoom) });

    function prepare(img) {
      off.width = img.width; off.height = img.height;
      off.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
    }
    let preparedFor = null;

    function draw() {
      const s = shown();
      const w = stage.clientWidth || 300, hh = stage.clientHeight || opt.height;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== hh) canvas.height = hh;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, hh);
      if (!s) return;
      if (preparedFor !== s) { prepare(s); preparedFor = s; }
      ctx.imageSmoothingEnabled = st.zoom < 1;
      ctx.drawImage(off, st.ox, st.oy, s.width * st.zoom, s.height * st.zoom);
      if (st.zoom >= GRID_FROM) drawGrid(ctx, s, w, hh);
      for (const o of st.overlays) drawBox(ctx, o);
      if (st.region) drawBox(ctx, { x: st.region.x, y: st.region.y, w: st.region.w, h: st.region.h, color: '#4aa3ff', dash: true });
      if (st.picked) drawBox(ctx, { x: st.picked.x, y: st.picked.y, w: 1, h: 1, color: '#ff0', dash: false });
    }

    function drawGrid(ctx, s, w, hh) {
      ctx.strokeStyle = 'rgba(128,128,128,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath();
      const x0 = Math.max(0, Math.floor(-st.ox / st.zoom)), x1 = Math.min(s.width, Math.ceil((w - st.ox) / st.zoom));
      const y0 = Math.max(0, Math.floor(-st.oy / st.zoom)), y1 = Math.min(s.height, Math.ceil((hh - st.oy) / st.zoom));
      for (let x = x0; x <= x1; x++) { const px = Math.round(st.ox + x * st.zoom) + 0.5; ctx.moveTo(px, Math.max(0, st.oy)); ctx.lineTo(px, hh); }
      for (let y = y0; y <= y1; y++) { const py = Math.round(st.oy + y * st.zoom) + 0.5; ctx.moveTo(Math.max(0, st.ox), py); ctx.lineTo(w, py); }
      ctx.stroke();
    }

    function drawBox(ctx, o) {
      const x = st.ox + o.x * st.zoom, y = st.oy + o.y * st.zoom, bw = o.w * st.zoom, bh = o.h * st.zoom;
      ctx.strokeStyle = o.color || '#0f0'; ctx.lineWidth = 1.5;
      ctx.setLineDash(o.dash ? [5, 3] : []);
      ctx.strokeRect(x, y, Math.max(bw, 2), Math.max(bh, 2));
      ctx.setLineDash([]);
      if (o.label) {
        ctx.font = '11px monospace';
        const tw = ctx.measureText(o.label).width + 4;
        ctx.fillStyle = o.color || '#0f0';
        ctx.fillRect(x, y - 13, tw, 13);
        ctx.fillStyle = '#000';
        ctx.fillText(o.label, x + 2, y - 3);
      }
    }

    function describe(p) {
      const s = shown();
      if (!s || p.x < 0 || p.y < 0 || p.x >= s.width || p.y >= s.height) return '';
      const i = (p.y * s.width + p.x) * 4;
      const [r, g, b, a] = [s.data[i], s.data[i + 1], s.data[i + 2], s.data[i + 3]];
      return `x=${p.x} y=${p.y} · RGB(${r}, ${g}, ${b}) #${hex2(r)}${hex2(g)}${hex2(b)}` + (a < 255 ? ' · α=' + a : '') + ` · ${s.width}×${s.height} · ${Math.round(st.zoom * 100)}%`;
    }

    function drawHist() {
      const s = shown();
      const ctx = histCanvas.getContext('2d');
      ctx.clearRect(0, 0, 256, 48);
      if (!s || !opt.histogram) return;
      const hist = G.ImgProc.histogram(s);
      const peak = Math.max(1, ...Array.from(hist.luma).slice(1, 255));
      const line = (arr, color) => {
        ctx.strokeStyle = color; ctx.beginPath();
        for (let i = 0; i < 256; i++) { const y = 47 - Math.min(1, arr[i] / peak) * 46; if (i) ctx.lineTo(i, y); else ctx.moveTo(i, y); }
        ctx.stroke();
      };
      line(hist.r, 'rgba(255,80,80,0.8)'); line(hist.g, 'rgba(80,200,80,0.8)'); line(hist.b, 'rgba(90,140,255,0.8)'); line(hist.luma, 'rgba(160,160,160,0.95)');
    }

    // --- мышь ---
    let drag = null;
    stage.addEventListener('wheel', (e) => { e.preventDefault(); const r = stage.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.25 : 1 / 1.25, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    stage.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const r = stage.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      drag = { px, py, ox: st.ox, oy: st.oy, moved: false, sel: st.selecting, start: toImage(px, py) };
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      const r = stage.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      if (drag) {
        if (Math.abs(px - drag.px) + Math.abs(py - drag.py) > 3) drag.moved = true;
        if (drag.sel) {
          const p = toImage(px, py), s = shown();
          if (s) setRegion(clampRegion(drag.start, p, s));
        } else { st.ox = drag.ox + (px - drag.px); st.oy = drag.oy + (py - drag.py); draw(); }
        return;
      }
      if (px >= 0 && py >= 0 && px < stage.clientWidth && py < stage.clientHeight) {
        const d = describe(toImage(px, py));
        if (d) info.textContent = (st.picked ? '📌 ' + describe(st.picked) + '\n' : '') + d;
      }
    });
    window.addEventListener('mouseup', () => {
      if (!drag) return;
      const d = drag; drag = null;
      if (d.sel && d.moved && st.region) {
        st.selecting = false; stage.classList.remove('imgv-selecting');
        if (opt.onRegion) opt.onRegion(Object.assign({}, st.region));
      } else if (!d.moved) { st.picked = d.start; info.textContent = '📌 ' + describe(d.start); draw(); }
    });

    function clampRegion(a, b, s) {
      const x0 = Math.max(0, Math.min(a.x, b.x)), y0 = Math.max(0, Math.min(a.y, b.y));
      const x1 = Math.min(s.width, Math.max(a.x, b.x) + 1), y1 = Math.min(s.height, Math.max(a.y, b.y) + 1);
      return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
    }
    function setRegion(r) {
      st.region = r;
      if (selBtn) selBtn.classList.toggle('active', !!r || st.selecting);
      draw();
    }

    root.append(bar, stage, info);
    if (opt.histogram) root.appendChild(histCanvas);

    return {
      el: root,
      /** Показать изображение (и, необязательно, исходное «до»). */
      setImage(img, before) {
        const first = !st.img;
        st.img = img; st.before = before || null;
        if (!before) { st.showBefore = false; if (baBtn) baBtn.classList.remove('active'); }
        if (first || !st.fitted) { st.fitted = !!stage.clientWidth; fit(); }
        draw(); drawHist();
      },
      setOverlays(list) { st.overlays = list || []; draw(); },
      setRegion,
      redraw() { draw(); },
      region() { return st.region; },
    };
  }

  G.ImgViewer = { create };
})(typeof self !== 'undefined' ? self : this);
