// Тесты пакета «ciphers»: классические шифры, знаковые алфавиты, кодировки, помощники ARG, OpenSSL.
// Векторы: Wikipedia (Bifid, Trifid, ADFGVX, Myszkowski, Hill, Chaocipher, Scytale, Nihilist), RFC 3492,
// FIPS-197, openssl 3.2.4 и Python (hashlib, binascii, quopri, codecs). Где вектора из Wikipedia нет — эталон посчитан отдельным Python-кодом.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadEngine } = require('./load');

const OPENSSL_FILE = path.join(__dirname, '..', 'web', 'js', 'ops-openssl.js');
const { ctx, run } = loadEngine(['ops-openssl.js']);
ctx.I18n.lang = 'en'; // сообщения проверяем по-английски
const OPS = ctx.CipherOps.OPS;
const throwsMsg = (fn, re) => assert.throws(fn, (e) => !!e && re.test(e.message));
const hexBytes = (h) => Uint8Array.from(h.match(/../g), (x) => parseInt(x, 16));
const toHex = (a) => Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');

test('нет коллизий id и у каждой операции есть имя и описание', () => {
  const ids = OPS.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ['bifid', 'trifid', 'adfgx', 'adfgvx', 'four_square', 'two_square', 'nihilist', 'porta', 'running_key', 'keyed_caesar', 'hill', 'scytale', 'route_cipher', 'myszkowski', 'chaocipher', 'beaufort_variant', 'vigenere_family',
    'pigpen_decode', 'runes_decode', 'braille_decode', 'phonetic_decode', 'ebcdic_decode', 'octal_decode', 'base91_decode', 'uudecode', 'qp_decode', 'punycode_decode', 'rot5', 'rot18', 'rot8000', 'binary_pixels',
    'anagram_check', 'anagram_solve', 'xor_keep', 'overlay_fill', 'pick_letters', 'callsign_order', 'openssl_inspect', 'openssl_decrypt']) {
    const op = ctx.CipherOps.BY_ID[id];
    assert.ok(op, id);
    assert.equal(typeof op.name, 'string', id);
    assert.ok(op.desc && op.desc.length > 10, id);
  }
});

test('probes новых операций молчат на обычном тексте, hex, Base64, десятичных кодах', () => {
  const mine = OPS.filter((o) => o.probes && /^(bifid|trifid|adfgx|adfgvx|four_square|two_square|nihilist|porta|running_key|keyed_caesar|hill|scytale|route_cipher|myszkowski|chaocipher|beaufort_variant|vigenere_family|pigpen_|runes_|braille_|phonetic_|ebcdic_|octal_|base91_|uu|qp_|punycode_|rot5|rot18|rot8000|binary_pixels|anagram_|xor_keep|overlay_fill|pick_letters|callsign_order|openssl_)/.test(o.id));
  const samples = ['hello world this is plain text', '48656c6c6f20576f726c64', 'SGVsbG8gV29ybGQ=', '108 101 97 118 101 32 112 111 115 115 105 98 108 101', '-- --- ..-', 'ЛЕС НА ХОЛМЕ', '0101010101010101', 'https://example.com/a?b=c'];
  for (const op of mine) for (const s of samples) assert.equal(op.probes(s, { depth: 0 }).length, 0, op.id + ' / ' + s);
});

// ---------- Классические шифры ----------
test('Bifid (Wikipedia): FLEEATONCE → UAEOLWRINS', () => {
  const key = 'BGWKZQPNDSIOAXEFCLUMTHYVR';
  assert.equal(run('bifid', 'FLEEATONCE', { key, dir: 'enc' }), 'UAEOLWRINS');
  assert.equal(run('bifid', 'UAEOLWRINS', { key, dir: 'dec' }), 'FLEEATONCE');
  const long = 'DEFENDTHEEASTWALLOFTHECASTLE';
  assert.equal(run('bifid', run('bifid', long, { key: 'FORTIFICATION', dir: 'enc', period: 5 }), { key: 'FORTIFICATION', dir: 'dec', period: 5 }), long);
});

test('Trifid (Wikipedia): AIDETOILECIELTAIDERA, период 5 → FMJFVOISSUFTFPUFEQQC', () => {
  const key = 'FELIXMARDSTBCGHJKNOPQUVWYZ+';
  assert.equal(run('trifid', 'AIDETOILECIELTAIDERA', { key, period: 5, dir: 'enc' }), 'FMJFVOISSUFTFPUFEQQC');
  assert.equal(run('trifid', 'FMJFVOISSUFTFPUFEQQC', { key, period: 5, dir: 'dec' }), 'AIDETOILECIELTAIDERA');
});

