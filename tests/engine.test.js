// Тесты движка на реальных решённых этапах ARG mslan. Запуск: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadEngine } = require('./load');

const { ctx, run } = loadEngine();
// Эти тесты — про дело mslan: профиль включается явно (по умолчанию действует нейтральный).
ctx.Profiles.setActive('mslan');

test('Виженер: h2njbrLB5kj + yfqlbvtyz → j2itqqQI5mk', () => {
  assert.equal(run('vigenere', 'h2njbrLB5kj', { key: 'yfqlbvtyz' }), 'j2itqqQI5mk');
  assert.equal(run('vigenere', 'j2itqqQI5mk', { key: 'yfqlbvtyz', dir: 'enc' }), 'h2njbrLB5kj');
});

test('Раскладка: найдименя → yfqlbvtyz', () => {
  assert.equal(run('layout', 'найдименя', { dir: 'ru2en' }), 'yfqlbvtyz');
  assert.equal(run('layout', 'yfqlbvtyz', { dir: 'en2ru' }), 'найдименя');
});

test('HEX → +23: 54303958533C3C634B3121 → kGPojSSzbH8', () => {
  const bytes = run('hex_decode', '54303958533C3C634B3121');
  assert.equal(bytes, 'T09XS<<cK1!');
  assert.equal(run('char_shift', bytes, { n: 23 }), 'kGPojSSzbH8');
});

test('VOID: 3F38322D → ?82- → VOID', () => {
  assert.equal(run('char_shift', run('hex_decode', '3F38322D'), { n: 23 }), 'VOID');
});

test('Пары +23 + URL + CP1251 → КТО ТЫ?', () => {
  const enc = run('dec_codes', '14444214452714444620144527144543142847', { width: '2', shift: 23 });
  assert.equal(enc, '%CA%D2%CE+%D2%DB%3F');
  assert.equal(run('url_decode', enc, { enc: 'cp1251', plus: true }), 'КТО ТЫ?');
});

test('Числовая ссылка catbox', () => {
  const enc = run('dec_codes', '81939389921428421427471427477982857892237674937588972386887814274726809484759523898780', { width: '2', shift: 23 });
  assert.equal(run('url_decode', enc, { plus: false }), 'https://files.catbox.moe/1gukbv.png');
});

test('Base64 → UTF-8 → реверс → Цезарь −12 (33) → ПомогиНам', () => {
  const t = run('bytes_decode', run('base64_decode', '0YjQu9Cp0YTQvtGK0YjRitCr'), { enc: 'utf8' });
  assert.equal(t, 'шлЩфоъшъЫ');
  assert.equal(run('caesar', run('reverse', t), { alpha: 'ru33', n: -12 }), 'ПомогиНам');
});

test('Drive ID из hex', () => {
  const hex = '31 6E 7A 47 68 4E 48 56 45 51 48 62 69 36 41 50 7A 55 55 36 42 65 47 70 7A 34 32 37 53 4D 75 62 6D';
  assert.equal(run('hex_decode', hex), '1nzGhNHVEQHbi6APzUU6BeGpz427SMubm');
});

test('Обратимость Base32, Base64, рельсы, сетка, CP1251', () => {
  assert.equal(run('base32_decode', run('base32_encode', 'Mslan_G')), 'Mslan_G');
  assert.equal(run('bytes_decode', run('base64_decode', run('base64_encode', 'Привет'))), 'Привет');
  const rail = run('rail_fence', 'WEAREDISCOVERED', { rails: 3, dir: 'enc' });
  assert.equal(rail, 'WECRERDSOEEAIVD');
  assert.equal(run('rail_fence', rail, { rails: 3 }), 'WEAREDISCOVERED');
  const grid = run('transpose', 'PSRLVMBHALDPRN', { w: 7 });
  assert.equal(run('transpose', grid, { w: 7, dir: 'rows' }), 'PSRLVMBHALDPRN');
  assert.equal(run('bytes_decode', run('text_encode', 'КТО ТЫ?', { enc: 'cp1251' }), { enc: 'cp1251' }), 'КТО ТЫ?');
});

test('Оценщик отличает текст от мусора', () => {
  const S = ctx.Scorer;
  const good = S.analyze('КтоНибудьПожалуйстаСпаситеНас').score;
  const bad = S.analyze('саНетисапСатсйулажоПьдубиНотК').score;
  const en = S.analyze('all this time i was watching myself').score;
  const junk = S.analyze('PSRLVMBHALDPRNG').score;
  assert.ok(good > 50 && en > 50, `текст: ${good}, ${en}`);
  assert.ok(bad < 50 && junk < 35, `мусор: ${bad}, ${junk}`);
});

