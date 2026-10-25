// Нода «Спектрограмма»: звук или видео → спектрограмма и осциллограмма с осями, зумом по времени,
// выделением интервала и воспроизведением. Выход — картинка-артефакт (её читают OCR и модуль изображений)
// либо WAV-фрагмент выделения.
(function (G) {
  'use strict';
  const T = G.T;
  const { h, button, fmtTime, fmtHz, ticks, logTicks, download } = G.MediaUI;
  const IO = G.AudioIO, DSP = G.DSP, SR = G.SpectroRender;

  const W = 720;                                   // ширина внутреннего холста; на экране растягивается
  const M = { l: 52, r: 8, t: 6, spec: 250, axis: 20, gap: 6, wave: 64 };
  const MAX_COLS = 1400;                           // столбцов спектрограммы на экране
  const EXPORT_MAX_COLS = 2400, EXPORT_MIN_COLS = 600;
  const MIN_SELECTION = 0.005;                     // секунд

  const opts = (list) => list.map((v) => [String(v), String(v)]);
  const CMAPS = Object.keys(SR.CMAP_NAMES).map((k) => [k, T(SR.CMAP_NAMES[k][0], SR.CMAP_NAMES[k][1])]);

  const num = (v, d) => { const x = Number(v); return Number.isFinite(x) ? x : d; };

  // ---------- Расчёт ----------
  function signalFor(node, pcm, p) {
    const key = [node.state.handle, p.chan, p.reverse, p.speed].join('|');
    if (node.state.sigKey !== key) {
      node.state.sig = IO.prepare(pcm, { channel: p.chan, reverse: !!p.reverse, speed: num(p.speed, 1) });
      node.state.sigKey = key;
    }
    return node.state.sig;
  }

  const sizeOf = (p) => num(p.fft, 2048);
  const hopOf = (p) => Math.max(1, Math.round(sizeOf(p) * (1 - num(p.overlap, 75) / 100)));

  function renderOptions(p, height, width) {
    return {
      height, width, fmin: num(p.fmin, 0), fmax: num(p.fmax, 0), scale: p.scale, autolevel: !!p.autolevel,
      range: num(p.range, 80), dbmin: num(p.dbmin, -100), dbmax: num(p.dbmax, -10), gamma: num(p.gamma, 1), cmap: p.cmap,
    };
  }

  function stftFor(sig, p, a, b, hop) {
    return DSP.stft(sig.samples, { size: sizeOf(p), hop, window: p.win, start: Math.floor(a * sig.sampleRate), end: Math.ceil(b * sig.sampleRate), sampleRate: sig.sampleRate });
  }

  /** Вид на экране: не больше MAX_COLS столбцов, при приближении — полное перекрытие из параметров. */
  function viewSpec(sig, p, a, b) {
    const span = Math.max(1, Math.round((b - a) * sig.sampleRate) - sizeOf(p));
    const hop = Math.max(hopOf(p), Math.ceil(span / MAX_COLS));
    return { spec: stftFor(sig, p, a, b, hop), hop };
  }

  function selectionOf(p, dur) {
    const a = Math.max(0, num(p.selA, 0)), b = Math.min(dur, num(p.selB, 0));
    return b - a >= MIN_SELECTION ? { a, b } : null;
  }

  /** Картинка для экспорта: выделение или весь файл; шаг подбирается под 600–2400 столбцов. */
  function exportImage(sig, p) {
    const dur = sig.samples.length / sig.sampleRate;
    const sel = selectionOf(p, dur) || { a: 0, b: dur };
    const len = Math.max(1, Math.round((sel.b - sel.a) * sig.sampleRate) - sizeOf(p));
    const hop = Math.max(Math.min(hopOf(p), Math.max(4, Math.floor(len / EXPORT_MIN_COLS))), Math.ceil(len / EXPORT_MAX_COLS));
    const spec = stftFor(sig, p, sel.a, sel.b, hop);
    return SR.render(spec, renderOptions(p, num(p.exportH, 512), spec.frames));
  }

  function exportAudio(sig, p) {
    const dur = sig.samples.length / sig.sampleRate;
    const sel = selectionOf(p, dur) || { a: 0, b: dur };
    return DSP.slice(sig.samples, Math.floor(sel.a * sig.sampleRate), Math.ceil(sel.b * sig.sampleRate));
  }

  function compute([handle], p, node) {
    node.state.handle = handle;
    const pcm = IO.need(handle, node);
    node.state.pcm = pcm;
    const sig = signalFor(node, pcm, p);
    const key = [node.state.sigKey, p.out, sizeOf(p), p.win, p.overlap, p.fmin, p.fmax, p.scale, p.autolevel, p.range, p.dbmin, p.dbmax, p.gamma, p.cmap, p.exportH, p.selA, p.selB].join('|');
    if (node.state.outKey === key && G.Artifacts.has(node.state.outId)) return G.Artifacts.handle(node.state.outId);
    const A = G.Artifacts;
    const tag = 'spec_' + node.id + '_' + Math.abs(hashString(key)).toString(36);
    const baseName = (A.get(A.idOf(handle)) || {}).name || 'audio';
    let out;
    if (p.out === 'audio') out = IO.putAudio(tag, [exportAudio(sig, p)], sig.sampleRate, baseName + ' (' + T('фрагмент', 'segment') + ').wav');
    else out = IO.putImage(tag, exportImage(sig, p), baseName + ' (' + T('спектрограмма', 'spectrogram') + ').png');
    if (node.state.outId && node.state.outId !== A.idOf(out)) A.remove(node.state.outId);
    node.state.outKey = key;
    node.state.outId = A.idOf(out);
    return out;
  }

  function hashString(s) {
    let x = 0;
    for (let i = 0; i < s.length; i++) x = (Math.imul(x, 31) + s.charCodeAt(i)) | 0;
    return x;
  }

  // ---------- Рисование ----------
  const cssVar = (el, name, fallback) => (getComputedStyle(el).getPropertyValue(name).trim() || fallback);
  const specBottom = () => M.t + M.spec;

  function plotWidth() { return W - M.l - M.r; }

  function waveTop() { return specBottom() + M.axis + M.gap; }

  function canvasHeight(p) { return waveTop() + (p.showWave ? M.wave : 0) + 4; }

  function freqToY(f, img) {
    if (img.scaleLog) {
      const lo = img.fmin, hi = img.fmax;
      return M.t + M.spec * (1 - Math.log(Math.max(f, lo) / lo) / Math.log(hi / lo));
    }
    return M.t + M.spec * (1 - (f - img.fmin) / (img.fmax - img.fmin));
  }

  function drawSpectrogram(ctx, node, view, spec, hop, img) {
    const sr = node.state.sig.sampleRate, pw = plotWidth();
    const off = document.createElement('canvas');
    off.width = img.width; off.height = img.height;
    off.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
    const t0 = (spec.start + spec.size / 2) / sr - hop / sr / 2;
    const t1 = (spec.start + (spec.frames - 1) * hop + spec.size / 2) / sr + hop / sr / 2;
    const x0 = M.l + (t0 - view.a) / (view.b - view.a) * pw, x1 = M.l + (t1 - view.a) / (view.b - view.a) * pw;
    ctx.save();
    ctx.beginPath(); ctx.rect(M.l, M.t, pw, M.spec); ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, img.width, img.height, x0, M.t, x1 - x0, M.spec);
    ctx.restore();
  }

  function drawAxes(ctx, node, view, img) {
    const el = node.state.ui.base, muted = cssVar(el, '--muted', '#84948b'), border = cssVar(el, '--border-strong', '#3a4a42');
    const pw = plotWidth();
    ctx.font = '10px sans-serif';
    ctx.fillStyle = muted; ctx.strokeStyle = border; ctx.lineWidth = 1;
    ctx.strokeRect(M.l - 0.5, M.t - 0.5, pw + 1, M.spec + 1);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const fs = img.scaleLog ? logTicks(img.fmin, img.fmax) : ticks(img.fmin, img.fmax, 6);
    for (const f of fs) {
      const y = Math.round(freqToY(f, img)) + 0.5;
      ctx.beginPath(); ctx.moveTo(M.l - 4, y); ctx.lineTo(M.l, y); ctx.stroke();
      ctx.fillText(f >= 1000 ? f / 1000 + 'k' : String(f), M.l - 6, y);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const t of ticks(view.a, view.b, 8)) {
      const x = Math.round(M.l + (t - view.a) / (view.b - view.a) * pw) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, specBottom()); ctx.lineTo(x, specBottom() + 4); ctx.stroke();
      ctx.fillText(view.b - view.a < 5 ? t.toFixed(2) + 's' : t.toFixed(t % 1 ? 1 : 0) + 's', x, specBottom() + 6);
    }
  }

  function drawWave(ctx, node, view) {
    const sig = node.state.sig, pw = plotWidth(), top = waveTop();
    const el = node.state.ui.base;
    ctx.strokeStyle = cssVar(el, '--border-strong', '#3a4a42');
    ctx.strokeRect(M.l - 0.5, top - 0.5, pw + 1, M.wave + 1);
    const a = Math.floor(view.a * sig.sampleRate), b = Math.min(sig.samples.length, Math.ceil(view.b * sig.sampleRate));
    const per = (b - a) / pw, mid = top + M.wave / 2;
    ctx.fillStyle = cssVar(el, '--accent', '#5ee08c');
    for (let x = 0; x < pw; x++) {
      const i0 = a + Math.floor(x * per), i1 = Math.max(i0 + 1, Math.min(b, a + Math.floor((x + 1) * per)));
      let lo = 0, hi = 0;
      for (let i = i0; i < i1; i++) { const v = sig.samples[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
      const y0 = mid - Math.min(1, hi) * (M.wave / 2), y1 = mid - Math.max(-1, lo) * (M.wave / 2);
      ctx.fillRect(M.l + x, y0, 1, Math.max(1, y1 - y0));
    }
  }

  function currentView(node, p) {
    const sig = node.state.sig, dur = sig.samples.length / sig.sampleRate;
    const minSpan = Math.min(dur, (sizeOf(p) * 2) / sig.sampleRate);
    let a = Math.max(0, num(p.viewA, 0)), b = num(p.viewB, 0) > 0 ? Math.min(dur, num(p.viewB, 0)) : dur;
    if (b - a < minSpan) { b = Math.min(dur, a + minSpan); a = Math.max(0, b - minSpan); }
    return { a, b, dur };
  }

  function redrawBase(node) {
    const u = node.state.ui, p = node.params;
    const view = currentView(node, p);
    const sig = node.state.sig;
    const key = [node.state.sigKey, view.a, view.b, p.fft, p.win, p.overlap, p.fmin, p.fmax, p.scale, p.autolevel, p.range, p.dbmin, p.dbmax, p.gamma, p.cmap, p.showWave].join('|');
    if (node.state.drawKey === key) return;
    node.state.drawKey = key;
    u.base.height = u.over.height = canvasHeight(p);
    u.base.width = u.over.width = W;
    const ctx = u.base.getContext('2d');
    ctx.fillStyle = cssVar(u.base, '--panel-2', '#161e1a');
    ctx.fillRect(0, 0, W, u.base.height);
    const { spec, hop } = viewSpec(sig, p, view.a, view.b);
    const img = SR.render(spec, renderOptions(p, M.spec * 2, Math.min(spec.frames, MAX_COLS)));
    img.scaleLog = p.scale === 'log';
    node.state.spec = spec; node.state.specHop = hop; node.state.specImg = img;
    drawSpectrogram(ctx, node, view, spec, hop, img);
    drawAxes(ctx, node, view, img);
    if (p.showWave) drawWave(ctx, node, view);
    u.info.textContent = [fmtTime(view.dur) + ' · ' + sig.sampleRate.toFixed(0) + ' ' + T('Гц', 'Hz'),
      T('шаг по частоте ', 'bin ') + (sig.sampleRate / sizeOf(p)).toFixed(1) + ' ' + T('Гц', 'Hz'),
      T('шаг по времени ', 'hop ') + (hop / sig.sampleRate * 1000).toFixed(1) + ' ' + T('мс', 'ms'),
      T('вид ', 'view ') + fmtTime(view.a) + '–' + fmtTime(view.b),
      T('уровни ', 'levels ') + img.lo.toFixed(0) + '…' + img.hi.toFixed(0) + ' dB'].join(' · ');
    node.state.lastView = view;
  }

  function redrawOverlay(node) {
    const u = node.state.ui, p = node.params;
    if (!node.state.sig || !node.state.lastView) return;
    const ctx = u.over.getContext('2d'), view = node.state.lastView, pw = plotWidth();
    ctx.clearRect(0, 0, u.over.width, u.over.height);
    const xOf = (t) => M.l + (t - view.a) / (view.b - view.a) * pw;
    const sel = selectionOf(p, view.dur);
    const bottom = canvasHeight(p) - 4;
    if (sel) {
      const x0 = Math.max(M.l, xOf(sel.a)), x1 = Math.min(M.l + pw, xOf(sel.b));
      if (x1 > x0) {
        ctx.fillStyle = 'rgba(94,224,140,0.18)'; ctx.fillRect(x0, M.t, x1 - x0, bottom - M.t);
        ctx.strokeStyle = 'rgba(94,224,140,0.9)'; ctx.lineWidth = 1;
        ctx.strokeRect(x0 + 0.5, M.t + 0.5, x1 - x0 - 1, bottom - M.t - 1);
      }
    }
    const t = node.state.playPos;
    if (t !== undefined && t !== null) {
      const x = xOf(t);
      if (x >= M.l && x <= M.l + pw) { ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + 0.5, M.t); ctx.lineTo(x + 0.5, bottom); ctx.stroke(); }
    }
    u.selInfo.textContent = sel
      ? T('Выделение: ', 'Selection: ') + fmtTime(sel.a) + ' – ' + fmtTime(sel.b) + ' (' + (sel.b - sel.a).toFixed(3) + ' ' + T('с', 's') + ')'
      : T('Выделения нет: тяни мышью по спектрограмме', 'No selection: drag on the spectrogram');
  }

  // ---------- Мышь ----------
  function pointerTime(node, e) {
    const u = node.state.ui, r = u.over.getBoundingClientRect(), view = node.state.lastView;
    const x = (e.clientX - r.left) * (u.over.width / r.width), y = (e.clientY - r.top) * (u.over.height / r.height);
    const t = view.a + (x - M.l) / plotWidth() * (view.b - view.a);
    return { x, y, t: Math.max(view.a, Math.min(view.b, t)) };
  }

  function hoverReadout(node, e) {
    const u = node.state.ui, img = node.state.specImg, spec = node.state.spec;
    if (!img || !spec) return;
    const pt = pointerTime(node, e), sr = node.state.sig.sampleRate;
    if (pt.y < M.t || pt.y > specBottom() || pt.x < M.l) { u.hover.textContent = ''; return; }
    const v = 1 - (pt.y - M.t) / M.spec;
    const f = img.scaleLog ? img.fmin * Math.pow(img.fmax / img.fmin, v) : img.fmin + v * (img.fmax - img.fmin);
    const fi = Math.round((pt.t * sr - spec.start - spec.size / 2) / node.state.specHop);
    const bin = Math.round(f / (sr / spec.size));
    const db = fi >= 0 && fi < spec.frames && bin >= 0 && bin < spec.bins ? spec.db[fi * spec.bins + bin].toFixed(1) + ' dB' : '';
    u.hover.textContent = fmtTime(pt.t) + ' · ' + fmtHz(f) + (db ? ' · ' + db : '');
  }

  function bindMouse(node, ui) {
    const u = node.state.ui;
    let drag = null;
    u.over.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !node.state.lastView) return;
      e.stopPropagation();
      u.over.setPointerCapture(e.pointerId);
      drag = { t0: pointerTime(node, e).t, moved: false };
    });
    u.over.addEventListener('pointermove', (e) => {
      if (!node.state.lastView) return;
      hoverReadout(node, e);
      if (!drag) return;
      const t = pointerTime(node, e).t;
      if (Math.abs(t - drag.t0) > 1e-6) drag.moved = true;
      node.params.selA = Math.min(drag.t0, t);
      node.params.selB = Math.max(drag.t0, t);
      redrawOverlay(node);
    });
    const finish = () => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      if (!moved) { node.params.selA = 0; node.params.selB = 0; }
      redrawOverlay(node);
      ui.requestEval();
    };
    u.over.addEventListener('pointerup', finish);
    u.over.addEventListener('pointercancel', finish);
    u.over.addEventListener('pointerleave', () => { u.hover.textContent = ''; });
    u.over.addEventListener('wheel', (e) => {
      if (!node.state.lastView) return;
      e.preventDefault(); e.stopPropagation();
      zoomAt(node, pointerTime(node, e).t, e.deltaY < 0 ? 0.8 : 1.25, ui);
    }, { passive: false });
  }

  function setView(node, a, b, ui) {
    const view = node.state.lastView;
    const full = a <= 0 && b >= view.dur;
    node.params.viewA = full ? 0 : a; node.params.viewB = full ? 0 : b;
    redrawBase(node); redrawOverlay(node);
    if (ui) ui.changed && ui.changed();
  }

  function zoomAt(node, t, factor, ui) {
    const v = node.state.lastView, span = Math.max((v.b - v.a) * factor, 1e-3);
    const k = (t - v.a) / (v.b - v.a);
    let a = t - k * span, b = a + span;
    if (a < 0) { b -= a; a = 0; }
    if (b > v.dur) { a = Math.max(0, a - (b - v.dur)); b = v.dur; }
    setView(node, a, b, ui);
  }

  // ---------- Воспроизведение ----------
  function stopPlayback(node) {
    const pb = node.state.playback;
    if (pb) { try { pb.source.onended = null; pb.source.stop(); } catch (e) { /* уже остановлен */ } pb.ctx.close().catch(() => {}); }
    node.state.playback = null;
    node.state.playPos = null;
    if (node.state.ui) { node.state.ui.play.textContent = '▶'; redrawOverlay(node); }
  }

  function startPlayback(node) {
    const Ctx = G.AudioContext || G.webkitAudioContext;
    if (!Ctx) throw new Error(T('Воспроизведение недоступно в этом браузере', 'Playback is not available in this browser'));
    const sig = node.state.sig, view = node.state.lastView;
    const sel = selectionOf(node.params, view.dur) || { a: view.a, b: view.b };
    let data = DSP.slice(sig.samples, Math.floor(sel.a * sig.sampleRate), Math.ceil(sel.b * sig.sampleRate));
    let sr = sig.sampleRate;
    if (sr < 8000 || sr > 96000) { data = DSP.resample(data, sr, 44100); sr = 44100; }
    const ctx = new Ctx();
    const buf = ctx.createBuffer(1, data.length, sr);
    buf.copyToChannel(data, 0);
    const source = ctx.createBufferSource();
    source.buffer = buf; source.loop = !!node.state.loop;
    source.connect(ctx.destination);
    const t0 = ctx.currentTime, len = data.length / sr;
    source.onended = () => { if (!source.loop) stopPlayback(node); };
    node.state.playback = { ctx, source };
    node.state.ui.play.textContent = '■';
    if (node.state.cancel) node.state.cancel.stop = false;
    source.start();
    const tick = () => {
      if (!node.state.playback || node.state.playback.source !== source) return;
      if (node.state.cancel && node.state.cancel.stop) { stopPlayback(node); return; }
      const e = ctx.currentTime - t0;
      node.state.playPos = sel.a + (node.state.loop ? e % len : Math.min(e, len));
      redrawOverlay(node);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---------- Сборка интерфейса ----------
  function buildUi(node, box, ui) {
    box.innerHTML = '';
    const wrap = h('div', 'media-stack');
    const base = h('canvas', 'media-canvas'), over = h('canvas', 'media-canvas media-overlay');
    wrap.append(base, over);
    const hover = h('div', 'muted small media-hover'), selInfo = h('div', 'muted small'), info = h('div', 'muted small'), status = h('div', 'muted small');
    const bar = h('div', 'media-bar');
    const play = button('▶', T('Воспроизвести выделение (или видимую часть)', 'Play the selection (or the visible part)'), () => {
      try {
        if (node.state.playback) stopPlayback(node); else if (node.state.sig) startPlayback(node);
      } catch (e) { ui.toast(e.message); }
    });
    const loopLabel = h('label', 'media-check');
    const loop = h('input'); loop.type = 'checkbox';
    loop.onchange = () => { node.state.loop = loop.checked; if (node.state.playback) { node.state.playback.source.loop = loop.checked; } };
    loopLabel.append(loop, h('span', '', T('цикл', 'loop')));
    const zoom = (f) => () => { if (node.state.lastView) zoomAt(node, (node.state.lastView.a + node.state.lastView.b) / 2, f, ui); };
    bar.append(
      play, loopLabel,
      button('＋', T('Приблизить по времени (колесо мыши)', 'Zoom in (mouse wheel)'), zoom(0.6)),
      button('－', T('Отдалить', 'Zoom out'), zoom(1.6)),
      button('⤢', T('Показать весь файл', 'Show the whole file'), () => { if (node.state.lastView) setView(node, 0, node.state.lastView.dur, ui); }),
      button(T('К выделению', 'To selection'), T('Приблизить до выделения', 'Zoom to the selection'), () => {
        const s = node.state.lastView && selectionOf(node.params, node.state.lastView.dur);
        if (s) setView(node, s.a, s.b, ui);
      }),
      button(T('Снять', 'Clear'), T('Снять выделение', 'Clear the selection'), () => { node.params.selA = 0; node.params.selB = 0; redrawOverlay(node); ui.requestEval(); }),
      button('PNG ↓', T('Скачать картинку спектрограммы', 'Download the spectrogram image'), () => saveFile(node, ui, 'png')),
      button('WAV ↓', T('Скачать выделенный фрагмент', 'Download the selected segment'), () => saveFile(node, ui, 'wav')),
    );
    box.append(status, wrap, hover, bar, selInfo, info);
    node.state.ui = { base, over, hover, selInfo, info, status, play };
    bindMouse(node, ui);
  }

  function saveFile(node, ui, kind) {
    if (!node.state.sig) { ui.toast(T('Сначала подключи аудио', 'Connect audio first')); return; }
    try {
      const p = node.params, sig = node.state.sig;
      const name = ((G.Artifacts.get(G.Artifacts.idOf(node.state.handle)) || {}).name || 'audio').replace(/\.[^.]+$/, '');
      if (kind === 'png') download(IO.rgbaToDataUrl(exportImage(sig, p)), name + '-spectrogram.png');
      else download('data:audio/wav;base64,' + G.Wav.toBase64(G.Wav.encode([exportAudio(sig, p)], sig.sampleRate)), name + '-segment.wav');
    } catch (e) { ui.toast(e.message); }
  }

  function update(node, res, body, ui) {
    const box = body.querySelector('.special');
    if (!node.state.ui || !box.contains(node.state.ui.base)) buildUi(node, box, ui);
    const u = node.state.ui;
    IO.hookPending(node, ui);
    if (res && res.empty) { node.state.sig = null; node.state.lastView = null; node.state.sigKey = null; node.state.drawKey = null; }
    u.status.textContent = res && res.error ? res.error : '';
    u.status.style.color = res && res.error && !/…/.test(res.error) ? 'var(--danger)' : '';
    const hasSignal = node.state.sig && !(res && res.empty);
    u.base.hidden = u.over.hidden = !hasSignal;
    if (!hasSignal) { u.hover.textContent = ''; u.info.textContent = res && res.empty ? T('Подключи артефакт с аудио или видео', 'Connect an audio or video artifact') : ''; u.selInfo.textContent = ''; return; }
    try { redrawBase(node); redrawOverlay(node); } catch (e) { u.status.textContent = e.message; }
  }

  const SIZE_OPTIONS = opts(DSP.FFT_SIZES);

  G.NodeTypes.spectrogram = {
    name: T('Спектрограмма (аудио/видео)', 'Spectrogram (audio/video)'), cat: 'Звук и видео', wide: true, inputs: [T('аудио/видео', 'audio/video')],
    desc: T('Спектрограмма и осциллограмма звука: размер БПФ, окно, перекрытие, диапазон частот и дБ, линейная/лог шкала, палитры, контраст. Тяни мышью — выделение, колесо — зум по времени. Выход — картинка-артефакт (слова в спектрограмме читает OCR) или WAV-фрагмент. Для OldRoot/Endermite: слово рисуют частоты, ищи его при размере БПФ 1024–4096 и логарифмической шкале.',
      'Spectrogram and waveform of the sound: FFT size, window, overlap, frequency and dB range, linear/log scale, colour maps, contrast. Drag to select, wheel to zoom in time. Output is an image artifact (OCR can read words drawn in the spectrogram) or a WAV segment.'),
    params: [
      { key: 'fft', label: T('Размер БПФ', 'FFT size'), type: 'select', options: SIZE_OPTIONS, default: '2048' },
      { key: 'win', label: T('Окно', 'Window'), type: 'select', options: [['hann', 'Hann'], ['hamming', 'Hamming'], ['blackman', 'Blackman']], default: 'hann' },
      { key: 'overlap', label: T('Перекрытие кадров, %', 'Frame overlap, %'), type: 'select', options: [['0', '0'], ['50', '50'], ['75', '75'], ['87.5', '87.5'], ['93.75', '93.75']], default: '75' },
      { key: 'chan', label: T('Канал', 'Channel'), type: 'select', options: G.MediaUI.SELECT_CHANNEL, default: 'mono' },
      { key: 'reverse', label: T('Развернуть звук (reverse)', 'Reverse the audio'), type: 'bool', default: false },
      { key: 'speed', label: T('Скорость (1 = как есть; 0.5 = вдвое медленнее и ниже)', 'Speed (1 = as is; 0.5 = half speed, lower pitch)'), type: 'range', min: 0.1, max: 4, step: 0.05, unit: '×', default: 1 },
      { key: 'fmin', label: T('Мин. частота, Гц', 'Min frequency, Hz'), type: 'number', default: 0 },
      { key: 'fmax', label: T('Макс. частота, Гц (0 = до Найквиста)', 'Max frequency, Hz (0 = Nyquist)'), type: 'number', default: 0 },
      { key: 'scale', label: T('Шкала частот', 'Frequency scale'), type: 'select', options: [['linear', T('Линейная', 'Linear')], ['log', T('Логарифмическая', 'Logarithmic')]], default: 'linear' },
      { key: 'cmap', label: T('Палитра', 'Colour map'), type: 'select', options: CMAPS, default: 'inferno' },
      { key: 'autolevel', label: T('Автоуровни по данным', 'Auto levels from the data'), type: 'bool', default: true },
      { key: 'range', label: T('Динамический диапазон при автоуровнях', 'Dynamic range with auto levels'), type: 'range', min: 10, max: 160, step: 1, unit: T('дБ', 'dB'), default: 80 },
      { key: 'dbmin', label: T('Низ шкалы (если автоуровни выключены)', 'Bottom of scale (auto levels off)'), type: 'range', min: -200, max: 0, step: 1, unit: T('дБ', 'dB'), default: -100 },
      { key: 'dbmax', label: T('Верх шкалы (если автоуровни выключены)', 'Top of scale (auto levels off)'), type: 'range', min: -120, max: 20, step: 1, unit: T('дБ', 'dB'), default: -10 },
      { key: 'gamma', label: T('Контраст (гамма): >1 затемняет слабое, <1 поднимает', 'Contrast (gamma): >1 darkens weak parts, <1 lifts them'), type: 'range', min: 0.1, max: 4, step: 0.05, default: 1 },
      { key: 'showWave', label: T('Показывать осциллограмму', 'Show waveform'), type: 'bool', default: true },
      { key: 'out', label: T('Что отдавать на выход', 'Output'), type: 'select', options: [['image', T('Картинка-артефакт (спектрограмма выделения)', 'Image artifact (spectrogram of the selection)')], ['audio', T('Звук-артефакт (WAV выделения)', 'Audio artifact (WAV of the selection)')]], default: 'image' },
      { key: 'exportH', label: T('Высота экспортной картинки, px', 'Exported image height, px'), type: 'select', options: opts([256, 512, 1024, 2048]), default: '512' },
      { key: 'viewA', label: '', type: 'hidden', default: 0 },
      { key: 'viewB', label: '', type: 'hidden', default: 0 },
      { key: 'selA', label: '', type: 'hidden', default: 0 },
      { key: 'selB', label: '', type: 'hidden', default: 0 },
    ],
    compute,
    update,
  };

  G.SpectrogramNode = { exportImage, exportAudio, selectionOf };
})(typeof self !== 'undefined' ? self : this);
