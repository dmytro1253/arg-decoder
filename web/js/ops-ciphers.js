// Шифры: сдвиги, подстановки и шифры с ключом.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const C = G.Codec;
  const { def, keyOf, letterCount, hasLatin, hasCyr, range, lenient, bytesOf } = G.CipherOps;
  // Перестановки коротких строк дают кучу анаграмм, одна из которых случайно «похожа на слово».
  const MIN_PERM = 12;
  const ALPHA_PARAM = { key: 'alpha', label: T('Алфавит', 'Alphabet'), type: 'select', options: C.ALPHABET_OPTIONS, default: 'auto' };

  // Ключи для перебора: банк ключей проекта + встроенные ключи активного профиля (у «neutral» их нет).
  const projectKeys = () => (G.Profiles ? G.Profiles.keys() : []);
  // Сдвиги, которые активный профиль считает характерными (у «neutral» их нет).
  const profileShifts = () => (G.Profiles && G.Profiles.active().probeShifts) || [];

  // ===================== Сдвиги =====================
  def({
    id: 'char_shift', name: T('Сдвиг кодов символов', 'Character code shift'), cat: 'Сдвиги', prior: 6,
    favorite: (p) => Math.abs(Number(p.n)) === 23,
    desc: T('Прибавить N к коду каждого символа (T09XS<<cK1! при N=23 → kGPojSSzbH8).', 'Add N to the code of every character (T09XS<<cK1! with N=23 → kGPojSSzbH8).'),
    params: [
      { key: 'n', label: T('Сдвиг N', 'Shift N'), type: 'number', int: true, min: -1114111, max: 1114111, default: 1 },
      { key: 'wrap', label: T('Переполнение', 'Overflow'), type: 'select', options: [['none', T('Без обёртки', 'No wrap')], ['256', T('По модулю 256', 'Modulo 256')], ['95', T('Печатные ASCII (95)', 'Printable ASCII (95)')]], default: 'none' },
    ],
    run([t], p) {
      const n = Number(p.n);
      let out = '';
      for (const ch of t) {
        const c = ch.codePointAt(0);
        let r;
        if (p.wrap === '256') r = C.mod(c + n, 256);
        else if (p.wrap === '95') r = c >= 32 && c <= 126 ? 32 + C.mod(c - 32 + n, 95) : c;
        else r = c + n;
        if (r < 0 || r > 0x10ffff) throw new Error(T('Код вышел за пределы: ' + r, 'The code is out of range: ' + r));
        out += String.fromCodePoint(r);
      }
      return out;
    },
    probes(t) {
      if (t.length < 2) return [];
      const res = profileShifts().flatMap((n) => [{ n, wrap: 'none' }, { n: -n, wrap: 'none' }]);
      // Полный диапазон — только для «символьной каши» (знаки, байты), а не для обычных слов.
      const symbols = (t.match(/[^a-zа-яёіїєґ0-9\s]/gi) || []).length;
      const seen = new Set(res.map((x) => x.n));
      // Несколько знаков среди букв и цифр (URL, пути) — тоже повод попробовать весь диапазон: Cicada 3301, «…>33m2…» − 4.
      const wide = symbols / t.length >= 0.15 || (symbols >= 3 && symbols / t.length >= 0.08);
      const more = wide ? range(-40, 40).filter((n) => n !== 0) : [1, -1, 32, -32, 7, -7];
      for (const n of more) if (!seen.has(n)) res.push({ n, wrap: 'none' });
      return res;
    },
  });

  def({
    id: 'caesar', name: T('Цезарь', 'Caesar'), cat: 'Сдвиги', prior: 4,
    desc: T('Сдвиг букв по алфавиту. Для кириллицы можно выбрать алфавит из 33 букв с Ё или из 32 без неё, а также украинский.', 'Shifts letters along the alphabet. For Cyrillic you can pick 33 letters with Ё, 32 without it, or Ukrainian.'),
    params: [ALPHA_PARAM, { key: 'n', label: T('Сдвиг', 'Shift'), type: 'number', int: true, min: -100000, max: 100000, default: 3 }],
    run([t], p) { return C.mapLetters(t, p.alpha, (i) => i + Number(p.n)); },
    probes(t) {
      if (letterCount(t) < 3) return [];
      const res = [];
      if (hasLatin(t)) for (const n of range(1, 25)) res.push({ alpha: 'en', n });
      if (hasCyr(t)) {
        const cyr = C.autoCyrillic(t);
        for (const n of range(1, C.ALPHABETS[cyr].length - 1)) res.push({ alpha: cyr, n });
      }
      return res;
    },
  });

  def({
    id: 'rot47', name: 'ROT47', cat: 'Сдвиги', prior: 1,
    run([t]) { return Array.from(t, (ch) => { const c = ch.charCodeAt(0); return c >= 33 && c <= 126 ? String.fromCharCode(33 + ((c + 14) % 94)) : ch; }).join(''); },
    probes(t) { return /[!-~]/.test(t) && t.length >= 3 ? [{}] : []; },
  });

  def({
    id: 'atbash', name: T('Атбаш', 'Atbash'), cat: 'Сдвиги', prior: 2,
    desc: T('Зеркальный алфавит: A↔Z, А↔Я.', 'Mirrored alphabet: A↔Z, А↔Я.'),
    params: [ALPHA_PARAM],
    run([t], p) { return C.mapLetters(t, p.alpha, (i, n) => n - 1 - i); },
    // В смешанном тексте (кириллица + ссылка латиницей) зеркалить нужно один алфавит: пробуем и каждый отдельно.
    probes(t) {
      if (letterCount(t) < 3) return [];
      const cyr = /[а-яёієїґ]/i.test(t), lat = /[a-z]/i.test(t);
      if (!(cyr && lat)) return [{ alpha: 'auto' }];
      return [{ alpha: 'auto' }, { alpha: 'en' }, { alpha: /[ієїґ]/i.test(t) ? 'uk33' : 'ru33' }];
    },
  });

  def({
    id: 'affine', name: T('Аффинный (расшифровка)', 'Affine (decryption)'), cat: 'Сдвиги', prior: 1,
    desc: T('x = a⁻¹·(y − b) mod m. a должно быть взаимно простым с длиной алфавита.', 'x = a⁻¹·(y − b) mod m. a must be coprime with the alphabet length.'),
    params: [ALPHA_PARAM, { key: 'a', label: 'a', type: 'number', int: true, min: -100000, max: 100000, default: 5 }, { key: 'b', label: 'b', type: 'number', int: true, min: -100000, max: 100000, default: 8 }],
    run([t], p) {
      return C.mapLetters(t, p.alpha, (i, m) => {
        const inv = C.modInverse(Number(p.a), m);
        if (inv === null) throw new Error(T('a=' + p.a + ' не обратимо по модулю ' + m, 'a=' + p.a + ' is not invertible modulo ' + m));
        return inv * (i - Number(p.b));
      });
    },
    probes(t) {
      if (letterCount(t) < 4 || !hasLatin(t)) return [];
      const res = [];
      for (const a of [3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25]) for (const b of range(0, 25)) res.push({ alpha: 'en', a, b });
      return res;
    },
  });

  def({
    id: 'substitute', name: T('Простая замена', 'Simple substitution'), cat: 'Сдвиги',
    desc: T('Каждый символ из строки «Что» заменяется символом из строки «На что» на той же позиции.', 'Every character of “From” is replaced by the character at the same position in “To”.'),
    params: [
      { key: 'from', label: T('Что', 'From'), type: 'text', default: 'abcdefghijklmnopqrstuvwxyz' },
      { key: 'to', label: T('На что', 'To'), type: 'text', default: 'zyxwvutsrqponmlkjihgfedcba' },
      { key: 'keepCase', label: T('Учитывать регистр', 'Respect case'), type: 'bool', default: true },
    ],
    run([t], p) {
      const from = Array.from(p.from), to = Array.from(p.to);
      const map = new Map();
      from.forEach((ch, i) => { if (to[i] !== undefined) map.set(ch, to[i]); });
      return Array.from(t, (ch) => {
        if (map.has(ch)) return map.get(ch);
        if (p.keepCase && map.has(ch.toLowerCase())) return map.get(ch.toLowerCase()).toUpperCase();
        return ch;
      }).join('');
    },
  });

  // ===================== Шифры с ключом =====================
  // Индексы ключа в выбранном алфавите; символы ключа вне алфавита пропускаются.
  function keyShifts(key, alphaMode, textSample) {
    let mode = alphaMode;
    // Ключ из цифр — шифр Гронсфельда: каждая цифра и есть сдвиг.
    if (/^\d+$/.test(key.trim())) {
      if (mode === 'auto') mode = hasCyr(textSample) && !hasLatin(textSample) ? C.autoCyrillic(textSample) : 'en';
      return { mode, shifts: Array.from(key.trim(), Number) };
    }
    if (mode === 'auto') mode = hasCyr(key) ? C.autoCyrillic(key + textSample) : hasLatin(key) ? 'en' : (hasCyr(textSample) ? C.autoCyrillic(textSample) : 'en');
    const alpha = C.ALPHABETS[mode];
    const shifts = Array.from(key.toLowerCase()).map((ch) => alpha.indexOf(ch)).filter((i) => i >= 0);
    if (!shifts.length) throw new Error(T('В ключе нет букв выбранного алфавита', 'The key has no letters of the selected alphabet'));
    return { mode, shifts };
  }

  // kind: 'vigenere' | 'beaufort' | 'variant'; dir: 'dec' | 'enc'.
  function periodic(text, key, alphaMode, kind, dir, skip) {
    const { mode, shifts } = keyShifts(key, alphaMode, text);
    let pos = 0;
    let out = '';
    const alpha = C.ALPHABETS[mode];
    for (const ch of text) {
      const lower = ch.toLowerCase();
      const idx = alpha.indexOf(lower);
      if (idx < 0) { if (!skip) pos++; out += ch; continue; }
      const k = shifts[pos++ % shifts.length];
      let r;
      if (kind === 'beaufort') r = k - idx;
      else if ((kind === 'vigenere') === (dir === 'dec')) r = idx - k;
      else r = idx + k;
      const mapped = alpha[C.mod(r, alpha.length)];
      out += ch === lower ? mapped : mapped.toUpperCase();
    }
    return out;
  }

  const KEY_PARAMS = [
    { key: 'key', label: T('Ключ', 'Key'), type: 'text', default: 'key' },
    { key: 'dir', label: T('Режим', 'Mode'), type: 'select', options: [['dec', T('Расшифровать', 'Decrypt')], ['enc', T('Зашифровать', 'Encrypt')]], default: 'dec' },
    { key: 'alpha', label: T('Алфавит', 'Alphabet'), type: 'select', options: C.ALPHABET_OPTIONS, default: 'auto' },
    { key: 'skip', label: T('Цифры и знаки не тратят ключ', 'Digits and punctuation do not use up the key'), type: 'bool', default: true },
  ];

  // Пробы для шифров с ключом: только ключи проекта (и профиля). Без ключей — нечего пробовать;
  // взлом без ключа делают VigenereCrack/VigenereAuto.
  function keyProbes(t) {
    if (letterCount(t) < 3) return [];
    const res = [];
    for (const key of projectKeys()) {
      const latinKey = hasLatin(key);
      const numeric = /^\d+$/.test(key);
      if (!numeric && ((latinKey && !hasLatin(t)) || (!latinKey && !hasCyr(t)))) continue;
      for (const dir of ['dec', 'enc']) for (const skip of [true, false]) res.push({ key, dir, alpha: 'auto', skip });
    }
    return res;
  }

  def({
    id: 'vigenere', name: T('Виженер', 'Vigenère'), cat: 'Шифры с ключом', prior: 5, inputs: [T('вход', 'input'), T('ключ', 'key')],
    favorite: (p) => p.dir === 'dec' && p.skip,
    desc: T('Многоалфавитный шифр с ключевым словом. Ключ можно подать вторым входом. Пример: h2njbrLB5kj + yfqlbvtyz → j2itqqQI5mk.', 'A polyalphabetic cipher with a key word. The key can be fed to the second input. Example: h2njbrLB5kj + yfqlbvtyz → j2itqqQI5mk.'),
    params: KEY_PARAMS,
    run(inputs, p) { return periodic(inputs[0], keyOf(inputs, p), p.alpha, 'vigenere', p.dir, p.skip); },
    probes: keyProbes,
  });

  def({
    id: 'beaufort', name: T('Бофор', 'Beaufort'), cat: 'Шифры с ключом', prior: 1, inputs: [T('вход', 'input'), T('ключ', 'key')],
    desc: T('P = K − C (симметричный: шифрование совпадает с расшифровкой).', 'P = K − C (symmetric: encryption equals decryption).'),
    params: KEY_PARAMS.filter((x) => x.key !== 'dir'),
    run(inputs, p) { return periodic(inputs[0], keyOf(inputs, p), p.alpha, 'beaufort', 'dec', p.skip); },
    probes(t) { return keyProbes(t).filter((x) => x.dir === 'dec'); },
  });

  def({
    id: 'autokey', name: T('Автоключ (Виженер)', 'Autokey (Vigenère)'), cat: 'Шифры с ключом', prior: 1, inputs: [T('вход', 'input'), T('ключ', 'key')],
    desc: T('После ключа продолжает уже расшифрованным текстом.', 'After the key it continues with the already decrypted text.'),
    params: [KEY_PARAMS[0], KEY_PARAMS[2]],
    run(inputs, p) {
      const key = keyOf(inputs, p);
      const { mode, shifts } = keyShifts(key, p.alpha, inputs[0]);
      const alpha = C.ALPHABETS[mode];
      const stream = shifts.slice();
      let pos = 0, out = '';
      for (const ch of inputs[0]) {
        const lower = ch.toLowerCase();
        const idx = alpha.indexOf(lower);
        if (idx < 0) { out += ch; continue; }
        const plain = C.mod(idx - stream[pos++], alpha.length);
        stream.push(plain);
        out += ch === lower ? alpha[plain] : alpha[plain].toUpperCase();
      }
      return out;
    },
    probes(t) { return keyProbes(t).filter((x) => x.dir === 'dec' && x.skip).map((x) => ({ key: x.key, alpha: 'auto' })); },
  });

  // Известный открытый текст для XOR над сжатыми данными: поток zlib начинается с CMF/FLG (78 01/5E/9C/DA и другие
  // окна), gzip — с 1F 8B 08. Первые байты входа сразу дают ключ из 1–3 байт; верен ли он, решит распаковка
  // (заголовок и контрольная сумма), поэтому кандидатов немного и они не «угадываются» перебором.
  const ZLIB_FLG = [0x01, 0x5e, 0x9c, 0xda];
  const GZIP_HEAD = [0x1f, 0x8b, 0x08];
  const hex2 = (n) => n.toString(16).padStart(2, '0');
  function compressedHeaderKeys(t) {
    if (t.length < 18) return [];
    const b = [0, 1, 2].map((i) => t.charCodeAt(i));
    const keys = new Set();
    for (let cmf = 0x08; cmf <= 0x78; cmf += 0x10) {
      const k = b[0] ^ cmf;
      if (((cmf << 8) | (b[1] ^ k)) % 31 === 0 && !((b[1] ^ k) & 0x20)) keys.add(hex2(k));   // однобайтовый ключ, без FDICT
    }
    for (const flg of ZLIB_FLG) { const k0 = b[0] ^ 0x78, k1 = b[1] ^ flg; if (k0 !== k1) keys.add(hex2(k0) + hex2(k1)); }
    const g = GZIP_HEAD.map((x, i) => b[i] ^ x);
    if (g[0] === g[1] && g[1] === g[2]) keys.add(hex2(g[0]));
    else { if (g[0] === g[2]) keys.add(hex2(g[0]) + hex2(g[1])); keys.add(g.map(hex2).join('')); }
    return [...keys].map((key) => ({ key, fmt: 'hex' }));
  }

  // Ключ XOR: число, HEX или текст. Мягкий режим предупреждает о потерях, строгий бросает ошибку.
  function xorKey(raw, p, enc) {
    if (p.fmt === 'num') {
      const s = raw.trim();
      const n = Number(s);
      if (s === '' || !Number.isInteger(n)) throw new Error(T('Ключ XOR «' + raw + '» — не целое число', 'XOR key “' + raw + '” is not an integer'));
      if (n < 0 || n > 255) lenient(p.strict, T('Ключ ' + n + ' вне 0..255: взято по модулю 256', 'Key ' + n + ' is outside 0..255: taken modulo 256'));
      return [((n % 256) + 256) % 256];
    }
    if (p.fmt === 'hex') {
      const digits = raw.replace(/[\s,:;-]|0x/gi, '');
      if (/[^0-9a-f]/i.test(digits)) lenient(p.strict, T('В HEX-ключе есть не-hex символы — они пропущены', 'The HEX key has non-hex characters — they were skipped'));
      const clean = digits.replace(/[^0-9a-f]/gi, '');
      if (clean.length % 2) lenient(p.strict, T('Нечётное число hex-цифр в ключе: последний полубайт «' + clean.slice(-1) + '» отброшен', 'Odd number of hex digits in the key: the last nibble “' + clean.slice(-1) + '” was dropped'));
      return (clean.match(/../g) || []).map((h) => parseInt(h, 16));
    }
    return Array.from(bytesOf(raw, enc === 'auto' ? 'utf8' : enc), (c) => c.charCodeAt(0));
  }

  def({
    id: 'xor', name: T('XOR с ключом', 'XOR with a key'), cat: 'Шифры с ключом', prior: 1, inputs: [T('вход', 'input'), T('ключ', 'key')],
    desc: T('Побайтовый XOR. Ключ — число, hex («1f 2a») или текст. «Авто» читает байтовую строку как есть (после HEX/Base64), иначе UTF-8.', 'Byte-wise XOR. The key is a number, hex (“1f 2a”) or text. “Auto” reads a byte string as is (after HEX/Base64), otherwise UTF-8.'),
    params: [
      { key: 'key', label: T('Ключ', 'Key'), type: 'text', default: '1' },
      { key: 'fmt', label: T('Формат ключа', 'Key format'), type: 'select', options: [['num', T('Число', 'Number')], ['text', T('Текст', 'Text')], ['hex', 'HEX']], default: 'num' },
      { key: 'enc', label: T('Вход как', 'Read input as'), type: 'select', options: [['auto', T('Авто (байты, если все ≤ 255, иначе UTF-8)', 'Auto (bytes if all ≤ 255, otherwise UTF-8)')], ['utf8', 'UTF-8'], ['latin1', T('Байты как есть', 'Bytes as is')]], default: 'auto' },
      G.CipherOps.STRICT_PARAM,
    ],
    run(inputs, p) {
      const key = xorKey(String(keyOf(inputs, p)), p, p.enc);
      if (!key.length) throw new Error(T('Пустой ключ XOR', 'Empty XOR key'));
      const bin = G.CipherOps.inputBytes(inputs[0], p.enc);
      let out = '';
      for (let i = 0; i < bin.length; i++) out += String.fromCharCode(bin.charCodeAt(i) ^ key[i % key.length]);
      return out;
    },
    probes(t) {
      // XOR перебираем только по «сырым» байтам, иначе он заваливает поиск мусором.
      if (t.length < 3 || !/[\u0000-\u001f\u007f-ÿ]/.test(t) || /[^\u0000-ÿ]/.test(t)) return [];
      return [23, 32, 1, 7, 13, 42, 64, 127, 255].map((n) => ({ key: String(n), fmt: 'num' })).concat(compressedHeaderKeys(t));
    },
  });

  // Сырой RC4 (без контейнера OpenSSL Salted__ и без производства ключа из пароля): ключ — байты как есть.
  def({
    id: 'rc4', name: T('RC4 (сырой поток)', 'RC4 (raw stream)'), cat: 'Шифры с ключом', prior: 0, inputs: [T('вход', 'input'), T('ключ', 'key')],
    desc: T('Обычный RC4: ключ — текст (UTF-8) или HEX, без соли и без EVP_BytesToKey; шифрование и расшифровка совпадают. «Отбросить» — RC4-drop[N] (первые N байт потока). Для файлов «openssl enc -rc4» с Salted__ нужна нода OpenSSL. Выход — байты (дальше «Байты → текст» или HEX).',
      'Plain RC4: the key is text (UTF-8) or HEX, with no salt and no EVP_BytesToKey; encryption equals decryption. “Drop” is RC4-drop[N] (the first N stream bytes). Files from “openssl enc -rc4” with Salted__ need the OpenSSL node. The output is bytes (then Bytes → text or HEX).'),
    params: [
      { key: 'key', label: T('Ключ', 'Key'), type: 'text', default: '' },
      { key: 'fmt', label: T('Формат ключа', 'Key format'), type: 'select', options: [['text', T('Текст', 'Text')], ['hex', 'HEX']], default: 'text' },
      { key: 'drop', label: T('Отбросить байт потока', 'Drop stream bytes'), type: 'number', default: 0 },
      { key: 'enc', label: T('Вход как', 'Read input as'), type: 'select', options: [['auto', T('Авто (байты, если все ≤ 255, иначе UTF-8)', 'Auto (bytes if all ≤ 255, otherwise UTF-8)')], ['utf8', 'UTF-8'], ['latin1', T('Байты как есть', 'Bytes as is')]], default: 'auto' },
      G.CipherOps.STRICT_PARAM,
    ],
    run(inputs, p) {
      const key = xorKey(String(keyOf(inputs, p)), p, 'utf8');
      if (!key.length || key.length > 256) throw new Error(T('Ключ RC4: от 1 до 256 байт', 'RC4 key: 1 to 256 bytes'));
      const drop = Number(p.drop) || 0;
      if (!Number.isInteger(drop) || drop < 0 || drop > 1 << 20) throw new Error(T('«Отбросить» — целое от 0 до 1048576', '“Drop” is an integer from 0 to 1048576'));
      const S = Array.from({ length: 256 }, (_, i) => i);
      for (let i = 0, j = 0; i < 256; i++) { j = (j + S[i] + key[i % key.length]) & 255; [S[i], S[j]] = [S[j], S[i]]; }
      let i = 0, j = 0;
      const next = () => { i = (i + 1) & 255; j = (j + S[i]) & 255; [S[i], S[j]] = [S[j], S[i]]; return S[(S[i] + S[j]) & 255]; };
      for (let k = 0; k < drop; k++) next();
      const bin = G.CipherOps.inputBytes(inputs[0], p.enc);
      let out = '';
      for (let k = 0; k < bin.length; k++) out += String.fromCharCode(bin.charCodeAt(k) ^ next());
      return out;
    },
  });

  def({
    id: 'rail_fence', name: T('Рельсовая изгородь', 'Rail fence'), cat: 'Перестановки', prior: 1,
    params: [
      { key: 'rails', label: T('Рельсов', 'Rails'), type: 'number', int: true, min: 2, max: 1000, default: 3 },
      { key: 'dir', label: T('Режим', 'Mode'), type: 'select', options: [['dec', T('Расшифровать', 'Decrypt')], ['enc', T('Зашифровать', 'Encrypt')]], default: 'dec' },
    ],
    run([t], p) {
      const n = Math.max(2, Number(p.rails));
      const chars = Array.from(t);
      const pattern = chars.map((_, i) => { const c = i % (2 * n - 2); return c < n ? c : 2 * n - 2 - c; });
      const order = chars.map((_, i) => i).sort((a, b) => pattern[a] - pattern[b] || a - b);
      const out = new Array(chars.length);
      if (p.dir === 'enc') return order.map((i) => chars[i]).join('');
      order.forEach((pos, i) => { out[pos] = chars[i]; });
      return out.join('');
    },
    probes(t) { return t.length >= MIN_PERM ? range(2, Math.min(6, t.length - 1)).map((rails) => ({ rails, dir: 'dec' })) : []; },
  });

  def({
    id: 'transpose', name: T('Сетка: строки ↔ столбцы', 'Grid: rows ↔ columns'), cat: 'Перестановки', prior: 1,
    desc: T('Записать текст строками по W символов и прочитать столбцами (и обратно).', 'Write the text in rows of W characters and read it by columns (and back).'),
    params: [
      { key: 'w', label: T('Ширина W', 'Width W'), type: 'number', int: true, min: 1, max: 100000, default: 7 },
      { key: 'dir', label: T('Читать', 'Read'), type: 'select', options: [['cols', T('Столбцами', 'By columns')], ['rows', T('Обратно (из столбцов)', 'Back (from columns)')]], default: 'cols' },
    ],
    run([t], p) {
      const chars = Array.from(t);
      const w = Math.max(1, Number(p.w));
      const h = Math.ceil(chars.length / w);
      if (p.dir === 'cols') {
        let out = '';
        for (let c = 0; c < w; c++) for (let r = 0; r < h; r++) if (r * w + c < chars.length) out += chars[r * w + c];
        return out;
      }
      const out = new Array(chars.length);
      let k = 0;
      for (let c = 0; c < w; c++) for (let r = 0; r < h; r++) if (r * w + c < chars.length) out[r * w + c] = chars[k++];
      return out.join('');
    },
    probes(t) {
      const n = Array.from(t).length;
      if (n < MIN_PERM) return [];
      return range(2, Math.min(10, n - 1)).filter((w) => n % w === 0).flatMap((w) => [{ w, dir: 'cols' }, { w, dir: 'rows' }]);
    },
  });

  G.CipherOps.periodic = periodic;
  G.CipherOps.xorKey = xorKey;
  G.CipherOps.keyShifts = keyShifts;
  G.CipherOps.projectKeys = projectKeys;
})(typeof self !== 'undefined' ? self : this);
