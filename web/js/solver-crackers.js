// Поиск схем, которые лучевой поиск по одной операции не находит (аудит 2026-10-23):
//  • составное сообщение — разные строки зашифрованы по-разному (KF-01: текст Caesar −3, путь Caesar −6):
//    каждая строка решается отдельно, части собираются с исходными переводами строк операцией «Части по строкам»;
//  • неизвестная перестановка столбцов: частоты букв как у языка, а порядок нет — подбор порядка столбцов
//    восхождением по квадграммам, ответ воспроизводится обычной нодой «Перестановка столбцов по ключу».
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const MAX_LINES = 12;
  const MIN_COLS = 2;
  const MAX_COLS = 14;
  const SLICE_MS = 20;
  const RERANK = 60;
  const SHAPE_BONUS = 0.02;
  const tick = () => new Promise((r) => setTimeout(r, 0));

  const DEFAULTS = new Map();
  function runStep(step, text) {
    const op = G.CipherOps.BY_ID[step.op];
    if (!op) throw new Error(T('Неизвестная операция: ', 'Unknown operation: ') + step.op);
    if (!DEFAULTS.has(op.id)) DEFAULTS.set(op.id, Object.fromEntries(op.params.map((q) => [q.key, q.default])));
    return op.run([text], Object.assign({}, DEFAULTS.get(op.id), step.params));
  }
  const runChain = (chain, text) => chain.reduce((t, step) => runStep(step, t), text);

  /** Разбивка по строкам с сохранением разделителей: ['a', '\n', 'b']. */
  const splitLines = (text) => String(text).split(/(\r\n|\r|\n)/);

  // ---------- операция графа: разные цепочки для разных строк ----------
  G.CipherOps.def({
    id: 'segment_map', name: T('Части по строкам: свои преобразования', 'Parts by line: own transformations'), cat: 'Объединение', prior: 0,
    desc: T('Каждая строка входа проходит свою цепочку операций (план — JSON: по элементу на строку, null — оставить как есть); переводы строк сохраняются. Так авто-поиск записывает составные сообщения.',
      'Each input line goes through its own chain of operations (the plan is JSON: one item per line, null keeps the line); line breaks are kept. This is how the auto search records compound messages.'),
    params: [{ key: 'plan', label: T('План (JSON)', 'Plan (JSON)'), type: 'textarea', default: '[]' }],
    run([t], p) {
      let plan;
      try { plan = JSON.parse(p.plan || '[]'); } catch (e) { throw new Error(T('План — неверный JSON', 'The plan is not valid JSON')); }
      if (!Array.isArray(plan)) throw new Error(T('План должен быть массивом', 'The plan must be an array'));
      const parts = splitLines(t);
      let line = 0;
      return parts.map((part, i) => {
        if (i % 2) return part;                 // разделитель строк
        const chain = plan[line++];
        return Array.isArray(chain) && chain.length ? runChain(chain, part) : part;
      }).join('');
    },
  });

  /** Описание плана для выдачи: «строка 1: Caesar (…); строка 2: …». */
  function describePlan(planJson, describeChain) {
    try {
      return JSON.parse(planJson).map((c, i) => T('строка ', 'line ') + (i + 1) + ': ' + (Array.isArray(c) && c.length ? describeChain(c) : T('как есть', 'as is'))).join('; ');
    } catch (e) {
      return planJson;
    }
  }

  /**
   * Решает строки по отдельности. solveLine(text) → Promise<results> (выдача Solver.solve).
   * Возвращает { text, plan, statuses, ranks } или null, если строки не различаются по схеме.
   */
  async function segments(input, solveLine) {
    const parts = splitLines(input);
    const lines = parts.filter((_, i) => i % 2 === 0);
    if (lines.filter((l) => l.trim()).length < 2 || lines.length > MAX_LINES) return null;
    const plan = [];
    const picked = [];
    for (const line of lines) {
      if (!line.trim()) { plan.push(null); picked.push({ status: 'blank', rank: 0, text: line }); continue; }
      const res = await solveLine(line);
      const top = res.find((r) => r.status === 'confident' || r.status === 'likely');
      if (!top || !top.chain.length) { plan.push(null); picked.push({ status: top ? top.status : 'asis', rank: top ? top.rank : 0, text: line, chain: [] }); continue; }
      plan.push(top.chain);
      picked.push({ status: top.status, rank: top.rank, text: top.text, chain: top.chain, freedom: top.freedom || 0 });
    }
    const changed = picked.filter((x) => x.chain && x.chain.length);
    if (!changed.length) return null;
    const chains = new Set(changed.map((x) => JSON.stringify(x.chain)));
    if (chains.size < 2 && changed.length === lines.filter((l) => l.trim()).length) return null;   // одна схема на всё — это обычная цепочка
    const text = parts.map((part, i) => (i % 2 ? part : picked[i / 2].text)).join('');
    return { text, plan: JSON.stringify(plan), picked };
  }

  // ---------- взлом перестановки столбцов ----------
  /** Похоже на перестановку: частоты букв как у языка, а квадграммы — как у случайного порядка. */
  function looksTransposed(text) {
    const S = G.Scorer;
    S.init();
    // Язык — по алфавиту букв: латиница → en; кириллица с і/ї/є/ґ → uk, иначе ru (перестановка буквы не меняет).
    const lower = text.toLowerCase();
    const cyr = (lower.match(/[а-яёієїґ]/g) || []).length;
    const lang = cyr > (lower.match(/[a-z]/g) || []).length ? (/[ієїґ]/.test(lower) ? 'uk' : 'ru') : 'en';
    if (!G.LANG_DATA[lang]) return null;
    const alpha = G.LANG_DATA[lang].alphabet;
    const letters = Array.from(lower).filter((ch) => alpha.includes(ch));
    if (letters.length < 20 || text.length > 400) return null;
    if (letters.length < 0.6 * text.replace(/\s/g, '').length) return null;
    const mono = G.LANG_DATA[lang].mono;
    const counts = new Array(alpha.length).fill(0);
    for (const ch of letters) counts[alpha.indexOf(ch)]++;
    let chi = 0;
    for (let i = 0; i < alpha.length; i++) { const e = mono[i] * letters.length; chi += e > 0 ? ((counts[i] - e) ** 2) / e : 0; }
    const chiPerLetter = chi / letters.length;
    const q = S.quadNorm(text, lang).norm;
    // Подстановка ломает частоты (chi велик), перестановка их сохраняет; квадграммы у перестановки плохие.
    return chiPerLetter < 1.2 && q < 0.45 ? { lang, chi: chiPerLetter, q } : null;
  }

  // Небольшая подсказка формы фразы для равных по языку вариантов: начало с буквы, конец на .!?
  const sentenceShape = (t) => (/^[A-Za-zА-Яа-яЁё]/.test(t) ? SHAPE_BONUS : 0) + (/[.!?]$/.test(t) ? SHAPE_BONUS : 0);
  const keyOrder = (key) => Array.from(key).map((ch, i) => [ch, i]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1])).map((x) => x[1]);
  /** Детерминированный генератор (mulberry32) с зерном от текста. */
  function seeded(text) {
    let a = 0x9e3779b9;
    for (let i = 0; i < text.length; i++) a = Math.imul(a ^ text.charCodeAt(i), 0x85ebca6b) >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const keyFromOrder = (order) => { const key = new Array(order.length); order.forEach((col, j) => { key[col] = String.fromCharCode(97 + j); }); return key.join(''); };

  /**
   * Восхождение по порядку столбцов. Возвращает до top кандидатов { key, cols, text, score } (лучшие первыми).
   * opts: { budgetMs, cancel, maxCols, restarts }.
   */
  async function crackColumnar(text, opts) {
    const o = opts || {};
    const S = G.Scorer;
    S.init();
    const rand = seeded(text);   // воспроизводимо: один и тот же вход — тот же ход поиска
    const deadline = Date.now() + (o.budgetMs || 4000);
    const decrypt = (order) => runStep({ op: 'columnar', params: { key: keyFromOrder(order), dir: 'dec' } }, text);
    const lang = o.lang || 'en';
    const score = (t) => S.quadNorm(t, lang).norm;
    const found = new Map();
    let sliceStart = Date.now();
    const maxCols = Math.min(o.maxCols || MAX_COLS, Math.floor(Array.from(text).length / 2));
    outer:
    for (let restart = 0; restart < (o.restarts || Infinity); restart++) {
      for (let L = MIN_COLS; L <= maxCols; L++) {
        let order = Array.from({ length: L }, (_, i) => i);
        for (let i = L - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        let best = score(decrypt(order));
        let improved = true;
        while (improved) {
          improved = false;
          for (let i = 0; i < L && !improved; i++) for (let j = i + 1; j < L; j++) {
            const next = order.slice();
            [next[i], next[j]] = [next[j], next[i]];
            const s = score(decrypt(next));
            if (s > best + 1e-9) { best = s; order = next; improved = true; break; }
          }
          // Сдвиг блока столбцов: перестановка часто «почти правильная» с точностью до циклического сдвига.
          if (!improved) for (let k = 1; k < L; k++) {
            const next = order.slice(k).concat(order.slice(0, k));
            const s = score(decrypt(next));
            if (s > best + 1e-9) { best = s; order = next; improved = true; break; }
          }
          if (Date.now() - sliceStart > SLICE_MS) {
            await tick();
            sliceStart = Date.now();
            if ((o.cancel && o.cancel.stop) || Date.now() > deadline) break outer;
          }
        }
        const key = keyFromOrder(order);
        const prev = found.get(key);
        if (!prev || prev.score < best) found.set(key, { key, cols: L, text: decrypt(order), score: best });
      }
    }
    // Окончательно сравниваем лидеров полной оценкой (слова + квадграммы): у верного порядка слова целые.
    // Лидеров сравниваем вместе с циклическими сдвигами ключа: они дают тот же текст с «переехавшим» хвостом.
    const pool = new Map();
    for (const c of [...found.values()].sort((a, b) => b.score - a.score).slice(0, RERANK)) {
      // Сдвиг позиций столбцов (не порядка чтения) двигает открытый текст по кругу на символ.
      for (let k = 0; k < c.key.length; k++) {
        const key = c.key.slice(k) + c.key.slice(0, k);
        if (pool.has(key)) continue;
        const t = decrypt(keyOrder(key));
        pool.set(key, { key, cols: c.cols, text: t, score: score(t), natural: S.analyze(t).natural + sentenceShape(t) });
      }
    }
    return [...pool.values()].sort((a, b) => b.natural - a.natural || b.score - a.score).slice(0, o.top || 5);
  }

  // ---------- перестановка столбцов над ссылкой ----------
  // У адреса нет языковой статистики, зато есть формат: вывод начинается со схемы и целиком читается как ссылка.
  // Перебор с отсечением: столбец c (исходная позиция) содержит символы позиций c, c+L, c+2L…; первые столбцы
  // длиннее, если последняя строка неполная (как у обычной ноды «Перестановка столбцов по ключу»).
  const URL_PREFIXES = ['https://', 'http://'];
  const URL_MAX_SOLUTIONS = 4000;

  /** Символы входа — перемешанная ссылка: есть буквы схемы и «://», нет пробелов, связного «://» нет. */
  function urlAnagram(text) {
    const s = String(text).trim();
    if (s.length < 12 || s.length > 300 || /\s/.test(s) || s.includes('://')) return false;
    const need = { h: 1, t: 2, p: 1, ':': 1, '/': 2 };
    const counts = {};
    for (const ch of s.toLowerCase()) counts[ch] = (counts[ch] || 0) + 1;
    return Object.entries(need).every(([ch, n]) => (counts[ch] || 0) >= n);
  }

  /** Все порядки чтения столбцов ширины L, при которых расшифровка начинается с prefix (с ограничением числа решений). */
  function urlOrders(chars, L, prefix, limit, out) {
    const n = chars.length;
    const long = n % L;
    const lenOf = (c) => Math.floor(n / L) + (c < long ? 1 : 0);
    const used = new Array(L).fill(false);
    const order = [];
    const fits = (c, start) => {
      for (let p = c; p < prefix.length; p += L) if (chars[start + (p - c) / L] !== prefix[p]) return false;
      return true;
    };
    const walk = (offset) => {
      if (out.length >= limit) return;
      if (order.length === L) { out.push(order.slice()); return; }
      for (let c = 0; c < L; c++) {
        if (used[c] || !fits(c, offset)) continue;
        used[c] = true; order.push(c);
        walk(offset + lenOf(c));
        used[c] = false; order.pop();
      }
    };
    walk(0);
  }

  /**
   * Перестановка столбцов, дающая ссылку: { key, cols, text } для каждого порядка, расшифровка которого целиком
   * распознаётся как явная ссылка. Лучшие (известный сервис, короткий ключ) первыми.
   */
  async function crackColumnarUrl(text, opts) {
    const o = opts || {};
    const deadline = Date.now() + (o.budgetMs || 2000);
    const chars = Array.from(String(text).trim());
    const found = new Map();
    for (let L = MIN_COLS; L <= Math.min(o.maxCols || MAX_COLS, chars.length - 1); L++) {
      for (const prefix of URL_PREFIXES) {
        const orders = [];
        urlOrders(chars, L, prefix, URL_MAX_SOLUTIONS, orders);
        for (const order of orders) {
          // order — порядок чтения исходных столбцов; ключ ноды: буква столбца = его место в порядке чтения.
          const key = keyFromOrder(order);
          let t;
          try { t = runStep({ op: 'columnar', params: { key, dir: 'dec' } }, text.trim()); } catch (e) { continue; }
          if (found.has(t)) continue;
          const links = G.Links ? G.Links.detect(t) : [];
          const link = links.find((l) => l.confidence === 3 && l.url === t);
          if (!link) continue;
          found.set(t, { key, cols: L, text: t, service: link.serviceId, ids: orders.length });
        }
        if (Date.now() > deadline || (o.cancel && o.cancel.stop)) break;
        await tick();
      }
      if (Date.now() > deadline) break;
    }
    return [...found.values()].sort((a, b) => (b.service !== 'web') - (a.service !== 'web') || a.ids - b.ids || a.cols - b.cols).slice(0, o.top || 8);
  }

  // ---------- Виженер над ссылкой: известное начало адреса ----------
  // Зашифрованная ссылка сохраняет «://», точки и косые черты (Виженер их пропускает). Начало открытого текста
  // почти наверняка https/http (и часто www): это известный открытый текст, он сразу даёт буквы ключа.
  // Для каждой длины ключа, покрытой шпаргалкой, ключ выводится, проверяется на согласованность и принимается,
  // только если расшифровка целиком читается как ссылка.
  const URL_CRIBS = ['httpswww', 'httpwww', 'https', 'http'];
  const LOWER = 'abcdefghijklmnopqrstuvwxyz';
  const CRIB_SPARE = 2;            // проверок сверх длины ключа

  function crackVigenereUrl(text) {
    const s = String(text).trim();
    const m = s.match(/^([A-Za-z]{4,5}):\/\/(\S+)$/);
    if (!m) return [];
    const letters = Array.from(s.toLowerCase()).filter((ch) => LOWER.includes(ch));
    const scheme = m[1].length === 5 ? 'https' : 'http';
    // Точки сохраняются: хост известного сервиса с той же длиной частей («youtu.be» ↔ «xxxxx.xx») — длинная шпаргалка.
    const host = m[2].split(/[/?#]/)[0];
    const shape = (h) => h.split('.').map((x) => x.length).join('.');
    const hosts = G.Links ? G.Links.SERVICES.flatMap((svc) => svc.hosts) : [];
    const cribs = URL_CRIBS.filter((c) => c.startsWith(scheme) && (c === scheme || c === scheme + 'www'))
      .concat(hosts.flatMap((h) => [h, 'www.' + h]).filter((h) => /^[a-z.]+$/.test(h) && shape(h) === shape(host)).map((h) => scheme + h.replace(/\./g, '')));
    const found = new Map();
    for (const crib of cribs) {
      // Каждая буква ключа проверяется хотя бы раз (длина ключа ≤ половины шпаргалки), и проверок не меньше двух:
      // иначе подходит любой «ключ» и получается правдоподобный, но мусорный адрес.
      for (let L = 1; L <= Math.min(Math.floor(crib.length / 2), crib.length - CRIB_SPARE); L++) {
        const shifts = new Array(L).fill(null);
        let ok = true;
        for (let i = 0; i < crib.length && ok; i++) {
          const k = (LOWER.indexOf(letters[i]) - LOWER.indexOf(crib[i]) + 26) % 26;
          if (shifts[i % L] === null) shifts[i % L] = k; else if (shifts[i % L] !== k) ok = false;
        }
        if (!ok || shifts.includes(null)) continue;
        const key = shifts.map((k) => LOWER[k]).join('');
        let t;
        try { t = runStep({ op: 'vigenere', params: { key, dir: 'dec', alpha: 'en', skip: true } }, s); } catch (e) { continue; }
        const link = G.Links ? G.Links.detect(t).find((l) => l.confidence === 3 && l.url === t) : null;
        if (link && !found.has(t)) found.set(t, { key, text: t, crib, service: link.serviceId });
      }
    }
    return [...found.values()].sort((a, b) => (b.service !== 'web') - (a.service !== 'web') || a.key.length - b.key.length);
  }

  G.SolverCrackers = { segments, describePlan, looksTransposed, crackColumnar, crackColumnarUrl, urlAnagram, crackVigenereUrl, keyFromOrder, runChain };
})(typeof self !== 'undefined' ? self : this);
