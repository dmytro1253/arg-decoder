// Просмотр больших текстовых логов: подсветка hex/base64/URL/координат/кодов § Minecraft, поиск и
// выгрузка найденных кандидатов. Чистая логика (без DOM) — интерфейс лежит в node-log.js.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = (G.ArgFiles = G.ArgFiles || {});

  const MAX_LINE_HIGHLIGHT = 4000; // сверхдлинные строки подсвечиваем только по началу
  const NUM = '-?\\d{1,7}(?:\\.\\d+)?';

  // Порядок = приоритет при пересечении (меньше индекс — важнее).
  const KINDS = [
    { type: 'url', re: /(?:https?:\/\/|www\.)[^\s<>"'`)\]]+/gi, label: () => T('Ссылки', 'URLs') },
    { type: 'coord', re: new RegExp('(?:\\b[xyz]\\s*[:=]\\s*' + NUM + '[\\s,;/]*){2,3}|\\bXYZ:\\s*' + NUM + '\\s*[/,]\\s*' + NUM + '\\s*[/,]\\s*' + NUM
      + '|[\\[(<]\\s*' + NUM + '\\s*,\\s*' + NUM + '\\s*,\\s*' + NUM + '\\s*[\\])>]', 'gi'), label: () => T('Координаты', 'Coordinates') },
    { type: 'mc', re: /§[0-9a-fk-or]/gi, label: () => T('Коды §', '§ codes') },
    { type: 'uuid', re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, label: () => 'UUID' },
    { type: 'hex', re: /\b(?:0x[0-9a-f]{4,}|[0-9a-f]{8,})\b/gi, label: () => 'HEX' },
    { type: 'b64', re: /(?<![A-Za-z0-9+/=_-])[A-Za-z0-9+/_-]{16,}={0,2}(?![A-Za-z0-9+/=_-])/g, label: () => 'Base64' },
  ];
  const TYPES = KINDS.map((k) => k.type);

  function validMatch(type, s) {
    if (type === 'hex') return /^0x/i.test(s) || /[a-f]/i.test(s); // чисто десятичные числа — не hex-улики
    if (type === 'b64') {
      if (/^[0-9a-f]+$/i.test(s)) return false; // это уже hex
      const classes = (/[a-z]/.test(s) ? 1 : 0) + (/[A-Z]/.test(s) ? 1 : 0) + (/\d/.test(s) ? 1 : 0);
      return classes >= 2 && !/^[A-Za-z]+$/.test(s);
    }
    return true;
  }

  /** Подсветка одной строки. @returns {{start:number,end:number,type:string}[]} без пересечений, по возрастанию start */
  function highlightLine(line) {
    const text = line.length > MAX_LINE_HIGHLIGHT ? line.slice(0, MAX_LINE_HIGHLIGHT) : line;
    const cands = [];
    KINDS.forEach((k, prio) => {
      k.re.lastIndex = 0;
      for (let m = k.re.exec(text); m; m = k.re.exec(text)) {
        if (!m[0]) { k.re.lastIndex++; continue; }
        if (validMatch(k.type, m[0])) cands.push({ start: m.index, end: m.index + m[0].length, type: k.type, prio });
      }
    });
    cands.sort((a, b) => a.prio - b.prio || (b.end - b.start) - (a.end - a.start));
    const chosen = [];
    for (const c of cands) {
      if (!chosen.some((x) => c.start < x.end && x.start < c.end)) chosen.push(c);
    }
    return chosen.sort((a, b) => a.start - b.start).map(({ start, end, type }) => ({ start, end, type }));
  }

  /** Все уникальные находки заданных типов, в порядке появления. @returns {{type:string,text:string,line:number}[]} */
  function extractCandidates(text, types) {
    const want = new Set(types && types.length ? types : TYPES);
    const seen = new Set();
    const out = [];
    text.split(/\r?\n/).forEach((line, i) => {
      for (const s of highlightLine(line)) {
        if (!want.has(s.type) || s.type === 'mc') continue;
        const t = line.slice(s.start, s.end);
        if (seen.has(s.type + t)) continue;
        seen.add(s.type + t);
        out.push({ type: s.type, text: t, line: i + 1 });
      }
    });
    return out;
  }

  function makeMatcher(query, o) {
    if (!query) return null;
    const flags = o && o.ignoreCase === false ? '' : 'i';
    try {
      return new RegExp(o && o.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    } catch (e) {
      throw new Error(T('Неверное регулярное выражение: ', 'Invalid regular expression: ') + e.message);
    }
  }

  /** Индексы строк, подходящих под запрос (не больше limit). */
  function searchLines(lines, query, opts) {
    const re = makeMatcher(query, opts);
    if (!re) return [];
    const limit = (opts && opts.limit) || 5000;
    const hits = [];
    for (let i = 0; i < lines.length && hits.length < limit; i++) if (re.test(lines[i])) hits.push(i);
    return hits;
  }

  /** Строки совпадений с контекстом и номерами: «  12│ текст», блоки разделяются «--». */
  function filterText(text, query, opts) {
    const o = Object.assign({ context: 0, invert: false }, opts || {});
    const lines = text.split(/\r?\n/);
    const hit = new Set(searchLines(lines, query, Object.assign({}, o, { limit: 100000 })));
    const keep = new Set();
    for (let i = 0; i < lines.length; i++) {
      const wanted = o.invert ? !hit.has(i) : hit.has(i);
      if (!wanted) continue;
      for (let k = Math.max(0, i - o.context); k <= Math.min(lines.length - 1, i + o.context); k++) keep.add(k);
    }
    const width = String(lines.length).length;
    const out = [];
    let prev = -2;
    [...keep].sort((a, b) => a - b).forEach((i) => {
      if (prev >= 0 && i !== prev + 1 && o.context > 0) out.push('--');
      out.push(String(i + 1).padStart(width) + '│ ' + lines[i]);
      prev = i;
    });
    return out.join('\n');
  }

  NS.LogView = { highlightLine, extractCandidates, searchLines, filterText, TYPES, KINDS };
})(typeof self !== 'undefined' ? self : this);
