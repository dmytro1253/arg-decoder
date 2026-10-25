// Каждый пример из меню должен вычисляться без ошибок и давать ожидаемый ответ.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadEngine } = require('./load');

const { ctx } = loadEngine();
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'web', 'js', 'presets.js'), 'utf8'), ctx);
// Специальные ноды без DOM: только вычисление.
ctx.NodeTypes = {
  input: { name: 'Ввод', inputs: [], params: [{ key: 'text', default: '' }], compute: (_, p) => p.text },
  view: { name: 'Результат', inputs: ['вход'], compute: ([v]) => v },
  youtube: { name: 'YouTube', inputs: ['вход'], compute: ([v]) => v },
  note: { name: 'Заметка', inputs: [], compute: () => undefined },
  auto: { name: 'Авто', inputs: ['вход'], compute: () => undefined },
  analyze: { name: 'Анализ', inputs: ['вход'], compute: ([v]) => v },
  mask: { name: 'Маска', inputs: ['маска'], noInputOk: true, params: [{ key: 'mask', default: '' }], compute: () => undefined },
};

const EXPECTED = {
  vigenere: 'j2itqqQI5mk', hex23: 'kGPojSSzbH8', ktoty: 'КТО ТЫ?', catbox: 'https://files.catbox.moe/1gukbv.png',
  drive: '1nzGhNHVEQHbi6APzUU6BeGpz427SMubm', pomogi: 'ПомогиНам', void: 'VOID', 'kto-reverse': 'КтоНибудьПожалуйстаСпаситеНас',
  fragments: 'AgLL2GDLrgQ', 'key-parts': 'j2itqqQI5mk', direct: 'sQjZoZ5abcw',
  'dng-hex': 'spicewood', 'dng-leet': 'INFECTED', 'dng-z85': 'the silence echoes', 'dng-grid': 'FOLLOWTHESCULKTOTHEANCIENTCITY',
  'dng-hexvig': 'the warden hears you', 'gd-b64': 'crystalline truths ', sga: 'the end is never the end', tap: 'HEROBRINE',
  'numbers-mod': 'ALLOFTHEDOTSAREFINALLYSTARTINGTOCONNECT WHOKNEWDOLPHINSWEREHIDINGSOMUCH', 'hex-plain': 'AAAA', 'log-hex': 'stop',
  t9: 'notch', 'ru-leet': 'тЫ Не СпАсешЬ НХ', kira: '%елТыъКира', bacon: 'NOTCH', polybius: 'ENDERMAN', atbash: 'wake up herobrine',
};

for (const preset of ctx.Presets) {
  test('пример «' + preset.title + '»', () => {
    const g = new ctx.Graph();
    g.load(preset);
    const res = g.evaluate();
    for (const [id, r] of res) assert.equal(r.error, null, `нода ${id} (${g.nodes.get(id).type}): ${r.error}`);
    if (EXPECTED[preset.id]) {
      const values = [...res.values()].map((r) => r.value);
      assert.ok(values.includes(EXPECTED[preset.id]), 'нет ожидаемого «' + EXPECTED[preset.id] + '», есть: ' + values.join(' | '));
    }
  });
}
