// Справочник функций из живых реестров: операции, спец-ноды, примеры, досье, клавиатуры.
// Запуск: node tools/gen_functions_doc.js  → docs/FUNCTIONS.md и docs/FUNCTIONS.ru.md
// Проверка актуальности (для тестов): node tools/gen_functions_doc.js --check
'use strict';
const fs = require('fs');
const path = require('path');
const { loadFull } = require('../tests/load');

const DOCS = path.join(__dirname, '..', 'docs');
const CAT_ORDER = ['Ввод и вывод', 'Авто', 'Проверка', 'Кодировки', 'Сдвиги', 'Шифры с ключом', 'ARG и Minecraft', 'Скрытое', 'Перестановки', 'Текст', 'Объединение', 'Изображения', 'Звук и видео', 'Файлы', 'Хеши'];
const CAT_EN = {
  'Ввод и вывод': 'Input & output', 'Авто': 'Auto', 'Проверка': 'Checks', 'Кодировки': 'Encodings', 'Сдвиги': 'Shifts',
  'Шифры с ключом': 'Keyed ciphers', 'ARG и Minecraft': 'ARG & Minecraft', 'Скрытое': 'Hidden', 'Перестановки': 'Permutations',
  'Текст': 'Text', 'Объединение': 'Join', 'Изображения': 'Images', 'Звук и видео': 'Audio & video', 'Файлы': 'Files', 'Хеши': 'Hashes',
};

const TEXT = {
  en: {
    title: 'ARG Decoder: function reference',
    other: '[Русская версия](FUNCTIONS.ru.md) · [Українська версія](FUNCTIONS.uk.md)',
    intro: 'Every node, example, dossier and keyboard in the app, generated from the live registries by `tools/gen_functions_doc.js` (do not edit by hand). How the pieces work inside is described in [HOW-IT-WORKS.md](HOW-IT-WORKS.md).',
    counts: (o, n, p, d) => `**${o}** operations (function nodes), **${n}** special nodes, **${p}** examples, **${d}** built-in dossiers.`,
    contents: 'Contents', special: 'Special nodes', ops: 'Operations (function nodes)', examples: 'Examples', dossiers: 'Built-in dossiers', keyboards: 'On-screen keyboards',
    specialIntro: 'Nodes with their own interface: input, results, the auto search, images, audio, files.',
    opsIntro: 'Pure text functions. Each takes a string on its inputs and returns a string; the parameters are the fields in the node. Marked **auto** if the auto search tries the operation by itself.',
    inputs: 'Inputs', none: 'none', params: 'Parameters', auto: 'auto', autoTip: 'the auto search tries it',
    def: 'default', options: 'options', on: 'on', off: 'off',
    exIntro: 'Open any example from the **Examples** menu or with a link such as `http://127.0.0.1:8765/?preset=ID`. Each opens on its own board with a step-by-step guide.',
    answer: 'answer', manual: 'manual', disc: 'source discrepancy',
    dosIntro: 'The **Profile** tab shows these dossiers; you can also write your own and keep them in the project file.',
    stages: 'stages', sources: 'sources', examplesN: 'examples',
    kbIntro: 'The **⌨ Keyboards** button opens a floating panel that types into the focused field or into its own scratchpad.',
  },
  ru: {
    title: 'ARG Decoder: справочник функций',
    other: '[English version](FUNCTIONS.md) · [Українська версія](FUNCTIONS.uk.md)',
    intro: 'Все ноды, примеры, досье и клавиатуры программы, собранные из живых реестров скриптом `tools/gen_functions_doc.js` (руками не править). Как всё устроено внутри — в [HOW-IT-WORKS.ru.md](HOW-IT-WORKS.ru.md).',
    counts: (o, n, p, d) => `**${o}** операций (нод-функций), **${n}** специальных нод, **${p}** примеров, **${d}** встроенных досье.`,
    contents: 'Содержание', special: 'Специальные ноды', ops: 'Операции (ноды-функции)', examples: 'Примеры', dossiers: 'Встроенные досье', keyboards: 'Экранные клавиатуры',
    specialIntro: 'Ноды со своим интерфейсом: ввод, результаты, авто-поиск, картинки, звук, файлы.',
    opsIntro: 'Чистые текстовые функции: на входах строка, на выходе строка, параметры — поля в ноде. Пометка **авто** — авто-поиск пробует операцию сам.',
    inputs: 'Входы', none: 'нет', params: 'Параметры', auto: 'авто', autoTip: 'авто-поиск пробует её сам',
    def: 'по умолчанию', options: 'варианты', on: 'вкл', off: 'выкл',
    exIntro: 'Любой пример открывается из меню **Примеры** или ссылкой вида `http://127.0.0.1:8765/?preset=ID`, каждый — на своей доске с пошаговым гидом.',
    answer: 'ответ', manual: 'вручную', disc: 'расхождение источника',
    dosIntro: 'Эти досье показывает вкладка **Досье**; можно писать и свои — они хранятся в файле проекта.',
    stages: 'этапов', sources: 'источников', examplesN: 'примеров',
    kbIntro: 'Кнопка **⌨ Клавиатуры** открывает плавающую панель: знаки вставляются в поле с фокусом или в её черновик.',
  },
  uk: {
    title: 'ARG Decoder: довідник функцій',
    other: '[English version](FUNCTIONS.md) · [Русская версия](FUNCTIONS.ru.md)',
    intro: 'Усі вузли, приклади, досьє та клавіатури програми, зібрані з живих реєстрів скриптом `tools/gen_functions_doc.js` (вручну не редагувати). Як усе влаштовано всередині — у [HOW-IT-WORKS.uk.md](HOW-IT-WORKS.uk.md).',
    counts: (o, n, p, d) => `**${o}** операцій (вузлів-функцій), **${n}** спеціальних вузлів, **${p}** прикладів, **${d}** вбудованих досьє.`,
    contents: 'Зміст', start: 'Старт', special: 'Спеціальні вузли', ops: 'Операції (вузли-функції)', examples: 'Приклади', dossiers: 'Вбудовані досьє', keyboards: 'Екранні клавіатури',
    specialIntro: 'Вузли з власним інтерфейсом: введення, результати, автопошук, зображення, звук, файли.',
    opsIntro: 'Чисті текстові функції: на входах рядок, на виході рядок, параметри — поля у вузлі. Позначка **авто** — автопошук пробує операцію сам.',
    inputs: 'Входи', none: 'немає', params: 'Параметри', auto: 'авто', autoTip: 'автопошук пробує її сам',
    def: 'за замовчуванням', options: 'варіанти', on: 'увімк.', off: 'вимк.',
    exIntro: 'Будь-який приклад відкривається з меню **Приклади** або посиланням на кшталт `http://127.0.0.1:8765/?preset=ID`, кожен — на власній дошці з покроковим гідом.',
    answer: 'відповідь', manual: 'вручну', disc: 'розбіжність джерела',
    dosIntro: 'Ці досьє показує вкладка **Досьє**; можна писати й власні — вони зберігаються у файлі проєкту.',
    stages: 'етапів', sources: 'джерел', examplesN: 'прикладів',
    kbIntro: 'Кнопка **⌨ Клавіатури** відкриває плаваючу панель: знаки вставляються в поле з фокусом або в її чернетку.',
  },
};

