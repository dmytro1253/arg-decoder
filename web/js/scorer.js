// Оценка «насколько строка похожа на ответ»: язык (квадграммы + слова) и структуры (ссылки, ID).
// Оценка — не «вероятность решения»: это правдоподобие текста; подтверждение ответа делается снаружи.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const MODELS = {};
  const SHORT_WORDS = {
    en: new Set(['a', 'i', 'an', 'am', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'hi', 'if', 'in', 'is', 'it', 'me', 'my', 'no', 'of', 'oh', 'ok', 'on', 'or', 'so', 'to', 'up', 'us', 'we']),
    ru: new Set(['а', 'в', 'и', 'к', 'о', 'с', 'у', 'я', 'во', 'да', 'до', 'же', 'за', 'из', 'ко', 'ли', 'мы', 'на', 'не', 'ни', 'но', 'ну', 'об', 'он', 'от', 'по', 'со', 'то', 'ты', 'уж']), // i18n-ok: данные
    uk: new Set(['а', 'в', 'і', 'й', 'з', 'о', 'у', 'я', 'бо', 'ви', 'до', 'же', 'за', 'із', 'їх', 'її', 'ми', 'на', 'не', 'ні', 'ну', 'он', 'по', 'та', 'те', 'ти', 'то', 'це', 'чи', 'як', 'що']), // i18n-ok: данные
    es: new Set(['a', 'y', 'o', 'e', 'u', 'al', 'de', 'el', 'en', 'es', 'la', 'le', 'lo', 'me', 'mi', 'ni', 'no', 'os', 'se', 'si', 'su', 'te', 'tu', 'un', 'ya', 'yo']),
  };
  const URL_RE = /(https?:\/\/|www\.)\S+|(?:^|\s)(?:[a-z0-9-]{2,}\.)+(?:com|ru|net|org|moe|be|io|me|gl|ly|gg|xyz|su|ua|tv|app|link|cc|to)(?:\/\S*)?(?=\s|$)/;
  const KNOWN_HOSTS = /(youtu\.?be|youtube|drive\.google|docs\.google|catbox|pastebin|imgur|discord|t\.me|bit\.ly|tinyurl|github)/i;
  const KNOWN_SCHEMES = /^(?:https?|ftps?|file|wss?|sftp|ssh|git|irc|magnet|data)$/i;
  const LINK_COVER_MIN = 0.6;      // доля текста под ссылками, при которой ссылка сама — ответ
  const REST_LETTERS_MIN = 6;      // меньше букв вокруг ссылки — подпись вроде «Link:», её не читаем
  const YT_ID = /^[A-Za-z0-9_-]{11}$/;
  const DRIVE_ID = /^1[A-Za-z0-9_-]{24,43}$/;
  const LETTER = /[a-zа-яёіїєґ]/;
  // Правдоподобные «слова» из одного регистра без цифр ID не считаем: 11 строчных букв — это слово.
  const looksLikeId = (s) => YT_ID.test(s) && /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9_-]|[A-Z].*[A-Z]/.test(s);

  function init() {
    if (MODELS.ready || !G.LANG_DATA) return;
    for (const lang of Object.keys(G.LANG_DATA)) {
      const d = G.LANG_DATA[lang];
      const raw = atob(d.quad);
      const n = d.alphabet.length;
      const table = new Float32Array(raw.length);
      let sum = 0;
      for (let i = 0; i < raw.length; i++) {
        table[i] = d.qMin + (raw.charCodeAt(i) / 255) * (d.qMax - d.qMin);
        sum += table[i];
      }
      const index = new Map();
      for (let i = 0; i < n; i++) index.set(d.alphabet[i], i);
      const words = new Set(d.words);
      MODELS[lang] = { n, table, index, words, randMean: sum / raw.length, mean: d.qMean, maxWord: 16 };
    }
    MODELS.ready = true;
  }

  // Испанская модель хранит буквы без ударений (á → a), ñ — отдельная буква.
  const ES_FOLD = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u' };
  const LATIN_LANGS = ['en', 'es'];
  const ES_COVER_MIN = 0.6;
  const ES_WEAK = 0.6;

  function lettersOf(text, lang) {
    const m = MODELS[lang];
    const out = [];
    for (const ch of text.toLowerCase()) {
      const c = ch === 'ё' && lang === 'ru' ? 'е' : lang === 'es' && ES_FOLD[ch] ? ES_FOLD[ch] : ch; // i18n-ok: данные
      if (m.index.has(c)) out.push(m.index.get(c));
    }
    return out;
  }

  // 0 ≈ случайные буквы, 1 ≈ обычный текст.
  function quadNorm(text, lang) {
    const m = MODELS[lang];
    const L = lettersOf(text, lang);
    if (L.length < 4) return { norm: 0, letters: L.length };
    let s = 0;
    const n = m.n;
    for (let i = 0; i + 3 < L.length; i++) s += m.table[((L[i] * n + L[i + 1]) * n + L[i + 2]) * n + L[i + 3]];
    const avg = s / (L.length - 3);
    const norm = (avg - m.randMean) / (m.mean - m.randMean);
    return { norm: Math.max(-0.5, Math.min(1.5, norm)), letters: L.length };
  }

  // Доля букв, покрытых словарными словами (длинные слова весят больше).
  function wordCoverage(text, lang) {
    const m = MODELS[lang];
    const alpha = lang === 'en' ? /[a-z]+/gi : lang === 'es' ? /[a-zñáéíóúü]+/gi : /[а-яёіїєґ]+/gi;
    let low = text.slice(0, 400).toLowerCase().replace(/ё/g, 'е'); // i18n-ok: данные
    if (lang === 'es') low = low.replace(/[áéíóúü]/g, (ch) => ES_FOLD[ch]);
    const runs = low.match(alpha) || [];
    let covered = 0, total = 0;
    const found = [];
    for (const run of runs) {
      total += run.length;
      const dp = new Float32Array(run.length + 1);
      const back = new Int16Array(run.length + 1);
      for (let i = 1; i <= run.length; i++) {
        dp[i] = dp[i - 1];
        back[i] = 0;
        for (let len = 1; len <= Math.min(m.maxWord, i); len++) {
          const w = run.slice(i - len, i);
          const ok = len >= 3 ? m.words.has(w) : SHORT_WORDS[lang].has(w);
          if (!ok) continue;
          const weight = len >= 5 ? 1 : len === 4 ? 0.85 : len === 3 ? 0.55 : 0.35;
          const v = dp[i - len] + len * weight;
          if (v > dp[i]) { dp[i] = v; back[i] = len; }
        }
      }
      covered += dp[run.length];
      for (let i = run.length; i > 0;) {
        if (back[i]) { if (back[i] >= 4) found.push(run.slice(i - back[i], i)); i -= back[i]; } else i--;
      }
    }
    return { coverage: total ? covered / total : 0, words: found.reverse() };
  }

  function charStats(text) {
    let letters = 0, latin = 0, cyr = 0, digits = 0, spaces = 0, punct = 0, bad = 0, total = 0;
    for (const ch of text) {
      total++;
      const c = ch.codePointAt(0);
      // Латиница с диакритикой (á é ñ ü ç…) — тоже буквы: испанский, французский, немецкий текст не мусор.
      if (/[a-zÀ-ÖØ-öø-ɏ]/i.test(ch)) { letters++; latin++; } else if (/[а-яёіїєґ]/i.test(ch)) { letters++; cyr++; } else if (c >= 48 && c <= 57) digits++;
      else if (c === 32 || c === 10 || c === 13) spaces++;
      else if (c < 32 || (c >= 127 && c < 160) || c === 0xfffd) bad++;
      else if (/[.,!?;:'"()«»\-—–/%=&#+_@*’‘“”„…ʼ]/.test(ch)) punct++;   // и типографские кавычки, апостроф, многоточие
      else bad += 0.5;
    }
    return { letters, latin, cyr, digits, spaces, punct, bad, total };
  }

  // Строка похожа на промежуточный слой, который стоит декодировать дальше.
  function intermediateKind(t) {
    const s = t.trim();
    if (s.length < 4) return null;
    if (/%[0-9a-f]{2}/i.test(s)) return 'percent';
    if (/^(0x)?[0-9a-f\s]+$/i.test(s) && s.replace(/\s|0x/gi, '').length % 2 === 0 && /[a-f]/i.test(s) && /\d/.test(s)) return 'hex';
    if (/^[01\s]+$/.test(s) && s.replace(/\s/g, '').length >= 8) return 'binary';
    if (/^[0-9\s,;]+$/.test(s)) return 'digits';
    if (/^[.\-\s/·]+$/.test(s)) return 'morse';
    if (/^[A-Za-z0-9+/_-]{12,}={0,2}$/.test(s) && /[a-z]/.test(s) && /[A-Z]/.test(s) && s.length % 4 !== 1) return 'base64';
    return null;
  }

  const COORDS_RE = /^(-?\d{1,2}\.\d{3,})\s*[,; ]\s*(-?\d{1,3}\.\d{3,})$/;
  const PATH_RE = /^(?:\.{0,2}\/)?[\w.-]+(?:\/[\w.-]+)*\.(?:png|jpe?g|gif|bmp|webp|mp3|wav|ogg|flac|mp4|webm|mov|html?|php|txt|pdf|zip|rar|7z|jar|json|xml)$/i;
  /** «coordinates» (широта ≤ 90, долгота ≤ 180), «path» (имя или путь файла с расширением) или null. */
  function structuredKind(s) {
    const c = s.match(COORDS_RE);
    if (c && Math.abs(Number(c[1])) <= 90 && Math.abs(Number(c[2])) <= 180) return 'coordinates';
    if (s.length <= 200 && PATH_RE.test(s) && /[a-z]{2}/i.test(s.replace(/\.[a-z0-9]+$/i, ''))) return 'path';
    return null;
  }

  // Порог частоты самой частой буквы: для короткой фразы выше, чем для длинного текста.
  const topLetterLimit = (n) => Math.max(0.22, 0.15 + 2.5 * Math.sqrt(0.1275 / Math.max(1, n)));

  // nested: разбор текста вокруг ссылки — без повторного поиска ссылок (иначе голый домен даёт бесконечную рекурсию).
  function analyze(text, extraKeywords, nested) {
    init();
    const st = charStats(text);
    const tags = [];
    const n = Math.max(1, st.total);
    const badRatio = st.bad / n;
    const trimmed = text.trim();
    let hasLink = false, hasId = false;

    let best = { lang: null, natural: 0, quad: 0, cover: 0, words: [] };
    if (MODELS.ready && st.letters >= 3) {
      // Кириллицу оцениваем и русской, и украинской моделью: побеждает та, что лучше объясняет текст.
      for (const lang of ['en', 'es', 'ru', 'uk']) {
        if (!MODELS[lang]) continue;
        const latin = LATIN_LANGS.includes(lang);
        if ((latin && st.latin < st.letters * 0.5) || (!latin && st.cyr < st.letters * 0.5)) continue;
        const q = quadNorm(text, lang);
        const w = wordCoverage(text, lang);
        // На коротких строках квадграммы легко обмануть: без найденных слов им почти не верим.
        let qWeight = q.letters >= 20 ? 0.55 : q.letters >= 12 ? 0.45 : q.letters >= 7 ? 0.3 : 0.2;
        if (q.letters < 15 && w.coverage < 0.15) qWeight *= 0.55;
        let natural = qWeight * Math.max(0, q.norm) + (1 - qWeight) * w.coverage;
        // Испанский — дополнительная модель для латиницы: без сильного свидетельства (покрытие словами и два слова
        // или буквы ñ/á/¿) случайная строка с «peina» внутри не должна становиться читаемой.
        if (lang === 'es' && !(w.coverage >= ES_COVER_MIN && (w.words.length >= 2 || /[ñáéíóú¿¡]/i.test(text)))) natural *= ES_WEAK;
        if (natural > best.natural) best = { lang, natural, quad: q.norm, cover: w.coverage, words: w.words };
      }
    }
    // В живом тексте ни одна буква не встречается чаще ~15%; «AsPArPAsfA…» — след повторяющегося шифра.
    // Порог растёт для коротких фраз («help me please»: 4 «e» из 12 — норма), если слова опознаны.
    if (st.letters >= 12) {
      const counts = new Map();
      for (const ch of text.toLowerCase()) if (LETTER.test(ch)) counts.set(ch, (counts.get(ch) || 0) + 1);
      const top = Math.max(...counts.values()) / st.letters;
      if (top > topLetterLimit(st.letters) && best.cover < 0.8) best.natural *= 0.5;
    }
    const nonSpace = Math.max(1, n - st.spaces);
    const letterRatio = st.letters / nonSpace;
    const mixed = st.latin > 0 && st.cyr > 0 ? Math.min(st.latin, st.cyr) / st.letters : 0;

    let score = 100 * best.natural * Math.min(1, letterRatio * letterRatio * 1.2) * (1 - mixed * 1.5);
    // Очень короткий результат легко случайно совпадает со словом — доверяем ему меньше.
    if (st.letters < 4) score *= 0.4;
    else if (st.letters < 5) score *= 0.65;

    let potential = 0;
    let linkCover = 0, linkConfirmed = false, reversedLink = null;
    const links = G.Links && badRatio < 0.05 && !nested ? G.Links.detect(trimmed) : [];
    const explicit = links.find((l) => l.confidence === 3);
    const url = explicit ? [explicit.url] : (G.Links ? null : trimmed.match(URL_RE));
    if (url && badRatio < 0.05) {
      hasLink = true;
      // Ссылка подтверждает только себя. Если вокруг неё ещё много текста, он тоже должен читаться:
      // «Удшчфкжр еїц: https://youtu.be/… — зуа щ…» — это зашифрованное сообщение со ссылкой внутри, а не ответ.
      const urls = explicit ? links.filter((l) => l.confidence === 3).map((l) => l.url) : url;
      let rest = trimmed;
      for (const u of urls) { const bare = u.replace(/^https?:\/\//i, ''); rest = rest.split(rest.includes(u) ? u : bare).join(' '); }
      const solid = (t) => t.replace(/\s+/g, '').length;
      linkCover = Math.max(0, Math.min(1, 1 - solid(rest) / Math.max(1, solid(trimmed))));
      const restA = linkCover < 1 ? analyze(rest, extraKeywords, true) : null;
      // Язык текста — по словам вокруг ссылки: латиница адреса не должна топить украинское сообщение.
      if (restA && restA.letters >= REST_LETTERS_MIN) {
        best = { lang: restA.lang, natural: restA.natural, quad: best.quad, cover: restA.cover, words: restA.words };
        score = restA.score;
      }
      linkConfirmed = linkCover >= LINK_COVER_MIN || !restA || restA.letters < REST_LETTERS_MIN || restA.readable;
      if (linkConfirmed) score = Math.max(score, 60) + (KNOWN_HOSTS.test(url[0]) || (explicit && explicit.serviceId !== 'web') ? 30 : 10);
      else { score = restA.score + 10; potential = Math.max(potential, 50); tags.push(T('текст вокруг ссылки не читается', 'the text around the link is unreadable')); }
      // Ссылка ещё в %-кодировке — это промежуточный слой, полная расшифровка ценнее.
      if (/%[0-9a-f]{2}/i.test(text)) score -= 20;
      tags.push(explicit && explicit.serviceId !== 'web' ? T('ссылка: ', 'link: ') + explicit.service : T('ссылка', 'link'));
    } else {
      // Перевёрнутая ссылка — ещё не ответ, а подсказка, что нужен реверс: в выдачу должна попасть прямая.
      const rev = links.find((l) => l.reversed && l.confidence === 2);
      if (rev) { reversedLink = rev.url; potential = Math.max(potential, 60); tags.push(T('перевёрнутая ссылка: ', 'reversed link: ') + rev.service); }
      // Характерный ID сервиса (Catbox, канал YouTube…).
      const strong = links.find((l) => l.confidence === 2 && !l.reversed && l.serviceId !== 'youtube' && l.serviceId !== 'drive');
      if (strong) { hasLink = true; linkConfirmed = true; linkCover = 1; score += 18; tags.push(T('похоже на ', 'looks like ') + strong.service); }
    }
    // «frrnq://…» — схема ссылки, искажённая шифром: снятый слой ещё не ответ.
    const scheme = !hasLink && trimmed.match(/(?:^|[^a-z])([a-z]{3,10}):\/\/[^\s]/i);
    const brokenLink = !!(scheme && !KNOWN_SCHEMES.test(scheme[1]));
    if (brokenLink) { potential = Math.max(potential, 55); tags.push(T('искажённая схема ссылки: ', 'distorted link scheme: ') + scheme[1]); }
    // Случайные «слова» внутри ID ничего не значат — язык для ID почти не учитываем.
    if (looksLikeId(trimmed)) { hasId = true; tags.push('YouTube ID'); score = score * 0.25 + 8; }
    // ID Drive всегда содержит буквы; длинный ряд цифр — это числа, а не ссылка.
    if (DRIVE_ID.test(trimmed) && /[A-Za-z]/.test(trimmed)) { hasId = true; tags.push('Drive ID'); score += 22; }
    const mid = intermediateKind(text);
    // Строка, похожая на ещё один слой кодировки, — сама по себе не ответ.
    if (mid) { if (!hasId && !hasLink) score *= 0.6; tags.push(T('слой: ', 'layer: ') + mid); potential = 45; }
    // Заголовок zlib/gzip у байтовой строки — сжатый слой: его стоит распаковать (проверит контрольная сумма).
    const packed = !mid && !nested && G.Decompress ? G.Decompress.headerKind(text) : null;
    if (packed) { tags.push(T('слой: ', 'layer: ') + packed); potential = 50; }
    // Сырые байты, которые читаются как UTF-8/CP1251, — тоже перспективный слой.
    if (!mid && /[\u0080-ÿ]/.test(text) && !/[^\u0000-ÿ]/.test(text)) { tags.push(T('слой: байты', 'layer: bytes')); potential = Math.max(potential, 35); }
    // Структурные ответы: пара координат и путь к файлу — осмысленный результат без единого слова.
    const kind = structuredKind(trimmed);
    if (kind === 'coordinates') { score = Math.max(score, 70); tags.push(T('координаты', 'coordinates')); }
    else if (kind === 'path' && !hasLink) { score = Math.max(score, 62); tags.push(T('путь к файлу', 'file path')); }
    for (const kw of extraKeywords || []) {
      if (kw && text.toLowerCase().includes(kw.toLowerCase())) { score += 15; tags.push(T('ключевое: ', 'keyword: ') + kw); }
    }
    score -= badRatio * 140;
    if (best.lang && best.natural > 0.55) tags.push({ ru: T('русский', 'Russian'), uk: T('украинский', 'Ukrainian'), es: T('испанский', 'Spanish') }[best.lang] || T('английский', 'English'));
    // Чистая строка из букв одного алфавита (например, после декодирования байтов) стоит
    // того, чтобы попробовать на ней реверс/Цезаря, даже если сама по себе бессмысленна.
    const clean = st.letters >= 4 && st.letters / nonSpace >= 0.9 && mixed === 0 && badRatio === 0;
    if (clean) potential = Math.max(potential, 42);
    // Смесь латиницы и кириллицы без мусора — кандидат для «русского латиницей» и похожих букв.
    if (badRatio === 0 && st.latin >= 2 && st.cyr >= 2) potential = Math.max(potential, 40);
    return {
      score: Math.round(score * 10) / 10,
      potential: Math.max(potential, score),
      tags,
      lang: best.lang,
      natural: best.natural,
      words: best.words.slice(0, 8),
      badRatio,
      letters: st.letters,
      // Читается как текст: язык + найденные слова (а не просто красивые квадграммы).
      readable: best.natural >= 0.5 && st.letters >= 3 && (best.cover >= 0.5 || best.words.length > 0) && badRatio < 0.05,
      hasLink,
      linkConfirmed,
      linkCover,
      reversedLink,
      brokenLink,
      hasId,
      kind,
      cover: best.cover,
      // Строка из букв одного алфавита без мусора — признак чисто снятого слоя.
      cleanText: badRatio === 0 && st.letters >= 4 && letterRatio >= 0.6 && mixed === 0,
    };
  }

  function stats(text) {
    init();
    const st = charStats(text);
    const counts = new Map();
    for (const ch of text.toLowerCase()) if (LETTER.test(ch)) counts.set(ch, (counts.get(ch) || 0) + 1);
    let ioc = 0;
    for (const v of counts.values()) ioc += v * (v - 1);
    ioc = st.letters > 1 ? ioc / (st.letters * (st.letters - 1)) : 0;
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, v]) => c + ':' + v).join(' ');
    return {
      length: Array.from(text).length,
      unique: new Set(text).size,
      letters: st.letters, latin: st.latin, cyr: st.cyr, digits: st.digits,
      ioc: Math.round(ioc * 10000) / 10000,
      top,
      kind: intermediateKind(text) || (looksLikeId(text.trim()) ? 'YouTube ID?' : DRIVE_ID.test(text.trim()) ? 'Google Drive ID?' : '—'),
    };
  }

  G.Scorer = { init, analyze, stats, intermediateKind, structuredKind, quadNorm, wordCoverage, MODELS, YT_ID, DRIVE_ID, URL_RE, looksLikeId, topLetterLimit };
})(typeof self !== 'undefined' ? self : this);
