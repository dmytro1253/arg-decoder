// Модель аннотаций доски (чистая логика, без DOM): карандаш, стрелка, рамка, эллипс, текст, картинка.
// Аннотации живут в мировых координатах доски, отдельно от проводов данных, и не связаны с портами нод.
// Все функции возвращают новые объекты — исходные фигуры не изменяются.
(function (G) {
  'use strict';
  const TYPES = ['pen', 'arrow', 'rect', 'ellipse', 'text', 'image'];
  const DEFAULT_COLOR = '#ff9f43';
  const DEFAULT_WIDTH = 3;
  const DEFAULT_TEXT_SIZE = 20;
  const MIN_SIZE = 6;
  const MAX_SHAPES = 5000;
  const MAX_POINTS = 20000;
  const COLOR_RE = /^#[0-9a-f]{3,8}$/i;
  const HANDLE_NAMES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const LINE_HEIGHT = 1.25;
  const CHAR_WIDTH = 0.6;
  let counter = 0;

  const num = (v, fallback) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fallback);
  const round1 = (v) => Math.round(v * 10) / 10;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function newId() {
    counter += 1;
    return 'an' + Date.now().toString(36) + counter.toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }

  // ---------- создание и проверка ----------
  /** Приводит произвольный объект к допустимой фигуре или возвращает null. */
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || !TYPES.includes(raw.type)) return null;
    const base = {
      id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
      type: raw.type,
      color: typeof raw.color === 'string' && COLOR_RE.test(raw.color) ? raw.color : DEFAULT_COLOR,
      width: clamp(num(raw.width, DEFAULT_WIDTH), 1, 40),
      dash: !!raw.dash,
      locked: !!raw.locked,
    };
    switch (raw.type) {
      case 'pen': {
        const pts = Array.isArray(raw.points) ? raw.points : [];
        const points = pts.filter((p) => Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
          .slice(0, MAX_POINTS).map((p) => [round1(Number(p[0])), round1(Number(p[1]))]);
        return points.length ? { ...base, points } : null;
      }
      case 'arrow':
        return { ...base, x1: round1(num(raw.x1, 0)), y1: round1(num(raw.y1, 0)), x2: round1(num(raw.x2, 0)), y2: round1(num(raw.y2, 0)) };
      case 'rect':
      case 'ellipse':
        return { ...base, ...boxOf(raw, 40, 30), fill: !!raw.fill };
      case 'text': {
        const text = typeof raw.text === 'string' ? raw.text : '';
        if (!text.trim()) return null;
        return { ...base, x: round1(num(raw.x, 0)), y: round1(num(raw.y, 0)), text: text.slice(0, 4000), size: clamp(num(raw.size, DEFAULT_TEXT_SIZE), 8, 200) };
      }
      default: // image
        return { ...base, ...boxOf(raw, 160, 120), artifact: typeof raw.artifact === 'string' ? raw.artifact : '', name: typeof raw.name === 'string' ? raw.name : '' };
    }
  }

  function boxOf(raw, defW, defH) {
    return {
      x: round1(num(raw.x, 0)), y: round1(num(raw.y, 0)),
      w: round1(Math.max(MIN_SIZE, Math.abs(num(raw.w, defW)))), h: round1(Math.max(MIN_SIZE, Math.abs(num(raw.h, defH)))),
    };
  }

  function normalizeList(list) {
    const seen = new Set();
    const out = [];
    for (const raw of Array.isArray(list) ? list : []) {
      const s = normalize(raw);
      if (!s) continue;
      const shape = seen.has(s.id) ? { ...s, id: newId() } : s;
      seen.add(shape.id);
      out.push(shape);
      if (out.length >= MAX_SHAPES) break;
    }
    return out;
  }

  /** Новая фигура заданного типа; props перекрывают значения по умолчанию. */
  function make(type, props) {
    return normalize({ ...(props || {}), type, id: newId() });
  }

  // ---------- геометрия ----------
  function textSize(shape) {
    const lines = shape.text.split('\n');
    const longest = Math.max(...lines.map((l) => Array.from(l).length), 1);
    return { w: Math.max(MIN_SIZE, longest * shape.size * CHAR_WIDTH), h: lines.length * shape.size * LINE_HEIGHT };
  }

  /** Габарит фигуры {x, y, w, h} без учёта толщины линии. */
  function bbox(shape) {
    switch (shape.type) {
      case 'pen': {
        const xs = shape.points.map((p) => p[0]), ys = shape.points.map((p) => p[1]);
        const x = Math.min(...xs), y = Math.min(...ys);
        return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
      }
      case 'arrow': {
        const x = Math.min(shape.x1, shape.x2), y = Math.min(shape.y1, shape.y2);
        return { x, y, w: Math.abs(shape.x2 - shape.x1), h: Math.abs(shape.y2 - shape.y1) };
      }
      case 'text': return { x: shape.x, y: shape.y, ...textSize(shape) };
      default: return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
    }
  }

  function unionBox(shapes) {
    if (!shapes.length) return null;
    const boxes = shapes.map(bbox);
    const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
    const x2 = Math.max(...boxes.map((b) => b.x + b.w)), y2 = Math.max(...boxes.map((b) => b.y + b.h));
    return { x, y, w: x2 - x, h: y2 - y };
  }

  function move(shape, dx, dy) {
    switch (shape.type) {
      case 'pen': return { ...shape, points: shape.points.map((p) => [round1(p[0] + dx), round1(p[1] + dy)]) };
      case 'arrow': return { ...shape, x1: round1(shape.x1 + dx), y1: round1(shape.y1 + dy), x2: round1(shape.x2 + dx), y2: round1(shape.y2 + dy) };
      default: return { ...shape, x: round1(shape.x + dx), y: round1(shape.y + dy) };
    }
  }

  /** Переносит точку из одного габарита в другой (для масштабирования). */
  function mapPoint(x, y, from, to) {
    const fx = from.w > 0 ? (x - from.x) / from.w : 0;
    const fy = from.h > 0 ? (y - from.y) / from.h : 0;
    return [round1(to.x + fx * to.w), round1(to.y + fy * to.h)];
  }

  /** Растягивает фигуру так, чтобы её габарит стал `to`. */
  function fit(shape, to) {
    const from = bbox(shape);
    switch (shape.type) {
      case 'pen': return { ...shape, points: shape.points.map((p) => mapPoint(p[0], p[1], from, to)) };
      case 'arrow': {
        const a = mapPoint(shape.x1, shape.y1, from, to), b = mapPoint(shape.x2, shape.y2, from, to);
        return { ...shape, x1: a[0], y1: a[1], x2: b[0], y2: b[1] };
      }
      case 'text': {
        const k = from.h > 0 ? to.h / from.h : 1;
        return { ...shape, x: round1(to.x), y: round1(to.y), size: round1(clamp(shape.size * k, 8, 200)) };
      }
      default: return { ...shape, x: round1(to.x), y: round1(to.y), w: round1(Math.max(MIN_SIZE, to.w)), h: round1(Math.max(MIN_SIZE, to.h)) };
    }
  }

  /** Новый габарит после перетаскивания ручки handle на (dx, dy). Габарит не переворачивается. */
  function applyHandle(box, handle, dx, dy) {
    let { x, y, w, h } = box;
    const west = handle.includes('w'), east = handle.includes('e'), north = handle.includes('n'), south = handle.includes('s');
    if (west) { const nx = Math.min(x + dx, x + w - MIN_SIZE); w += x - nx; x = nx; }
    if (east) w = Math.max(MIN_SIZE, w + dx);
    if (north) { const ny = Math.min(y + dy, y + h - MIN_SIZE); h += y - ny; y = ny; }
    if (south) h = Math.max(MIN_SIZE, h + dy);
    return { x, y, w, h };
  }

  function handlePoints(box) {
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2, r = box.x + box.w, b = box.y + box.h;
    return { nw: [box.x, box.y], n: [cx, box.y], ne: [r, box.y], e: [r, cy], se: [r, b], s: [cx, b], sw: [box.x, b], w: [box.x, cy] };
  }

  // ---------- попадание курсора ----------
  function distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function inBox(b, x, y, pad) {
    return x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;
  }

  /** Попал ли курсор (x, y) в фигуру; tol — допуск в мировых единицах. */
  function hit(shape, x, y, tol) {
    const pad = tol + shape.width / 2;
    switch (shape.type) {
      case 'pen': {
        const pts = shape.points;
        if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]) <= pad;
        for (let i = 1; i < pts.length; i++) if (distToSegment(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= pad) return true;
        return false;
      }
      case 'arrow': return distToSegment(x, y, shape.x1, shape.y1, shape.x2, shape.y2) <= pad;
      case 'rect': {
        if (shape.fill) return inBox(shape, x, y, pad);
        return inBox(shape, x, y, pad) && !inBox({ x: shape.x, y: shape.y, w: shape.w, h: shape.h }, x, y, -pad);
      }
      case 'ellipse': {
        const rx = shape.w / 2, ry = shape.h / 2;
        const d = Math.hypot((x - (shape.x + rx)) / (rx + pad), (y - (shape.y + ry)) / (ry + pad));
        if (shape.fill) return d <= 1;
        const inner = Math.hypot((x - (shape.x + rx)) / Math.max(1, rx - pad), (y - (shape.y + ry)) / Math.max(1, ry - pad));
        return d <= 1 && inner >= 1;
      }
      default: return inBox(bbox(shape), x, y, tol);
    }
  }

  /** Самая верхняя фигура под курсором (индекс в списке) или -1. */
  function hitTop(shapes, x, y, tol) {
    for (let i = shapes.length - 1; i >= 0; i--) if (hit(shapes[i], x, y, tol)) return i;
    return -1;
  }

  /** Пересекается ли габарит фигуры с прямоугольником выделения. */
  function touchesRect(shape, rect) {
    const b = bbox(shape);
    return b.x <= rect.x + rect.w && b.x + b.w >= rect.x && b.y <= rect.y + rect.h && b.y + b.h >= rect.y;
  }

  // ---------- отрисовка (строки для SVG) ----------
  /** Плавный путь через точки (квадратичные кривые по серединам отрезков). */
  function pathData(points) {
    if (!points.length) return '';
    if (points.length === 1) return `M${points[0][0]},${points[0][1]} L${points[0][0]},${points[0][1]}`;
    let d = `M${points[0][0]},${points[0][1]}`;
    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i][0] + points[i + 1][0]) / 2, my = (points[i][1] + points[i + 1][1]) / 2;
      d += ` Q${points[i][0]},${points[i][1]} ${round1(mx)},${round1(my)}`;
    }
    const last = points[points.length - 1];
    return d + ` L${last[0]},${last[1]}`;
  }

  /** Три вершины наконечника стрелки. */
  function arrowHead(shape) {
    const size = Math.max(12, shape.width * 4);
    const ang = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
    const wing = (sign) => [round1(shape.x2 - size * Math.cos(ang - sign * 0.45)), round1(shape.y2 - size * Math.sin(ang - sign * 0.45))];
    return [[shape.x2, shape.y2], wing(1), wing(-1)];
  }

  /** Ограничивает вектор до кратного 45° (для стрелок с Shift). */
  function snapAngle(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const step = Math.PI / 4;
    const ang = Math.round(Math.atan2(dy, dx) / step) * step;
    const len = Math.hypot(dx, dy);
    return [round1(x1 + len * Math.cos(ang)), round1(y1 + len * Math.sin(ang))];
  }

  G.AnnotModel = {
    TYPES, DEFAULT_COLOR, DEFAULT_WIDTH, DEFAULT_TEXT_SIZE, MIN_SIZE, HANDLE_NAMES,
    newId, normalize, normalizeList, make,
    bbox, unionBox, textSize, move, fit, mapPoint, applyHandle, handlePoints,
    hit, hitTop, touchesRect, distToSegment, pathData, arrowHead, snapAngle,
  };
})(typeof self !== 'undefined' ? self : this);
