// Алфавиты и системы знаков как текстовые отображения: пигпен, руны, шрифт Брайля, фонетический алфавит.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const { def } = G.CipherOps;

  const fail = (ru, en) => { throw new Error(T(ru, en)); };

  // ===================== Пигпен =====================
  // Нотация жетонов (через пробел, «/» — пробел между словами):
  //  сетка: стороны клетки, у которых есть линия: t сверху, l слева, r справа, b снизу — rb, lrb, lb, trb, tlrb, tlb, tr, tlr, tl (A–I);
  //  крест: v (клин сверху, ∨), < (слева), > (справа), ^ (снизу, ∧) — S, T, U, V;
  //  точка в конце жетона (rb. или v.) — те же фигуры с точкой: J–R и W–Z.
  const PIGPEN_SHAPES = ['rb', 'lrb', 'lb', 'trb', 'tlrb', 'tlb', 'tr', 'tlr', 'tl'];
  const PIGPEN_WEDGES = ['v', '<', '>', '^'];
  const PIGPEN_GLYPH = {
    rb: '┘', lrb: '⊔', lb: '└', trb: '⊐', tlrb: '□', tlb: '⊏', tr: '┐', tlr: '⊓', tl: '┌', v: '∨', '<': '<', '>': '>', '^': '∧',
  };
  const DOT_CHARS = '·•.˙⸱';
  const LETTER_TOKEN = {};
  const TOKEN_LETTER = {};
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((ch, i) => {
    let token;
    if (i < 9) token = PIGPEN_SHAPES[i];
    else if (i < 18) token = PIGPEN_SHAPES[i - 9] + '.';
    else token = PIGPEN_WEDGES[(i - 18) % 4] + (i >= 22 ? '.' : '');
    LETTER_TOKEN[ch] = token;
    TOKEN_LETTER[token] = ch;
  });

  const GLYPH_TOKEN = Object.fromEntries(Object.entries(PIGPEN_GLYPH).map(([tok, glyph]) => [glyph, tok]));
  const ASCII_TOKEN = /^(?:[tlrb]{2,4}|[v<>^])\.?$/;

  // Нормализация ASCII-жетона: стороны в порядке t, l, r, b.
  function canonShape(token) {
    const dot = token.endsWith('.') ? '.' : '';
    const body = token.replace('.', '');
    return /^[tlrb]+$/.test(body) ? 'tlrb'.split('').filter((s) => body.includes(s)).join('') + dot : body + dot;
  }

  // Разбор куска без пробелов: подряд идущие юникод-знаки, за каждым может стоять точка.
  function scanGlyphs(chunk) {
    const out = [];
    for (const ch of chunk) {
      if (DOT_CHARS.includes(ch) && out.length) { out[out.length - 1] += '.'; continue; }
      if (!GLYPH_TOKEN[ch]) fail('Неизвестный знак пигпена «' + ch + '»', 'Unknown pigpen glyph “' + ch + '”');
      out.push(GLYPH_TOKEN[ch]);
    }
    return out;
  }

  function pigpenDecode(text) {
    return text.trim().split(/\s+/).map((chunk) => {
      if (chunk === '/' || chunk === '|') return ' ';
      const tokens = ASCII_TOKEN.test(chunk) ? [canonShape(chunk)] : scanGlyphs(chunk);
      return tokens.map((tok) => {
        const letter = TOKEN_LETTER[canonShape(tok)];
        if (!letter) fail('Нет такой фигуры пигпена: ' + tok, 'No such pigpen shape: ' + tok);
        return letter;
      }).join('');
    }).join('').replace(/ +/g, ' ');
  }

  def({
    id: 'pigpen_decode', name: T('Пигпен → буквы', 'Pigpen → letters'), cat: 'Кодировки', prior: 0,
    desc: T('Масонский шифр по записи жетонами: rb lrb lb (A B C), точка в конце — те же фигуры J–R; крест: v < > ^ = S T U V, с точкой W X Y Z. Принимает и юникод-приближения ┘ ⊔ └ ⊐ □ ⊏ ┐ ⊓ ┌ ∨ ∧ с «·». «/» — пробел между словами.',
      'The Freemason cipher from a token notation: rb lrb lb (A B C), a trailing dot gives the J–R shapes; cross: v < > ^ = S T U V, with a dot W X Y Z. Also accepts Unicode approximations ┘ ⊔ └ ⊐ □ ⊏ ┐ ⊓ ┌ ∨ ∧ with “·”. “/” is a word gap.'),
    params: [],
    run([t]) { return pigpenDecode(t); },
    probes(t) { return /^[┘⊔└⊐□⊏┐⊓┌∨∧<>·•.\s/]+$/.test(t) && /[┘⊔└⊐□⊏┐⊓┌∨∧]/.test(t) && t.replace(/\s/g, '').length >= 3 ? [{}] : []; },
  });

  def({
    id: 'pigpen_encode', name: T('Буквы → пигпен', 'Letters → pigpen'), cat: 'Кодировки', prior: 0,
    desc: T('Буквы A–Z в жетоны пигпена (rb, lrb.…) или юникод-приближения. Слова разделяются «/».',
      'Letters A–Z into pigpen tokens (rb, lrb. …) or Unicode approximations. Words are separated by “/”.'),
    params: [{ key: 'style', label: T('Запись', 'Notation'), type: 'select', options: [['unicode', T('Юникод-знаки', 'Unicode glyphs')], ['ascii', T('Жетоны (rb, v.)', 'Tokens (rb, v.)')]], default: 'unicode' }],
    run([t], p) {
      return t.toUpperCase().split(/\s+/).filter(Boolean).map((word) => Array.from(word).filter((ch) => LETTER_TOKEN[ch]).map((ch) => {
        const tok = LETTER_TOKEN[ch];
        if (p.style === 'ascii') return tok;
        return PIGPEN_GLYPH[tok.replace('.', '')] + (tok.endsWith('.') ? '·' : '');
      }).join(' ')).join(' / ');
    },
  });

  // ===================== Руны =====================
  const RUNES = [
    ['ᚠ', 'f'], ['ᚢ', 'u'], ['ᚦ', 'th'], ['ᚨ', 'a'], ['ᚱ', 'r'], ['ᚲ', 'k'], ['ᚷ', 'g'], ['ᚹ', 'w'], ['ᚺ', 'h'], ['ᚾ', 'n'], ['ᛁ', 'i'], ['ᛃ', 'j'],
    ['ᛇ', 'ï'], ['ᛈ', 'p'], ['ᛉ', 'z'], ['ᛊ', 's'], ['ᛏ', 't'], ['ᛒ', 'b'], ['ᛖ', 'e'], ['ᛗ', 'm'], ['ᛚ', 'l'], ['ᛜ', 'ng'], ['ᛞ', 'd'], ['ᛟ', 'o'],
  ];
  // Руны Младшего Футарка и знаки-разделители — только при чтении.
  const RUNE_EXTRA = { 'ᚴ': 'k', 'ᚼ': 'h', 'ᛅ': 'a', 'ᚬ': 'o', 'ᛋ': 's', 'ᛘ': 'm', 'ᛐ': 't', 'ᛦ': 'r', '᛫': ' ', '᛬': ' ', '᛭': ' ' };
  const RUNE_DEC = new Map([...RUNES, ...Object.entries(RUNE_EXTRA)]);
  // Латиница → руна: диграфы th, ng сначала; c, q → k; v → u; x → ks; y → j.
  const RUNE_ENC_EXTRA = { c: 'ᚲ', q: 'ᚲ', v: 'ᚢ', y: 'ᛃ', x: 'ᚲᛊ' };
  const RUNE_ENC = new Map(RUNES.filter(([, l]) => l.length === 1 && l !== 'ï').map(([r, l]) => [l, r]));
  for (const [l, r] of Object.entries(RUNE_ENC_EXTRA)) RUNE_ENC.set(l, r);

  def({
    id: 'runes_decode', name: T('Руны (Старший Футарк) → латиница', 'Runes (Elder Futhark) → Latin'), cat: 'Кодировки', prior: 0,
    desc: T('ᚠᚢᚦᚨᚱᚲ → futhark. ᚦ = th, ᛜ = ng, ᛇ = ï; точки-разделители ᛫ становятся пробелами. Понимает и часть рун Младшего Футарка.',
      'ᚠᚢᚦᚨᚱᚲ → futhark. ᚦ = th, ᛜ = ng, ᛇ = ï; the separator dots ᛫ become spaces. Also reads some Younger Futhark runes.'),
    params: [{ key: 'case', label: T('Регистр', 'Case'), type: 'select', options: [['lower', 'abc'], ['upper', 'ABC']], default: 'lower' }],
    run([t], p) {
      const out = Array.from(t).map((ch) => RUNE_DEC.get(ch) || ch).join('');
      return p.case === 'upper' ? out.toUpperCase() : out;
    },
    probes(t) {
      const runes = (t.match(/[ᚠ-ᛰ]/g) || []).length;
      return runes >= 3 && runes >= t.replace(/\s/g, '').length * 0.6 ? [{ case: 'lower' }] : [];
    },
  });

  def({
    id: 'runes_encode', name: T('Латиница → руны (Старший Футарк)', 'Latin → runes (Elder Futhark)'), cat: 'Кодировки', prior: 0,
    desc: T('th → ᚦ, ng → ᛜ, c/q → ᚲ, v → ᚢ, y → ᛃ, x → ᚲᛊ. Остальные знаки сохраняются.', 'th → ᚦ, ng → ᛜ, c/q → ᚲ, v → ᚢ, y → ᛃ, x → ᚲᛊ. Other characters are kept.'),
    params: [],
    run([t]) {
      let out = '';
      const s = t.toLowerCase();
      for (let i = 0; i < s.length; i++) {
        const two = s.substr(i, 2);
        if (two === 'th') { out += 'ᚦ'; i++; continue; }
        if (two === 'ng') { out += 'ᛜ'; i++; continue; }
        out += RUNE_ENC.get(s[i]) || t[i];
      }
      return out;
    },
  });

  // ===================== Шрифт Брайля =====================
  // Точки (номера 1–6) букв a–z; код = 0x2800 + маска (точка 1 → бит 0, … точка 6 → бит 5).
  const BRAILLE_DOTS = {
    a: '1', b: '12', c: '14', d: '145', e: '15', f: '124', g: '1245', h: '125', i: '24', j: '245', k: '13', l: '123', m: '134',
    n: '1345', o: '135', p: '1234', q: '12345', r: '1235', s: '234', t: '2345', u: '136', v: '1236', w: '2456', x: '1346', y: '13456', z: '1356',
  };
  const BRAILLE_PUNCT = { ',': '2', ';': '23', ':': '25', '.': '256', '!': '235', '?': '236', "'": '3', '-': '36' };
  // Русский Брайль: буквы по ГОСТ-таблице (точки 1–6); знаки числа, заглавной и пунктуация общие с английским.
  const BRAILLE_DOTS_RU = {
    а: '1', б: '12', в: '2456', г: '1245', д: '145', е: '15', ё: '16', ж: '245', з: '1356', и: '24', й: '12346', к: '13', л: '123', м: '134', // i18n-ok: данные
    н: '1345', о: '135', п: '1234', р: '1235', с: '234', т: '2345', у: '136', ф: '124', х: '125', ц: '14', ч: '12345', ш: '156', щ: '1346', // i18n-ok: данные
    ъ: '12356', ы: '2346', ь: '23456', э: '246', ю: '1256', я: '1246', // i18n-ok: данные
  };
  const brailleChar = (dots) => String.fromCodePoint(0x2800 + [...dots].reduce((m, d) => m | (1 << (Number(d) - 1)), 0));
  const BRAILLE_TABLES = { en: BRAILLE_DOTS, ru: BRAILLE_DOTS_RU };
  const BRAILLE_LETTER_MAPS = {
    en: new Map(Object.entries(BRAILLE_DOTS).map(([l, d]) => [brailleChar(d), l])),
    ru: new Map(Object.entries(BRAILLE_DOTS_RU).map(([l, d]) => [brailleChar(d), l])),
  };
  const BRAILLE_PUNCT_DEC = new Map(Object.entries(BRAILLE_PUNCT).map(([ch, d]) => [brailleChar(d), ch]));
  const BRAILLE_NUMBER = brailleChar('3456');
  const BRAILLE_CAPITAL = brailleChar('6');
  const DIGIT_LETTERS = 'jabcdefghi'; // цифры 0–9 = ячейки букв j, a–i (английской таблицы) после знака числа
  const BRAILLE_DIGIT_CELLS = new Map(DIGIT_LETTERS.split('').map((l, n) => [brailleChar(BRAILLE_DOTS[l]), n]));
  const BRAILLE_OPTIONS = [['en', T('Английская', 'English')], ['ru', T('Русская', 'Russian')]];

  function brailleDecode(text, table) {
    const letters = BRAILLE_LETTER_MAPS[table] || BRAILLE_LETTER_MAPS.en;
    let out = '';
    let numMode = false;
    let capital = false;
    for (const ch of text) {
      if (ch === BRAILLE_NUMBER) { numMode = true; continue; }
      if (ch === BRAILLE_CAPITAL) { capital = true; continue; }
      if (numMode && BRAILLE_DIGIT_CELLS.has(ch)) { out += BRAILLE_DIGIT_CELLS.get(ch); continue; }
      const letter = letters.get(ch);
      if (letter) { out += capital ? letter.toUpperCase() : letter; capital = false; numMode = false; continue; }
      numMode = false;
      if (BRAILLE_PUNCT_DEC.has(ch)) out += BRAILLE_PUNCT_DEC.get(ch);
      else if (ch === '⠀') out += ' ';
      else if (/[⠁-⣿]/.test(ch)) out += '?';
      else out += ch;
    }
    return out;
  }

  function brailleEncode(text, table) {
    const dots = BRAILLE_TABLES[table] || BRAILLE_DOTS;
    let out = '';
    let inNumber = false;
    for (const ch of text) {
      const lower = ch.toLowerCase();
      if (/[0-9]/.test(ch)) {
        if (!inNumber) out += BRAILLE_NUMBER;
        inNumber = true;
        out += brailleChar(BRAILLE_DOTS[DIGIT_LETTERS[Number(ch)]]);
        continue;
      }
      inNumber = false;
      if (dots[lower]) out += (ch !== lower ? BRAILLE_CAPITAL : '') + brailleChar(dots[lower]);
      else if (BRAILLE_PUNCT[ch]) out += brailleChar(BRAILLE_PUNCT[ch]);
      else out += ch === ' ' ? '⠀' : ch;
    }
    return out;
  }

  def({
    id: 'braille_decode', name: T('Брайль (⠁⠃⠉) → латиница', 'Braille (⠁⠃⠉) → Latin'), cat: 'Кодировки', prior: 0,
    desc: T('Юникод-символы U+2800… в буквы английского или русского Брайля (параметр «Таблица»). Знак числа ⠼ делает следующие a–j цифрами 1–0, ⠠ — заглавная буква. ⠓⠑⠇⠇⠕ → hello.',
      'Unicode U+2800… cells into English or Russian Braille letters (the “Table” parameter). The number sign ⠼ turns following a–j into digits 1–0, ⠠ makes a capital. ⠓⠑⠇⠇⠕ → hello.'),
    params: [{ key: 'table', label: T('Таблица Брайля', 'Braille table'), type: 'select', options: BRAILLE_OPTIONS, default: 'en' }],
    run([t], p) { return brailleDecode(t, p.table); },
    probes(t) {
      const cells = (t.match(/[⠁-⣿]/g) || []).length;
      return cells >= 3 && cells >= t.replace(/\s/g, '').length * 0.8 ? [{ table: 'en' }, { table: 'ru' }] : [];
    },
  });

  def({
    id: 'braille_encode', name: T('Латиница → Брайль', 'Latin → Braille'), cat: 'Кодировки', prior: 0,
    desc: T('Буквы (английские или русские — по таблице), цифры (со знаком числа ⠼), заглавные (⠠) и простая пунктуация в ячейки Брайля.', 'Letters (English or Russian, by table), digits (with the number sign ⠼), capitals (⠠) and simple punctuation into Braille cells.'),
    params: [{ key: 'table', label: T('Таблица Брайля', 'Braille table'), type: 'select', options: BRAILLE_OPTIONS, default: 'en' }],
    run([t], p) { return brailleEncode(t, p.table); },
  });

  // ===================== Греческий алфавит =====================
  // Строчные буквы → латинская транслитерация (ς — конечная сигма); заглавные берутся через toLowerCase.
  const GREEK = [
    ['α', 'a'], ['β', 'b'], ['γ', 'g'], ['δ', 'd'], ['ε', 'e'], ['ζ', 'z'], ['η', 'e'], ['θ', 'th'], ['ι', 'i'], ['κ', 'k'], ['λ', 'l'], ['μ', 'm'],
    ['ν', 'n'], ['ξ', 'x'], ['ο', 'o'], ['π', 'p'], ['ρ', 'r'], ['σ', 's'], ['τ', 't'], ['υ', 'y'], ['φ', 'ph'], ['χ', 'ch'], ['ψ', 'ps'], ['ω', 'o'],
  ];
  const GREEK_DEC = new Map(GREEK.concat([['ς', 's']]));
  // Латиница → греческий: обратные пары (по первому совпадению), диграфы th/ph/ch/ps сначала; c → κ, q → κ, v → υ, j → ι, u → υ, h → η, w → ω.
  const GREEK_ENC = new Map();
  for (const [g, l] of GREEK) if (!GREEK_ENC.has(l)) GREEK_ENC.set(l, g);
  Object.entries({ c: 'κ', q: 'κ', v: 'υ', j: 'ι', u: 'υ', h: 'η', w: 'ω', f: 'φ' }).forEach(([l, g]) => GREEK_ENC.set(l, g));
  const GREEK_DIGRAPHS = ['th', 'ph', 'ch', 'ps'];

  def({
    id: 'greek_translit', name: T('Греческие буквы ↔ латиница', 'Greek letters ↔ Latin'), cat: 'Кодировки', prior: 0,
    desc: T('Побуквенная транслитерация: α → a, β → b, θ → th, φ → ph, χ → ch, ψ → ps, ω → o. Ударения и заглавные учитываются, остальные символы сохраняются.',
      'Letter-by-letter transliteration: α → a, β → b, θ → th, φ → ph, χ → ch, ψ → ps, ω → o. Accents and capitals are handled, other characters stay.'),
    params: [{ key: 'dir', label: T('Направление', 'Direction'), type: 'select', options: [['gr2lat', T('Греческий → латиница', 'Greek → Latin')], ['lat2gr', T('Латиница → греческий', 'Latin → Greek')]], default: 'gr2lat' }],
    run([t], p) {
      if (p.dir === 'lat2gr') {
        const s = t.toLowerCase();
        let out = '';
        for (let i = 0; i < s.length; i++) {
          const two = s.substr(i, 2);
          if (GREEK_DIGRAPHS.includes(two)) { out += GREEK_ENC.get(two); i++; continue; }
          out += GREEK_ENC.get(s[i]) || t[i];
        }
        return out;
      }
      return Array.from(t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC'), (ch) => GREEK_DEC.get(ch.toLowerCase()) || ch).join('');
    },
    probes(t) {
      const greek = (t.match(/[α-ωΑ-Ωά-ώ]/g) || []).length;
      return greek >= 3 && greek >= t.replace(/\s/g, '').length * 0.6 ? [{ dir: 'gr2lat' }] : [];
    },
  });

  // ===================== Фонетические алфавиты =====================
  const NATO = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'Xray', 'Yankee', 'Zulu'];
  const ABLE = ['Able', 'Baker', 'Charlie', 'Dog', 'Easy', 'Fox', 'George', 'How', 'Item', 'Jig', 'King', 'Love', 'Mike', 'Nan', 'Oboe', 'Peter', 'Queen', 'Roger', 'Sugar', 'Tare', 'Uncle', 'Victor', 'William', 'Xray', 'Yoke', 'Zebra'];
  const DIGIT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const WORD_VARIANTS = { alpha: 'a', juliet: 'j', whisky: 'w', niner: '9', fife: '5', tree: '3', fower: '4', affirm: 'a' };

  // Слово → индекс буквы (0–25) для обоих алфавитов, в нижнем регистре.
  const WORD_INDEX = new Map();
  [NATO, ABLE].forEach((list) => list.forEach((w, i) => WORD_INDEX.set(w.toLowerCase(), i)));
  const WORD_CHAR = new Map();
  for (const [w, i] of WORD_INDEX) WORD_CHAR.set(w, 'abcdefghijklmnopqrstuvwxyz'[i]);
  for (const [w, ch] of Object.entries(WORD_VARIANTS)) WORD_CHAR.set(w, ch);
  DIGIT_WORDS.forEach((w, i) => WORD_CHAR.set(w, String(i)));

  const normalizeWords = (t) => t.replace(/x[-\s]?ray/gi, 'xray').toLowerCase();

  def({
    id: 'phonetic_decode', name: T('Фонетический алфавит → буквы', 'Phonetic alphabet → letters'), cat: 'Кодировки', prior: 0,
    desc: T('Alfa Bravo Charlie… (НАТО) и Able Baker Charlie… (США, 1940-е) → первые буквы; слова-цифры (zero…niner) → цифры; «/» — пробел.',
      'Alfa Bravo Charlie… (NATO) and Able Baker Charlie… (US, 1940s) → letters; digit words (zero…niner) → digits; “/” is a space.'),
    params: [
      { key: 'case', label: T('Регистр', 'Case'), type: 'select', options: [['upper', 'ABC'], ['lower', 'abc']], default: 'upper' },
      { key: 'unknown', label: T('Незнакомое слово', 'Unknown word'), type: 'select', options: [['error', T('Ошибка', 'Error')], ['skip', T('Пропустить', 'Skip')], ['first', T('Первая буква', 'First letter')]], default: 'error' },
    ],
    run([t], p) {
      const out = normalizeWords(t).split(/[\s,;]+/).filter(Boolean).map((w) => {
        if (w === '/' || w === '|') return ' ';
        const ch = WORD_CHAR.get(w.replace(/[^a-z]/g, ''));
        if (ch !== undefined) return ch;
        if (p.unknown === 'skip') return '';
        if (p.unknown === 'first') return w[0];
        return fail('Слово «' + w + '» не из фонетического алфавита', 'The word “' + w + '” is not in a phonetic alphabet');
      }).join('');
      return p.case === 'upper' ? out.toUpperCase() : out;
    },
    probes(t) {
      const words = normalizeWords(t).split(/[\s,;]+/).filter((w) => w && w !== '/');
      return words.length >= 3 && words.every((w) => WORD_CHAR.has(w.replace(/[^a-z]/g, ''))) ? [{ case: 'upper', unknown: 'error' }] : [];
    },
  });

  def({
    id: 'phonetic_encode', name: T('Буквы → фонетический алфавит', 'Letters → phonetic alphabet'), cat: 'Кодировки', prior: 0,
    desc: T('A→Alfa/Able, B→Bravo/Baker … Пробел становится «/». Цифры записываются словами.', 'A→Alfa/Able, B→Bravo/Baker … A space becomes “/”. Digits are written as words.'),
    params: [{ key: 'alphabet', label: T('Алфавит', 'Alphabet'), type: 'select', options: [['nato', 'NATO / ICAO'], ['able', 'Able Baker (US 1941–56)']], default: 'nato' }],
    run([t], p) {
      const list = p.alphabet === 'able' ? ABLE : NATO;
      return Array.from(t.toLowerCase()).map((ch) => {
        const i = 'abcdefghijklmnopqrstuvwxyz'.indexOf(ch);
        if (i >= 0) return list[i];
        if (/[0-9]/.test(ch)) return DIGIT_WORDS[Number(ch)];
        return /\s/.test(ch) ? '/' : '';
      }).filter(Boolean).join(' ');
    },
  });

  G.Phonetic = { WORD_CHAR, WORD_INDEX, NATO, ABLE, normalizeWords };
  // Таблицы для экранных клавиатур (keyboards-data.js): одни и те же данные для клавиш и для операций.
  G.GlyphTables = Object.assign(G.GlyphTables || {}, {
    pigpen: { letterToken: LETTER_TOKEN, glyph: PIGPEN_GLYPH },
    runes: { elder: RUNES, extra: RUNE_EXTRA },
    braille: { tables: BRAILLE_TABLES, number: BRAILLE_NUMBER, capital: BRAILLE_CAPITAL, cell: brailleChar, encode: brailleEncode, decode: brailleDecode },
    greek: { letters: GREEK },
  });
})(typeof self !== 'undefined' ? self : this);