test('ADFGVX (Wikipedia): ATTACKAT1200AM, PRIVACY → DGDD DAGD DGAF ADDF DADV DVFA ADVX', () => {
  const square = 'NA1C3H8TB2OME5WRPD4F6G7I9J0KLQSUVXYZ';
  const enc = run('adfgvx', 'ATTACK AT 1200AM', { square, key: 'PRIVACY', dir: 'enc', group: 4 });
  assert.equal(enc, 'DGDD DAGD DGAF ADDF DADV DVFA ADVX');
  assert.equal(run('adfgvx', enc, { square, key: 'PRIVACY', dir: 'dec' }), 'ATTACKAT1200AM');
});

test('ADFGX: эталон Python (квадрат SECRET, ключ CARGO) и обратный ход', () => {
  const enc = run('adfgx', 'ATTACKATDAWN', { square: 'SECRET', key: 'CARGO', dir: 'enc' });
  assert.equal(enc, 'ADFDDDXFXXXAADAAFAAAADFG');
  assert.equal(run('adfgx', enc, { square: 'SECRET', key: 'CARGO', dir: 'dec' }), 'ATTACKATDAWN');
});

test('Четыре квадрата (Wikipedia, ключи EXAMPLE/KEYWORD): HE → FY; полный эталон Python', () => {
  const text = 'HELPMEOBIWANKENOBIYOUAREMYONLYHOPE';
  const enc = run('four_square', text, { dir: 'enc' });
  assert.ok(enc.startsWith('FY'));
  assert.equal(enc, 'FYNFNEHWBXAFFOKHMDYIOOTEKUIIKTDHNO');
  assert.equal(run('four_square', enc, { dir: 'dec' }), text);
});

test('Два квадрата: эталон Python, горизонтально и вертикально', () => {
  const text = 'HELPMEOBIWANKENOBI';
  const h = run('two_square', text, { layout: 'h', dir: 'enc' });
  const v = run('two_square', text, { layout: 'v', dir: 'enc' });
  assert.equal(h, 'GXAOEMQLIAERGMLPBH');
  assert.equal(v, 'EHMCWXRSYKPXWHONGD');
  assert.equal(run('two_square', h, { layout: 'h', dir: 'dec' }), text);
  assert.equal(run('two_square', v, { layout: 'v', dir: 'dec' }), text);
});

test('Нигилистов (Wikipedia): ZEBRAS/RUSSIAN, DYNAMITE WINTER PALACE', () => {
  const enc = run('nihilist', 'DYNAMITE WINTER PALACE', { dir: 'enc' });
  assert.equal(enc, '37 106 62 36 67 47 86 26 104 53 62 77 27 55 57 66 55 36 54 27');
  assert.equal(run('nihilist', enc, { dir: 'dec' }), 'DYNAMITEWINTERPALACE');
  throwsMsg(() => run('nihilist', '99', { dir: 'dec' }), /square coordinates/);
});

test('Порта: HELLO + KEY → PPZTD, шифр взаимный', () => {
  assert.equal(run('porta', 'HELLO', { key: 'KEY' }), 'PPZTD');
  assert.equal(run('porta', 'PPZTD', { key: 'KEY' }), 'HELLO');
  assert.equal(run('porta', 'Hello, World', { key: 'KEY' }).length, 12);
});

test('Бегущий ключ: HELLO + WORLD → DSCWR; короткий ключ — ошибка', () => {
  assert.equal(run('running_key', ['HELLO', 'WORLD'], { dir: 'enc' }), 'DSCWR');
  assert.equal(run('running_key', ['DSCWR', 'WORLD'], { dir: 'dec' }), 'HELLO');
  assert.equal(run('running_key', ['Dscwr!', 'xxwor ld'], { dir: 'dec', offset: 2 }), 'Hello!');
  throwsMsg(() => run('running_key', ['DSCWR', 'WOR'], { dir: 'dec' }), /shorter/);
});

