// Тесты экранных клавиатур: каждая раскладка «печатает» последовательность клавиш, а расшифровщик возвращает нужный текст.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadEngine } = require('./load');

const WEB = path.join(__dirname, '..', 'web', 'js');
const { ctx, run } = loadEngine();
for (const f of ['kb-core.js', 'sga-keyboard.js', 'kb-layouts.js', 'kb-special.js']) vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), ctx, { filename: f });
const Core = ctx.KbCore;
const L = ctx.KbLayouts;

const layout = (id) => Core.get(id);
const keys = (id) => Core.allKeys(layout(id));
/** Нажатие клавиши по подписи (cap) в нужной секции; alt — режим альтернативной записи. */
function press(id, cap, section, alt) {
  const lay = layout(id);
  const pool = section === undefined ? Core.allKeys(lay) : lay.sections[section].keys;
  const key = pool.find((k) => k.id === cap || k.cap === cap || k.ins === cap);
  assert.ok(key, id + ': нет клавиши «' + cap + '»');
  return alt && key.insAlt !== undefined ? key.insAlt : key.ins;
}
const typeCaps = (id, caps, section, alt) => caps.map((c) => press(id, c, section, alt)).join('');

test('реестр: восемь вкладок в нужном порядке', () => {
  assert.deepEqual(Array.from(Core.list(), (l) => l.id), ['sga', 'braille', 'morse', 'runes', 'greek', 'pigpen', 'special', 'homoglyph']);
  for (const lay of Core.list()) assert.ok(lay.sections.every((s) => s.keys.every((k) => k.ins && k.glyph)), lay.id + ': у клавиш есть ins и glyph');
});

test('SGA: клавиши → sga_decode', () => {
  assert.equal(run('sga_decode', typeCaps('sga', [...'diamond'])), 'diamond');
  assert.equal(layout('sga').encode('Hello'), ctx.SgaKeyboard.encode('hello'));
});

test('Брайль: клавиши и конструктор → braille_decode (EN и RU)', () => {
  const bySrc = (c) => keys('braille').find((k) => (k.src || []).includes(c)).ins;
  const word = [...'hello'].map(bySrc).join('');
  assert.equal(run('braille_decode', word), 'hello');
  // Конструктор ячеек: точки 1,2,5 = h
  assert.equal(L.cellFromDots([1, 2, 5]), '⠓');
  assert.equal(L.cellFromDots([5, 2, 1, 2]), '⠓', 'порядок и повторы не важны');
  assert.deepEqual(Array.from(L.dotsOfCell('⠓')), [1, 2, 5]);
  const built = [[1, 2, 5], [1, 5], [1, 2, 3], [1, 2, 3], [1, 3, 5]].map(L.cellFromDots).join('');
  assert.equal(run('braille_decode', built), 'hello');
  // Знак числа и заглавной из служебных клавиш
  const num = press('braille', '#') + bySrc('a') + bySrc('b');
  assert.equal(run('braille_decode', num), '12');
  assert.equal(run('braille_decode', press('braille', 'Aa') + bySrc('a')), 'A');
  // Русская таблица: буква ё и ъ есть только в ней
  const ru = L.cellFromDots([1, 6]) + L.cellFromDots([1, 2, 3, 5, 6]);
  assert.equal(run('braille_decode', ru, { table: 'ru' }), 'ёъ');
  // Подпись EN/RU у ячейки совпадает с расшифровкой обеих таблиц
  for (const k of keys('braille').filter((x) => /^\p{L}\/\p{L}$/u.test(x.cap))) {
    const [en, rus] = k.cap.split('/');
    assert.equal(run('braille_decode', k.ins), en);
    assert.equal(run('braille_decode', k.ins, { table: 'ru' }), rus);
  }
});

test('Брайль: поиск кодирует тем же алгоритмом, что braille_encode', () => {
  const lay = layout('braille');
  assert.equal(lay.encode('Hi 42'), run('braille_encode', 'Hi 42'));
  assert.equal(lay.encode('привет'), run('braille_encode', 'привет', { table: 'ru' }));
  assert.equal(run('braille_decode', lay.encode('привет'), { table: 'ru' }), 'привет');
  assert.equal(lay.sections[1].keys.length, 63);
});

