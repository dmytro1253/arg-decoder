// Доказательность результатов авто-поиска: что вход действительно в том формате, который снимает шаг,
// насколько правдоподобен найденный текст с поправкой на число перебранных вариантов, и честный статус:
//  • confident — детерминированное декодирование до текста/структуры или подбор с сильным свидетельством;
//  • likely    — читается, но параметры угаданы и свидетельства мало (короткий текст, много вариантов);
//  • decoded   — слой формата снят точно (без угадывания), но результат не подтверждён как ответ:
//                короткий, не читается или сам похож на следующий слой (перевёрнутая ссылка, искажённая схема);
//  • format    — распознан формат (хеш, контейнер, токен), открытого текста нет;
//  • fragment  — расшифрована только часть входа;
//  • weak      — гипотеза без оснований.
// Плюс распознавание входа до поиска: арифметическое выражение, хеш-дайджест, непрозрачный токен.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);

  const compact = (t) => String(t).replace(/\s+/g, '');
  // Вход шага действительно в этом формате (а не случайно декодируется). Только для шагов-декодеров.
  const FORMAT = {
    hex_decode: (t) => { const s = compact(t).replace(/^0x/i, '').replace(/[:,-]|0x/gi, ''); return s.length >= 2 && s.length % 2 === 0 && /^[0-9a-f]+$/i.test(s); },
    base64_decode: (t) => {
      const s = compact(t);
      if (s.length < 4 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(s)) return false;
      return s.includes('=') ? s.length % 4 === 0 : s.length % 4 !== 1;
    },
    base32_decode: (t) => { const s = compact(t); return s.length >= 8 && (/^[A-Z2-7]+=*$/.test(s) || /^[a-z2-7]+=*$/.test(s)); },
    base85_decode: (t) => { const s = compact(t); return s.length >= 5 && (/^<~[\s\S]*~>$/.test(s) || /^[!-uz]+$/.test(s) || /^[0-9a-zA-Z.\-:+=^!/*?&<>()[\]{}@%$#]+$/.test(s)); },
    base58_decode: (t) => { const s = compact(t); return s.length >= 4 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(s); },
    binary_decode: (t) => /^[01\s]+$/.test(t) && compact(t).length >= 8,
    octal_decode: (t) => /^[0-7\s]+$/.test(t) && compact(t).length >= 3,
    dec_codes: (t) => /^[\d\s,;.]+$/.test(t) && /\d/.test(t),
    a1z26: (t) => /^[\d\s,;.\-–]+$/.test(t) && /\d/.test(t),
    num_letters: (t) => /^[\d\s,;.:\-–?!]+$/.test(t) && /\d/.test(t),
    url_decode: (t) => /%[0-9a-f]{2}/i.test(t),
    unescape: (t) => /\\[uxU][0-9a-f]|\\[0-7]{3}|&#x?[0-9a-f]+;/i.test(t),
    morse_decode: (t) => /^[.\-·•–—\s/|]+$/.test(t) && /[.\-·•–—]/.test(t),
    bytes_decode: (t) => /[\u0080-ÿ]/.test(t) && !/[^\u0000-ÿ]/.test(t),
    uudecode: (t) => /^begin [0-7]{3} /m.test(t),
    qp_decode: (t) => /=[0-9A-F]{2}/.test(t),
    punycode_decode: (t) => /xn--/i.test(t),
    zero_width: (t) => /[​-‍⁠﻿]/.test(t),
    braille_decode: (t) => /[⠀-⣿]/.test(t),
    sga_decode: (t) => /[ᔑʖᓵ↸ᒷ⎓⊣⍑╎⋮ꖌꖎᒲリ𝙹!¡ᑑ∷ᓭℸ⚍⍊∴̇|⨅]/.test(t),
    runes_decode: (t) => /[ᚠ-ᛸ]/.test(t),
    ebcdic_decode: (t) => /[\u0080-ÿ]/.test(t),
    // Сжатый поток считается форматом входа, только если сошлись заголовок zlib/gzip и контрольная сумма.
    decompress: (t) => !!(G.Decompress && G.Decompress.verified(t)),
  };
  // Шаги без угадываемых параметров, которые не меняют смысла: подготовка пробелов и вырезание кандидата.
  const NEUTRAL = new Set(['extract_candidates']);
  // Минимум печатаемых ASCII-байт, при котором чистый вывод декодера сам по себе свидетельство формата:
  // случайные байты дают печатаемый ASCII с вероятностью (95/256)^n.
  const MIN_PRINTABLE = { hex_decode: 4, binary_decode: 4, octal_decode: 4, dec_codes: 4, base64_decode: 6, base32_decode: 6, base85_decode: 8, base58_decode: 6, url_decode: 3, unescape: 3, decompress: 4 };
  const PRINTABLE = /^[\x20-\x7e\t\r\n]+$/;

  /** Шаг step, применённый к тексту src, — детерминированное снятие слоя настоящего формата. */
  function formatStep(step, src) {
    if (NEUTRAL.has(step.op)) return true;
    if (step.op === 'ws_prep') return step.params && step.params.mode !== 'nospace';
    // Сдвиг кодов — угаданный параметр, если его не задал профиль расследования.
    if ((step.op === 'dec_codes') && Number(step.params && step.params.shift) && !profileShift(step.params.shift)) return false;
    const test = FORMAT[step.op];
    return !!test && test(src);
  }

  const profileShift = (n) => ((G.Profiles && G.Profiles.active().probeShifts) || []).some((x) => Math.abs(x) === Math.abs(Number(n)));
  const EVIDENCE_MIN = 3;
  const COVER_MIN = 0.6;
  const STEP_BITS = 3;
  const SHORT_GUESS = 6;
  const CONFIRM_LETTERS = 6;       // букв, начиная с которых читаемый вывод декодера подтверждает себя сам
  // Шаг по своему типу снимает формат (без угадываемых параметров), независимо от входа.
  const formatKind = (c) => NEUTRAL.has(c.op) || (c.op === 'ws_prep' && c.params && c.params.mode !== 'nospace') || (!!FORMAT[c.op] && !(c.op === 'dec_codes' && Number(c.params && c.params.shift)));
  const bitsOf = (item, weight) => (item.freedom || 0) / weight;
  const guessedSteps = (item) => item.chain.filter((c) => !formatKind(c)).length;
  const LINK_CONFIRM_COVER = 0.6;
  const LINK_CONFIRM_BITS = 6;

  /**
   * Статус результата. item: { a (анализ Scorer), chain, deterministic, asIs, userKey, freedom, coverage, kind, text }.
   * Возвращает { status, evidence, reason }.
   */
  function statusOf(item, weight) {
    const a = item.a;
    const kind = item.kind || a.kind;
    if (item.segmentStatus) return { status: item.segmentStatus, base: item.segmentStatus, evidence: 0, reason: 'segments' };
    if (kind === 'hash' || kind === 'container' || kind === 'token') return { status: 'format', base: 'format', evidence: 0, reason: kind };
    let status;
    let evidence = 0;
    let reason;
    if (item.asIs) {
      // Уже читаемый вход — не доказательство ответа: в нём может прятаться слой. Уверенно только ссылка,
      // которая и есть весь ответ (вокруг неё нет нечитаемого текста). Ссылка внутри шифртекста — часть входа.
      status = a.linkConfirmed ? 'confident' : a.hasLink ? 'fragment' : a.readable || a.hasId ? 'likely' : 'weak';
      reason = a.hasLink && !a.linkConfirmed ? 'link-in-text' : 'as-is';
    } else if (item.deterministic && item.chain.length) {
      const last = item.chain[item.chain.length - 1].op;
      const firstDecoder = item.chain.find((c) => MIN_PRINTABLE[c.op]);
      // Правильное снятие формата и подтверждённый ответ — разные вещи. Ответ подтверждают: ссылка на весь вывод,
      // структура (координаты, путь, посчитанное выражение) или достаточно длинный читаемый текст.
      const nextLayer = a.reversedLink || a.brokenLink || (a.hasLink && !a.linkConfirmed);
      const confirmedText = a.readable && (a.letters || 0) >= CONFIRM_LETTERS && (a.cover || 0) >= COVER_MIN;
      if (nextLayer) { status = 'decoded'; reason = 'next-layer'; }
      else if (a.linkConfirmed || kind === 'coordinates' || kind === 'path' || (kind === 'number' && item.chain[0].op === 'calc') || confirmedText) { status = 'confident'; reason = 'decoded'; }
      // Промежуточный слой (%HH, hex, Base64…) — ещё не ответ, его декодируют дальше.
      else if (G.Scorer.intermediateKind(item.text)) status = 'weak';
      else if (a.readable || kind === 'number') { status = 'decoded'; reason = 'decoded-short'; }
      // Печатаемый ASCII — свидетельство формата только для байтовых декодеров: числа → буквы дают буквы из чего угодно.
      else if (firstDecoder && PRINTABLE.test(item.text) && item.text.trim().length >= MIN_PRINTABLE[firstDecoder.op] && a.letters >= 2 && last !== 'bytes_decode') { status = 'decoded'; reason = 'decoded-printable'; }
      // Короткое слово из hex/двоичного кода (616c6c → all): только буквы — уже маловероятная случайность.
      else if (firstDecoder && /^(hex|binary)_decode$/.test(firstDecoder.op) && /^[A-Za-z]{3,}$/.test(item.text)) { status = 'decoded'; reason = 'decoded-printable'; }
      else status = 'weak';
    } else {
      // Подобранные параметры: покрытые словами буквы против числа перебранных вариантов (в битах).
      // Каждый угаданный шаг сверх первого — ещё один выбор из десятков операций.
      const covered = (a.letters || 0) * Math.max(0, Math.min(1, a.cover || 0));
      const guessed = guessedSteps(item);
      evidence = covered - bitsOf(item, weight) - STEP_BITS * Math.max(0, guessed - 1) + (item.userKey ? 6 : 0);
      // Явная ссылка на весь вывод после шага с малым числом вариантов (реверс, Цезарь): случайно схема,
      // домен и путь не складываются, поэтому это подтверждение, а не догадка.
      if (a.linkConfirmed && (a.linkCover || 0) >= LINK_CONFIRM_COVER && !a.reversedLink && bitsOf(item, weight) <= LINK_CONFIRM_BITS && guessedSteps(item) <= 1 && !item.unjustified) { status = 'confident'; reason = 'link'; }
      // Шаг, не улучшивший читаемость (unjustified), не даёт уверенности, даже если текст читается сам по себе.
      else if (a.readable && !item.unjustified && (a.letters >= 8 || item.userKey) && (a.cover || 0) >= COVER_MIN && evidence >= EVIDENCE_MIN) { status = 'confident'; reason = 'readable'; }
      else if (a.hasLink && a.badRatio === 0) { status = a.linkConfirmed ? 'likely' : 'fragment'; reason = 'link'; }
      // Короткое «слово» из угаданной цепочки (3–5 букв) — почти всегда совпадение.
      else if ((a.readable && a.letters >= SHORT_GUESS) || kind === 'coordinates' || kind === 'path') status = 'likely';
      else status = 'weak';
    }
    // Расшифрован кусок длинного входа — это не ответ на весь вход. base — статус самого куска.
    const base = status;
    if (item.coverage !== undefined && item.coverage < 0.8 && (status === 'confident' || status === 'likely' || status === 'decoded')) status = 'fragment';
    return { status, base, evidence: Math.round(evidence * 10) / 10, reason };
  }

  // ---------- распознавание входа ----------
  const EXPR_CHARS = /^[\s\d+\-*/×÷^()%.,]+$/;
  /** Точное значение арифметического выражения или null. */
  function expression(input) {
    const s = input.trim();
    if (!EXPR_CHARS.test(s) || !/\d\s*[+\-*/×÷^%]\s*[\d(]/.test(s)) return null;
    if (/[.,]/.test(s)) return null;                           // калькулятор целочисленный; дроби не трогаем
    const expr = s.replace(/×/g, '*').replace(/÷/g, '/');
    try {
      const value = G.CipherOps.BY_ID.calc.run([expr], { mode: 'value' });
      return { expr, value };
    } catch (e) {
      return null;
    }
  }

  const DIGESTS = { 32: 'MD5 / NTLM', 40: 'SHA-1', 56: 'SHA-224', 64: 'SHA-256', 96: 'SHA-384', 128: 'SHA-512' };
  /** Название вероятного хеша, если вход — hex-дайджест стандартной длины. */
  function digest(input) {
    const s = input.trim();
    // В настоящем hex-дайджесте почти наверняка есть буквы a–f; ряд одних цифр — это числа.
    return /^[0-9a-f]+$/i.test(s) && /[a-f]/i.test(s) && DIGESTS[s.length] ? DIGESTS[s.length] : null;
  }

  /** Непрозрачный идентификатор/пароль: одно «слово» из букв и цифр без признаков текста. */
  function token(input, analysis) {
    const lines = input.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length || lines.length > 12) return false;
    // Ровный hex или Base64 с выравниванием — это кодировка, а не токен.
    if (lines.length === 1 && (FORMAT.hex_decode(lines[0]) || (/=$/.test(lines[0]) && FORMAT.base64_decode(lines[0])))) return false;
    return lines.every((l) => l.length >= 5 && l.length <= 32 && !/\s/.test(l) && /\d/.test(l) && /[a-z]/i.test(l)) && !analysis.readable && !analysis.hasLink;
  }

  const LABEL = {
    confident: () => T('уверенно', 'confident'), likely: () => T('вероятно', 'likely'), format: () => T('формат распознан', 'format recognised'),
    fragment: () => T('часть входа', 'part of the input'), weak: () => T('гипотеза', 'hypothesis'),
    decoded: () => T('формат снят, ответ не подтверждён', 'format decoded, answer not confirmed'),
  };

  /** Итог поиска по лидеру: solved / candidates / decoded / format / undetermined. */
  function verdictOf(top) {
    if (!top) return 'undetermined';
    if (top.status === 'confident') return 'solved';
    if (top.status === 'likely' || top.status === 'fragment') return 'candidates';
    if (top.status === 'decoded') return 'decoded';
    if (top.status === 'format') return 'format';
    return 'undetermined';
  }

  G.SolverEvidence = { FORMAT, formatStep, statusOf, expression, digest, token, verdictOf, LABEL, DIGESTS };
})(typeof self !== 'undefined' ? self : this);
