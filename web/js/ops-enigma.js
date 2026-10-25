// Энигма: армейская/флотская I, M3 (три ротора) и M4 (четвёртый ротор Beta/Gamma с тонким рефлектором).
// Модель машины: роторы I–VIII со своими выемками (VI–VIII — две), двойной шаг среднего ротора, кольца,
// стартовые позиции и коммутационная панель. Шифрование и расшифровка — одна и та же операция (Энигма инволютивна).
// В авто-поиск не входит: ключевое пространство огромно, нужны настройки из контекста (лист ключей, подсказка).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const { def } = G.CipherOps;
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const ROTORS = {
    I: ['EKMFLGDQVZNTOWYHXUSPAIBRCJ', 'Q'], II: ['AJDKSIRUXBLHWTMCQGZNPYFVOE', 'E'], III: ['BDFHJLCPRTXVZNYEIWGAKMUSQO', 'V'],
    IV: ['ESOVPZJAYQUIRHXLNFTGKDCMWB', 'J'], V: ['VZBRGITYUPSDNHLXAWMJQOFECK', 'Z'], VI: ['JPGVOUMFYQBENHZRDKASXLICTW', 'ZM'],
    VII: ['NZJHGRCXMYSWBOUFAIVLPEKQDT', 'ZM'], VIII: ['FKQHTLXOCBJSPDZRAMEWNIUYGV', 'ZM'],
  };
  const GREEK = { BETA: 'LEYJVCNIXWPBQMDRTAKZGFUHOS', GAMMA: 'FSOKANUERHMBTIYCWLQPZXVGJD' };
  const REFLECTORS = { A: 'EJMZALYXVBWFCRQUONTSPIKHGD', B: 'YRUHQSLDPXNGOKMIEBFZCWVJAT', C: 'FVPJIAOYEDRZXWGCTKUQSBNMHL', 'B-THIN': 'ENKQAUYWJICOPBLMDXZVFTHRGS', 'C-THIN': 'RDOBJNTKVEHMLFCWZAXGYIPSUQ' };
  const idx = (ch) => A.indexOf(ch);
  const mod = (n) => ((n % 26) + 26) % 26;

  function parseList(s, what) {
    return String(s).toUpperCase().split(/[\s,;-]+/).filter(Boolean).map((x) => {
      if (!/^[A-Z0-9-]+$/.test(x)) throw new Error(T('Неверное значение «' + x + '» в поле «' + what + '»', 'Invalid value “' + x + '” in “' + what + '”'));
      return x;
    });
  }
  // «AAA», «A A A», «1 1 1» или «01 21 12» → номера 0..25.
  function parseLetters(s, n, what) {
    const raw = String(s).trim().toUpperCase();
    const parts = /\d/.test(raw) ? raw.split(/[\s,;-]+/).filter(Boolean).map((x) => Number(x) - 1) : Array.from(raw.replace(/[\s,;-]/g, '')).map(idx);
    if (parts.length !== n || parts.some((v) => !Number.isInteger(v) || v < 0 || v > 25)) {
      throw new Error(T('Поле «' + what + '»: нужно ' + n + ' букв A–Z или чисел 1–26', 'Field “' + what + '”: needs ' + n + ' letters A–Z or numbers 1–26'));
    }
    return parts;
  }
  function plugboard(s) {
    const map = Array.from({ length: 26 }, (_, i) => i);
    for (const pair of String(s).toUpperCase().split(/[\s,;]+/).filter(Boolean)) {
      if (!/^[A-Z]{2}$/.test(pair) || pair[0] === pair[1]) throw new Error(T('Пара коммутатора «' + pair + '»: нужны две разные буквы', 'Plugboard pair “' + pair + '”: needs two different letters'));
      const [a, b] = [idx(pair[0]), idx(pair[1])];
      if (map[a] !== a || map[b] !== b) throw new Error(T('Буква пары «' + pair + '» уже соединена', 'A letter of “' + pair + '” is already plugged'));
      map[a] = b; map[b] = a;
    }
    return map;
  }

  /** Настройка машины → функция шифрования одной буквы (0..25) с шагом роторов. */
  function machine(p) {
    const names = parseList(p.rotors, T('Роторы', 'Rotors'));
    const m4 = p.model === 'M4';
    const need = m4 ? 4 : 3;
    if (names.length !== need) throw new Error(T('Нужно ' + need + ' ротора слева направо', 'Needs ' + need + ' rotors left to right') + (m4 ? T(' (первый — Beta или Gamma)', ' (the first is Beta or Gamma)') : ''));
    const greek = m4 ? names[0] : null;
    if (m4 && !GREEK[greek]) throw new Error(T('У M4 первый ротор — Beta или Gamma', 'The first M4 rotor is Beta or Gamma'));
    const moving = (m4 ? names.slice(1) : names).map((n) => {
      if (!ROTORS[n]) throw new Error(T('Неизвестный ротор ', 'Unknown rotor ') + n);
      return n;
    });
    const refl = String(p.reflector).toUpperCase();
    if (!REFLECTORS[refl]) throw new Error(T('Неизвестный рефлектор ', 'Unknown reflector ') + p.reflector);
    if (m4 !== /THIN/.test(refl)) throw new Error(m4 ? T('У M4 рефлектор тонкий: B-thin или C-thin', 'M4 uses a thin reflector: B-thin or C-thin') : T('Тонкий рефлектор — только у M4', 'A thin reflector is only for M4'));
    const rings = parseLetters(p.rings, need, T('Кольца', 'Rings'));
    const pos = parseLetters(p.positions, need, T('Позиции', 'Positions'));
    const wheels = (m4 ? [greek].concat(moving) : moving).map((n, i) => {
      const wiring = Array.from(ROTORS[n] ? ROTORS[n][0] : GREEK[n], idx);
      const inverse = new Array(26);
      wiring.forEach((v, k) => { inverse[v] = k; });
      return { wiring, inverse, notches: ROTORS[n] ? Array.from(ROTORS[n][1], idx) : [], ring: rings[i], pos: pos[i], fixed: m4 && i === 0 };
    });
    const reflector = Array.from(REFLECTORS[refl], idx);
    const plug = plugboard(p.plugboard);
    const [, l, m, r] = wheels.length === 4 ? wheels : [null].concat(wheels);
    const through = (w, c, back) => mod((back ? w.inverse : w.wiring)[mod(c + w.pos - w.ring)] - w.pos + w.ring);
    return (c) => {
      // Двойной шаг: средний ротор на выемке шагает сам и толкает левый; правый на выемке толкает средний.
      if (m.notches.includes(m.pos)) { m.pos = mod(m.pos + 1); l.pos = mod(l.pos + 1); }
      else if (r.notches.includes(r.pos)) m.pos = mod(m.pos + 1);
      r.pos = mod(r.pos + 1);
      let x = plug[c];
      for (let i = wheels.length - 1; i >= 0; i--) x = through(wheels[i], x, false);
      x = reflector[x];
      for (let i = 0; i < wheels.length; i++) x = through(wheels[i], x, true);
      return plug[x];
    };
  }

  def({
    id: 'enigma', name: T('Энигма', 'Enigma'), cat: 'Шифры с ключом', prior: 0,
    desc: T('Модель Энигмы I/M3 и M4: роторы I–VIII (Beta/Gamma у M4), рефлекторы A/B/C и тонкие B/C, кольца, стартовые позиции, коммутатор («AB CD EF»), двойной шаг среднего ротора. Шифрование = расшифровка. Не-буквы проходят без шага роторов (как на машине их нет). Настройки берутся из контекста загадки; авто-поиск Энигму не перебирает.',
      'An Enigma I/M3 and M4 model: rotors I–VIII (Beta/Gamma on M4), reflectors A/B/C and thin B/C, rings, start positions, plugboard (“AB CD EF”) and the middle rotor double step. Encryption = decryption. Non-letters pass through without stepping (the machine has no such keys). Settings come from the puzzle context; Auto does not search Enigma.'),
    params: [
      { key: 'model', label: T('Модель', 'Model'), type: 'select', options: [['M3', 'Enigma I / M3'], ['M4', 'Enigma M4']], default: 'M3' },
      { key: 'rotors', label: T('Роторы (слева направо)', 'Rotors (left to right)'), type: 'text', default: 'I II III' },
      { key: 'reflector', label: T('Рефлектор', 'Reflector'), type: 'select', options: [['B', 'B'], ['C', 'C'], ['A', 'A'], ['B-thin', 'B thin (M4)'], ['C-thin', 'C thin (M4)']], default: 'B' },
      { key: 'rings', label: T('Кольца (AAA или 1 1 1)', 'Rings (AAA or 1 1 1)'), type: 'text', default: 'AAA' },
      { key: 'positions', label: T('Стартовые позиции', 'Start positions'), type: 'text', default: 'AAA' },
      { key: 'plugboard', label: T('Коммутатор (пары)', 'Plugboard (pairs)'), type: 'text', default: '' },
    ],
    run([t], p) {
      const step = machine(p);
      let out = '';
      for (const ch of String(t)) {
        const up = ch.toUpperCase();
        const i = up.length === 1 ? idx(up) : -1;
        if (i < 0) { out += ch; continue; }
        const y = A[step(i)];
        out += ch === up ? y : y.toLowerCase();
      }
      return out;
    },
  });

  G.Enigma = { machine, ROTORS, REFLECTORS };
})(typeof self !== 'undefined' ? self : this);