test('Морзе: клавиши точка/тире/пробел → morse_decode, обе записи', () => {
  const dot = press('morse', 'dot'); const dash = press('morse', 'dash');
  const sp = press('morse', 'gap'); const word = press('morse', 'word');
  const typed = dot + dot + dot + sp + dash + dash + dash + sp + dot + dot + dot + word + dash;
  assert.equal(run('morse_decode', typed), 'sos t');
  const ascii = press('morse', 'dot', undefined, true) + press('morse', 'dash', undefined, true) + sp;
  assert.equal(run('morse_decode', ascii), 'a');
  // Буквенные клавиши вставляют код и пробел
  assert.equal(run('morse_decode', typeCaps('morse', [...'sos'], 1)), 'sos');
  assert.equal(run('morse_decode', typeCaps('morse', [...'sos'], 1, true)), 'sos');
  assert.equal(run('morse_decode', typeCaps('morse', [...'привет'], 2), { lang: 'ru' }), 'привет');
});

test('Морзе: живая расшифровка терпима к ошибкам и совпадает с операцией на верном вводе', () => {
  const good = '··· −−− ··· / −·−·';
  assert.equal(L.morseDecode(good, 'en'), run('morse_decode', good));
  assert.equal(L.morseDecode('··· ········ ·', 'en'), 's?e');
});

test('Руны: Старший и Младший футарк → runes_decode', () => {
  assert.equal(run('runes_decode', typeCaps('runes', ['f', 'u', 'th', 'a', 'r', 'k'], 0)), 'futhark');
  assert.equal(run('runes_decode', typeCaps('runes', ['n', 'g', 'ï'], 0)), 'ngï');
  // Младший: все 17 клавиш читаются, а не остаются рунами
  for (const k of layout('runes').sections[1].keys) assert.equal(run('runes_decode', k.ins), k.cap, 'младшая руна ' + k.ins);
  for (const k of layout('runes').sections[0].keys) assert.equal(run('runes_decode', k.ins), k.cap, 'старшая руна ' + k.ins);
  // Разделители читаются как пробел
  assert.equal(run('runes_decode', press('runes', 'a', 0) + press('runes', 'sep') + press('runes', 'a', 0)), 'a a');
  assert.equal(layout('runes').encode('futhark'), run('runes_encode', 'futhark'));
});

test('Греческий: клавиши → greek_translit в обе стороны', () => {
  assert.equal(run('greek_translit', typeCaps('greek', ['th', 'e', 'o', 's'], 0)), 'theos');
  assert.equal(run('greek_translit', typeCaps('greek', ['a', 'b', 'g'], 1)), 'abg');
  assert.equal(run('greek_translit', 'ά ή'), 'a e', 'ударения снимаются');
  assert.equal(layout('greek').encode('theos'), 'θεοσ');
  assert.equal(run('greek_translit', layout('greek').encode('alpha beta'), { dir: 'gr2lat' }), 'alpha beta');
  for (const k of keys('greek').filter((x) => x.src)) assert.equal(run('greek_translit', k.ins).toLowerCase(), k.cap, 'буква ' + k.ins);
});

test('Пигпен: клавиши (Юникод и жетоны) → pigpen_decode, encode совпадает с операцией', () => {
  const word = [...'HELLO'];
  const glyphs = word.map((c) => press('pigpen', c, 0)).join(' ');
  assert.equal(run('pigpen_decode', glyphs), 'HELLO');
  assert.equal(run('pigpen_decode', word.map((c) => press('pigpen', c, 0)).join('')), 'HELLO', 'без пробелов');
  assert.equal(run('pigpen_decode', word.map((c) => press('pigpen', c, 0, true)).join('')), 'HELLO', 'жетоны');
  for (const k of layout('pigpen').sections[0].keys) {
    assert.equal(run('pigpen_decode', k.ins), k.cap, 'знак ' + k.cap);
    assert.equal(run('pigpen_decode', k.insAlt), k.cap, 'жетон ' + k.cap);
  }
  const two = press('pigpen', 'A', 0) + press('pigpen', 'word') + press('pigpen', 'B', 0);
  assert.equal(run('pigpen_decode', two), 'A B');
  assert.equal(layout('pigpen').encode('Hello World'), run('pigpen_encode', 'Hello World'));
});

