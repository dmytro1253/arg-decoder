// Операции категории «Хеши»: MD5/SHA-1/SHA-256/SHA-512/CRC32 текста или файла,
// проверка кандидатов по готовому дайджесту и определитель типа строки.
// Принцип: хеш не «расшифровывают», а проверяют — совпадает ли хеш кандидата с данным.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = G.ArgFiles;
  const H = NS.Hash;
  const CAT = 'Хеши';

  const ENC_OPTIONS = [
    ['utf8', 'UTF-8'],
    ['cp1251', 'CP1251 (Windows)'],
    ['latin1', T('Байты как есть (latin1)', 'Raw bytes (latin1)')],
  ];

  const MAX_TOKENS = 60;
  const MAX_CANDIDATES = 200000;

  // ---------- определитель типа строки ----------
  // Таблица гипотез по числу hex-символов. Названия — это варианты, а не вывод.
  function hexHypotheses(len) {
    const odd = len % 2 === 1;
    if (odd) {
      return [T('Нечётное число hex-цифр: это не байтовая запись и не стандартный дайджест', 'Odd hex length: not a byte string and not a standard digest'),
        T('Похоже на игровой токен/ID, укороченный хеш или число', 'Looks like a game token/ID, a truncated hash or a number')];
    }
    const table = {
      8: ['CRC32 / Adler-32', T('32-битное число или короткий ID', '32-bit number or short ID')],
      16: [T('64 бита: половина MD5, MySQL323, CRC64, 8 байт', '64 bits: half an MD5, MySQL323, CRC64, 8 bytes')],
      32: ['MD5', 'NTLM / MD4', 'LM', T('токен или ID на 16 байт (в т.ч. UUID без дефисов)', 'a 16-byte token or ID (incl. UUID without dashes)')],
      40: ['SHA-1', 'RIPEMD-160', T('20 байт (git-коммит, ключ)', '20 bytes (git commit, key)')],
      56: ['SHA-224', 'SHA3-224'],
      64: ['SHA-256', 'SHA3-256', 'Keccak-256', T('32 байта (ключ, токен)', '32 bytes (key, token)')],
      96: ['SHA-384', 'SHA3-384'],
      128: ['SHA-512', 'SHA3-512', 'Whirlpool'],
    };
    return table[len] || [T('Нестандартная длина: скорее всего токен, данные или составное значение', 'Non-standard length: most likely a token, data or a composite value')];
  }

  /** Гипотезы о строке-токене. @returns {{kind:string, hypotheses:string[], checkable:string|null}} */
  function identifyToken(token) {
    const t = token.trim();
    if (/^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(t)) return { kind: 'bcrypt', hypotheses: ['bcrypt'], checkable: null };
    if (/^\$(1|5|6|y|argon2\w*)\$/.test(t)) return { kind: 'crypt', hypotheses: [T('Модульный crypt-хеш пароля (md5/sha-crypt/yescrypt/argon2)', 'Modular crypt password hash (md5/sha-crypt/yescrypt/argon2)')], checkable: null };
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) {
      return { kind: 'uuid', hypotheses: ['UUID', T('Не хеш: идентификатор (128 бит). Содержимое hex без дефисов — как MD5-строка', 'Not a hash: an identifier (128 bits). The hex without dashes looks like an MD5 string')], checkable: null };
    }
    const hexMatch = /^(?:0x)?([0-9a-f]+)$/i.exec(t);
    if (hexMatch) {
      const len = hexMatch[1].length;
      return { kind: 'hex', length: len, hypotheses: hexHypotheses(len), checkable: H.BY_HEX_LENGTH[len] || null };
    }
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(t) && t.length >= 22) {
      const raw = { 24: 16, 28: 20, 44: 32, 88: 64 }[t.length];
      if (raw) return { kind: 'base64', hypotheses: [T('Base64 от ' + raw + ' байт — возможно дайджест в Base64 (' + raw * 8 + ' бит)', 'Base64 of ' + raw + ' bytes — possibly a digest in Base64 (' + raw * 8 + ' bits)')], checkable: null };
    }
    return { kind: 'other', hypotheses: [T('Не похоже на стандартный дайджест', 'Does not look like a standard digest')], checkable: null };
  }

  function identifyText(text) {
    const tokens = text.split(/\s+/).filter(Boolean).slice(0, MAX_TOKENS);
    if (!tokens.length) throw new Error(T('Пустой вход', 'Empty input'));
    const lines = tokens.map((tok) => {
      const r = identifyToken(tok);
      const head = tok.length > 48 ? tok.slice(0, 45) + '…' : tok;
      const len = r.kind === 'hex' ? T(' [' + r.length + ' hex = ' + r.length * 4 + ' бит]', ' [' + r.length + ' hex = ' + r.length * 4 + ' bits]') : '';
      const verify = r.checkable ? T('\n    проверяется: «Проверка хеша» (' + H.ALGS[r.checkable].name + ')', '\n    can be verified: “Hash check” (' + H.ALGS[r.checkable].name + ')') : '';
      return head + len + '\n    ' + T('может быть: ', 'could be: ') + r.hypotheses.join(' / ') + verify;
    });
    lines.push('', T('Хеши не расшифровывают, а проверяют: берут гипотезу-кандидата, считают её хеш и сравнивают. Один и тот же hex может быть хешем, токеном или просто байтами.',
      'Hashes are verified, not decrypted: take a candidate, hash it and compare. The same hex can be a hash, a token or plain bytes.'));
    return lines.join('\n');
  }

  // ---------- проверка кандидатов ----------
  /** Достать из текста дайджесты (hex 8/32/40/64/128), допуская префиксы «md5:» и разделители «:» или пробел. */
  function extractDigests(text) {
    const found = [];
    for (const line of text.split(/\r?\n/)) {
      for (const m of line.matchAll(/(?<![0-9a-z])[0-9a-f]{8,128}(?![0-9a-z])/gi)) found.push(m[0].toLowerCase());
      // Метка вида «md5:» отбрасывается, но «ab:cd:…» (байты через двоеточие) остаётся целиком.
      const label = /^\s*([A-Za-z][\w-]*)\s*[:=]\s*/.exec(line);
      const body = label && !/^[0-9a-f]{1,2}$/i.test(label[1]) ? line.slice(label[0].length) : line;
      const compact = body.replace(/[\s:-]/g, '');
      if (compact !== body.trim() && /^[0-9a-f]+$/i.test(compact)) found.push(compact.toLowerCase());
    }
    return [...new Set(found.filter((d) => H.BY_HEX_LENGTH[d.length]))];
  }

  function candidateList(text, perLine) {
    const raw = perLine ? text.split(/\r?\n/) : [text];
    const list = [];
    for (const c of raw) if (c !== '' || !perLine) list.push(c);
    if (list.length > MAX_CANDIDATES) throw new Error(T('Слишком много кандидатов', 'Too many candidates'));
    return list;
  }

  /** Проверка: какие кандидаты дают нужные дайджесты. Чистая функция, возвращает структуру. */
  function checkCandidates(candidates, digests, opts) {
    const o = Object.assign({ alg: 'auto', enc: 'utf8', loose: true }, opts || {});
    const wanted = digests.map((d) => ({ digest: d, alg: o.alg === 'auto' ? H.BY_HEX_LENGTH[d.length] : o.alg }));
    const bad = wanted.find((w) => !w.alg || !H.ALGS[w.alg] || H.ALGS[w.alg].bytes * 2 !== w.digest.length);
    if (bad) throw new Error(T('Длина дайджеста ' + bad.digest.length + ' hex не соответствует поддерживаемому алгоритму (8, 32, 40, 64, 128)', 'A digest of ' + bad.digest.length + ' hex characters matches no supported algorithm (8, 32, 40, 64, 128)'));
    const matches = [];
    for (const cand of candidates) {
      const isText = typeof cand === 'string';
      const variants = isText && o.loose && cand.trim() !== cand ? [cand, cand.trim()] : [cand];
      for (const v of variants) {
        const bytes = isText ? NS.encodeString(v, o.enc) : v;
        const label = isText ? v : T('<файл, ' + v.length + ' байт>', '<file, ' + v.length + ' bytes>');
        const cache = {};
        for (const w of wanted) {
          cache[w.alg] = cache[w.alg] || H.hashHex(w.alg, bytes);
          if (cache[w.alg] === w.digest) matches.push({ candidate: label, alg: w.alg, digest: w.digest });
        }
      }
    }
    return { matches, checked: candidates.length, wanted };
  }

  function formatCheck(r) {
    const algs = [...new Set(r.wanted.map((w) => H.ALGS[w.alg].name))].join(', ');
    const note = r.wanted.some((w) => w.alg === 'md5')
      ? T('\n(32 hex проверяются как MD5; NTLM/MD4 и токены этим способом не проверяются.)', '\n(32 hex are checked as MD5; NTLM/MD4 and plain tokens are not covered.)')
      : '';
    if (!r.matches.length) {
      return T('НЕТ СОВПАДЕНИЯ — проверено кандидатов: ' + r.checked + ' (' + algs + ').', 'NO MATCH — candidates checked: ' + r.checked + ' (' + algs + ').') + note;
    }
    const lines = r.matches.map((m) => T('СОВПАДЕНИЕ [' + H.ALGS[m.alg].name + ']: ' + JSON.stringify(m.candidate), 'MATCH [' + H.ALGS[m.alg].name + ']: ' + JSON.stringify(m.candidate)));
    return lines.join('\n') + note;
  }

  // ---------- регистрация ----------
  function hashInput(t, p) {
    const text = NS.isHandle(t) || !p.strip ? t : t.trim();
    return NS.bytesOf(text, p.enc);
  }

  const common = (extra) => [
    { key: 'enc', label: T('Кодировка текста', 'Text encoding'), type: 'select', options: ENC_OPTIONS, default: 'utf8' },
    { key: 'strip', label: T('Убрать пробелы по краям', 'Trim surrounding whitespace'), type: 'bool', default: false },
    { key: 'upper', label: T('Заглавные hex', 'Uppercase hex'), type: 'bool', default: false },
  ].concat(extra || []);

  const fmtDigest = (hex, p) => (p.upper ? hex.toUpperCase() : hex);

  const ALG_DESC = {
    md5: T('MD5 (128 бит). Не для безопасности — но так часто «прячут» пароли и ответы в ARG. Для файла-артефакта хешируются его байты.',
      'MD5 (128 bits). Not secure, yet common for “hidden” answers in ARGs. For an artifact input its bytes are hashed.'),
    sha1: T('SHA-1 (160 бит) текста или файла.', 'SHA-1 (160 bits) of text or a file.'),
    sha256: T('SHA-256 (256 бит) текста или файла.', 'SHA-256 (256 bits) of text or a file.'),
    sha512: T('SHA-512 (512 бит) текста или файла.', 'SHA-512 (512 bits) of text or a file.'),
    crc32: T('CRC32 (32 бита, контрольная сумма zip/png) текста или файла.', 'CRC32 (32-bit checksum of zip/png) of text or a file.'),
  };

  for (const alg of ['md5', 'sha1', 'sha256', 'sha512', 'crc32']) {
    G.CipherOps.def({
      id: 'hash_' + alg, name: T('Хеш ', 'Hash ') + H.ALGS[alg].name, cat: CAT,
      desc: ALG_DESC[alg] + T(' Между символами и байтами выбирай кодировку явно.', ' Choose the byte encoding explicitly.'),
      params: common(),
      run([t], p) { return fmtDigest(H.hashHex(alg, hashInput(t, p)), p); },
    });
  }

  G.CipherOps.def({
    id: 'hash_all', name: T('Все хеши', 'All hashes'), cat: CAT,
    desc: T('MD5, SHA-1, SHA-256, SHA-512 и CRC32 одной таблицей.', 'MD5, SHA-1, SHA-256, SHA-512 and CRC32 in one table.'),
    params: common(),
    run([t], p) {
      const bytes = hashInput(t, p);
      return Object.keys(H.ALGS).map((a) => H.ALGS[a].name.padEnd(8) + fmtDigest(H.hashHex(a, bytes), p)).join('\n');
    },
  });

  G.CipherOps.def({
    id: 'hash_check', name: T('Проверка хеша', 'Hash check'), cat: CAT,
    inputs: [T('кандидаты', 'candidates'), T('дайджест', 'digest')],
    desc: T('Совпадает ли хеш кандидата(ов) (по строке на вход) с данным дайджестом. Алгоритм определяется по длине: 8=CRC32, 32=MD5, 40=SHA-1, 64=SHA-256, 128=SHA-512. Дайджест — со второго входа или из параметра.',
      'Does the hash of the candidate(s) (one per line) equal the given digest? The algorithm is detected by length: 8=CRC32, 32=MD5, 40=SHA-1, 64=SHA-256, 128=SHA-512. The digest comes from the second input or the parameter.'),
    params: [
      { key: 'digest', label: T('Дайджест (если нет второго входа)', 'Digest (when the second input is unused)'), type: 'text', default: '' },
      { key: 'alg', label: T('Алгоритм', 'Algorithm'), type: 'select', options: [['auto', T('По длине', 'By length')], ['md5', 'MD5'], ['sha1', 'SHA-1'], ['sha256', 'SHA-256'], ['sha512', 'SHA-512'], ['crc32', 'CRC32']], default: 'auto' },
      { key: 'enc', label: T('Кодировка текста', 'Text encoding'), type: 'select', options: ENC_OPTIONS, default: 'utf8' },
      { key: 'lines', label: T('Каждая строка — отдельный кандидат', 'Each line is a separate candidate'), type: 'bool', default: true },
      { key: 'loose', label: T('Пробовать и без пробелов по краям', 'Also try without surrounding whitespace'), type: 'bool', default: true },
      { key: 'output', label: T('Результат', 'Output'), type: 'select', options: [['report', T('Отчёт', 'Report')], ['match', T('Совпавший кандидат (или ошибка)', 'Matching candidate (or an error)')]], default: 'report' },
    ],
    run([cands, dig], p) {
      const source = dig !== undefined && dig !== null && String(dig).trim() ? String(dig) : p.digest;
      const digests = extractDigests(source);
      if (!digests.length) throw new Error(T('Нужен дайджест: hex длиной 8, 32, 40, 64 или 128 символов', 'A digest is required: hex of 8, 32, 40, 64 or 128 characters'));
      const list = NS.isHandle(cands) ? [NS.artifactBytes(cands)] : candidateList(String(cands), p.lines);
      const r = checkCandidates(list, digests, p);
      if (p.output === 'match') {
        if (!r.matches.length) throw new Error(T('Нет совпадений среди ' + r.checked + ' кандидатов', 'No match among ' + r.checked + ' candidates'));
        return r.matches.map((m) => m.candidate).join('\n');
      }
      return formatCheck(r);
    },
  });

  G.CipherOps.def({
    id: 'hash_identify', name: T('Что это за хеш?', 'What kind of hash?'), cat: CAT,
    desc: T('Объясняет, чем может быть hex/Base64-строка по длине: MD5, NTLM, SHA-1… или просто токен. Хеши проверяются кандидатом, а не расшифровываются.',
      'Explains what a hex/Base64 string could be by its length: MD5, NTLM, SHA-1… or just a token. Hashes are verified with a candidate, not decrypted.'),
    run([t]) { return identifyText(String(t)); },
  });

  NS.HashOps = { identifyToken, identifyText, extractDigests, checkCandidates, formatCheck };
})(typeof self !== 'undefined' ? self : this);