test('Авто: реверс находит КтоНибудь…', async () => {
  const res = await ctx.Solver.solve('саНетисапСатсйулажоПьдубиНотК', { depth: 2, beam: 60, timeLimit: 15000 });
  assert.equal(res[0].text, 'КтоНибудьПожалуйстаСпаситеНас');
});

test('Авто: hex + 23 находит kGPojSSzbH8 среди лучших', async () => {
  const res = await ctx.Solver.solve('54303958533C3C634B3121', { depth: 2, beam: 80, timeLimit: 15000 });
  assert.ok(res.slice(0, 15).some((r) => r.text === 'kGPojSSzbH8'), res.slice(0, 8).map((r) => r.text).join(' | '));
});

test('Авто: числа → URL находит catbox-ссылку первой', async () => {
  const res = await ctx.Solver.solve('81939389921428421427471427477982857892237674937588972386887814274726809484759523898780', { depth: 3, beam: 80, timeLimit: 20000 });
  assert.equal(res[0].text, 'https://files.catbox.moe/1gukbv.png');
});

test('Авто: КТО ТЫ? из числового названия папки', async () => {
  const res = await ctx.Solver.solve('14444214452714444620144527144543142847', { depth: 3, beam: 80, timeLimit: 20000 });
  assert.ok(res.slice(0, 5).some((r) => r.text === 'КТО ТЫ?'), res.slice(0, 5).map((r) => r.text).join(' | '));
});

test('Авто: ПомогиНам из Base64 за 4 шага', async () => {
  const res = await ctx.Solver.solve('0YjQu9Cp0YTQvtGK0YjRitCr', { depth: 4, beam: 120, timeLimit: 30000 });
  assert.ok(res.slice(0, 5).some((r) => r.text === 'ПомогиНам'), res.slice(0, 5).map((r) => r.text).join(' | '));
});

test('Авто: Виженер с ключом автора', async () => {
  const res = await ctx.Solver.solve('h2njbrLB5kj', { depth: 1, beam: 50, timeLimit: 10000 });
  assert.ok(res.some((r) => r.text === 'j2itqqQI5mk'));
});

test('Взлом Виженера без ключа на длинном тексте', () => {
  const plain = 'the quick brown fox jumps over the lazy dog and keeps running through the dark forest until morning comes';
  const enc = run('vigenere', plain, { key: 'silver', dir: 'enc', alpha: 'en' });
  const best = ctx.VigenereCrack.crack(enc, { maxKeyLen: 8 })[0];
  assert.equal(best.key, 'silver');
});

const autoCases = [
  ['ℸ ̣⍑ᒷ ᒷリ↸ ╎ᓭ リᒷ⍊ᒷ∷ ℸ ̣⍑ᒷ ᒷリ↸', 'the end is never the end', 2],
  ['.. ...  . .....  .... ..  ... ....  . ..  .... ..  .. ....  ... ...  . .....', 'HEROBRINE', 2],
  ['ABBAB ABBBA BAABB AAABA AABBB', 'NOTCH', 2],
  ['dzpv fk svilyirmv', 'wake up herobrine', 2],
  ['h-9ALhz)lzh-0uLhBxwWhBPIWhz)lzhz)xGhAiP:hz)AH', 'the silence echoes', 3],
  ['0x7370696365776f6f64', 'spicewood', 2],
  ['Y3J5c3RhbGxpbmUgdHJ1dGhzIA==', 'crystalline truths ', 3],
];
for (const [input, want, depth] of autoCases) {
  test('Авто находит «' + want + '» в топ-3', async () => {
    const res = await ctx.Solver.solve(input, { depth, beam: 120, timeLimit: 20000 });
    assert.ok(res.slice(0, 3).some((r) => r.text.trim().toLowerCase() === want.trim().toLowerCase()), res.slice(0, 5).map((r) => r.text).join(' | '));
  });
}

