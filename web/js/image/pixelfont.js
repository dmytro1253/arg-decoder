// Распознавание текста обычного шрифта Minecraft (книги, подсказки предметов, чат) на скриншотах.
// Шрифт растровый и моноширинный для цифр (ячейка 6 «родных» пикселей: 5 глиф + 1 зазор), поэтому текст
// режется на ячейки сеткой, а не по пустым столбцам: курсив (сдвиг верхних строк вправо) склеивает соседние
// глифы, и по зазорам их не разделить. Сдвиг курсива подбирается по всей строке (таблицы shifts).
// Использует вспомогательные функции G.Sga.util и шаблоны G.PixelFontTemplates.
(function (G) {
  'use strict';

  const ROWS = 7;
  const CELL = 6; // ширина глифа 5 + зазор 1
  const GLYPH_W = 5;
  const WORD_BREAK_COLS = 3; // столько пустых столбцов подряд — граница слова
  // Кандидаты сдвига строк (сверху вниз): без курсива и несколько вариантов курсива.
  const SHIFT_TABLES = [[0, 0, 0, 0, 0, 0, 0], [2, 1, 1, 1, 1, 0, 0], [1, 1, 1, 1, 0, 0, 0], [1, 1, 1, 0, 0, 0, 0], [2, 2, 1, 1, 0, 0, 0], [2, 1, 1, 1, 0, 0, 0]];

  function prep(templates) {
    return G.Sga.prepareTemplates(templates).filter((t) => t.w <= GLYPH_W);
  }

  // Растр ячейки: 7 × 5, строка r читается со сдвигом shifts[r] вправо (снимаем курсив).
  function cellBitmap(mask, w, x0, y0, s, sy, k, shifts) {
    const bm = new Uint8Array(ROWS * GLYPH_W);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < GLYPH_W; c++) {
        const nx = x0 + (k * CELL + c + shifts[r]) * s;
        const f = G.Sga.util.fill(mask, w, nx + s * 0.2, nx + s * 0.8, y0 + r * sy + sy * 0.2, y0 + (r + 1) * sy - sy * 0.2);
        bm[r * GLYPH_W + c] = f >= 0.5 ? 1 : 0;
      }
    }
    return bm;
  }

  function bestDigit(bm, templates) {
    let best = null;
    for (const t of templates) {
      const padded = new Uint8Array(ROWS * GLYPH_W);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < t.w; c++) padded[r * GLYPH_W + c] = t.bm[r * t.w + c];
      let d = 0;
      for (let i = 0; i < padded.length; i++) if (padded[i] !== bm[i]) d++;
      if (!best || d < best.dist) best = { t, dist: d };
    }
    return best;
  }

  function readWord(mask, w, wordX0, wordX1, band, s, sy, templates, shifts) {
    const n = Math.max(1, Math.round((wordX1 - wordX0) / s / CELL));
    const out = [];
    let total = 0;
    for (let k = 0; k < n; k++) {
      const bm = cellBitmap(mask, w, wordX0, band[0], s, sy, k, shifts);
      const on = bm.reduce((a, b) => a + b, 0);
      const m = on ? bestDigit(bm, templates) : null;
      const tol = m ? Math.max(2, Math.round(m.t.on * 0.18)) : 0;
      const known = !!m && m.dist <= tol;
      total += known ? m.dist : 6;
      out.push({ k, ch: known ? m.t.ch : '?', known, dist: m ? m.dist : null, conf: known ? Math.max(0, 1 - m.dist / Math.max(1, m.t.on)) : 0, verified: known ? !!m.t.verified : false });
    }
    return { cells: out, total };
  }

  /**
   * Читает цифры (и другие глифы шаблонов шириной ≤ 5) обычного шрифта Minecraft.
   * opts: { threshold, scale (0 = авто), templates }. Возвращает ту же структуру, что Sga.recognize.
   */
  function recognize(img, opts) {
    const o = Object.assign({ threshold: null, scale: 0 }, opts || {});
    const templates = prep(o.templates || (G.PixelFontTemplates && G.PixelFontTemplates.templates) || []);
    const { width: w, height: h } = G.ImgProc.check(img);
    const mask = G.Sga.inkMask(img, o.threshold);
    const U = G.Sga.util;
    let bands = U.rowBands(mask, w, h);
    if (!bands.length) return { text: '', lines: [], glyphs: [], scale: 0, unknown: 0 };
    const s = G.Sga.estimateScale(bands, o);
    bands = bands.filter((b) => b[1] - b[0] >= s * 1.5 && b[1] - b[0] <= s * (ROWS + 1.5));
    const lines = [], glyphs = [];
    let unknown = 0;
    bands.forEach((band, li) => {
      const bh = band[1] - band[0];
      const sy = Math.abs(bh / ROWS - s) <= s * 0.15 ? bh / ROWS : s;
      const colOn = new Uint8Array(w);
      for (let x = 0; x < w; x++) { for (let y = band[0]; y < band[1]; y++) if (mask[y * w + x]) { colOn[x] = 1; break; } }
      const words = [];
      for (const r of U.runs(colOn)) {
        const last = words[words.length - 1];
        if (last && r[0] - last[1] < WORD_BREAK_COLS * s) last[1] = r[1]; else words.push([r[0], r[1]]);
      }
      // Таблицу сдвига выбираем общую для всей строки: минимум суммарного расстояния.
      let best = null;
      for (const shifts of SHIFT_TABLES) {
        const res = words.map(([x0, x1]) => ({ x0, x1, read: readWord(mask, w, x0, x1, band, s, sy, templates, shifts) }));
        const total = res.reduce((a, r) => a + r.read.total, 0);
        if (!best || total < best.total) best = { total, res, shifts };
      }
      const italic = best.shifts.some((v) => v > 0);
      const text = best.res.map((r) => r.read.cells.map((c) => c.ch).join('')).join(' ');
      for (const r of best.res) {
        for (const c of r.read.cells) {
          if (!c.known) unknown++;
          glyphs.push({ line: li, x: r.x0 + c.k * CELL * s, y: band[0], w: GLYPH_W * s, h: bh, ch: c.ch, conf: c.conf, known: c.known, verified: c.verified, dist: c.dist, italic });
        }
      }
      lines.push(text);
    });
    return { text: lines.join('\n'), lines, glyphs, scale: s, unknown };
  }

  G.PixelFont = { recognize, SHIFT_TABLES };
})(typeof self !== 'undefined' ? self : this);
