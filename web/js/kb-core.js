// Ядро экранных клавиатур (чистая логика, без DOM): реестр раскладок, поиск клавиш, backspace по целым знакам.
// Раскладка: { id, order, tab, name, note, search, sections: [{ title, keys }], tokens?, encode?(text), decode?(text, lang), filter?, alt?, widget? }.
// Клавиша:   { ins, glyph, cap?, title?, src?, insAlt?, swatch?, label? } — ins вставляется в поле, glyph рисуется на кнопке.
(function (G) {
  'use strict';

  const layouts = new Map();

  /** Регистрирует раскладку (повторная регистрация того же id заменяет её). Клавишам добавляется строка поиска find. */
  function register(layout) {
    const sections = layout.sections.map((sec) => ({
      title: sec.title,
      keys: sec.keys.map((k) => Object.assign({}, k, { find: [k.cap, k.title, k.glyph, k.ins, [].concat(k.src || []).join(' ')].filter(Boolean).join(' ').toLowerCase() })),
    }));
    layouts.set(layout.id, Object.assign({}, layout, { sections }));
    return layouts.get(layout.id);
  }

  const list = () => Array.from(layouts.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
  const get = (id) => layouts.get(id) || null;
  const allKeys = (layout) => layout.sections.flatMap((s) => s.keys);

  const graphemes = (s) => (typeof Intl !== 'undefined' && Intl.Segmenter
    ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s), (x) => x.segment)
    : Array.from(s));

  /** Многосимвольные «знаки», которые backspace стирает целиком: самые длинные первыми. */
  const sortTokens = (tokens) => Array.from(new Set(tokens)).filter(Boolean).sort((a, b) => b.length - a.length);

  /**
   * Backspace по тексту: выделение удаляется целиком, иначе стирается один знак раскладки (даже из нескольких кодовых единиц,
   * например «§a» или «ℸ̣») либо один обычный символ. Возвращает { text, caret }.
   */
  function deleteBackward(text, start, end, tokens) {
    const to = end === undefined ? start : end;
    if (to > start) return { text: text.slice(0, start) + text.slice(to), caret: start };
    if (start <= 0) return { text, caret: 0 };
    const before = text.slice(0, start);
    const token = (tokens || []).find((t) => before.endsWith(t));
    let cut;
    if (token) cut = token.length;
    else { const parts = graphemes(before); cut = parts.length ? parts[parts.length - 1].length : 1; }
    return { text: before.slice(0, before.length - cut) + text.slice(start), caret: start - cut };
  }

  /**
   * Какие клавиши подсветить по тексту в строке поиска.
   * layout.filter — клавиши, в описании которых есть запрос (для больших наборов); иначе запрос читается как текст:
   * его буквы (src клавиш, самые длинные первыми: th, ng) и уже готовые знаки подсвечиваются. Возвращает { hits: Set, last }.
   */
  function matchKeys(layout, query) {
    const q = String(query).toLowerCase().trim();
    const keys = allKeys(layout);
    const hits = new Set();
    let last = null;
    if (!q) return { hits, last };
    if (layout.filter) {
      for (const k of keys) if (k.find.includes(q)) { hits.add(k); last = k; }
      return { hits, last };
    }
    const bySrc = new Map();
    for (const k of keys) for (const s of [].concat(k.src || [])) bySrc.set(s, (bySrc.get(s) || []).concat(k));
    const srcs = Array.from(bySrc.keys()).sort((a, b) => b.length - a.length);
    for (let i = 0; i < q.length;) {
      const s = srcs.find((x) => q.startsWith(x, i));
      if (s) { for (const k of bySrc.get(s)) { hits.add(k); last = k; } i += s.length; } else i += 1;
    }
    for (const k of keys) if (k.ins.trim() && q.includes(k.ins.trim())) hits.add(k);
    return { hits, last };
  }

  G.KbCore = { register, list, get, allKeys, graphemes, sortTokens, deleteBackward, matchKeys };
})(typeof self !== 'undefined' ? self : this);
