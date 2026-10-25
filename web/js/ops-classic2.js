// Классические шифры, часть 2: Порта, бегущий ключ, ключевой Цезарь, Хилл, скитала, маршрутный шифр,
// перестановка Мышковского, хаошифр, вариант Бофора и сравнение семейства Виженера.
// Требует ops-classic.js (G.ClassicUtil).
(function (G) {
  'use strict';
  const C = G.Codec;
  const U = G.ClassicUtil;
  const { T, fail, mod, DIR_PARAM, GROUP_PARAM } = U;
  const { def, keyOf, letterCount, hasLatin, hasCyr } = G.CipherOps;

  const ALPHA_PARAM = { key: 'alpha', label: T('Алфавит', 'Alphabet'), type: 'select', options: C.ALPHABET_OPTIONS, default: 'auto' };
  const SKIP_PARAM = { key: 'skip', label: T('Цифры и знаки не тратят ключ', 'Digits and symbols do not use the key'), type: 'bool', default: true };

  // ---------- Периодические шифры на сдвигах ----------
  // Ключ → сдвиги. Цифровой ключ — Гронсфельд (каждая цифра и есть сдвиг).
  function keyShifts(key, alphaMode, sample) {
    let mode = alphaMode;
    if (/^\d+$/.test(String(key).trim())) {
      if (mode === 'auto') mode = hasCyr(sample) && !hasLatin(sample) ? 'ru33' : 'en';
      return { mode, shifts: Array.from(String(key).trim(), Number) };
    }
    if (mode === 'auto') mode = hasCyr(key) ? 'ru33' : hasLatin(key) ? 'en' : (hasCyr(sample) ? 'ru33' : 'en');
    const alpha = C.ALPHABETS[mode];
    const shifts = Array.from(String(key).toLowerCase()).map((ch) => alpha.indexOf(ch)).filter((i) => i >= 0);
    if (!shifts.length) fail('В ключе нет букв выбранного алфавита', 'The key has no letters of the selected alphabet');
    return { mode, shifts };
  }

  // fn(индекс буквы, сдвиг ключа, длина алфавита) → новый индекс. Регистр сохраняется.
  function periodic(text, key, alphaMode, skip, fn) {
    const { mode, shifts } = keyShifts(key, alphaMode, text);
    const alpha = C.ALPHABETS[mode];
    let pos = 0;
    let out = '';
    for (const ch of text) {
      const lower = ch.toLowerCase();
      const idx = alpha.indexOf(lower);
      if (idx < 0) { if (!skip) pos++; out += ch; continue; }
      const mapped = alpha[mod(fn(idx, shifts[pos++ % shifts.length], alpha.length), alpha.length)];
      out += ch === lower ? mapped : mapped.toUpperCase();
    }
    return out;
  }

  // Формулы семейства: dec — получение открытого текста P из шифртекста C, enc — обратное.
  const FAMILY = {
    vigenere: { label: 'Vigenère', dec: (c, k) => c - k, enc: (p, k) => p + k, fdec: 'P = C − K', fenc: 'C = P + K' },
    beaufort: { label: 'Beaufort', dec: (c, k) => k - c, enc: (p, k) => k - p, fdec: 'P = K − C', fenc: 'C = K − P' },
    variant: { label: 'Variant Beaufort', dec: (c, k) => c + k, enc: (p, k) => p - k, fdec: 'P = C + K', fenc: 'C = P − K' },
  };

  const KEY_PARAMS = [
    { key: 'key', label: T('Ключ', 'Key'), type: 'text', default: 'KEY' }, DIR_PARAM, ALPHA_PARAM, SKIP_PARAM,
  ];

  def({
    id: 'beaufort_variant', name: T('Вариант Бофора', 'Variant Beaufort'), cat: 'Шифры с ключом', prior: 0, inputs: [T('вход', 'input'), T('ключ', 'key')],
    desc: T('Расшифровка: P = C + K (mod 26); шифрование: C = P − K. То есть Виженер с «отрицательным» ключом. Пример: PRW QV RZXI + ENDERMITE → TEZ UM DHQM. Классический Бофор (P = K − C) — отдельная операция.',
      'Decrypt: P = C + K (mod 26); encrypt: C = P − K. I.e. Vigenère with a negated key. Example: PRW QV RZXI + ENDERMITE → TEZ UM DHQM. Classic Beaufort (P = K − C) is a separate operation.'),
    params: KEY_PARAMS,
    run(inputs, p) { return periodic(inputs[0], keyOf(inputs, p), p.alpha, p.skip, FAMILY.variant[p.dir]); },
  });

  def({
    id: 'vigenere_family', name: T('Виженер / Бофор / вариант Бофора', 'Vigenère / Beaufort / Variant'), cat: 'Шифры с ключом', prior: 0, inputs: [T('вход', 'input'), T('ключ', 'key')],
    desc: T('Один и тот же текст и ключ тремя способами сразу: Виженер (P = C − K), Бофор (P = K − C), вариант Бофора (P = C + K). Удобно, когда неизвестно, какой из них нужен.',
      'The same text and key in three ways at once: Vigenère (P = C − K), Beaufort (P = K − C), Variant Beaufort (P = C + K). Handy when you do not know which one is needed.'),
    params: KEY_PARAMS,
    run(inputs, p) {
      const key = keyOf(inputs, p);
      return Object.values(FAMILY).map((f) => {
        const formula = p.dir === 'dec' ? f.fdec : f.fenc;
        return f.label + ' (' + formula + '): ' + periodic(inputs[0], key, p.alpha, p.skip, f[p.dir]);
      }).join('\n');
    },
  });

  // ---------- Порта ----------
  def({
    id: 'porta', name: T('Порта', 'Porta'), cat: 'Шифры с ключом', prior: 0, inputs: [T('вход', 'input'), T('ключ', 'key')],
    desc: T('Взаимный шифр: буква ключа выбирает одну из 13 таблиц (пары AB, CD, …). Шифрование и расшифровка совпадают. HELLO + KEY → PPZTD.',
      'A reciprocal cipher: the key letter selects one of 13 tableaux (pairs AB, CD, …). Encryption equals decryption. HELLO + KEY → PPZTD.'),
    params: [
      { key: 'key', label: T('Ключ', 'Key'), type: 'text', default: 'KEY' },
      { key: 'alpha', label: ALPHA_PARAM.label, type: 'select', options: [['en', T('Латиница (26)', 'Latin (26)')], ['ru32', T('Кириллица без Ё (32)', 'Cyrillic without Ё (32)')]], default: 'en' },
      SKIP_PARAM,
    ],
    run(inputs, p) {
      return periodic(inputs[0], keyOf(inputs, p), p.alpha, p.skip, (i, k, m) => {
        const half = m / 2;
        const kk = Math.floor(k / 2);
        return i < half ? half + mod(i - kk, half) : mod(i - half + kk, half);
      });
    },
  });

  // ---------- Бегущий ключ ----------
  def({
    id: 'running_key', name: T('Бегущий ключ (Виженер)', 'Running-key Vigenère'), cat: 'Шифры с ключом', prior: 0, inputs: [T('вход', 'input'), T('текст-ключ', 'key text')],
    desc: T('Ключ — длинный текст (второй вход, например страница книги), не короче сообщения. Буквы текста-ключа идут подряд, пробелы и знаки пропускаются.',
      'The key is a long text (second input, e.g. a book page) at least as long as the message. Key letters are used in order; spaces and symbols are skipped.'),
    params: [
      { key: 'key', label: T('Текст-ключ', 'Key text'), type: 'textarea', default: '' },
      { key: 'kind', label: T('Семейство', 'Family'), type: 'select', options: [['vigenere', 'Vigenère'], ['beaufort', 'Beaufort'], ['variant', 'Variant Beaufort']], default: 'vigenere' },
      { key: 'offset', label: T('Сдвиг начала ключа (букв)', 'Key start offset (letters)'), type: 'number', default: 0 },
      DIR_PARAM, ALPHA_PARAM,
    ],
    run(inputs, p) {
      const text = inputs[0];
      const keyText = keyOf(inputs, p);
      const mode = p.alpha === 'auto' ? (hasCyr(keyText) && !hasLatin(keyText) ? 'ru33' : 'en') : p.alpha;
      const alpha = C.ALPHABETS[mode];
      const stream = Array.from(String(keyText).toLowerCase()).map((ch) => alpha.indexOf(ch)).filter((i) => i >= 0).slice(Math.max(0, Number(p.offset) || 0));
      const need = Array.from(text.toLowerCase()).filter((ch) => alpha.includes(ch)).length;
      if (stream.length < need) fail('Текст-ключ короче сообщения: ' + stream.length + ' < ' + need + ' букв', 'The key text is shorter than the message: ' + stream.length + ' < ' + need + ' letters');
      const fn = FAMILY[p.kind][p.dir];
      let n = 0;
      return Array.from(text).map((ch) => {
        const lower = ch.toLowerCase();
        const idx = alpha.indexOf(lower);
        if (idx < 0) return ch;
        const mapped = alpha[mod(fn(idx, stream[n++], alpha.length), alpha.length)];
        return ch === lower ? mapped : mapped.toUpperCase();
      }).join('');
    },
  });

  // ---------- Цезарь с ключевым словом ----------
  const KEYED_ALPHAS = [['en', T('Латиница (26)', 'Latin (26)')], ['ru33', T('Кириллица с Ё (33)', 'Cyrillic with Ё (33)')], ['ru32', T('Кириллица без Ё (32)', 'Cyrillic without Ё (32)')]];

  def({
    id: 'keyed_caesar', name: T('Цезарь с ключевым словом', 'Keyed Caesar'), cat: 'Сдвиги', prior: 0, inputs: [T('вход', 'input'), T('ключевое слово', 'keyword')],
    desc: T('Шифралфавит = ключевое слово + остальные буквы, затем сдвиг на N. ZEBRAS, N=0: HELLO → DAIIL (расшифровка — наоборот).',
      'Cipher alphabet = keyword + the remaining letters, then shifted by N. ZEBRAS, N=0: HELLO → DAIIL (decrypt is the reverse).'),
    params: [
      { key: 'key', label: T('Ключевое слово', 'Keyword'), type: 'text', default: 'ZEBRAS' },
      { key: 'n', label: T('Сдвиг N', 'Shift N'), type: 'number', default: 0 },
      { key: 'alpha', label: ALPHA_PARAM.label, type: 'select', options: KEYED_ALPHAS, default: 'en' },
      DIR_PARAM,
    ],
    run(inputs, p) {
      const plain = C.ALPHABETS[p.alpha];
      const keyed = U.keyedAlphabet(keyOf(inputs, p), plain.toUpperCase()).toLowerCase();
      const shift = mod(Number(p.n), plain.length);
      const cipher = keyed.slice(shift) + keyed.slice(0, shift);
      const [from, to] = p.dir === 'enc' ? [plain, cipher] : [cipher, plain];
      return Array.from(inputs[0]).map((ch) => {
        const i = from.indexOf(ch.toLowerCase());
        if (i < 0) return ch;
        return ch === ch.toLowerCase() ? to[i] : to[i].toUpperCase();
      }).join('');
    },
  });

  // ---------- Хилл ----------
  function det(m, n) {
    return n === 2 ? m[0][0] * m[1][1] - m[0][1] * m[1][0]
      : m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  }

  // Минор без строки r и столбца c.
  const minor = (m, r, c) => m.filter((_, i) => i !== r).map((row) => row.filter((_, j) => j !== c));

  function inverseMod26(m, n) {
    const inv = C.modInverse(mod(det(m, n), 26), 26);
    if (inv === null) fail('Матрица ключа необратима по модулю 26 (определитель ' + mod(det(m, n), 26) + ')', 'The key matrix is not invertible mod 26 (determinant ' + mod(det(m, n), 26) + ')');
    if (n === 2) return [[mod(inv * m[1][1], 26), mod(-inv * m[0][1], 26)], [mod(-inv * m[1][0], 26), mod(inv * m[0][0], 26)]];
    return m.map((_, i) => m.map((__, j) => mod(inv * (((i + j) % 2 ? -1 : 1) * det(minor(m, j, i), 2)), 26)));
  }

  function hillMatrix(key) {
    const k = String(key).trim();
    const nums = /^[\d\s,;]+$/.test(k) && /\d/.test(k) ? k.split(/[\s,;]+/).filter(Boolean).map(Number) : Array.from(k.toUpperCase().replace(/[^A-Z]/g, ''), (ch) => ch.charCodeAt(0) - 65);
    const n = Math.round(Math.sqrt(nums.length));
    if (n * n !== nums.length || (n !== 2 && n !== 3)) fail('Ключ Хилла — 4 или 9 букв/чисел (матрица 2×2 или 3×3), получено ' + nums.length, 'Hill key must be 4 or 9 letters/numbers (2×2 or 3×3 matrix), got ' + nums.length);
    return { n, m: Array.from({ length: n }, (_, i) => nums.slice(i * n, i * n + n).map((x) => mod(x, 26))) };
  }

  def({
    id: 'hill', name: T('Хилл 2×2 / 3×3', 'Hill 2×2 / 3×3'), cat: 'Шифры с ключом', prior: 0, inputs: [T('вход', 'input'), T('ключ', 'key')],
    desc: T('Блоки по 2 или 3 буквы умножаются на матрицу ключа mod 26. Ключ — 4/9 букв или чисел. Вики: GYBNQKURP, ACT → POH; числа 3 3 2 5, HELP → HIAT. Только латиница A–Z.',
      'Blocks of 2 or 3 letters are multiplied by the key matrix mod 26. Key: 4/9 letters or numbers. Wikipedia: GYBNQKURP, ACT → POH; numbers 3 3 2 5, HELP → HIAT. Latin A–Z only.'),
    params: [{ key: 'key', label: T('Ключ (буквы или числа)', 'Key (letters or numbers)'), type: 'text', default: 'GYBNQKURP' }, DIR_PARAM],
    run(inputs, p) {
      const { n, m } = hillMatrix(keyOf(inputs, p));
      const mat = p.dir === 'dec' ? inverseMod26(m, n) : m;
      const vals = Array.from(inputs[0].toUpperCase().replace(/[^A-Z]/g, ''), (ch) => ch.charCodeAt(0) - 65);
      if (vals.length % n) {
        if (p.dir === 'dec') fail('Число букв (' + vals.length + ') не делится на ' + n, 'Letter count (' + vals.length + ') is not divisible by ' + n);
        while (vals.length % n) vals.push(23); // дополнение X
      }
      let out = '';
      for (let i = 0; i < vals.length; i += n) {
        for (let r = 0; r < n; r++) {
          let s = 0;
          for (let c = 0; c < n; c++) s += mat[r][c] * vals[i + c];
          out += String.fromCharCode(65 + mod(s, 26));
        }
      }
      return out;
    },
  });

  // ---------- Перестановки через список позиций ----------
  // order[i] — позиция в открытом тексте, которую занимает i-й знак шифртекста.
  function applyOrder(text, order, dir) {
    const chars = Array.from(text);
    if (chars.length !== order.length) fail('Внутренняя ошибка: длина маршрута', 'Internal error: route length');
    if (dir === 'enc') return order.map((i) => chars[i]).join('');
    const out = new Array(chars.length);
    order.forEach((pos, i) => { out[pos] = chars[i]; });
    return out.join('');
  }

  const prep = (inputs, p) => (p.strip ? inputs[0].replace(/\s+/g, '') : inputs[0]);
  const STRIP_PARAM = { key: 'strip', label: T('Убрать пробелы', 'Remove whitespace'), type: 'bool', default: true };

  def({
    id: 'scytale', name: T('Скитала', 'Scytale'), cat: 'Перестановки', prior: 0,
    desc: T('Лента на стержне: текст пишется строками по кругу стержня, читается по столбцам. «IAMHURTVERYBADLYHELP», 4 буквы по окружности → IRYYATBHMVAEHEDLURLP.',
      'A strip wound on a rod: the text is written in rows around the rod and read by columns. “IAMHURTVERYBADLYHELP”, 4 letters around → IRYYATBHMVAEHEDLURLP.'),
    params: [{ key: 'rows', label: T('Букв по окружности стержня', 'Letters around the rod'), type: 'number', default: 4 }, STRIP_PARAM, DIR_PARAM],
    run(inputs, p) {
      const text = prep(inputs, p);
      const n = Array.from(text).length;
      const rows = Math.max(1, Math.floor(Number(p.rows)));
      const cols = Math.ceil(n / rows);
      const order = [];
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) if (r * cols + c < n) order.push(r * cols + c);
      return applyOrder(text, order, p.dir);
    },
  });

  // Обход прямоугольника rows×cols от угла. Возвращает позиции r*cols+c в порядке обхода.
  const CORNER_START = { tl: [0, 0], tr: [0, 1], br: [1, 1], bl: [1, 0] };
  const CW_HEADING = { tl: [0, 1], tr: [1, 0], br: [0, -1], bl: [-1, 0] };
  const CCW_HEADING = { tl: [1, 0], tr: [0, -1], br: [-1, 0], bl: [0, 1] };

  function spiral(rows, cols, corner, turn) {
    const [sr, sc] = CORNER_START[corner];
    let r = sr * (rows - 1);
    let c = sc * (cols - 1);
    let [dr, dc] = (turn === 'cw' ? CW_HEADING : CCW_HEADING)[corner];
    const seen = new Set();
    const out = [];
    const free = (a, b) => a >= 0 && a < rows && b >= 0 && b < cols && !seen.has(a * cols + b);
    while (out.length < rows * cols) {
      out.push(r * cols + c);
      seen.add(r * cols + c);
      if (!free(r + dr, c + dc)) [dr, dc] = turn === 'cw' ? [dc, -dr] : [-dc, dr];
      r += dr;
      c += dc;
    }
    return out;
  }

  // Змейка и обычное чтение, зеркалируются под выбранный угол.
  function linear(rows, cols, kind, corner) {
    const flipR = corner === 'bl' || corner === 'br';
    const flipC = corner === 'tr' || corner === 'br';
    const out = [];
    const byRows = kind === 'snake_h' || kind === 'rows';
    const outer = byRows ? rows : cols;
    const inner = byRows ? cols : rows;
    for (let a = 0; a < outer; a++) {
      for (let b = 0; b < inner; b++) {
        const bb = (kind === 'snake_h' || kind === 'snake_v') && a % 2 ? inner - 1 - b : b;
        const r = byRows ? a : bb;
        const c = byRows ? bb : a;
        out.push((flipR ? rows - 1 - r : r) * cols + (flipC ? cols - 1 - c : c));
      }
    }
    return out;
  }

  def({
    id: 'route_cipher', name: T('Маршрутный шифр', 'Route cipher'), cat: 'Перестановки', prior: 0,
    desc: T('Текст записан в таблицу строками, а читается по маршруту: спираль, змейка, столбцы. ABCDEFGHI (3 столбца), спираль по часовой от левого верхнего → ABCFIHGDE. Для расшифровки маршрут применяется обратно.',
      'The text is written into a grid by rows and read along a route: spiral, snake, columns. ABCDEFGHI (3 columns), clockwise spiral from the top-left → ABCFIHGDE. Decryption applies the route backwards.'),
    params: [
      { key: 'width', label: T('Столбцов в таблице', 'Grid columns'), type: 'number', default: 3 },
      { key: 'route', label: T('Маршрут', 'Route'), type: 'select', options: [['spiral_cw', T('Спираль по часовой', 'Spiral clockwise')], ['spiral_ccw', T('Спираль против часовой', 'Spiral counter-clockwise')], ['snake_h', T('Змейка по строкам', 'Snake by rows')], ['snake_v', T('Змейка по столбцам', 'Snake by columns')], ['columns', T('По столбцам', 'By columns')], ['rows', T('По строкам', 'By rows')]], default: 'spiral_cw' },
      { key: 'corner', label: T('Начало', 'Start corner'), type: 'select', options: [['tl', T('Верх-лево', 'Top-left')], ['tr', T('Верх-право', 'Top-right')], ['bl', T('Низ-лево', 'Bottom-left')], ['br', T('Низ-право', 'Bottom-right')]], default: 'tl' },
      { key: 'reverse', label: T('Наоборот (изнутри наружу)', 'Reversed (inside-out)'), type: 'bool', default: false },
      { key: 'pad', label: T('Заполнитель неполной строки', 'Padding for a short last row'), type: 'text', default: 'X' },
      STRIP_PARAM, DIR_PARAM,
    ],
    run(inputs, p) {
      let text = prep(inputs, p);
      const cols = Math.max(1, Math.floor(Number(p.width)));
      let n = Array.from(text).length;
      if (n % cols) {
        if (p.dir === 'dec' || !p.pad) fail('Длина ' + n + ' не делится на ' + cols + ' столбцов', 'Length ' + n + ' is not divisible by ' + cols + ' columns');
        text += p.pad.repeat(cols - (n % cols));
        n = Array.from(text).length;
      }
      const rows = n / cols;
      const order = p.route.startsWith('spiral') ? spiral(rows, cols, p.corner, p.route.endsWith('ccw') ? 'ccw' : 'cw') : linear(rows, cols, p.route, p.corner);
      return applyOrder(text, p.reverse ? order.slice().reverse() : order, p.dir);
    },
  });

  // ---------- Мышковский ----------
  // Столбцы с одинаковой буквой ключа читаются вместе, по строкам слева направо.
  function myszkowskiOrder(n, key) {
    const k = key.length;
    const rank = Array.from(new Set(key)).sort();
    const order = [];
    for (const letter of rank) {
      const cols = Array.from(key, (ch, i) => (ch === letter ? i : -1)).filter((i) => i >= 0);
      for (let r = 0; r * k < n; r++) for (const c of cols) if (r * k + c < n) order.push(r * k + c);
    }
    return order;
  }

  def({
    id: 'myszkowski', name: T('Перестановка Мышковского', 'Myszkowski transposition'), cat: 'Перестановки', prior: 0, inputs: [T('вход', 'input'), T('ключ', 'key')],
    desc: T('Столбцовая перестановка, где повторяющиеся буквы ключа образуют одну группу столбцов. Вики: ключ TOMATO, WEAREDISCOVEREDFLEEATONCE → ROFOACDTEDSEEEACWEIVRLENE.',
      'Columnar transposition where repeated key letters form one group of columns. Wikipedia: key TOMATO, WEAREDISCOVEREDFLEEATONCE → ROFOACDTEDSEEEACWEIVRLENE.'),
    params: [{ key: 'key', label: T('Ключевое слово', 'Keyword'), type: 'text', default: 'TOMATO' }, STRIP_PARAM, DIR_PARAM, GROUP_PARAM],
    run(inputs, p) {
      const key = String(keyOf(inputs, p)).toUpperCase().replace(/\s+/g, '');
      if (!key) fail('Нужно ключевое слово', 'A keyword is required');
      const text = prep(inputs, p);
      return U.grouped(applyOrder(text, myszkowskiOrder(Array.from(text).length, key), p.dir), p.group);
    },
  });

  // ---------- Хаошифр (Chaocipher) ----------
  // Диски на 26 позиций; зенит — индекс 0, надир — индекс 13.
  const rotateTo = (arr, i) => arr.slice(i).concat(arr.slice(0, i));
  const takeInsert = (arr, from, to) => { const a = arr.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; };

  function chaoDisk(text, name) {
    const letters = Array.from(String(text).toUpperCase().replace(/[^A-Z]/g, ''));
    if (letters.length !== 26 || new Set(letters).size !== 26) fail('Диск «' + name + '» должен содержать все 26 букв по разу', 'Disk “' + name + '” must contain all 26 letters exactly once');
    return letters;
  }

  def({
    id: 'chaocipher', name: T('Хаошифр', 'Chaocipher'), cat: 'Шифры с ключом', prior: 0,
    desc: T('Динамический шифр Хьюго Кёнига (диски левый/правый). Вики: левый HXUCZVAMDSLKPEFJRIGTWOBNYQ, правый PTLNBQDEOYSFAVZKGJRIHWXUMC, WELLDONEISBETTERTHANWELLSAID → OAHQHCNYNXTSZJRRHJBYHQKSOUJY.',
      'A dynamic cipher with two disks (left/right). Wikipedia: left HXUCZVAMDSLKPEFJRIGTWOBNYQ, right PTLNBQDEOYSFAVZKGJRIHWXUMC, WELLDONEISBETTERTHANWELLSAID → OAHQHCNYNXTSZJRRHJBYHQKSOUJY.'),
    params: [
      { key: 'left', label: T('Левый диск (26 букв)', 'Left disk (26 letters)'), type: 'text', default: 'HXUCZVAMDSLKPEFJRIGTWOBNYQ' },
      { key: 'right', label: T('Правый диск (26 букв)', 'Right disk (26 letters)'), type: 'text', default: 'PTLNBQDEOYSFAVZKGJRIHWXUMC' },
      DIR_PARAM, GROUP_PARAM,
    ],
    run([t], p) {
      let left = chaoDisk(p.left, T('левый', 'left'));
      let right = chaoDisk(p.right, T('правый', 'right'));
      let out = '';
      for (const ch of t.toUpperCase().replace(/[^A-Z]/g, '')) {
        const plain = p.dir === 'enc' ? ch : right[left.indexOf(ch)];
        const cipher = p.dir === 'enc' ? left[right.indexOf(ch)] : ch;
        out += p.dir === 'enc' ? cipher : plain;
        left = takeInsert(rotateTo(left, left.indexOf(cipher)), 1, 13);
        right = takeInsert(rotateTo(rotateTo(right, right.indexOf(plain)), 1), 2, 13);
      }
      return U.grouped(out, p.group);
    },
  });

  G.ClassicUtil2 = { periodic, FAMILY, applyOrder, spiral, myszkowskiOrder, letterCount };
})(typeof self !== 'undefined' ? self : this);
