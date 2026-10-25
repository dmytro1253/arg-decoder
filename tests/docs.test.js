// Справочник функций собирается из реестров: если добавили ноду или пример, docs/FUNCTIONS*.md надо пересобрать.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build, FILES } = require('../tools/gen_functions_doc');

for (const [lang, name] of Object.entries(FILES)) {
  test(`docs/${name} актуален (node tools/gen_functions_doc.js)`, () => {
    const file = path.join(__dirname, '..', 'docs', name);
    assert.ok(fs.readFileSync(file, 'utf8') === build(lang), `docs/${name} устарел: запусти node tools/gen_functions_doc.js`);
  });
}
