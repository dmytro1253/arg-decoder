// Готовые графы: универсальные примеры и учебные цепочки. Примеры дела mslan помечены profile: 'mslan'.
// i18n-file-ok: названия и описания переводит таблица EN ниже (полноту проверяет tests/presets.test.js).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const n = (id, type, x, y, params) => ({ id, type, x, y, params: params || {} });
  const l = (from, to, port) => ({ from, to, port: port || 0 });

  G.Presets = [
    {
      id: 'welcome', title: 'Старт: вставь шифр', desc: 'Ввод → авто-расшифровка → результат',
      nodes: [
        n('n1', 'input', 40, 60, { text: '48656C6C6F20776F726C64' }),
        n('n2', 'auto', 360, 60, { depth: '3' }),
        n('n3', 'note', 40, 330, { text: T('Вставь шифр в «Ввод» и нажми «⚡ Расшифровать». Нажми «В граф» у результата — цепочка развернётся нодами, параметры можно менять руками.\n\nНоды добавляются из списка слева (клик или перетаскивание) или двойным кликом по пустому месту. Провода тянутся от кружка справа в заголовке к кружку входа.', 'Paste a cipher into “Input” and press “⚡ Decrypt”. Press “To graph” on a result and the chain unfolds into nodes whose parameters you can edit by hand.\n\nAdd nodes from the list on the left (click or drag) or by double-clicking an empty spot. Drag wires from the circle on the right of a node header to the input circle of another node.') }),
      ],
      links: [l('n1', 'n2')],
    },
    {
      id: 'vigenere', title: 'Сансара: Виженер', desc: 'h2njbrLB5kj + ключ из раскладки «найдименя»',
      nodes: [
        n('n1', 'input', 40, 40, { text: 'h2njbrLB5kj' }),
        n('n2', 'input', 40, 260, { text: 'найдименя' }),
        n('n3', 'op:layout', 340, 260, { dir: 'ru2en' }),
        n('n4', 'op:vigenere', 640, 40, { key: '', dir: 'dec', alpha: 'en', skip: true }),
        n('n5', 'youtube', 960, 40),
      ],
      links: [l('n1', 'n4'), l('n2', 'n3'), l('n3', 'n4', 1), l('n4', 'n5')],
    },
    {
      id: 'hex23', title: '839: HEX → +23', desc: '54303958533C3C634B3121 → kGPojSSzbH8',
      nodes: [
        n('n1', 'input', 40, 40, { text: '54303958533C3C634B3121' }),
        n('n2', 'op:hex_decode', 340, 40),
        n('n3', 'op:char_shift', 620, 40, { n: 23 }),
        n('n4', 'youtube', 920, 40),
      ],
      links: [l('n1', 'n2'), l('n2', 'n3'), l('n3', 'n4')],
    },
    {
      id: 'ktoty', title: 'КТО ТЫ?: числа → URL → CP1251', desc: 'Пары цифр +23, потом %-декодирование',
      nodes: [
        n('n1', 'input', 40, 40, { text: '14444214452714444620144527144543142847' }),
        n('n2', 'op:dec_codes', 340, 40, { width: '2', shift: 23 }),
        n('n3', 'op:url_decode', 640, 40, { enc: 'cp1251', plus: true }),
        n('n4', 'view', 940, 40),
      ],
      links: [l('n1', 'n2'), l('n2', 'n3'), l('n3', 'n4')],
    },
    {
      id: 'catbox', title: 'Ссылка из чисел', desc: '8193… → https://files.catbox.moe/1gukbv.png',
      nodes: [
        n('n1', 'input', 40, 40, { text: '81939389921428421427471427477982857892237674937588972386887814274726809484759523898780' }),
        n('n2', 'op:dec_codes', 340, 40, { width: '2', shift: 23 }),
        n('n3', 'op:url_decode', 640, 40, { enc: 'utf8', plus: false }),
        n('n4', 'view', 940, 40),
      ],
      links: [l('n1', 'n2'), l('n2', 'n3'), l('n3', 'n4')],
    },
    {
      id: 'drive', title: 'Ссылка на Google Drive из HEX', desc: '31 6E 7A 47 … → ID папки',
      nodes: [
        n('n1', 'input', 40, 40, { text: '31 6E 7A 47 68 4E 48 56 45 51 48 62 69 36 41 50 7A 55 55 36 42 65 47 70 7A 34 32 37 53 4D 75 62 6D' }),
        n('n2', 'op:hex_decode', 340, 40),
        n('n3', 'view', 640, 40),
      ],
      links: [l('n1', 'n2'), l('n2', 'n3')],
    },
    {
      id: 'pomogi', title: 'ПомогиНам: Base64 → реверс → Цезарь', desc: 'Пример приёма из другого (решённого) ролика',
      nodes: [
        n('n1', 'input', 40, 40, { text: '0YjQu9Cp0YTQvtGK0YjRitCr' }),
        n('n2', 'op:base64_decode', 340, 40),
        n('n3', 'op:bytes_decode', 620, 40, { enc: 'utf8' }),
        n('n4', 'op:reverse', 900, 40),
        n('n5', 'op:caesar', 1180, 40, { alpha: 'ru33', n: -12 }),
        n('n6', 'view', 1460, 40),
      ],
      links: [l('n1', 'n2'), l('n2', 'n3'), l('n3', 'n4'), l('n4', 'n5'), l('n5', 'n6')],
    },
    {
      id: 'mask', title: 'Навсегда: перебор маски', desc: '?y?xPVyp8H0 — 4096 вариантов через YouTube',
      nodes: [
        n('n1', 'mask', 40, 40, { mask: '?y?xPVyp8H0' }),
        n('n2', 'youtube', 420, 40),
        n('n3', 'note', 420, 330, { text: T('Исходная маска: _y_xPVyp_H_\n1: пятый символ имени из медного гроба\n2: второй символ самого первого ключа → g\n3: сколько ушли в бездну → 8\n4: последний символ имени рыбака → 0\nНаходка: yygxPVyp8H0 (вариант 3233 из 4096).', 'Original mask: _y_xPVyp_H_\n1: the fifth character of the name from the copper coffin\n2: the second character of the very first key → g\n3: how many went into the abyss → 8\n4: the last character of the fisherman’s name → 0\nFound: yygxPVyp8H0 (variant 3233 of 4096).') }),
      ],
      links: [l('n1', 'n2')],
    },
    {
      id: 'book', title: 'Книга (не разгадана)', desc: 'PSRLVMBHALDPRNG / CRBLQYCURKUZD',
      nodes: [
        n('n1', 'input', 40, 40, { text: 'PSRLVMBHALDPRNG' }),
        n('n2', 'input', 40, 250, { text: 'CRBLQYCURKUZD' }),
        n('n3', 'op:join', 340, 140, { sep: '' }),
        n('n4', 'analyze', 640, 40),
        n('n5', 'auto', 640, 420, { depth: '3' }),
        n('n6', 'note', 1000, 40, { text: T('Название: PSRLVMBHALDPRNG (15), автор: CRBLQYCURKUZD (13).\nПодсказка: «Тот же код что ссылка но с обратной стороны».\nСпойлер к финалу: «всё это время я наблюдал за самим собой».\nВ книге был hex-код ссылки на Drive. Подписант: Mslan_G.\nПроверено очень много (см. docs) — подтверждённого ответа нет.', 'Title: PSRLVMBHALDPRNG (15), author: CRBLQYCURKUZD (13).\nHint: “The same code as the link but from the other side”.\nFinale spoiler: “all this time I was watching myself”.\nThe book contained a hex code of a Drive link. Signed: Mslan_G.\nA great many attempts have been checked (see docs): there is no confirmed answer.') }),
      ],
      links: [l('n1', 'n3'), l('n2', 'n3', 1), l('n3', 'n4'), l('n3', 'n5')],
    },
  ];

  // Линейная цепочка: ввод → шаги → конец (результат или проверка YouTube).
  function chain(id, group, title, desc, text, steps, end) {
    const nodes = [n('n1', 'input', 40, 40, { text })];
    const links = [];
    steps.forEach(([type, params], i) => {
      nodes.push(n('n' + (i + 2), type, 340 + i * 290, 40, params));
      links.push(l('n' + (i + 1), 'n' + (i + 2)));
    });
    const last = steps.length + 1;
    nodes.push(n('n' + (last + 1), end || 'view', 340 + steps.length * 290, 40));
    links.push(l('n' + last, 'n' + (last + 1)));
    return { id, group, title, desc, nodes, links };
  }

  const MS = 'mslan: решённые этапы';
  const FOREIGN = 'Зарубежные ARG';
  const DEMO = 'Шифры для тренировки';

  G.Presets.push(
    chain('void', MS, 'VOID: HEX → +23', '3F38322D → ?82- → VOID', '3F38322D', [['op:hex_decode'], ['op:char_shift', { n: 23 }]]),
    chain('kto-reverse', MS, 'Реверс: КтоНибудь…', 'саНетисапС… → КтоНибудьПожалуйстаСпаситеНас', 'саНетисапСатсйулажоПьдубиНотК', [['op:reverse']]),
    {
      id: 'fragments', group: MS, title: 'Найди меня: склейка фрагментов', desc: 'AgL + L2GD + LrgQ из описаний трёх частей',
      nodes: [
        n('n1', 'input', 40, 20, { text: 'AgL' }), n('n2', 'input', 40, 210, { text: 'L2GD' }), n('n3', 'input', 40, 400, { text: 'LrgQ' }),
        n('n4', 'op:join3', 340, 200, { sep: '' }), n('n5', 'youtube', 640, 200),
      ],
      links: [l('n1', 'n4'), l('n2', 'n4', 1), l('n3', 'n4', 2), l('n4', 'n5')],
    },
    {
      id: 'key-parts', group: MS, title: 'Ключ из трёх частей', desc: 'yfq + lbv + tyz → ключ Виженера (порядок частей можно менять)',
      nodes: [
        n('n1', 'input', 40, 20, { text: 'yfq' }), n('n2', 'input', 40, 210, { text: 'lbv' }), n('n3', 'input', 40, 400, { text: 'tyz' }),
        n('n4', 'op:join3', 340, 200, { sep: '' }), n('n5', 'op:layout', 640, 360, { dir: 'en2ru' }),
        n('n6', 'input', 340, 0, { text: 'h2njbrLB5kj' }), n('n7', 'op:vigenere', 640, 0, { key: '', alpha: 'en' }), n('n8', 'youtube', 960, 0),
      ],
      links: [l('n1', 'n4'), l('n2', 'n4', 1), l('n3', 'n4', 2), l('n4', 'n5'), l('n6', 'n7'), l('n4', 'n7', 1), l('n7', 'n8')],
    },
    chain('ru-leet', MS, 'Пары +23 → CP1251 → русский латиницей', '9314454320… → tЫ N3 SпАs3шЬ NХ → «ты не спасешь нх»', '93144543205528206014464714442592281447331445442055144530', [['op:dec_codes', { width: '2', shift: 23 }], ['op:url_decode', { enc: 'cp1251', plus: true }], ['op:ru_leet', { mode: 'phonetic' }]]),
    chain('kira', MS, 'Пары +23 → CP1251 → реверс', '1446251447… → %елТыъКира («Чел, ты Кира?» с опечатками автора)', '14462514472514463314444214474214474314452714464314463014', [['op:dec_codes', { width: '2', shift: 23 }], ['op:url_decode', { enc: 'cp1251', plus: true }], ['op:reverse']]),
    chain('direct', MS, 'прощай.: прямой ID', 'sQjZoZ5abcw — проверить без преобразований', 'sQjZoZ5abcw', [], 'youtube'),

    chain('dng-hex', FOREIGN, 'Dungeons II: hex в адресе', 'Слаг ссылки aka.ms 0x7370696365776f6f64 → spicewood (ARG Minecraft Dungeons II)', '0x7370696365776f6f64', [['op:hex_decode']]),
    chain('dng-leet', FOREIGN, 'Dungeons II: leet', '1NF3C7ED → INFECTED (подсказка нотных блоков)', '1NF3C7ED', [['op:leet']]),
    chain('dng-z85', FOREIGN, 'Dungeons II: Z85 → hex → текст', 'Приём из профилей Discord-модераторов (строка учебная)', 'h-9ALhz)lzh-0uLhBxwWhBPIWhz)lzhz)xGhAiP:hz)AH', [['op:base85_decode', { variant: 'z85' }], ['op:hex_decode']]),
    chain('dng-grid', FOREIGN, 'Dungeons II: поворот сетки + Виженер', 'Сетка, поворот на 90° против часовой, потом Виженер EVERYSOUL (строка учебная)', 'NRCXOJNTNYHJMGSCBPOWIIPCCBVLWM', [['op:grid_rotate', { w: 6, op: 'ccw' }], ['op:vigenere', { key: 'EVERYSOUL', alpha: 'en' }]]),
    chain('dng-hexvig', FOREIGN, 'Dungeons II: hex + Виженер', 'Hex → текст → Виженер с ключом из прошлой загадки (строка учебная, ключ descent)', '77 6C 77 20 79 65 65 77 68 72 20 7A 67 65 65 6C 20 62 73 6D', [['op:hex_decode'], ['op:vigenere', { key: 'descent', alpha: 'en' }]]),
    chain('gd-b64', FOREIGN, 'Game Detectives: Base64', 'Y3J5c3RhbGxpbmUgdHJ1dGhzIA== → crystalline truths', 'Y3J5c3RhbGxpbmUgdHJ1dGhzIA==', [['op:base64_decode'], ['op:bytes_decode']]),

    chain('sga', DEMO, 'Стол зачарований (SGA)', 'Простая подстановка глифов, встречается в головоломках по Minecraft', 'ℸ ̣⍑ᒷ ᒷリ↸ ╎ᓭ リᒷ⍊ᒷ∷ ℸ ̣⍑ᒷ ᒷリ↸', [['op:sga_decode']]),
    chain('tap', DEMO, 'Тап-код (стуки)', 'Стуки в звуке или мигание ламп → квадрат 5×5', '.. ...  . .....  .... ..  ... ....  . ..  .... ..  .. ....  ... ...  . .....', [['op:tap_code']]),
    chain('t9', DEMO, 'DTMF / телефон', 'Тоны набора → цифры → мультитап', '66 666 8 222 44', [['op:t9']]),
    chain('bacon', DEMO, 'Шифр Бэкона', 'A/B группами по 5 (бывает спрятан в регистре букв)', 'ABBAB ABBBA BAABB AAABA AABBB', [['op:bacon']]),
    chain('polybius', DEMO, 'Квадрат Полибия', 'Пары «строка-столбец»', '15 33 14 15 42 32 11 33', [['op:polybius']]),
    chain('atbash', DEMO, 'Атбаш', 'Зеркальный алфавит', 'dzpv fk svilyirmv', [['op:atbash']]),
    chain('homoglyph', DEMO, 'Кириллица среди латиницы', 'Похожие буквы как скрытые биты', 'Thе quick brоwn fох jumps over thе lаzy dog', [['op:homoglyph', { mode: 'mark' }]])
  );
  const UNIVERSAL = 'Универсальные примеры';
  G.Presets.push(
    chain('numbers-mod', UNIVERSAL, 'Числа → буквы по модулю 26', '27 12 12 15 … → ALLOFTHEDOTS… (27 → A, 30 → D)', '27 12 12 15 6 20 8 5 4 15 20 19 1 18 5 6 9 14 1 12 12 25\n19 20 1 18 20 9 14 7 20 15 3 15 14 14 5 3 20,\n23 8 15 11 14 5 23 30 15 12 16 8 9 14 19 23 5 18 5 8 9\n4 9 14 7 19 15 13 21 3 8?', [['op:num_letters', { alpha: 'en', base: 1, range: 'modulo', breaks: 'punct', out: 'upper' }]]),
    chain('hex-plain', UNIVERSAL, 'HEX → текст', '41414141 → AAAA', '41414141', [['op:hex_decode']]),
    chain('log-hex', UNIVERSAL, 'HEX внутри лога', 'jimmyy1[local:E:73746f70] … → кандидат 73746f70 → stop', 'jimmyy1[local:E:73746f70] logged in with entity id 65', [['op:extract_candidates', { kind: 'hex', n: 1 }], ['op:hex_decode']]),
    chain('case-bits', UNIVERSAL, 'Регистр как биты', 'Заглавная = 1, строчная = 0 → двоичный код → текст', 'hELLO wORLD Hi ThErE', [['op:case_bits', { upper: '1', out: 'bits' }]])
  );
  // ---------- профили и английские названия ----------
  // Примеры дела mslan помечены profile: 'mslan' — это необязательный кейс, а не умолчание приложения.
  const MSLAN_PRESETS = new Set(['vigenere', 'hex23', 'ktoty', 'catbox', 'drive', 'pomogi', 'mask', 'book', 'void', 'kto-reverse', 'fragments', 'key-parts', 'ru-leet', 'kira', 'direct']);
  for (const preset of G.Presets) preset.profile = MSLAN_PRESETS.has(preset.id) ? 'mslan' : 'neutral';
  // Первые этапы mslan созданы раньше групп — собираем их в одну группу с остальными этапами кейса.
  for (const preset of G.Presets) if (!preset.group && preset.id !== 'welcome' && MSLAN_PRESETS.has(preset.id)) preset.group = MS;

  const EN_GROUPS = { [UNIVERSAL]: 'Universal examples', [MS]: 'mslan case: solved stages', [FOREIGN]: 'Foreign ARGs', [DEMO]: 'Practice ciphers' };
  const EN = {
    welcome: ['Start: paste a cipher', 'Input → auto-decrypt → result'],
    vigenere: ['Samsara: Vigenère', 'h2njbrLB5kj + a key from the keyboard layout “найдименя”'],
    hex23: ['839: HEX → +23', '54303958533C3C634B3121 → kGPojSSzbH8'],
    ktoty: ['КТО ТЫ?: numbers → URL → CP1251', 'Digit pairs +23, then %-decoding'],
    catbox: ['A link from numbers', '8193… → https://files.catbox.moe/1gukbv.png'],
    drive: ['A Google Drive link from HEX', '31 6E 7A 47 … → folder ID'],
    pomogi: ['ПомогиНам: Base64 → reverse → Caesar', 'A technique from another (solved) video'],
    mask: ['Forever: mask brute force', '?y?xPVyp8H0 — 4096 variants through YouTube'],
    book: ['The book (unsolved)', 'PSRLVMBHALDPRNG / CRBLQYCURKUZD'],
    void: ['VOID: HEX → +23', '3F38322D → ?82- → VOID'],
    'kto-reverse': ['Reverse: КтоНибудь…', 'саНетисапС… → КтоНибудьПожалуйстаСпаситеНас'],
    fragments: ['Find me: joining fragments', 'AgL + L2GD + LrgQ from the descriptions of three parts'],
    'key-parts': ['A key from three parts', 'yfq + lbv + tyz → a Vigenère key (the order of parts can change)'],
    'ru-leet': ['Pairs +23 → CP1251 → Russian in Latin', '9314454320… → “ты не спасешь нх”'],
    kira: ['Pairs +23 → CP1251 → reverse', '1446251447… → %елТыъКира (with the author’s typos)'],
    direct: ['goodbye.: a direct ID', 'sQjZoZ5abcw — check it without any transformation'],
    'dng-hex': ['Dungeons II: hex in an address', 'A link slug 0x7370696365776f6f64 → spicewood'],
    'dng-leet': ['Dungeons II: leet', '1NF3C7ED → INFECTED (a note-block hint)'],
    'dng-z85': ['Dungeons II: Z85 → hex → text', 'A technique from Discord moderator profiles (a teaching string)'],
    'dng-grid': ['Dungeons II: grid rotation + Vigenère', 'Grid, 90° counter-clockwise turn, then Vigenère EVERYSOUL (a teaching string)'],
    'dng-hexvig': ['Dungeons II: hex + Vigenère', 'Hex → text → Vigenère with a key from a previous puzzle (a teaching string)'],
    'gd-b64': ['Game Detectives: Base64', 'Y3J5c3RhbGxpbmUgdHJ1dGhzIA== → crystalline truths'],
    sga: ['Enchanting table (SGA)', 'A simple glyph substitution seen in Minecraft puzzles'],
    tap: ['Tap code (knocks)', 'Knocks in audio or flashing lamps → a 5×5 square'],
    t9: ['DTMF / phone', 'Tones → digits → multitap'],
    bacon: ['Bacon cipher', 'A/B in groups of 5 (sometimes hidden in letter case)'],
    polybius: ['Polybius square', '“row-column” pairs'],
    atbash: ['Atbash', 'A mirrored alphabet'],
    homoglyph: ['Cyrillic among Latin', 'Look-alike letters as hidden bits'],
    'numbers-mod': ['Numbers → letters modulo 26', '27 12 12 15 … → ALLOFTHEDOTS… (27 → A, 30 → D)'],
    'hex-plain': ['HEX → text', '41414141 → AAAA'],
    'log-hex': ['HEX inside a log', 'jimmyy1[local:E:73746f70] … → candidate 73746f70 → stop'],
    'case-bits': ['Letter case as bits', 'Uppercase = 1, lowercase = 0 → binary → text'],
  };
  if (G.I18n && G.I18n.lang === 'uk') {
    for (const preset of G.Presets) {
      preset.title = G.I18n.uk(preset.title);
      preset.desc = G.I18n.uk(preset.desc);
      if (preset.group) preset.group = G.I18n.uk(preset.group);
    }
  }
  if (G.I18n && G.I18n.lang === 'en') {
    for (const preset of G.Presets) {
      const en = EN[preset.id];
      if (en) { preset.title = en[0]; preset.desc = en[1]; }
      if (preset.group && EN_GROUPS[preset.group]) preset.group = EN_GROUPS[preset.group];
    }
  }
})(typeof self !== 'undefined' ? self : this);
