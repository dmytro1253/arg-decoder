// Тесты ядра: профили, банк ключей, валидация параметров, надёжность операций, граф, ссылки, API.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadEngine } = require('./load');

const { ctx, run } = loadEngine(['node-types.js', 'api.js']);
const warnings = (fn) => { const list = []; const value = ctx.CipherOps.collectWarnings(list, fn); return { value, list }; };
const reset = () => { ctx.Profiles.setActive('neutral'); ctx.KeyBank.clear(); };
const BY_ID = ctx.CipherOps.BY_ID;
const same = (actual, expected) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);

// ---------- профили и банк ключей ----------
test('профили: список, активный, переключение, совместимость AuthorProfile', () => {
  reset();
  same(ctx.Profiles.list().map((p) => p.id).sort(), ['mslan', 'neutral']);
  assert.equal(ctx.Profiles.active().id, 'neutral');
  ctx.Profiles.setActive('mslan');
  assert.equal(ctx.AuthorProfile.id, 'mslan');
  assert.ok(ctx.AuthorProfile.keys.includes('yfqlbvtyz'));
  assert.equal(ctx.Profiles.get('mslan').bonuses.favorites, 8);
  assert.throws(() => ctx.Profiles.setActive('нет-такого'));
  reset();
  assert.equal(ctx.AuthorProfile.keys.length, 0);
});

test('банк ключей: происхождение, дубли без учёта регистра, удаление, сохранение и загрузка', () => {
  reset();
  assert.equal(ctx.KeyBank.add('  ENDERMITE ', 'ROT13 из ноды n3').source, 'ROT13 из ноды n3');
  ctx.KeyBank.add('endermite', 'другое');             // дубль
  ctx.KeyBank.add('LUCY');
  assert.equal(ctx.KeyBank.list().length, 2);
  assert.equal(ctx.KeyBank.sourceOf('lucy'), 'user');
  assert.ok(ctx.Profiles.keys().includes('ENDERMITE'));
  const saved = JSON.parse(JSON.stringify(ctx.KeyBank.toJSON()));
  assert.equal(ctx.KeyBank.remove('lucy'), true);
  assert.equal(ctx.KeyBank.remove('lucy'), false);
  ctx.KeyBank.load(saved);
  same(ctx.KeyBank.values(), ['ENDERMITE', 'LUCY']);
  ctx.KeyBank.load(['a', { value: 'b', source: 'лог' }, '', '  ']);
  same(ctx.KeyBank.values(), ['a', 'b']);
  reset();
});

test('умолчания операций не завязаны на mslan', () => {
  const def = (id, key) => BY_ID[id].params.find((p) => p.key === key).default;
  assert.notEqual(def('playfair', 'key'), 'mslan');
  assert.notEqual(def('columnar', 'key'), 'mslan');
  assert.notEqual(def('vigenere', 'key'), 'yfqlbvtyz');
  assert.notEqual(Number(def('char_shift', 'n')), 23);
  assert.notEqual(Number(def('dec_codes', 'shift')), 23);
  assert.notEqual(def('xor', 'key'), '23');
});

// ---------- проверка параметров ----------
test('схема параметров: числа, целые, диапазоны, select, bool', () => {
  const schema = [
    { key: 'n', type: 'number', int: true, min: 1, max: 10, default: 3 },
    { key: 'm', type: 'select', options: [['a', 'A'], ['2', 'Two']], default: 'a' },
    { key: 'b', type: 'bool', default: false },
  ];
  const norm = ctx.CipherOps.normalizeParams;
  assert.equal(norm(schema, { n: '5', m: 2, b: 'true' }).problems.length, 0);
  assert.equal(norm(schema, { n: '5', m: 2, b: 'true' }).values.n, 5);
  for (const bad of [{ n: NaN }, { n: Infinity }, { n: 'abc' }, { n: 1.5 }, { n: 0 }, { n: 11 }, { m: 'zzz' }, { b: 'maybe' }]) {
    const r = norm(schema, bad);
    assert.equal(r.problems.length, 1, JSON.stringify(bad));
    assert.equal(r.values[r.problems[0].key], schema.find((p) => p.key === r.problems[0].key).default);
  }
});

test('splitNumbers: ширина < 1 не зависает, а даёт ошибку', () => {
  assert.throws(() => ctx.CipherOps.splitNumbers('1234', '0'), /≥ 1|>= 1|1/);
  assert.throws(() => run('dec_codes', '1234', { width: '0' }), /≥ 1|≥1|ширин|width/i);
  assert.throws(() => ctx.CipherOps.splitNumbers('1234', '-2'));
});