test('Детектор ссылок: явные, обезвреженные, перевёрнутые и голые ID', () => {
  const D = (t) => ctx.Links.detect(t);
  assert.equal(D('смотри https://files.catbox.moe/1gukbv.png!')[0].url, 'https://files.catbox.moe/1gukbv.png');
  assert.equal(D('hxxps://pastebin[.]com/AbCd1234')[0].serviceId, 'pastebin');
  assert.equal(D('gnp.vbkug1/eom.xobtac.selif//:sptth')[0].url, 'https://files.catbox.moe/1gukbv.png');
  assert.ok(D('1nzGhNHVEQHbi6APzUU6BeGpz427SMubm').some((x) => x.serviceId === 'drive'));
  assert.ok(D('kGPojSSzbH8').some((x) => x.serviceId === 'youtube'));
  assert.ok(D('2xihki.mp4').some((x) => x.serviceId === 'catbox'));
  assert.ok(D('UC3_d3GMJAzf6eUOS_nXsfDw').some((x) => x.serviceId === 'yt_channel'));
  assert.equal(D('youtu.be/kGPojSSzbH8')[0].serviceId, 'youtube');
  assert.equal(D('просто обычный текст без ссылок').length, 0);
  assert.equal(D('ow:kpz/qgjjq/cu.jl.t.me/xuhwhlxrqni').filter((x) => x.confidence === 3).length, 0);
  assert.equal(D('files.catbox.moe/1gukbv.png')[0].serviceId, 'catbox');
  assert.equal(D('version 1.2.3 and file.txt').filter((x) => x.confidence >= 2).length, 0);
});

test('Новые операции: обратимость и известные векторы', () => {
  assert.equal(run('columnar', run('columnar', 'WEAREDISCOVEREDFLEE', { key: 'zebras', dir: 'enc' }), { key: 'zebras' }), 'WEAREDISCOVEREDFLEE');
  assert.equal(run('playfair', 'BMODZBXDNABEKUDMUIXMMOUVIF', { key: 'playfairexample' }), 'hidethegoldinthetrexestump');
  assert.equal(run('keyboard_shift', 'jr;;p', { n: -1 }), 'hello');
  assert.equal(run('unescape', '\u0048&#105;\x21'), 'Hi!');
  assert.equal(run('acrostic', 'Mighty Snakes Leave All Nests', { n: 1 }), 'MSLAN');
  assert.equal(run('book_cipher', ['2 4', 'one two three four'], {}), 'two four');
  assert.equal(run('mc_format', '§aПри§lвет'), 'Привет');
  assert.equal(run('zero_width', 'a​‌b‌', { mode: 'bits' }), '011');
  assert.equal(run('vigenere', 'kjxwk', { key: '23', alpha: 'en' }), 'igvti');
  assert.equal(run('t9', '44 33 555 555 666'), 'hello');
  assert.equal(run('t9', '4233', { mode: 'pairs' }), 'hf');
  assert.equal(run('base85_decode', '87cURD]i,"Ebo80', { variant: 'ascii85' }), 'Hello World!');
  assert.equal(run('polybius', '23 15 31 31 34'), 'HELLO');
});

test('Шифры пользователя: пары +23 → URL CP1251 → русский латиницей / реверс — первое место', async () => {
  const a = await ctx.Solver.solve('93144543205528206014464714442592281447331445442055144530', { depth: 4, beam: 150, timeLimit: 30000 });
  assert.equal(a[0].text, 'тЫ Не СпАсешЬ НХ');
  const b = await ctx.Solver.solve('14462514472514463314444214474214474314452714464314463014', { depth: 4, beam: 150, timeLimit: 30000 });
  assert.equal(b[0].text, '%елТыъКира');
});

test('Правки ревью: leet, экранирование, коды §, ссылки', () => {
  assert.equal(run('leet', 'Hello world! C++ is $great, wow!'), 'Hello world! C++ is $great, wow!');
  assert.equal(run('leet', '1NF3C7ED'), 'INFECTED');
  assert.equal(run('unescape', 'U+0041BC и &#99999999;'), 'U+0041BC и &#99999999;');
  assert.equal(run('mc_format', 'Q&A §aок'), 'Q&A ок');
  assert.equal(ctx.Links.detect('go to google.com.')[0].url, 'https://google.com');
  assert.equal(ctx.Links.detect('https://en.wikipedia.org/wiki/X_(y)')[0].url, 'https://en.wikipedia.org/wiki/X_(y)');
  assert.equal(run('ru_leet', 'tЫ N3 SпАs3шЬ NХ'), 'тЫ Не СпАсешЬ НХ');
});

test('Встроенный автоподбор Виженера: короткий и длинный текст', async () => {
  const short = run('vigenere', 'все это время я наблюдал за самим собой', { key: 'дневник', dir: 'enc', alpha: 'ru33' });
  const r1 = await ctx.VigenereAuto.run(short, {});
  assert.equal(r1.rows[0].key, 'дневник');
  const long = run('vigenere', 'the quick brown fox jumps over the lazy dog and keeps running through the dark forest until morning comes again', { key: 'herobrine', dir: 'enc', alpha: 'en' });
  const r2 = await ctx.VigenereAuto.run(long, {});
  assert.equal(r2.rows[0].key, 'herobrine');
});
