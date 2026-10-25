// Регрессии по ревью 24.10.2026: повторные декодеры, перевёрнутые ссылки, ссылка внутри шифртекста,
// «формат снят» против «ответ подтверждён», короткие кодировки, граница хоста YouTube, перестановка столбцов.
// Все прогоны слепые: нейтральный профиль, пустой банк ключей, без эталона и ключа.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFull } = require('./load');

const G = loadFull('en');
async function solve(input, extra) {
  G.Profiles.setActive('neutral');
  G.KeyBank.clear();
  return G.Solver.solve(input, Object.assign({ depth: 3, beam: 160, timeLimit: 15000, engines: false }, extra));
}
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const hex = (s) => Buffer.from(s, 'utf8').toString('hex');

test('повторные декодеры: Base64×2, Base64×3, hex(hex), %25XX — точный первый', async () => {
  for (const input of [b64(b64('Hello world')), b64(b64(b64('Hello world'))), hex(hex('Hello world')), '%2548%2565%256c%256c%256f%2520%2577%256f%2572%256c%2564']) {
    const res = await solve(input);
    assert.equal(res[0].text, 'Hello world', input);
    assert.equal(res[0].status, 'confident');
  }
});

test('повторы ограничены: цикл состояний не зацикливает поиск', async () => {
  let s = 'Hello world';
  for (let i = 0; i < 8; i++) s = b64(s);
  const res = await solve(s, { timeLimit: 8000 });
  assert.ok(res.length > 0);
  assert.notEqual(res[0].status, 'confident', 'восемь слоёв глубже предела не должны выдаваться за ответ');
});

test('перевёрнутая ссылка не ответ: прямая ссылка первая, в том числе под Base64', async () => {
  const url = 'https://files.catbox.moe/a1b2c3.png';
  for (const input of [Array.from(url).reverse().join(''), b64(Array.from(url).reverse().join(''))]) {
    const res = await solve(input);
    assert.equal(res[0].text, url, input);
    assert.equal(res[0].status, 'confident');
    const rev = res.find((r) => r.text === Array.from(url).reverse().join(''));
    if (rev) assert.notEqual(rev.status, 'confident');
  }
});

test('ссылка внутри шифртекста подтверждает только себя: Цезарь и Атбаш с YouTube в украинском тексте', async () => {
  const plain = 'Подивись тут: https://youtu.be/jNQXAC9IVRw — там є ще одна підказка.';
  for (const input of ['Чцйоиощд ьюь: https://youtu.be/jNQXAC9IVRw — ьжф л ґк цйхж чпйтжнтж.', 'Йкчтьтів изи: https://youtu.be/jNQXAC9IVRw — иям х гц кчля йсчояуоя.']) {
    const res = await solve(input);
    assert.equal(res[0].text, plain, input);
    const asIs = res.find((r) => r.asIs);
    assert.ok(!asIs || asIs.status === 'fragment', 'как есть — только часть входа');
  }
});

test('эмодзи и ссылка не ломают украинский Атбаш', async () => {
  const res = await solve('Онбд 🔑 нцфтив юсна чьцїцп 🚪. https://youtu.be/dQw4w9WgXcQ');
  assert.equal(res[0].text, 'Ключ 🔑 лежить біля дверей 🚪. https://youtu.be/dQw4w9WgXcQ');
});

test('короткие кодировки: KNKE6UA=, <~;cHOh~>, U1RPUA → STOP (формат снят, ответ не подтверждён)', async () => {
  for (const input of ['KNKE6UA=', '<~;cHOh~>', 'U1RPUA']) {
    const res = await solve(input);
    assert.equal(res[0].text, 'STOP', input);
    assert.equal(res[0].status, 'decoded');
  }
});

test('печатаемый вывод декодера — не подтверждённый ответ: POTS не confident, STOP в первой десятке', async () => {
  const res = await solve('UE9UUw==');
  assert.notEqual(res[0].status, 'confident');
  const i = res.findIndex((r) => r.text === 'STOP');
  assert.ok(i >= 0 && i < 20, 'STOP на месте ' + i);
});

test('две перестановки одних слов: лидер не «уверенный»', async () => {
  const res = await solve('ЙІНІ ЬТСІНДЄ КОНАҐ КАЖЇ');
  assert.notEqual(res[0].status, 'confident');
  assert.ok(res.slice(0, 2).some((r) => r.text === 'ЇЖАК ҐАНОК ЄДНІСТЬ ІНІЙ'));
});

