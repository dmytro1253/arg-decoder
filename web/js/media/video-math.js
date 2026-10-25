// Чистая арифметика кадров видео: номер кадра ↔ время, выбор кадров контактного листа, раскладка плиток.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const MAX_SHEET_FRAMES = 120;

  function checkFps(fps) {
    if (!(fps > 0 && fps <= 1000)) throw new Error(T('Частота кадров должна быть от 0 до 1000', 'Frame rate must be between 0 and 1000'));
    return fps;
  }

  /** Время середины кадра: так seek гарантированно попадает именно в этот кадр, а не в соседний. */
  const frameToTime = (frame, fps) => (Math.max(0, frame) + 0.5) / checkFps(fps);
  const timeToFrame = (t, fps) => Math.max(0, Math.floor(t * checkFps(fps) + 1e-6));
  const frameCount = (duration, fps) => Math.max(1, Math.floor(duration * checkFps(fps) + 1e-6));

  /** Номера кадров для контактного листа: от start до end включительно с шагом every. */
  function sheetFrames(start, end, every, max) {
    const step = Math.floor(every);
    if (!(step >= 1)) throw new Error(T('Шаг кадров должен быть не меньше 1', 'Frame step must be at least 1'));
    const limit = Math.min(max || MAX_SHEET_FRAMES, MAX_SHEET_FRAMES);
    const out = [];
    for (let f = Math.max(0, Math.floor(start)); f <= end && out.length < limit; f += step) out.push(f);
    if (!out.length) throw new Error(T('В выбранном диапазоне нет кадров', 'No frames in the chosen range'));
    return out;
  }

  /** Сетка плиток: n кадров в cols столбцов, плитка thumbW × thumbH + строка подписи. */
  function sheetLayout(n, cols, thumbW, thumbH, labelH) {
    const c = Math.max(1, Math.min(n, Math.floor(cols) || 1));
    const rows = Math.ceil(n / c), cellH = thumbH + labelH;
    return {
      cols: c, rows, cellW: thumbW, cellH, width: c * thumbW, height: rows * cellH,
      at: (i) => ({ x: (i % c) * thumbW, y: Math.floor(i / c) * cellH }),
    };
  }

  G.VideoMath = { MAX_SHEET_FRAMES, frameToTime, timeToFrame, frameCount, sheetFrames, sheetLayout };
})(typeof self !== 'undefined' ? self : this);
