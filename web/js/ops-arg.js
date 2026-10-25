// Шифры, которые встречаются в ARG и головоломках по Minecraft: алфавит стола зачарований (SGA), квадрат Полибия,
// тап-код, Бэкон, T9, Playfair, перестановка по ключу, Base85/Z85, leet, раскладочный сдвиг.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const C = G.Codec;
  const { def, letterCount, lenient } = G.CipherOps;
  // Ключи проекта и активного профиля (у «neutral» собственных ключей нет).
  const projectKeys = () => (G.Profiles ? G.Profiles.keys() : []);
  const CAT = 'ARG и Minecraft';
  const STRICT = G.CipherOps.STRICT_PARAM;

  // ---------- Стол зачарований (Standard Galactic Alphabet) ----------
  const SGA = {
    a: 'ᔑ', b: 'ʖ', c: 'ᓵ', d: '↸', e: 'ᒷ', f: '⎓', g: '⊣', h: '⍑', i: '╎', j: '⋮', k: 'ꖌ', l: 'ꖎ', m: 'ᒲ',
    n: 'リ', o: '𝙹', p: '!¡', q: 'ᑑ', r: '∷', s: 'ᓭ', t: 'ℸ ̣', u: '⚍', v: '⍊', w: '∴', x: ' ̇/', y: '||', z: '⨅',
  };
  // Варианты записи, которые встречаются в разных переводчиках.
  const SGA_EXTRA = [['ℸ̣', 't'], ['ℸ', 't'], ['̇/', 'x'], ['!¡', 'p'], ['¡', 'p'], ['∥', 'y']];
  const SGA_TOKENS = Object.entries(SGA).map(([k, v]) => [v, k]).concat(SGA_EXTRA).sort((a, b) => b[0].length - a[0].length);
  const SGA_CHARS = /[ᔑʖᓵ↸ᒷ⎓⊣⍑╎⋮ꖌꖎᒲリᑑ∷ᓭℸ⚍⍊∴⨅]|𝙹/u;

  def({
    id: 'sga_decode', name: T('Стол зачарований → текст', 'Enchanting table → text'), cat: CAT, prior: 5,
    desc: T('Standard Galactic Alphabet из Minecraft: ᔑʖᓵ↸ᒷ → abcde. Простая замена букв значками; регистр алфавитом не кодируется.', 'Standard Galactic Alphabet from Minecraft: ᔑʖᓵ↸ᒷ → abcde. A simple letter-to-glyph substitution; the alphabet does not encode case.'),
    run([t]) {
      let out = '', i = 0;
      while (i < t.length) {
        const hit = SGA_TOKENS.find(([glyph]) => t.startsWith(glyph, i));
        if (hit) { out += hit[1]; i += hit[0].length; continue; }
        out += t[i++];
      }
      return out.replace(/ {2,}/g, ' ');
    },
    probes(t) { return SGA_CHARS.test(t) ? [{}] : []; },
  });

  def({
    id: 'sga_encode', name: T('Текст → стол зачарований', 'Text → enchanting table'), cat: CAT,
    run([t]) { return Array.from(t.toLowerCase(), (ch) => SGA[ch] || ch).join(''); },
  });

  // ---------- Квадрат Полибия и тап-код ----------
  const POLY = {
    en: 'ABCDEFGHIKLMNOPQRSTUVWXYZ',
    tap: 'ABCDEFGHIJLMNOPQRSTUVWXYZ',
    ru: 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ.,-', // i18n-ok: данные
  };
  function keyedSquare(base, key) {
    const seen = new Set();
    let out = '';
    for (const ch of (key || '').toUpperCase().replace(/J/g, 'I') + base) if (base.includes(ch) && !seen.has(ch)) { seen.add(ch); out += ch; }
    return out;
  }
  function pairsToLetters(nums, square, size, colFirst, strict) {
    let out = '';
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const [r, c] = colFirst ? [nums[i + 1], nums[i]] : [nums[i], nums[i + 1]];
      const ch = square[(r - 1) * size + (c - 1)];
      if (!ch || r < 1 || c < 1 || r > size || c > size) throw new Error(T('Пара ' + nums[i] + nums[i + 1] + ' вне квадрата ' + size + '×' + size, 'The pair ' + nums[i] + nums[i + 1] + ' is outside the ' + size + '×' + size + ' square'));
      out += ch;
    }
    if (nums.length % 2) lenient(strict, T('Непарная последняя группа (' + nums[nums.length - 1] + ') отброшена', 'The unpaired last group (' + nums[nums.length - 1] + ') was dropped'));
    return out;
  }

  def({
    id: 'polybius', name: T('Квадрат Полибия', 'Polybius square'), cat: CAT, prior: 3,
    desc: T('Пары цифр «строка-столбец» → буквы. 5×5 (I=J), 6×6 для кириллицы. Можно задать ключевое слово.', 'Digit pairs “row-column” → letters. 5×5 (I=J), 6×6 for Cyrillic. A key word is optional.'),
    params: [
      { key: 'square', label: T('Квадрат', 'Square'), type: 'select', options: [['en', T('Латиница 5×5 (I=J)', 'Latin 5×5 (I=J)')], ['tap', T('Тап-код 5×5 (K=C)', 'Tap code 5×5 (K=C)')], ['ru', T('Кириллица 6×6', 'Cyrillic 6×6')]], default: 'en' },
      { key: 'key', label: T('Ключевое слово (необяз.)', 'Key word (optional)'), type: 'text', default: '' },
      { key: 'colFirst', label: T('Сначала столбец', 'Column first'), type: 'bool', default: false },
    ],
    run([t], p) {
      const digits = t.replace(/[^0-9]/g, '');
      if (digits.length < 2 || digits.length % 2) throw new Error(T('Нужно чётное число цифр', 'An even number of digits is required'));
      const size = p.square === 'ru' ? 6 : 5;
      const square = p.square === 'ru' ? POLY.ru : keyedSquare(POLY[p.square], p.key);
      return pairsToLetters(Array.from(digits, Number), square, size, p.colFirst, true);
    },
    probes(t) {
      const d = t.replace(/[\s,;-]/g, '');
      if (!/^[1-6]+$/.test(d) || d.length < 4 || d.length % 2) return [];
      const res = [];
      if (/^[1-5]+$/.test(d)) res.push({ square: 'en', key: '', colFirst: false }, { square: 'tap', key: '', colFirst: false });
      res.push({ square: 'ru', key: '', colFirst: false });
      return res;
    },
  });

  def({
    id: 'tap_code', name: T('Тап-код (стуки)', 'Tap code (knocks)'), cat: CAT, prior: 2,
    desc: T('Группы стуков: «.. ...  . ....». Каждая пара групп — строка и столбец квадрата 5×5 (K=C). Непарная последняя группа даёт предупреждение (в строгом режиме — ошибку).', 'Knock groups: “.. ...  . ....”. Each pair of groups is a row and a column of the 5×5 square (K=C). An unpaired last group gives a warning (an error in strict mode).'),
    params: [{ key: 'square', label: T('Квадрат', 'Square'), type: 'select', options: [['tap', T('Латиница (K=C)', 'Latin (K=C)')], ['ru', T('Кириллица 6×6', 'Cyrillic 6×6')]], default: 'tap' }, STRICT],
    run([t], p) {
      const groups = t.trim().split(/[^.*•x·oO0-9]+/).filter(Boolean).map((g) => (/^\d+$/.test(g) ? Number(g) : g.length));
      if (groups.length < 2) throw new Error(T('Мало групп стуков', 'Too few knock groups'));
      return pairsToLetters(groups, p.square === 'ru' ? POLY.ru : POLY.tap, p.square === 'ru' ? 6 : 5, false, p.strict);
    },
    probes(t) { return /^[.*•·\s/]+$/.test(t.trim()) && /\.\s+\./.test(t) ? [{ square: 'tap' }] : []; },
  });

  // ---------- Бэкон ----------
  def({
    id: 'bacon', name: T('Шифр Бэкона', 'Bacon cipher'), cat: CAT, prior: 2,
    desc: T('Группы из 5 символов A/B (или 0/1, или регистр букв: строчная=A, заглавная=B) → буквы. Неполный хвост отбрасывается с предупреждением (в строгом режиме — ошибка).', 'Groups of 5 symbols A/B (or 0/1, or letter case: lower=A, upper=B) → letters. An incomplete tail is dropped with a warning (an error in strict mode).'),
    params: [
      { key: 'variant', label: T('Алфавит', 'Alphabet'), type: 'select', options: [['26', T('26 букв', '26 letters')], ['24', T('24 буквы (I=J, U=V)', '24 letters (I=J, U=V)')]], default: '26' },
      { key: 'source', label: T('Что считать A/B', 'What counts as A/B'), type: 'select', options: [['auto', T('Авто', 'Auto')], ['ab', T('Буквы A/B', 'Letters A/B')], ['01', T('0 и 1', '0 and 1')], ['case', T('Регистр букв', 'Letter case')]], default: 'auto' },
      STRICT,
    ],
    run([t], p) {
      let src = p.source;
      if (src === 'auto') src = /^[abAB\s]+$/.test(t) ? 'ab' : /^[01\s]+$/.test(t) ? '01' : 'case';
      let bits = '';
      for (const ch of t) {
        if (src === 'ab' && /[ab]/i.test(ch)) bits += ch.toLowerCase() === 'a' ? '0' : '1';
        else if (src === '01' && /[01]/.test(ch)) bits += ch;
        else if (src === 'case' && /[a-zа-яёіїєґ]/i.test(ch)) bits += ch === ch.toLowerCase() ? '0' : '1';
      }
      if (bits.length < 5) throw new Error(T('Нужно хотя бы 5 символов A/B', 'At least 5 A/B symbols are needed'));
      if (bits.length % 5) lenient(p.strict, T('Хвост из ' + (bits.length % 5) + ' символов не образует группу из 5 и отброшен', 'A tail of ' + (bits.length % 5) + ' symbols does not form a group of 5 and was dropped'));
      const alpha = p.variant === '24' ? 'ABCDEFGHIKLMNOPQRSTUWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let out = '';
      for (let i = 0; i + 5 <= bits.length; i += 5) out += alpha[parseInt(bits.substr(i, 5), 2)] || '?';
      return out;
    },
    probes(t) {
      const s = t.replace(/\s/g, '');
      if (s.length >= 10 && (/^[abAB]+$/.test(s) || /^[01]+$/.test(s)) && s.length % 5 === 0) return [{ variant: '26', source: 'auto' }, { variant: '24', source: 'auto' }];
      return [];
    },
  });

  // ---------- Телефонная клавиатура ----------
  const KEYPAD = {
    en: { 2: 'abc', 3: 'def', 4: 'ghi', 5: 'jkl', 6: 'mno', 7: 'pqrs', 8: 'tuv', 9: 'wxyz', 0: ' ' },
    ru: { 2: 'абвг', 3: 'дежз', 4: 'ийкл', 5: 'мноп', 6: 'рсту', 7: 'фхцч', 8: 'шщъы', 9: 'ьэюя', 0: ' ' }, // i18n-ok: данные
  };
  def({
    id: 't9', name: T('Телефон: нажатия → буквы', 'Phone: key presses → letters'), cat: CAT, prior: 2,
    desc: T('Мультитап «44 33 555 555 666» → hello или пары «кнопка-позиция» «4-2». DTMF-тоны часто ведут сюда.', 'Multitap “44 33 555 555 666” → hello or “key-position” pairs “4-2”. DTMF tones often lead here.'),
    params: [
      { key: 'lang', label: T('Раскладка', 'Layout'), type: 'select', options: [['en', T('Латиница', 'Latin')], ['ru', T('Кириллица', 'Cyrillic')]], default: 'en' },
      { key: 'mode', label: T('Запись', 'Notation'), type: 'select', options: [['multitap', T('Повторы (44 33 555)', 'Repeats (44 33 555)')], ['pairs', T('Кнопка и позиция (42 = h)', 'Key and position (42 = h)')]], default: 'multitap' },
    ],
    run([t], p) {
      const pad = KEYPAD[p.lang];
      if (p.mode === 'pairs') {
        const d = t.replace(/\D/g, '');
        if (d.length % 2) throw new Error(T('Нужно чётное число цифр', 'An even number of digits is required'));
        let out = '';
        for (let i = 0; i < d.length; i += 2) {
          const ch = (pad[d[i]] || '')[Number(d[i + 1]) - 1];
          if (!ch) throw new Error(T('Нет буквы для ' + d[i] + d[i + 1], 'No letter for ' + d[i] + d[i + 1]));
          out += ch;
        }
        return out;
      }
      return t.trim().split(/[^0-9]+/).filter(Boolean).flatMap((tok) => tok.match(/(\d)\1*/g)).map((run) => {
        const keys = pad[run[0]];
        if (!keys) throw new Error(T('У кнопки ' + run[0] + ' нет букв', 'Key ' + run[0] + ' has no letters'));
        return keys[(run.length - 1) % keys.length];
      }).join('');
    },
    probes(t) {
      const s = t.trim();
      if (!/^[0-9\s\-/]+$/.test(s) || /[1]/.test(s)) return [];
      const res = [];
      if (/(\d)\1/.test(s) && /\s/.test(s)) res.push({ lang: 'en', mode: 'multitap' }, { lang: 'ru', mode: 'multitap' });
      return res;
    },
  });

  // ---------- Playfair ----------
  function playfairSquare(key) { return keyedSquare(POLY.en, key); }
  def({
    id: 'playfair', name: T('Playfair (расшифровка)', 'Playfair (decryption)'), cat: CAT, prior: 1, inputs: [T('вход', 'input'), T('ключ', 'key')],
    desc: T('Биграммный шифр на квадрате 5×5 с ключевым словом (I=J).', 'A digraph cipher on a 5×5 square with a key word (I=J).'),
    params: [{ key: 'key', label: T('Ключ', 'Key'), type: 'text', default: 'playfair' }],
    run(inputs, p) {
      const sq = playfairSquare((inputs[1] != null ? inputs[1] : p.key));
      const letters = inputs[0].toUpperCase().replace(/J/g, 'I').replace(/[^A-Z]/g, '');
      if (letters.length % 2) throw new Error(T('Нечётное число букв', 'An odd number of letters'));
      let out = '';
      for (let i = 0; i < letters.length; i += 2) {
        const a = sq.indexOf(letters[i]), b = sq.indexOf(letters[i + 1]);
        const [ra, ca, rb, cb] = [Math.floor(a / 5), a % 5, Math.floor(b / 5), b % 5];
        if (ra === rb) out += sq[ra * 5 + C.mod(ca - 1, 5)] + sq[rb * 5 + C.mod(cb - 1, 5)];
        else if (ca === cb) out += sq[C.mod(ra - 1, 5) * 5 + ca] + sq[C.mod(rb - 1, 5) * 5 + cb];
        else out += sq[ra * 5 + cb] + sq[rb * 5 + ca];
      }
      return out.toLowerCase();
    },
    probes(t) {
      const letters = t.replace(/[^A-Za-z]/g, '');
      if (letters.length < 6 || letters.length % 2 || letters.length !== t.replace(/\s/g, '').length) return [];
      return projectKeys().filter((k) => /^[a-z]+$/i.test(k)).map((key) => ({ key }));
    },
  });

  // ---------- Перестановка столбцов по ключу ----------
  function keyOrder(key) {
    return Array.from(key.toLowerCase()).map((ch, i) => [ch, i]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1])).map((x) => x[1]);
  }
  def({
    id: 'columnar', name: T('Перестановка столбцов по ключу', 'Columnar transposition by key'), cat: 'Перестановки', prior: 1, inputs: [T('вход', 'input'), T('ключ', 'key')],
    desc: T('Текст пишется строками под ключом, столбцы читаются в алфавитном порядке букв ключа.', 'The text is written in rows under the key; columns are read in the alphabetical order of the key letters.'),
    params: [
      { key: 'key', label: T('Ключ', 'Key'), type: 'text', default: 'zebras' },
      { key: 'dir', label: T('Режим', 'Mode'), type: 'select', options: [['dec', T('Расшифровать', 'Decrypt')], ['enc', T('Зашифровать', 'Encrypt')]], default: 'dec' },
    ],
    run(inputs, p) {
      const key = String(inputs[1] != null ? inputs[1] : p.key);
      if (key.length < 2) throw new Error(T('Ключ короче 2 символов', 'The key is shorter than 2 characters'));
      const chars = Array.from(inputs[0]);
      const k = key.length, rows = Math.ceil(chars.length / k), full = chars.length % k || k;
      const order = keyOrder(key);
      const colLen = (c) => (c < full ? rows : rows - 1);
      if (p.dir === 'enc') return order.map((c) => { let s = ''; for (let r = 0; r < colLen(c); r++) s += chars[r * k + c]; return s; }).join('');
      const cols = new Array(k);
      let pos = 0;
      for (const c of order) { cols[c] = chars.slice(pos, pos + colLen(c)); pos += colLen(c); }
      let out = '';
      for (let r = 0; r < rows; r++) for (let c = 0; c < k; c++) if (r < colLen(c)) out += cols[c][r];
      return out;
    },
    probes(t) {
      if (t.length < 12 || letterCount(t) < t.length * 0.7) return [];
      return projectKeys().filter((key) => key.length >= 3 && key.length < t.length / 2).map((key) => ({ key, dir: 'dec' }));
    },
  });

  // ---------- Base85 ----------
  const Z85 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';
  def({
    id: 'base85_decode', name: T('Base85 / Z85 → байты', 'Base85 / Z85 → bytes'), cat: 'Кодировки', prior: 2,
    desc: T('Ascii85 (<~…~>, «z» = 4 нуля) или Z85 (было в ARG Minecraft Dungeons II). Z85 по спецификации кратен 5 символам: неполная группа даёт предупреждение (в строгом режиме — ошибку).', 'Ascii85 (<~…~>, “z” = 4 zeros) or Z85 (seen in the Minecraft Dungeons II ARG). Z85 must be a multiple of 5 characters: an incomplete group gives a warning (an error in strict mode).'),
    params: [{ key: 'variant', label: T('Вариант', 'Variant'), type: 'select', options: [['ascii85', 'Ascii85 (Adobe)'], ['z85', 'Z85 (ZeroMQ)']], default: 'ascii85' }, STRICT],
    run([t], p) {
      let s = t.trim();
      const z85 = p.variant === 'z85';
      if (!z85) s = s.replace(/^<~/, '').replace(/~>$/, '').replace(/\s/g, '').replace(/z/g, '!!!!!');
      const value = (ch) => {
        const v = z85 ? Z85.indexOf(ch) : ch.charCodeAt(0) - 33;
        if (v < 0 || v > 84) throw new Error(T('Символ «' + ch + '» не входит в ' + (z85 ? 'Z85' : 'Ascii85'), 'Character “' + ch + '” is not in ' + (z85 ? 'Z85' : 'Ascii85')));
        return v;
      };
      const pad = (5 - (s.length % 5)) % 5;
      if (pad === 4) throw new Error(T('Неверная длина Base85', 'Invalid Base85 length'));
      if (z85 && pad) lenient(p.strict, T('Длина Z85 (' + s.length + ') не кратна 5: неполная группа дополнена', 'The Z85 length (' + s.length + ') is not a multiple of 5: the incomplete group was padded'));
      s += (z85 ? '#' : 'u').repeat(pad);
      let out = '';
      for (let i = 0; i < s.length; i += 5) {
        let n = 0;
        for (let j = 0; j < 5; j++) n = n * 85 + value(s[i + j]);
        if (n > 0xffffffff) throw new Error(T('Группа Base85 вне диапазона', 'A Base85 group is out of range'));
        out += String.fromCharCode((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
      }
      return pad ? out.slice(0, out.length - pad) : out;
    },
    probes(t) {
      const s = t.trim();
      // В рамке <~ … ~> это точно Ascii85, даже совсем короткий (<~;cHOh~> = STOP).
      if (/^<~[!-uz\s]+~>$/.test(s)) return [{ variant: 'ascii85' }];
      if (s.length < 10) return [];
      const res = [];
      if (/^(<~)?[!-uz\s]+(~>)?$/.test(s) && /[^A-Za-z0-9]/.test(s)) res.push({ variant: 'ascii85' });
      if (/^[0-9a-zA-Z.\-:+=^!/*?&<>()[\]{}@%$#]+$/.test(s) && /[.\-:+=^!/*?&<>()[\]{}@%$#]/.test(s) && s.length % 5 === 0) res.push({ variant: 'z85' });
      return res;
    },
  });

  // ---------- Leet и сдвиг по клавиатуре ----------
  const LEET = { 4: 'a', '@': 'a', 8: 'b', 3: 'e', 6: 'g', 9: 'g', 1: 'i', '!': 'i', 0: 'o', 5: 's', $: 's', 7: 't', '+': 't', 2: 'z', '|': 'l' };
  def({
    id: 'leet', name: T('Leet → буквы', 'Leet → letters'), cat: CAT, prior: 2,
    desc: T('1NF3C7ED → INFECTED. Цифры и знаки внутри слов заменяются похожими буквами.', '1NF3C7ED → INFECTED. Digits and symbols inside words are replaced by look-alike letters.'),
    run([t]) {
      // Слово — буквы и цифры, знаки @!$+| допустимы только внутри: «C++» и «wow!» не трогаем.
      return t.replace(/[A-Za-z0-9](?:[A-Za-z0-9@!$+|]*[A-Za-z0-9])?/g, (word) => {
        if (!/[A-Za-z]/.test(word)) return word;
        const upper = word === word.toUpperCase();
        return Array.from(word, (ch) => (LEET[ch] ? (upper ? LEET[ch].toUpperCase() : LEET[ch]) : ch)).join('');
      });
    },
    probes(t) { return /[a-z][0-9@$!][a-z]|[0-9][a-z]{2}|[a-z]{2}[0-9]/i.test(t) && letterCount(t) >= 3 ? [{}] : []; },
  });

  const KB_ROWS = {
    en: ['`1234567890-=', 'qwertyuiop[]\\', "asdfghjkl;'", 'zxcvbnm,./'],
    ru: ['ё1234567890-=', 'йцукенгшщзхъ\\', 'фывапролджэ', 'ячсмитьбю.'], // i18n-ok: данные
  };
  def({
    id: 'keyboard_shift', name: T('Сдвиг по клавиатуре', 'Keyboard shift'), cat: CAT, prior: 2,
    desc: T('Каждая клавиша заменяется соседней в том же ряду: сдвиг −1 превращает «jr;;p» в «hello».', 'Every key is replaced by its neighbour in the same row: shift −1 turns “jr;;p” into “hello”.'),
    params: [{ key: 'n', label: T('Сдвиг (− влево, + вправо)', 'Shift (− left, + right)'), type: 'number', int: true, min: -100, max: 100, default: -1 }],
    run([t], p) {
      const n = Number(p.n);
      return Array.from(t, (ch) => {
        const low = ch.toLowerCase();
        for (const rows of Object.values(KB_ROWS)) for (const row of rows) {
          const i = row.indexOf(low);
          if (i >= 0) { const r = row[C.mod(i + n, row.length)]; return ch === low ? r : r.toUpperCase(); }
        }
        return ch;
      }).join('');
    },
    probes(t) { return letterCount(t) >= 4 ? [{ n: -1 }, { n: 1 }] : []; },
  });

  // Битовый дамп, напечатанный группами фиксированной ширины и колонками текста (Sombra: 16-битные группы, в каждой
  // значащих 12/12/13 бит, три строки QR на строку текста) → по одной строке сетки на строку, для «Биты → изображение».
  def({
    id: 'bit_rows', name: T('Группы битов → строки сетки', 'Bit groups → grid rows'), cat: 'Кодировки',
    desc: T('Берёт из каждой группы 0/1 младшие биты по списку («12,12,13» — по кругу), склеивает N групп в строку сетки и, если в строке текста стоят рядом несколько строк сетки (колонки), раскладывает их обратно: строка текста L содержит строки L, B+L, 2B+L…, где B — число полных строк текста; остаток идёт в конец. Выход — по строке сетки на строку, для ноды «Биты → изображение».',
      'Takes the low bits of each 0/1 group by a list (“12,12,13”, cycling), joins N groups into a grid row and, if a text line holds several grid rows side by side (columns), lays them back out: text line L holds rows L, B+L, 2B+L…, where B is the number of full text lines; the remainder goes last. Output: one grid row per line, for the Bits → image node.'),
    params: [
      { key: 'keep', label: T('Значащих бит в группах (по кругу)', 'Kept low bits per group (cycling)'), type: 'text', default: '12,12,13' },
      { key: 'perRow', label: T('Групп в строке сетки', 'Groups per grid row'), type: 'number', default: 3 },
      { key: 'columns', label: T('Строк сетки в строке текста', 'Grid rows per text line'), type: 'number', default: 1 },
    ],
    run([t], p) {
      const groups = String(t).trim().split(/\s+/).filter(Boolean);
      if (!groups.length || groups.some((g) => /[^01]/.test(g))) throw new Error(T('Нужны группы из 0 и 1 через пробелы', 'Needs groups of 0 and 1 separated by spaces'));
      const keep = String(p.keep).split(/[\s,;]+/).filter(Boolean).map(Number);
      const per = Number(p.perRow) || 1, cols = Number(p.columns) || 1;
      if (!keep.length || keep.some((k) => !Number.isInteger(k) || k < 1 || k > 64) || per < 1 || cols < 1) throw new Error(T('Неверные параметры групп', 'Invalid group parameters'));
      const rows = [];
      for (let i = 0; i < groups.length; i += per) {
        const part = groups.slice(i, i + per);
        if (part.length < per) lenient(true, T('Последняя строка неполная: ' + part.length + ' из ' + per + ' групп', 'The last row is incomplete: ' + part.length + ' of ' + per + ' groups'));
        rows.push(part.map((g, k) => { const n = keep[(i + k) % keep.length]; if (g.length < n) throw new Error(T('Группа короче ' + n + ' бит: ' + g, 'A group is shorter than ' + n + ' bits: ' + g)); return g.slice(-n); }).join(''));
      }
      if (cols === 1) return rows.join('\n');
      const full = Math.floor(rows.length / cols);
      const out = new Array(rows.length);
      rows.forEach((r, j) => { const L = Math.floor(j / cols), slot = j % cols; out[L < full ? slot * full + L : cols * full + slot] = r; });
      return out.join('\n');
    },
  });

  // Ключи-числа (836, 23…) тоже пробуем — как Гронсфельд.
  G.CipherOps.numericKeys = () => projectKeys().filter((k) => /^\d+$/.test(k));
})(typeof self !== 'undefined' ? self : this);