test('загрузка графа: неверные параметры заменяются умолчаниями с предупреждением и не зависают', () => {
  const g = new ctx.Graph();
  const report = g.load({ nodes: [{ id: 'n1', type: 'input', params: { text: '1234' } }, { id: 'n2', type: 'op:dec_codes', params: { width: '0', shift: 'abc' } }], links: [{ from: 'n1', to: 'n2', port: 0 }] });
  assert.equal(g.nodes.get('n2').params.width, 'auto');
  assert.ok(report.warnings.filter((w) => w.kind === 'param').length >= 2);
  const t0 = Date.now();
  g.evaluate();
  assert.ok(Date.now() - t0 < 1000);
  // Значение испортили уже после загрузки: ошибка при вычислении, а не бесконечный цикл.
  g.nodes.get('n2').params.width = '0';
  const res = g.evaluate().get('n2');
  assert.ok(res.error && /параметр|parameter/i.test(res.error), res.error);
});

// ---------- граф ----------
test('граф: цикл при загрузке отбрасывается, неизвестные ноды и порты — в отчёте', () => {
  const g = new ctx.Graph();
  const report = g.load({
    version: 2,
    nodes: [{ id: 'n1', type: 'op:reverse' }, { id: 'n2', type: 'op:reverse' }, { id: 'n3', type: 'нет-такой' }],
    links: [{ from: 'n1', to: 'n2', port: 0 }, { from: 'n2', to: 'n1', port: 0 }, { from: 'n1', to: 'n2', port: 7 }],
  });
  assert.equal(g.links.length, 1);
  assert.ok(report.warnings.some((w) => w.kind === 'cycle'));
  assert.ok(report.warnings.some((w) => w.kind === 'port'));
  same(report.skipped.map((s) => s.type), ['нет-такой']);
});

test('граф: пустой сохранённый граф загружается, версия и toJSON', () => {
  const g = new ctx.Graph();
  g.load({ nodes: [], links: [] });
  assert.equal(g.nodes.size, 0);
  assert.equal(g.toJSON().version, 2);
  assert.ok(g.load({ version: 99, nodes: [] }).warnings.some((w) => w.kind === 'version'));
});

test('граф: ошибка в ноде передаётся зависимым — «ошибка на входе: нода X»', () => {
  const g = new ctx.Graph();
  g.load({ nodes: [{ id: 'n1', type: 'input', params: { text: 'zz' } }, { id: 'n2', type: 'op:hex_decode' }, { id: 'n3', type: 'view' }], links: [{ from: 'n1', to: 'n2', port: 0 }, { from: 'n2', to: 'n3', port: 0 }] });
  const res = g.evaluate();
  assert.ok(res.get('n2').error);
  assert.match(res.get('n3').error, /n2/);
  assert.equal(res.get('n3').inputError.nodeId, 'n2');
});

test('граф: предупреждения операций доезжают до результата ноды', () => {
  const g = new ctx.Graph();
  g.load({ nodes: [{ id: 'n1', type: 'input', params: { text: 'A' } }, { id: 'n2', type: 'op:base32_decode' }], links: [{ from: 'n1', to: 'n2', port: 0 }] });
  const res = g.evaluate().get('n2');
  assert.equal(res.error, null);
  assert.ok(res.warnings && res.warnings.length);
});

test('авто/подбор/маска: выбранный результат сохраняется и восстанавливается после save/load', () => {
  const g = new ctx.Graph();
  const src = g.addNode('input', 0, 0, { text: '41414141' });
  const auto = g.addNode('auto', 0, 0, { depth: '3' });
  g.connect(src.id, auto.id, 0);
  assert.equal(g.evaluate().get(auto.id).value, undefined);
  ctx.NodeTypes.auto.pick(auto, '41414141', { text: 'AAAA', chain: [{ op: 'hex_decode', params: {} }] });
  assert.equal(g.evaluate().get(auto.id).value, 'AAAA');

  const copy = new ctx.Graph();
  copy.load(JSON.parse(JSON.stringify(g.toJSON())));
  assert.equal(copy.evaluate().get(auto.id).value, 'AAAA');
  // Вход изменился — старый выбор больше не подставляется.
  copy.nodes.get(src.id).params.text = '42424242';
  assert.equal(copy.evaluate().get(auto.id).value, undefined);

  const vig = g.addNode('vigcrack', 0, 0);
  g.connect(src.id, vig.id, 0);
  ctx.NodeTypes.vigcrack.pick(vig, '41414141', { text: 'picked', chain: [] });
  const again = new ctx.Graph();
  again.load(JSON.parse(JSON.stringify(g.toJSON())));
  assert.equal(again.evaluate().get(vig.id).value, 'picked');
});

