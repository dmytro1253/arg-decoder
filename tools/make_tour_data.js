// Данные для примеров «Все операции»: шифротекст делает сама программа (режим enc или обратная операция),
// затем расшифровка проверяется.  node tools/make_tour_data.js > tools/tour-data.json
const { loadFull } = require('../tests/load.js');
const G = loadFull('en');
const run = (id, inputs, params) => {
  const op = G.CipherOps.BY_ID[id];
  const defs = Object.fromEntries((op.params || []).map((q) => [q.key, q.default]));
  return op.run(inputs, { ...defs, ...params });
};
const items = [];
function item(board, op, params, input, expect, extra) {
  const out = run(op, [input].concat(extra && extra.second !== undefined ? [extra.second] : []), params);
  if (out !== expect) throw new Error(op + ': got ' + JSON.stringify(out) + ' want ' + JSON.stringify(expect));
  items.push({ board, op, params, input, expect, ...(extra || {}) });
}
// пара: зашифровать enc-параметрами и проверить dec
function pair(board, op, params, plain, expectPlain) {
  const ct = run(op, [plain], { ...params, dir: 'enc' });
  item(board, op, { ...params, dir: 'dec' }, ct, expectPlain === undefined ? run(op, [ct], { ...params, dir: 'dec' }) : expectPlain);
}

