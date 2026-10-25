// Украинская локализация: русские строки интерфейса — ключи словаря, украинский — значения.
//   node tools/i18n_uk.js extract   → tools/i18n/uk-source.json (все строки: точные и шаблоны с {0}, {1}…)
//   node tools/i18n_uk.js build     → web/js/i18n-uk.js из tools/i18n/uk.json
//   node tools/i18n_uk.js check     → нет ли строк без перевода (для тестов)
// Источники: первый аргумент T()/fail() в web/js (статические строки и склейки — шаблоном), пары [ru, en] справки
// и названия примеров, русский текст и title/placeholder в index.html, сообщения сервера (server-text.js).
'use strict';
const fs = require('fs');
const path = require('path');
const { walk, literals, callRanges } = require('./check_i18n');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const SRC_JSON = path.join(__dirname, 'i18n', 'uk-source.json');
const UK_JSON = path.join(__dirname, 'i18n', 'uk.json');
const OUT_JS = path.join(WEB, 'js', 'i18n-uk.js');
const CYR = /[А-Яа-яЁёІіЇїЄє]/;
const BACKSLASH = String.fromCharCode(92);
const SKIP_FILES = new Set(['lang-data.js', 'i18n-uk.js']);

/** Значение строкового литерала (кавычки или шаблон без ${}). Кусок шаблонной строки приходит без обрамления. */
function literalValue(raw) {
  const q = raw[0];
  if (!(q === "'" || q === '"' || q === '`') || raw[raw.length - 1] !== q || raw.length < 2) return raw;
  const body = raw.slice(1, -1);
  if (q === '`') return body.replace(/\\`/g, '`').replace(/\\\\/g, '\\');
  try { return JSON.parse(q === '"' ? raw : '"' + body.replace(/\\'/g, "'").replace(/"/g, '\\"') + '"'); } catch (e) { return body; }
}

/**
 * Первый аргумент T(): склейка литералов и выражений → шаблон «Ключ {0} вне 0..255».
 * Возвращает { key, pattern } или null, если русского текста нет.
 */
function argKey(src, from, to, lits) {
  const inArg = lits.filter((l) => l.start >= from && l.end <= to);
  if (!inArg.length) return null;
  const text = src.slice(from, to).trim();
  // Шаблонная строка целиком: ${…} → {n} (выражения внутри могут содержать свои строки и скобки).
  if (text[0] === '`' && text[text.length - 1] === '`') {
    const k = templateKey(text);
    return CYR.test(k.key) ? k : null;
  }
  // Один литерал целиком.
  if (inArg.length === 1 && src.slice(from, to).trim() === src.slice(inArg[0].start, inArg[0].end)) {
    const raw = src.slice(inArg[0].start, inArg[0].end);
    const v = literalValue(raw);
    return CYR.test(v) ? { key: v, pattern: false } : null;
  }
  // Склейка: литералы как есть, всё остальное — {n}. Тернарные выражения внутри не разбираем (они вне литералов).
  let out = '';
  let n = 0;
  let pos = from;
  for (const l of inArg) {
    const between = src.slice(pos, l.start);
    if (/[^\s+()]/.test(between)) out += '{' + n++ + '}';
    const raw = src.slice(l.start, l.end);
    out += literalValue(raw);
    pos = l.end;
  }
  if (/[^\s+()]/.test(src.slice(pos, to))) out += '{' + n++ + '}';
  return CYR.test(out) ? { key: out, pattern: n > 0 } : null;
  void text;
}

function templateKey(raw) {
  const body = raw.slice(1, -1);
  let key = '', n = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === BACKSLASH) { key += body[i + 1] === '`' ? '`' : body[i] + body[i + 1]; i++; continue; }
    if (body[i] === '$' && body[i + 1] === '{') {
      let depth = 1, j = i + 2;
      while (j < body.length && depth) { if (body[j] === '{') depth++; else if (body[j] === '}') depth--; j++; }
      key += '{' + n++ + '}';
      i = j - 1;
      continue;
    }
    key += body[i];
  }
  return { key, pattern: n > 0 };
}

