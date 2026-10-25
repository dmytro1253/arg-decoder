// Универсальные операции для чисел, регистра и сборки фрагментов:
// числа → буквы (основание 0/1, модуль, смещение, свой алфавит), регистр как биты,
// перестановки фрагментов с ограничениями.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const C = G.Codec;
  const { def, lenient } = G.CipherOps;
  const MAX_FRAGMENTS = 8;
  const MAX_CUSTOM_ALPHABET = 200;

  // ===================== Числа → буквы =====================
  const ALPHA_OPTIONS = [
    ['en', T('Латиница (26)', 'Latin (26)')], ['ru33', T('Кириллица с Ё (33)', 'Cyrillic with Ё (33)')],
    ['ru32', T('Кириллица без Ё (32)', 'Cyrillic without Ё (32)')], ['uk33', T('Украинский (33)', 'Ukrainian (33)')],
    ['custom', T('Свой алфавит', 'Custom alphabet')],
  ];

  function alphabetOf(p) {
    const letters = p.alpha === 'custom' ? Array.from(p.custom || '') : Array.from(C.ALPHABETS[p.alpha] || '');
    if (!letters.length) throw new Error(T('Алфавит пуст: задайте «Свой алфавит»', 'The alphabet is empty: fill in “Custom alphabet”'));
    if (letters.length > MAX_CUSTOM_ALPHABET) throw new Error(T('Алфавит слишком длинный', 'The alphabet is too long'));
    return letters;
  }

  // Числа и «разрывы» (знаки препинания, переводы строк) в порядке следования.
  function numberTokens(text) {
    const out = [];
    const re = /(-?\d+)|([,.;:!?…]+)|(\r\n|\r|\n)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[1] !== undefined) {
        const negative = m[1][0] === '-';
        // «-» считаем знаком, только если он стоит в начале или после пробела: «1-2» — это разделитель.
        if (negative && m.index > 0 && !/\s/.test(text[m.index - 1])) { out.push({ n: Math.abs(Number(m[1])) }); continue; }
        out.push({ n: Number(m[1]) });
      } else out.push({ brk: m[2] ? 'punct' : 'line' });
    }
    return out;
  }

  def({
    id: 'num_letters', name: T('Числа → буквы (модуль)', 'Numbers → letters (modulo)'), cat: 'Кодировки', prior: 3,
    desc: T('Универсальное отображение чисел в буквы: нумерация с 0 или 1, смещение, вычет по модулю длины алфавита (27 → A при 26 буквах), свой алфавит. Знаки препинания и переводы строк могут превращаться в пробелы.', 'A universal number-to-letter mapping: numbering from 0 or 1, an offset, reduction modulo the alphabet length (27 → A with 26 letters), a custom alphabet. Punctuation and line breaks can become spaces.'),
    params: [
      { key: 'alpha', label: T('Алфавит', 'Alphabet'), type: 'select', options: ALPHA_OPTIONS, default: 'en' },
      { key: 'custom', label: T('Свой алфавит (буквы по порядку)', 'Custom alphabet (letters in order)'), type: 'text', default: '' },
      { key: 'base', label: T('Первая буква =', 'First letter ='), type: 'number', int: true, min: -1000, max: 1000, default: 1 },
      { key: 'offset', label: T('Смещение (прибавить к числу)', 'Offset (added to each number)'), type: 'number', int: true, min: -1000000, max: 1000000, default: 0 },
      { key: 'range', label: T('Числа вне алфавита', 'Numbers outside the alphabet'), type: 'select', options: [['modulo', T('По модулю (циклически)', 'Modulo (wrap around)')], ['strict', T('Ошибка', 'Error')], ['skip', T('Пропускать с предупреждением', 'Skip with a warning')]], default: 'modulo' },
      { key: 'breaks', label: T('Разрывы', 'Breaks'), type: 'select', options: [['none', T('Всё слитно', 'Run together')], ['punct', T('Пробел на знаках препинания', 'Space at punctuation')], ['lines', T('Перенос строки сохраняется', 'Keep line breaks')], ['all', T('Знаки → пробел, строки → перенос', 'Punctuation → space, lines → newline')]], default: 'none' },
      { key: 'out', label: T('Регистр результата', 'Output case'), type: 'select', options: [['upper', T('ЗАГЛАВНЫЕ', 'UPPERCASE')], ['lower', T('строчные', 'lowercase')]], default: 'upper' },
    ],
    run([t], p) {
      const letters = alphabetOf(p);
      const size = letters.length;
      const tokens = numberTokens(t);
      if (!tokens.some((x) => x.n !== undefined)) throw new Error(T('В тексте нет чисел', 'There are no numbers in the text'));
      let out = '';
      const lineBreak = p.breaks === 'lines' || p.breaks === 'all';
      const spaceBreak = p.breaks === 'punct' || p.breaks === 'all';
      const skipped = [];
      for (const tok of tokens) {
        if (tok.brk === 'punct') { if (spaceBreak && out && !out.endsWith(' ') && !out.endsWith('\n')) out += ' '; continue; }
        if (tok.brk === 'line') { if (lineBreak && out && !out.endsWith('\n')) out = out.replace(/ $/, '') + '\n'; continue; }
        const idx = tok.n + Number(p.offset) - Number(p.base);
        let i = idx;
        if (idx < 0 || idx >= size) {
          if (p.range === 'strict') throw new Error(T('Число ' + tok.n + ' вне алфавита из ' + size + ' букв', 'Number ' + tok.n + ' is outside the ' + size + '-letter alphabet'));
          if (p.range === 'skip') { skipped.push(tok.n); continue; }
          i = C.mod(idx, size);
        }
        out += letters[i];
      }
      if (skipped.length) lenient(false, T('Пропущены числа вне алфавита: ' + skipped.join(', '), 'Numbers outside the alphabet were skipped: ' + skipped.join(', ')));
      out = out.trim();
      return p.out === 'lower' ? out.toLowerCase() : out.toUpperCase();
    },
    // Предлагается только там, где обычный A1Z26 не справится: числа выходят за пределы алфавита.
    probes(t) {
      const s = t.trim();
      if (!/^[\d\s,.;:!?\-]+$/.test(s)) return [];
      const nums = (s.match(/\d+/g) || []).map(Number);
      if (nums.length < 6 || Math.max(...nums) <= 26) return [];
      const punct = /[,.;:!?]/.test(s);
      return [{ alpha: 'en', custom: '', base: 1, offset: 0, range: 'modulo', breaks: punct ? 'punct' : 'none', out: 'upper' }];
    },
  });

  // ===================== Регистр как биты =====================
  const hasCase = (ch) => ch.toLowerCase() !== ch.toUpperCase();

  function caseBits(text, upperIsOne) {
    let bits = '';
    for (const ch of text) {
      if (!hasCase(ch)) continue;
      const upper = ch === ch.toUpperCase();
      bits += (upper === upperIsOne) ? '1' : '0';
    }
    return bits;
  }

  // Заглавная в начале слова — обычное правописание, а не канал данных. Канал данных подозрителен,
  // когда регистр перемешан внутри слов и оба регистра встречаются заметно часто.
  function unnaturalCase(text) {
    let letters = 0, uppers = 0, odd = 0;
    let prev = ' ';
    for (const ch of text) {
      if (hasCase(ch)) {
        letters++;
        if (ch === ch.toUpperCase()) { uppers++; if (hasCase(prev)) odd++; }
      }
      prev = ch;
    }
    return { letters, uppers, odd };
  }

  def({
    id: 'case_bits', name: T('Регистр → биты', 'Letter case → bits'), cat: 'Скрытое', prior: 2,
    desc: T('Регистр букв как поток битов (заглавная = 1, строчная = 0 или наоборот), без обязательного шифра Бэкона. Результат — биты, байты по 8 или 7 бит либо буквы по 5 бит.', 'Letter case as a bit stream (upper = 1, lower = 0 or the inverse), without requiring the Bacon cipher. The result is bits, bytes of 8 or 7 bits, or letters of 5 bits.'),
    params: [
      { key: 'upper', label: T('Заглавная =', 'Uppercase ='), type: 'select', options: [['1', '1'], ['0', '0']], default: '1' },
      { key: 'out', label: T('Результат', 'Output'), type: 'select', options: [['bits', T('Биты (строка 0/1)', 'Bits (a 0/1 string)')], ['text8', T('Текст из 8 бит', 'Text from 8 bits')], ['text7', T('Текст из 7 бит', 'Text from 7 bits')], ['letters5', T('Буквы A–Z из 5 бит (Бэкон)', 'Letters A–Z from 5 bits (Bacon)')]], default: 'bits' },
      G.CipherOps.STRICT_PARAM,
    ],
    run([t], p) {
      const bits = caseBits(t, p.upper === '1');
      if (!bits) throw new Error(T('В тексте нет букв с регистром', 'The text has no cased letters'));
      if (p.out === 'bits') return bits;
      const width = p.out === 'text7' ? 7 : p.out === 'letters5' ? 5 : 8;
      if (bits.length % width) lenient(p.strict, T('Хвост из ' + (bits.length % width) + ' бит не образует группу из ' + width + ' и отброшен', 'A tail of ' + (bits.length % width) + ' bits does not form a group of ' + width + ' and was dropped'));
      let out = '';
      for (let i = 0; i + width <= bits.length; i += width) {
        const v = parseInt(bits.substr(i, width), 2);
        out += p.out === 'letters5' ? (String.fromCharCode(65 + v) || '?') : String.fromCharCode(v);
      }
      return out;
    },
    probes(t, ctx) {
      if (ctx && ctx.depth > 0) return [];
      const st = unnaturalCase(t);
      const share = st.uppers / Math.max(1, st.letters);
      if (!/\s/.test(t.trim()) || st.letters < 16 || share < 0.15 || share > 0.85 || st.odd / st.letters < 0.15) return [];
      return [{ upper: '1', out: 'bits' }, { upper: '0', out: 'bits' }];
    },
  });

  // ===================== Перестановки фрагментов =====================
  function* permutations(items) {
    const n = items.length;
    const idx = Array.from({ length: n }, (_, i) => i);
    const c = new Array(n).fill(0);
    yield idx.map((i) => items[i]);
    let i = 0;
    while (i < n) {
      if (c[i] < i) {
        const k = i % 2 === 0 ? 0 : c[i];
        [idx[k], idx[i]] = [idx[i], idx[k]];
        yield idx.map((j) => items[j]);
        c[i]++;
        i = 0;
      } else { c[i] = 0; i++; }
    }
  }

  def({
    id: 'permute_fragments', name: T('Перестановки фрагментов', 'Fragment permutations'), cat: 'Перестановки', prior: 0,
    desc: T('Перебирает порядки небольшого числа фрагментов (до 8) и оставляет только подходящие под ограничения: начало, конец, подстрока, длина, регулярное выражение или «похоже на ID/ссылку сервиса». Результат — по одному варианту в строке.', 'Tries the orders of a small number of fragments (up to 8) and keeps only those matching the constraints: start, end, substring, length, a regular expression or “looks like a service ID/link”. One result per line.'),
    params: [
      { key: 'sep', label: T('Разделитель фрагментов (пусто = пробелы/переносы/запятые)', 'Fragment separator (empty = spaces/newlines/commas)'), type: 'text', default: '' },
      { key: 'join', label: T('Склеивать через', 'Join with'), type: 'text', default: '' },
      { key: 'prefix', label: T('Должно начинаться с', 'Must start with'), type: 'text', default: '' },
      { key: 'suffix', label: T('Должно заканчиваться на', 'Must end with'), type: 'text', default: '' },
      { key: 'contains', label: T('Должно содержать', 'Must contain'), type: 'text', default: '' },
      { key: 'length', label: T('Длина результата (0 = любая)', 'Result length (0 = any)'), type: 'number', int: true, min: 0, max: 100000, default: 0 },
      { key: 'regex', label: T('Регулярное выражение (необяз.)', 'Regular expression (optional)'), type: 'text', default: '' },
      { key: 'service', label: T('Только похожие на ID сервиса', 'Only service-ID-like results'), type: 'bool', default: false },
      { key: 'limit', label: T('Максимум результатов', 'Maximum results'), type: 'number', int: true, min: 1, max: 5000, default: 200 },
    ],
    run([t], p) {
      const parts = (p.sep ? t.split(p.sep) : t.split(/[\s,;]+/)).filter((x) => x !== '');
      if (parts.length < 2) throw new Error(T('Нужно хотя бы 2 фрагмента', 'At least 2 fragments are required'));
      if (parts.length > MAX_FRAGMENTS) throw new Error(T('Слишком много фрагментов (' + parts.length + '): максимум ' + MAX_FRAGMENTS, 'Too many fragments (' + parts.length + '): at most ' + MAX_FRAGMENTS));
      let re = null;
      if (p.regex) { try { re = new RegExp(p.regex, 'u'); } catch (e) { throw new Error(T('Неверное регулярное выражение', 'Invalid regular expression')); } }
      const seen = new Set();
      const out = [];
      for (const perm of permutations(parts)) {
        const s = perm.join(p.join);
        if (seen.has(s)) continue;
        seen.add(s);
        if (p.prefix && !s.startsWith(p.prefix)) continue;
        if (p.suffix && !s.endsWith(p.suffix)) continue;
        if (p.contains && !s.includes(p.contains)) continue;
        if (Number(p.length) > 0 && Array.from(s).length !== Number(p.length)) continue;
        if (re && !re.test(s)) continue;
        if (p.service && !(G.Links && G.Links.detect(s).some((l) => l.confidence >= 2))) continue;
        out.push(s);
        if (out.length >= Number(p.limit)) break;
      }
      if (!out.length) throw new Error(T('Ни одна перестановка не подошла под ограничения', 'No permutation matches the constraints'));
      return out.join('\n');
    },
  });

  G.CipherOps.numberTokens = numberTokens;
  G.CipherOps.permutations = permutations;
})(typeof self !== 'undefined' ? self : this);