// ---- 1. квадраты и дробление ----
pair('squares', 'bifid', { key: 'LANTERN' }, 'THEKEYISUNDERTHEMAT');
pair('squares', 'trifid', { key: 'FELIX' }, 'MEETATTHEOLDMILL');
pair('squares', 'adfgx', { square: 'BTALPDHOZKQFVSNGICUXMREWY', key: 'CARGO' }, 'ATTACKATDAWN');
pair('squares', 'adfgvx', { square: 'PH0QG64MEA1YL2NOFDXKR3CVS5ZW7BJ9UTI8', key: 'PRIVACY' }, 'ATTACK AT 1200');
pair('squares', 'four_square', {}, 'HELPMEOBIWANKENOBI');
pair('squares', 'two_square', {}, 'JOINUSATTHEGATE');
pair('squares', 'nihilist', {}, 'DYNAMITEWINTERPALACE');
item('squares', 'playfair', { key: 'playfair example' }, 'BMODZBXDNABEKUDMUIXMMOUVIF', run('playfair', ['BMODZBXDNABEKUDMUIXMMOUVIF'], { key: 'playfair example' }));
// ---- 2. ключевые многоалфавитные ----
// Семья Виженера в режиме «зашифровать» выдаёт отчёт по трём вариантам — шифротекст делает обычный Виженер.
const VIG = run('vigenere', ['the signal repeats at midnight'], { key: 'ORACLE', dir: 'enc', alpha: 'en' });
item('keyed', 'vigenere_family', { key: 'ORACLE', dir: 'dec' }, VIG, run('vigenere_family', [VIG], { key: 'ORACLE', dir: 'dec' }));
pair('keyed', 'running_key', { key: 'itwasabrightcolddayinaprilandtheclockswerestrikingthirteen' }, 'the vault opens at nine');
pair('keyed', 'keyed_caesar', { key: 'NIGHTJAR', n: 3 }, 'follow the white rabbit');
pair('keyed', 'hill', { key: 'GYBNQKURP' }, 'ACTNOWXX');
pair('keyed', 'chaocipher', {}, 'WELLDONEISBETTERTHANWELLSAID');
item('keyed', 'porta', { key: 'FORTIFICATION' }, run('porta', ['define the frontier'], { key: 'FORTIFICATION' }), 'define the frontier');
item('keyed', 'enigma', { model: 'M3', rotors: 'I II III', reflector: 'B', rings: 'AAA', positions: 'ABC', plugboard: 'AV BS CG' }, run('enigma', ['WEATHERREPORTCLEAR'], { model: 'M3', rotors: 'I II III', reflector: 'B', rings: 'AAA', positions: 'ABC', plugboard: 'AV BS CG' }), 'WEATHERREPORTCLEAR');
// аффинный: a=5, b=8 — шифр E(x)=(5x+8) mod 26, считаем сами
const affEnc = (s) => s.replace(/[a-z]/g, (c) => String.fromCharCode(97 + (5 * (c.charCodeAt(0) - 97) + 8) % 26));
item('keyed', 'affine', { alpha: 'en', a: 5, b: 8 }, affEnc('affine cipher'), 'affine cipher');
// автоключ (Виженер): ключ, затем сам открытый текст
const autoEnc = (plain, key) => { const p = plain.replace(/[^a-z]/g, ''); const k = (key + p).slice(0, p.length); let i = 0; return plain.replace(/[a-z]/g, (c) => String.fromCharCode(97 + (c.charCodeAt(0) - 97 + k.charCodeAt(i++) - 97) % 26)); };
item('keyed', 'autokey', { key: 'queen', alpha: 'en' }, autoEnc('attack at dawn', 'queen'), 'attack at dawn');
item('keyed', 'rc4', { key: 'Secret', fmt: 'text' }, run('rc4', ['Attack at dawn'], { key: 'Secret', fmt: 'text' }), 'Attack at dawn');
item('keyed', 'xor_keep', { key: '7', fmt: 'num', keep: 'nonalnum' }, run('xor_keep', ['Hello, World!'], { key: '7', fmt: 'num', keep: 'nonalnum' }), 'Hello, World!');
item('keyed', 'substitute', { from: 'abcdefghijklmnopqrstuvwxyz', to: 'qwertyuiopasdfghjklzxcvbnm' }, run('substitute', ['the cake is a lie'], { from: 'qwertyuiopasdfghjklzxcvbnm', to: 'abcdefghijklmnopqrstuvwxyz' }), 'the cake is a lie');
// ---- 3. перестановки ----
pair('transpositions', 'rail_fence', { rails: 3 }, 'WEAREDISCOVEREDFLEEATONCE');
pair('transpositions', 'scytale', { rows: 4 }, 'IAMHURTVERYBADLYHELP');
pair('transpositions', 'route_cipher', { width: 4, route: 'spiral_cw' }, 'WEAREDISCOVERED');
pair('transpositions', 'myszkowski', { key: 'TOMATO' }, 'WEAREDISCOVEREDFLEEATONCE');
item('transpositions', 'transpose', { w: 4, dir: 'cols' }, run('transpose', ['NIGHTJARCALLING!'], { w: 4, dir: 'cols' }), run('transpose', [run('transpose', ['NIGHTJARCALLING!'], { w: 4, dir: 'cols' })], { w: 4, dir: 'cols' }));
item('transpositions', 'swap_pairs', {}, run('swap_pairs', ['MEETMEATNOON'], {}), 'MEETMEATNOON');
item('transpositions', 'slice', { from: 1, to: 0, step: 3 }, 'TxxHxxExxKxxExxY', 'THEKEY');
item('transpositions', 'chunk', { n: 5, sep: ' ' }, 'ATTACKATDAWN', 'ATTAC KATDA WN');
item('transpositions', 'interleave', {}, 'HLOOL', 'HELLOWORLD', { second: 'ELWRD' });
// ---- 4. символьные алфавиты ----
const sym = (op, plain, encOp, encParams, decParams) => item('symbols', op, decParams || {}, run(encOp, [plain], encParams || {}), run(op, [run(encOp, [plain], encParams || {})], decParams || {}));
sym('pigpen_decode', 'xmarksthespot', 'pigpen_encode');
item('symbols', 'pigpen_encode', {}, 'enderman', run('pigpen_encode', ['enderman'], {}));
sym('runes_decode', 'odin sees all', 'runes_encode');
item('symbols', 'runes_encode', {}, 'odin sees all', run('runes_encode', ['odin sees all'], {}));
sym('braille_decode', 'touch the wall', 'braille_encode');
item('symbols', 'braille_encode', {}, 'touch the wall', run('braille_encode', ['touch the wall'], {}));
item('symbols', 'greek_translit', { dir: 'gr2lat' }, 'ΑΡΓΟΝΑΥΤΗΣ', run('greek_translit', ['ΑΡΓΟΝΑΥΤΗΣ'], { dir: 'gr2lat' }));
sym('phonetic_decode', 'NOTCH', 'phonetic_encode');
item('symbols', 'phonetic_encode', { alphabet: 'nato' }, 'SOS', run('phonetic_encode', ['SOS'], { alphabet: 'nato' }));
item('symbols', 'sga_encode', {}, 'herobrine', run('sga_encode', ['herobrine'], {}));
item('symbols', 'morse_encode', { lang: 'en' }, 'OLD ROOT', run('morse_encode', ['OLD ROOT'], { lang: 'en' }));
item('symbols', 'binary_pixels', { width: 5, scale: 1 }, '01110100011000111111100011000110001', run('binary_pixels', ['01110100011000111111100011000110001'], { width: 5, scale: 1 }));
const CALLS = 'Charlie 5\nAble 4\nEasy 2\nBaker 8\nDog 2';
item('symbols', 'callsign_order', { out: 'digits' }, CALLS, run('callsign_order', [CALLS], { out: 'digits' }));
// ---- 5. кодировки ----
const enc = (op, plain, encOp, params) => item('encodings', op, params || {}, run(encOp, [plain], {}), plain);
enc('base91_decode', 'the archive is open', 'base91_encode');
item('encodings', 'base91_encode', {}, 'the archive is open', run('base91_encode', ['the archive is open'], {}));
enc('octal_decode', 'room 404', 'octal_encode');
item('encodings', 'octal_encode', {}, 'room 404', run('octal_encode', ['room 404'], {}));
enc('ebcdic_decode', 'MAINFRAME', 'ebcdic_encode');
item('encodings', 'ebcdic_encode', {}, 'MAINFRAME', run('ebcdic_encode', ['MAINFRAME'], {}));
enc('uudecode', 'begin the end', 'uuencode');
item('encodings', 'uuencode', {}, 'begin the end', run('uuencode', ['begin the end'], {}));
enc('qp_decode', 'Ключ: ночь', 'qp_encode');
item('encodings', 'qp_encode', {}, 'Ключ: ночь', run('qp_encode', ['Ключ: ночь'], {}));
enc('punycode_decode', 'тайна.рф', 'punycode_encode');
item('encodings', 'punycode_encode', {}, 'тайна.рф', run('punycode_encode', ['тайна.рф'], {}));
item('encodings', 'base58_decode', {}, 'StV1DL6CwTryKyV', 'hello world');
item('encodings', 'rot47', {}, run('rot47', ['Meet @ 9:30!'], {}), 'Meet @ 9:30!');
item('encodings', 'rot5', {}, run('rot5', ['4258225251'], {}), '4258225251');
item('encodings', 'rot18', {}, run('rot18', ['Room 101'], {}), 'Room 101');
item('encodings', 'rot8000', {}, run('rot8000', ['hidden in plain sight'], {}), 'hidden in plain sight');
item('encodings', 'base_convert', { from: 16, to: 10 }, 'DEADBEEF', run('base_convert', ['DEADBEEF'], { from: 16, to: 10 }));
item('encodings', 'a1z26', { alpha: 'en' }, '14 9 7 8 20', 'NIGHT'.toLowerCase() === run('a1z26', ['14 9 7 8 20'], { alpha: 'en' }).toLowerCase() ? run('a1z26', ['14 9 7 8 20'], { alpha: 'en' }) : 'NIGHT');
item('encodings', 'letters_to_numbers', { alpha: 'en' }, 'NIGHT', run('letters_to_numbers', ['NIGHT'], { alpha: 'en' }));
item('encodings', 'text_to_codes', {}, 'ARG', run('text_to_codes', ['ARG'], {}));
item('encodings', 'url_encode', {}, 'ключ = 42', run('url_encode', ['ключ = 42'], {}));
item('encodings', 'hex_encode', {}, 'stop', run('hex_encode', ['stop'], {}));
item('encodings', 'base64_encode', {}, 'stop', run('base64_encode', ['stop'], {}));
item('encodings', 'base32_encode', {}, 'stop', run('base32_encode', ['stop'], {}));
item('encodings', 'binary_encode', {}, 'Hi', run('binary_encode', ['Hi'], {}));
item('encodings', 'text_encode', { enc: 'cp1251' }, 'Привет', run('text_encode', ['Привет'], { enc: 'cp1251' }));
items.push({ board: 'encodings', op: 'hex_encode', params: { enc: 'latin1' }, chainFrom: 'text_encode', expect: run('hex_encode', [run('text_encode', ['Привет'], { enc: 'cp1251' })], { enc: 'latin1' }) });
const ESC = '\\u0048\\x65llo &#x2764; U+0021';
item('encodings', 'unescape', {}, ESC, run('unescape', [ESC], {}));
item('encodings', 'translit', { dir: 'ru2lat' }, 'Шифр Цезаря', run('translit', ['Шифр Цезаря'], { dir: 'ru2lat' }));
item('encodings', 'keyboard_shift', { n: -1 }, run('keyboard_shift', ['herobrine'], { n: 1 }), 'herobrine');
item('encodings', 'filter', { mode: 'letters' }, 'T-H-E 1 K.E.Y 2', run('filter', ['T-H-E 1 K.E.Y 2'], { mode: 'letters' }));
// ---- 6. скрытый текст ----
// Невидимые символы: 200B = 0, 200C = 1, 200D разделяет байты; прячем слово «hide» в обычной фразе.
const zwBits = Array.from('hide', (c) => c.charCodeAt(0).toString(2).padStart(8, '0').replace(/0/g, '​').replace(/1/g, '‌')).join('‍');
const zwText = 'Nothing to see' + zwBits + ' here.';
item('hidden', 'zero_width', { mode: 'bits' }, zwText, run('zero_width', [zwText], { mode: 'bits' }));
items.push({ board: 'hidden', op: 'binary_decode', params: {}, chainFrom: 'zero_width', expect: run('bytes_decode', [run('binary_decode', [run('zero_width', [zwText], { mode: 'bits' })], {})], {}) });
item('hidden', 'acrostic', { n: 1, by: 'words' }, 'Every New Day Every Room Matters And Nothing', 'ENDERMAN'.toLowerCase() === run('acrostic', ['Every New Day Every Room Matters And Nothing'], { n: 1, by: 'words' }).toLowerCase() ? run('acrostic', ['Every New Day Every Room Matters And Nothing'], { n: 1, by: 'words' }) : 'ENDERMAN');
item('hidden', 'book_cipher', { unit: 'words', book: 'In the beginning the forest was silent and the old mill stood alone by the river' }, '7 10 11', run('book_cipher', ['7 10 11'], { unit: 'words', book: 'In the beginning the forest was silent and the old mill stood alone by the river' }));
item('hidden', 'pick_letters', { mode: 'upper' }, 'the Key is hidden in thE capitals, You see', run('pick_letters', ['the Key is hidden in thE capitals, You see'], { mode: 'upper' }));
item('hidden', 'overlay_fill', { mark: '#', mode: 'seq' }, 'N#GHT#AR', run('overlay_fill', ['N#GHT#AR', 'IJ'], { mark: '#', mode: 'seq' }), { second: 'IJ' });
// ---- 7. хеши и OpenSSL ----
for (const h of ['hash_sha1', 'hash_sha256', 'hash_sha512', 'hash_crc32', 'hash_all']) item('hashes', h, {}, 'nightjar', run(h, ['nightjar'], {}));
item('hashes', 'openssl_decrypt', { key: 'secret' }, 'U2FsdGVkX1/Zu4Xl5dNXFoMWT3JaQDGpr22Xz/By6B0bkzDmDnqPyW0bIbCY+Iuw', 'Meet at dawn, Ёлка!');
item('hashes', 'permute_fragments', { sep: ' ', join: '', contains: 'CAB', limit: 20 }, 'IN CAB OUT', run('permute_fragments', ['IN CAB OUT'], { sep: ' ', join: '', contains: 'CAB', limit: 20 }));
console.log(JSON.stringify(items, null, 1));
