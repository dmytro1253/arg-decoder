// Специальные ноды: ввод, просмотр, заметка, анализ, проверка YouTube, перебор маски,
// авто-расшифровка и подбор Виженера. mount/update рисуют собственный интерфейс внутри ноды.
// Выбор в нодах «Авто», «Подбор Виженера» и «Маска» хранится в скрытых параметрах: после
// сохранения и загрузки графа выход ноды восстанавливается.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NT = {};
  const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  const CHARSETS = {
    b64url: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
    alnum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    digits: '0123456789',
  };
  const MASK_LIMIT = 300000;
  const MASK_CONFIRM = 5000;
  const MASK_WORKERS = 6;
  const SOLVE_BEAM = 160;
  const SOLVE_TIME_MS = 40000;

  // Короткий отпечаток строки (FNV-1a): по нему узнаём, что сохранённый выбор относится к этому входу.
  function fingerprint(str) {
    let x = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
    return str.length + ':' + x.toString(16);
  }

  // Набор символов маски (без пользовательских мелочей, влияющих на результат).
  function maskSignature(mask, p) {
    const set = p.charset === 'custom' ? p.custom : CHARSETS[p.charset];
    return [mask, set, p.wild].join('\u0001');
  }

  NT.input = {
    name: T('Ввод', 'Input'), cat: 'Ввод и вывод', inputs: [],
    desc: T('Сюда вставляется шифр. Можно сделать несколько вводов для частей и ключей.', 'Paste a cipher here. You can make several inputs for parts and keys.'),
    params: [{ key: 'text', label: T('Текст', 'Text'), type: 'textarea', default: '' }],
    compute: (_, p) => p.text,
  };

  NT.view = {
    name: T('Результат', 'Result'), cat: 'Ввод и вывод', big: true,
    desc: T('Крупно показывает значение, распознаёт ссылки и YouTube ID.', 'Shows the value large and recognises links and YouTube IDs.'),
    compute: ([v]) => v,
  };

  NT.note = {
    name: T('Заметка', 'Note'), cat: 'Ввод и вывод', inputs: [], noOutput: true,
    desc: T('Свободный текст для гипотез и подсказок.', 'Free text for hypotheses and hints.'),
    params: [{ key: 'text', label: '', type: 'textarea', default: T('Подсказка: …', 'Hint: …') }],
    compute: () => undefined,
  };

  NT.analyze = {
    name: T('Анализ строки', 'String analysis'), cat: 'Проверка',
    desc: T('Длина, алфавит, индекс совпадений, на что похоже. Пропускает значение дальше.', 'Length, alphabet, index of coincidence, what it looks like. Passes the value on.'),
    compute: ([v]) => v,
    update(node, res, body) {
      const box = body.querySelector('.special') || body.appendChild(h('div', 'special'));
      box.innerHTML = '';
      if (res.value === undefined) return;
      const s = G.Scorer.stats(res.value);
      const a = G.Scorer.analyze(res.value, G.AuthorProfile ? G.AuthorProfile.keywords : []);
      const rows = [
        [T('Символов', 'Characters'), s.length + T(' (уник. ', ' (unique ') + s.unique + ')'],
        [T('Буквы', 'Letters'), s.letters + T(' (лат ', ' (Lat ') + s.latin + T(', кир ', ', Cyr ') + s.cyr + ')'],
        [T('Цифры', 'Digits'), s.digits],
        [T('Индекс совпадений', 'Index of coincidence'), s.ioc + (s.letters > 20 ? (s.ioc > 0.05 ? T(' — похоже на язык/моноалфавит', ' — looks like a language/monoalphabetic') : T(' — похоже на полиалфавит/шум', ' — looks polyalphabetic/noise')) : '')],
        [T('Частые', 'Most frequent'), s.top || '—'],
        [T('Похоже на', 'Looks like'), s.kind],
        [T('Оценка текста', 'Text score'), a.score + (a.tags.length ? ' · ' + a.tags.join(', ') : '')],
      ];
      const table = h('table', 'stats');
      for (const [k, v] of rows) {
        const tr = table.insertRow();
        tr.insertCell().textContent = k;
        tr.insertCell().textContent = v;
      }
      box.appendChild(table);
    },
  };

  NT.youtube = {
    name: T('Проверка YouTube', 'YouTube check'), cat: 'Проверка',
    desc: T('Проверяет ID через YouTube oEmbed: есть ли видео, название и канал. Нужен запуск через Запуск.bat.', 'Checks the ID through YouTube oEmbed: whether the video exists, its title and channel. Requires starting through the launcher (Запуск.bat / start.sh).'),
    params: [{ key: 'auto', label: T('Проверять автоматически', 'Check automatically'), type: 'bool', default: true }],
    compute([v]) {
      const id = G.API.extractYouTubeId(v);
      if (!id) throw new Error(T('Не найден 11-символьный YouTube ID', 'No 11-character YouTube ID found'));
      return id;
    },
    update(node, res, body, ui) {
      const box = body.querySelector('.special') || body.appendChild(h('div', 'special'));
      if (res.value === undefined) { box.innerHTML = ''; return; }
      const id = res.value;
      if (node.state.renderedFor === id && box.childElementCount) return;
      node.state.renderedFor = id;
      box.innerHTML = '';
      const btn = h('button', 'btn small', T('Проверить ', 'Check ') + id);
      const out = h('div', 'yt-result');
      box.append(btn, out);
      const check = async () => {
        out.innerHTML = '';
        out.appendChild(h('div', 'muted', T('Проверяю…', 'Checking…')));
        const r = await G.API.youtube(id);
        if (node.state.renderedFor !== id) return;
        out.innerHTML = '';
        out.appendChild(ui.youtubeCard(id, r));
      };
      btn.onclick = check;
      // Сервер мог ещё не ответить на ping при первой отрисовке — дождёмся.
      Promise.resolve(G.API.ready).then(() => { if (node.params.auto && G.API.online && node.state.renderedFor === id) check(); });
    },
  };

  NT.mask = {
    name: T('Перебор маски ID', 'ID mask brute force'), cat: 'Проверка', inputs: [T('маска', 'mask')], noInputOk: true, wide: true,
    desc: T('Пропуски «_» или «?» заполняются символами из набора, каждый вариант проверяется через YouTube. Пример: _y_xPVyp_H_.', 'Gaps “_” or “?” are filled with characters from the set; every variant is checked through YouTube. Example: _y_xPVyp_H_.'),
    params: [
      { key: 'mask', label: T('Маска (если вход не подключён)', 'Mask (if no input is connected)'), type: 'text', default: '?y?xPVyp8H0' },
      { key: 'wild', label: T('Символы-пропуски', 'Gap characters'), type: 'text', default: '_?' },
      { key: 'charset', label: T('Набор', 'Set'), type: 'select', options: [['b64url', T('Все символы ID (64)', 'All ID characters (64)')], ['alnum', T('Буквы и цифры (62)', 'Letters and digits (62)')], ['lower', 'a–z'], ['upper', 'A–Z'], ['digits', '0–9'], ['custom', T('Свой', 'Custom')]], default: 'b64url' },
      { key: 'custom', label: T('Свой набор', 'Custom set'), type: 'text', default: '' },
      { key: 'stop', label: T('Остановиться на первой находке', 'Stop at the first hit'), type: 'bool', default: true },
      // Найденный ID сохраняется вместе с отпечатком маски+набора+пропусков, чтобы устаревшая находка не подставлялась.
      { key: 'found', label: '', type: 'hidden', default: '' },
      { key: 'foundFor', label: '', type: 'hidden', default: '' },
    ],
    compute([v], p, node) {
      const mask = (v !== undefined ? v : p.mask).trim();
      const slots = Array.from(mask).filter((ch) => p.wild.includes(ch)).length;
      const set = p.charset === 'custom' ? p.custom : CHARSETS[p.charset];
      const sig = maskSignature(mask, p);
      node.state.plan = { mask, slots, set, total: Math.pow(set.length, slots), sig };
      if (node.state.hits && node.state.hits.length && node.state.hitsFor === sig) return node.state.hits[0].id;
      if (p.found && p.foundFor === sig) return p.found;
      return undefined;
    },
    update(node, res, body, ui) {
      const box = body.querySelector('.special') || body.appendChild(h('div', 'special'));
      const plan = node.state.plan;
      if (!box.childElementCount) {
        node.state.ui = {
          info: h('div', 'muted'), btn: h('button', 'btn small accent', T('Запустить перебор', 'Start brute force')),
          bar: h('div', 'progress'), hits: h('div', 'hits'),
        };
        node.state.ui.bar.appendChild(h('div', 'progress-fill'));
        box.append(node.state.ui.info, node.state.ui.btn, node.state.ui.bar, node.state.ui.hits);
        node.state.ui.btn.onclick = () => (node.state.running ? (node.state.cancel = true) : runMask(node, ui));
      }
      if (plan && !node.state.running) {
        const base = plan.slots ? T(`Пропусков: ${plan.slots}, вариантов: ${plan.total.toLocaleString('ru-RU')}`, `Gaps: ${plan.slots}, variants: ${plan.total.toLocaleString('en-US')}`) : T('В маске нет пропусков', 'The mask has no gaps');
        const saved = node.params.found && node.params.foundFor === plan.sig ? T('Сохранённая находка: ', 'Saved hit: ') + node.params.found : '';
        node.state.ui.info.textContent = node.state.hitsFor === plan.sig && node.state.summary ? node.state.summary : (saved || base);
      }
    },
  };

  async function runMask(node, ui) {
    const { mask, slots, set, total, sig } = node.state.plan;
    const u = node.state.ui;
    if (!slots) return;
    if (!G.API.online) { ui.toast(T('Проверка ссылок работает только при запуске через Запуск.bat', 'Link checking works only when started through the launcher (Запуск.bat / start.sh)')); return; }
    if (total > MASK_LIMIT) { ui.toast(T('Слишком много вариантов (' + total.toLocaleString('ru-RU') + '). Сузь маску или набор символов.', 'Too many variants (' + total.toLocaleString('en-US') + '). Narrow the mask or the character set.')); return; }
    if (total > MASK_CONFIRM && !confirm(T(`Будет ${total.toLocaleString('ru-RU')} запросов к YouTube. Это долго. Продолжить?`, `That will be ${total.toLocaleString('en-US')} requests to YouTube. It is slow. Continue?`))) return;
    node.state.running = true;
    node.state.cancel = false;
    node.state.hits = [];
    node.state.hitsFor = sig;
    u.hits.innerHTML = '';
    u.btn.textContent = T('Остановить', 'Stop');
    const chars = Array.from(mask);
    const slotPos = chars.map((ch, i) => (node.params.wild.includes(ch) ? i : -1)).filter((i) => i >= 0);
    let next = 0, finished = 0;
    const candidate = (n) => {
      const c = chars.slice();
      for (let k = slotPos.length - 1; k >= 0; k--) { c[slotPos[k]] = set[n % set.length]; n = Math.floor(n / set.length); }
      return c.join('');
    };
    const worker = async () => {
      while (next < total && !node.state.cancel) {
        const id = candidate(next++);
        const r = await G.API.youtube(id);
        finished++;
        if (r.status === 'found') {
          node.state.hits.push({ id, r });
          u.hits.appendChild(ui.youtubeCard(id, r));
          if (node.params.stop) node.state.cancel = true;
        }
        u.bar.firstChild.style.width = (100 * finished / total).toFixed(1) + '%';
        u.info.textContent = T(`Проверено ${finished.toLocaleString('ru-RU')} из ${total.toLocaleString('ru-RU')}, найдено: ${node.state.hits.length}`, `Checked ${finished.toLocaleString('en-US')} of ${total.toLocaleString('en-US')}, found: ${node.state.hits.length}`);
      }
    };
    await Promise.all(Array.from({ length: MASK_WORKERS }, worker));
    node.state.running = false;
    node.state.summary = u.info.textContent;
    u.btn.textContent = T('Запустить перебор', 'Start brute force');
    if (node.state.hits.length) {
      node.params.found = node.state.hits[0].id;
      node.params.foundFor = sig;
    } else u.hits.appendChild(h('div', 'muted', node.state.cancel ? T('Остановлено.', 'Stopped.') : T('Ни одного доступного видео. Это не доказывает, что видео не существовало.', 'No available videos. This does not prove the video never existed.')));
    ui.requestEval();
  }

  // ---------- Авто-расшифровка ----------
  const PICK_PARAMS = [
    { key: 'picked', label: '', type: 'hidden', default: '' },
    { key: 'pickedFor', label: '', type: 'hidden', default: '' },
    { key: 'pickedChain', label: '', type: 'hidden', default: '' },
  ];

  // Выбранный результат живёт в params (сохраняется с графом); state — только кэш текущего сеанса.
  function pickedOutput(v, p, node) {
    const fp = v === undefined ? '' : fingerprint(v);
    if (node.state.resultsFor !== v && p.pickedFor !== fp) { node.state.results = null; node.state.selected = null; node.state.pick = 0; }
    node.state.input = v;
    if (node.state.selected != null) return node.state.selected;
    return p.picked && p.pickedFor === fp ? p.picked : undefined;
  }

  function storePick(node, input, text, chain) {
    node.params.picked = text;
    node.params.pickedFor = fingerprint(input);
    node.params.pickedChain = JSON.stringify(chain || []);
  }

  NT.auto = {
    name: T('Авто-расшифровка', 'Auto-decrypt'), cat: 'Авто', wide: true,
    desc: T('Перебирает цепочки известных приёмов и показывает лучшие результаты (профиль расследования и ключи проекта учитываются). Клик по результату — выбрать, «В граф» — развернуть цепочку нодами. Если убедительного результата нет, нода так и скажет.', 'Tries chains of known techniques and shows the best results (the investigation profile and project keys are taken into account). Click a result to pick it, “To graph” expands the chain into nodes. If nothing is convincing, the node says so.'),
    params: [{ key: 'depth', label: T('Глубина', 'Depth'), type: 'select', options: [['2', T('Быстро (2 шага)', 'Fast (2 steps)')], ['3', T('Обычно (3 шага)', 'Normal (3 steps)')], ['4', T('Глубоко (4 шага)', 'Deep (4 steps)')]], default: '3' }].concat(PICK_PARAMS),
    compute([v], p, node) { return pickedOutput(v, p, node); },
    update(node, res, body, ui) {
      const box = body.querySelector('.special') || body.appendChild(h('div', 'special'));
      if (!box.childElementCount) {
        node.state.ui = { btn: h('button', 'btn small accent', T('⚡ Расшифровать', '⚡ Decrypt')), status: h('div', 'muted'), list: h('div', 'auto-list') };
        box.append(node.state.ui.btn, node.state.ui.status, node.state.ui.list);
        node.state.ui.btn.onclick = () => runAuto(node, ui);
      }
      const u = node.state.ui;
      if (!node.state.results && !node.state.running) {
        u.list.innerHTML = '';
        const restored = res.value !== undefined && node.params.picked ? T('Выбранный результат сохранён: ', 'Saved pick: ') + String(node.params.picked).slice(0, 60) : '';
        u.status.textContent = restored || (node.state.input ? T('Нажми «Расшифровать»', 'Press “Decrypt”') : T('Подключи вход', 'Connect an input'));
      }
    },
  };

  async function runAuto(node, ui) {
    const u = node.state.ui;
    if (node.state.running) { node.state.cancel.stop = true; return; }
    const input = node.state.input;
    if (!input) { ui.toast(T('Сначала подключи к ноде текст', 'Connect some text to the node first')); return; }
    node.state.running = true;
    node.state.cancel = { stop: false };
    u.btn.textContent = T('■ Стоп', '■ Stop');
    const started = Date.now();
    const show = (results, final) => {
      node.state.results = results;
      node.state.resultsFor = input;
      const verdict = final && !results.confident ? ' · ' + ({ format: T('распознан только формат', 'only a format is recognised'), candidates: T('есть лишь вероятные варианты', 'only plausible candidates') }[results.verdict] || T('ответ не определён', 'answer not determined')) : '';
      u.status.textContent = (final ? T('Готово', 'Done') : T('Ищу…', 'Searching…')) + T(` · вариантов ${results.length} · `, ` · ${results.length} variants · `) + ((Date.now() - started) / 1000).toFixed(1) + T(' с', ' s') + verdict
        + (final && results.engines && G.SolverEngines && G.SolverEngines.describe(results.engines) ? ' · ' + G.SolverEngines.describe(results.engines) : '');
      ui.renderResults(u.list, results.slice(0, 12), { verdict: results.verdict,
        onPick: (r) => { node.state.selected = r.text; storePick(node, input, r.text, r.chain); ui.requestEval(); },
        onExpand: (r) => ui.materializeFromNode(node.id, r.chain),
        selected: node.state.selected,
      });
    };
    try {
      const results = await G.Solver.solve(input, { depth: Number(node.params.depth), beam: SOLVE_BEAM, timeLimit: SOLVE_TIME_MS, cancel: node.state.cancel }, (info) => show(info.results, false));
      show(results, true);
    } catch (e) {
      u.status.textContent = T('Ошибка поиска: ', 'Search error: ') + e.message;
    } finally {
      node.state.running = false;
      u.btn.textContent = T('⚡ Расшифровать', '⚡ Decrypt');
    }
  }

  // Результаты автоподбора в формате списка авто-расшифровки (для общих карточек и «В граф»).
  function vigRowsToResults(rows) {
    const NAMES = { vigenere: T('Виженер', 'Vigenère'), beaufort: T('Бофор', 'Beaufort'), variant: T('вариант Бофора', 'variant Beaufort') };
    // Лучший ключ = 100, остальные ниже на разницу в оценке (наты).
    const top = rows.length ? rows[0].final : 0;
    return rows.map((r) => ({
      text: r.plain, rank: 100 + (r.final - top), chain: [G.VigenereAuto.toChainStep(r)], words: [],
      tags: [T('ключ: ', 'key: ') + r.key, r.alphaLabel, NAMES[r.variant], T('слов: ', 'words: ') + r.words].concat(r.user ? [T('ключ проекта', 'project key')] : []),
    }));
  }

  function hintsText(hints) {
    if (!hints) return '';
    const ic = hints.ic.slice().sort((a, b) => b[1] - a[1]).slice(0, 3).map(([L, v]) => L + ' (' + v.toFixed(3) + ')').join(', ');
    const ks = hints.kasiski.map(([L, v]) => L + '×' + v).join(', ');
    return T('Подсказки длины ключа — индекс совпадений: ', 'Key-length hints — index of coincidence: ') + (ic || '—') + T('; Касиски: ', '; Kasiski: ') + (ks || T('повторов нет', 'no repeats'));
  }

  NT.vigcrack = {
    name: T('Автоподбор Виженера', 'Vigenère solver'), cat: 'Авто', wide: true,
    desc: T('Встроенный подбор Виженера без подсказок: короткий текст — полный перебор коротких ключей + словарь, длинный — частотный анализ с итерированным локальным поиском. Ключи вашего проекта проверяются напрямую и всегда остаются в списке. Все варианты алфавита сразу.', 'The built-in Vigenère solver, no hints needed: a short text gets full short-key brute force + a dictionary, a long one gets frequency analysis with iterated local search. Your project keys are tried directly and always stay in the list. All alphabet variants at once.'),
    params: [
      { key: 'engine', label: T('Движок', 'Engine'), type: 'select', options: [['auto', T('Авто: Python, если доступен', 'Auto: Python if available')], ['python', T('Python (полные словари, CUDA)', 'Python (full dictionaries, CUDA)')], ['browser', T('Браузер (без установки)', 'Browser (no install)')]], default: 'auto' },
      { key: 'mode', label: T('Стратегия (Python)', 'Strategy (Python)'), type: 'select', options: [['auto', T('Авто по длине текста', 'Auto by text length')], ['brute', T('Полный перебор', 'Full brute force')], ['freq', T('Частотный анализ', 'Frequency analysis')], ['dict', T('Словарь (все слова)', 'Dictionary (all words)')], ['hill', T('Восхождение на холм', 'Hill climbing')]], default: 'auto' },
      { key: 'variant', label: T('Шифр', 'Cipher'), type: 'select', options: [['vigenere', T('Виженер', 'Vigenère')], ['beaufort', T('Бофор', 'Beaufort')], ['variant', T('Вариант Бофора', 'Variant Beaufort')], ['all', T('Все три (браузер)', 'All three (browser)')]], default: 'vigenere' },
      { key: 'lang', label: T('Язык (Python)', 'Language (Python)'), type: 'select', options: [['auto', T('Авто', 'Auto')], ['ru', T('Русский', 'Russian')], ['uk', T('Украинский', 'Ukrainian')], ['en', T('Английский', 'English')]], default: 'auto' },
      { key: 'alpha', label: T('Алфавит (браузер)', 'Alphabet (browser)'), type: 'select', options: [['auto', T('Авто (по тексту)', 'Auto (from the text)')], ['en26', 'en-26'], ['ru33', T('ru-33 (с Ё)', 'ru-33 (with Ё)')], ['ru32', T('ru-32 (без Ё)', 'ru-32 (without Ё)')]], default: 'auto' },
      { key: 'maxLen', label: T('Макс. длина ключа (0 = авто)', 'Max key length (0 = auto)'), type: 'number', int: true, min: 0, max: 40, default: 0 },
      { key: 'gpu', label: T('Использовать видеокарту (CUDA)', 'Use the graphics card (CUDA)'), type: 'bool', default: true },
      { key: 'deep', label: T('Глубокий перебор в браузере (до 5 букв)', 'Deep browser brute force (up to 5 letters)'), type: 'bool', default: false },
    ].concat(PICK_PARAMS),
    compute([v], p, node) {
      const fp = v === undefined ? '' : fingerprint(v);
      if (node.state.resultsFor !== v && p.pickedFor !== fp) { node.state.results = null; node.state.pick = 0; }
      node.state.input = v;
      const r = node.state.results && node.state.results[node.state.pick || 0];
      if (r) return r.text;
      return p.picked && p.pickedFor === fp ? p.picked : undefined;
    },
    update(node, res, body, ui) {
      const box = body.querySelector('.special');
      if (!box.childElementCount) {
        node.state.ui = { btn: h('button', 'btn small accent', T('🔑 Подобрать ключ', '🔑 Find the key')), status: h('div', 'muted small'), hints: h('div', 'muted small'), list: h('div', 'auto-list') };
        box.append(node.state.ui.btn, node.state.ui.status, node.state.ui.hints, node.state.ui.list);
        node.state.ui.btn.onclick = () => runVig(node, ui);
      }
      if (!node.state.results && !node.state.running) {
        node.state.ui.list.innerHTML = '';
        node.state.ui.hints.textContent = '';
        const restored = res.value !== undefined && node.params.picked ? T('Выбранный результат сохранён: ', 'Saved pick: ') + String(node.params.picked).slice(0, 60) : '';
        node.state.ui.status.textContent = restored || (node.state.input ? T('Нажми «Подобрать ключ»', 'Press “Find the key”') : T('Подключи вход', 'Connect an input'));
      }
    },
  };

  async function runVig(node, ui) {
    const u = node.state.ui;
    if (node.state.running) { node.state.cancel.stop = true; return; }
    const input = node.state.input;
    if (!input) { ui.toast(T('Сначала подключи к ноде текст', 'Connect some text to the node first')); return; }
    const p = node.params;
    node.state.running = true;
    node.state.cancel = { stop: false };
    u.btn.textContent = T('■ Стоп', '■ Stop');
    const started = Date.now();
    const keys = G.Profiles ? G.Profiles.keys() : [];
    const show = (rows, stage) => {
      node.state.results = vigRowsToResults(rows);
      node.state.resultsFor = input;
      u.status.textContent = stage + ' · ' + ((Date.now() - started) / 1000).toFixed(1) + T(' с', ' s');
      ui.renderResults(u.list, node.state.results.slice(0, 10), {
        onPick: (r) => { node.state.pick = node.state.results.indexOf(r); storePick(node, input, r.text, r.chain); ui.requestEval(); },
        onExpand: (r) => ui.materializeFromNode(node.id, r.chain),
        selected: node.state.results[node.state.pick || 0] && node.state.results[node.state.pick || 0].text,
      });
    };
    try {
      const usePython = p.engine === 'python' || (p.engine === 'auto' && p.variant !== 'all' && await G.API.pythonEngine());
      if (p.engine === 'python' && !(await G.API.pythonEngine())) throw new Error(T('Python-движок недоступен — подробности во вкладке «Отладка»', 'The Python engine is unavailable — see the “Debug” tab'));
      let out;
      if (usePython) {
        out = await G.VigPython.run(input, { mode: p.mode, variant: p.variant, lang: p.lang, gpu: p.gpu, maxLen: Number(p.maxLen) || 20, keys, cancel: node.state.cancel },
          (info) => { show(info.rows, info.stage); u.hints.textContent = info.log.slice(-2).join(' · '); });
        u.hints.textContent = out.log.filter((l) => /индекс|Касиски|IC|Kasiski|длин|length/i.test(l)).slice(0, 2).join(' · ') + (out.truncated ? ' · ' + T('Ввод обрезан до ' + out.truncated.to + ' символов (было ' + out.truncated.from + ')', 'Input truncated to ' + out.truncated.to + ' characters (was ' + out.truncated.from + ')') : '');
        show(out.rows, (out.status === 'остановлено' ? T('Остановлено', 'Stopped') : T('Готово', 'Done')) + ' · Python, ' + (out.gpu ? 'GPU' : 'CPU')); // i18n-ok: данные
      } else {
        out = await G.VigenereAuto.run(input, {
          variants: p.variant === 'all' ? ['vigenere', 'beaufort', 'variant'] : [p.variant],
          alpha: p.alpha, maxLen: Number(p.maxLen) || undefined, bruteMax: p.deep ? 5 : 4, keys, cancel: node.state.cancel,
        }, (info) => show(info.rows, T('Браузер · ', 'Browser · ') + info.stage));
        u.hints.textContent = hintsText(out.hints);
        show(out.rows, (node.state.cancel.stop ? T('Остановлено', 'Stopped') : T('Готово', 'Done')) + T(' · браузер', ' · browser'));
      }
      node.state.pick = 0;
      ui.requestEval();
    } catch (e) {
      u.status.textContent = T('Ошибка: ', 'Error: ') + e.message;
    } finally {
      node.state.running = false;
      u.btn.textContent = T('🔑 Подобрать ключ', '🔑 Find the key');
    }
  }

  // Выбор результата так, как это делает клик по карточке (используется интерфейсом и тестами).
  NT.auto.pick = (node, input, result) => { node.state.selected = result.text; storePick(node, input, result.text, result.chain); };
  NT.vigcrack.pick = (node, input, result) => {
    node.state.results = [result]; node.state.resultsFor = input; node.state.pick = 0;
    storePick(node, input, result.text, result.chain);
  };

  G.vigRowsToResults = vigRowsToResults;
  G.vigHintsText = hintsText;

  NT.links = {
    name: T('Поиск ссылок', 'Link finder'), cat: 'Проверка', wide: true,
    desc: T('Находит ссылки (и «обезвреженные» hxxp, [.], перевёрнутые) и ID, похожие на YouTube, Drive, Catbox, Pastebin, Imgur… Выход — первая найденная ссылка.', 'Finds links (including defanged hxxp, [.] and reversed ones) and IDs that look like YouTube, Drive, Catbox, Pastebin, Imgur… The output is the first link found.'),
    params: [{ key: 'weak', label: T('Показывать слабые совпадения', 'Show weak matches'), type: 'bool', default: false }],
    compute([v], p, node) {
      node.state.found = G.Links.detect(v).filter((l) => p.weak || l.confidence >= 2);
      if (!node.state.found.length) throw new Error(T('Ссылок и похожих ID не найдено', 'No links or ID-like strings found'));
      return node.state.found[0].url;
    },
    update(node, res, body, ui) {
      const box = body.querySelector('.special');
      box.innerHTML = '';
      for (const l of (res.value !== undefined && node.state.found) || []) box.appendChild(ui.linkRow(l));
    },
  };

  for (const def of Object.values(NT)) if (!def.inputs) def.inputs = [T('вход', 'input')];
  // Другие пакеты добавляют свои ноды в G.NodeTypes до или после этого файла — не затираем их.
  G.NodeTypes = Object.assign(G.NodeTypes || {}, NT);
})(typeof self !== 'undefined' ? self : this);