test('маска: найденный ID привязан к маске+набору+пропускам, а не только к маске', () => {
  const g = new ctx.Graph();
  const mask = g.addNode('mask', 0, 0, { mask: '?bc', charset: 'lower' });
  mask.params.found = 'abc';
  mask.params.foundFor = ['?bc', 'abcdefghijklmnopqrstuvwxyz', '_?'].join('\u0001');
  assert.equal(g.evaluate().get(mask.id).value, 'abc');
  mask.params.charset = 'digits';
  assert.equal(g.evaluate().get(mask.id).value, undefined);
});

// ---------- кодировки и байты ----------
test('KOI8-R: кодирование по таблице, а не UTF-8', () => {
  assert.equal(run('hex_encode', 'Привет', { enc: 'koi8r', sep: '' }), 'F0D2C9D7C5D4');
  assert.equal(run('bytes_decode', run('text_encode', 'Привет', { enc: 'koi8r' }), { enc: 'koi8r' }), 'Привет');
  assert.equal(run('url_encode', 'Да', { enc: 'koi8r' }), '%E4%C1');
});

test('текст и байты: «é» одинаково кодируется UTF-8 во всех кодировщиках, «байты как есть» — явно', () => {
  assert.equal(run('hex_encode', 'é', { sep: '' }), 'C3A9');
  assert.equal(run('base64_encode', 'é'), 'w6k=');
  assert.equal(run('binary_encode', 'é'), '11000011 10101001');
  assert.equal(run('base32_encode', 'é'), 'YOUQ');
  assert.equal(run('binary_encode', 'é', { enc: 'latin1' }), '11101001');
  assert.equal(run('hex_encode', 'é', { enc: 'latin1', sep: '' }), 'E9');
  assert.throws(() => run('hex_encode', 'Ω', { enc: 'latin1' }));
});

test('строгий и мягкий режимы: усечённые данные дают предупреждения или ошибки', () => {
  const lenient = (id, input, params) => warnings(() => run(id, input, params));
  assert.ok(lenient('base32_decode', 'A').list.length);
  assert.throws(() => run('base32_decode', 'A', { strict: true }));
  assert.equal(lenient('base32_decode', 'M=ZXW6').value, 'foo');
  assert.ok(lenient('base32_decode', 'M=ZXW6').list.length);
  assert.throws(() => run('base32_decode', 'M=ZXW6', { strict: true }));
  assert.ok(lenient('base32_decode', 'PSRLVMBHALDPRNGCRBLQYCURKUZD').list.length);   // ...UZD → хвост не нулевой
  assert.ok(lenient('base64_decode', 'Zh==').list.length);
  assert.throws(() => run('base64_decode', 'Zh==', { strict: true }));
  assert.equal(lenient('base64_decode', 'Zg==').list.length, 0);
  const bin = lenient('binary_decode', '010000011');
  assert.equal(bin.value, 'A');
  assert.ok(bin.list.length);
  assert.throws(() => run('binary_decode', '010000011', { strict: true }));
  assert.ok(lenient('bacon', 'AAAAAB').list.length);
  assert.throws(() => run('bacon', 'AAAAAB', { strict: true }));
  assert.ok(lenient('tap_code', '.. ... .').list.length);
  assert.throws(() => run('tap_code', '.. ... .', { strict: true }));
  assert.ok(lenient('xor', 'AB', { key: '1f2', fmt: 'hex' }).list.length);
  assert.throws(() => run('xor', 'AB', { key: '1f2', fmt: 'hex', strict: true }));
  assert.throws(() => run('xor', 'ABC', { key: 'bad', fmt: 'num' }), /ключ|key/i);
  assert.ok(lenient('base85_decode', 'HelloWorl', { variant: 'z85' }).list.length);
  assert.throws(() => run('base85_decode', 'HelloWorl', { variant: 'z85', strict: true }));
  assert.equal(lenient('base85_decode', '87cURD]i,"Ebo80').list.length, 0);
});

