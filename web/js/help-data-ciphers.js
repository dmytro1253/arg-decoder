// Справочные карточки: сдвиги, шифры с ключом, перестановки. См. help-data.js (формат записи).
// i18n-file-ok: все тексты — пары ['русский', 'English'], полноту проверяет tests/help.test.js.
(function (G) {
  'use strict';
  const H = G.HelpData.add;

  const ALPHA_PAR = ['«Алфавит» — латиница, кириллица (33 с Ё или 32 без Ё), украинский или «авто» по тексту.', '“Alphabet” is Latin, Cyrillic (33 with Ё or 32 without), Ukrainian, or “auto” from the text.'];
  const MODE_PAR = ['«Режим» — расшифровка или шифрование.', '“Mode” is decrypt or encrypt.'];
  const GROUP_PAR = ['«Группы» — разбить результат на блоки из N букв (0 — без разбиения).', '“Group size” splits the result into blocks of N letters (0 = no splitting).'];

  // ---------- Сдвиги и подстановки ----------
  H('char_shift', {
    inp: ['Текст; сдвигаются коды всех символов, а не только букв.', 'Text; the codes of all characters are shifted, not only letters.'],
    what: ['К коду каждого символа прибавляется число N (отрицательное — вычитается).', 'The number N is added to the code of every character (a negative N subtracts).'],
    ex: ['T09XS<<cK1!', 'kGPojSSzbH8', { n: 23 }],
    par: ['«Сдвиг N» — на сколько менять код. «Переполнение» — что делать, если код вышел за диапазон: ничего, по модулю 256 или по кольцу печатных ASCII (95 знаков).', '“Shift N” is how much to change the code. “Overflow” is what to do at the range edge: nothing, modulo 256, or wrap within printable ASCII (95 characters).'],
    keep: ['Цифры и знаки сдвигаются вместе с буквами. Без обёртки код вне диапазона — ошибка.', 'Digits and symbols shift along with letters. Without wrapping, an out-of-range code is an error.'],
    chk: ['Результат — читаемый текст или ID/ссылка. Если нужен обратный сдвиг, поставьте −N.', 'The result is readable text or an ID/link. For the inverse shift use −N.'],
    wiki: ['Caesar cipher', 'Шифр_Цезаря'],
  });
  H('caesar', {
    what: ['Каждая буква сдвигается по алфавиту на N позиций. Знаки и цифры остаются.', 'Every letter is shifted N positions along the alphabet. Punctuation and digits stay.'],
    ex: ['Khoor', 'Hello', { n: -3, alpha: 'en' }],
    par: [ALPHA_PAR[0] + ' «Сдвиг» — положительный вперёд, отрицательный назад (чтобы расшифровать сдвиг +3, возьмите −3).', ALPHA_PAR[1] + ' “Shift”: positive goes forward, negative back (to undo +3 use −3).'],
    keep: ['Регистр сохраняется; буквы чужого алфавита остаются как есть.', 'Case is kept; letters of another alphabet are left as they are.'],
    chk: ['Всего 25 осмысленных сдвигов: проверьте все. Правильный даёт слова; в «Авто» ищется сам.', 'There are only 25 useful shifts: try them all. The right one gives words; “Auto” finds it by itself.'],
    wiki: ['Caesar cipher', 'Шифр_Цезаря'], demo: null,
  });
  H('rot47', {
    what: ['Сдвигает все печатные ASCII-символы (коды 33–126) на 47 позиций; применённый дважды возвращает исходное.', 'Shifts all printable ASCII characters (codes 33–126) by 47; applied twice it restores the original.'],
    ex: ['w6==@', 'Hello'],
    par: null,
    keep: ['Пробелы и не-ASCII символы не меняются. Операция сама себе обратная.', 'Spaces and non-ASCII characters are unchanged. The operation is its own inverse.'],
    chk: ['Хороший признак — строка из «странных» знаков вроде @, =, 6 вместо букв.', 'A good sign is a string of “odd” symbols such as @, =, 6 where letters should be.'],
    wiki: ['ROT13#Variants', 'ROT13'],
  });
  H('atbash', {
    what: ['Зеркальная замена алфавита: A↔Z, B↔Y … (в кириллице А↔Я).', 'Mirrored alphabet substitution: A↔Z, B↔Y … (in Cyrillic А↔Я).'],
    ex: ['Svool', 'Hello'],
    par: [ALPHA_PAR[0], ALPHA_PAR[1]],
    keep: ['Операция сама себе обратная; регистр сохраняется.', 'The operation is its own inverse; case is kept.'],
    chk: ['Ключа нет, поэтому достаточно одной попытки: читаемый текст — успех.', 'There is no key, so one attempt is enough: readable text means success.'],
    wiki: ['Atbash', 'Атбаш'], demo: 'atbash',
  });
  H('affine', {
    what: ['Аффинный шифр: буква x шифруется как a·x + b по модулю длины алфавита. Нода расшифровывает.', 'The affine cipher encrypts letter x as a·x + b modulo the alphabet length. This node decrypts.'],
    ex: ['IHHWVC SWFRCP', 'AFFINE CIPHER', { a: 5, b: 8, alpha: 'en' }],
    par: ['a должно быть взаимно просто с длиной алфавита (для 26: 1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25). b — сдвиг. ' + ALPHA_PAR[0], 'a must be coprime with the alphabet length (for 26: 1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25). b is the shift. ' + ALPHA_PAR[1]],
    keep: ['Регистр и не-буквы сохраняются.', 'Case and non-letters are kept.'],
    chk: ['Возможных пар (a, b) всего 312 для латиницы — перебор быстрый; правильная даёт слова.', 'Latin has only 312 (a, b) pairs, so brute force is fast; the right one gives words.'],
    wiki: ['Affine cipher', 'Аффинный_шифр'],
  });
  H('substitute', {
    what: ['Простая замена по таблице: символ из «Из» заменяется символом на той же позиции в «В».', 'Simple table substitution: each character of “From” becomes the character at the same position in “To”.'],
    ex: ['cab', 'zxy', { from: 'abc', to: 'xyz' }],
    par: ['«Из» и «В» — строки одинаковой длины. «Учитывать регистр» — различать заглавные и строчные.', '“From” and “To” are strings of the same length. “Respect case” distinguishes upper and lower case.'],
    keep: ['Символы вне «Из» остаются без изменений.', 'Characters not in “From” stay unchanged.'],
    chk: ['Для подбора таблицы используйте частотный анализ; проверка — осмысленный текст.', 'Use frequency analysis to find the table; the check is meaningful text.'],
    wiki: ['Substitution cipher', 'Шифр_простой_замены'],
  });
  H('rot5', {
    inp: ['Текст с цифрами.', 'Text with digits.'],
    what: ['Каждая цифра сдвигается на 5 (0↔5, 1↔6, 2↔7 …); буквы не меняются.', 'Every digit is shifted by 5 (0↔5, 1↔6, 2↔7 …); letters are not changed.'],
    ex: ['2024', '7579'],
    par: null,
    keep: ['Операция сама себе обратная.', 'The operation is its own inverse.'],
    chk: ['Проверьте, имеет ли смысл число (дата, ID, координата).', 'Check whether the number makes sense (a date, an ID, a coordinate).'],
    wiki: ['ROT13#Variants', 'ROT13'],
  });
  H('rot18', {
    what: ['ROT13 для латинских букв и ROT5 для цифр одновременно.', 'ROT13 for Latin letters and ROT5 for digits at the same time.'],
    ex: ['Hello 123', 'Uryyb 678'],
    par: null,
    keep: ['Операция сама себе обратная; кириллица не меняется.', 'The operation is its own inverse; Cyrillic is unchanged.'],
    chk: ['Читаемые слова и числа — успех. Для чистого ROT13 используйте «Цезарь» со сдвигом 13.', 'Readable words and numbers mean success. For plain ROT13 use “Caesar” with shift 13.'],
    wiki: ['ROT13#Variants', 'ROT13'],
  });
  H('rot8000', {
    what: ['«ROT13 для Юникода»: символы основной плоскости сдвигаются на половину допустимого списка (A → 籊).', '“ROT13 for Unicode”: BMP characters rotate by half of the valid list (A → 籊).'],
    ex: ['A', '籊'],
    par: null,
    keep: ['Пробелы, управляющие символы и эмодзи вне BMP не меняются. Операция сама себе обратная.', 'Whitespace, control characters and non-BMP emoji are unchanged. The operation is its own inverse.'],
    chk: ['Признак — текст из множества редких иероглифов, который после ROT8000 становится обычным.', 'A sign is text made of many rare CJK characters that becomes ordinary after ROT8000.'],
    wiki: ['ROT13', 'ROT13'], std: ['ROT8000 (проект)', 'https://github.com/nickdrozd/rot8000'],
  });
  H('keyed_caesar', {
    inp: ['Текст (первый вход) и ключевое слово (второй вход или параметр).', 'Text (first input) and a keyword (second input or parameter).'],
    what: ['Шифрующий алфавит строится как ключевое слово + остальные буквы и затем сдвигается на N.', 'The cipher alphabet is the keyword followed by the remaining letters, then shifted by N.'],
    ex: ['HELLO', 'DAIIL', { key: 'ZEBRAS', n: 0, alpha: 'en', dir: 'enc' }],
    par: ['«Ключ» — слово (повторы букв отбрасываются). «Сдвиг N» — сдвиг получившегося алфавита. ' + MODE_PAR[0], '“Keyword” (repeated letters are dropped). “Shift N” rotates the resulting alphabet. ' + MODE_PAR[1]],
    keep: ['Регистр и не-буквы сохраняются.', 'Case and non-letters are kept.'],
    chk: ['Если подставить верный ключ, получится связный текст; частоты букв выровняются.', 'With the right keyword you get coherent text and the letter frequencies even out.'],
    wiki: ['Caesar cipher#Variations', 'Шифр_Цезаря'],
  });

  // ---------- Шифры с ключом ----------
  H('vigenere', {
    inp: ['Шифртекст (первый вход) и ключевое слово (второй вход или параметр).', 'Ciphertext (first input) and a keyword (second input or parameter).'],
    what: ['Многоалфавитный шифр: каждая буква сдвигается на номер соответствующей буквы повторяющегося ключа.', 'A polyalphabetic cipher: each letter is shifted by the position of the matching letter of the repeating key.'],
    ex: ['LXFOPVEFRNHR', 'ATTACKATDAWN', { key: 'LEMON', alpha: 'en' }],
    par: ['«Ключ» — слово; его можно подать вторым входом. «Режим» — расшифровка или шифрование. ' + ALPHA_PAR[0] + ' «Цифры и знаки не тратят ключ» — пропускать небуквы, не двигая ключ.', '“Key” is a word; you can feed it into the second input. “Mode” is decrypt or encrypt. ' + ALPHA_PAR[1] + ' “Digits and punctuation do not use up the key” skips non-letters without advancing the key.'],
    keep: ['Регистр и небуквы сохраняются. Неверный ключ даёт бессвязные буквы, но данные не теряются.', 'Case and non-letters are kept. A wrong key gives gibberish but loses nothing.'],
    chk: ['Правильный ключ делает текст читаемым целиком. Ключ неизвестен — «Подбор Виженера» или «Виженер / Бофорт / Вариант».', 'The right key makes the whole text readable. If the key is unknown, use “Vigenère solver” or “Vigenère / Beaufort / Variant”.'],
    wiki: ['Vigenère cipher', 'Шифр_Виженера'], demo: 'dng-hexvig',
  });
  H('beaufort', {
    inp: ['Текст (первый вход) и ключ (второй вход или параметр).', 'Text (first input) and a key (second input or parameter).'],
    what: ['Вариант Виженера, где P = K − C. Шифрование и расшифровка — одна и та же операция.', 'A Vigenère variant with P = K − C. Encryption and decryption are the same operation.'],
    ex: ['DANZQ', 'HELLO', { key: 'KEY', alpha: 'en' }],
    par: ['«Ключ», алфавит и «Цифры и знаки не тратят ключ» — как у Виженера.', '“Key”, alphabet and “Digits and punctuation do not use up the key” work as in Vigenère.'],
    keep: ['Регистр и небуквы сохраняются.', 'Case and non-letters are kept.'],
    chk: ['Если Виженер с этим ключом не даёт текст, попробуйте Бофорта и Вариант Бофорта (есть сводная нода).', 'If Vigenère with this key gives nothing, try Beaufort and Variant Beaufort (there is a combined node).'],
    wiki: ['Beaufort cipher', 'Шифр_Бофорта'],
  });
  H('autokey', {
    inp: ['Шифртекст (первый вход) и начальный ключ (второй вход или параметр).', 'Ciphertext (first input) and the initial key (second input or parameter).'],
    what: ['Автоключевой шифр: после короткого начального ключа в качестве ключа идёт сам расшифрованный текст.', 'The autokey cipher: after a short initial key, the decrypted text itself serves as the key.'],
    ex: ['QNXEPVYTWTWP', 'ATTACKATDAWN', { key: 'QUEENLY', alpha: 'en' }],
    par: ['«Ключ» — начальное слово. ' + ALPHA_PAR[0], '“Key” is the initial word. ' + ALPHA_PAR[1]],
    keep: ['Небуквы пропускаются. Одна ошибка в ключе портит только начало, дальше текст «вылечивается».', 'Non-letters are skipped. A wrong key spoils only the beginning, then the text recovers.'],
    chk: ['Если начало бессвязно, а продолжение читается, ключ почти верен; поправьте его по смыслу.', 'If the start is gibberish while the rest reads, the key is nearly right: fix it from the meaning.'],
    wiki: ['Autokey cipher', 'Шифр_Виженера#Автоключ'],
  });
  H('beaufort_variant', {
    inp: ['Текст (первый вход) и ключ (второй вход или параметр).', 'Text (first input) and a key (second input or parameter).'],
    what: ['Вариант Бофорта: расшифровка P = C + K, шифрование C = P − K — то есть Виженер с отрицательным ключом.', 'Variant Beaufort: decryption P = C + K, encryption C = P − K, i.e. Vigenère with a negated key.'],
    ex: ['PRW QV RZXI', 'TEZ UM DHQM', { key: 'ENDERMITE' }],
    par: [MODE_PAR[0] + ' «Ключ», алфавит и пропуск небукв — как у Виженера.', MODE_PAR[1] + ' “Key”, alphabet and skipping of non-letters work as in Vigenère.'],
    keep: ['Регистр и небуквы сохраняются.', 'Case and non-letters are kept.'],
    chk: ['Если Виженер даёт мусор, а ключ вероятен, проверьте этот вариант.', 'If Vigenère gives junk but the key is plausible, check this variant.'],
    wiki: ['Beaufort cipher#Variant_Beaufort', 'Шифр_Бофорта'],
  });
  H('vigenere_family', {
    inp: ['Текст (первый вход) и ключ (второй вход или параметр).', 'Text (first input) and a key (second input or parameter).'],
    what: ['Сразу три варианта с одним ключом: Виженер, Бофорт и Вариант Бофорта — удобно, когда неизвестно, какой нужен.', 'Three variants with one key at once: Vigenère, Beaufort and Variant Beaufort, handy when you do not know which is needed.'],
    ex: ['LXFOPVEFRNHR', 'ATTACKATDAWN…', { key: 'LEMON', alpha: 'en' }],
    par: ['«Ключ», режим, алфавит и пропуск небукв — общие для трёх вариантов.', '“Key”, mode, alphabet and skipping of non-letters are shared by the three variants.'],
    keep: ['В выход попадают три строки с подписями; выберите читаемую.', 'The output contains three labelled lines; pick the readable one.'],
    chk: ['Лучше читается ровно один из вариантов; остальные — шум.', 'Exactly one variant reads better; the others are noise.'],
    wiki: ['Vigenère cipher', 'Шифр_Виженера'], exNoRun: true,
  });
  H('porta', {
    inp: ['Текст (первый вход) и ключ (второй вход или параметр).', 'Text (first input) and a key (second input or parameter).'],
    what: ['Шифр Порта: буква ключа выбирает одну из 13 таблиц, обменивающих половинки алфавита. Шифрование равно расшифровке.', 'The Porta cipher: the key letter selects one of 13 tableaux that swap the halves of the alphabet. Encryption equals decryption.'],
    ex: ['HELLO', 'PPZTD', { key: 'KEY' }],
    par: ['«Ключ», алфавит (латиница или кириллица 32), «Цифры и знаки не тратят ключ».', '“Key”, alphabet (Latin or Cyrillic 32), “Digits and symbols do not use the key”.'],
    keep: ['Операция сама себе обратная; регистр сохраняется.', 'The operation is its own inverse; case is kept.'],
    chk: ['Читаемый текст при верном ключе.', 'Readable text with the right key.'],
    wiki: ['Giovan Battista Bellaso#Della Porta', 'Шифр_Порты'],
  });
  H('running_key', {
    inp: ['Текст (первый вход) и длинный ключевой текст — например, страница книги (второй вход).', 'Text (first input) and a long key text, for example a book page (second input).'],
    what: ['Виженер, где ключ — длинный отрывок текста, не короче сообщения, вместо повторяющегося слова.', 'Vigenère where the key is a long passage at least as long as the message, instead of a repeated word.'],
    ex: ['ALPBI', 'HELLO', { key: 'THEQUICKBROWN', alpha: 'en', dir: 'dec' }],
    par: ['«Ключ» — текст-ключ. «Семейство» — Виженер, Бофорт или вариант. «Сдвиг начала» — с какой буквы ключа начинать. Режим и алфавит — как у Виженера.', '“Key text”. “Family” is Vigenère, Beaufort or variant. “Start offset” says which key letter to begin with. Mode and alphabet work as in Vigenère.'],
    keep: ['Пробелы и знаки ключа пропускаются. Слишком короткий ключ — ошибка.', 'Spaces and symbols of the key are skipped. A key that is too short is an error.'],
    chk: ['Нужно знать источник ключа; перебирайте сдвиг начала. Верный сдвиг сразу даёт связный текст.', 'You need the key source; try start offsets. The right offset gives coherent text at once.'],
    wiki: ['Running key cipher', 'Шифр_с_бегущим_ключом'],
  });
  H('hill', {
    inp: ['Латинский текст и ключ — матрица 2×2 или 3×3 (4 или 9 букв/чисел).', 'Latin text and a key: a 2×2 or 3×3 matrix (4 or 9 letters/numbers).'],
    what: ['Шифр Хилла: блоки по 2 или 3 буквы умножаются на ключевую матрицу по модулю 26.', 'The Hill cipher: blocks of 2 or 3 letters are multiplied by the key matrix modulo 26.'],
    ex: ['POH', 'ACT', { key: 'GYBNQKURP', dir: 'dec' }],
    par: ['«Ключ» — 4 или 9 букв либо чисел; матрица должна быть обратима по модулю 26. «Режим» — расшифровка или шифрование.', '“Key” is 4 or 9 letters or numbers; the matrix must be invertible modulo 26. “Mode” is decrypt or encrypt.'],
    keep: ['Работает только с латиницей A–Z; длина текста должна делиться на размер блока.', 'Latin A–Z only; the text length must be divisible by the block size.'],
    chk: ['Необратимая матрица даёт понятную ошибку. Правильный ключ делает весь текст читаемым.', 'A non-invertible matrix gives a clear error. The right key makes the whole text readable.'],
    wiki: ['Hill cipher', 'Шифр_Хилла'],
  });
  H('bifid', {
    inp: ['Шифртекст (первый вход) и ключ квадрата Полибия (второй вход или параметр).', 'Ciphertext (first input) and a Polybius square key (second input or parameter).'],
    what: ['Бифид Дельмастера: буквы заменяются координатами в квадрате, координаты перемешиваются и снова читаются как буквы.', 'Delastelle’s bifid: letters become square coordinates, the coordinates are mixed and read back as letters.'],
    ex: ['UAEOLWRINS', 'FLEEATONCE', { key: 'BGWKZQPNDSIOAXEFCLUMTHYVR', dir: 'dec' }],
    par: ['«Ключ квадрата» — слово или полный квадрат. «Квадрат» — 5×5 (J=I) или 6×6. «Период» — длина блока (0 — всё сообщение). ' + MODE_PAR[0] + ' ' + GROUP_PAR[0], '“Square key” is a word or the full square. “Square” is 5×5 (J=I) or 6×6. “Period” is the block length (0 = whole message). ' + MODE_PAR[1] + ' ' + GROUP_PAR[1]],
    keep: ['J сливается с I; пробелы и знаки отбрасываются.', 'J merges with I; spaces and punctuation are dropped.'],
    chk: ['Нужны и ключ, и период; неверный период портит читаемость блоками.', 'Both the key and the period matter; a wrong period spoils readability block by block.'],
    wiki: ['Bifid cipher', 'Бифид'],
  });
  H('trifid', {
    inp: ['Шифртекст и ключ — 27 символов куба 3×3×3 (первый вход / второй вход или параметр).', 'Ciphertext and a key of the 27 symbols of a 3×3×3 cube (first input / second input or parameter).'],
    what: ['Трифид: буквы кодируются тремя координатами в кубе, координаты перемешиваются по периоду и собираются обратно.', 'Trifid: letters become three cube coordinates, which are mixed per period and reassembled.'],
    ex: ['FMJFVOISSUFTFPUFEQQC', 'AIDETOILECIELTAIDERA', { key: 'FELIXMARDSTBCGHJKNOPQUVWYZ+', period: 5, dir: 'dec' }],
    par: ['«Ключ» — слово или 27 символов (26 букв и «+»). «Период» — размер блока перемешивания. ' + MODE_PAR[0] + ' ' + GROUP_PAR[0], '“Key” is a word or 27 symbols (26 letters and “+”). “Period” is the mixing block size. ' + MODE_PAR[1] + ' ' + GROUP_PAR[1]],
    keep: ['Только латиница; пробелы и знаки отбрасываются.', 'Latin only; spaces and punctuation are dropped.'],
    chk: ['Нужны верные ключ и период одновременно.', 'The key and the period must both be right.'],
    wiki: ['Trifid cipher', 'Трифид'],
  });
  H('adfgx', {
    inp: ['Шифртекст из букв A, D, F, G, X и ключ перестановки (второй вход или параметр).', 'Ciphertext of the letters A, D, F, G, X and a transposition key (second input or parameter).'],
    what: ['Квадрат 5×5 заменяет каждую букву парой из ADFGX, затем пары переставляются столбцами по ключевому слову.', 'A 5×5 square replaces each letter by a pair from ADFGX, then the pairs are transposed by columns using a keyword.'],
    ex: ['DDGFXDFFFGFGDDGXAXDXDDDD', 'ATTACKATDAWN', { square: 'PHQGMEAYNOFDXKRCVSZWBUTIL', key: 'CARGO', dir: 'dec' }],
    par: ['«Квадрат» — слово или все 25 букв. «Ключ перестановки» — слово для столбцов. ' + MODE_PAR[0] + ' ' + GROUP_PAR[0], '“Square” is a word or all 25 letters. “Transposition key” is the column keyword. ' + MODE_PAR[1] + ' ' + GROUP_PAR[1]],
    keep: ['J сливается с I.', 'J merges with I.'],
    chk: ['Без верного квадрата и ключа получаются пары не из ADFGX; их наличие — уже признак шифра.', 'Without the right square and key you get pairs outside ADFGX; the A/D/F/G/X alphabet itself is the telltale.'],
    wiki: ['ADFGVX cipher', 'ADFGVX'],
  });
  H('adfgvx', {
    inp: ['Шифртекст из букв A, D, F, G, V, X и ключ перестановки.', 'Ciphertext of the letters A, D, F, G, V, X and a transposition key.'],
    what: ['Квадрат 6×6 (буквы и цифры) заменяет символы парами из ADFGVX, затем пары переставляются столбцами по ключу.', 'A 6×6 square (letters and digits) replaces symbols by pairs from ADFGVX, then the pairs are transposed by columns using a key.'],
    ex: ['DGDDDAGDDGAFADDFDADVDVFAADVX', 'ATTACKAT1200AM', { square: 'NA1C3H8TB2OME5WRPD4F6G7I9J0KLQSUVXYZ', key: 'PRIVACY', dir: 'dec' }],
    par: ['«Квадрат» — слово или все 36 знаков. «Ключ перестановки» — слово. ' + MODE_PAR[0] + ' ' + GROUP_PAR[0], '“Square” is a word or all 36 symbols. “Transposition key” is a word. ' + MODE_PAR[1] + ' ' + GROUP_PAR[1]],
    keep: ['Регистр теряется.', 'Case is lost.'],
    chk: ['Результат должен читаться как текст с цифрами; один неверный знак квадрата портит часть букв.', 'The result should read as text with digits; one wrong square symbol spoils some letters.'],
    wiki: ['ADFGVX cipher', 'ADFGVX'],
  });
  H('four_square', {
    inp: ['Шифртекст (чётное число букв).', 'Ciphertext (an even number of letters).'],
    what: ['Диграммный шифр на четырёх квадратах: два обычных и два ключевых (верхний правый и нижний левый).', 'A digraph cipher on four squares: two plain and two keyed (top-right and bottom-left).'],
    ex: ['HE', 'FY', { key1: 'EXAMPLE', key2: 'KEYWORD', dir: 'enc' }],
    par: ['«Ключ 1» и «Ключ 2» — слова для квадратов. ' + MODE_PAR[0] + ' ' + GROUP_PAR[0], '“Key 1” and “Key 2” are the words for the squares. ' + MODE_PAR[1] + ' ' + GROUP_PAR[1]],
    keep: ['J=I; только латиница.', 'J=I; Latin only.'],
    chk: ['Нужны оба ключа; слова-ключи часто лежат рядом с шифром.', 'Both keys are needed; key words often lie near the cipher.'],
    wiki: ['Four-square cipher', 'Шифр_четырёх_квадратов'],
  });
  H('two_square', {
    inp: ['Шифртекст (чётное число букв).', 'Ciphertext (an even number of letters).'],
    what: ['«Двойной Плейфер»: первая буква пары ищется в квадрате 1, вторая в квадрате 2, результат берётся с других углов прямоугольника.', '“Double Playfair”: the first letter of a pair is looked up in square 1, the second in square 2, and the result comes from the other rectangle corners.'],
    ex: ['GXAOEM', 'HELPME', { key1: 'EXAMPLE', key2: 'KEYWORD', layout: 'h', dir: 'dec' }],
    par: ['«Ключ 1/2» — слова для квадратов. «Расположение» — квадраты по горизонтали или по вертикали. ' + MODE_PAR[0] + ' ' + GROUP_PAR[0], '“Key 1/2” are the square words. “Layout” puts the squares side by side or one above the other. ' + MODE_PAR[1] + ' ' + GROUP_PAR[1]],
    keep: ['J=I; только латиница.', 'J=I; Latin only.'],
    chk: ['Нужны оба ключа и правильное расположение квадратов.', 'Both keys and the right square layout are needed.'],
    wiki: ['Two-square cipher', 'Шифр_двух_квадратов'],
  });
  H('nihilist', {
    inp: ['Числа (двузначные) и ключ.', 'Two-digit numbers and a key.'],
    what: ['Нигилистский шифр: буква заменяется двузначным числом по квадрату Полибия, к нему прибавляется число буквы ключа.', 'The Nihilist cipher: a letter becomes a two-digit Polybius number, and the number of a key letter is added.'],
    ex: ['45 63 55 55 74', 'HELLO', { square: 'ZEBRAS', key: 'RUSSIAN', dir: 'dec' }],
    par: ['«Квадрат» — слово для квадрата 5×5. «Ключ» — слово. ' + MODE_PAR[0], '“Square” is the word for the 5×5 square. “Key” is a word. ' + MODE_PAR[1]],
    keep: ['J=I; только латиница.', 'J=I; Latin only.'],
    chk: ['Вычтите числа ключа вручную для проверки: должны получиться допустимые координаты 11–55.', 'Subtract the key numbers by hand as a check: you must get valid coordinates 11–55.'],
    wiki: ['Nihilist cipher', 'Шифр_нигилистов'],
  });
  H('chaocipher', {
    inp: ['Шифртекст.', 'Ciphertext.'],
    what: ['Хаошифр Байрона: два диска-алфавита (левый и правый), которые после каждой буквы переставляются.', 'Byrne’s Chaocipher: two alphabet disks (left and right) that are permuted after every letter.'],
    ex: ['OAHQHCNYNXTSZJRRHJBYHQKSOUJY', 'WELLDONEISBETTERTHANWELLSAID', { left: 'HXUCZVAMDSLKPEFJRIGTWOBNYQ', right: 'PTLNBQDEOYSFAVZKGJRIHWXUMC', dir: 'dec' }],
    par: ['«Левый/правый диск» — по 26 букв. ' + MODE_PAR[0] + ' ' + GROUP_PAR[0], '“Left/right disk” are 26 letters each. ' + MODE_PAR[1] + ' ' + GROUP_PAR[1]],
    keep: ['Диски должны быть перестановками алфавита.', 'The disks must be permutations of the alphabet.'],
    chk: ['Нужны оба диска в исходном положении; одна неверная буква — сразу бессвязный текст.', 'Both disks in their start position are needed; one wrong letter gives gibberish at once.'],
    wiki: ['Chaocipher', 'Хаошифр'],
  });
  H('playfair', {
    inp: ['Шифртекст (чётное число букв) и ключ (второй вход или параметр).', 'Ciphertext (an even number of letters) and a key (second input or parameter).'],
    what: ['Шифр Плейфера: пары букв шифруются по правилам прямоугольника, строки и столбца квадрата 5×5 с ключевым словом.', 'The Playfair cipher: letter pairs are encrypted using the rectangle, row and column rules of a 5×5 keyed square.'],
    ex: ['BMODZBXDNABEKUDMUIXMMOUVIF', 'hidethegoldinthetrexestump', { key: 'PLAYFAIR EXAMPLE' }],
    par: ['«Ключ» — слово или фраза для квадрата (J=I).', '“Key” is the word or phrase for the square (J=I).'],
    keep: ['В тексте остаются вставленные X между одинаковыми буквами и в конце — уберите их вручную.', 'Inserted X filler letters between double letters and at the end remain: remove them by hand.'],
    chk: ['В правильном результате нет пар одинаковых букв как исходных диграмм; текст читается с «X» в паузах.', 'A correct result reads as text with filler “X” where double letters occurred.'],
    wiki: ['Playfair cipher', 'Шифр_Плейфера'],
  });
  H('xor', {
    inp: ['Байты или текст (первый вход) и ключ — число, hex или текст (второй вход или параметр).', 'Bytes or text (first input) and a key: a number, hex or text (second input or parameter).'],
    what: ['Побитовое XOR каждого байта с повторяющимся ключом. Шифрование и расшифровка совпадают.', 'Bitwise XOR of every byte with a repeating key. Encryption and decryption are the same.'],
    ex: ['Hello', 'Idmmn', { key: '1', fmt: 'num' }],
    par: ['«Ключ» и «Формат ключа» (число, текст или HEX). «Читать вход как» — авто, UTF-8 или байты как есть. «Строго» — ошибка вместо предупреждения.', '“Key” and “Key format” (number, text or HEX). “Read input as” is auto, UTF-8 or bytes as is. “Strict” gives an error instead of a warning.'],
    keep: ['Результат — байты; для текста добавьте «Байты → текст». Операция сама себе обратная.', 'The result is bytes; add “Bytes → text” for text. The operation is its own inverse.'],
    chk: ['Однобайтовый ключ перебирается за 256 попыток; верный даёт читаемый текст или известную сигнатуру.', 'A one-byte key takes 256 attempts; the right one gives readable text or a known signature.'],
    wiki: ['XOR cipher', 'XOR-шифр'],
  });
  H('xor_keep', {
    inp: ['Текст (первый вход) и ключ (второй вход или параметр).', 'Text (first input) and a key (second input or parameter).'],
    what: ['XOR только тех символов, которые не попадают под правило «оставить как есть» (пробелы, знаки, небуквы).', 'XORs only the characters not covered by the “keep as is” rule (spaces, punctuation, non-letters).'],
    ex: ['Idmmn, vnsme', 'Hello, world', { key: '1', fmt: 'num', keep: 'nonalnum' }],
    par: ['«Ключ» и формат. «Оставлять как есть» — пробелы, пробелы и знаки, всё кроме букв или ничего. «Оставленные двигают ключ» — тратят ли они позицию ключа.', '“Key” and format. “Keep as is” is whitespace, spaces and punctuation, everything but letters, or nothing. “Kept characters advance the key” decides whether they use a key position.'],
    keep: ['Оставленные символы идут в результат без изменений.', 'Kept characters pass into the result unchanged.'],
    chk: ['Попробуйте оба варианта «двигают ключ»: правильный даёт читаемые слова.', 'Try both “advance the key” settings: the right one gives readable words.'],
    wiki: ['XOR cipher', 'XOR-шифр'],
  });
  H('decompress', {
    inp: ['Сжатые байты: байтовая строка после Base64/HEX/XOR или файл (.gz, .zz, поток из PNG/PDF).', 'Compressed bytes: a byte string after Base64/HEX/XOR or a file (.gz, .zz, a stream from PNG/PDF).'],
    what: ['Распаковывает gzip, zlib и сырой deflate; формат определяется по заголовку или выбирается вручную, контрольные суммы проверяются.', 'Decompresses gzip, zlib and raw deflate; the format is detected by the header or chosen by hand, and checksums are verified.'],
    ex: ['eJzzSM3JyVcozy/KSQEAGKsEPQ==', ['байты «Hello world» (после «Base64 → байты»)', 'the bytes “Hello world” (after Base64 → bytes)']],
    par: ['«Формат» (авто, zlib, gzip, сырой deflate), «Предел результата, МБ» (защита от архивной бомбы), «Строго» — неверная контрольная сумма становится ошибкой.', '“Format” (auto, zlib, gzip, raw deflate), “Result limit, MB” (archive bomb protection), “Strict”: a wrong checksum becomes an error.'],
    keep: ['Результат — байты; для текста добавьте «Байты → текст», для файла — «Байты → файл».', 'The result is bytes; add Bytes → text for text or Bytes → file for a file.'],
    chk: ['Сошедшаяся Adler-32 (zlib) или CRC-32 с длиной (gzip) подтверждает и распаковку, и ключ XOR выше по цепочке. У сырого deflate проверки нет.', 'A matching Adler-32 (zlib) or CRC-32 with the length (gzip) confirms both the decompression and an XOR key upstream. Raw deflate has no check.'],
    wiki: ['zlib', 'Zlib'], std: ['RFC 1950 / 1951 / 1952', 'https://www.rfc-editor.org/rfc/rfc1950'], exNoRun: true,
  });
  H('bit_rows', {
    inp: ['Группы 0/1 через пробелы (битовый дамп, напечатанный группами и колонками).', 'Groups of 0/1 separated by spaces (a bit dump printed in groups and columns).'],
    what: ['Оставляет в группах значащие младшие биты, склеивает группы в строки сетки и раскладывает колонки текста обратно по строкам.', 'Keeps the significant low bits of each group, joins groups into grid rows and lays text columns back out into rows.'],
    ex: ['0000000000001111 0000000000000011', '111111', { keep: '4,2', perRow: 2, columns: 1 }],
    par: ['«Значащих бит в группах» — список по кругу; «Групп в строке сетки»; «Строк сетки в строке текста» — сколько строк стоит рядом.', '“Kept low bits per group”: a cycling list; “Groups per grid row”; “Grid rows per text line”: how many rows sit side by side.'],
    keep: ['Выход — по строке сетки на строку; дальше нода «Биты → изображение» и «QR».', 'The output has one grid row per line; then the Bits → image and QR nodes.'],
    chk: ['Признак верной геометрии — шаблоны поиска QR (7×7) в трёх углах. Sombra: 12,12,13 бит, 3 группы, 3 колонки → QR версии 5.', 'The right geometry shows QR finder patterns (7×7) in three corners. Sombra: 12,12,13 bits, 3 groups, 3 columns → QR version 5.'],
    wiki: ['QR code', 'QR-код'],
  });
  H('enigma', {
    inp: ['Текст из букв A–Z (регистр и не-буквы сохраняются).', 'Text of letters A–Z (case and non-letters are kept).'],
    what: ['Модель шифромашины Энигма I/M3 и M4: роторы, кольца, стартовые позиции, коммутатор и двойной шаг среднего ротора. Шифрует и расшифровывает одинаково.', 'An Enigma I/M3 and M4 machine model: rotors, rings, start positions, plugboard and the middle-rotor double step. Encrypts and decrypts the same way.'],
    ex: ['AAAAA', 'BDZGO', {}],
    par: ['«Модель», «Роторы» слева направо (у M4 первым Beta/Gamma), «Рефлектор», «Кольца» и «Стартовые позиции» (AAA или 1 1 1), «Коммутатор» — пары букв через пробел.', '“Model”, “Rotors” left to right (Beta/Gamma first on M4), “Reflector”, “Rings” and “Start positions” (AAA or 1 1 1), “Plugboard”: letter pairs separated by spaces.'],
    keep: ['Не-буквы проходят без шага роторов; регистр букв сохраняется.', 'Non-letters pass without stepping the rotors; letter case is kept.'],
    chk: ['Сверено с опубликованными сообщениями 1941 (M3) и 1942 (M4). Настройки нужно взять из загадки: авто-поиск Энигму не перебирает.', 'Checked against the published 1941 (M3) and 1942 (M4) messages. Take the settings from the puzzle: Auto does not search Enigma.'],
    wiki: ['Enigma machine', 'Энигма'],
  });
  H('rc4', {
    inp: ['Байты (после HEX/Base64) или текст и ключ.', 'Bytes (after HEX/Base64) or text, and a key.'],
    what: ['Сырой потоковый шифр RC4 без соли и без производства ключа из пароля; шифрование и расшифровка совпадают.', 'The raw RC4 stream cipher with no salt and no password-based key derivation; encryption equals decryption.'],
    ex: ['Plaintext', ['байты BB F3 16 E8 D9 40 AF 0A D3 (ключ Key)', 'bytes BB F3 16 E8 D9 40 AF 0A D3 (key Key)']],
    par: ['«Ключ» текстом или HEX, «Отбросить байт потока» (RC4-drop), «Вход как».', '“Key” as text or HEX, “Drop stream bytes” (RC4-drop), “Read input as”.'],
    keep: ['Результат — байты; для текста добавьте «Байты → текст». Файлы «openssl enc -rc4» с Salted__ — нода OpenSSL.', 'The result is bytes; add “Bytes → text” for text. “openssl enc -rc4” files with Salted__ need the OpenSSL node.'],
    chk: ['Проверено векторами Key/Plaintext, Wiki/pedia и Secret/Attack at dawn.', 'Checked with the Key/Plaintext, Wiki/pedia and Secret/Attack at dawn vectors.'],
    wiki: ['RC4', 'RC4'], exNoRun: true,
  });
  H('openssl_inspect', {
    inp: ['Строка Base64, начинающаяся с U2FsdGVkX1… (или сырые байты «Salted__»).', 'A Base64 string starting with U2FsdGVkX1… (or raw “Salted__” bytes).'],
    what: ['Показывает, что это за файл openssl enc: размер, соль, длину шифртекста и какие шифры возможны. Ничего не расшифровывает.', 'Shows what this openssl enc output is: size, salt, ciphertext length and which ciphers are possible. It decrypts nothing.'],
    ex: ['U2FsdGVkX19A34+ilS4J+tBWylqW01PI9kZpwv36+N0=', ['Salted__, соль 8 байт, шифртекст 16 байт', 'Salted__, 8-byte salt, 16-byte ciphertext']],
    par: null,
    keep: ['Только отчёт; данные не изменяются.', 'A report only; the data are not changed.'],
    chk: ['Префикс «Salted__» и длина шифртекста, кратная 16, — признак AES-CBC/ECB.', 'The “Salted__” prefix and a ciphertext length that is a multiple of 16 indicate AES-CBC/ECB.'],
    wiki: ['OpenSSL', 'OpenSSL'], std: ['openssl-enc', 'https://docs.openssl.org/master/man1/openssl-enc/'], exNoRun: true,
  });
  H('openssl_decrypt', {
    inp: ['Base64 или байты «Salted__…» (первый вход) и пароль (второй вход или параметр).', 'Base64 or “Salted__…” bytes (first input) and a password (second input or parameter).'],
    what: ['Расшифровывает вывод «openssl enc» со старым ключевым выводом EVP_BytesToKey(MD5): AES-CBC/ECB/CTR и RC4.', 'Decrypts “openssl enc” output with the legacy EVP_BytesToKey(MD5) key derivation: AES-CBC/ECB/CTR and RC4.'],
    ex: ['U2FsdGVkX19A34+ilS4J+tBWylqW01PI9kZpwv36+N0= | hunter2', 'attack at dawn', { cipher: 'aes-256-cbc' }],
    par: ['«Пароль» и «Шифр» (AES-128/192/256 в режимах CBC, ECB, CTR или RC4). PBKDF2 (-pbkdf2) не поддерживается.', '“Password” and “Cipher” (AES-128/192/256 in CBC, ECB, CTR modes, or RC4). PBKDF2 (-pbkdf2) is not supported.'],
    keep: ['Неверный пароль или шифр даёт ошибку (дополнение PKCS#7 не сходится), а не мусор.', 'A wrong password or cipher gives an error (PKCS#7 padding mismatch) instead of garbage.'],
    chk: ['Успех — читаемый текст. Нужен точный пароль и тот же шифр, что при шифровании.', 'Success is readable text. You need the exact password and the same cipher as at encryption.'],
    wiki: ['OpenSSL', 'OpenSSL'], std: ['openssl-enc', 'https://docs.openssl.org/master/man1/openssl-enc/'],
  });

  // ---------- Перестановки ----------
  H('rail_fence', {
    what: ['Шифр «изгородь»: текст записывается зигзагом по N рельсам и читается по строкам.', 'The rail fence cipher: text is written in a zigzag over N rails and read row by row.'],
    ex: ['WECRLTEERDSOEEFEAOCAIVDEN', 'WEAREDISCOVEREDFLEEATONCE', { rails: 3, dir: 'dec' }],
    par: ['«Рельсы» — число рядов. «Режим» — расшифровка или шифрование.', '“Rails” is the number of rows. “Mode” is decrypt or encrypt.'],
    keep: ['Пробелы и знаки считаются символами текста и переставляются вместе с буквами.', 'Spaces and punctuation count as text characters and move with the letters.'],
    chk: ['Рельсов немного (2–10): перебор быстрый, верное число даёт слова.', 'There are few rail counts (2–10): brute force is quick and the right count gives words.'],
    wiki: ['Rail fence cipher', 'Шифр_«рельсовая_изгородь»'],
  });
  H('transpose', {
    what: ['Текст записывается строками по W символов и читается по столбцам (или наоборот).', 'The text is written in rows of W characters and read by columns (or the reverse).'],
    ex: ['ABCDEFGHI', 'ADGBEHCFI', { w: 3, dir: 'cols' }],
    par: ['«Ширина W» — символов в строке. «Читать» — по столбцам или обратно из столбцов.', '“Width W” is characters per row. “Read” is by columns or back from columns.'],
    keep: ['Все символы сохраняются, меняется только порядок.', 'All characters are kept; only their order changes.'],
    chk: ['Подбирайте W по делителям длины текста; верное значение даёт слова.', 'Try values of W that divide the text length; the right one gives words.'],
    wiki: ['Transposition cipher', 'Шифр_перестановки'],
  });
  H('columnar', {
    inp: ['Текст (первый вход) и ключевое слово (второй вход или параметр).', 'Text (first input) and a keyword (second input or parameter).'],
    what: ['Колонная перестановка: текст пишется строками под ключом, столбцы читаются в алфавитном порядке букв ключа.', 'Columnar transposition: the text is written in rows under the key and columns are read in the alphabetical order of the key letters.'],
    ex: ['EVLNACDTESEAROFODEECWIREE', 'WEAREDISCOVEREDFLEEATONCE', { key: 'ZEBRAS', dir: 'dec' }],
    par: ['«Ключ» — слово (порядок букв задаёт порядок столбцов). «Режим» — расшифровка или шифрование.', '“Key” is a word (its letter order sets the column order). “Mode” is decrypt or encrypt.'],
    keep: ['Все символы сохраняются; изменяется только порядок.', 'All characters are kept; only the order changes.'],
    chk: ['Длина ключа обычно делит длину текста или слегка не доходит; верный ключ даёт связные слова.', 'The key length usually divides the text length or falls just short; the right key gives coherent words.'],
    wiki: ['Transposition cipher#Columnar transposition', 'Шифр_перестановки'],
  });
  H('scytale', {
    what: ['Скитала: ленту наматывали на стержень, текст писали по виткам; нода читает/пишет по столбцам заданной высоты.', 'The scytale: a strip wound around a rod, text written across the turns; the node reads/writes by columns of a given height.'],
    ex: ['IRYYATBHMVAEHEDLURLP', 'IAMHURTVERYBADLYHELP', { rows: 4, dir: 'dec' }],
    par: ['«Букв на витке» — число символов вокруг стержня. «Убрать пробелы». «Режим» — расшифровка или шифрование.', '“Letters around the rod” is the number of characters per turn. “Remove whitespace”. “Mode” is decrypt or encrypt.'],
    keep: ['Все буквы сохраняются, меняется порядок.', 'All letters are kept; the order changes.'],
    chk: ['Подбор числа 2–20 быстрый: верное число даёт слова.', 'Trying 2–20 is quick: the right number gives words.'],
    wiki: ['Scytale', 'Сцитала'],
  });
  H('route_cipher', {
    what: ['Маршрутный шифр: текст записан в сетку по строкам и читается по маршруту (спираль, змейка, столбцы).', 'The route cipher: the text is written into a grid by rows and read along a route (spiral, snake, columns).'],
    ex: ['ABCFIHGDE', 'ABCDEFGHI', { width: 3, route: 'spiral_cw', dir: 'dec' }],
    par: ['«Столбцов» — ширина сетки. «Маршрут» и «Стартовый угол». «Обратный порядок» — идти от конца маршрута. «Заполнитель» для короткой строки. «Режим».', '“Grid columns”. “Route” and “Start corner”. “Reversed” goes from the end of the route. “Padding” for a short last row. “Mode”.'],
    keep: ['Все символы сохраняются; заполнитель добавляется при шифровании.', 'All characters are kept; padding is added when encrypting.'],
    chk: ['Различных маршрутов и углов немного (до сотни комбинаций): перебирайте, пока не появятся слова.', 'There are only a hundred or so route/corner combinations: try them until words appear.'],
    wiki: ['Transposition cipher#Route cipher', 'Шифр_перестановки'],
  });
  H('myszkowski', {
    inp: ['Текст (первый вход) и ключевое слово с повторяющимися буквами (второй вход или параметр).', 'Text (first input) and a keyword with repeated letters (second input or parameter).'],
    what: ['Вариант колонной перестановки: одинаковые буквы ключа образуют одну группу столбцов, читаемую вместе.', 'A columnar transposition variant: repeated key letters form one column group that is read together.'],
    ex: ['ROFOACDTEDSEEEACWEIVRLENE', 'WEAREDISCOVEREDFLEEATONCE', { key: 'TOMATO', dir: 'dec' }],
    par: ['«Ключ» — слово. «Убрать пробелы». «Режим». ' + GROUP_PAR[0], '“Keyword”. “Remove whitespace”. “Mode”. ' + GROUP_PAR[1]],
    keep: ['Все символы сохраняются.', 'All characters are kept.'],
    chk: ['Если обычная колонная перестановка с этим ключом не работает, а в ключе есть повторы, попробуйте эту.', 'If a plain columnar transposition with this key fails and the key has repeats, try this one.'],
    wiki: ['Transposition cipher#Myszkowski', 'Шифр_перестановки'],
  });
  H('grid_rotate', {
    what: ['Раскладывает текст в сетку шириной W и поворачивает или отражает её.', 'Lays the text out in a grid of width W and rotates or flips it.'],
    ex: ['ABCDEF', 'DAEBFC', { w: 3, op: 'cw' }],
    par: ['«Ширина W». «Действие» — поворот на 90° по/против часовой, 180°, отражение. «Вывод строками» — сохранить строки сетки.', '“Width W”. “Action” is a 90° rotation either way, 180°, or a flip. “Output as lines” keeps the grid rows.'],
    keep: ['Переводы строк не входят в сетку; незаполненная последняя строка может сместить результат.', 'Line breaks do not enter the grid; an unfilled last row can shift the result.'],
    chk: ['Подберите W (чаще всего делитель длины); верный поворот даёт читаемый текст.', 'Adjust W (usually a divisor of the length); the right rotation gives readable text.'],
    wiki: ['Transposition cipher', 'Шифр_перестановки'], demo: 'dng-grid',
  });
  H('swap_pairs', {
    what: ['Меняет местами соседние символы: «abcd» → «badc». Полезно для hex с поменянными половинками байтов.', 'Swaps adjacent characters: “abcd” → “badc”. Useful for hex with swapped nibbles.'],
    ex: ['abcd', 'badc'],
    par: null,
    keep: ['При нечётной длине последний символ остаётся на месте.', 'With an odd length the last character stays in place.'],
    chk: ['Проверьте следующим шагом (например, HEX → байты).', 'Check it with the next step (for example HEX → bytes).'],
    wiki: ['Transposition cipher', 'Шифр_перестановки'],
  });
  H('permute_fragments', {
    inp: ['Несколько коротких фрагментов (до 8), разделённых пробелами, запятыми или строками.', 'A few short fragments (up to 8) separated by spaces, commas or lines.'],
    what: ['Перебирает порядок фрагментов и оставляет только склейки, подходящие под условия (начало, конец, подстрока, длина, regex, «похоже на ID сервиса»).', 'Tries the orders of the fragments and keeps only the joins that satisfy the constraints (start, end, substring, length, regex, “looks like a service ID”).'],
    ex: ['L2GD AgL LrgQ', 'AgLL2GDLrgQ…', { prefix: 'AgL' }],
    par: ['«Разделитель», «Склеить через», «Должно начинаться/заканчиваться/содержать», «Длина результата», «Регулярное выражение», «Только похожие на ID сервиса», «Максимум результатов».', '“Separator”, “Join with”, “Must start/end/contain”, “Result length”, “Regular expression”, “Only service-ID-like”, “Maximum results”.'],
    keep: ['На выходе — по одному варианту в строке; число перестановок растёт как N!, поэтому предел 8.', 'One variant per line; permutations grow as N!, hence the limit of 8.'],
    chk: ['Подтвердите вариант внешней проверкой (например, ссылкой или YouTube), а не «выглядит похоже».', 'Confirm a variant with an outside check (for example a link or YouTube), not by “looks plausible”.'],
    wiki: ['Permutation', 'Перестановка'], demo: 'fragments',
  });
})(typeof self !== 'undefined' ? self : this);
