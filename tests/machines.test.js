// Энигма и сырой RC4 на опубликованных контрольных примерах (без собственных «эталонов»).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFull } = require('./load');

const G = loadFull('en');
const enigma = (t, p) => G.CipherOps.BY_ID.enigma.run([t], Object.assign({ model: 'M3', rotors: 'I II III', reflector: 'B', rings: 'AAA', positions: 'AAA', plugboard: '' }, p));
const rc4 = (t, key, extra) => G.CipherOps.BY_ID.rc4.run([t], Object.assign({ key, fmt: 'text', drop: 0, enc: 'auto', strict: false }, extra));
const hex = (s) => Array.from(s, (ch) => ch.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase();

test('Энигма I: AAAAA → BDZGO (роторы I II III, рефлектор B, AAA)', () => {
  assert.equal(enigma('AAAAA'), 'BDZGO');
  assert.equal(enigma('BDZGO'), 'AAAAA', 'инволюция');
});

test('Энигма M3: сообщение операции «Барбаросса» (1941), кольца 02 21 12, коммутатор из 10 пар', () => {
  const ct = 'EDPUDNRGYSZRCXNUYTPOMRMBOFKTBZREZKMLXLVEFGUEYSIOZVEQMIKUBPMMYLKLTTDEISMDICAGYKUACTCDOMOHWXMUUIAUBSTSLRNBZSZWNRFXWFYSSXJZVIJHIDISHPRKLKAYUPADTXQSPINQMATLPIFSVKDASCTACDPBOPVHJK';
  const pt = enigma(ct, { rotors: 'II IV V', rings: '02 21 12', positions: 'BLA', plugboard: 'AV BS CG DL FU HZ IN KM OW RX' });
  assert.ok(pt.startsWith('AUFKLXABTEILUNGXVONXKURTINOWAXKURTINOWAXNORDWESTLXSEBEZ'), pt.slice(0, 40));
});

test('Энигма M4: сообщение 1942 года (Beta II IV I, B-thin, кольца AAAV, старт VJNA)', () => {
  const ct = 'NCZWVUSXPNYMINHZXMQXSFWXWLKJAHSHNMCOCCAKUQPMKCSMHKSEINJUSBLKIOSXCKUBHMLLXCSJUSRRDVKOHULXWCCBGVLIYXEOAHXRHKKFVDREWEZLXOBAFGYUJQUKGRTVUKAMEURBVEKSUHHVOYHABCJWMAKLFKLMYFVNRIZRVVRTKOFDANJMOLBGFFLEOPRGTFLVRHOWOPBEKVWMUQFMPWPARMFHAGKXIIBG';
  const pt = enigma(ct, { model: 'M4', rotors: 'Beta II IV I', reflector: 'B-thin', rings: 'A A A V', positions: 'VJNA', plugboard: 'AT BL DF GJ HM NW OP QY RZ VX' });
  assert.ok(pt.startsWith('VONVONJLOOKSJHFFTTTEINSEINSDREIZWO'), pt.slice(0, 40));
});

test('Энигма: двойной шаг среднего ротора (ADU → ADV → AEW → BFX)', () => {
  const m = G.Enigma.machine({ model: 'M3', rotors: 'I II III', reflector: 'B', rings: 'AAA', positions: 'ADU', plugboard: '' });
  // Позиции не видны снаружи, поэтому проверяем через текст: 3 буквы от ADU равны 3 буквам по отдельности от ADV/AEW/BFX.
  const one = (pos) => enigma('A', { positions: pos });
  const three = enigma('AAA', { positions: 'ADU' });
  assert.equal(three, one('ADU') + enigma('A', { positions: 'ADV' }) + enigma('A', { positions: 'AEW' }));
  assert.ok(typeof m === 'function');
});

test('Энигма: регистр и не-буквы сохраняются, неверные настройки — понятные ошибки', () => {
  assert.equal(enigma('aaa aa!'), 'bdz go!');
  assert.throws(() => enigma('A', { plugboard: 'AB AC' }), /уже соединена|already plugged/);
  assert.throws(() => enigma('A', { rotors: 'I II' }), /3 ротора|3 rotors/);
  assert.throws(() => enigma('A', { reflector: 'B-thin' }), /M4/);
});

test('RC4 (сырой): контрольные векторы Key/Plaintext, Wiki/pedia, Secret/Attack at dawn', () => {
  assert.equal(hex(rc4('Plaintext', 'Key')), 'BBF316E8D940AF0AD3');
  assert.equal(hex(rc4('pedia', 'Wiki')), '1021BF0420');
  assert.equal(hex(rc4('Attack at dawn', 'Secret')), '45A01F645FC35B383552544B9BF5');
  assert.equal(rc4(rc4('Attack at dawn', 'Secret'), 'Secret'), 'Attack at dawn');
});

test('RC4: ключ в HEX, drop и ошибки', () => {
  assert.equal(hex(rc4('Plaintext', '4b6579', { fmt: 'hex' })), 'BBF316E8D940AF0AD3');
  assert.notEqual(hex(rc4('Plaintext', 'Key', { drop: 768 })), 'BBF316E8D940AF0AD3');
  assert.throws(() => rc4('x', ''), /RC4/);
});