const md = (s) => String(s === undefined || s === null ? '' : s).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
// Якорь как у GitHub: нижний регистр, без знаков, каждый пробел → дефис.
const anchor = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/ /g, '-');

function paramLine(p, t) {
  if (!p.label || p.type === 'hidden') return null;
  let d = '';
  if (p.type === 'select' && Array.isArray(p.options)) {
    const opts = p.options.map(([v, l]) => (v === p.default ? `**${md(l)}**` : md(l)));
    d = ` — ${t.options}: ${opts.join(', ')}`;
  } else if (p.type === 'bool') d = ` — ${t.def}: ${p.default ? t.on : t.off}`;
  else if (p.type === 'range') d = ` — ${p.min}…${p.max}${p.unit ? ' ' + p.unit : ''}, ${t.def} ${p.default}`;
  else if (p.default !== undefined && p.default !== '') d = ` — ${t.def}: \`${md(p.default)}\``;
  return `  - ${md(p.label)}${d}`;
}

function nodeBlock(id, def, t, isOp) {
  const out = [`#### ${md(def.name)} \`${id}\`${isOp && def.probes ? ` · _${t.auto}_` : ''}`, ''];
  if (def.desc) out.push(md(def.desc), '');
  const ins = def.inputs && def.inputs.length ? def.inputs.map(md).join(', ') : t.none;
  out.push(`- ${t.inputs}: ${ins}`);
  const params = (def.params || []).map((p) => paramLine(p, t)).filter(Boolean);
  if (params.length) out.push(`- ${t.params}:`, ...params);
  out.push('');
  return out;
}

