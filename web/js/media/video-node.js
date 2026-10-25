// Нода «Видео по кадрам»: точный шаг ±1 кадр, время/номер кадра, извлечение кадра, контактный лист,
// извлечение звуковой дорожки. Результаты — производные артефакты (картинка/аудио), выход ноды — последний из них.
(function (G) {
  'use strict';
  const T = G.T;
  const { h, button } = G.MediaUI;
  const VM = G.VideoMath, IO = G.AudioIO;
  const num = (v, d) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
  const FPS_PRESETS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
  const LABEL_H = 14;

  function blobUrl(art) {
    const A = G.Artifacts, key = 'blob:' + art.id;
    let url = A.runtimeGet(key);
    if (!url) {
      const bytes = A.bytes(art.id);
      if (!bytes) throw new Error(T('У файла нет данных', 'File has no data'));
      url = URL.createObjectURL(new Blob([bytes], { type: art.mime || 'video/mp4' }));
      A.runtimeSet(key, url);
    }
    return url;
  }

  const seeked = (video) => new Promise((resolve, reject) => {
    const ok = () => { video.removeEventListener('error', bad); resolve(); };
    const bad = () => { video.removeEventListener('seeked', ok); reject(new Error(T('Не удалось перемотать видео', 'Could not seek the video'))); };
    video.addEventListener('seeked', ok, { once: true });
    video.addEventListener('error', bad, { once: true });
  });

  async function seekFrame(video, frame, fps) {
    const t = Math.min(VM.frameToTime(frame, fps), Math.max(0, (video.duration || 0) - 1e-3));
    if (Math.abs(video.currentTime - t) < 1e-4) return;
    const done = seeked(video);
    video.currentTime = t;
    await done;
  }

  function grab(video, w, h2) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h2;
    c.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0, w, h2);
    return c;
  }

  const toRgba = (c) => ({ width: c.width, height: c.height, data: c.getContext('2d').getImageData(0, 0, c.width, c.height).data });

  // ---------- действия ----------
  async function extractFrame(node, ui, video) {
    const frame = VM.timeToFrame(video.currentTime, num(node.params.fps, 30));
    const art = node.state.art;
    const handle = IO.putImage('vf_' + art.id + '_' + frame, toRgba(grab(video, video.videoWidth, video.videoHeight)), art.name + ' #' + frame + '.png');
    publish(node, ui, handle, T('Кадр ', 'Frame ') + frame + T(' сохранён как картинка-артефакт', ' saved as an image artifact'));
  }

  async function makeSheet(node, ui) {
    const p = node.params, art = node.state.art, fps = num(p.fps, 30);
    const probe = document.createElement('video');
    probe.muted = true; probe.preload = 'auto'; probe.src = blobUrl(art);
    await new Promise((res, rej) => { probe.onloadeddata = res; probe.onerror = () => rej(new Error(T('Видео не открывается', 'The video cannot be opened'))); });
    const last = VM.frameCount(probe.duration, fps) - 1;
    const end = num(p.sheetEnd, 0) > 0 ? Math.min(last, num(p.sheetEnd, 0)) : last;
    const frames = VM.sheetFrames(num(p.sheetStart, 0), end, num(p.sheetEvery, 30), num(p.sheetMax, 48));
    const tw = Math.max(32, Math.round(num(p.thumbW, 160))), th = Math.round(tw * probe.videoHeight / probe.videoWidth);
    const lay = VM.sheetLayout(frames.length, num(p.sheetCols, 6), tw, th, LABEL_H);
    const sheet = document.createElement('canvas');
    sheet.width = lay.width; sheet.height = lay.height;
    const ctx = sheet.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, sheet.width, sheet.height);
    ctx.font = '11px sans-serif'; ctx.textBaseline = 'middle';
    for (let i = 0; i < frames.length; i++) {
      await seekFrame(probe, frames[i], fps);
      const pos = lay.at(i);
      ctx.drawImage(probe, pos.x, pos.y, tw, th);
      ctx.fillStyle = '#fff';
      ctx.fillText('#' + frames[i] + ' · ' + (frames[i] / fps).toFixed(2) + 's', pos.x + 3, pos.y + th + LABEL_H / 2);
      node.state.ui.status.textContent = T('Контактный лист: ', 'Contact sheet: ') + (i + 1) + '/' + frames.length;
    }
    const tag = 'vs_' + art.id + '_' + frames[0] + '_' + frames.length + '_' + num(p.sheetEvery, 30) + '_' + tw;
    publish(node, ui, IO.putImage(tag, toRgba(sheet), art.name + ' (' + T('лист', 'sheet') + ').png'), T('Контактный лист готов: ', 'Contact sheet ready: ') + frames.length + T(' кадров', ' frames'));
  }

  async function extractAudio(node, ui) {
    const art = node.state.art;
    node.state.ui.status.textContent = T('Декодирую звуковую дорожку…', 'Decoding the audio track…');
    const pcm = await IO.load(G.Artifacts.handle(art.id));
    publish(node, ui, IO.putAudio('va_' + art.id, pcm.channels, pcm.sampleRate, art.name + ' (' + T('звук', 'audio') + ').wav'), T('Звуковая дорожка извлечена', 'Audio track extracted'));
  }

  function publish(node, ui, handle, message) {
    node.params.last = handle;
    if (G.Artifacts.keep) G.Artifacts.keep(handle);   // результат кнопки — улика: переживает сохранение проекта
    node.state.ui.status.textContent = message;
    ui.requestEval();
  }

  function guard(node, ui, fn) {
    return async () => {
      try { await fn(); } catch (e) { node.state.ui.status.textContent = e.message; ui.toast(e.message); }
    };
  }

  // ---------- интерфейс ----------
  function buildUi(node, box, ui) {
    box.innerHTML = '';
    const video = h('video', 'art-preview media-video');
    video.controls = false; video.muted = false; video.preload = 'auto';
    const readout = h('div', 'media-readout'), status = h('div', 'muted small');
    const fpsOf = () => num(node.params.fps, 30);
    const refresh = () => {
      const fr = VM.timeToFrame(video.currentTime, fpsOf());
      readout.textContent = T('Кадр ', 'Frame ') + fr + ' / ' + (isFinite(video.duration) ? VM.frameCount(video.duration, fpsOf()) - 1 : '?') + ' · ' + video.currentTime.toFixed(3) + ' s · ' + (video.videoWidth || '?') + '×' + (video.videoHeight || '?');
    };
    const goto = (frame) => guard(node, ui, async () => {
      video.pause();
      const maxF = isFinite(video.duration) ? VM.frameCount(video.duration, fpsOf()) - 1 : frame;
      await seekFrame(video, Math.max(0, Math.min(maxF, frame)), fpsOf());
      refresh();
    })();
    const cur = () => VM.timeToFrame(video.currentTime, fpsOf());
    const stepBtn = (label, d, title) => button(label, title, () => goto(cur() + d));
    const play = button('▶', T('Играть / пауза', 'Play / pause'), () => { if (video.paused) video.play(); else video.pause(); });
    const rate = h('select');
    for (const r of [0.1, 0.25, 0.5, 1, 2]) { const o = h('option', '', '×' + r); o.value = r; rate.appendChild(o); }
    rate.value = '1';
    rate.onchange = () => { video.playbackRate = Number(rate.value); };
    const jump = h('input'); jump.type = 'number'; jump.min = 0; jump.placeholder = T('кадр', 'frame'); jump.style.width = '70px';
    jump.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') goto(Number(jump.value) || 0); };
    const bar = h('div', 'media-bar');
    bar.append(stepBtn('⏮10', -10, T('На 10 кадров назад', '10 frames back')), stepBtn('◀1', -1, T('Кадр назад', 'One frame back')), play,
      stepBtn('1▶', 1, T('Кадр вперёд', 'One frame forward')), stepBtn('10⏭', 10, T('На 10 кадров вперёд', '10 frames forward')), rate, jump);
    const bar2 = h('div', 'media-bar');
    bar2.append(
      button(T('Кадр → картинка', 'Frame → image'), T('Сохранить текущий кадр как картинку-артефакт', 'Save the current frame as an image artifact'), guard(node, ui, () => extractFrame(node, ui, video))),
      button(T('Контактный лист', 'Contact sheet'), T('Кадры через N штук одной картинкой с номерами кадров', 'Every N-th frame as one image with frame numbers'), guard(node, ui, () => makeSheet(node, ui))),
      button(T('Звук → артефакт', 'Audio → artifact'), T('Извлечь звуковую дорожку для спектрограммы', 'Extract the audio track for the spectrogram'), guard(node, ui, () => extractAudio(node, ui))),
    );
    ['seeked', 'timeupdate', 'loadedmetadata'].forEach((ev) => video.addEventListener(ev, refresh));
    if (video.requestVideoFrameCallback) {
      const loop = () => { refresh(); video.requestVideoFrameCallback(loop); };
      video.requestVideoFrameCallback(loop);
    }
    box.append(video, readout, bar, bar2, status);
    node.state.ui = { video, readout, status, refresh };
  }

  G.NodeTypes.video_frames = {
    name: T('Видео по кадрам', 'Video frame stepper'), cat: 'Звук и видео', wide: true, inputs: [T('видео', 'video')],
    desc: T('Локальное видео: шаг ±1 кадр, время и номер кадра, «кадр → картинка», контактный лист (каждый N-й кадр с подписями), «звук → артефакт» для спектрограммы. Частоту кадров браузер не сообщает — задай её в параметре fps. Выход — последний созданный артефакт.',
      'Local video: ±1 frame stepping, time and frame number, "frame → image", contact sheet (every N-th frame with labels), "audio → artifact" for the spectrogram. The browser does not report the frame rate, so set fps. Output is the last artifact created.'),
    params: [
      { key: 'fps', label: T('Кадров в секунду (' + FPS_PRESETS.join(', ') + ')', 'Frames per second (' + FPS_PRESETS.join(', ') + ')'), type: 'number', default: 30 },
      { key: 'sheetEvery', label: T('Лист: каждый N-й кадр', 'Sheet: every N-th frame'), type: 'number', default: 30 },
      { key: 'sheetStart', label: T('Лист: с кадра', 'Sheet: from frame'), type: 'number', default: 0 },
      { key: 'sheetEnd', label: T('Лист: по кадр (0 = до конца)', 'Sheet: to frame (0 = end)'), type: 'number', default: 0 },
      { key: 'sheetMax', label: T('Лист: максимум кадров (до ' + VM.MAX_SHEET_FRAMES + ')', 'Sheet: max frames (up to ' + VM.MAX_SHEET_FRAMES + ')'), type: 'number', default: 48 },
      { key: 'sheetCols', label: T('Лист: столбцов', 'Sheet: columns'), type: 'number', default: 6 },
      { key: 'thumbW', label: T('Лист: ширина плитки, px', 'Sheet: tile width, px'), type: 'number', default: 160 },
      { key: 'last', label: '', type: 'hidden', default: '' },
    ],
    compute([handle], p, node) {
      const art = G.Artifacts.require(handle, 'video');
      node.state.art = art;
      VM.frameToTime(0, num(p.fps, 30));
      if (!p.last || !G.Artifacts.has(G.Artifacts.idOf(p.last))) throw new Error(T('Нажми «Кадр → картинка», «Контактный лист» или «Звук → артефакт»', 'Press "Frame → image", "Contact sheet" or "Audio → artifact"'));
      return p.last;
    },
    update(node, res, body, ui) {
      const box = body.querySelector('.special');
      if (!node.state.ui || !box.contains(node.state.ui.video)) buildUi(node, box, ui);
      const u = node.state.ui, art = node.state.art;
      if (res && res.empty) { u.video.removeAttribute('src'); node.state.src = null; u.status.textContent = T('Подключи артефакт-видео', 'Connect a video artifact'); return; }
      if (art && node.state.src !== art.id) {
        try { u.video.src = blobUrl(art); node.state.src = art.id; u.video.load(); } catch (e) { u.status.textContent = e.message; return; }
      }
      if (res && res.error && !u.status.textContent) u.status.textContent = res.error;
      u.refresh();
    },
  };
})(typeof self !== 'undefined' ? self : this);
