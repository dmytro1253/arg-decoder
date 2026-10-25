// Українська: словник інтерфейсу повний, шаблони з числами перекладаються, реєстри показують українські назви,
// а автопошук розв'язує українські шифри так само, як російські й англійські (без ключів і підказок).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFull } = require('./load');
const I18nUk = require('../tools/i18n_uk');

const uk = loadFull('uk');
const run = (ctx, id, t, p = {}) => { const op = ctx.CipherOps.BY_ID[id]; return op.run([t], Object.assign(Object.fromEntries(op.params.map((q) => [q.key, q.default])), p)); };
const RU_ONLY = /[ыэъЫЭЪ]/;

test('словник: кожен рядок інтерфейсу перекладено, заповнювачі {n} збережено', () => {
  const r = I18nUk.check();
  assert.equal(r.missing.length, 0, 'без перекладу: ' + r.missing.slice(0, 5).join(' | '));
  assert.equal(r.broken.length, 0, 'зламані заповнювачі: ' + r.broken.slice(0, 5).join(' | '));
  assert.ok(r.total > 3000);
});

test('T(): точні рядки й шаблони з числами', () => {
  assert.equal(uk.I18n.lang, 'uk');
  assert.equal(uk.T('Ключ', 'Key'), 'Ключ');
  assert.equal(uk.T('Проверено 3 из 5, найдено: 1', 'x'), 'Перевірено 3 з 5, знайдено: 1');
  assert.equal(uk.T('Невідомий рядок поза словником', 'x'), 'Невідомий рядок поза словником');   // без перекладу — як є
  assert.equal(uk.I18n.locale(), 'uk-UA');
});

test('реєстри: операції, вузли, довідка, приклади й досьє — українською', () => {
  const bad = [];
  for (const o of uk.CipherOps.OPS) {
    if (RU_ONLY.test(o.name) || RU_ONLY.test(o.desc || '')) bad.push(o.id);
    for (const p of o.params) if (RU_ONLY.test(p.label || '')) bad.push(o.id + '.' + p.key);
  }
  for (const [id, n] of Object.entries(uk.NodeTypes)) if (RU_ONLY.test(n.name) || RU_ONLY.test(n.desc || '')) bad.push(id);
  for (const d of uk.Dossiers.list()) if (RU_ONLY.test(d.summary)) bad.push('dossier ' + d.id);
  for (const id of Object.keys(uk.CipherOps.BY_ID)) { const h = uk.Help.lookup(id); if (h && RU_ONLY.test(h.what)) bad.push('help ' + id); }
  assert.deepEqual(bad, []);
  assert.equal(uk.CipherOps.BY_ID.vigenere.name, 'Віженер');
  assert.match(uk.Help.lookup('vigenere').what, /ключ/);
  assert.equal(uk.Presets.find((p) => p.id === 'kf2-vigenere').title, 'Killing Floor 2: Віженер із ключем із попереднього етапу');
});

test('мова визначається: ?lang=uk або браузер з українською', () => {
  const nav = loadFull('uk');
  assert.equal(nav.I18n.lang, 'uk');
  assert.ok(nav.I18n.SUPPORTED.includes('uk'));
});

test('мовна модель: українська відрізняється від російської', () => {
  const a = uk.Scorer.analyze('Ми зустрінемося біля старого млина опівночі', []);
  const b = uk.Scorer.analyze('Мы встретимся возле старой мельницы в полночь', []);
  assert.equal(a.lang, 'uk');
  assert.equal(b.lang, 'ru');
  assert.ok(a.readable && b.readable);
});

const PLAIN = 'Ми зустрінемося біля старого млина опівночі, візьми із собою ліхтар і ключ від підвалу';
const SHORT = 'ключ від підвалу';
const CASES = {
  'Цезар (33 літери)': () => run(uk, 'caesar', PLAIN, { alpha: 'uk33', n: 5 }),
  'Атбаш': () => run(uk, 'atbash', PLAIN),
  'реверс': () => Array.from(PLAIN).reverse().join(''),
  'Base64 з UTF-8': () => Buffer.from(PLAIN, 'utf8').toString('base64'),
  'Віженер без ключа': () => run(uk, 'vigenere', PLAIN, { key: 'зірка', dir: 'enc', alpha: 'uk33' }),
};
for (const [name, make] of Object.entries(CASES)) {
  test('автопошук наосліп: ' + name, async () => {
    uk.Profiles.setActive('neutral');
    uk.KeyBank.clear();
    const res = await uk.Solver.solve(make(), { depth: 3, beam: 160, timeLimit: 30000 });
    assert.equal(res[0].text, PLAIN, 'зверху: ' + res[0].text);
    assert.equal(res.verdict, 'solved');
  });
}

test('автопошук наосліп: hex і українська розкладка', async () => {
  for (const input of [Buffer.from(SHORT, 'utf8').toString('hex'), uk.Codec.layout(SHORT, 'uk2en')]) {
    uk.KeyBank.clear();
    const res = await uk.Solver.solve(input, { depth: 3, beam: 160, timeLimit: 30000 });
    assert.equal(res[0].text, SHORT, input + ' → ' + res[0].text);
  }
});

test('вбудований підбір Віженера: український алфавіт обирається сам', async () => {
  const long = 'усе це було давно але ми пам’ятаємо кожен день коли шукали відповідь на старі загадки разом із друзями';
  const cipher = run(uk, 'vigenere', long, { key: 'світло', dir: 'enc', alpha: 'uk33' });
  const r = await uk.VigenereAuto.run(cipher, {});
  assert.equal(r.rows[0].key, 'світло');
  assert.equal(r.rows[0].alpha, 'uk33');
});

test('розкладка EN ↔ UK', () => {
  assert.equal(uk.Codec.layout('Ghbdsn', 'en2uk'), 'Привіт');
  assert.equal(uk.Codec.layout('Привіт', 'uk2en'), 'Ghbdsn');
});
