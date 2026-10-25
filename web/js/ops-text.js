// Операции над текстом: реверс, раскладка, регистр, фильтры, подготовка пробелов, склейка и разбиение.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const C = G.Codec;
  const { def, hasLatin, hasCyr } = G.CipherOps;
  const NEWLINE = /\r\n|\r|\n/;
  const LOOSE_SPACE = /[\s ]/g;

  def({
    id: 'reverse', name: T('Реверс', 'Reverse'), cat: 'Текст', prior: 5,
    desc: T('Перевернуть строку целиком, каждое слово или группы по N символов.', 'Reverse the whole string, each word or groups of N characters.'),
    params: [
      { key: 'mode', label: T('Что переворачивать', 'What to reverse'), type: 'select', options: [['all', T('Всю строку', 'The whole string')], ['words', T('Каждое слово', 'Each word')], ['lines', T('Каждую строку', 'Each line')], ['groups', T('Группы по N', 'Groups of N')]], default: 'all' },
      { key: 'n', label: T('N (для групп)', 'N (for groups)'), type: 'number', int: true, min: 1, max: 1000000, default: 2 },
    ],
    run([t], p) {
      const rev = (s) => Array.from(s).reverse().join('');
      if (p.mode === 'words') return t.replace(/\S+/g, rev);
      // Строки переворачиваем по отдельности и сохраняем исходные переводы строк (в том числе CRLF).
      if (p.mode === 'lines') return t.split(/(\r\n|\r|\n)/).map((part, i) => (i % 2 ? part : rev(part))).join('');
      if (p.mode === 'groups') {
        const chars = Array.from(t), n = Math.max(1, Number(p.n));
        let out = '';
        for (let i = 0; i < chars.length; i += n) out += chars.slice(i, i + n).reverse().join('');
        return out;
      }
      return rev(t);
    },
    probes(t) { return t.length >= 3 ? [{ mode: 'all' }].concat(/\s/.test(t.trim()) ? [{ mode: 'words' }] : []) : []; },
  });

  def({
    id: 'layout', name: T('Раскладка клавиатуры', 'Keyboard layout'), cat: 'Текст', prior: 6,
    desc: T('Те же клавиши в другой раскладке: yfqlbvtyz ↔ найдименя.', 'The same keys in another layout: yfqlbvtyz ↔ найдименя.'),
    params: [{ key: 'dir', label: T('Направление', 'Direction'), type: 'select', options: [['en2ru', T('EN → RU (ghbdtn → привет)', 'EN → RU (ghbdtn → привет)')], ['ru2en', 'RU → EN'], ['en2uk', T('EN → UK (ghbdsn → привіт)', 'EN → UK (ghbdsn → привіт)')], ['uk2en', 'UK → EN']], default: 'en2ru' }],
    run([t], p) { return C.layout(t, p.dir); },
    probes(t) {
      const res = [];
      if (hasLatin(t)) res.push({ dir: 'en2ru' }, { dir: 'en2uk' });
      if (hasCyr(t)) res.push({ dir: /[іїєґ]/i.test(t) ? 'uk2en' : 'ru2en' });
      return res;
    },
  });

  def({
    id: 'translit', name: T('Транслитерация', 'Transliteration'), cat: 'Текст', prior: 1,
    params: [{ key: 'dir', label: T('Направление', 'Direction'), type: 'select', options: [['ru2lat', T('Кириллица → латиница', 'Cyrillic → Latin')], ['lat2ru', T('Латиница → кириллица', 'Latin → Cyrillic')]], default: 'ru2lat' }],
    run([t], p) { return p.dir === 'ru2lat' ? C.translitRuToLat(t) : C.translitLatToRu(t); },
    probes(t) { return hasLatin(t) && !hasCyr(t) && t.length >= 4 ? [{ dir: 'lat2ru' }] : []; },
  });

  def({
    id: 'case', name: T('Регистр', 'Letter case'), cat: 'Текст',
    params: [{ key: 'mode', label: T('Режим', 'Mode'), type: 'select', options: [['upper', T('ВСЕ ЗАГЛАВНЫЕ', 'ALL CAPITALS')], ['lower', T('все строчные', 'all lowercase')], ['swap', T('иНВЕРТИРОВАТЬ', 'iNVERT')]], default: 'lower' }],
    run([t], p) {
      if (p.mode === 'upper') return t.toUpperCase();
      if (p.mode === 'lower') return t.toLowerCase();
      return Array.from(t, (ch) => (ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase())).join('');
    },
  });

  def({
    id: 'filter', name: T('Оставить / удалить символы', 'Keep / remove characters'), cat: 'Текст',
    desc: T('Буквы любого алфавита (в том числе украинские ґ є і ї), цифры, пробелы или удаление по regex.', 'Letters of any alphabet (including Ukrainian ґ є і ї), digits, spaces or removal by regex.'),
    params: [
      { key: 'mode', label: T('Режим', 'Mode'), type: 'select', options: [['letters', T('Только буквы', 'Letters only')], ['alnum', T('Буквы и цифры', 'Letters and digits')], ['digits', T('Только цифры', 'Digits only')], ['nospace', T('Убрать пробелы', 'Remove whitespace')], ['regex', T('Удалить по regex', 'Remove by regex')]], default: 'nospace' },
      { key: 'regex', label: 'Regex', type: 'text', default: '[^A-Za-z]' },
    ],
    run([t], p) {
      if (p.mode === 'letters') return t.replace(/[^\p{L}]/gu, '');
      if (p.mode === 'alnum') return t.replace(/[^\p{L}\p{Nd}]/gu, '');
      if (p.mode === 'digits') return t.replace(/\D/g, '');
      if (p.mode === 'nospace') return t.replace(/\s/g, '');
      try { return t.replace(new RegExp(p.regex, 'gu'), ''); } catch (e) { throw new Error(T('Неверное регулярное выражение', 'Invalid regular expression')); }
    },
  });

  // Подготовка пробелов — явный шаг цепочки, оригинал не теряется. Пробелы бывают значимыми
  // (Морзе, мультитап, номера в книжном шифре), поэтому автопоиск пробует эти варианты
  // только в самом начале цепочки и как отдельные гипотезы.
  def({
    id: 'ws_prep', name: T('Подготовка пробелов', 'Whitespace preparation'), cat: 'Текст', prior: 2,
    desc: T('Обратимые варианты подготовки текста: обрезать края, привести переносы к LF, схлопнуть повторы, убрать все пробелы или только переносы строк. Невидимые символы нулевой ширины не трогает (для них есть отдельная нода).', 'Explicit text-preparation variants: trim the edges, normalise line breaks to LF, collapse repeats, remove all spaces or only line breaks. Zero-width characters are left alone (they have their own node).'),
    params: [{ key: 'mode', label: T('Вариант', 'Variant'), type: 'select', options: [['trim', T('Обрезать пробелы по краям', 'Trim the edges')], ['newlines', T('Переводы строк → LF (CRLF/CR)', 'Line breaks → LF (CRLF/CR)')], ['collapse', T('Схлопнуть повторы пробелов', 'Collapse repeated spaces')], ['nospace', T('Убрать все пробельные символы', 'Remove all whitespace')], ['nolines', T('Убрать только переносы строк', 'Remove line breaks only')]], default: 'nospace' }],
    run([t], p) {
      if (p.mode === 'trim') return t.trim();
      if (p.mode === 'newlines') return t.replace(/\r\n?/g, '\n');
      if (p.mode === 'collapse') return t.replace(/[ \t ]+/g, ' ').replace(/ ?(\r\n|\r|\n) ?/g, '\n');
      if (p.mode === 'nolines') return t.replace(/\r\n|\r|\n/g, '');
      return t.replace(LOOSE_SPACE, '');
    },
    probes(t, ctx) {
      // Подготовка — только в начале: после других шагов пробелы уже не оригинальные.
      const chain = (ctx && ctx.chain) || [];
      if (chain.some((c) => c.op !== 'ws_prep' && c.op !== 'extract_candidates') || chain.some((c) => c.op === 'ws_prep')) return [];
      if (/^[.\-·•−–—_\s/]+$/.test(t.trim())) return [];       // Морзе и тап-код: пробелы значимы
      const res = [];
      if (/\r/.test(t)) res.push({ mode: 'newlines' });
      if (t !== t.trim()) res.push({ mode: 'trim' });
      const body = t.trim();
      const tokens = body.split(/[\s ]+/).filter(Boolean);
      if (tokens.length >= 2 && body.length >= 6 && body.length <= 400 && tokens.every((x) => x.length <= 12)) {
        if (/[\r\n]/.test(body)) res.push({ mode: 'nolines' });
        res.push({ mode: 'nospace' });
      }
      return res;
    },
  });

  def({
    id: 'replace', name: T('Найти и заменить', 'Find and replace'), cat: 'Текст',
    params: [
      { key: 'find', label: T('Найти', 'Find'), type: 'text', default: '' },
      { key: 'repl', label: T('Заменить на', 'Replace with'), type: 'text', default: '' },
      { key: 'regex', label: T('Это regex', 'Is a regex'), type: 'bool', default: false },
    ],
    run([t], p) {
      if (!p.find) return t;
      if (!p.regex) return t.split(p.find).join(p.repl);
      try { return t.replace(new RegExp(p.find, 'gu'), p.repl); } catch (e) { throw new Error(T('Неверное регулярное выражение', 'Invalid regular expression')); }
    },
  });

  def({
    id: 'slice', name: T('Часть строки', 'Part of the string'), cat: 'Текст',
    desc: T('Символы с позиции «От» до «До» (с 1), с шагом. Шаг 2 — каждый второй символ.', 'Characters from “From” to “To” (1-based), with a step. Step 2 means every second character.'),
    params: [
      { key: 'from', label: T('От', 'From'), type: 'number', int: true, min: 1, max: 100000000, default: 1 },
      { key: 'to', label: T('До (0 = конец)', 'To (0 = end)'), type: 'number', int: true, min: 0, max: 100000000, default: 0 },
      { key: 'step', label: T('Шаг', 'Step'), type: 'number', int: true, min: 1, max: 100000000, default: 1 },
    ],
    run([t], p) {
      const chars = Array.from(t);
      const end = Number(p.to) > 0 ? Number(p.to) : chars.length;
      const step = Math.max(1, Number(p.step));
      let out = '';
      for (let i = Math.max(1, Number(p.from)) - 1; i < end && i < chars.length; i += step) out += chars[i];
      return out;
    },
  });

  def({
    id: 'swap_pairs', name: T('Поменять соседние символы', 'Swap adjacent characters'), cat: 'Перестановки',
    desc: T('abcd → badc. Полезно для перевёрнутых полубайтов hex.', 'abcd → badc. Useful for hex with swapped nibbles.'),
    run([t]) {
      const c = Array.from(t);
      for (let i = 0; i + 1 < c.length; i += 2) [c[i], c[i + 1]] = [c[i + 1], c[i]];
      return c.join('');
    },
  });

  def({
    id: 'join', name: T('Склеить', 'Join'), cat: 'Объединение', inputs: ['A', 'B'],
    desc: T('Соединить два входа: склейка фрагментов вроде AgL + L2GD + LrgQ.', 'Join two inputs: gluing fragments such as AgL + L2GD + LrgQ.'),
    params: [{ key: 'sep', label: T('Разделитель', 'Separator'), type: 'text', default: '' }],
    run(inputs, p) { return inputs.filter((x) => x !== undefined && x !== null).join(p.sep); },
  });

  def({
    id: 'join3', name: T('Склеить 3', 'Join 3'), cat: 'Объединение', inputs: ['A', 'B', 'C'],
    params: [{ key: 'sep', label: T('Разделитель', 'Separator'), type: 'text', default: '' }],
    run(inputs, p) { return inputs.filter((x) => x !== undefined && x !== null).join(p.sep); },
  });

  def({
    id: 'interleave', name: T('Чередовать', 'Interleave'), cat: 'Объединение', inputs: ['A', 'B'],
    desc: 'A1 B1 A2 B2 …',
    run(inputs) {
      const a = Array.from(inputs[0] || ''), b = Array.from(inputs[1] || '');
      let out = '';
      for (let i = 0; i < Math.max(a.length, b.length); i++) out += (a[i] || '') + (b[i] || '');
      return out;
    },
  });

  def({
    id: 'split_take', name: T('Разделить и взять часть', 'Split and take a part'), cat: 'Объединение',
    desc: T('Без разделителя режет по переводам строк (LF, CRLF и CR считаются одинаково).', 'With no separator it splits on line breaks (LF, CRLF and CR are treated alike).'),
    params: [
      { key: 'sep', label: T('Разделитель (пусто = перенос строки)', 'Separator (empty = line break)'), type: 'text', default: '' },
      { key: 'n', label: T('Номер части (с 1)', 'Part number (from 1)'), type: 'number', int: true, min: 1, max: 100000000, default: 1 },
    ],
    run([t], p) {
      const parts = p.sep ? t.split(p.sep) : t.split(NEWLINE);
      const part = parts[Number(p.n) - 1];
      if (part === undefined) throw new Error(T('Частей всего ' + parts.length, 'There are only ' + parts.length + ' parts'));
      return part;
    },
  });

  def({
    id: 'chunk', name: T('Разбить на группы', 'Split into groups'), cat: 'Текст',
    params: [
      { key: 'n', label: T('По N символов', 'N characters each'), type: 'number', int: true, min: 1, max: 1000000, default: 2 },
      { key: 'sep', label: T('Разделитель', 'Separator'), type: 'text', default: ' ' },
    ],
    run([t], p) {
      const c = Array.from(t.replace(/\s/g, '')), n = Math.max(1, Number(p.n)), out = [];
      for (let i = 0; i < c.length; i += n) out.push(c.slice(i, i + n).join(''));
      return out.join(p.sep);
    },
  });
})(typeof self !== 'undefined' ? self : this);
