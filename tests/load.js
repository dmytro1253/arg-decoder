// Загружает браузерные скрипты движка в изолированный контекст Node для тестов.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const WEB = path.join(__dirname, '..', 'web', 'js');
// Порядок как в index.html: i18n → данные → кодеки → операции → ссылки/профили/кандидаты → оценка/поиск → граф.
const ENGINE = ['i18n.js', 'lang-data.js', 'codec.js', 'ops.js', 'ops-ciphers.js', 'ops-text.js', 'ops-arg.js', 'ops-extra.js', 'ops-map.js',
  'ops-classic.js', 'ops-classic2.js', 'ops-encodings.js', 'ops-glyphs.js', 'ops-argtools.js', 'ops-openssl.js',
  'links.js', 'profile.js', 'candidates.js', 'scorer.js', 'vigenere-crack.js', 'vigenere-auto.js', 'solver-evidence.js', 'solver.js', 'graph.js'];

function loadEngine(extraFiles) {
  const ctx = { atob, btoa, TextDecoder, TextEncoder, setTimeout, console, Date, Math, URL };
  ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of new Set(ENGINE.concat(extraFiles || []))) vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), ctx, { filename: f });
  const run = (id, input, params = {}) => {
    const op = ctx.CipherOps.BY_ID[id];
    const full = Object.fromEntries(op.params.map((p) => [p.key, p.default]));
    return op.run(Array.isArray(input) ? input : [input], { ...full, ...params });
  };
  return { ctx, run };
}

/**
 * Загружает ВСЕ браузерные скрипты из index.html (кроме vendor, debug, app, workspace) в контекст с заглушкой DOM.
 * Нужен тестам, которым требуется полный реестр операций, спец-нод и примеров.
 */
function loadFull(lang) {
  const html = fs.readFileSync(path.join(WEB, '..', 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])
    .filter((s) => !s.startsWith('vendor') && !/(^|\/)(debug|app|workspace)\.js$/.test(s));
  const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : stub()), apply: () => stub(), construct: () => stub() });
  const ctx = { atob, btoa, TextDecoder, TextEncoder, setTimeout, clearTimeout, console, Date, Math, URL, document: stub(), navigator: { language: lang || 'ru' } };
  ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of scripts) vm.runInContext(fs.readFileSync(path.join(WEB, '..', f), 'utf8'), ctx, { filename: f });
  if (lang) ctx.I18n.lang = lang;
  return ctx;
}

module.exports = { loadEngine, loadFull };
