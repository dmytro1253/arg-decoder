// QR и штрих-коды: jsQR (web/vendor/jsqr) для QR, системный BarcodeDetector — для остальных форматов,
// если браузер его даёт. Перебирает варианты предобработки (инверсия, увеличение, контраст),
// потому что реальные QR на скриншотах бывают тёмными, мелкими и бледными.
(function (G) {
  'use strict';

  const T = G.T || ((ru) => ru);

  function toDecoderInput(img) { return { data: img.data instanceof Uint8ClampedArray ? img.data : new Uint8ClampedArray(img.data), width: img.width, height: img.height }; }

  /** Варианты картинки для перебора: исходная, инвертированная, с автоуровнями, увеличенная/уменьшенная. */
  function variants(img) {
    const P = G.ImgProc;
    const list = [['original', img]];
    list.push(['autolevels', P.autoLevels(img, 0.5, false)]);
    list.push(['inverted', P.invert(img)]);
    const side = Math.max(img.width, img.height);
    if (side < 700) list.push(['upscaled', P.scaleNearest(img, Math.min(4, Math.ceil(900 / side)))]);
    if (side > 1600) list.push(['downscaled', P.scaleNearest(img, 0.5)]);
    list.push(['threshold', P.threshold(img, null)]);
    return list;
  }

  /** Декодирует QR синхронно через jsQR. Возвращает { text, format, points, variant } или null. */
  function decodeQr(img) {
    if (typeof G.jsQR !== 'function') throw new Error(T('jsQR не загружен (web/vendor/jsqr/jsQR.js)', 'jsQR is not loaded (web/vendor/jsqr/jsQR.js)'));
    G.ImgProc.check(img);
    for (const [name, v] of variants(img)) {
      const r = G.jsQR(v.data, v.width, v.height, { inversionAttempts: 'attemptBoth' });
      if (r && r.data !== undefined) {
        const k = img.width / v.width;
        const c = r.location;
        const pts = [c.topLeftCorner, c.topRightCorner, c.bottomRightCorner, c.bottomLeftCorner].map((p) => ({ x: p.x * k, y: p.y * k }));
        return { text: r.data, format: 'qr_code', points: pts, variant: name };
      }
    }
    // Обычные варианты не прочитались — пробуем восстановить служебные узоры (результат помечается).
    return G.ArgFiles && G.ArgFiles.BitImage ? repairQr(img) : null;
  }

  // ---------- восстановление: стёртые или затемнённые ориентиры ----------
  const REPAIR_SIZES = [21, 25, 29, 33, 37, 41];
  const REPAIR_MARGINS = [0, 1, 2, 4];       // поле вокруг кода в модулях
  const REPAIR_THRESHOLDS = [null, 64, 96, 128, 160];

  /** Рисует стандартный ориентир 7×7 с белой рамкой в углу сетки. */
  function finder(grid, r0, c0) {
    const n = grid.length;
    for (let r = -1; r <= 7; r++) for (let q = -1; q <= 7; q++) {
      const R = r0 + r, C = c0 + q;
      if (R < 0 || C < 0 || R >= n || C >= n) continue;
      const ring = Math.max(Math.abs(r - 3), Math.abs(q - 3));
      grid[R][C] = r < 0 || q < 0 || r > 6 || q > 6 ? 0 : ring === 2 ? 0 : 1;
    }
  }

  /**
   * Код, у которого ориентиры стёрты или залиты (в ARG так прячут QR): картинка делится на сетку N×N, клетки
   * читаются по центру, три ориентира и линии синхронизации дорисовываются по стандарту, затем снова jsQR.
   * Данные кода не меняются — только служебные узоры. Возвращает находку с пометкой repaired или null.
   */
  function repairQr(img) {
    const P = G.ImgProc;
    const gray = P.equalize(P.grayscale(img));
    const W = gray.width, H = gray.height, side = Math.min(W, H);
    for (const N of REPAIR_SIZES) for (const m of REPAIR_MARGINS) {
      const cell = side / (N + 2 * m);
      if (cell < 2) continue;
      for (const level of REPAIR_THRESHOLDS) {
        const thr = level === null ? P.otsu(gray) : level;
        for (const inv of [false, true]) {
          const grid = [];
          for (let r = 0; r < N; r++) {
            const row = [];
            for (let q = 0; q < N; q++) {
              const x = Math.floor((m + q + 0.5) * cell), y = Math.floor((m + r + 0.5) * cell);
              row.push((gray.data[(y * W + x) * 4] < thr) !== inv ? 1 : 0);
            }
            grid.push(row);
          }
          finder(grid, 0, 0); finder(grid, 0, N - 7); finder(grid, N - 7, 0);
          for (let k = 8; k < N - 8; k++) { grid[6][k] = k % 2 ? 0 : 1; grid[k][6] = k % 2 ? 0 : 1; }
          const px = G.ArgFiles.BitImage.gridPixels(grid, { scale: 6, margin: 4, invert: false });
          const r = G.jsQR(px.data, px.width, px.height);
          if (r && r.data) {
            return { text: r.data, format: 'qr_code', points: [{ x: m * cell, y: m * cell }, { x: (m + N) * cell, y: m * cell }, { x: (m + N) * cell, y: (m + N) * cell }, { x: m * cell, y: (m + N) * cell }],
              variant: T('восстановлен: дорисованы ориентиры, сетка ', 'repaired: finder patterns redrawn, grid ') + N + '×' + N, repaired: true };
          }
        }
      }
    }
    return null;
  }

  /** Другие форматы (EAN, Code128 ...) через BarcodeDetector, если он есть. Возвращает массив находок. */
  async function decodeBarcodes(img) {
    if (typeof G.BarcodeDetector !== 'function' || !G.document) return [];
    try {
      const canvas = G.document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
      const found = await new G.BarcodeDetector().detect(canvas);
      return found.map((f) => ({ text: f.rawValue, format: f.format, points: (f.cornerPoints || []).map((p) => ({ x: p.x, y: p.y })), variant: 'BarcodeDetector' }));
    } catch (e) {
      return [];
    }
  }

  /** Полный разбор: QR через jsQR, затем остальные форматы. Возвращает массив находок (возможно пустой). */
  async function scan(img) {
    const out = [];
    const qr = decodeQr(img);
    if (qr) out.push(qr);
    for (const b of await decodeBarcodes(img)) if (!out.some((o) => o.text === b.text)) out.push(b);
    return out;
  }

  G.Qr = { decodeQr, decodeBarcodes, scan, variants, repairQr };
})(typeof self !== 'undefined' ? self : this);