test('Цезарь с ключевым словом: ZEBRAS, HELLO → DAIIL', () => {
  assert.equal(run('keyed_caesar', 'Hello', { key: 'ZEBRAS', n: 0, dir: 'enc' }), 'Daiil');
  assert.equal(run('keyed_caesar', 'DAIIL', { key: 'ZEBRAS', n: 0, dir: 'dec' }), 'HELLO');
  assert.equal(run('keyed_caesar', ['abc', 'KEY'], { n: 1, dir: 'enc' }), run('keyed_caesar', 'abc', { key: 'KEY', n: 1, dir: 'enc' }));
});

test('Хилл (Wikipedia): GYBNQKURP, ACT → POH, CAT → FIN; 2×2 HELP → HIAT', () => {
  assert.equal(run('hill', 'ACT', { key: 'GYBNQKURP', dir: 'enc' }), 'POH');
  assert.equal(run('hill', 'CAT', { key: 'GYBNQKURP', dir: 'enc' }), 'FIN');
  assert.equal(run('hill', 'POH', { key: 'GYBNQKURP', dir: 'dec' }), 'ACT');
  assert.equal(run('hill', 'HELP', { key: '3 3 2 5', dir: 'enc' }), 'HIAT');
  assert.equal(run('hill', 'HIAT', { key: 'DDCF', dir: 'dec' }), 'HELP');
  throwsMsg(() => run('hill', 'ABCD', { key: '2 4 6 8', dir: 'dec' }), /not invertible/);
});

test('Скитала (Wikipedia): «I am hurt very badly help», 4 буквы → IRYYATBHMVAEHEDLURLP', () => {
  assert.equal(run('scytale', 'I am hurt very badly help', { rows: 4, dir: 'enc' }), 'Iryyatbhmvaehedlurlp');
  assert.equal(run('scytale', 'IRYYATBHMVAEHEDLURLP', { rows: 4, dir: 'dec' }), 'IAMHURTVERYBADLYHELP');
  assert.equal(run('scytale', run('scytale', 'ABCDEFGHIJK', { rows: 3, dir: 'enc' }), { rows: 3, dir: 'dec' }), 'ABCDEFGHIJK');
});

test('Маршрутный шифр: спираль, змейки, угол, обратный ход', () => {
  const r = (route, extra = {}) => run('route_cipher', 'ABCDEFGHI', { width: 3, route, dir: 'enc', ...extra });
  assert.equal(r('spiral_cw'), 'ABCFIHGDE');
  assert.equal(r('spiral_ccw'), 'ADGHIFCBE');
  assert.equal(r('spiral_cw', { corner: 'tr' }), 'CFIHGDABE');
  assert.equal(r('spiral_cw', { reverse: true }), 'EDGHIFCBA');
  assert.equal(r('snake_h'), 'ABCFEDGHI');
  assert.equal(r('snake_v'), 'ADGHEBCFI');
  assert.equal(r('columns', { corner: 'br' }), 'IFCHEBGDA');
  assert.equal(run('route_cipher', 'ABCFIHGDE', { width: 3, route: 'spiral_cw', dir: 'dec' }), 'ABCDEFGHI');
  assert.equal(run('route_cipher', 'ABCDEFG', { width: 3, route: 'rows', dir: 'enc' }), 'ABCDEFGXX');
  throwsMsg(() => run('route_cipher', 'ABCDEFG', { width: 3, dir: 'dec' }), /not divisible/);
});

test('Мышковский (Wikipedia): TOMATO, WEAREDISCOVEREDFLEEATONCE → ROFOACDTEDSEEEACWEIVRLENE', () => {
  const pt = 'WE ARE DISCOVERED. FLEE AT ONCE'.replace(/[^A-Z]/g, '');
  const enc = run('myszkowski', pt, { key: 'TOMATO', dir: 'enc' });
  assert.equal(enc, 'ROFOACDTEDSEEEACWEIVRLENE');
  assert.equal(run('myszkowski', enc, { key: 'TOMATO', dir: 'dec' }), pt);
  assert.equal(run('myszkowski', 'ROFOA CDTED SEEEA CWEIV RLENE', { key: 'TOMATO', dir: 'dec' }), pt);
});

test('Хаошифр (Wikipedia): WELLDONEISBETTERTHANWELLSAID → OAHQHCNYNXTSZJRRHJBYHQKSOUJY', () => {
  const pt = 'WELLDONEISBETTERTHANWELLSAID';
  const ct = 'OAHQHCNYNXTSZJRRHJBYHQKSOUJY';
  assert.equal(run('chaocipher', pt, { dir: 'enc' }), ct);
  assert.equal(run('chaocipher', ct, { dir: 'dec' }), pt);
  throwsMsg(() => run('chaocipher', pt, { left: 'ABC' }), /26 letters/);
});