test('Спецсимволы: коды § → mc_format, нулевая ширина → zero_width', () => {
  const colored = press('special', '§c') + 'Hi' + press('special', '§r') + ' there';
  assert.equal(colored.slice(0, 2), '§c');
  assert.equal(run('mc_format', colored), 'Hi there');
  assert.equal(run('mc_format', colored, { mode: 'codes' }), 'cr');
  // Все цветовые и форматирующие клавиши — настоящие коды Minecraft
  const mc = layout('special').sections.slice(0, 2).flatMap((s) => s.keys).filter((k) => k.ins.length === 2);
  assert.equal(mc.length, 22);
  for (const k of mc) assert.equal(run('mc_format', k.ins + 'x'), 'x', k.ins);
  // Невидимые: ZWSP = 0, ZWNJ = 1
  const bits = press('special', '200B') + press('special', '200C') + press('special', '200C') + press('special', '200B');
  assert.equal(run('zero_width', bits, { mode: 'bits' }), '0110');
  assert.equal(run('zero_width', press('special', '200C') + press('special', '200D'), { mode: 'bits2' }), '01');
  for (const k of layout('special').sections[2].keys.slice(0, 6)) assert.equal(run('zero_width', k.ins, { mode: 'strip' }), '', k.title + ' читается операцией');
  assert.equal(layout('special').decode(bits), '⟨200B⟩⟨200C⟩⟨200C⟩⟨200B⟩');
});

test('Спецсимволы: backspace стирает «§a» и невидимый символ целиком', () => {
  const tokens = layout('special').tokens;
  const s = 'ab§a';
  assert.deepEqual(JSON.parse(JSON.stringify(Core.deleteBackward(s, s.length, undefined, tokens))), { text: 'ab', caret: 2 });
  const z = 'a‍';
  assert.deepEqual(JSON.parse(JSON.stringify(Core.deleteBackward(z, z.length, undefined, tokens))), { text: 'a', caret: 1 });
  assert.equal(Core.deleteBackward('x§', 2, undefined, tokens).text, 'x');
  assert.equal(Core.deleteBackward('abcdef', 1, 4, tokens).text, 'aef');
});

test('Спецсимволы: фильтр ищет по названию, коду и символу', () => {
  const lay = layout('special');
  const has = (q, ins) => [...Core.matchKeys(lay, q).hits].some((k) => k.ins === ins);
  assert.ok(has('zwsp', '​'));
  assert.ok(has('200c', '‌'));
  assert.ok(has('§c', '§c'));
  assert.ok(has('→', '→'));
  assert.equal(Core.matchKeys(lay, 'такого-нет-zzz').hits.size, 0);
});

test('Двойники: клавиши → homoglyph (в обе стороны)', () => {
  const lay = layout('homoglyph');
  const lat = 'CAPE';
  const cyr = [...lat].map((c) => lay.sections[0].keys.find((k) => k.cap === c).ins).join('');
  assert.notEqual(cyr, lat);
  assert.equal(run('homoglyph', cyr, { mode: 'tolat' }), lat);
  const back = [...cyr].map((c) => lay.sections[1].keys.find((k) => k.cap === c).ins).join('');
  assert.equal(back, lat);
  assert.equal(lay.encode('pace'), run('homoglyph', 'pace', { mode: 'tocyr' }));
  for (const k of lay.sections[0].keys) assert.equal(run('homoglyph', k.ins, { mode: 'tolat' }), k.cap, 'двойник ' + k.title);
});

test('поиск: подсветка букв, диграфы и последняя клавиша', () => {
  const runes = layout('runes');
  const m = Core.matchKeys(runes, 'thng');
  const caps = [...m.hits].map((k) => k.cap);
  assert.ok(caps.includes('th') && caps.includes('ng'));
  assert.equal(m.last.cap, 'ng');
  assert.equal(Core.matchKeys(runes, '').hits.size, 0);
});

test('backspace по умолчанию стирает один графемный кластер', () => {
  const r = Core.deleteBackward('ab⠓', 3);
  assert.equal(r.text, 'ab');
  assert.equal(Core.deleteBackward('abc', 0).text, 'abc');
});

test('файлы клавиатур короче 800 строк, в HTML подключены в нужном порядке', () => {
  for (const f of ['kb-core.js', 'sga-keyboard.js', 'kb-layouts.js', 'kb-special.js', 'keyboards.js']) {
    assert.ok(fs.readFileSync(path.join(WEB, f), 'utf8').split('\n').length < 800, f);
  }
  const html = fs.readFileSync(path.join(WEB, '..', 'index.html'), 'utf8');
  const order = ['kb-core.js', 'sga-keyboard.js', 'kb-layouts.js', 'kb-special.js', 'keyboards.js'].map((f) => html.indexOf('js/' + f));
  assert.ok(order.every((i, n) => i > 0 && (n === 0 || i > order[n - 1])));
  assert.ok(html.indexOf('js/ops-glyphs.js') < order[2], 'таблицы операций загружены раньше раскладок');
});
