// Примеры из проверки дополнительных завершённых ARG (аудит 2026-10-23): Killing Floor 2, Dr. Langeskov, 76543,
// Steam Winter 2015. Входы точные, из исходных страниц и обсуждений; пробелы и регистр не нормализованы.
// Поле solve разделяет: auto — слепой авто-поиск решает сам (ключи ему не передаются); auto-server — то же, но нужен
// локальный Python-движок; key — ручное решение с ключом, добытым на предыдущем этапе; context — нужен человек.
// Ключи из этих примеров не добавляются ни в словари, ни в профили.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const { Board, define, sourceNote } = G.PresetKit;
  const HIGH = T('высокая: точный вход с исходной страницы', 'high: the exact input from the original page');
  const solve = (spec) => { const p = G.Presets[G.Presets.length - 1]; p.solve = spec; return p; };

  // Простая цепочка: вход → шаги → результат, заметка об источнике.
  function simple(id, arg, title, desc, text, steps, note, source, reliability, answer, how) {
    const b = new Board();
    let cur = b.add('input', 0, 0, { text });
    for (const [type, params] of steps) cur = b.then(cur, type, params);
    b.then(cur, 'view');
    b.note(0, 1, sourceNote(note, source, reliability || HIGH));
    define(Object.assign({ id, arg, title, desc, expect: [answer] }, how), b);
  }
  simple("dl-binary", "langeskov", T("Dr. Langeskov: биты → имя документа", "Dr. Langeskov: bits → a document name"), T("144 бита со страницы 4.html → elgar-INVOICE.html", "144 bits from page 4.html → elgar-INVOICE.html"), "011001010110110001100111011000010111001000101101010010010100111001010110010011110100100101000011010001010010111001101000011101000110110101101100", [['op:binary_decode', {}]],
    T("Двоичная строка со скрытой страницы — восемь бит на символ. Переход к документу (подставить имя в адрес) — действие человека, не расшифровка.",
      "A binary string from a hidden page, eight bits per character. Going to the document (putting the name into the address) is a human step, not decryption."),
    "https://crowscrowscrows.com/report/4.html", null, "elgar-INVOICE.html", { auto: { input: "011001010110110001100111011000010111001000101101010010010100111001010110010011110100100101000011010001010010111001101000011101000110110101101100", expect: 'elgar-INVOICE.html', top: 1 } });
  solve("auto");
  simple("dl-hex", "langeskov", T("Dr. Langeskov: hex → путь к звуку", "Dr. Langeskov: hex → a sound path"), T("736f756e64… → sounds/boot.mp3", "736f756e64… → sounds/boot.mp3"), "736f756e64732f626f6f742e6d7033", [['op:hex_decode', {}]],
    T("Hex на странице admin.html даёт относительный путь к MP3 со SSTV-картинкой.",
      "Hex on admin.html gives a relative path to an MP3 with an SSTV picture."),
    "https://crowscrowscrows.com/report/admin.html", null, "sounds/boot.mp3", { auto: { input: "736f756e64732f626f6f742e6d7033", expect: 'sounds/boot.mp3', top: 1 } });
  solve("auto");
  simple("dl-base64", "langeskov", T("Dr. Langeskov: короткий Base64", "Dr. Langeskov: a short Base64"), T("b2ggbm8gOig= → oh no :(", "b2ggbm8gOig= → oh no :("), "b2ggbm8gOig=", [['op:base64_decode', {}]],
    T("Короткий валидный Base64 с осмысленным ответом не должен проигрывать длинным произвольным цепочкам — прежде на глубине 4 так и было.",
      "A short valid Base64 with a meaningful answer must not lose to long arbitrary chains; at depth 4 it used to."),
    "https://crowscrowscrows.com/report/admin.html", null, "oh no :(", { auto: { input: "b2ggbm8gOig=", expect: 'oh no :(', top: 1 } });
  solve("auto");
  simple("dl-base32", "langeskov", T("Dr. Langeskov: Base32 из двух кусков", "Dr. Langeskov: Base32 from two pieces"), T("Два прерванных Base32 из письма 5346044, склеенные вручную", "Two interrupted Base32 runs from message 5346044, joined by hand"), "MQQESJ3NEBZW6IDIMFYHA6JAO5UXI2BANBXXOIDJOQTXGIDUOVZG4ZLEEBXXK5BOEBGHKY3LNFWHSIDXMUQG63TMPEQGY33TOQQGCIDDN52XA3DFEBXWMIDWNFXWY2LONFZXI4ZAMFXGIIDCMFZXG33PNZUXG5BAORXSA5DIMUQHG5DSNFVWKLBAMJ2XIIBIMFXGIICJEBRWC3RAONQXSIDUNBUXGIDTNFXGGZJAORUGK6JHOZSSAZ3PNZSSSLBANZXWE33EPEQHEZLBNRWHSIDOMVSWI4ZAMJQXG43PN5XGS43UOMXCASLOEBQW46JAMNQXGZJMEB3WKIDUNBXXKZ3IOQQGS5BANVUWO2DUEBRGKIDONFRWKIDUN4QHG2DPO4QHS33VEB3WQYLUEB3WKJ3WMUQGO33UFYQA", [['op:base32_decode', {}]],
    T("Подготовка ручная: два куска Base32 вырезаны из испорченного письма и склеены (ни одной буквы не добавлено). Текст начинается с хвоста оборванного слова — «d » в начале не ошибка.",
      "The preparation is manual: two Base32 runs were cut from a corrupted message and joined (no letters added). The text starts with the tail of a broken word, so the leading “d ” is not an error."),
    "https://crowscrowscrows.com/report/message-5346044.html", null, "d I'm so happy with how it's turned out. Luckily we only lost a couple of violinists and bassoonist to the strike, but (and I can say this since they've gone), nobody really needs bassoonists. In any case, we thought it might be nice to show you what we've got. ", { auto: { input: "MQQESJ3NEBZW6IDIMFYHA6JAO5UXI2BANBXXOIDJOQTXGIDUOVZG4ZLEEBXXK5BOEBGHKY3LNFWHSIDXMUQG63TMPEQGY33TOQQGCIDDN52XA3DFEBXWMIDWNFXWY2LONFZXI4ZAMFXGIIDCMFZXG33PNZUXG5BAORXSA5DIMUQHG5DSNFVWKLBAMJ2XIIBIMFXGIICJEBRWC3RAONQXSIDUNBUXGIDTNFXGGZJAORUGK6JHOZSSAZ3PNZSSSLBANZXWE33EPEQHEZLBNRWHSIDOMVSWI4ZAMJQXG43PN5XGS43UOMXCASLOEBQW46JAMNQXGZJMEB3WKIDUNBXXKZ3IOQQGS5BANVUWO2DUEBRGKIDONFRWKIDUN4QHG2DPO4QHS33VEB3WQYLUEB3WKJ3WMUQGO33UFYQA", expect: "d I'm so happy with how it's turned out. Luckily we only lost a couple of violinists and bassoonist to the strike, but (and I can say this since they've gone), nobody really needs bassoonists. In any case, we thought it might be nice to show you what we've got. ", top: 1 } });
  solve("auto");
  simple("dl-ascii85", "langeskov", T("Dr. Langeskov: ASCII85 → координаты", "Dr. Langeskov: ASCII85 → coordinates"), T("1c6mG1,UpL2BXt32)RBQ1GA → 45.925596 8.559730", "1c6mG1,UpL2BXt32)RBQ1GA → 45.925596 8.559730"), "1c6mG1,UpL2BXt32)RBQ1GA", [['op:base85_decode', { variant: 'ascii85' }]],
    T("Пара широта/долгота — структурный ответ без слов; авто-поиск помечает его типом «координаты». Название места и следующий адрес — контекстные шаги.",
      "A latitude/longitude pair is a structured answer without words; the auto search tags it as “coordinates”. The place name and the next address are context steps."),
    "https://crowscrowscrows.com/report/message-5346061.html", null, "45.925596 8.559730", { auto: { input: "1c6mG1,UpL2BXt32)RBQ1GA", expect: '45.925596 8.559730', top: 1 } });
  solve("auto");
  simple("dl-scottie", "langeskov", T("Dr. Langeskov: имя файла → hex → Цезарь −1", "Dr. Langeskov: a file name → hex → Caesar −1"), T("74647075756a66 → tdpuujf → scottie (подсказка режима SSTV)", "74647075756a66 → tdpuujf → scottie (an SSTV mode hint)"), "74647075756a66", [['op:hex_decode', {}], ['op:caesar', { alpha: 'en', n: -1 }]],
    T("Имя MP3 само по себе подсказка: hex, затем сдвиг на −1. Само имя файла человек берёт со страницы — это зависимый этап. Сам звук декодируется нодой SSTV (Scottie S1, режим определяется по периоду строк).",
      "The MP3 name is itself a hint: hex, then a shift of −1. A person takes the file name from the page, so this is a dependent stage. The sound itself is decoded by the SSTV node (Scottie S1, the mode is detected from the line period)."),
    "https://crowscrowscrows.com/report/sounds/74647075756a66.mp3", null, "scottie", { auto: { input: "74647075756a66", expect: 'scottie', top: 1 } });
  solve("auto");
  simple("kf2-compound", "kf2", T("Killing Floor 2: составное сообщение", "Killing Floor 2: a compound message"), T("Текст — Цезарь −3, путь — Цезарь −6: строки решаются по отдельности", "The text is Caesar −3, the path Caesar −6: the lines are solved separately"), "L krsh wklv phvvdjh pdnhv lw rxw! Kruclqh lv xs wr qr jrrg dqg wkh zruog qhhgv wr nqrz! Zlwk dqb oxfn brx'oo ghflskhu wklv dqg ilqg wkh foxhv L'oo eh ohdylqj. Brx duh wkh rqob krsh zh kdyh wr vwrs wklv ehiruh lw lv wrr odwh!\nlxusglxoktj/znkyzgxz.vtm", [['op:segment_map', { plan: JSON.stringify([[{ op: 'caesar', params: { alpha: 'en', n: -3 } }], [{ op: 'caesar', params: { alpha: 'en', n: -6 } }]]) }]],
    T("Две строки зашифрованы разными сдвигами. Авто-поиск находит это сам: решает строки отдельно и собирает результат с исходным переводом строки. Вырезанный кусок пути — не решение всего сообщения.",
      "The two lines use different shifts. The auto search finds this by itself: it solves the lines separately and joins the result with the original line break. A cut-out piece of the path is not a solution of the whole message."),
    "https://wiki.gamedetectives.net/w/Killing_Floor_2", null, "I hope this message makes it out! Horzine is up to no good and the world needs to know! With any luck you'll decipher this and find the clues I'll be leaving. You are the only hope we have to stop this before it is too late!\nfromafriend/thestart.png", { auto: { input: "L krsh wklv phvvdjh pdnhv lw rxw! Kruclqh lv xs wr qr jrrg dqg wkh zruog qhhgv wr nqrz! Zlwk dqb oxfn brx'oo ghflskhu wklv dqg ilqg wkh foxhv L'oo eh ohdylqj. Brx duh wkh rqob krsh zh kdyh wr vwrs wklv ehiruh lw lv wrr odwh!\nlxusglxoktj/znkyzgxz.vtm", expect: "I hope this message makes it out! Horzine is up to no good and the world needs to know! With any luck you'll decipher this and find the clues I'll be leaving. You are the only hope we have to stop this before it is too late!\nfromafriend/thestart.png", top: 1 } });
  solve("auto");
  simple("kf2-columnar", "kf2", T("Killing Floor 2: перестановка столбцов (значимый двойной пробел)", "Killing Floor 2: columnar transposition (a significant double space)"), T("55 символов, 12 столбцов; порядок столбцов подбирается без ключа", "55 characters, 12 columns; the column order is found without a key"), "ah?mIoehseuktene osn e  tg t okartih!yrCdhoo ge ne elcp", [['op:columnar', { key: 'belgjchkfadi', dir: 'dec' }]],
    T("Точная транскрипция содержит два пробела после «e» (55 символов); версия с одним пробелом теряет символ и не решается — это ошибка транскрипции, а не программы. Ключ в ноде — найденный подбором порядок [9,0,5,10,1,8,3,6,11,4,7,2], записанный буквами. Ответ «…mods page!» — точный результат перестановки; часто цитируют «mod pages».",
      "The exact transcription has two spaces after “e” (55 characters); the one-space version loses a character and does not solve, which is a transcription error, not a program error. The key in the node is the found order [9,0,5,10,1,8,3,6,11,4,7,2] written as letters. The answer “…mods page!” is the exact result; “mod pages” is often quoted."),
    "https://www.reddit.com/r/codes/comments/69abg1/comment/dh55bs2/", null, "Is there anyone out there looking? Check the mods page!", { auto: { input: "ah?mIoehseuktene osn e  tg t okartih!yrCdhoo ge ne elcp", expect: "Is there anyone out there looking? Check the mods page!", top: 1 } });
  solve("auto");
  (function kf2Vigenere() {
    const b = new Board();
    const ct = b.add('input', 0, 0, { text: "Ybn avogyo wii erqenje. Vm wf eb nsh vwjrz jydcr, tzy nolpg vt." });
    const key = b.add('input', 0, 1, { text: 'ANTONWOULDBEPROUND' });
    const dec = b.add('op:vigenere', 1, 0, { key: '', dir: 'dec', alpha: 'en', skip: true });
    b.wire(ct, dec, 0); b.wire(key, dec, 1);
    b.then(dec, 'view');
    b.note(0, 2, sourceNote(T('Ручное решение с ключом. Исторический ключ содержит лишнюю N (ANTONWOULDBEPROUND); без неё хвост портится — исправлять «опечатку» нельзя, она часть шифра. Слепой подбор этого 48-буквенного текста с 17-буквенным ключом не решает: данных мало, и программа честно говорит «ответ не определён».',
      'A manual solution with a key. The historical key has an extra N (ANTONWOULDBEPROUND); without it the tail breaks, and the “typo” must not be fixed because it is part of the cipher. A blind search does not solve this 48-letter text with a 17-letter key: there is too little data, and the program honestly says “answer not determined”.'), "https://wiki.gamedetectives.net/w/Killing_Floor_2", HIGH));
    define({ id: 'kf2-vigenere', arg: 'kf2', title: T('Killing Floor 2: Виженер с ключом из прошлого этапа', 'Killing Floor 2: Vigenère with a key from an earlier stage'),
      desc: T('Ключ ANTONWOULDBEPROUND с лишней N', 'The key ANTONWOULDBEPROUND with an extra N'), expect: ["You missed the package. It is in the usual place, all rared up."],
      manual: T('Ключ добыт на предыдущем этапе; слепой подбор 48 букв при 17-буквенном ключе невозможен', 'The key comes from an earlier stage; a blind search of 48 letters with a 17-letter key is not possible') }, b);
    solve('key');
  })();
  (function arVigenere() {
    const b = new Board();
    const ct = b.add('input', 0, 0, { text: "Sfsw wvc uw lfxopmxsx ybtjipf zt grz ss lpb lzzeysmk pviow ow naw omzw, wqmmmw xos zm’z r gsieiahzrpw. Xlu kppyilv pvlph sre “Usdrpalbskz? M yvced ufx”." });
    b.then(ct, 'vigcrack', { engine: 'python', mode: 'auto' });
    b.note(0, 1, sourceNote(T('Слепой подбор локальным Python-движком: без ключей и словарных подсказок он сам находит ключ из 24 букв и весь текст (около 3–5 с). Общий авто-поиск запускает этот движок сам, когда работает локальный сервер. Ответа в графе нет — его даёт запуск. Узнать в тексте отсылку (Шекспир) — уже вывод человека.',
      'A blind search by the local Python engine: with no keys or dictionary hints it finds the 24-letter key and the whole text by itself (about 3–5 s). The general auto search starts this engine by itself when the local server runs. The graph holds no answer; running it does. Recognising the reference (Shakespeare) is a human conclusion.'), "https://wiki.gamedetectives.net/w/76543", HIGH));
    define({ id: 'ar-vigenere', arg: 'a76543', title: T('76543: Виженер без ключа (Python-движок)', '76543: Vigenère without a key (Python engine)'),
      desc: T('Длинный шифртекст → ключ из 24 букв находится сам', 'A long ciphertext → the 24-letter key is found by itself'),
      manual: T('Нужен локальный Python-движок (запуск через Start): в Node-тестах сервера нет; при работающем сервере общий авто-поиск находит ответ первым', 'Needs the local Python engine (start with Start): Node tests have no server; with the server running the general auto search ranks the answer first') }, b);
    solve('auto-server');
  })();
  (function arCalc() {
    const b = new Board();
    const e = b.add('input', 0, 0, { text: '2*3*76543' });
    b.then(e, 'op:calc', { mode: 'value' });
    b.note(0, 1, sourceNote(T('Выражение составлено вручную из инструкции «умножь простые числа»; точная целочисленная арифметика даёт 459258. В историческом имени аккаунта написано 456258ARG — это опечатка автора, эталоном служит математический результат.',
      'The expression is built by hand from the instruction “multiply the primes”; exact integer arithmetic gives 459258. The historical account name reads 456258ARG, an author typo; the mathematical result is the reference.'), 'https://wiki.gamedetectives.net/w/76543', T('высокая для арифметики; выражение подготовлено человеком', 'high for the arithmetic; the expression was prepared by a person')));
    define({ id: 'ar-calc', arg: 'a76543', title: T('76543: точная арифметика', '76543: exact arithmetic'), desc: '2*3*76543 → 459258', expect: ['459258'], auto: { input: '2*3*76543', expect: '459258', top: 1 } }, b);
    solve('context');
  })();
  (function swAnagram() {
    const b = new Board();
    const letters = b.add('input', 0, 0, { text: 'LLLLHTBEEU' });
    b.then(letters, 'op:anagram_solve', { lang: 'en', maxWords: 2 });
    b.note(0, 1, sourceNote(T('Буквы извлечены вручную из речи: фонетические слова в изменённых формах, «Lima четыре раза» — значит четыре L. Это человеческая интерпретация; дальше анаграмма решается сама: hell bullet (порядок слов — BULLET HELL — по смыслу).',
      'The letters are extracted by hand from speech: phonetic words in altered forms, “Lima four times” means four Ls. That is human interpretation; then the anagram solves by itself: hell bullet (the word order, BULLET HELL, comes from meaning).'), 'https://wiki.gamedetectives.net/w/Steam_Winter_2015', T('высокая для анаграммы; извлечение букв ручное', 'high for the anagram; the letter extraction is manual')));
    define({ id: 'sw-anagram', arg: 'steam2015', title: T('Steam Winter 2015: анаграмма после извлечения букв', 'Steam Winter 2015: an anagram after extracting letters'),
      desc: 'LLLLHTBEEU → hell bullet', expect: ['hell bullet'],
      manual: T('Буквы из речи извлекает человек; авто-поиск сам анаграммы не перебирает', 'A person extracts the letters from speech; the auto search does not try anagrams by itself') }, b);
    solve('context');
  })();
})(typeof self !== 'undefined' ? self : this);
