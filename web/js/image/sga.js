// Распознавание текста «Стандартного галактического алфавита» (SGA, стол зачарований Minecraft) на картинке.
// Чистый код над {width,height,data}: бинаризация по цвету, строки, перевод в сетку «родных» пикселей
// шрифта (7 строк), группировка столбцов в атомы, динамическое программирование по шаблонам
// (G.SgaTemplates) — составные глифы (ʖ ꖌ ∷ ∴ !¡ ...) подбираются целиком.
// Результат — латинские буквы клавиш: SGA кодирует латиницу как есть. Если автор набирал русский текст в
// раскладке ЙЦУКЕН, то получится «gmt cf» вместо «пьеса» (см. ruLayout).
(function (G) {
  'use strict';

  const ROWS = 7;

  const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

  // ---------- бинаризация ----------
  /** Маска «чернил»: Отсу по яркости, чернила — меньший по площади класс. Возвращает Uint8Array w*h. */
  function inkMask(img, threshold) {
    const P = G.ImgProc;
    const t = threshold === undefined || threshold === null ? P.otsu(img) : Number(threshold);
    const { width: w, height: h, data: d } = img;
    const bright = new Uint8Array(w * h);
    let nb = 0;
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      if (P.luma(d[i], d[i + 1], d[i + 2]) > t) { bright[p] = 1; nb++; }
    }
    if (nb * 2 <= w * h) return bright;
    return bright.map((v) => 1 - v);
  }

  function runs(flags) {
    const out = [];
    let s = -1;
    for (let i = 0; i <= flags.length; i++) {
      const on = i < flags.length && flags[i];
      if (on && s < 0) s = i;
      if (!on && s >= 0) { out.push([s, i]); s = -1; }
    }
    return out;
  }

  function rowBands(mask, w, h) {
    const proj = new Uint8Array(h);
    for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) if (mask[y * w + x]) { proj[y] = 1; break; } }
    return runs(proj);
  }

  // Доля чернил в клетке [x0,x1) × [y0,y1).
  function fill(mask, w, x0, x1, y0, y1) {
    let on = 0, n = 0;
    const xa = Math.max(0, Math.floor(x0)), xb = Math.max(xa + 1, Math.ceil(x1));
    const ya = Math.max(0, Math.floor(y0)), yb = Math.max(ya + 1, Math.ceil(y1));
    for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) { on += mask[y * w + x]; n++; }
    return n ? on / n : 0;
  }

  // ---------- атомы строки ----------
  function lineAtoms(mask, w, band, s, sy) {
    const [y0, y1] = band;
    const colOn = new Uint8Array(w);
    for (let x = 0; x < w; x++) { for (let y = y0; y < y1; y++) if (mask[y * w + x]) { colOn[x] = 1; break; } }
    const merged = [];
    for (const r of runs(colOn)) {
      const last = merged[merged.length - 1];
      if (last && r[0] - last[1] < 0.5 * s) last[1] = r[1]; else merged.push([r[0], r[1]]);
    }
    const atoms = [];
    let prevEnd = null;
    for (const [x0, x1] of merged) {
      const wn = Math.max(1, Math.round((x1 - x0) / s));
      const cw = (x1 - x0) / wn;
      const bm = new Uint8Array(ROWS * wn);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < wn; c++) {
          const f = fill(mask, w, x0 + c * cw + cw * 0.2, x0 + (c + 1) * cw - cw * 0.2, y0 + r * sy + sy * 0.2, y0 + (r + 1) * sy - sy * 0.2);
          bm[r * wn + c] = f >= 0.5 ? 1 : 0;
        }
      }
      atoms.push({ x0, x1, y0, y1, w: wn, bm, gap: prevEnd === null ? null : Math.round((x0 - prevEnd) / s) });
      prevEnd = x1;
    }
    return atoms;
  }

  // Курсив Minecraft: верхние строки сдвинуты вправо (в «родных» пикселях сверху вниз). Для распознавания
  // сдвигаем строки полосы обратно влево.
  const ITALIC_SHIFT = [2, 1, 1, 1, 1, 0, 0];

  function unshear(mask, w, h, band, s, sy, table) {
    const shifts = table || ITALIC_SHIFT;
    const out = mask.slice();
    for (let y = band[0]; y < band[1]; y++) {
      const r = Math.min(ROWS - 1, Math.floor((y - band[0]) / sy));
      const dx = Math.round(shifts[r] * s);
      if (!dx) continue;
      for (let x = 0; x < w; x++) out[y * w + x] = x + dx < w ? mask[y * w + x + dx] : 0;
    }
    return out;
  }

  // ---------- шаблоны ----------
  function prepareTemplates(list) {
    return list.map((t) => {
      const w = Math.max(...t.rows.map((r) => r.length));
      const bm = new Uint8Array(ROWS * w);
      let on = 0;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < w; c++) { const v = t.rows[r][c] === '#' ? 1 : 0; bm[r * w + c] = v; on += v; }
      return Object.assign({}, t, { w, bm, on });
    });
  }

  // Склеивает атомы i..j-1 в один растр (внутренние промежутки остаются пустыми столбцами).
  function compose(atoms, i, j) {
    let w = atoms[i].w;
    for (let k = i + 1; k < j; k++) w += atoms[k].gap + atoms[k].w;
    const bm = new Uint8Array(ROWS * w);
    let x = 0;
    for (let k = i; k < j; k++) {
      if (k > i) x += atoms[k].gap;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < atoms[k].w; c++) if (atoms[k].bm[r * atoms[k].w + c]) bm[r * w + x + c] = 1;
      x += atoms[k].w;
    }
    return { w, bm };
  }

  function hamming(a, b) { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; }

  const MAX_PARTS = 4;
  const MAX_INNER_GAP = 3;
  const UNKNOWN_COST = 4;

  // Лучший шаблон для растра: { t, dist } или null (допуск — 1 пиксель или 12% «чернил»).
  function bestTemplate(comp, templates) {
    let best = null;
    for (const t of templates) {
      if (t.w !== comp.w) continue;
      const dist = hamming(comp.bm, t.bm);
      const tol = Math.max(1, Math.round(t.on * 0.12));
      if (dist <= tol && (!best || dist < best.dist || (dist === best.dist && t.verified && !best.t.verified))) best = { t, dist };
    }
    return best;
  }

  /** Разбиение атомов строки на глифы динамическим программированием. */
  function segment(atoms, templates) {
    const n = atoms.length;
    const cost = new Array(n + 1).fill(Infinity);
    const back = new Array(n + 1).fill(null);
    cost[0] = 0;
    for (let i = 0; i < n; i++) {
      if (cost[i] === Infinity) continue;
      let ok = true;
      for (let j = i + 1; j <= Math.min(n, i + MAX_PARTS) && ok; j++) {
        if (j > i + 1 && atoms[j - 1].gap > MAX_INNER_GAP) ok = false;
        if (!ok) break;
        const comp = compose(atoms, i, j);
        const m = bestTemplate(comp, templates);
        if (m) {
          const c = cost[i] + m.dist + 0.01;
          if (c < cost[j]) { cost[j] = c; back[j] = { i, match: m, comp }; }
        }
      }
      // Неизвестный глиф: один атом (или атомы с промежутком 1).
      let j = i + 1;
      while (j < n && atoms[j].gap <= 1 && j - i < MAX_PARTS) j++;
      for (const jj of j > i + 1 ? [i + 1, j] : [i + 1]) {
        const c = cost[i] + UNKNOWN_COST;
        if (c < cost[jj]) { cost[jj] = c; back[jj] = { i, match: null, comp: compose(atoms, i, jj) }; }
      }
    }
    const out = [];
    for (let j = n; j > 0; j = back[j].i) out.unshift({ from: back[j].i, to: j, match: back[j].match, comp: back[j].comp });
    return out;
  }

  // ---------- оценка масштаба ----------
  function estimateScale(bands, opts) {
    if (opts.scale > 0) return opts.scale;
    const heights = bands.map((b) => b[1] - b[0]);
    const tall = Math.max(...heights);
    const good = heights.filter((h) => h >= tall * 0.6);
    return median(good) / ROWS;
  }

  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  /**
   * Распознаёт SGA на картинке. opts: { threshold, scale (пикселей на «родной» пиксель, 0 = авто),
   * wordGap, templates, italic (false | true | не задано = пробовать курсив при неопознанных глифах) }. Возвращает { text, lines: [строка], glyphs: [{line,x,y,w,h,ch,conf,known,verified}],
   * scale, unknown }. Непонятные глифы в тексте — «?».
   */
  function recognize(img, opts) {
    const o = Object.assign({ threshold: null, scale: 0 }, opts || {});
    const data = G.SgaTemplates || { templates: [], wordGap: 4 };
    const templates = prepareTemplates(o.templates || data.templates);
    const wordGap = o.wordGap || data.wordGap || 4;
    const { width: w, height: h } = G.ImgProc.check(img);
    const mask = inkMask(img, o.threshold);
    let bands = rowBands(mask, w, h);
    if (!bands.length) return { text: '', lines: [], glyphs: [], scale: 0, unknown: 0 };
    const s = estimateScale(bands, o);
    bands = bands.filter((b) => b[1] - b[0] >= s * 1.5 && b[1] - b[0] <= s * (ROWS + 1.5));
    const glyphs = [];
    const lines = [];
    let unknown = 0;
    bands.forEach((band, li) => {
      const bh = band[1] - band[0];
      const sy = Math.abs(bh / ROWS - s) <= s * 0.15 ? bh / ROWS : s;
      const tryBand = (m) => {
        const atoms = lineAtoms(m, w, band, s, sy);
        return { atoms, segs: atoms.length ? segment(atoms, templates) : [] };
      };
      let a = tryBand(mask);
      let italic = false;
      const unk = (r) => r.segs.filter((g) => !g.match).length;
      if (o.italic !== false && (o.italic === true || unk(a) > 0)) {
        const b = tryBand(unshear(mask, w, h, band, s, sy, o.italicShift));
        if (o.italic === true || unk(b) < unk(a)) { a = b; italic = true; }
      }
      const { atoms, segs } = a;
      if (!atoms.length) return;
      let text = '';
      for (const g of segs) {
        const first = atoms[g.from], last = atoms[g.to - 1];
        const lead = g.match ? g.match.t.lead : 0;
        if (glyphs.some((q) => q.line === li) && first.gap - lead >= wordGap) text += ' ';
        const known = !!g.match;
        const on = g.comp.bm.reduce((x, y) => x + y, 0);
        const conf = known ? clamp01(1 - g.match.dist / Math.max(1, on)) : 0;
        if (!known) unknown++;
        text += known ? g.match.t.ch : '?';
        glyphs.push({ line: li, x: first.x0, y: band[0], w: last.x1 - first.x0, h: bh, ch: known ? g.match.t.ch : '?', conf, known, verified: known ? !!g.match.t.verified : false, dist: known ? g.match.dist : null, italic });
      }
      lines.push(text);
    });
    return { text: lines.join('\n'), lines, glyphs, scale: s, unknown };
  }

  // ---------- раскладка ЙЦУКЕН ----------
  const RU_LOWER = { q: 'й', w: 'ц', e: 'у', r: 'к', t: 'е', y: 'н', u: 'г', i: 'ш', o: 'щ', p: 'з', '[': 'х', ']': 'ъ', a: 'ф', s: 'ы', d: 'в', f: 'а', g: 'п', h: 'р', j: 'о', k: 'л', l: 'д', ';': 'ж', "'": 'э', z: 'я', x: 'ч', c: 'с', v: 'м', b: 'и', n: 'т', m: 'ь', ',': 'б', '.': 'ю', '`': 'ё' }; // i18n-ok: данные

  /** Латиница, набранная в русской раскладке → кириллица (Q→Й, ,→Б, ;→Ж, `→Ё). Остальное без изменений. */
  function ruLayout(text) {
    return Array.from(String(text)).map((ch) => {
      const low = ch.toLowerCase();
      const m = RU_LOWER[low];
      if (!m) return ch;
      return ch !== low ? m.toUpperCase() : m;
    }).join('');
  }

  /** Атомы по строкам (для отладки и построения шаблонов): [{ atoms: [{w, bm, gap}], band }], масштаб. */
  function atomsOf(img, opts) {
    const o = Object.assign({ threshold: null, scale: 0 }, opts || {});
    const { width: w, height: h } = G.ImgProc.check(img);
    const mask = inkMask(img, o.threshold);
    const bands0 = rowBands(mask, w, h);
    if (!bands0.length) return { lines: [], scale: 0 };
    const s = estimateScale(bands0, o);
    const bands = bands0.filter((b) => b[1] - b[0] >= s * 1.5 && b[1] - b[0] <= s * (ROWS + 1.5));
    return { scale: s, lines: bands.map((band) => { const sy = (band[1] - band[0]) / ROWS; return { band, atoms: lineAtoms(o.italic ? unshear(mask, w, h, band, s, sy, o.italicShift) : mask, w, band, s, sy) }; }) };
  }

  G.Sga = { util: { runs, rowBands, fill }, atomsOf, recognize, inkMask, estimateScale, prepareTemplates, segment, ruLayout };
})(typeof self !== 'undefined' ? self : this);