test('Бофор и вариант Бофора: векторы из отчётов, регистр и пробелы сохраняются', () => {
  assert.equal(run('beaufort', 'lrot dq xeiefh', { key: 'ENDERMITE' }), 'twpl ow lpwaiw');
  assert.equal(run('beaufort_variant', 'lrot dq xeiefh', { key: 'ENDERMITE' }), 'perx uc fxmisk');
  assert.equal(run('beaufort', 'PRW QV RZXI', { key: 'ENDERMITE' }), 'PWH OW VJWW');
  assert.equal(run('beaufort_variant', 'PRW QV RZXI', { key: 'ENDERMITE' }), 'TEZ UM DHQM');
  assert.equal(run('beaufort_variant', 'TEZ UM DHQM', { key: 'ENDERMITE', dir: 'enc' }), 'PRW QV RZXI');
});

test('Сравнение семейства Виженера выводит три варианта с формулами', () => {
  const out = run('vigenere_family', ['PRW QV RZXI', 'ENDERMITE']);
  const lines = out.split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^Vigenère \(P = C − K\): /);
  assert.equal(lines[1], 'Beaufort (P = K − C): PWH OW VJWW');
  assert.equal(lines[2], 'Variant Beaufort (P = C + K): TEZ UM DHQM');
  assert.equal(lines[0].split(': ')[1], run('vigenere', 'PRW QV RZXI', { key: 'ENDERMITE' }));
});

test('Регрессия: сдвиг кодов −4, десятичные коды, Морзе', () => {
  assert.equal(run('char_shift', 'lxxt>33m2mqkyv2gsq3q=w]O2ntk', { n: -4 }), 'http://i.imgur.com/m9sYK.jpg');
  assert.equal(run('dec_codes', '108 101 97 118 101 32 112 111 115 115 105 98 108 101', { width: 'sep', shift: 0 }), 'leave possible');
  assert.equal(run('morse_decode', '--. --- --- -.. / .-- --- .-. -.- / -.. .-.. / -... -... / .-.. .. ... - . -. / -.-. .-.. --- ... .').toUpperCase(), 'GOOD WORK DL BB LISTEN CLOSE');
});

// ---------- Знаковые алфавиты ----------
test('Пигпен: жетоны, юникод-приближения, крест с точками, кругооборот', () => {
  assert.equal(run('pigpen_decode', 'rb lrb lb / trb tlrb tlb tr tlr tl'), 'ABC DEFGHI');
  assert.equal(run('pigpen_decode', 'rb. lrb. v < > ^ v. <. >. ^.'), 'JKSTUVWXYZ');
  assert.equal(run('pigpen_decode', '┘ ⊔ └ ┘·'), 'ABCJ');
  assert.equal(run('pigpen_decode', '┘⊔└'), 'ABC');
  const text = 'HELLO WORLD XYZ';
  for (const style of ['unicode', 'ascii']) assert.equal(run('pigpen_decode', run('pigpen_encode', text, { style })), text);
  throwsMsg(() => run('pigpen_decode', 'zz'), /pigpen/i);
});

test('Руны: ᚠᚢᚦᚨᚱᚲ ↔ futhark', () => {
  assert.equal(run('runes_decode', 'ᚠᚢᚦᚨᚱᚲ'), 'futhark');
  assert.equal(run('runes_encode', 'futhark'), 'ᚠᚢᚦᚨᚱᚲ');
  assert.equal(run('runes_decode', 'ᚺᛖᛚᛚᛟ᛫ᚹᛟᚱᛚᛞ'), 'hello world');
  assert.equal(run('runes_encode', 'king!'), 'ᚲᛁᛜ!');
});

test('Брайль: буквы, числа, заглавные, кругооборот', () => {
  assert.equal(run('braille_decode', '⠓⠑⠇⠇⠕'), 'hello');
  assert.equal(run('braille_decode', '⠼⠁⠃⠉⠚'), '1230');
  assert.equal(run('braille_decode', '⠠⠁⠃'), 'Ab');
  assert.equal(run('braille_encode', 'abc'), '⠁⠃⠉');
  const text = 'Hello, World 2026!';
  assert.equal(run('braille_decode', run('braille_encode', text)), text);
});

