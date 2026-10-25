// Проверка: строковые литералы с кириллицей вне вызова T('ru','en'). Запуск: node tools/check_i18n.js [--list]
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'web', 'js');
// Файлы с данными (алфавиты, раскладки, словари) — кириллица там допустима.
const DATA_FILES = new Set(['lang-data.js', 'i18n-uk.js']);
const BACKSLASH = String.fromCharCode(92);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return p.endsWith('.js') ? [p] : [];
  });
}

/** Находит строковые литералы, пропуская комментарии и регулярки. Возвращает [{start,end,line}]. */
function literals(src) {
  const out = [];
  const st = { i: 0, line: 1 };

  // Шаблонная строка: статические куски — литералы, а внутри ${...} код разбирается рекурсивно.
  function template() {
    st.i++;
    let start = st.i; let startLine = st.line;
    const flush = () => { if (st.i > start) out.push({ start, end: st.i, line: startLine }); };
    while (st.i < src.length && src[st.i] !== '`') {
      if (src[st.i] === BACKSLASH) st.i++;
      else if (src[st.i] === '$' && src[st.i + 1] === '{') {
        flush();
        st.i += 2;
        code(true);
        start = st.i; startLine = st.line;
        continue;
      }
      if (src[st.i] === '\n') st.line++;
      st.i++;
    }
    flush();
    st.i++;
  }

  function code(untilBrace) {
    let depth = 0;
    while (st.i < src.length) {
      const c = src[st.i]; const n = src[st.i + 1];
      if (c === '\n') { st.line++; st.i++; continue; }
      if (c === '/' && n === '/') { while (st.i < src.length && src[st.i] !== '\n') st.i++; continue; }
      if (c === '/' && n === '*') {
        st.i += 2;
        while (st.i < src.length && !(src[st.i] === '*' && src[st.i + 1] === '/')) { if (src[st.i] === '\n') st.line++; st.i++; }
        st.i += 2; continue;
      }
      if (c === '`') { template(); continue; }
      if (c === '\'' || c === '"') {
        const start = st.i; const startLine = st.line; st.i++;
        while (st.i < src.length && src[st.i] !== c) {
          if (src[st.i] === BACKSLASH) st.i++;
          st.i++;
        }
        out.push({ start, end: st.i + 1, line: startLine });
        st.i++; continue;
      }
      if (untilBrace) {
        if (c === '{') depth++;
        else if (c === '}') { if (depth === 0) { st.i++; return; } depth--; }
      }
      if (c === '/') {
        const before = src.slice(Math.max(0, st.i - 20), st.i).trimEnd();
        const prev = before.slice(-1);
        if (!prev || '(,=:[!&|?{};'.includes(prev) || /return$/.test(before)) {
          st.i++;
          let cls = false;
          while (st.i < src.length && (src[st.i] !== '/' || cls) && src[st.i] !== '\n') {
            if (src[st.i] === BACKSLASH) st.i++;
            else if (src[st.i] === '[') cls = true;
            else if (src[st.i] === ']') cls = false;
            st.i++;
          }
          st.i++; continue;
        }
      }
      st.i++;
    }
  }

  code(false);
  return out;
}

const CYR = /[А-Яа-яЁёІіЇїЄє]/;
// Внутренние идентификаторы категорий: показываются через catLabel(), в коде остаются русскими.
const CATEGORIES = new Set(['Ввод и вывод', 'Авто', 'Проверка', 'Кодировки', 'Сдвиги', 'Шифры с ключом', 'ARG и Minecraft', 'Скрытое', 'Перестановки', 'Текст', 'Объединение', 'Изображения', 'Звук и видео', 'Файлы', 'Хеши']);

/** Для каждого вызова T( ... ): [начало, конец первого аргумента, конец вызова]. */
function callRanges(src, lits) {
  const ranges = [];
  const litAt = new Map(lits.map((l) => [l.start, l]));
  const re = /(?:^|[^\w$.])(?:G\.)?(?:T|t|fail)\(/g;
  let m;
  while ((m = re.exec(src))) {
    const from = m.index + m[0].length;
    let i = from; let depth = 0; let firstEnd = -1;
    while (i < src.length) {
      const lit = litAt.get(i);
      if (lit) { i = lit.end; continue; }
      const c = src[i];
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) { if (depth === 0) break; depth--; }
      else if (c === ',' && depth === 0 && firstEnd < 0) firstEnd = i;
      i++;
    }
    ranges.push([from, firstEnd < 0 ? i : firstEnd, i]);
  }
  return ranges;
}

const LATIN_LETTERS = /[A-Za-z]/g;
const CYR_LETTERS = /[А-Яа-яЁёІіЇїЄє]/g;

/** Русский текст допустим в первом аргументе T(); во втором — только как пример внутри английской фразы. */
function allowedInCall(text, start, ranges) {
  for (const [from, firstEnd, end] of ranges) {
    if (start < from || start >= end) continue;
    if (start < firstEnd) return true;
    const lat = (text.match(LATIN_LETTERS) || []).length;
    const cyr = (text.match(CYR_LETTERS) || []).length;
    if (lat >= cyr) return true;
  }
  return false;
}

function scan(file) {
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes('i18n-file-ok')) return []; // файл целиком под отдельной проверкой (см. tests)
  const lines = src.split(/\r?\n/);
  const lits = literals(src);
  const ranges = callRanges(src, lits);
  const bad = [];
  for (const l of lits) {
    const text = src.slice(l.start, l.end);
    // «Запуск.bat» — настоящее имя файла-лаунчера, не интерфейсный текст.
    if (!CYR.test(text.replace(/Запуск(\.bat)?/g, ''))) continue;
    if (CATEGORIES.has(text.slice(1, -1))) continue;
    if (lines[l.line - 1].includes('i18n-ok')) continue;
    if (allowedInCall(text, l.start, ranges)) continue;
    bad.push({ line: l.line, text: text.length > 90 ? text.slice(0, 90) + '…' : text });
  }
  return bad;
}

if (require.main === module) {
  let total = 0;
  for (const f of walk(ROOT)) {
    if (DATA_FILES.has(path.basename(f))) continue;
    const bad = scan(f);
    total += bad.length;
    if (process.argv.includes('--list')) for (const b of bad) console.log(`${path.relative(ROOT, f)}:${b.line}: ${b.text}`);
    else if (bad.length) console.log(`${path.relative(ROOT, f)}: ${bad.length}`);
  }
  console.log('total', total);
  process.exitCode = total ? 1 : 0;
}
module.exports = { scan, walk, literals, callRanges };