function build(lang) {
  const ctx = loadFull(lang);
  const t = TEXT[lang];
  const cat = (c) => (lang === 'en' ? CAT_EN[c] || c : lang === 'uk' ? ctx.I18n.uk(c) : c);
  const ops = ctx.CipherOps.OPS;
  const nodes = Object.entries(ctx.NodeTypes);
  const presets = ctx.Presets;
  const dossiers = ctx.Dossiers.list();
  const out = [`# ${t.title}`, '', t.other, '', t.intro, '', t.counts(ops.length, nodes.length, presets.length, dossiers.length), ''];

  const byCat = (list, getCat) => CAT_ORDER.map((c) => [c, list.filter((x) => getCat(x) === c)]).filter(([, l]) => l.length)
    .concat([['—', list.filter((x) => !CAT_ORDER.includes(getCat(x)))]].filter(([, l]) => l.length));
  const nodeCats = byCat(nodes, ([, d]) => d.cat);
  const opCats = byCat(ops, (o) => o.cat);

  out.push(`## ${t.contents}`, '', `- [${t.special}](#${anchor(t.special)})`);
  for (const [c, l] of nodeCats) out.push(`  - [${cat(c)}](#${anchor(t.special + ' · ' + cat(c))}) (${l.length})`);
  out.push(`- [${t.ops}](#${anchor(t.ops)})`);
  for (const [c, l] of opCats) out.push(`  - [${cat(c)}](#${anchor(t.ops + ' · ' + cat(c))}) (${l.length})`);
  out.push(`- [${t.examples}](#${anchor(t.examples)})`, `- [${t.dossiers}](#${anchor(t.dossiers)})`, `- [${t.keyboards}](#${anchor(t.keyboards)})`, '');

  out.push(`## ${t.special}`, '', t.specialIntro, '');
  for (const [c, l] of nodeCats) {
    out.push(`### ${t.special} · ${cat(c)}`, '');
    for (const [id, def] of l) out.push(...nodeBlock(id, def, t, false));
  }
  out.push(`## ${t.ops}`, '', t.opsIntro, '');
  for (const [c, l] of opCats) {
    out.push(`### ${t.ops} · ${cat(c)}`, '');
    for (const op of l) out.push(...nodeBlock(op.id, op, t, true));
  }

  out.push(`## ${t.examples}`, '', t.exIntro, '');
  const groups = new Map();
  for (const p of presets) {
    const g = p.group || t.start;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  }
  for (const [g, list] of groups) {
    out.push(`### ${md(g)}`, '');
    for (const p of list) {
      const answer = (p.auto && p.auto.expect) || (Array.isArray(p.expect) ? p.expect[0] : p.expect);
      const extra = [answer ? `${t.answer}: \`${md(answer).slice(0, 90)}\`` : '', p.manual ? `${t.manual}: ${md(p.manual)}` : '', p.discrepancy ? `${t.disc}: ${md(p.discrepancy)}` : ''].filter(Boolean);
      out.push(`- **${md(p.title)}** · \`${p.id}\` — ${md(p.desc)}${extra.length ? '<br>' + extra.join(' · ') : ''}`);
    }
    out.push('');
  }

  out.push(`## ${t.dossiers}`, '', t.dosIntro, '');
  for (const d of dossiers) {
    const meta = [d.period, d.platform].filter(Boolean).map(md).join(', ');
    out.push(`- **${md(d.title)}**${meta ? ' (' + meta + ')' : ''} — ${(d.stages || []).length} ${t.stages}, ${(d.sources || []).length} ${t.sources}, ${(d.presets || []).length} ${t.examplesN}. ${md(d.summary).slice(0, 220)}${md(d.summary).length > 220 ? '…' : ''}`);
  }
  out.push('', `## ${t.keyboards}`, '', t.kbIntro, '');
  const layouts = typeof ctx.Keyboards.layouts === 'function' ? ctx.Keyboards.layouts() : [];
  for (const k of layouts) out.push(`- **${md(k.name || k.title || k.id)}**${k.note ? ' — ' + md(k.note) : ''}`);
  out.push('');
  return out.join('\n');
}

const FILES = { en: 'FUNCTIONS.md', ru: 'FUNCTIONS.ru.md', uk: 'FUNCTIONS.uk.md' };
if (require.main === module) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const [lang, name] of Object.entries(FILES)) {
    const text = build(lang);
    const file = path.join(DOCS, name);
    if (check) {
      const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (cur !== text) { console.log('stale: docs/' + name); stale++; }
    } else {
      fs.writeFileSync(file, text, 'utf8');
      console.log('docs/' + name, text.length, 'chars');
    }
  }
  process.exitCode = stale ? 1 : 0;
}
module.exports = { build, FILES };