test('Фонетический алфавит: НАТО, Able Baker, X-ray, цифры', () => {
  assert.equal(run('phonetic_decode', 'Alfa Bravo Charlie'), 'ABC');
  assert.equal(run('phonetic_decode', 'Able Baker Charlie Dog Easy Fox George How Item Jig'), 'ABCDEFGHIJ');
  assert.equal(run('phonetic_decode', 'X-ray Yankee Zulu / Niner One'), 'XYZ 91');
  assert.equal(run('phonetic_encode', 'ab 1', { alphabet: 'nato' }), 'Alfa Bravo / one');
  assert.equal(run('phonetic_decode', run('phonetic_encode', 'hello world', { alphabet: 'able' })), 'HELLO WORLD');
  throwsMsg(() => run('phonetic_decode', 'Alfa Banana'), /not in a phonetic/);
  assert.equal(run('phonetic_decode', 'Alfa Banana', { unknown: 'first' }), 'AB');
});

// ---------- Кодировки ----------
test('EBCDIC cp037 (Python): c8859393966b40e69699938440f1f2f3 → Hello, World 123', () => {
  const bytes = run('hex_decode', 'c8859393966b40e69699938440f1f2f3');
  assert.equal(run('ebcdic_decode', bytes), 'Hello, World 123');
  assert.equal(run('hex_encode', run('ebcdic_encode', 'Hello, World 123'), { enc: 'latin1', sep: '' }), 'C8859393966B40E69699938440F1F2F3');
  assert.ok(ctx.CipherOps.BY_ID.ebcdic_decode.probes(bytes, { depth: 0 }).length === 1);
});

test('Восьмеричные коды ↔ байты', () => {
  assert.equal(run('octal_decode', '101 102 103'), 'ABC');
  assert.equal(run('octal_decode', '\\110\\145\\154\\154\\157'), 'Hello');
  assert.equal(run('octal_decode', '110145154154157'), 'Hello');
  assert.equal(run('octal_encode', 'Hi'), '110 151');
  throwsMsg(() => run('octal_decode', '777'), /bigger than a byte/);
  throwsMsg(() => run('octal_decode', '189'), /non-octal/);
});

test('Base91: test → fPNKd, Python-эталоны и кругооборот всех байтов', () => {
  assert.equal(run('base91_encode', 'test'), 'fPNKd');
  assert.equal(run('base91_decode', 'fPNKd'), 'test');
  assert.equal(run('base91_encode', 'Hello, World!'), '>OwJh>}AQ;r@@Y?F');
  const all = Array.from({ length: 256 }, (_, i) => String.fromCharCode(i)).join('');
  for (const n of [1, 2, 3, 13, 40, 255, 256]) {
    const s = all.slice(0, n);
    assert.equal(run('base91_decode', ctx.CipherOps.BY_ID.base91_encode.run([s], {})), s);
  }
  assert.equal(ctx.Encodings.base91Encode(Array.from({ length: 40 }, (_, i) => String.fromCharCode(i)).join('')), ':C#(:C?hVB$MSiVEwndBAMZRxwFfBB;IW<}YQV!A_v$Y_c%zT');
  throwsMsg(() => run('base91_decode', 'ab-c'), /not in Base91/);
});

