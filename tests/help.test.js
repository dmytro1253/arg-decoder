// Справка: у каждой операции и спец-ноды есть карточка на двух языках, примеры «до → после» верны,
// ссылки собираются, примеры-пресеты существуют. Плюс: интерфейс без «чужих» кириллических строк.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadFull } = require('./load');

const ctx = loadFull('ru');
const HD = ctx.HelpData;
const OPS = ctx.CipherOps.OPS;
const NODE_IDS = Array.from(Object.keys(ctx.NodeTypes));
const OP_IDS = Array.from(OPS, (o) => o.id);
const ALL_IDS = OP_IDS.concat(NODE_IDS);

const CYR = /[А-Яа-яЁё]/g;
const LAT = /[A-Za-z]/g;
const count = (re, s) => (String(s).match(re) || []).length;
const FIELDS = ['what', 'inp', 'par', 'keep', 'chk'];

function pairOf(entry, field) {
  const v = entry[field];
  return v === undefined || v === null ? HD.defaults[field] : v;
}

test('у каждой операции и спец-ноды есть запись справки, лишних записей нет', () => {
  const missing = ALL_IDS.filter((id) => !HD.get(id));
  assert.deepEqual(missing, []);
  const orphan = Object.keys(HD.entries).filter((id) => !ALL_IDS.includes(id));
  assert.deepEqual(orphan, []);
  assert.ok(ALL_IDS.length >= 150, 'ожидалось не меньше 150 записей, их ' + ALL_IDS.length);
});

test('все тексты справки заданы парой ru + en, русский содержит кириллицу, английский — нет «голого» русского', () => {
  const problems = [];
  for (const id of ALL_IDS) {
    const entry = HD.get(id);
    for (const field of FIELDS) {
      const pair = pairOf(entry, field);
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || typeof pair[1] !== 'string' || !pair[0].trim() || !pair[1].trim()) {
        problems.push(id + '.' + field + ': нужна пара [ru, en]');
        continue;
      }
      if (count(CYR, pair[0]) === 0) problems.push(id + '.' + field + ': в русском тексте нет кириллицы');
      if (count(LAT, pair[1]) === 0) problems.push(id + '.' + field + ': в английском тексте нет латиницы');
      if (count(CYR, pair[1]) > count(LAT, pair[1]) / 4) problems.push(id + '.' + field + ': английский текст похож на русский');
    }
    if (!entry.wiki || !entry.wiki[0] || !entry.wiki[1]) problems.push(id + ': нет названий статей Википедии (EN, RU)');
    if (entry.std && !/^https:\/\//.test(entry.std[1])) problems.push(id + ': std-ссылка должна быть https');
    if (!entry.ex || entry.ex.length < 2) problems.push(id + ': нет примера «до → после»');
  }
  assert.deepEqual(problems, []);
});

test('ссылка на Википедию собирается на языке интерфейса', () => {
  ctx.I18n.lang = 'ru';
  assert.match(ctx.Help.wikiUrl(HD.get('caesar')), /^https:\/\/ru\.wikipedia\.org\/wiki\/Special:Search\?go=Go&search=/);
  ctx.I18n.lang = 'en';
  assert.match(ctx.Help.wikiUrl(HD.get('caesar')), /^https:\/\/en\.wikipedia\.org\/wiki\/Special:Search\?go=Go&search=Caesar%20cipher$/);
  ctx.I18n.lang = 'ru';
});

test('примеры-пресеты из справки существуют', () => {
  const ids = new Set(ctx.Presets.map((p) => p.id));
  const bad = Object.entries(HD.entries).filter(([, e]) => e.demo && !ids.has(e.demo)).map(([id, e]) => id + ' → ' + e.demo);
  assert.deepEqual(bad, []);
});

test('короткая строка справки есть у каждой ноды и не длиннее предела', () => {
  for (const id of ALL_IDS) {
    const type = OP_IDS.includes(id) ? 'op:' + id : id;
    const line = ctx.Help.short(type);
    assert.ok(line.length > 10 && line.length <= 150, id + ': «' + line + '»');
  }
});