test('форма предложения выбирает порядок слов после реверса', async () => {
  const plain = 'Спочатку переверни запис, потім прочитай кожну другу літеру останнього повідомлення.';
  const res = await solve(Array.from(plain).reverse().join(''));
  assert.equal(res[0].text, plain);
});

test('граница хоста YouTube: notyoutube.com, fakeyoutu.be и путь чужого сайта — не YouTube', () => {
  const f = G.Links.youtubeIdFrom;
  for (const t of ['https://notyoutube.com/watch?v=jNQXAC9IVRw', 'https://fakeyoutu.be/jNQXAC9IVRw', 'evil.com/youtu.be/jNQXAC9IVRw', 'user@youtube.com/watch?v=jNQXAC9IVRw']) assert.equal(f(t), null, t);
  for (const t of ['https://www.youtube.com/watch?v=jNQXAC9IVRw', 'Дивись youtu.be/jNQXAC9IVRw тут', 'hxxps://youtu[.]be/jNQXAC9IVRw', 'https://m.youtube.com/shorts/jNQXAC9IVRw']) assert.equal(f(t), 'jNQXAC9IVRw', t);
});

// Независимый кодировщик перестановки столбцов (как в генераторе ревью): столбцы читаются в порядке букв ключа.
const columnar = (s, key) => {
  const a = Array.from(s);
  const order = Array.from(key).map((ch, i) => [ch.toLowerCase(), i]).sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] - y[1])).map((x) => x[1]);
  return order.map((i) => a.filter((_, j) => j % key.length === i).join('')).join('');
};

test('перестановка столбцов: украинский текст подбирается своей языковой моделью', async () => {
  const plain = 'Зустріньмося біля кам’яного мосту опівночі. Візьми мідний ключ і невеликий ліхтар.';
  const res = await solve(columnar(plain, 'KESTREL'));
  assert.equal(res[0].text, plain);
});

test('перестановка столбцов над ссылкой: порядок по формату адреса, неполная последняя строка', async () => {
  const url = 'https://pastebin.com/Ab9xYz12';
  const res = await solve(columnar(url, 'BLUEFOX'));
  assert.ok(res.slice(0, 3).some((r) => r.text === url), res.slice(0, 3).map((r) => r.text).join(' | '));
});

// Независимый кодировщик Виженера (как в ревью): ключ сдвигается только на буквах.
const vig = (s, key) => { let pos = 0; return Array.from(s, (ch) => { const i = 'abcdefghijklmnopqrstuvwxyz'.indexOf(ch.toLowerCase()); if (i < 0) return ch; const x = 'abcdefghijklmnopqrstuvwxyz'[(i + key.charCodeAt(pos++ % key.length) - 97) % 26]; return ch === ch.toLowerCase() ? x : x.toUpperCase(); }).join(''); };

test('Виженер над ссылкой: ключ из известного начала адреса и формы хоста; неизвестный хост — без ложной уверенности', async () => {
  for (const url of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/_Ab9-xYz012', 'https://files.catbox.moe/a1b2c3.png']) {
    const res = await solve(vig(url, 'nebula'));
    assert.equal(res[0].text, url);
  }
  const unknown = await solve(vig('https://example.org/secret/page', 'nebula'));
  assert.notEqual(unknown[0].status, 'confident');
});

test('Sombra: бинарный дамп → строки QR (12+12+13 бит, три колонки) → изображение → QR', () => {
  const fs = require('fs');
  const path = require('path');
  G.jsQR = G.jsQR || require('../web/vendor/jsqr/jsQR.js');
  const dump = fs.readFileSync(path.join(__dirname, 'fixtures', 'sombra-binary.txt'), 'utf8');
  const grid = G.CipherOps.BY_ID.bit_rows.run([dump], { keep: '12,12,13', perRow: 3, columns: 3 });
  assert.equal(grid.split('\n').length, 37);
  const h = G.NodeTypes.bits_to_image.compute([grid], { width: 0, on: '1', off: '0', order: 'rows', flipH: false, flipV: false, invert: false, scale: 8, margin: 4 }, { state: {} });
  const img = G.Artifacts.runtimeGet(G.Artifacts.idOf(h));
  assert.match(G.Qr.decodeQr(img).text, /^¿Estuvo eso facilito\?/);
});
