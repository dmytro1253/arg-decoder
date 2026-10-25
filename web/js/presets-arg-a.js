// Примеры из разборов ARG, часть 1: OldRoot, HERMatrix, AlphaVer, Endermite, Archive11.
// Все строки взяты только из отчётов deep-research (1) и (3); шифртексты не выдумываются.
// Расхождения источников показываются честно («расхождение источника»), а не исправляются молча.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const { Board, define, sourceNote } = G.PresetKit;
  const REDDIT_OLDROOT = 'r/Minecraft + gist Voltasalt (OldRoot), r/OldRoot';

  // ---------- OldRoot ----------
  (function oldroot() {
    const caesar = (id, title, text, answer, where) => {
      const b = new Board();
      const inp = b.add('input', 0, 0, { text });
      const dec = b.then(inp, 'op:caesar', { alpha: 'en', n: -3 });
      b.then(dec, 'view');
      b.note(0, 1, sourceNote(
        T('Сдвиг −3 по английскому алфавиту (то же, что ROT23 вперёд). Совпадение точное, с пробелами и регистром. ' + where, 'Shift −3 over the English alphabet (the same as ROT23 forward). An exact match, including spaces and case. ' + where),
        REDDIT_OLDROOT, T('высокая (точная строка из треда решателей)', 'high (an exact string from the solver thread)')));
      define({ id, arg: 'oldroot', title, desc: text + ' → ' + answer, expect: [answer], auto: { input: text, expect: answer, top: 1 } }, b);
    };
    caesar('or-caesar-waiting', T('OldRoot: Цезарь −3 (WE ARE WAITING)', 'OldRoot: Caesar −3 (WE ARE WAITING)'), 'ZH DUH ZDLWLQJ', 'WE ARE WAITING',
      T('Строка найдена после осветления картинки; рядом Morse давал OLDROOT.', 'The line appeared after brightening an image; Morse next to it gave OLDROOT.'));
    caesar('or-caesar-prison', T('OldRoot: Цезарь −3 (whitelist-заявка)', 'OldRoot: Caesar −3 (whitelist application)'), 'WUDSSHG LQ D SULVRQ RI ZRRG', 'TRAPPED IN A PRISON OF WOOD',
      T('Строка из старой whitelist-заявки.', 'A line from an old whitelist application.'));

    // Vigenère с ключом LENORE: расхождение BEUORE / BEFORE
    const v = new Board();
    const ct = v.add('input', 0, 0, { text: 'JSH ALWE PROIR ELR DRWE FRIFVP XUS WYEYES' });
    const key = v.add('input', 0, 1, { text: 'LENORE' });
    const claim = v.add('input', 0, 2, { text: 'YOU MUST LEARN THE PAST BEFORE THE FUTURE' });
    const dec = v.add('op:vigenere', 1, 0, { key: '', dir: 'dec', alpha: 'en', skip: true });
    v.wire(ct, dec, 0); v.wire(key, dec, 1);
    v.then(dec, 'view');
    const diff = v.add('op:anagram_check', 2, 2, { other: '' });
    v.wire(dec, diff, 0); v.wire(claim, diff, 1);
    v.note(1, 1, sourceNote(
      T('РАСХОЖДЕНИЕ ИСТОЧНИКА. Стандартный Виженер (только буквы, A=0) с ключом LENORE даёт «…BEUORE…», а write-up приводит «…BEFORE…». Один символ либо неверно переписан, либо ошибочен в оригинале. Молча исправлять U→F нельзя: сначала нужна повторная побуквенная транскрипция картинки. Нижняя нода показывает разницу букв.',
        'SOURCE DISCREPANCY. Standard Vigenère (letters only, A=0) with the key LENORE gives “…BEUORE…”, while the write-up prints “…BEFORE…”. One character is either mis-transcribed or wrong in the original. Do not silently fix U→F: first re-transcribe the image letter by letter. The bottom node shows the letter difference.'),
      T('write-up Voltasalt (gist), независимая проверка отчёта', 'the Voltasalt write-up (gist), independent check in the report'), T('средне-высокая; одна буква расходится', 'medium-high; one letter disagrees')));
    define({
      id: 'or-lenore', arg: 'oldroot', title: T('OldRoot: Виженер LENORE (расхождение BEUORE/BEFORE)', 'OldRoot: Vigenère LENORE (BEUORE/BEFORE discrepancy)'),
      desc: T('Результат расходится с write-up на одну букву', 'The result differs from the write-up by one letter'),
      expect: ['YOU MUST LEARN THE PAST BEUORE THE FUTURE'], expectContains: ['Extra in A (not in B): u'],
      discrepancy: T('BEUORE (расчёт) против BEFORE (write-up)', 'BEUORE (computed) vs BEFORE (write-up)'),
      auto: { input: 'JSH ALWE PROIR ELR DRWE FRIFVP XUS WYEYES', keys: ['LENORE'], expect: 'YOU MUST LEARN THE PAST BEUORE THE FUTURE', top: 1 },
    }, v);

    // Финальный числовой код: строгий A1Z26 против продолжения по модулю 26
    const m = new Board();
    const nums = '27 12 12 15 6 20 8 5 4 15 20 19 1 18 5 6 9 14 1 12 12 25\n19 20 1 18 20 9 14 7 20 15 3 15 14 14 5 3 20,\n23 8 15 11 14 5 23 30 15 12 16 8 9 14 19 23 5 18 5 8 9\n4 9 14 7 19 15 13 21 3 8?';
    const code = m.add('input', 0, 0, { text: nums });
    const strictId = m.then(code, 'op:num_letters', { alpha: 'en', base: 1, range: 'strict', breaks: 'punct', out: 'upper' }, 0, 1);
    const mod = m.then(code, 'op:num_letters', { alpha: 'en', base: 1, range: 'modulo', breaks: 'punct', out: 'upper' }, 0, 0);
    m.then(mod, 'view');
    m.note(0, 2, sourceNote(
      T('Нижняя ветка в строке 2 — строгий A1Z26: числа 27 и 30 вне алфавита, поэтому ОШИБКА (так и задумано). Верхняя — явное продолжение по модулю 26: n → ((n−1) mod 26)+1, то есть 27→A, 30→D. Арифметика проверяема, но замысел автора (именно modulo, а не другая таблица) не доказан: авторский пост правила не объясняет.',
        'The lower branch is strict A1Z26: the numbers 27 and 30 are outside the alphabet, so it ERRORS (by design). The upper branch is the explicit modulo-26 extension: n → ((n−1) mod 26)+1, i.e. 27→A, 30→D. The arithmetic is verifiable, but the author’s intended rule (modulo, not another table) is unproven: the author’s post does not explain it.'),
      T('r/OldRoot: «Conclusion» и продолжение сообщества', 'r/OldRoot “Conclusion” and the community follow-up'), T('высокая для шифртекста; правило автором не объявлено', 'high for the ciphertext; the rule is not declared by the author')));
    define({
      id: 'or-modular', arg: 'oldroot', title: T('OldRoot: финальный код (A1Z26 по модулю 26)', 'OldRoot: the final code (A1Z26 modulo 26)'),
      desc: T('27→A, 30→D; строгий A1Z26 даёт ошибку', '27→A, 30→D; strict A1Z26 errors'),
      expect: ['ALLOFTHEDOTSAREFINALLYSTARTINGTOCONNECT WHOKNEWDOLPHINSWEREHIDINGSOMUCH'], expectErrors: [strictId],
      auto: { input: nums, expect: 'ALLOFTHEDOTSAREFINALLYSTARTINGTOCONNECT WHOKNEWDOLPHINSWEREHIDINGSOMUCH', top: 3 },
    }, m);
  })();

  // ---------- HERMatrix ----------
  (function hermatrix() {
    const b = new Board();
    const ct = b.add('input', 0, 0, { text: 'LMVCCIKB' });
    const key = b.add('input', 0, 1, { text: 'LUCY' });
    const dec = b.add('op:vigenere', 1, 0, { key: '', dir: 'dec', alpha: 'en', skip: true });
    b.wire(ct, dec, 0); b.wire(key, dec, 1);
    b.then(dec, 'view');
    b.note(1, 1, sourceNote(
      T('Имена аксолотлей, в порядке из видео Xisuma, дали LMVCCIKB. Ключ LUCY — по данным решателей; сам первичный артефакт, давший ключ, в источниках слабо задокументирован (статус ключа: «известен из решения, первичный артефакт не найден»). Подсказка к методу: коза «Vigenere» + попугай «Cipher». Независимая проверка: слово ASTEROID введено в терминал HDA и открыло следующий сайт.',
        'The axolotl names, in the order shown by Xisuma, gave LMVCCIKB. The key LUCY comes from the solvers; the primary artifact that gave the key is poorly documented (key status: “known from the solution, primary artifact not found”). The method hint: a goat named “Vigenere” + a parrot named “Cipher”. Independent check: the word ASTEROID was typed into the HDA terminal and opened the next site.'),
      T('r/HermitCraft, Episode 4 solver thread; комментарий Docm77', 'r/HermitCraft Episode 4 solver thread; Docm77’s comment'), T('высокая (принято терминалом)', 'high (accepted by the terminal)')));
    b.note(0, 2, T('Координаты ранней фазы (QR → hermatrix.net → #FFFFFF8): 1534 21 -266. Это координаты, а не шифр.', 'Coordinates from the early phase (QR → hermatrix.net → #FFFFFF8): 1534 21 -266. These are coordinates, not a cipher.'));
    define({
      id: 'hm-vigenere', arg: 'hermatrix', title: T('HERMatrix: Виженер LMVCCIKB + LUCY', 'HERMatrix: Vigenère LMVCCIKB + LUCY'),
      desc: 'LMVCCIKB + LUCY → ASTEROID', expect: ['ASTEROID'],
      auto: { input: 'LMVCCIKB', keys: ['LUCY'], expect: 'ASTEROID', top: 1 },
    }, b);
  })();

  // ---------- AlphaVer ----------
  (function alphaver() {
    const b = new Board();
    const tok = b.add('input', 0, 0, { text: '9b4c383a911ec' });
    const bad = b.then(tok, 'op:hex_decode', {});
    b.then(bad, 'view');
    const pass = b.add('input', 0, 2, { text: 'ab99d76f9a4c41a0f3591b122bbc985c' });
    const ident = b.then(pass, 'op:hash_identify', {});
    b.then(ident, 'view');
    b.note(0, 1, sourceNote(
      T('ОТРИЦАТЕЛЬНЫЙ ПРИМЕР. Верхняя цепочка намеренно падает: 13 hex-цифр — нечётное число, это не байты. Строка выглядит как hex, но по документации это ТОКЕН для особого блока Input Block ID 120: первые три кода вводят в игру, и в Minecraft log появляется пароль. Никакого hex→ASCII между шагами нет. Нижняя цепочка: 32 hex-символа — пароль к PH1.rar, а не хеш; «похоже на MD5» ничего не доказывает. Точный алгоритм Input Block в источниках не установлен.',
        'A NEGATIVE EXAMPLE. The top chain fails on purpose: 13 hex digits is an odd number, so these are not bytes. The string looks like hex, but per the documentation it is a TOKEN for a special block, Input Block ID 120: the first three codes are entered in the game and a password appears in the Minecraft log. There is no hex→ASCII step. Bottom chain: 32 hex characters is the PH1.rar password, not a hash; “looks like MD5” proves nothing. The exact Input Block algorithm is not established in the sources.'),
      'github.com/NexTre-dev/alphaver (lore/codes.md)', T('средне-высокая (фанатский архив, не официальный)', 'medium-high (a fan archive, not official)')));
    define({
      id: 'av-token-not-hex', arg: 'alphaver', title: T('AlphaVer: hex-подобный токен — НЕ hex', 'AlphaVer: a hex-like token is NOT hex'),
      desc: T('9b4c383a911ec: ошибка hex→байты, и это правильно', '9b4c383a911ec: a hex→bytes error, and that is correct'),
      expectErrors: [bad], expectContains: ['32 hex = 128 bits'],
      manual: T('Токен вводится в игровой Input Block ID 120 — нужен игровой шаг, декодирования нет.', 'The token is typed into the in-game Input Block ID 120: a game action is required, there is nothing to decode.'),
    }, b);

    const c = new Board();
    const sym = c.add('input', 0, 0, { text: 'imgur9F0A3un' });
    const id = c.then(sym, 'op:replace', { find: 'imgur', repl: '', regex: false });
    c.then(id, 'view');
    c.note(0, 1, sourceNote(
      T('После декомпиляции client JAR в классе ly найдена константа imgur9F0A3un. Это не шифр: имя переменной — указатель на Imgur-артефакт 9F0A3un (регистр важен, это идентификатор).',
        'After decompiling the client JAR, the class ly contains the constant imgur9F0A3un. This is not a cipher: the variable name is a pointer to the Imgur artifact 9F0A3un (case matters, it is an identifier).'),
      'github.com/NexTre-dev/alphaver (resources/lilypad-analyzation.md)', T('средне-высокая', 'medium-high')));
    define({
      id: 'av-imgur', arg: 'alphaver', title: T('AlphaVer: имя переменной → Imgur ID', 'AlphaVer: a variable name → Imgur ID'),
      desc: 'imgur9F0A3un → 9F0A3un', expect: ['9F0A3un'],
      manual: T('Отделить префикс imgur от ID — наблюдение человека при чтении декомпилированного кода, а не операция над шифртекстом.', 'Splitting the imgur prefix from the ID is a human observation while reading decompiled code, not an operation on a ciphertext.'),
    }, c);
  })();

  // ---------- Endermite / Jimmy ----------
  (function endermite() {
    const NOTE_SRC = 'r/MinecraftARGs (Endermite/Jimmy thread)';
    const MEDIUM = T('средне-высокая (ARG ещё продолжался)', 'medium-high (the ARG was still running)');

    const r = new Board();
    const rot = r.add('input', 0, 0, { text: 'raqrezvgr' });
    const out = r.then(rot, 'op:caesar', { alpha: 'en', n: 13 });
    r.then(out, 'view');
    r.note(0, 1, sourceNote(T('Мод в latest.log: «raqrezvgr 0.0.3-beta1». ROT13 даёт endermite; слово повторяется независимо (hex-слой и сдвиг 8) — это сильное подтверждение.', 'A mod in latest.log: “raqrezvgr 0.0.3-beta1”. ROT13 gives endermite; the word repeats independently (the hex layer and shift 8), which is strong confirmation.'), NOTE_SRC, MEDIUM));
    define({ id: 'em-rot13', arg: 'endermite', title: T('Endermite: ROT13 raqrezvgr', 'Endermite: ROT13 raqrezvgr'), desc: 'raqrezvgr → endermite', expect: ['endermite'], auto: { input: 'raqrezvgr', expect: 'endermite', top: 1 } }, r);

    const h = new Board();
    h.chain(h.add('input', 0, 0, { text: '73746f70' }), [['op:hex_decode', {}], ['view']]);
    h.chain(h.add('input', 0, 1, { text: '41414141' }), [['op:hex_decode', {}], ['view']]);
    h.note(0, 2, sourceNote(T('Здесь hex действительно кодирует ASCII: 73 74 6f 70 → «stop», 41 41 41 41 → «AAAA». Контраст с AlphaVer, где hex-подобные коды — токены.', 'Here hex really encodes ASCII: 73 74 6f 70 → “stop”, 41 41 41 41 → “AAAA”. Contrast with AlphaVer, where hex-like codes are tokens.'), NOTE_SRC, MEDIUM));
    define({ id: 'em-hex', arg: 'endermite', title: T('Endermite: hex → stop / AAAA', 'Endermite: hex → stop / AAAA'), desc: '73746f70 → stop; 41414141 → AAAA', expect: ['stop', 'AAAA'], auto: { input: '73746f70', expect: 'stop', top: 1, also: [{ input: '41414141', expect: 'AAAA', top: 1 }] } }, h);

    const s = new Board();
    s.chain(s.add('input', 0, 0, { text: 'wfvwjealw' }), [['op:caesar', { alpha: 'en', n: 8 }], ['view']]);
    s.chain(s.add('input', 0, 1, { text: 'wfvwjealw' }), [['op:caesar', { alpha: 'en', n: -18 }], ['view']]);
    s.note(0, 2, sourceNote(T('Сдвиг «+8» и «−18» дают одно и то же (26 − 18 = 8). Источник говорит «shifted 18» — всё зависит от соглашения о направлении, поэтому программа обязана показывать обе формы.', 'Shifts “+8” and “−18” are the same (26 − 18 = 8). The source says “shifted 18”: it depends on the direction convention, so the tool must show both forms.'), NOTE_SRC, MEDIUM));
    define({ id: 'em-shift-direction', arg: 'endermite', title: T('Endermite: сдвиг +8 = −18', 'Endermite: shift +8 = −18'), desc: 'wfvwjealw → endermite', expect: ['endermite'], auto: { input: 'wfvwjealw', expect: 'endermite', top: 1 } }, s);

    // Ключ из ROT13, две строки Виженера, Бофор и Variant Beaufort для сравнения
    const v = new Board();
    const keySrc = v.add('input', 0, 0, { text: 'raqrezvgr' });
    const keyNode = v.then(keySrc, 'op:caesar', { alpha: 'en', n: 13 });
    const l1 = v.add('input', 0, 1, { text: 'lrot dq xeiefh' });
    const l2 = v.add('input', 0, 3, { text: 'PRW QV RZXI' });
    const d1 = v.add('op:vigenere', 1, 1, { key: '', dir: 'dec', alpha: 'en', skip: true });
    const d2 = v.add('op:vigenere', 1, 3, { key: '', dir: 'dec', alpha: 'en', skip: true });
    v.wire(l1, d1, 0); v.wire(keyNode, d1, 1); v.wire(l2, d2, 0); v.wire(keyNode, d2, 1);
    v.then(d1, 'view'); v.then(d2, 'view');
    const bf = v.add('op:beaufort', 2, 2, { key: '', alpha: 'en', skip: true });
    v.wire(l1, bf, 0); v.wire(keyNode, bf, 1);
    const vb = v.add('op:beaufort_variant', 3, 2, { key: '', dir: 'dec', alpha: 'en', skip: true });
    v.wire(l1, vb, 0); v.wire(keyNode, vb, 1);
    v.note(0, 4, sourceNote(
      T('РАСХОЖДЕНИЕ ИСТОЧНИКА. Решатель назвал метод «Variant Beaufort», но точно получается СТАНДАРТНЫЙ Виженер P = C − K (ключ ENDERMITE, на пробелах не продвигается). Beaufort даёт «twpl ow lpwaiw», Variant Beaufort — «perx uc fxmisk»: бессмыслица. Метка шифра не должна скрывать разные формулы. Ключ ENDERMITE дважды получен независимо (ROT13 и сдвиг 8).',
        'SOURCE DISCREPANCY. The solver called the method “Variant Beaufort”, but the exact result is STANDARD Vigenère P = C − K (key ENDERMITE, not advanced on spaces). Beaufort gives “twpl ow lpwaiw”, Variant Beaufort “perx uc fxmisk”: nonsense. A cipher label must not hide different formulas. The key ENDERMITE was obtained twice independently (ROT13 and shift 8).'),
      NOTE_SRC, T('средне-высокая; название метода в источнике неточно', 'medium-high; the method name in the source is inaccurate')));
    define({
      id: 'em-vigenere', arg: 'endermite', title: T('Endermite: Виженер ENDERMITE (а не Variant Beaufort)', 'Endermite: Vigenère ENDERMITE (not Variant Beaufort)'),
      desc: 'lrot dq xeiefh → help me please; PRW QV RZXI → LET ME FREE',
      expect: ['help me please', 'LET ME FREE', 'twpl ow lpwaiw', 'perx uc fxmisk'],
      discrepancy: T('источник: Variant Beaufort; фактически: Виженер', 'source: Variant Beaufort; actual: Vigenère'),
      auto: { input: 'lrot dq xeiefh', keys: ['ENDERMITE'], expect: 'help me please', top: 1, also: [{ input: 'PRW QV RZXI', keys: ['ENDERMITE'], expect: 'LET ME FREE', top: 1 }] },
    }, v);

    // Строки latest.log → кандидаты → hex → текст
    const logText = 'raqrezvgr 0.0.3-beta1\njimmyy1[local:E:73746f70] logged in with entity id 65\n§kwfvwjealw§r[local:E:41414141] logged in with entity id -1\nat (1324.7, -32.0, -142.3)';
    const g = new Board();
    const log = g.add('input', 0, 0, { text: logText });
    const clean = g.then(log, 'op:mc_format', { mode: 'strip', amp: false });
    const list = g.then(clean, 'op:extract_candidates', { kind: 'hex', n: 0 }, 0, 0);
    g.then(list, 'view');
    g.chain(g.then(clean, 'op:extract_candidates', { kind: 'hex', n: 1 }, 0, 1), [['op:hex_decode', {}], ['view']]);
    g.chain(g.then(clean, 'op:extract_candidates', { kind: 'hex', n: 2 }, 0, 2), [['op:hex_decode', {}], ['view']]);
    g.note(0, 3, sourceNote(
      T('Целые строки лога проходят через: убрать коды §k/§r → найти hex-кандидаты (нулевой номер = список с позициями) → hex → текст. Первый кандидат даёт stop, второй — AAAA. Коды форматирования § стоит сохранить в оригинале: они бывают частью улики.',
        'Whole log lines go through: strip the §k/§r codes → find hex candidates (number 0 = a list with positions) → hex → text. The first candidate gives stop, the second AAAA. Keep the § formatting codes in the original: they can be part of the clue.'),
      NOTE_SRC, MEDIUM));
    define({
      id: 'em-log', arg: 'endermite', title: T('Endermite: строки latest.log → кандидаты → hex', 'Endermite: latest.log lines → candidates → hex'),
      desc: T('Из длинного лога вырезаются 73746f70 и 41414141', '73746f70 and 41414141 are cut out of a longer log'),
      expect: ['stop', 'AAAA'],
      auto: { input: logText, expect: 'stop', top: 3, also: [{ input: logText, expect: 'AAAA', top: 3 }] },
    }, g);

    const f = new Board();
    const frames = ['8F@2z~q', '1K9&b!x', 't5#0m^r', 'g7+2w]a', '3z!q8@h', 'u6=4y8p', '0x^n2$k', 'c9}t1*f', 'sm~a7#7', 'j2(8v!s', '4h0_b%q', 'y!3k@bz', 'n8$2g~w', '7p]c1^x'].join('\n');
    f.then(f.add('input', 0, 0, { text: frames }), 'analyze');
    f.note(0, 1, sourceNote(
      T('НЕ РАЗГАДАНО. 14 быстро сменяющихся семисимвольных строк на 3:45 видео; в конце видео четыре коротких сигнала дают в спектрограмме PG56. Связь между ними и следующая операция не найдены; попытки читать их как числа и собирать YouTube ID не удались. Не превращайте их в заранее выбранный URL.',
        'UNSOLVED. 14 rapidly changing seven-character strings at 3:45 of the video; at the end, four short beeps show PG56 in the spectrogram. The link between them and the next operation are not found; attempts to read them as numbers or build a YouTube ID failed. Do not turn them into a pre-chosen URL.'),
      NOTE_SRC, T('средняя; происхождение подтверждено, функция не установлена', 'medium; the origin is confirmed, the function is not established')));
    define({
      id: 'em-frames-unsolved', arg: 'endermite', title: T('Endermite: 14 строк из видео (не разгадано)', 'Endermite: 14 video strings (unsolved)'),
      desc: T('Честный открытый вопрос: данные есть, функции нет', 'An honest open question: data without a known function'),
      manual: T('Не разгадано: функция строк и PG56 в источниках не установлена.', 'Unsolved: the function of the strings and of PG56 is not established in the sources.'),
    }, f);
  })();

  // ---------- Archive11 ----------
  (function archive11() {
    const b = new Board();
    b.chain(b.add('input', 0, 0, { text: '476F6E65' }), [['op:hex_decode', {}], ['view']]);
    b.chain(b.add('input', 0, 1, { text: '616C6C' }), [['op:hex_decode', {}], ['view']]);
    b.note(0, 2, sourceNote(
      T('47 6F 6E 65 → «Gone», 61 6C 6C → «all» (регистр результатов точный). Остальные «расшифрованные описания» в источнике не приведены как шифртекст: «точный вход недоступен, воспроизводимый прогон невозможен».',
        '47 6F 6E 65 → “Gone”, 61 6C 6C → “all” (exact case). The other “decoded descriptions” are not given as ciphertext in the source: “the exact input is unavailable; a reproducible run is impossible”.'),
      'r/Minecraft (discovery thread, ≈2025)', T('средне-низкая (единичное наблюдение)', 'medium-low (a single observation)')));
    define({
      id: 'a11-hex', arg: 'archive11', title: T('Archive11: hex → Gone / all', 'Archive11: hex → Gone / all'),
      desc: '476F6E65 → Gone; 616C6C → all', expect: ['Gone', 'all'],
      auto: { input: '476F6E65', expect: 'Gone', top: 1, also: [{ input: '616C6C', expect: 'all', top: 1 }] },
    }, b);
  })();
})(typeof self !== 'undefined' ? self : this);