// ---------- примеры «до → после» выполняются по-настоящему ----------
const str = (v) => (Array.isArray(v) ? v[0] : v);
function runExample(op, entry) {
  const [before, , params] = entry.ex;
  const full = Object.fromEntries(op.params.map((p) => [p.key, p.default]));
  const raw = str(before);
  const inputs = raw.includes(' | ') && op.inputs.length > 1 ? raw.split(' | ') : [raw];
  return op.run(inputs, { ...full, ...(params || {}) });
}

test('примеры справки совпадают с результатом операций', () => {
  const failures = [];
  for (const op of OPS) {
    const entry = HD.get(op.id);
    if (!entry || !entry.ex || entry.exNoRun) continue;
    const after = str(entry.ex[1]);
    let out;
    try { out = String(runExample(op, entry)); } catch (e) { failures.push(op.id + ': ошибка ' + e.message); continue; }
    const ok = after.endsWith('…') ? out.startsWith(after.slice(0, -1)) : out.trim().replace(/\r/g, '') === after.trim();
    if (!ok) failures.push(op.id + ': ждали ' + JSON.stringify(after) + ', получили ' + JSON.stringify(out.slice(0, 80)));
  }
  assert.deepEqual(failures, []);
});

// ---------- интерфейс без «голого» русского ----------
test('в index.html у русского текста есть английский перевод (data-t*)', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<(\w+)[^>]*data-t-html=[^>]*>[\s\S]*?<\/\1>/g, ''); // содержимое с data-t-html переводится целиком
  const bad = [];
  for (const m of html.matchAll(/<([a-z0-9]+)([^>]*)>([^<]*)/gi)) {
    const attrs = m[2]; const text = m[3];
    if (/[А-Яа-яЁё]/.test(text) && !/data-t(-html)?=/.test(attrs)) bad.push(m[1] + ': ' + text.trim().slice(0, 40));
    const title = attrs.match(/\btitle="([^"]*)"/);
    if (title && /[А-Яа-яЁё]/.test(title[1]) && !/data-t-title=/.test(attrs) && title[1] !== 'Русский') bad.push(m[1] + ' title: ' + title[1].slice(0, 40));
    const ph = attrs.match(/\bplaceholder="([^"]*)"/);
    if (ph && /[А-Яа-яЁё]/.test(ph[1]) && !/data-t-ph=/.test(attrs)) bad.push(m[1] + ' placeholder: ' + ph[1].slice(0, 40));
  }
  assert.deepEqual(bad, []);
});

test('нет кириллических строк вне T(…): проверка tools/check_i18n.js', () => {
  const { scan, walk } = require('../tools/check_i18n');
  const root = path.join(__dirname, '..', 'web', 'js');
  const bad = [];
  for (const f of walk(root)) {
    if (['lang-data.js', 'i18n-uk.js'].includes(path.basename(f))) continue;   // файлы данных
    for (const b of scan(f)) bad.push(path.relative(root, f) + ':' + b.line + ' ' + b.text);
  }
  assert.deepEqual(bad, []);
});

test('в нашем коде и документации нет упоминаний «vigenere-cracker» (кроме лицензии движка)', () => {
  const root = path.join(__dirname, '..');
  const files = ['README.md', 'ROADMAP.md', 'requirements.txt', 'backend.py', 'server.py', 'launcher.py', 'start.sh']
    .concat(fs.readdirSync(path.join(root, 'web', 'js')).map((f) => path.join('web', 'js', f)).filter((f) => f.endsWith('.js')));
  // ROADMAP хранит саму формулировку задачи; проверяем только рабочие файлы.
  for (const f of files.filter((x) => x !== 'ROADMAP.md')) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    assert.ok(!/vigenere[-_ ]cracker/i.test(fs.readFileSync(p, 'utf8')), f);
  }
});