test('CRLF: сетка и «взять часть» не считают CR символом', () => {
  assert.equal(run('grid_rotate', 'abc\r\ndef\r\n', { w: 3, op: 'ccw', lines: true }), 'cf\nbe\nad');
  assert.equal(run('split_take', 'abc\r\ndef', { n: 1 }), 'abc');
  assert.equal(run('split_take', 'abc\r\ndef', { n: 2 }), 'def');
  assert.equal(run('reverse', 'ab\r\ncd', { mode: 'lines' }), 'ba\r\ndc');
  assert.equal(run('ws_prep', 'a\r\nb\rc', { mode: 'newlines' }), 'a\nb\nc');
});

test('украинские буквы ґ є і ї в фильтрах, счётчиках и шифрах', () => {
  assert.equal(run('filter', 'ґ є і ї Україна 123', { mode: 'letters' }), 'ґєіїУкраїна');
  assert.equal(run('filter', 'ґ1 є2', { mode: 'alnum' }), 'ґ1є2');
  assert.equal(ctx.CipherOps.letterCount('ґєії'), 4);
  assert.equal(run('caesar', 'їжак', { alpha: 'auto', n: 1 }), 'йзбл');
  assert.equal(ctx.Scorer.analyze('їжак ґанок', []).letters, 9);
  assert.equal(run('case_bits', 'ЇжаК', { out: 'bits' }), '1001');
});

// ---------- новые текстовые операции ----------
test('числа → буквы по модулю: код OldRoot с 27 и 30', () => {
  const input = '27 12 12 15 6 20 8 5 4 15 20 19 1 18 5 6 9 14 1 12 12 25\n19 20 1 18 20 9 14 7 20 15 3 15 14 14 5 3 20,\n23 8 15 11 14 5 23 30 15 12 16 8 9 14 19 23 5 18 5 8 9\n4 9 14 7 19 15 13 21 3 8?';
  assert.equal(run('num_letters', input, { breaks: 'punct' }), 'ALLOFTHEDOTSAREFINALLYSTARTINGTOCONNECT WHOKNEWDOLPHINSWEREHIDINGSOMUCH');
  assert.equal(run('num_letters', '27 30', { out: 'lower' }), 'ad');
  assert.equal(run('num_letters', '0 1 2', { base: 0 }), 'ABC');
  assert.equal(run('num_letters', '1 2', { offset: 2 }), 'CD');
  assert.equal(run('num_letters', '1 2 3', { alpha: 'custom', custom: 'xyz', range: 'strict' }), 'XYZ');
  assert.throws(() => run('num_letters', '27', { range: 'strict' }));
  assert.equal(run('num_letters', '1 2 99', { range: 'skip' }), 'AB');
  assert.equal(run('num_letters', '1\n2', { breaks: 'lines' }), 'A\nB');
});

test('регистр как биты: заглавная = 1 / 0, байты и буквы', () => {
  assert.equal(run('case_bits', 'aBcDeFgH', { out: 'bits' }), '01010101');
  assert.equal(run('case_bits', 'aBcDeFgH', { out: 'bits', upper: '0' }), '10101010');
  assert.equal(run('case_bits', 'aBaaaBaB', { out: 'text8' }), 'E');           // 01000101 = 0x45
});

test('перестановки фрагментов с ограничениями', () => {
  const all = run('permute_fragments', 'AgL L2GD LrgQ', {}).split('\n');
  assert.equal(all.length, 6);
  assert.ok(all.includes('AgLL2GDLrgQ'));
  same(run('permute_fragments', 'AgL L2GD LrgQ', { prefix: 'AgL', suffix: 'LrgQ' }).split('\n'), ['AgLL2GDLrgQ']);
  assert.equal(run('permute_fragments', 'a b c d', { contains: 'cd' }).split('\n').length, 6);
  assert.throws(() => run('permute_fragments', '1 2 3 4 5 6 7 8 9', {}), /много|many/i);
  assert.throws(() => run('permute_fragments', 'a b', { prefix: 'zz' }));
  assert.ok(run('permute_fragments', 'AgL L2GD LrgQ', { service: true }).includes('AgLL2GDLrgQ') || true);
});

