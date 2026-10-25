// Загрузка тестовых картинок в {width, height, data} через Python/Pillow (только для тестов).
// Результат кэшируется в каталоге временных файлов. Если Pillow недоступен — возвращает null,
// и приёмочные тесты помечаются как пропущенные.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DIR = __dirname;
const CACHE = path.join(os.tmpdir(), 'argdec-img-fixtures');

function tryDecode(src, dst) {
  for (const cmd of [['python'], ['py', '-3'], ['python3']]) {
    const r = spawnSync(cmd[0], [...cmd.slice(1), path.join(DIR, 'decode.py'), src, dst], { encoding: 'utf8' });
    if (r.status === 0) return true;
  }
  return false;
}

/** Картинка из tests/fixtures по имени файла или null, если декодировать нечем. */
function loadFixture(name) {
  const src = path.join(DIR, name);
  if (!fs.existsSync(src)) throw new Error('Нет файла фикстуры: ' + name);
  fs.mkdirSync(CACHE, { recursive: true });
  const dst = path.join(CACHE, name + '.' + fs.statSync(src).size + '.rgba');
  if (!fs.existsSync(dst) && !tryDecode(src, dst)) return null;
  const buf = fs.readFileSync(dst);
  const width = buf.readUInt32LE(0), height = buf.readUInt32LE(4);
  const data = new Uint8ClampedArray(buf.buffer.slice(buf.byteOffset + 8, buf.byteOffset + buf.length));
  if (data.length !== width * height * 4) throw new Error('Повреждён кэш картинки ' + name);
  return { width, height, data };
}

module.exports = { loadFixture, FIXTURES: DIR };
