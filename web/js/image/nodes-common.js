// Общие помощники нод изображений: вход-пиксели, область (регион), статус, простые DOM-функции.
(function (G) {
  'use strict';

  const T = G.T || ((ru) => ru);
  const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  const CAT = 'Изображения';
  const REGION_PARAMS = [
    { key: 'rx', label: '', type: 'hidden', default: 0 }, { key: 'ry', label: '', type: 'hidden', default: 0 },
    { key: 'rw', label: '', type: 'hidden', default: 0 }, { key: 'rh', label: '', type: 'hidden', default: 0 },
  ];

  /** Область из параметров ноды или null (вся картинка). */
  function regionOf(p) {
    const w = Number(p.rw), hh = Number(p.rh);
    return w > 0 && hh > 0 ? { x: Number(p.rx) || 0, y: Number(p.ry) || 0, w, h: hh } : null;
  }

  function setRegion(node, r) {
    node.params.rx = r ? r.x : 0; node.params.ry = r ? r.y : 0; node.params.rw = r ? r.w : 0; node.params.rh = r ? r.h : 0;
  }

  /** Пиксели входа (ручка artifact:…) с учётом области. undefined — картинка ещё декодируется. */
  function input(value, p) {
    const px = G.ImgStore.get(value);
    if (!px) return undefined;
    const r = regionOf(p || {});
    return { px, region: r, view: r ? G.ImgProc.crop(px, r.x, r.y, r.w, r.h) : px };
  }

  /** Контейнер .special ноды и «запоминаемое» состояние UI (создаётся один раз). */
  function box(node, body, build) {
    const el = body.querySelector('.special');
    if (!node.state.ui) {
      node.state.ui = build(el);
      G.ImgStore.onReady(() => { if (node.state.requestEval) node.state.requestEval(); });
    }
    return node.state.ui;
  }

  const fmtBytes = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n > 1024 ? (n / 1024).toFixed(1) + ' KB' : n + ' B');

  function status(el, text, kind) {
    el.textContent = text || '';
    el.className = 'img-status small ' + (kind === 'error' ? 'img-err' : 'muted');
  }

  G.ImgNodes = { T, h, CAT, REGION_PARAMS, regionOf, setRegion, input, box, fmtBytes, status };
})(typeof self !== 'undefined' ? self : this);