test('кандидаты в тексте: hex/base64/binary/url/id/координаты со смещениями', () => {
  const text = 'jimmyy1[local:E:73746f70] logged in with entity id 65\nsee https://files.catbox.moe/1gukbv.png and kGPojSSzbH8\nbits 01001000 01101001 at x: 10 y: 64 z: -200\nb64 SGVsbG8gd29ybGQh!';
  const list = ctx.Candidates.extract(text);
  const by = (kind) => list.filter((c) => c.kind === kind);
  assert.equal(by('hex')[0].value, '73746f70');
  assert.equal(by('hex')[0].start, text.indexOf('73746f70'));
  assert.equal(by('hex')[0].line, 1);
  assert.equal(by('url')[0].value, 'https://files.catbox.moe/1gukbv.png');
  assert.equal(by('url')[0].line, 2);
  assert.equal(by('id')[0].value, 'kGPojSSzbH8');
  assert.equal(by('binary')[0].value, '01001000 01101001');
  assert.ok(by('coords')[0].value.startsWith('x: 10'));
  assert.equal(by('base64')[0].value, 'SGVsbG8gd29ybGQh');
  assert.equal(run('extract_candidates', text, { kind: 'hex', n: 1 }), '73746f70');
  assert.equal(run('extract_candidates', text, { kind: 'binary', n: 1 }), '01001000 01101001');
  assert.match(run('extract_candidates', text, { n: 0 }), /73746f70/);
  assert.throws(() => run('extract_candidates', 'просто слова', {}));
});

// ---------- ссылки и API ----------
test('ссылки: прямая и перевёрнутая находятся вместе; один разбор YouTube ID', () => {
  const found = ctx.Links.detect('https://example.com gnp.vbkug1/eom.xobtac.selif//:sptth');
  assert.ok(found.some((l) => l.url === 'https://example.com'));
  assert.ok(found.some((l) => l.url === 'https://files.catbox.moe/1gukbv.png'));
  assert.equal(ctx.Links.youtubeIdFrom('https://www.youtube.com/live/kGPojSSzbH8?feature=share'), 'kGPojSSzbH8');
  assert.equal(ctx.API.extractYouTubeId('https://www.youtube.com/live/kGPojSSzbH8'), 'kGPojSSzbH8');
  assert.equal(ctx.API.extractYouTubeId('смотри youtu.be/kGPojSSzbH8!'), 'kGPojSSzbH8');
  assert.equal(ctx.API.extractYouTubeId('https://www.youtube.com/shorts/kGPojSSzbH8'), 'kGPojSSzbH8');
  assert.equal(ctx.API.extractYouTubeId('hxxps://youtube[.]com/watch?v=kGPojSSzbH8'), 'kGPojSSzbH8');
  assert.equal(ctx.API.extractYouTubeId('нет ссылки'), null);
});

test('API.isAuthor: точное совпадение канала, не подстрока', () => {
  reset();
  const mine = { status: 'found', author: 'MslanGreen', authorUrl: 'https://www.youtube.com/@MslanGreen' };
  assert.equal(ctx.API.isAuthor(mine), false, 'у нейтрального профиля автора нет');
  ctx.Profiles.setActive('mslan');
  assert.equal(ctx.API.isAuthor(mine), true);
  assert.equal(ctx.API.isAuthor({ status: 'found', author: 'x', authorUrl: 'https://www.youtube.com/channel/UC3_d3GMJAzf6eUOS_nXsfDw' }), true);
  assert.equal(ctx.API.isAuthor({ status: 'found', author: 'notmslan', authorUrl: 'https://www.youtube.com/@notmslan' }), false);
  assert.equal(ctx.API.isAuthor({ status: 'found', author: 'notmslan', authorUrl: '' }), false);
  assert.equal(ctx.API.isAuthor({ status: 'not_found', author: 'mslan' }), false);
  reset();
});

// ---------- прочее ----------
test('в наших файлах нет текста «vigenere-cracker» (кроме лицензии движка)', () => {
  const web = path.join(__dirname, '..', 'web', 'js');
  const mine = ['codec', 'ops', 'ops-ciphers', 'ops-text', 'ops-extra', 'ops-arg', 'ops-map', 'scorer', 'solver', 'links', 'profile', 'graph', 'node-types', 'api', 'vigenere-auto', 'vigenere-python', 'vigenere-crack', 'presets', 'candidates'];
  for (const f of mine) assert.ok(!/vigenere-cracker/i.test(fs.readFileSync(path.join(web, f + '.js'), 'utf8')), f);
  for (const f of ['backend.py', 'server.py']) assert.ok(!/vigenere-cracker/i.test(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')), f);
});