function extract() {
  const items = new Map();
  const add = (key, pattern, file, en) => {
    if (!key || !CYR.test(key)) return;
    const k = key;
    if (!items.has(k)) items.set(k, { key: k, pattern: !!pattern, en: en || '', files: [] });
    const it = items.get(k);
    if (!it.files.includes(file)) it.files.push(file);
    if (!it.en && en) it.en = en;
  };
  for (const file of walk(path.join(WEB, 'js'))) {
    const base = path.basename(file);
    if (SKIP_FILES.has(base)) continue;
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const src = fs.readFileSync(file, 'utf8');
    const lits = literals(src);
    for (const [from, firstEnd, end] of callRanges(src, lits)) {
      const k = argKey(src, from, firstEnd, lits);
      if (!k) continue;
      const enLit = lits.find((l) => l.start > firstEnd && l.end <= end);
      add(k.key, k.pattern, rel, enLit ? literalValue(src.slice(enLit.start, enLit.end)) : '');
    }
    // Файлы данных без T(): пары [ru, en], русские названия примеров, ответы сервера.
    if (/help-data|presets\.js|presets-auto|server-text/.test(base)) {
      for (let i = 0; i < lits.length; i++) {
        const v = literalValue(src.slice(lits[i].start, lits[i].end));
        if (!CYR.test(v)) continue;
        const next = lits[i + 1];
        const gap = next ? src.slice(lits[i].end, next.start) : '';
        const en = next && /^\s*,\s*$/.test(gap) ? literalValue(src.slice(next.start, next.end)) : '';
        if (base === 'server-text.js') { if (/i18n-ok/.test(src.slice(lits[i].end, src.indexOf('\n', lits[i].end)))) add(v.replace(/^\^|\$$/g, ''), false, rel, en); continue; }
        add(v, false, rel, en);
      }
    }
  }
  // index.html: русский текст элементов с data-t, title и placeholder.
  const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
  for (const m of html.matchAll(/<([a-z0-9]+)([^>]*\sdata-t(?:-html)?="[^"]*"[^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const inner = m[3].trim();
    if (/data-t-html/.test(m[2])) add(inner, false, 'web/index.html', (m[2].match(/data-t-html="([^"]*)"/) || [])[1]);
    else if (!/</.test(inner)) add(inner, false, 'web/index.html', (m[2].match(/data-t="([^"]*)"/) || [])[1]);
  }
  // Значение атрибута в DOM — уже с раскрытыми сущностями (&#10; → перевод строки): ключ словаря такой же.
  const attr = (v) => v.replace(/&#(\d+);/g, (x, n) => String.fromCharCode(Number(n))).replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  for (const m of html.matchAll(/\s(title|placeholder|aria-label)="([^"]*[А-Яа-яЁё][^"]*)"/g)) add(attr(m[2]), false, 'web/index.html', '');
  const list = [...items.values()].sort((a, b) => a.files[0].localeCompare(b.files[0]) || a.key.localeCompare(b.key));
  fs.mkdirSync(path.dirname(SRC_JSON), { recursive: true });
  fs.writeFileSync(SRC_JSON, JSON.stringify(list, null, 1) + '\n', 'utf8');
  return list;
}

const placeholders = (s) => (String(s).match(/\{\d+\}/g) || []).sort().join(',');

function build() {
  const uk = JSON.parse(fs.readFileSync(UK_JSON, 'utf8'));
  const src = JSON.parse(fs.readFileSync(SRC_JSON, 'utf8'));
  const exact = {};
  const patterns = [];
  for (const it of src) {
    const v = uk[it.key];
    if (typeof v !== 'string' || !v) continue;
    if (it.pattern) patterns.push([it.key, v]); else exact[it.key] = v;
  }
  // Длинные шаблоны первыми: «Ключ {0} вне 0..255» точнее, чем «{0} вне {1}».
  patterns.sort((a, b) => b[0].replace(/\{\d+\}/g, '').length - a[0].replace(/\{\d+\}/g, '').length);
  fs.writeFileSync(OUT_JS, '// Сгенерировано tools/i18n_uk.js из tools/i18n/uk.json — не редактировать вручную.\n'
    + 'self.I18N_UK = ' + JSON.stringify({ exact, patterns }) + ';\n', 'utf8');
  return { exact: Object.keys(exact).length, patterns: patterns.length };
}

/** Проблемы перевода: нет перевода, потеряны плейсхолдеры, остались русские буквы ы/э/ъ/ё. */
function check() {
  const src = extract();
  const uk = fs.existsSync(UK_JSON) ? JSON.parse(fs.readFileSync(UK_JSON, 'utf8')) : {};
  const missing = [], broken = [], russian = [];
  for (const it of src) {
    const v = uk[it.key];
    if (typeof v !== 'string' || !v.trim()) { missing.push(it.key); continue; }
    if (placeholders(v) !== placeholders(it.key)) broken.push(it.key);
    // Буквы, которых нет в украинском, допустимы только там, где они есть и в оригинале (данные, примеры шифров).
    const ru = (s) => (String(s).match(/[ыэъё]/gi) || []).length;
    if (ru(v) > ru(it.key)) russian.push(it.key);
  }
  return { total: src.length, missing, broken, russian };
}

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'extract') { const l = extract(); console.log('strings', l.length, 'patterns', l.filter((x) => x.pattern).length); }
  else if (cmd === 'build') console.log(build());
  else if (cmd === 'check') { const r = check(); console.log(JSON.stringify({ total: r.total, missing: r.missing.length, broken: r.broken.length, russian: r.russian.length })); if (r.missing.length + r.broken.length) { console.log(r.missing.slice(0, 10), r.broken.slice(0, 10)); process.exitCode = 1; } }
  else console.log('usage: node tools/i18n_uk.js extract|build|check');
}
module.exports = { extract, build, check, placeholders };
