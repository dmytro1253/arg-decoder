// Классические шифры на квадратах: Бифид, Трифид, ADFGX/ADFGVX, Четыре квадрата, Два квадрата, Нигилистов.
// Общие помощники кладутся в G.ClassicUtil — ими пользуются ops-classic2.js и остальные новые файлы.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const { def, keyOf } = G.CipherOps;

  const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const AZ25 = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // без J (J = I)
  const AZ36 = AZ + '0123456789';
  const AZ27 = AZ + '+';

  const fail = (ru, en) => { throw new Error(T(ru, en)); };
  const mod = (a, m) => ((a % m) + m) % m;

  // Алфавит с ключевым словом впереди: уникальные буквы ключа, затем остаток базового алфавита.
  function keyedAlphabet(key, base) {
    let out = '';
    for (const ch of String(key || '').toUpperCase() + base) {
      if (base.includes(ch) && !out.includes(ch)) out += ch;
    }
    return out;
  }

  // Квадрат с ключом: size 5 (J=I), 6 (A–Z0–9), 3 (трифид, 27 знаков с «+»).
  function squareChars(key, size) {
    const base = size === 6 ? AZ36 : size === 3 ? AZ27 : AZ25;
    const k = size === 5 ? String(key || '').toUpperCase().replace(/J/g, 'I') : key;
    return keyedAlphabet(k, base);
  }

  // Текст в массив знаков квадрата: верхний регистр, для 5×5 J заменяется на I, лишнее отбрасывается.
  function squareText(text, chars) {
    const upper = String(text).toUpperCase();
    const fix = chars.includes('J') ? upper : upper.replace(/J/g, 'I');
    return Array.from(fix).filter((ch) => chars.includes(ch));
  }

  const grouped = (s, n) => (Number(n) > 0 ? s.replace(new RegExp('(.{' + Number(n) + '})(?=.)', 'g'), '$1 ') : s);

  function chunks(arr, size) {
    const n = Number(size) > 0 ? Number(size) : arr.length || 1;
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  const DIR_PARAM = { key: 'dir', label: T('Режим', 'Mode'), type: 'select', options: [['dec', T('Расшифровать', 'Decrypt')], ['enc', T('Зашифровать', 'Encrypt')]], default: 'dec' };
  const GROUP_PARAM = { key: 'group', label: T('Группы по (0 — слитно)', 'Group size (0 = none)'), type: 'number', default: 0 };
  const PERIOD_PARAM = { key: 'period', label: T('Период (0 — всё сообщение)', 'Period (0 = whole message)'), type: 'number', default: 0 };

  // ---------- Бифид и Трифид: общая «фракционная» схема ----------
  // coords — координаты каждого знака блока (по D чисел). Шифрование: выписать все первые координаты,
  // затем все вторые (и третьи), прочитать подряд по D.
  function mixBlock(coords, D) {
    const seq = [];
    for (let d = 0; d < D; d++) for (const c of coords) seq.push(c[d]);
    return chunks(seq, D);
  }

  function unmixBlock(coords, D) {
    const flat = coords.flat();
    const n = coords.length;
    return Array.from({ length: n }, (_, i) => Array.from({ length: D }, (__, d) => flat[d * n + i]));
  }

  const toCoords = (i, side, D) => Array.from({ length: D }, (_, d) => Math.floor(i / side ** (D - 1 - d)) % side);
  const fromCoords = (c, side) => c.reduce((a, x) => a * side + x, 0);

  function fractionate(text, p, side, D, chars) {
    const letters = squareText(text, chars);
    if (!letters.length) fail('Нет знаков, подходящих для квадрата', 'No characters fit the square');
    const mix = p.dir === 'enc' ? mixBlock : unmixBlock;
    const out = chunks(letters, p.period).map((block) => {
      const coords = block.map((ch) => toCoords(chars.indexOf(ch), side, D));
      return mix(coords, D).map((c) => chars[fromCoords(c, side)]).join('');
    });
    return grouped(out.join(''), p.group);
  }

  def({
    id: 'bifid', name: T('Бифид', 'Bifid'), cat: 'Шифры с ключом', prior: 0, inputs: [T('вход', 'input'), T('ключ', 'key')],
    desc: T('Квадрат Полибия + разнесение координат (Delastelle). Вики: ключ BGWKZQPNDSIOAXEFCLUMTHYVR, FLEEATONCE → UAEOLWRINS. Ключ — слово или весь квадрат; J=I.',
      'Polybius square + coordinate fractionation (Delastelle). Wikipedia: key BGWKZQPNDSIOAXEFCLUMTHYVR, FLEEATONCE → UAEOLWRINS. Key is a word or the full square; J=I.'),
    params: [
      { key: 'key', label: T('Ключ квадрата', 'Square key'), type: 'text', default: '' },
      { key: 'size', label: T('Квадрат', 'Square'), type: 'select', options: [['5', '5×5 (J=I)'], ['6', '6×6 (A–Z, 0–9)']], default: '5' },
      PERIOD_PARAM, DIR_PARAM, GROUP_PARAM,
    ],
    run(inputs, p) {
      const side = Number(p.size);
      return fractionate(inputs[0], p, side, 2, squareChars(keyOf(inputs, p), side));
    },
  });

  def({
    id: 'trifid', name: T('Трифид', 'Trifid'), cat: 'Шифры с ключом', prior: 0, inputs: [T('вход', 'input'), T('ключ', 'key')],
    desc: T('Куб 3×3×3 (26 букв и «+»), координаты разносятся по периоду. Вики: ключ FELIXMARDSTBCGHJKNOPQUVWYZ+, период 5, AIDETOILECIELTAIDERA → FMJFVOISSUFTFPUFEQQC.',
      'A 3×3×3 cube (26 letters and “+”), coordinates fractionated per period. Wikipedia: key FELIXMARDSTBCGHJKNOPQUVWYZ+, period 5, AIDETOILECIELTAIDERA → FMJFVOISSUFTFPUFEQQC.'),
    params: [
      { key: 'key', label: T('Ключ (27 знаков или слово)', 'Key (27 symbols or a word)'), type: 'text', default: '' },
      { key: 'period', label: PERIOD_PARAM.label, type: 'number', default: 5 },
      DIR_PARAM, GROUP_PARAM,
    ],
    run(inputs, p) { return fractionate(inputs[0], p, 3, 3, squareChars(keyOf(inputs, p), 3)); },
  });

  // ---------- ADFGX / ADFGVX ----------
  // Порядок столбцов: сортировка по знаку ключа, при равенстве — слева направо.
  function columnRank(key) {
    return Array.from(key, (ch, i) => i).sort((a, b) => key.charCodeAt(a) - key.charCodeAt(b) || a - b);
  }

  function adfgxEncrypt(letters, chars, labels, tkey) {
    const side = labels.length;
    const frac = letters.map((ch) => {
      const i = chars.indexOf(ch);
      return labels[Math.floor(i / side)] + labels[i % side];
    }).join('');
    const k = tkey.length;
    return columnRank(tkey).map((col) => Array.from(frac).filter((_, i) => i % k === col).join('')).join('');
  }

  function adfgxDecrypt(cipher, chars, labels, tkey) {
    const side = labels.length;
    const k = tkey.length;
    const n = cipher.length;
    const grid = Array.from({ length: n });
    let pos = 0;
    for (const col of columnRank(tkey)) {
      const len = Math.floor(n / k) + (col < n % k ? 1 : 0);
      for (let r = 0; r < len; r++) grid[r * k + col] = cipher[pos++];
    }
    let out = '';
    for (let i = 0; i + 1 < n; i += 2) {
      const a = labels.indexOf(grid[i]);
      const b = labels.indexOf(grid[i + 1]);
      out += chars[a * side + b];
    }
    return out;
  }

  function adfgxRun(inputs, p, labels) {
    const side = labels.length;
    const chars = squareChars(p.square, side === 6 ? 6 : 5);
    const tkey = String(keyOf(inputs, p)).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!tkey) fail('Нужен ключ перестановки (слово)', 'A transposition keyword is required');
    if (p.dir === 'enc') return grouped(adfgxEncrypt(squareText(inputs[0], chars), chars, labels, tkey), p.group);
    const cipher = Array.from(String(inputs[0]).toUpperCase()).filter((ch) => labels.includes(ch));
    if (cipher.length % 2) fail('Нечётное число знаков ' + labels, 'Odd number of ' + labels + ' symbols');
    return grouped(adfgxDecrypt(cipher, chars, labels, tkey), p.group);
  }

  function adfgxDef(id, name, labels, sample) {
    def({
      id, name, cat: 'Шифры с ключом', prior: 0, inputs: [T('вход', 'input'), T('ключ перестановки', 'transposition key')],
      desc: T('Замена по квадрату на буквы ' + labels + ', затем столбцовая перестановка по ключевому слову. ' + sample,
        'Square substitution into the letters ' + labels + ', then columnar transposition by a keyword. ' + sample),
      params: [
        { key: 'square', label: T('Квадрат (слово или весь)', 'Square (word or full)'), type: 'text', default: '' },
        { key: 'key', label: T('Ключ перестановки', 'Transposition key'), type: 'text', default: 'KEY' },
        DIR_PARAM, GROUP_PARAM,
      ],
      run: (inputs, p) => adfgxRun(inputs, p, labels),
    });
  }

  adfgxDef('adfgx', 'ADFGX', 'ADFGX', T('Квадрат 5×5, J=I.', '5×5 square, J=I.'));
  adfgxDef('adfgvx', 'ADFGVX', 'ADFGVX', T('Вики: квадрат NA1C3H8TB2OME5WRPD4F6G7I9J0KLQSUVXYZ, ключ PRIVACY, ATTACKAT1200AM → DGDDDAGDDGAFADDFDADVDVFAADVX.',
    'Wikipedia: square NA1C3H8TB2OME5WRPD4F6G7I9J0KLQSUVXYZ, key PRIVACY, ATTACKAT1200AM → DGDDDAGDDGAFADDFDADVDVFAADVX.'));

  // ---------- Пары квадратов: Четыре квадрата и Два квадрата ----------
  function digraphs(text, dir) {
    const letters = squareText(text, AZ25);
    if (letters.length % 2) {
      if (dir === 'dec') fail('Нечётное число букв: нужны пары', 'Odd number of letters: digraphs are required');
      letters.push('X');
    }
    return chunks(letters, 2);
  }

  const at = (sq, r, c) => sq[r * 5 + c];
  const rc = (sq, ch) => [Math.floor(sq.indexOf(ch) / 5), sq.indexOf(ch) % 5];

  // Шифр четырёх квадратов. Левый верхний и правый нижний — обычные, два других — с ключами.
  function fourSquare(pair, dir, tr, bl) {
    const [a, b] = pair;
    if (dir === 'enc') {
      const [r1, c1] = rc(AZ25, a);
      const [r2, c2] = rc(AZ25, b);
      return at(tr, r1, c2) + at(bl, r2, c1);
    }
    const [r1, c2] = rc(tr, a);
    const [r2, c1] = rc(bl, b);
    return at(AZ25, r1, c1) + at(AZ25, r2, c2);
  }

  def({
    id: 'four_square', name: T('Четыре квадрата', 'Four-square'), cat: 'Шифры с ключом', prior: 0,
    desc: T('Биграммы по двум ключевым квадратам (справа сверху и слева снизу), два других — обычный алфавит. Вики: ключи EXAMPLE/KEYWORD, HE → FY.',
      'Digraphs through two keyed squares (top-right and bottom-left); the other two are the plain alphabet. Wikipedia: keys EXAMPLE/KEYWORD, HE → FY.'),
    params: [
      { key: 'key1', label: T('Ключ 1 (справа сверху)', 'Key 1 (top-right)'), type: 'text', default: 'EXAMPLE' },
      { key: 'key2', label: T('Ключ 2 (слева снизу)', 'Key 2 (bottom-left)'), type: 'text', default: 'KEYWORD' },
      DIR_PARAM, GROUP_PARAM,
    ],
    run([t], p) {
      const tr = squareChars(p.key1, 5);
      const bl = squareChars(p.key2, 5);
      return grouped(digraphs(t, p.dir).map((pair) => fourSquare(pair, p.dir, tr, bl)).join(''), p.group);
    },
  });

  // Шифр двух квадратов: горизонтальный (квадраты рядом) и вертикальный (один под другим).
  // Если буквы лежат на одной строке (столбце), пара меняется местами.
  function twoSquare(pair, dir, s1, s2, horizontal) {
    const [a, b] = pair;
    if (dir === 'enc') {
      const [r1, c1] = rc(s1, a);
      const [r2, c2] = rc(s2, b);
      return horizontal ? at(s2, r1, c2) + at(s1, r2, c1) : at(s2, r2, c1) + at(s1, r1, c2);
    }
    if (horizontal) {
      const [r1, c2] = rc(s2, a);
      const [r2, c1] = rc(s1, b);
      return at(s1, r1, c1) + at(s2, r2, c2);
    }
    const [r2, c1] = rc(s2, a);
    const [r1, c2] = rc(s1, b);
    return at(s1, r1, c1) + at(s2, r2, c2);
  }

  def({
    id: 'two_square', name: T('Два квадрата', 'Two-square'), cat: 'Шифры с ключом', prior: 0,
    desc: T('Двойной Плейфер: первая буква пары ищется в первом квадрате, вторая — во втором; шифр берётся с углов прямоугольника.',
      'Double Playfair: the first letter of a digraph is looked up in square 1, the second in square 2; the ciphertext is taken from the other rectangle corners.'),
    params: [
      { key: 'key1', label: T('Ключ 1 (слева/сверху)', 'Key 1 (left/top)'), type: 'text', default: 'EXAMPLE' },
      { key: 'key2', label: T('Ключ 2 (справа/снизу)', 'Key 2 (right/bottom)'), type: 'text', default: 'KEYWORD' },
      { key: 'layout', label: T('Расположение', 'Layout'), type: 'select', options: [['h', T('Горизонтально', 'Horizontal')], ['v', T('Вертикально', 'Vertical')]], default: 'h' },
      DIR_PARAM, GROUP_PARAM,
    ],
    run([t], p) {
      const s1 = squareChars(p.key1, 5);
      const s2 = squareChars(p.key2, 5);
      return grouped(digraphs(t, p.dir).map((pair) => twoSquare(pair, p.dir, s1, s2, p.layout === 'h')).join(''), p.group);
    },
  });

  // ---------- Шифр нигилистов ----------
  const nihilistNumber = (sq, ch) => { const [r, c] = rc(sq, ch); return (r + 1) * 10 + c + 1; };

  def({
    id: 'nihilist', name: T('Нигилистов', 'Nihilist'), cat: 'Шифры с ключом', prior: 0, inputs: [T('вход', 'input'), T('ключ', 'key')],
    desc: T('Квадрат Полибия даёт двузначные числа (строка·10+столбец); к ним прибавляются числа ключа. Вики: квадрат ZEBRAS, ключ RUSSIAN: D→23+R→14 = 37.',
      'A Polybius square gives two-digit numbers (row·10+column) and the key numbers are added. Wikipedia: square ZEBRAS, key RUSSIAN: D→23 + R→14 = 37.'),
    params: [
      { key: 'square', label: T('Квадрат (слово)', 'Square (word)'), type: 'text', default: 'ZEBRAS' },
      { key: 'key', label: T('Ключ', 'Key'), type: 'text', default: 'RUSSIAN' },
      DIR_PARAM,
    ],
    run(inputs, p) {
      const sq = squareChars(p.square, 5);
      const key = squareText(keyOf(inputs, p), sq).map((ch) => nihilistNumber(sq, ch));
      if (!key.length) fail('В ключе нет букв квадрата', 'The key has no letters of the square');
      if (p.dir === 'enc') {
        return squareText(inputs[0], sq).map((ch, i) => nihilistNumber(sq, ch) + key[i % key.length]).join(' ');
      }
      const nums = (String(inputs[0]).match(/\d+/g) || []).map(Number);
      if (!nums.length) fail('Ожидались числа', 'Numbers expected');
      return nums.map((n, i) => {
        const v = n - key[i % key.length];
        const r = Math.floor(v / 10) - 1;
        const c = (v % 10) - 1;
        if (r < 0 || r > 4 || c < 0 || c > 4) fail('Число ' + n + ' не даёт координат квадрата (позиция ' + (i + 1) + ')', 'Number ' + n + ' gives no square coordinates (position ' + (i + 1) + ')');
        return sq[r * 5 + c];
      }).join('');
    },
  });

  G.ClassicUtil = { T, AZ, AZ25, AZ36, fail, mod, keyedAlphabet, squareChars, squareText, grouped, chunks, DIR_PARAM, GROUP_PARAM, columnRank };
})(typeof self !== 'undefined' ? self : this);
