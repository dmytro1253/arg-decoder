// Авто-расшифровка: лучевой поиск по цепочкам операций с оценкой каждого результата.
// Работает в основном потоке кусками по ~25 мс, поэтому окно не зависает и не нужен Worker
// (Worker не запускается из file://).
//
// Принципы ранжирования (аудит 2026-10-19):
//  • ключи и «любимые» параметры учитываются только у активного профиля (у «neutral» их нет);
//  • лишний шаг-шифрование не получает награды без свидетельства: он должен заметно улучшить
//    читаемость по сравнению с предыдущим шагом;
//  • одинаковый текст показывается один раз — с самым простым объяснением (однобуквенный
//    Виженер = Цезарь);
//  • «как есть» (уже читаемый текст, прямая ссылка/ID) — отдельный кандидат;
//  • поиск честно говорит «убедительного результата нет» (result.confident === false);
//  • подготовка пробелов и вырезание кандидатов из логов — явные шаги цепочки.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const { OPS, BY_ID } = G.CipherOps;
  const Scorer = G.Scorer;
  const E = G.SolverEvidence;

  // Пары «операция → её обратная»: обратную сразу после прямой применять бессмысленно.
  const INVERSE = {
    hex_encode: 'hex_decode', hex_decode: 'hex_encode', base64_encode: 'base64_decode', base64_decode: 'base64_encode',
    text_encode: 'bytes_decode', bytes_decode: 'text_encode', url_encode: 'url_decode', url_decode: 'url_encode',
  };
  // Буквенные шифры к hex/цифрам/Base64 применять смысла нет — такие ветки только засоряют поиск.
  const LETTER_OPS = new Set(['acrostic', 'keyboard_shift', 'columnar', 'playfair', 'leet', 'homoglyph', 'char_shift', 'caesar', 'atbash', 'affine', 'vigenere', 'beaufort', 'autokey', 'rot47', 'layout', 'translit', 'rail_fence', 'transpose', 'reverse']);
  const STRUCTURED = new Set(['hex', 'digits', 'binary', 'base64', 'percent', 'morse']);
  const DECODE_OPS = new Set(['url_decode', 'bytes_decode', 'hex_decode', 'base64_decode', 'base32_decode', 'base85_decode', 'binary_decode', 'dec_codes', 'unescape', 'num_letters', 'decompress']);
  // Подстановки букв: две подряд почти никогда не нужны, а мусора дают очень много.
  const SUBSTITUTIONS = new Set(['caesar', 'atbash', 'affine', 'vigenere', 'beaufort', 'autokey', 'rot47', 'keyboard_shift', 'playfair']);
  // «Шифрования»: шаг, который надо оправдать улучшением читаемости.
  const TRANSFORMS = new Set([...SUBSTITUTIONS, 'reverse', 'rail_fence', 'transpose', 'columnar', 'swap_pairs', 'layout', 'translit', 'char_shift', 'xor']);
  // Перечитывания без ключа: тоже должны поднимать читаемость, иначе это лишний шаг.
  const REINTERPRET = new Set(['leet', 'ru_leet', 'homoglyph', 'acrostic', 'case_bits', 'mc_format', 'greek_translit']);
  const DECODE_BONUS = 30;
  const CONTAINER_BONUS = 40;
  const SHORT_GUESS_COST = 15;
  const KEYED = new Set(['vigenere', 'beaufort', 'autokey', 'playfair', 'columnar', 'xor']);
  const PREP = new Set(['ws_prep', 'extract_candidates']);
  // Операции, выдающие сырые байты: если там не ASCII, их тут же читают как текст.
  const BYTE_DECODERS = new Set(['base64_decode', 'hex_decode', 'base32_decode', 'base85_decode', 'binary_decode', 'octal_decode', 'xor', 'xor_keep', 'decompress']);
  // Сжатый слой (zlib/gzip с верной контрольной суммой) — тоже слой формата, его снимают сразу.
  const compressedLayer = (t) => !!(G.Decompress && G.Decompress.verified(t));
  const compressedHeader = (t) => !!(G.Decompress && G.Decompress.headerKind(t));
  // Цена объяснения: чем проще шаг, тем выше он стоит в выдаче при прочих равных.
  const STEP_COST = { ws_prep: 0.8, extract_candidates: 0.5, affine: 2, rail_fence: 2, transpose: 2, playfair: 2, columnar: 2, rot47: 1.3, autokey: 1.5, beaufort: 1.5 };
  const COST_WEIGHT = 5;
  const COVER_DECAY = 20;          // букв, покрытых словами, за которые штраф свободы уменьшается в e раз
  const FREEDOM_WEIGHT = 2;       // очков за бит свободы параметров операции
  const AS_IS_BONUS = 5;
  const EXPR_RANK = 90;            // точно посчитанное выражение
  const FORMAT_RANK = 40;          // распознанный формат без открытого текста (хеш, токен)
  const USER_KEY_ID_BONUS = 18;
  const MIN_TRANSFORMED_LETTERS = 8;
  const EXTRACT_MAX_COVER = 0.6;   // кандидаты вырезаются, только если это не почти весь текст
  const GAIN_MIN = 0.12;          // насколько должна вырасти читаемость после шифрования
  const GAIN_PENALTY = 25;
  const SLICE_MS = 25;
  const MAX_RESULTS = 300;
  const MAX_ROOTS = 12;
  const CRACK_MIN_LETTERS = 30;
  const CRACK_BITS_PER_LETTER = 3;
  // Внешние движки: бюджет времени и поправка на множественные сравнения для найденного ключа.
  const ENGINE_BUDGET_MS = 20000;
  const ENGINE_MIN_MS = 3000;
  const ENGINE_BITS_PER_LETTER = 3;
  const ENGINE_BASE_BITS = 10;
  const ENGINE_CONTINUE = 4;
  const ENGINE_LAYERS = 2;          // сколько промежуточных состояний отдать Python-подбору сверх самого входа
  const UNICITY_LETTERS = 3;
  // Составные сообщения и перестановки.
  const SEGMENT_DEPTH = 2;
  const SEGMENT_BEAM = 80;
  const SEGMENT_MS = 4000;
  const SEGMENT_BONUS = 15;
  const COLUMNAR_MS = 3000;
  const URL_CRIB_HYPOTHESES = 26;
  const INFLATED_MAX = 1048576;      // символов результата распаковки в авто-поиске  // 4 шпаргалки × до 8 длин ключа, с запасом
  const factorial = (n) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
  const UNDERDETERMINED_COST = 4;
  const CLASSIC_SHIFT_BONUS = 6;
  // Повторные декодеры (Base64 → Base64, hex(hex), %25XX): сколько раз подряд и насколько глубоко снимать слои заранее.
  const MAX_REPEAT = 4;
  const MAX_PEEL = 6;
  const PEEL_ORDER = ['url_decode', 'hex_decode', 'binary_decode', 'base64_decode', 'base32_decode', 'base85_decode'];
  const CONFIRM_LETTERS = 8;       // читаемый текст такой длины дальше не шифруют
  const SHAPE_BONUS = 1.5;         // заглавная в начале и точка в конце: порядок слов после реверса правдоподобнее
  const sentenceShape = (t) => {
    const s = String(t).trim();
    return (/^\p{Lu}/u.test(s) ? SHAPE_BONUS : 0) + (/[.!?…]$/.test(s) ? SHAPE_BONUS : 0) - (/^[.,;:!?…]/.test(s) ? 2 * SHAPE_BONUS : 0);
  };   // ROT13 и Цезарь ±3 встречаются в загадках чаще остальных сдвигов
  const alphaSize = (a) => (a === 'en' ? 26 : a === 'ru32' || a === 'uk32' ? 32 : 33);
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const PERMUTATIONS = new Set(['reverse', 'columnar', 'rail_fence', 'transpose', 'swap_pairs']);
  const AMBIGUOUS_MARGIN = 3;
  const anagramKey = (t) => Array.from(String(t).toLowerCase().replace(/[^\p{L}]/gu, '')).sort().join('');

  // Операция в авто-поиске получает те же значения по умолчанию, что и в графе: пробы задают только часть параметров.
  const DEFAULTS = new Map();
  function runOp(op, inputs, params) {
    if (!DEFAULTS.has(op.id)) DEFAULTS.set(op.id, Object.fromEntries(op.params.map((q) => [q.key, q.default])));
    return op.run(inputs, Object.assign({}, DEFAULTS.get(op.id), params));
  }

  const profileShift = (n) => {
    const shifts = (G.Profiles && G.Profiles.active().probeShifts) || [];
    return shifts.some((s) => Math.abs(s) === Math.abs(Number(n)));
  };
  const stepCost = (c) => {
    if (c.op === 'ws_prep' && c.params && c.params.mode === 'nospace') return 2.5;
    if (c.op === 'bytes_decode' && c.params && c.params.enc === 'utf8') return 0.3;   // чтение байтов как UTF-8 — часть шага декодера   // часть информации о словах теряется
    // «Магическая» константа без подсказки профиля — менее вероятное объяснение, чем прямое чтение.
    if (c.op === 'dec_codes' && Number(c.params.shift) !== 0 && !profileShift(c.params.shift)) return 3;
    if (c.op === 'char_shift' && !profileShift(c.params.n)) return 1.5;
    // Реверс по словам — более редкий вариант, чем реверс всей строки: при равной читаемости побеждает простой.
    if (c.op === 'reverse' && c.params && c.params.mode && c.params.mode !== 'all') return 1.6;
    return STEP_COST[c.op] || 1;
  };

  function bonuses() {
    const p = G.Profiles ? G.Profiles.active() : null;
    return (p && p.bonuses) || { favorites: 0, keywords: 0, becameId: 0 };
  }

  // Однобуквенный (или состоящий из одинаковых букв) ключ Виженера — это Цезарь: показываем простейшее.
  function canonicalStep(step, text) {
    if (step.op !== 'vigenere' || !G.CipherOps.keyShifts) return step;
    try {
      const { mode, shifts } = G.CipherOps.keyShifts(String(step.params.key), step.params.alpha || 'auto', text);
      if (!shifts.length || !shifts.every((s) => s === shifts[0])) return step;
      if (shifts[0] === 0) return step;
      return { op: 'caesar', params: { alpha: mode, n: step.params.dir === 'enc' ? shifts[0] : -shifts[0] } };
    } catch (e) {
      return step;
    }
  }

  const userKeyOf = (step) => {
    if (!KEYED.has(step.op) || !G.KeyBank || step.params.key === undefined) return null;
    return G.KeyBank.has(step.params.key) ? String(step.params.key).toLowerCase() : null;
  };

  function chainRank(item, parent, b) {
    const a = item.a;
    const chain = item.chain;
    const priors = chain.reduce((s, c) => s + (BY_ID[c.op].prior || 0), 0) / Math.max(1, chain.length);
    // Любимые параметры профиля (например, +23 у mslan) — бонус только если профиль их задаёт.
    const favorites = b.favorites ? chain.filter((c) => BY_ID[c.op].favorite && BY_ID[c.op].favorite(c.params)).length : 0;
    // Слой (числа, %HH, hex, Base64) снят начисто и дал буквы одного алфавита — это, скорее всего, верный путь.
    const cost = chain.reduce((s, c) => s + stepCost(c), 0);
    // Шифрование без свидетельства: читаемость почти не выросла по сравнению с родителем.
    let unjustified = 0;
    const last = chain[chain.length - 1];
    if (parent) unjustified = parent.unjustified || 0;              // каждый неоправданный шаг копится по цепочке
    // Профиль автора с «привычками» (b.favorites) прощает его любимые приёмы (реверс, Виженер…).
    // Ключевые подстановки привычкой не оправдываются: с произвольным ключом они дают что угодно; оправдание —
    // ключ из банка проекта, ссылка или ID на выходе.
    const keyedHabitOk = !KEYED.has(last.op) || item.userKey || a.hasLink || item.becameId;
    const habit = b.favorites > 0 && BY_ID[last.op] && BY_ID[last.op].prior >= 5 && keyedHabitOk;
    if (last && (TRANSFORMS.has(last.op) || REINTERPRET.has(last.op)) && parent && !habit) {
      // Оправдание шага: выросла читаемость или получился распознаваемый слой (%HH, hex, Base64…), которого не было.
      // Слоем считается и сжатый поток: XOR, давший заголовок zlib/gzip, — свидетельство (его проверит распаковка).
      const becameLayer = (Scorer.intermediateKind(item.text) && !Scorer.intermediateKind(parent.text)) || (compressedHeader(item.text) && !compressedHeader(parent.text));
      // Шаг, давший ссылку на весь вывод из того, что ссылкой не было (реверс, Цезарь над схемой), — тоже свидетельство.
      const becameLink = a.linkConfirmed && !parent.a.linkConfirmed;
      if (!becameLayer && !becameLink && a.natural - parent.a.natural < GAIN_MIN) unjustified += GAIN_PENALTY + (parent.a.readable || parent.a.hasLink ? GAIN_PENALTY : 0);
    }
    // Найденное в логе и расшифрованное до читаемого слова — это как раз то, что ищут.
    const extracted = chain[0] && chain[0].op === 'extract_candidates' && a.readable ? 25 : 0;
    // Ключ проекта, примененный прямо к строке и давший ID сервиса: пользователь выбрал ключ осознанно, результат нельзя терять в шуме.
    const userKey = item.userKey && a.readable ? 6 : (item.userKey && a.hasId && chain.length === 1 ? USER_KEY_ID_BONUS : 0);
    const becameId = item.becameId ? b.becameId : 0;
    // Чем больше вариантов параметров перебрано одной операцией, тем легче случайно получить «слово»:
    // поправка на множественные сравнения (ключи пользователя — осознанный выбор, их не штрафуем).
    const own = last && TRANSFORMS.has(last.op) && !item.userKey && item.probeN > 1 ? FREEDOM_WEIGHT * Math.log2(item.probeN) : 0;
    const freedom = own + (parent && parent.freedom ? parent.freedom : 0);       // копится по цепочке, как и неоправданность
    item.freedom = freedom;
    item.unjustified = unjustified;
    // Привычный автору профиля приём без ключа (реверс) поверх чисто снятых слоёв — половина бонуса декодирования.
    item.habitDecode = habit && parent && parent.deterministic !== false && !KEYED.has(last.op) && !SUBSTITUTIONS.has(last.op);
    // Штраф за множественные сравнения тает, когда текст длинный и покрыт словами: случайно 100 букв осмысленного
    // текста не получить, сколько ключей ни перебирай (иначе верный длинный Виженер с 24-буквенным ключом тонет).
    const covered = a.readable ? (a.letters || 0) * Math.max(0, Math.min(1, a.cover || 0)) : 0;   // только для читаемого
    const freedomPenalty = freedom * Math.exp(-covered / COVER_DECAY);
    const classic = last && last.op === 'caesar' && [3, 13, 23].includes(Math.abs(Number(last.params.n))) ? CLASSIC_SHIFT_BONUS : 0;
    // Перестановки сохраняют буквы, читаемость почти одинакова; порядок слов выдаёт форма предложения.
    const shape = last && (last.op === 'reverse' || last.op === 'columnar' || last.op === 'rail_fence' || last.op === 'transpose') && a.readable ? sentenceShape(item.text) : 0;
    return a.score + classic + shape + priors * 0.8 + favorites * b.favorites + becameId + extracted + userKey - COST_WEIGHT * Math.max(0, cost - 1) - unjustified - freedomPenalty;
  }

  // Статус и итоговый ранг: детерминированное снятие слоя до текста или структуры получает бонус и уверенность,
  // подбор параметров — только при сильном свидетельстве (см. solver-evidence.js).
  function settle(item) {
    const st = E.statusOf(item, FREEDOM_WEIGHT);
    item.status = st.status;
    item.evidence = st.evidence;
    item.reason = st.reason;
    // Бонус ранга за чистое снятие формата: и подтверждённому ответу, и точному декодированию без подтверждения —
    // но не выводу, который сам указывает на следующий слой (перевёрнутая ссылка, искажённая схема).
    item.cleanDecode = item.deterministic && (st.base === 'confident' || (st.base === 'decoded' && st.reason !== 'next-layer')) && item.chain.length > 0 && !item.asIs;
    if (item.cleanDecode) item.rank += DECODE_BONUS;
    else if (item.habitDecode) item.rank += DECODE_BONUS / 2;
    // Короткий выход угаданной цепочки не должен обгонять честное «как есть» или распознанный формат.
    if (!item.deterministic && !item.asIs && item.chain.length && (item.a.letters || 0) < 6) item.rank -= SHORT_GUESS_COST;
    // Распознанный контейнер — полезный отчёт о формате, даже если его байты выглядят шумом.
    if (item.kind === 'container') item.rank = Math.max(item.rank + CONTAINER_BONUS, FORMAT_RANK + 5);
    item.confident = st.status === 'confident';
    return item;
  }

  /**
   * @param {string} input
   * @param {{depth?:number, beam?:number, timeLimit?:number, cancel?:{stop:boolean}}} opts
   * @param {(info:{done:number, level:number, results:Array}) => void} onProgress
   * @returns {Promise<Array & {confident:boolean, threshold:number, asIs:boolean}>}
   */
  async function solve(input, opts, onProgress) {
    Scorer.init();
    const depth = opts.depth || 3;
    const beamWidth = opts.beam || 150;
    const deadline = Date.now() + (opts.timeLimit || 25000);
    const b = bonuses();
    const keywords = G.AuthorProfile && b.keywords ? G.AuthorProfile.keywords : [];
    const maxLen = Math.max(300, input.length * 5);
    const best = new Map();            // текст → лучший элемент (самое простое объяснение)
    let beam = [];
    let done = 0;
    let sliceStart = Date.now();
    const inputIsId = Scorer.looksLikeId(input.trim());

    const consider = (text, chain, next, parent, extra) => {
      // Распаковка законно раздувает текст в десятки раз: для цепочек с ней предел — размер результата распаковки.
      if (!text || text.length > (chain.some((c) => c.op === 'decompress') ? INFLATED_MAX : maxLen)) return null;
      if (chain.length && text === input) return null;
      // Защита от циклов: состояние, уже встречавшееся выше по этой же цепочке, ничего нового не даёт.
      for (let up = parent; up; up = up.up) if (up.text === text) return null;
      const src = parent ? parent.text : input;
      const step = canonicalStep(chain[chain.length - 1], src);
      const finalChain = chain.slice(0, -1).concat([step]);
      const a = Scorer.analyze(text, keywords);
      const becameId = !inputIsId && !(parent && Scorer.looksLikeId(parent.text.trim())) && Scorer.looksLikeId(text);
      // Детерминированность: каждый шаг снимал слой формата, в котором его вход действительно записан.
      const deterministic = extra && extra.deterministic !== undefined ? extra.deterministic : (!parent || parent.deterministic !== false) && E.formatStep(step, src);
      const coverage = extra && extra.coverage !== undefined ? extra.coverage : parent && parent.coverage;
      const container = /^Salted__/.test(text);
      const item = Object.assign({ up: parent && parent !== root ? parent : null, source: parent && parent.source, text, chain: finalChain, a, score: a.score, tags: a.tags, words: a.words, lang: a.lang, userKey: userKeyOf(chain[chain.length - 1]), becameId }, extra, { deterministic, coverage });
      if (container) {
        item.kind = 'container';
        item.tags = [T('контейнер OpenSSL Salted__: нужен пароль (нода OpenSSL)', 'OpenSSL Salted__ container: needs a password (OpenSSL node)')].concat(item.tags);
      }
      item.rank = chainRank(item, parent, b);
      item.potential = a.potential + (becameId ? 20 : 0) - item.unjustified * 0.8;
      settle(item);
      if (container) next = null;          // зашифрованный контейнер дальше без пароля не разобрать
      const old = best.get(text);
      if (old && old.rank >= item.rank - 1e-9) return null;
      if (old) old.dead = true;
      best.set(text, item);
      if (next) next.push(item);
      return item;
    };

    // Декодер выдал байты не из ASCII: чтение их как текста (UTF-8 / CP1251) — часть того же шага, а не новый уровень глубины.
    const considerBytesText = (out, chain, next, parent, opId, probeN) => {
      if (!BYTE_DECODERS.has(opId) || !/[\u0080-\u00ff]/.test(out)) return;
      const decoderOk = parent.deterministic !== false && E.formatStep(chain[chain.length - 1], parent.text);
      for (const enc of ['utf8', 'cp1251']) {
        let text;
        try { text = runOp(BY_ID.bytes_decode, [out], { enc }); } catch (e) { continue; }
        // Перечитать байты как CP1251 можно всегда; детерминированным это считается только для корректного UTF-8.
        const det = decoderOk && enc === 'utf8' && !text.includes('\ufffd');
        if (typeof text === 'string' && text !== out) consider(text, chain.concat([{ op: 'bytes_decode', params: { enc } }]), next, parent, { probeN, deterministic: det });
      }
    };

    // «Как есть»: уже читаемый текст, прямая ссылка или ID — преобразование не требуется.
    const inputA = Scorer.analyze(input, keywords);
    const asIs = (rank, extra) => {
      const item = Object.assign({ text: input, chain: [], a: inputA, score: inputA.score, tags: [T('как есть', 'as is')].concat(inputA.tags), words: inputA.words, lang: inputA.lang, asIs: true, becameId: false, userKey: null, potential: 0, unjustified: 0, deterministic: true }, extra);
      item.rank = rank;
      settle(item);
      best.set(input, item);
      return item;
    };
    if (inputA.readable || inputA.hasLink || inputA.hasId) asIs(inputA.score + AS_IS_BONUS);
    recognizeInput(input, inputA, asIs, best);

    const inputLen = Math.max(1, input.replace(/\s/g, '').length);
    const coverOf = (part) => part.replace(/\s/g, '').length / inputLen;

    // Корни поиска: сам текст и кандидаты, вырезанные из него (hex, Base64… в логе).
    const root = { text: input, chain: [], a: inputA, dead: false, unjustified: 0, deterministic: true };
    beam.push(root);
    // Одна длинная строка, перенесённая по ширине (OCR книги, скриншот): склеенный вариант — второй корень,
    // без траты шага глубины, иначе на «пары цифр → +23 → URL» шагов уже не хватает.
    if (G.TextPrep && G.TextPrep.wrappedToken(input.trim())) {
      const joined = input.replace(/\s+/g, '');
      const item = consider(joined, [{ op: 'ws_prep', params: { mode: 'nospace' } }], beam, root, {});
      if (item) item.tags = [T('строки склеены в одну', 'lines joined into one')].concat(item.tags);
    }
    if (G.Candidates && input.trim().length >= 20) {
      const total = input.trim().length;
      const all = G.Candidates.extract(input);
      const covered = all.reduce((sum, c) => sum + c.value.replace(/\s/g, '').length, 0);
      const cands = covered > EXTRACT_MAX_COVER * input.replace(/\s/g, '').length ? [] : all.filter((c) => c.value.length < total * 0.95);
      const order = { hex: 0, base64: 1, binary: 2, numbers: 3, digits: 4 };
      cands.filter((c) => c.kind in order).sort((x, y) => order[x.kind] - order[y.kind]).slice(0, MAX_ROOTS).forEach((c) => {
        const chain = [{ op: 'extract_candidates', params: { kind: c.kind, n: c.kindIndex } }];
        const item = consider(c.value, chain, beam, root, { source: { kind: c.kind, start: c.start, end: c.end, line: c.line, col: c.col }, coverage: coverOf(c.value) });
        if (item) item.tags = [T('из текста: ', 'from the text: ') + c.label + T(' · строка ', ' · line ') + c.line].concat(item.tags);
      });
      // Найденные ссылки и ID сервисов показываем сразу, без дальнейшего разбора.
      cands.filter((c) => c.kind === 'url' || c.kind === 'id').slice(0, MAX_ROOTS).forEach((c) => {
        const item = consider(c.value, [{ op: 'extract_candidates', params: { kind: c.kind, n: c.kindIndex } }], null, root, { source: { kind: c.kind, start: c.start, end: c.end, line: c.line, col: c.col }, coverage: coverOf(c.value) });
        if (item) item.tags = [T('из текста: ', 'from the text: ') + c.label + T(' · строка ', ' · line ') + c.line].concat(item.tags);
      });
    }

    // Слои настоящего формата снимаются сразу, сколько бы их ни было (Base64 в Base64, hex(hex), %25XX):
    // глубина поиска тратится на угадываемые шаги, а не на очевидные повторы. Остановка — на цикле или не-слое.
    const peel = (start) => {
      let cur = start;
      for (let i = 0; i < MAX_PEEL && (Scorer.intermediateKind(cur.text) || compressedLayer(cur.text)); i++) {
        const id = compressedLayer(cur.text) ? 'decompress' : PEEL_ORDER.find((x) => E.FORMAT[x] && E.FORMAT[x](cur.text) && BY_ID[x].probes && BY_ID[x].probes(cur.text, {}).length);
        if (!id) return;
        let out;
        try { out = runOp(BY_ID[id], [cur.text], {}); } catch (e) { return; }
        let chain = cur.chain.concat([{ op: id, params: {} }]);
        if (/[-ÿ]/.test(out) && BYTE_DECODERS.has(id)) {
          let utf;
          try { utf = runOp(BY_ID.bytes_decode, [out], { enc: 'utf8' }); } catch (e) { return; }
          if (utf.includes('�')) return;            // не текст: дальше разбирает обычный поиск
          out = utf;
          chain = chain.concat([{ op: 'bytes_decode', params: { enc: 'utf8' } }]);
        }
        // Формат входа проверен, байты — корректный UTF-8: оба шага детерминированы (UTF-8 — часть шага декодера).
        const item = consider(out, chain, beam, cur, { probeN: 1, deterministic: cur.deterministic !== false });
        if (!item) return;
        cur = item;
      }
    };
    peel(root);

    // Взлом Виженера без ключа — только для исходного текста с достаточным числом букв.
    if (G.VigenereCrack && G.CipherOps.letterCount(input) >= CRACK_MIN_LETTERS && !STRUCTURED.has(Scorer.intermediateKind(input))) {
      for (const c of G.VigenereCrack.crack(input, { maxKeyLen: 8, top: 3 })) {
        // Ключ выведен статистикой: ~3 бита выбора на букву ключа (поправка на множественные сравнения).
        consider(c.text, [{ op: 'vigenere', params: { key: c.key, dir: 'dec', alpha: c.alpha, skip: true } }], null, root, { probeN: Math.pow(2, CRACK_BITS_PER_LETTER * c.key.length) });
      }
    }

    // Полный Python-подбор Виженера стартует сразу и работает параллельно с браузерным поиском.
    const engineBudget = opts.engineBudget || ENGINE_BUDGET_MS;
    const engines = G.SolverEngines ? G.SolverEngines.queue({ engines: opts.engines, cancel: opts.cancel, budgetMs: engineBudget, keys: opts.engineKeys || (G.KeyBank ? G.KeyBank.values() : []).concat(G.Profiles ? G.Profiles.keys() || [] : []) }) : null;
    if (engines) engines.add(input, inputA, { parent: null });
    // Слои, снятые заранее (Base64 → буквы), уходят Python-подбору сразу: он работает параллельно с поиском.
    const queueLayers = () => {
      if (!engines || (opts.cancel && opts.cancel.stop)) return;
      const layers = [...best.values()].filter((x) => !x.dead && !x.asIs && x.deterministic && x.chain.length && (x.status === 'weak' || x.status === 'decoded') && x.a.cleanText)
        .sort((x, y) => y.rank - x.rank);
      for (const x of layers) { if (engines.size() > ENGINE_LAYERS) break; engines.add(x.text, x.a, { parent: x }); }
    };
    queueLayers();

    let aborted = false;
    const runLevels = async (from, to) => {
    for (let level = from; level < to && !aborted; level++) {
      const next = [];
      for (const state of beam) {
        if (state.dead) continue;
        const last = state.chain.length ? state.chain[state.chain.length - 1].op : null;
        const structured = STRUCTURED.has(Scorer.intermediateKind(state.text));
        const hasSubstitution = state.chain.some((c) => SUBSTITUTIONS.has(c.op));
        // Буквенные шифры имеют смысл, когда строка в основном из букв.
        const fewLetters = G.CipherOps.letterCount(state.text) < 0.6 * state.text.replace(/\s/g, '').length;
        // Подтверждённый текст дальше не шифруют. Короткое «слово», перевёрнутая ссылка или ссылка внутри
        // нечитаемого текста — ещё не ответ (ID сам по себе тоже: он мог быть зашифрован).
        const a = state.a;
        const settledText = a.linkConfirmed || (a.readable && (a.letters || 0) >= CONFIRM_LETTERS && (a.cover || 0) >= 0.6 && !a.reversedLink && !a.brokenLink);
        const transformed = state.chain.some((c) => TRANSFORMS.has(c.op));
        let repeats = 0;
        for (let i = state.chain.length - 1; i >= 0 && state.chain[i].op === last; i--) repeats++;
        for (const op of OPS) {
          if (!op.probes || INVERSE[op.id] === last) continue;
          // Та же операция подряд бессмысленна, кроме декодеров: Base64 внутри Base64 — обычный приём.
          if (op.id === last && (!DECODE_OPS.has(op.id) || repeats >= MAX_REPEAT)) continue;
          if (structured && LETTER_OPS.has(op.id)) continue;
          if (hasSubstitution && SUBSTITUTIONS.has(op.id)) continue;
          if (fewLetters && LETTER_OPS.has(op.id) && op.id !== 'char_shift' && op.id !== 'reverse') continue;
          if (settledText && TRANSFORMS.has(op.id)) continue;   // подтверждённое шифровать дальше незачем
          if (transformed && op.id === 'translit') continue;     // «по-русски» любую латинскую кашу не прочитать
          if (hasSubstitution && op.id === 'layout') continue;   // раскладка после угаданной подстановки — бессмыслица, а «слов» даёт много
          let probes;
          try { probes = op.probes(state.text, { depth: level, chain: state.chain }); } catch (e) { probes = []; }
          for (const params of probes) {
            let out;
            try { out = runOp(op, [state.text], params); } catch (e) { continue; }
            done++;
            if (typeof out === 'string') {
              const chain = state.chain.concat([{ op: op.id, params }]);
              consider(out, chain, next, state, { probeN: probes.length });
              considerBytesText(out, chain, next, state, op.id, probes.length);
            }
            if (Date.now() - sliceStart > SLICE_MS) {
              await tick();
              sliceStart = Date.now();
              if ((opts.cancel && opts.cancel.stop) || Date.now() > deadline) { aborted = true; break; }
            }
          }
          if (aborted) break;
        }
        if (aborted) break;
      }
      // В следующий уровень идут самые перспективные: похожие на текст или на промежуточный слой.
      // Не больше четверти луча от одной операции, чтобы 25 сдвигов Цезаря не вытеснили всё остальное.
      next.sort((x, y) => y.potential - x.potential);
      const perOp = new Map();
      const cap = Math.max(8, Math.floor(beamWidth / 4));
      beam = [];
      for (const item of next) {
        if (item.dead) continue;
        const op = item.chain[item.chain.length - 1].op;
        const used = perOp.get(op) || 0;
        if (used >= cap) continue;
        perOp.set(op, used + 1);
        beam.push(item);
        if (beam.length >= beamWidth) break;
      }
      if (onProgress) onProgress({ done, level: level + 1, results: finish(best) });
      if (!beam.length) break;
    }
    };
    await runLevels(0, depth);

    // Схемы, которые не сводятся к одной операции: разные строки по-разному и неизвестная перестановка столбцов.
    if (G.SolverCrackers && !aborted) await runCrackers();

    async function runCrackers() {
      const C = G.SolverCrackers;
      if (opts.segments !== false) {
        const seg = await C.segments(input, (line) => solve(line, { depth: Math.min(depth, SEGMENT_DEPTH), beam: SEGMENT_BEAM, timeLimit: SEGMENT_MS, cancel: opts.cancel, engines: false, segments: false, crackers: false }));
        if (seg) {
          const a = Scorer.analyze(seg.text, keywords);
          const changed = seg.picked.filter((x) => x.chain && x.chain.length);
          const quiet = seg.picked.filter((x) => !(x.chain && x.chain.length) && x.status !== 'blank');
          // Составное решение принимаем, только если каждая изменённая строка расшифрована уверенно.
          const statusOf = !changed.every((x) => x.status === 'confident') ? 'weak'
            : quiet.every((x) => x.status === 'confident' || x.status === 'likely') ? 'confident' : 'likely';
          // Части, которые сами не читаются, — не составное решение, а шум.
          const item = statusOf === 'weak' ? null : { text: seg.text, chain: [{ op: 'segment_map', params: { plan: seg.plan } }], a, score: a.score, tags: [T('составное: строки решены по отдельности', 'compound: lines solved separately')].concat(a.tags), words: a.words, lang: a.lang, deterministic: false, potential: 0, unjustified: 0, freedom: changed.reduce((sum, x) => sum + (x.freedom || 0), 0), userKey: null, segmentStatus: statusOf };
          if (item) {
            item.rank = a.score + SEGMENT_BONUS - COST_WEIGHT * Math.max(0, changed.length - 1);
            settle(item);
            const old = best.get(item.text);
            if (!old || old.rank < item.rank) { if (old) old.dead = true; best.set(item.text, item); }
          }
        }
      }
      const hint = opts.crackers !== false && C.looksTransposed(input);
      if (hint) {
        const found = await C.crackColumnar(input, { lang: hint.lang, budgetMs: Math.min(COLUMNAR_MS, Math.max(500, deadline - Date.now())), cancel: opts.cancel });
        for (const c of found) {
          const item = consider(c.text, [{ op: 'columnar', params: { key: c.key, dir: 'dec' } }], null, root, { probeN: factorial(c.cols) });
          if (item) item.tags = [T('подбор порядка столбцов: ', 'column order search: ') + c.cols + T(' столбцов', ' columns')].concat(item.tags);
        }
      }
      // Виженер над ссылкой: ключ из известного начала адреса (https://www.…), проверка — вся расшифровка ссылка.
      if (opts.crackers !== false && inputA.brokenLink) {
        for (const c of C.crackVigenereUrl(input)) {
          // Свобода — число согласованных гипотез (длины ключа × шпаргалки), а не 26^L: ключ выведен, не перебран.
          const item = consider(c.text, [{ op: 'vigenere', params: { key: c.key, dir: 'dec', alpha: 'en', skip: true } }], null, root, { probeN: 2 * URL_CRIB_HYPOTHESES });
          if (item) item.tags = [T('ключ из известного начала ссылки: ', 'key from the known start of the link: ') + c.crib].concat(item.tags);
        }
      }
      // Перемешанная ссылка: порядок столбцов ищется по формату адреса, а не по языку.
      if (opts.crackers !== false && C.urlAnagram(input)) {
        const found = await C.crackColumnarUrl(input, { budgetMs: Math.min(COLUMNAR_MS, Math.max(500, deadline - Date.now())), cancel: opts.cancel });
        for (const c of found) {
          // Свобода — число порядков, совместимых со схемой, а не L!: схема уже отсекла остальные.
          const item = consider(c.text, [{ op: 'columnar', params: { key: c.key, dir: 'dec' } }], null, root, { probeN: Math.max(2, found.length * c.ids) });
          if (item) item.tags = [T('порядок столбцов по формату ссылки: ', 'column order from the link format: ') + c.cols + T(' столбцов', ' columns')].concat(item.tags);
        }
      }
    }

    // Кандидаты внешних движков: тот же анализ и статус, происхождение и ещё один уровень цепочки от лучших.
    const reports = [];
    if (engines) {
      // Промежуточные буквенные слои, найденные лучевым поиском, — тоже в очередь (даже если поиск упёрся во время).
      queueLayers();
      const budget = Math.max(ENGINE_MIN_MS, Math.min(engineBudget, deadline - Date.now()));
      const { rows, reports: engineReports } = await engines.wait(budget);
      reports.push(...engineReports);
      const fresh = [];
      for (const r of rows) {
        const parent = r.meta && r.meta.parent;
        const step = { op: 'vigenere', params: { key: r.key, dir: 'dec', alpha: r.alpha, skip: true } };
        let text;
        try { text = runOp(BY_ID.vigenere, [parent ? parent.text : input], step.params); } catch (e) { continue; }   // текст заново той же операцией графа: точные пробелы и регистр
        const bits = Math.min(r.keylen * Math.log2(alphaSize(r.alpha)), ENGINE_BITS_PER_LETTER * r.keylen + ENGINE_BASE_BITS);
        const item = consider(text, (parent ? parent.chain : []).concat([step]), fresh, parent || root, { probeN: Math.pow(2, bits), provenance: { engine: r.engine, key: r.key, alpha: r.alphaLabel, variant: r.variant, ms: r.ms, layer: parent ? describeChain(parent.chain) : null } });
        if (!item) continue;
        item.tags = [T('Python-подбор Виженера: ключ ', 'Python Vigenère solver: key ') + r.key].concat(item.tags);
        // Меньше ~3 букв текста на букву ключа — ключ недоопределён: подходит почти любое слово.
        const short = UNICITY_LETTERS * r.keylen - (item.a.letters || 0);
        if (short > 0) {
          item.rank -= UNDERDETERMINED_COST * short;
          if (item.status === 'confident') { item.status = 'likely'; item.confident = false; }
          item.tags.push(T('ключ недоопределён: мало букв на длину ключа', 'key underdetermined: too few letters for the key length'));
        }
      }
      if (fresh.length && !aborted && Date.now() < deadline) {
        beam = fresh.slice(0, ENGINE_CONTINUE);
        await runLevels(0, 1);
      }
    }
    const result = finish(best);
    result.engines = reports;
    return result;
  }

  // Вход, который сам по себе — не шифртекст: выражение (считаем точно), хеш-дайджест, непрозрачный токен.
  // Такие результаты не ищут «слов»: выражение даёт число, дайджест и токен показываются как есть с пояснением.
  function recognizeInput(input, inputA, asIs, best) {
    const expr = E.expression(input);
    if (expr) {
      const a = Scorer.analyze(expr.value, []);
      const item = { text: expr.value, chain: [{ op: 'calc', params: { mode: 'value' } }], a, score: a.score, tags: [T('выражение посчитано точно', 'expression evaluated exactly')], words: [], lang: null, kind: 'number', deterministic: true, potential: 0, unjustified: 0, freedom: 0, userKey: null };
      item.rank = EXPR_RANK;
      settle(item);
      best.set(item.text, item);
    }
    const hash = E.digest(input);
    if (hash) asIs(FORMAT_RANK, { kind: 'hash', tags: [T('похоже на хеш: ', 'looks like a hash: ') + hash, T('сверь кандидатов нодой «Проверка хеша»', 'check candidates with the Hash check node')] });
    else if (!expr && E.token(input, inputA)) asIs(FORMAT_RANK - 10, { kind: 'token', tags: [T('идентификатор или пароль: оставить как есть', 'an identifier or password: keep as is')] });
  }

  // Итог: лучшие 300 + лучший результат для каждого ключа проекта (чтобы он не потерялся).
  function finish(best) {
    const live = [...best.values()].filter((x) => !x.dead);
    // Есть уверенное решение всего входа — куски входа показываются ниже него (в логе без такого решения они наверху).
    const whole = live.filter((x) => x.status === 'confident').reduce((m, x) => Math.max(m, x.rank), -Infinity);
    if (whole > -Infinity) for (const x of live) if (x.status === 'fragment' && x.rank >= whole) x.rank = whole - 0.5;
    const all = live.sort((x, y) => y.rank - x.rank);
    // Две перестановки одних и тех же букв читаются почти одинаково (реверс всей строки и по словам у списка слов):
    // выбрать порядок нечем, поэтому лидер не «уверенный», а «вероятный», с пометкой.
    const top0 = all[0];
    if (top0 && top0.status === 'confident' && top0.chain.some((c) => PERMUTATIONS.has(c.op))) {
      const key = anagramKey(top0.text);
      const rival = all.slice(1, 12).find((x) => x.a && x.a.readable && x.rank >= top0.rank - AMBIGUOUS_MARGIN && anagramKey(x.text) === key);
      if (rival) {
        for (const x of [top0, rival]) {
          if (x.status === 'confident') { x.status = 'likely'; x.confident = false; }
          x.tags = [T('неоднозначно: другой порядок тех же слов читается так же', 'ambiguous: another order of the same words reads as well')].concat(x.tags);
        }
      }
    }
    const out = all.slice(0, MAX_RESULTS);
    const pinned = new Map();
    for (const x of all.slice(MAX_RESULTS)) if (x.userKey && !pinned.has(x.userKey)) pinned.set(x.userKey, x);
    for (const x of out) if (x.userKey) pinned.delete(x.userKey);
    out.push(...pinned.values());
    const top = out[0];
    out.confident = !!(top && top.confident);
    out.verdict = E.verdictOf(top);
    out.threshold = GAIN_MIN;
    out.asIs = !!(top && top.asIs);
    return out;
  }

  function describeChain(chain) {
    if (!chain.length) return T('без преобразований', 'no transformation');
    return chain.map((c) => {
      const op = BY_ID[c.op];
      if (c.op === 'segment_map' && G.SolverCrackers) return op.name + ' (' + G.SolverCrackers.describePlan(c.params.plan, describeChain) + ')';
      // Пустые текстовые параметры («свой алфавит», ключ со входа) в описании не показываем.
      const parts = op.params.filter((p) => c.params[p.key] !== undefined && c.params[p.key] !== '' && p.type !== 'bool' && p.type !== 'hidden').map((p) => {
        const v = c.params[p.key];
        if (p.type === 'select') { const o = p.options.find((x) => x[0] === String(v)); return o ? o[1] : v; }
        return v;
      });
      return op.name + (parts.length ? ' (' + parts.join(', ') + ')' : '');
    }).join(' → ');
  }

  G.Solver = { solve, describeChain, canonicalStep };
})(typeof self !== 'undefined' ? self : this);
