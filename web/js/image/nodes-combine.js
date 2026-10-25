// Две картинки → одна (аудит 2026-10-23, Dr. Langeskov: signature.png + mayflower-noise.png): разность, XOR,
// сумма, умножение, «экран», среднее и прозрачность — со сдвигом второй картинки для выравнивания.
// Чистая функция над {width,height,data}; результат — производный артефакт-изображение.
(function (G) {
  'use strict';
  const N = G.ImgNodes;
  const { T, h, CAT } = N;

  const MODES = [
    ['difference', T('разность |A − B|', 'difference |A − B|')], ['xor', T('XOR байтов', 'byte XOR')], ['add', T('сумма', 'add')],
    ['subtract', T('A − B', 'A − B')], ['multiply', T('умножение', 'multiply')], ['screen', T('экран', 'screen')],
    ['average', T('среднее', 'average')], ['alpha', T('B поверх A с прозрачностью', 'B over A with opacity')],
  ];

  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const MIX = {
    difference: (a, b) => Math.abs(a - b), xor: (a, b) => a ^ b, add: (a, b) => clamp(a + b), subtract: (a, b) => clamp(a - b),
    multiply: (a, b) => (a * b) / 255, screen: (a, b) => 255 - ((255 - a) * (255 - b)) / 255, average: (a, b) => (a + b) / 2,
  };

  /** Смешивает B с A. Размер — как у A; B сдвигается на (dx, dy), за пределами B берётся A без изменений (или чёрное для XOR/разности). */
  function combine(a, b, p) {
    const W = a.width, H = a.height, out = new Uint8ClampedArray(W * H * 4);
    const dx = Math.round(Number(p.dx) || 0), dy = Math.round(Number(p.dy) || 0);
    const opacity = Math.max(0, Math.min(1, (Number(p.opacity) || 0) / 100));
    const stretch = !!p.stretch;
    const fn = MIX[p.mode];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const bx = stretch ? Math.floor(x * b.width / W) : x - dx, by = stretch ? Math.floor(y * b.height / H) : y - dy;
      const inside = bx >= 0 && by >= 0 && bx < b.width && by < b.height;
      const q = inside ? (by * b.width + bx) * 4 : -1;
      for (let c = 0; c < 3; c++) {
        const av = a.data[o + c];
        if (!inside) { out[o + c] = av; continue; }
        const bv = b.data[q + c];
        out[o + c] = p.mode === 'alpha' ? av * (1 - opacity) + bv * opacity : fn(av, bv);
      }
      out[o + 3] = 255;
    }
    return { width: W, height: H, data: out };
  }

  G.NodeTypes.img_combine = {
    name: T('Изображение: две картинки → одна', 'Image: combine two images'), cat: CAT, wide: true, inputs: [T('картинка A', 'image A'), T('картинка B', 'image B')],
    desc: T('Накладывает картинку B на A: разность, XOR, сумма, умножение, «экран», среднее или прозрачность. Сдвиг B (dx, dy) выравнивает картинки; «растянуть» подгоняет B под размер A. Разность и XOR проявляют то, чем две почти одинаковые картинки отличаются.',
      'Overlays image B onto A: difference, XOR, add, multiply, screen, average or opacity. The B offset (dx, dy) aligns the images; “stretch” fits B to the size of A. Difference and XOR reveal how two nearly identical images differ.'),
    params: [
      { key: 'mode', label: T('Как смешать', 'Blend'), type: 'select', options: MODES, default: 'difference' },
      { key: 'opacity', label: T('Прозрачность B, % (для «поверх»)', 'B opacity, % (for “over”)'), type: 'range', min: 0, max: 100, step: 1, int: true, unit: '%', default: 50 },
      { key: 'dx', label: T('Сдвиг B по X, px', 'B offset X, px'), type: 'number', default: 0 },
      { key: 'dy', label: T('Сдвиг B по Y, px', 'B offset Y, px'), type: 'number', default: 0 },
      { key: 'stretch', label: T('Растянуть B до размера A', 'Stretch B to the size of A'), type: 'bool', default: false },
    ],
    compute([va, vb], p, node) {
      const a = G.ImgStore.get(va);
      const b = G.ImgStore.get(vb);
      if (!a || !b) return undefined;            // ещё декодируются
      const key = 'combine|' + vb + '|' + [p.mode, p.opacity, p.dx, p.dy, p.stretch].join('|');
      node.state.info = { a: a.width + '×' + a.height, b: b.width + '×' + b.height };
      return G.ImgStore.derive(va, key, () => combine(a, b, p), T('две картинки', 'two images') + ' (' + p.mode + ')');
    },
    update(node, res, body) {
      let box = body.querySelector('.special');
      if (!box) { box = h('div', 'special small muted'); body.appendChild(box); }
      const i = node.state.info;
      box.textContent = res.error ? res.error : i ? 'A ' + i.a + ' · B ' + i.b + (i.a !== i.b ? T(' · размеры разные: выровняй сдвигом или «растянуть»', ' · sizes differ: align with the offset or “stretch”') : '') : '';
    },
  };

  G.ImgCombine = { combine, MODES };
})(typeof self !== 'undefined' ? self : this);