test('uuencode (Python binascii): Cat → #0V%T, длинная строка, begin/end', () => {
  assert.equal(run('uuencode', 'Cat', { header: false }), '#0V%T');
  assert.equal(run('uudecode', '#0V%T'), 'Cat');
  const py = "B5&AE('%U:6-K(&)R;W=N(&9O>\"!J=6UP<R!O=F5R('1H90``";
  assert.equal(run('uudecode', py), 'The quick brown fox jumps over the');
  assert.equal(run('uuencode', 'The quick brown fox jumps over the', { header: false }), py);
  const withHeader = run('uuencode', 'Cat');
  assert.match(withHeader, /^begin 644 data\.bin\n#0V%T\n`\nend$/);
  assert.equal(run('uudecode', withHeader), 'Cat');
  const long = 'x'.repeat(100);
  assert.equal(run('uudecode', run('uuencode', long)), long);
});

test('Quoted-printable (Python quopri): Привет =x', () => {
  const qp = '=D0=9F=D1=80=D0=B8=D0=B2=D0=B5=D1=82 =3Dx';
  assert.equal(run('qp_decode', qp), 'Привет =x');
  assert.equal(run('qp_encode', 'Привет =x'), qp);
  assert.equal(run('qp_decode', 'soft=\nbreak =41'), 'softbreak A');
  const long = run('qp_encode', 'a'.repeat(200));
  assert.ok(long.split('\n').every((l) => l.length <= 76));
  assert.equal(run('qp_decode', long), 'a'.repeat(200));
});

test('Punycode (RFC 3492 / Python): bücher, münchen, мир', () => {
  assert.equal(run('punycode_encode', 'bücher', { prefix: false }), 'bcher-kva');
  assert.equal(run('punycode_encode', 'münchen.de'), 'xn--mnchen-3ya.de');
  assert.equal(run('punycode_encode', 'мир', { prefix: false }), 'h1ahn');
  assert.equal(run('punycode_decode', 'xn--mnchen-3ya.de'), 'münchen.de');
  assert.equal(run('punycode_decode', 'bcher-kva'), 'bücher');
  assert.equal(run('punycode_decode', 'maana-pta'), 'mañana');
  assert.equal(run('punycode_decode', 'xn--h1ahn.xn--p1ai'), 'мир.рф');
  throwsMsg(() => run('punycode_decode', 'abc-!!'), /Invalid Punycode/);
});

test('ROT5, ROT18, ROT8000', () => {
  assert.equal(run('rot5', 'Code 2026'), 'Code 7571');
  assert.equal(run('rot18', 'Hello 123'), 'Uryyb 678');
  assert.equal(run('rot18', run('rot18', 'Mixed Case 09')), 'Mixed Case 09');
  assert.equal(run('rot8000', 'A'), '籊');
  const text = 'Hello, мир! 你好 😀 tab\t';
  assert.equal(run('rot8000', run('rot8000', text)), text);
  assert.equal(run('rot8000', 'a b'), run('rot8000', 'a') + ' ' + run('rot8000', 'b'));
});

test('Двоичное → пиксели', () => {
  assert.equal(run('binary_pixels', '0110\n1001', { on: '#', off: '.', scale: 1 }), '.##.\n#..#');
  assert.equal(run('binary_pixels', '0110 1001 1001 0110', { on: '#', off: '.', scale: 1 }), '.##.\n#..#\n#..#\n.##.');
  assert.equal(run('binary_pixels', '011010', { width: 3, on: '#', off: '.', scale: 2 }), '..####\n..##..');
  assert.equal(run('binary_pixels', '01', { width: 2, on: '#', off: '.', scale: 1, invert: true }), '#.');
  throwsMsg(() => run('binary_pixels', '01101'), /square/);
});

// ---------- Помощники ARG ----------
test('Анаграммы: «D I E L N I A I W R M R S» против «MILNER IS WARD» — одна лишняя I', () => {
  const out = run('anagram_check', ['D I E L N I A I W R M R S', 'MILNER IS WARD']);
  assert.match(out, /Anagram: no/);
  assert.match(out, /Extra in A \(not in B\): i$/m);
  assert.match(out, /Missing in A \(present in B\): —$/m);
  assert.match(run('anagram_check', ['Listen', 'Silent']), /Anagram: yes/);
  assert.match(run('anagram_check', ['aab', 'b']), /Extra in A \(not in B\): a×2/);
});

test('Подбор анаграмм по встроенному словарю', () => {
  const out = run('anagram_solve', 'tsilen', { maxWords: 1 }).split('\n');
  assert.ok(out.includes('listen') && out.includes('silent'));
  assert.ok(run('anagram_solve', 'rcae', { maxWords: 1 }).split('\n').includes('race'));
  throwsMsg(() => run('anagram_solve', 'a'.repeat(20)), /Too long/);
  throwsMsg(() => run('anagram_solve', 'qqqq', { maxWords: 1 }), /No matching/);
});

test('XOR с пропуском знаков', () => {
  assert.equal(run('xor_keep', 'ab, cd', { key: '1', fmt: 'num', keep: 'nonalnum' }), '`c, be');
  assert.equal(run('xor_keep', 'ab cd', { key: 'AB', fmt: 'text', keep: 'space', consume: false }), String.fromCharCode(97 ^ 65, 98 ^ 66) + ' ' + String.fromCharCode(99 ^ 65, 100 ^ 66));
  assert.equal(run('xor_keep', 'ab cd', { key: 'AB', fmt: 'text', keep: 'space', consume: true }), String.fromCharCode(97 ^ 65, 98 ^ 66) + ' ' + String.fromCharCode(99 ^ 66, 100 ^ 65));
  assert.equal(run('xor_keep', run('xor_keep', 'Hi there!', { key: '5', keep: 'space' }), { key: '5', keep: 'space' }), 'Hi there!');
  throwsMsg(() => run('xor_keep', 'Привет', { key: '1' }), /outside a byte/);
});

test('Наложение: заполнить # из второго текста', () => {
  assert.equal(run('overlay_fill', ['H#LL#', 'EO']), 'HELLO');
  assert.equal(run('overlay_fill', ['H#LL#', '?E??O'], { mode: 'pos' }), 'HELLO');
  assert.equal(run('overlay_fill', ['H#LL#', 'E']), 'HELL#');
  assert.equal(run('overlay_fill', ['H_LL_', 'EO'], { mark: '_' }), 'HELLO');
});

test('Выбор букв: позиции, слова, регистр, отметки', () => {
  assert.equal(run('pick_letters', 'HELLO WORLD', { indices: '1,3,5-6' }), 'HLOW');
  assert.equal(run('pick_letters', 'HELLO WORLD', { indices: '-1,-2' }), 'DL');
  assert.equal(run('pick_letters', 'HELLO WORLD', { indices: '0', base: 0 }), 'H');
  assert.equal(run('pick_letters', 'alpha bravo charlie', { indices: '2', scope: 'word' }), 'lrh');
  assert.equal(run('pick_letters', 'ab\ncd', { indices: '1', scope: 'line', joiner: '-' }), 'a-c');
  assert.equal(run('pick_letters', 'a Bc dE f', { mode: 'upper' }), 'BE');
  assert.equal(run('pick_letters', 'x1y22', { mode: 'digits' }), '122');
  assert.equal(run('pick_letters', 'a *b* c *de*', { mode: 'marked', mark: '*' }), 'bde');
  assert.equal(run('pick_letters', 'a [b] [cd]', { mode: 'marked', mark: '[]' }), 'bcd');
  assert.equal(run('pick_letters', 'x*a y*b', { mode: 'after_mark', mark: '*' }), 'ab');
  assert.equal(run('pick_letters', 'a* b*', { mode: 'before_mark', mark: '*' }), 'ab');
  throwsMsg(() => run('pick_letters', 'abc', { indices: '9' }), /Nothing/);
});

test('Позывные: сортировка по Able…Jig / НАТО и склейка цифр', () => {
  assert.equal(run('callsign_order', 'Charlie 3\nAble 7\nBaker-2'), '723');
  assert.equal(run('callsign_order', 'Charlie 3\nAble 7\nBaker-2', { out: 'lines' }), 'Able 7\nBaker-2\nCharlie 3');
  assert.equal(run('callsign_order', 'Golf 4\nAlfa 10\nEcho 9'), '1094');
  assert.equal(run('callsign_order', 'Jig 1\nable 2\nIndia 3', { out: 'both' }), 'able 2\nIndia 3\nJig 1\n\n231');
  throwsMsg(() => run('callsign_order', 'Banana 5'), /No phonetic/);
});

// ---------- OpenSSL ----------
const SAMPLE = 'U2FsdGVkX1+vupppZksvRf5pq5g5XjFRIipRkwB0K1Y96Qsv2Lm+31cmzaAILwytX/z66ZVWEQM/ccf1g+9m5Ubu1+sit+A9cenDxxqkIaxbm4cMeh2oKhqIHhdaBKOi6XX2XDWpa6+P5o9MQw==';

test('OpenSSL: детектор видит Salted__, 109 байт, соль; ничего не расшифровывает', () => {
  const out = run('openssl_inspect', SAMPLE);
  assert.match(out, /envelope: YES/);
  assert.match(out, /Total bytes: 109/);
  assert.match(out, /afba9a69664b2f45/);
  assert.match(out, /Ciphertext: 93 bytes/);
  assert.match(out, /NOT a multiple of 16/);
  assert.match(out, /Nothing was decrypted/);
  assert.match(run('openssl_inspect', 'just some text'), /envelope: NO/);
  throwsMsg(() => run('openssl_decrypt', SAMPLE, { key: '' }), /password is required/);
  throwsMsg(() => run('openssl_decrypt', SAMPLE, { key: 'guess' }), /not a multiple of 16/);
  assert.equal(ctx.CipherOps.BY_ID.openssl_inspect.probes, undefined);
});

test('MD5 (RFC 1321) и EVP_BytesToKey (Python hashlib)', () => {
  const { md5, evpBytesToKey } = ctx.OpenSSLTools;
  const enc = (s) => Uint8Array.from(Buffer.from(s));
  assert.equal(toHex(md5(enc(''))), 'd41d8cd98f00b204e9800998ecf8427e');
  assert.equal(toHex(md5(enc('abc'))), '900150983cd24fb0d6963f7d28e17f72');
  assert.equal(toHex(md5(enc('12345678901234567890123456789012345678901234567890123456789012345678901234567890'))), '57edf4a22be3c955ac49da2e2107b67a');
  const { key, iv } = evpBytesToKey(enc('secret'), hexBytes('0102030405060708'), 32, 16);
  assert.equal(toHex(key), 'c9e5a1bd216dbe1317e230cef48f38ee7f0e17ad64022144bccec4a1aa2879ab');
  assert.equal(toHex(iv), 'e24b32bbbc4ef02ecbcb6576523ad893');
});

test('AES (FIPS-197 приложение C): шифрование и расшифровка 128/192/256', () => {
  const { expandKey, aesEncryptBlock, aesDecryptBlock } = ctx.OpenSSLTools;
  const plain = hexBytes('00112233445566778899aabbccddeeff');
  const cases = [
    ['000102030405060708090a0b0c0d0e0f', '69c4e0d86a7b0430d8cdb78070b4c55a'],
    ['000102030405060708090a0b0c0d0e0f1011121314151617', 'dda97ca4864cdfe06eaf70a0ec0d7191'],
    ['000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f', '8ea2b7ca516745bfeafc49904b496089'],
  ];
  for (const [key, cipher] of cases) {
    const ks = expandKey(hexBytes(key));
    assert.equal(toHex(aesEncryptBlock(plain, ks)), cipher);
    assert.equal(toHex(aesDecryptBlock(hexBytes(cipher), ks)), toHex(plain));
  }
});

test('RC4 (RFC 6229): ключ 0102030405', () => {
  const out = ctx.OpenSSLTools.rc4(new Uint8Array(8), hexBytes('0102030405'));
  assert.equal(toHex(out), 'b2396305f03dc027');
});

test('OpenSSL enc (openssl 3.2.4, -md md5, пароль secret): CBC, ECB, CTR', () => {
  const text = 'Meet at dawn, Ёлка!';
  assert.equal(run('openssl_decrypt', 'U2FsdGVkX1/Zu4Xl5dNXFoMWT3JaQDGpr22Xz/By6B0bkzDmDnqPyW0bIbCY+Iuw', { key: 'secret' }), text);
  assert.equal(run('openssl_decrypt', 'U2FsdGVkX1+zxdHKDxw+ICPOCtMO0triGi0HaYRAYj4EqkwmUB6+h5+9dTyjI4li', { key: 'secret', cipher: 'aes-128-ecb' }), text);
  assert.equal(run('openssl_decrypt', 'U2FsdGVkX19dvjVSsNlD5LLtpPox24zOORtU082nN806gVv9GKji', { key: 'secret', cipher: 'aes-256-ctr' }), text);
  assert.equal(run('openssl_decrypt', ['U2FsdGVkX1/Zu4Xl5dNXFoMWT3JaQDGpr22Xz/By6B0bkzDmDnqPyW0bIbCY+Iuw', 'secret']), text);
  throwsMsg(() => run('openssl_decrypt', 'U2FsdGVkX1/Zu4Xl5dNXFoMWT3JaQDGpr22Xz/By6B0bkzDmDnqPyW0bIbCY+Iuw', { key: 'wrong' }), /Wrong password/);
  throwsMsg(() => run('openssl_decrypt', 'aGVsbG8gd29ybGQ=', { key: 'x' }), /not an OpenSSL/);
});

test('ops-openssl.js не превышает 800 строк, как и остальные файлы пакета', () => {
  for (const f of ['ops-classic.js', 'ops-classic2.js', 'ops-glyphs.js', 'ops-encodings.js', 'ops-argtools.js', 'ops-openssl.js']) {
    const lines = fs.readFileSync(path.join(__dirname, '..', 'web', 'js', f), 'utf8').split('\n').length;
    assert.ok(lines < 800, f);
  }
  assert.ok(vm && fs.existsSync(OPENSSL_FILE));
});
