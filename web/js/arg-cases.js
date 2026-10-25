// Реестр ARG, о которых есть примеры и досье. Нужен, чтобы меню примеров, досье и тесты называли их одинаково.
// Названия собственные (одинаковы на обоих языках), поэтому T здесь нужен лишь для подписей-описаний.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);

  // id → короткая подпись (для меню). Порядок = порядок групп в меню «Примеры».
  const LIST = [
    ['oldroot', 'OldRoot', T('Minecraft, 2014', 'Minecraft, 2014')],
    ['hermatrix', 'HERMatrix', T('Hermitcraft, 2021', 'Hermitcraft, 2021')],
    ['alphaver', 'AlphaVer', T('Minecraft Alpha 1.0.16 Versions, 2021', 'Minecraft Alpha 1.0.16 Versions, 2021')],
    ['endermite', 'Endermite / Jimmy', T('Minecraft, 2026', 'Minecraft, 2026')],
    ['archive11', 'Archive11', T('Minecraft / YouTube', 'Minecraft / YouTube')],
    ['portal', 'Portal ARG', T('Portal, 2010', 'Portal, 2010')],
    ['cicada', 'Cicada 3301', T('2012', '2012')],
    ['yearzero', 'Year Zero', T('Nine Inch Nails, 2007', 'Nine Inch Nails, 2007')],
    ['oxenfree', 'Oxenfree', T('2016', '2016')],
    ['inscryption', 'Inscryption', T('2021', '2021')],
    ['sombra', 'Sombra (Overwatch)', T('2016', '2016')],
    ['searchworld', 'Searching For a World That Doesn’t Exist', T('Minecraft, 2025–2026', 'Minecraft, 2025–2026')],
    ['ilovebees', 'I Love Bees', T('2004', '2004')],
    ['kf2', 'Killing Floor 2: From a Friend', T('Steam / Tripwire, 2017', 'Steam / Tripwire, 2017')],
    ['langeskov', 'Dr. Langeskov', T('Crows Crows Crows, 2015', 'Crows Crows Crows, 2015')],
    ['a76543', '76543', T('Discord / web, 2017–2018', 'Discord / web, 2017–2018')],
    ['steam2015', 'Steam Winter 2015', T('Steam, 2015', 'Steam, 2015')],
  ];

  const ArgCases = {
    list: LIST.map(([id, name, hint]) => ({ id, name, hint })),
    get(id) { return ArgCases.list.find((c) => c.id === id) || null; },
    name(id) { const c = ArgCases.get(id); return c ? c.name : id; },
    order(id) { const i = LIST.findIndex((c) => c[0] === id); return i < 0 ? LIST.length : i; },
  };

  G.ArgCases = ArgCases;
})(typeof self !== 'undefined' ? self : this);
