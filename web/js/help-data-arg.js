// Справочные карточки: ARG-шифры и скрытое, текстовые инструменты, хеши. См. help-data.js (формат записи).
// i18n-file-ok: все тексты — пары ['русский', 'English'], полноту проверяет tests/help.test.js.
(function (G) {
  'use strict';
  const H = G.HelpData.add;

  // ---------- Шифры, встречающиеся в ARG и головоломках ----------
  H('sga_decode', {
    inp: ['Текст из знаков «стола зачарований» (Standard Galactic Alphabet).', 'Text of enchanting-table glyphs (the Standard Galactic Alphabet).'],
    what: ['Заменяет знаки алфавита стола зачарований из Minecraft на латинские буквы — это простая подстановка один знак → одна буква.', 'Replaces Minecraft enchanting-table (Standard Galactic) glyphs with Latin letters: a plain one-glyph-to-one-letter substitution.'],
    ex: ['ᔑʖᓵ↸ᒷ', 'abcde'],
    par: null,
    keep: ['Алфавит не различает регистр; все буквы выходят строчными. Пробелы и незнакомые знаки остаются.', 'The alphabet has no case; all letters come out lowercase. Spaces and unknown symbols stay.'],
    chk: ['Результат — слова на английском. Если знаков нет в тексте, а есть картинка, используйте «Изображение: SGA». Набрать знаки удобно на вкладке «⌨ Клавиатуры».', 'The result is English words. If you have a picture rather than text, use “Image: SGA”. Glyphs are easy to type with the “⌨ Keyboards” panel.'],
    wiki: ['Standard Galactic Alphabet', 'Стандартный_галактический_алфавит'], demo: 'sga',
  });
  H('sga_encode', {
    what: ['Записывает латинский текст знаками стола зачарований (Standard Galactic Alphabet).', 'Writes Latin text in enchanting-table (Standard Galactic) glyphs.'],
    ex: ['abcde', 'ᔑʖᓵ↸ᒷ'],
    par: null,
    keep: ['Регистр и знаки без пары остаются как есть.', 'Case and symbols without a pair stay as they are.'],
    chk: ['Прогоните через «Стол зачарований → текст» — должен вернуться исходник.', 'Run it through “Enchanting table → text”: you should get the original back.'],
    wiki: ['Standard Galactic Alphabet', 'Стандартный_галактический_алфавит'], demo: 'sga',
  });
  H('polybius', {
    inp: ['Пары цифр «строка-столбец» (например 23 15 31).', 'Digit pairs “row-column” (for example 23 15 31).'],
    what: ['Квадрат Полибия: пара цифр указывает строку и столбец в таблице 5×5 (6×6 для кириллицы); получается буква.', 'The Polybius square: a pair of digits gives the row and column in a 5×5 table (6×6 for Cyrillic), which yields a letter.'],
    ex: ['23 15 31 31 34', 'HELLO', { square: 'en' }],
    par: ['«Квадрат» — латинский 5×5 (I=J), 5×5 с K=C или кириллический 6×6. «Ключевое слово» — переставляет квадрат. «Сначала столбец» — меняет порядок цифр в паре.', '“Square” is Latin 5×5 (I=J), 5×5 with K=C or Cyrillic 6×6. “Key word” rearranges the square. “Column first” swaps the digit order in a pair.'],
    keep: ['I и J (или K и C) неразличимы. Регистр не кодируется.', 'I and J (or K and C) are indistinguishable. Case is not encoded.'],
    chk: ['Пробуйте оба порядка цифр и разные квадраты; верный вариант даёт слова.', 'Try both digit orders and different squares; the right one gives words.'],
    wiki: ['Polybius square', 'Квадрат_Полибия'], demo: 'polybius',
  });
  H('tap_code', {
    inp: ['Группы точек, например «.. ...  . .....» (две группы на букву).', 'Groups of dots, for example “.. ...  . .....” (two groups per letter).'],
    what: ['Тап-код (стуки): каждая буква — пара групп ударов, число ударов в первой группе — строка, во второй — столбец квадрата 5×5.', 'Tap code (knocks): each letter is a pair of knock groups; the first count is the row, the second the column of a 5×5 square.'],
    ex: ['.. ...  . .....  ... .  ... .  ... ....', 'HELLO'],
    par: ['«Квадрат» — латинский (K=C) или кириллический 6×6. «Строго» — ошибка вместо предупреждения о непарной группе.', '“Square” is Latin (K=C) or Cyrillic 6×6. “Strict” turns the unpaired-group warning into an error.'],
    keep: ['K и C совпадают; последняя непарная группа отбрасывается с предупреждением.', 'K and C coincide; a final unpaired group is dropped with a warning.'],
    chk: ['Результат — слова. Источник стуков (звук, мигание) сначала нужно превратить в точки отдельным инструментом.', 'The result is words. Knocks from audio or blinking must first be turned into dots with another tool.'],
    wiki: ['Tap code', 'Тап-код'], demo: 'tap',
  });
  H('bacon', {
    inp: ['Группы по 5 символов A/B (или 0/1, или регистр букв).', 'Groups of 5 symbols A/B (or 0/1, or letter case).'],
    what: ['Шифр Бэкона: каждая буква — пять символов из двух (A/B); регистр букв тоже может нести A/B.', 'The Baconian cipher: each letter is five symbols from two (A/B); the case of letters can also carry A/B.'],
    ex: ['AABBB AABAA ABABB ABABB ABBBA', 'HELLO'],
    par: ['«Алфавит» — 26 букв или 24 (I=J, U=V). «Что считать A/B» — авто, буквы A/B, 0/1 или регистр. «Строго» — ошибка вместо предупреждения о неполном хвосте.', '“Alphabet” is 26 letters or 24 (I=J, U=V). “What counts as A/B” is auto, letters A/B, 0/1 or letter case. “Strict” turns the incomplete-tail warning into an error.'],
    keep: ['Неполная последняя группа отбрасывается.', 'An incomplete last group is dropped.'],
    chk: ['Если читаемого текста нет, смените алфавит (24/26) и вариант A/B ↔ B/A.', 'If nothing readable appears, switch the alphabet (24/26) and swap A/B ↔ B/A.'],
    wiki: ['Bacon\'s cipher', 'Шифр_Бэкона'], demo: 'bacon',
  });
  H('t9', {
    inp: ['Нажатия клавиш телефона: «44 33 555 555 666» или пары «клавиша-позиция».', 'Phone key presses: “44 33 555 555 666” or “key-position” pairs.'],
    what: ['Мультитап старых телефонов: цифра повторяется по числу нажатий и даёт букву этой клавиши.', 'Old-phone multitap: a digit repeated N times gives the N-th letter on that key.'],
    ex: ['44 33 555 555 666', 'hello'],
    par: ['«Раскладка» — латиница или кириллица. «Запись» — повторы (44 33 555) или клавиша и позиция (42 = h).', '“Layout” is Latin or Cyrillic. “Notation” is repeats (44 33 555) or key and position (42 = h).'],
    keep: ['Пробел между группами разделяет буквы.', 'A space between groups separates the letters.'],
    chk: ['Тоны DTMF из аудио сначала превращаются в цифры нодой «DTMF из аудио».', 'DTMF tones from audio first become digits with the “DTMF from audio” node.'],
    wiki: ['Multi-tap', 'T9_(система_ввода)'], std: ['ITU-T E.161 (раскладка клавиш)', 'https://www.itu.int/rec/T-REC-E.161/en'], demo: 't9',
  });
  H('leet', {
    what: ['Заменяет цифры и символы внутри слов на похожие буквы: 1NF3C7ED → INFECTED.', 'Replaces digits and symbols inside words with look-alike letters: 1NF3C7ED → INFECTED.'],
    ex: ['1NF3C7ED', 'INFECTED'],
    par: null,
    keep: ['Однозначной замены нет (1 бывает I или L), поэтому проверяйте по смыслу.', 'The mapping is not unique (1 can be I or L), so check it against the meaning.'],
    chk: ['Получились слова — успех. Для русских слов латиницей используйте «Русский латиницей».', 'Words appear: success. For Russian written in Latin letters use “Russian in Latin letters”.'],
    wiki: ['Leet', 'Leet'], demo: 'dng-leet',
  });
  H('keyboard_shift', {
    what: ['Каждая клавиша заменяется соседней в том же ряду: сдвиг −1 превращает «jr;;p» в «hello».', 'Every key is replaced by its neighbour in the same row: shift −1 turns “jr;;p” into “hello”.'],
    ex: ['jr;;p', 'hello', { n: -1 }],
    par: ['«Сдвиг» — на сколько клавиш влево (−) или вправо (+).', '“Shift” is how many keys left (−) or right (+).'],
    keep: ['Символы вне рядов QWERTY остаются как есть.', 'Characters outside the QWERTY rows stay as they are.'],
    chk: ['Попробуйте −2…+2; верный сдвиг даёт слова.', 'Try −2…+2; the right shift gives words.'],
    wiki: ['Keyboard layout', 'Раскладка_клавиатуры'],
  });
  H('homoglyph', {
    inp: ['Текст со смесью кириллицы и латиницы.', 'Text mixing Cyrillic and Latin.'],
    what: ['Находит кириллические буквы, неотличимые от латинских (А, Е, О, Р, С…), заменяет их или читает как биты: латиница = 0, кириллица = 1.', 'Finds Cyrillic letters indistinguishable from Latin ones (А, Е, О, Р, С…), replaces them or reads them as bits: Latin = 0, Cyrillic = 1.'],
    ex: ['Thе quick', 'The quick', { mode: 'tolat' }],
    par: ['«Режим»: кириллица → латиница, латиница → кириллица, биты или подсветка кириллицы в [скобках].', '“Mode”: Cyrillic → Latin, Latin → Cyrillic, bits, or highlight Cyrillic in [brackets].'],
    keep: ['Остальные символы не меняются.', 'Other characters are not changed.'],
    chk: ['Режим «подсветка» показывает, какие буквы подменены; сообщение в битах читается через «Двоичный → байты». Набрать знаки удобно на вкладке «⌨ Клавиатуры».', 'The highlight mode shows which letters are swapped; a bit message is read through “Binary → bytes”. Glyphs are easy to type with the “⌨ Keyboards” panel.'],
    wiki: ['IDN homograph attack', 'Омоглиф'], demo: 'homoglyph',
  });
  H('zero_width', {
    what: ['Находит невидимые символы нулевой ширины (U+200B, 200C, 200D, FEFF), показывает, удаляет или читает как биты.', 'Finds invisible zero-width characters (U+200B, 200C, 200D, FEFF) and shows, removes or reads them as bits.'],
    ex: ['a​b', 'a⟨200B⟩b', { mode: 'show' }],
    par: ['«Режим»: биты (200B = 0, 200C = 1), биты (200C = 0, 200D = 1), показать метками или удалить.', '“Mode”: bits (200B = 0, 200C = 1), bits (200C = 0, 200D = 1), show as marks, or strip.'],
    keep: ['Видимый текст не меняется (кроме режима удаления).', 'Visible text is not changed (except in strip mode).'],
    chk: ['Биты складываются в байты — подайте результат в «Двоичный → байты». Набрать знаки удобно на вкладке «⌨ Клавиатуры».', 'Bits form bytes: feed the result to “Binary → bytes”. Glyphs are easy to type with the “⌨ Keyboards” panel.'],
    wiki: ['Zero-width space', 'Пробел_нулевой_ширины'],
  });
  H('acrostic', {
    what: ['Берёт N-ю букву каждого слова или строки (первую, последнюю) либо только заглавные буквы текста.', 'Takes the N-th letter of each word or line (first, last) or just the capital letters of the text.'],
    ex: ['Hello Every Little Lovely One', 'HELLO', { n: 1, by: 'words' }],
    par: ['«Какая буква» — 1 первая, −1 последняя. «Брать из» — каждое слово, каждая строка или только заглавные.', '“Which letter”: 1 is first, −1 last. “Take from”: each word, each line, or capitals only.'],
    keep: ['Остальные буквы отбрасываются.', 'The other letters are dropped.'],
    chk: ['Ищите осмысленное слово; попробуйте разные N и «по строкам».', 'Look for a meaningful word; try different N and “by lines”.'],
    wiki: ['Acrostic', 'Акростих'],
  });
  H('book_cipher', {
    inp: ['Числа-указатели (первый вход) и текст книги (второй вход или параметр).', 'Pointer numbers (first input) and the book text (second input or parameter).'],
    what: ['Книжный шифр: числа указывают на слова (или буквы, строки) в заданном тексте; результат — выбранные элементы.', 'A book cipher: numbers point to words (or letters, lines) in a given text; the result is the selected items.'],
    ex: ['1 3 2', 'one three two', { unit: 'words', book: 'one two three four five' }],
    par: ['«Число указывает на» — слово, первую букву слова, букву текста или строку. «Текст книги» — если второй вход не подключён. Запись «3:5» — строка 3, слово 5.', '“A number points to”: a word, the first letter of a word, a letter of the text or a line. “Book text” is used when the second input is not connected. “3:5” means line 3, word 5.'],
    keep: ['Нужен точно тот же текст (издание, пунктуация), что у автора. Номер вне текста — ошибка.', 'You need exactly the author’s text (edition, punctuation). A number outside the text is an error.'],
    chk: ['Осмысленный результат только при верном издании; сверяйте несколько слов.', 'A meaningful result appears only with the right edition; check several words.'],
    wiki: ['Book cipher', 'Книжный_шифр'],
  });
  H('ru_leet', {
    inp: ['Русский текст, записанный латиницей и цифрами.', 'Russian text written in Latin letters and digits.'],
    what: ['Превращает русский текст «латиницей и цифрами» в кириллицу: по звуку (N3 → не) или по виду (N → И, R → Я).', 'Turns Russian written in Latin letters and digits back into Cyrillic: by sound (N3 → не) or by look (N → И, R → Я).'],
    ex: ['N3 S4yu', 'Не Счуу', { mode: 'phonetic' }],
    par: ['«Как заменять»: по звуку или по виду букв.', '“How to replace”: by sound or by the look of the letters.'],
    keep: ['Замены неоднозначны: просмотрите оба режима.', 'Replacements are ambiguous: look at both modes.'],
    chk: ['Читаемые русские слова. Для английского leet используйте «Leet → буквы».', 'Readable Russian words. For English leet use “Leet → letters”.'],
    wiki: ['Padonkaffsky jargon#Translit', 'Транслит'],
  });
  H('mc_format', {
    inp: ['Текст с кодами форматирования Minecraft (§a, §l, при желании &c).', 'Text with Minecraft formatting codes (§a, §l, optionally &c).'],
    what: ['Убирает цветовые и стилевые коды Minecraft (§ и следующий символ) или оставляет только сами коды.', 'Removes Minecraft colour and style codes (§ and the next character) or keeps only the codes.'],
    ex: ['§aHello §lworld', 'Hello world', { mode: 'strip' }],
    par: ['«Режим»: убрать коды или оставить только коды. «& как код» — считать амперсанд кодом (как плагины).', '“Mode”: remove codes or keep only the codes. “Treat & as a code” counts the ampersand as a code (as plugins do).'],
    keep: ['Если коды сами несут сообщение (последовательность цветов), используйте режим «только коды».', 'If the codes themselves carry the message (a sequence of colours), use the “codes only” mode.'],
    chk: ['Чистый текст после удаления читается; последовательность цветов превращается в буквы вручную. Набрать знаки удобно на вкладке «⌨ Клавиатуры».', 'The text reads cleanly after removal; a colour sequence is mapped to letters by hand. Glyphs are easy to type with the “⌨ Keyboards” panel.'],
    wiki: ['Minecraft#Formatting_codes', 'Minecraft'], std: ['Formatting codes (Minecraft Wiki)', 'https://minecraft.wiki/w/Formatting_codes'],
  });
  H('num_letters', {
    inp: ['Числа (через пробелы, запятые, переносы).', 'Numbers (separated by spaces, commas, line breaks).'],
    what: ['Универсальная замена число → буква: нумерация с 0 или 1, сдвиг и сворачивание по модулю длины алфавита (27 → A при 26 буквах).', 'A universal number-to-letter mapping: numbering from 0 or 1, an offset and wrap-around modulo the alphabet length (27 → A with 26 letters).'],
    ex: ['27 12 12 15', 'ALLO', { alpha: 'en' }],
    par: ['«Алфавит» (можно свой), «Первая буква =», «Смещение», «Числа вне алфавита» (по модулю, ошибка, пропуск), «Разрывы» и «Регистр вывода».', '“Alphabet” (a custom one is allowed), “First letter =”, “Offset”, “Numbers outside the alphabet” (modulo, error, skip), “Breaks” and “Output case”.'],
    keep: ['Знаки препинания можно превращать в пробелы, переносы строк — сохранять.', 'Punctuation can turn into spaces and line breaks can be kept.'],
    chk: ['Меняйте базу (0/1) и смещение, пока не появятся слова.', 'Change the base (0/1) and the offset until words appear.'],
    wiki: ['Substitution cipher', 'Шифр_простой_замены'], demo: 'numbers-mod',
  });
  H('case_bits', {
    inp: ['Текст со смешанным регистром букв.', 'Text with mixed letter case.'],
    what: ['Читает регистр букв как поток битов (заглавная = 1, строчная = 0 или наоборот) и собирает биты, байты по 8 или 7 бит либо буквы по 5 бит.', 'Reads letter case as a bit stream (upper = 1, lower = 0 or the reverse) and assembles bits, bytes of 8 or 7 bits, or letters of 5 bits.'],
    ex: ['hELLO', '01111', { upper: '1', out: 'bits' }],
    par: ['«Заглавная =» — какое значение даёт верхний регистр. «Выход»: биты, текст из 8 бит, из 7 бит, буквы из 5 бит (Бэкон). «Строго».', '“Uppercase =” sets which value capitals give. “Output”: bits, text from 8 bits, from 7 bits, letters from 5 bits (Bacon). “Strict”.'],
    keep: ['Небуквы пропускаются.', 'Non-letters are skipped.'],
    chk: ['Если биты не читаются, инвертируйте «Заглавная =» и пробуйте 7 и 8 бит.', 'If the bits are unreadable, invert “Uppercase =” and try 7 and 8 bits.'],
    wiki: ['Bacon\'s cipher', 'Шифр_Бэкона'], demo: 'case-bits',
  });
  H('pigpen_decode', {
    inp: ['Условная запись знаков (rb lrb lb…) или юникод-приближения; «/» — граница слов.', 'Token notation (rb lrb lb…) or Unicode approximations; “/” is a word gap.'],
    what: ['Шифр масонов (пигпен): каждая буква — фигура из решётки или креста; нода читает её текстовую запись.', 'The pigpen (Freemason) cipher: each letter is a shape from a grid or cross; the node reads its text notation.'],
    ex: ['rb lrb lb', 'ABC'],
    par: null,
    keep: ['Точка после знака означает вторую половину алфавита (J–R, W–Z).', 'A dot after a token means the second half of the alphabet (J–R, W–Z).'],
    chk: ['Если у вас картинка с фигурами, сначала запишите их токенами вручную; результат — английские слова. Набрать знаки удобно на вкладке «⌨ Клавиатуры».', 'If you have a picture of shapes, write them as tokens by hand first; the result is English words. Glyphs are easy to type with the “⌨ Keyboards” panel.'],
    wiki: ['Pigpen cipher', 'Масонский_шифр'],
  });
  H('pigpen_encode', {
    what: ['Записывает латинские буквы фигурами пигпена (текстовыми токенами или юникод-приближениями).', 'Writes Latin letters as pigpen shapes (text tokens or Unicode approximations).'],
    ex: ['ABC', 'rb lrb lb', { style: 'ascii' }],
    par: ['«Запись» — юникод-знаки или токены.', '“Notation” is Unicode glyphs or tokens.'],
    keep: ['Слова разделяются «/».', 'Words are separated by “/”.'],
    chk: ['Обратная операция — «Пигпен → буквы».', 'The reverse is “Pigpen → letters”.'],
    wiki: ['Pigpen cipher', 'Масонский_шифр'],
  });
  H('runes_decode', {
    inp: ['Руны старшего футарка (ᚠᚢᚦᚨᚱᚲ), точки ᛫ — разделители.', 'Elder Futhark runes (ᚠᚢᚦᚨᚱᚲ); the dots ᛫ are separators.'],
    what: ['Переводит руны в латинские буквы: ᚦ = th, ᛜ = ng; читает и часть младших рун.', 'Turns runes into Latin letters: ᚦ = th, ᛜ = ng; some Younger Futhark runes are read too.'],
    ex: ['ᚠᚢᚦᚨᚱᚲ', 'futhark'],
    par: ['«Регистр» — строчные или заглавные буквы.', '“Case” is lowercase or uppercase.'],
    keep: ['Соответствие приблизительное: разные руны соответствуют одной букве.', 'The mapping is approximate: several runes map to one letter.'],
    chk: ['Получается транслитерация: сверьте со словом в языке автора. Набрать знаки удобно на вкладке «⌨ Клавиатуры».', 'You get a transliteration: compare it with a word in the author’s language. Glyphs are easy to type with the “⌨ Keyboards” panel.'],
    wiki: ['Elder Futhark', 'Старший_футарк'], std: ['Unicode: Runic (U+16A0)', 'https://www.unicode.org/charts/PDF/U16A0.pdf'],
  });
  H('runes_encode', {
    what: ['Записывает латинский текст рунами старшего футарка (th → ᚦ, ng → ᛜ, c/q → ᚲ).', 'Writes Latin text in Elder Futhark runes (th → ᚦ, ng → ᛜ, c/q → ᚲ).'],
    ex: ['futhark', 'ᚠᚢᚦᚨᚱᚲ'],
    par: null,
    keep: ['Прочие символы остаются как есть.', 'Other characters are kept.'],
    chk: ['Обратная операция — «Руны → латиница».', 'The reverse is “Runes → Latin”.'],
    wiki: ['Elder Futhark', 'Старший_футарк'], std: ['Unicode: Runic (U+16A0)', 'https://www.unicode.org/charts/PDF/U16A0.pdf'],
  });
  H('greek_translit', {
    inp: ['Текст греческими буквами (αβγ) или латиницей.', 'Text in Greek letters (αβγ) or in Latin letters.'],
    what: ['Побуквенно переводит греческий алфавит в латиницу и обратно: θ = th, φ = ph, χ = ch, ψ = ps, ω = o. Ударения снимаются.', 'Transliterates the Greek alphabet to Latin and back letter by letter: θ = th, φ = ph, χ = ch, ψ = ps, ω = o. Accents are dropped.'],
    ex: ['θεος', 'theos'],
    par: ['«Направление» — греческий → латиница или обратно.', '“Direction” is Greek → Latin or the reverse.'],
    keep: ['Это транслитерация, а не перевод; η и ε дают одно «e», ο и ω — одно «o». Прочие символы остаются.', 'This is transliteration, not translation; η and ε both give “e”, ο and ω both give “o”. Other characters stay.'],
    chk: ['Получаются читаемые слова или имена. Набрать буквы удобно на вкладке «⌨ Клавиатуры».', 'You get readable words or names. The “⌨ Keyboards” panel makes typing the letters easy.'],
    wiki: ['Greek alphabet', 'Греческий_алфавит'],
  });
  H('braille_decode', {
    inp: ['Ячейки Брайля Юникода (⠁⠃⠉…).', 'Unicode Braille cells (⠁⠃⠉…).'],
    what: ['Переводит ячейки Брайля в английские буквы; знак числа ⠼ делает a–j цифрами, ⠠ — заглавной.', 'Turns Braille cells into English letters; the number sign ⠼ turns a–j into digits and ⠠ makes a capital.'],
    ex: ['⠓⠑⠇⠇⠕', 'hello'],
    par: ['«Таблица Брайля» — английская или русская (русские ё, ъ, ы, ь, э, ю, я и др.). Знаки числа ⠼ и заглавной ⠠ общие.', '“Braille table” is English or Russian (Russian ё, ъ, ы, ь, э, ю, я and others). The number sign ⠼ and capital sign ⠠ are shared.'],
    keep: ['Знак числа и заглавной действуют на следующую ячейку; математический Брайль не читается.', 'The number and capital signs apply to the following cells; math Braille is not read.'],
    chk: ['Читаемые слова; если вышла тарабарщина, смените таблицу. Набрать знаки удобно на вкладке «⌨ Клавиатуры».', 'Readable words; if you get gibberish, switch the table. Glyphs are easy to type with the “⌨ Keyboards” panel.'],
    wiki: ['Braille', 'Азбука_Брайля'], std: ['Unicode: Braille Patterns', 'https://www.unicode.org/charts/PDF/U2800.pdf'],
  });
  H('braille_encode', {
    what: ['Записывает латинский текст ячейками Брайля (цифры со знаком ⠼, заглавные с ⠠).', 'Writes Latin text in Braille cells (digits with ⠼, capitals with ⠠).'],
    ex: ['hello', '⠓⠑⠇⠇⠕'],
    par: ['«Таблица Брайля» — английские или русские буквы.', '“Braille table” — English or Russian letters.'],
    keep: ['Простые знаки препинания поддерживаются; остальное остаётся как есть.', 'Simple punctuation is supported; the rest stays as is.'],
    chk: ['Обратная операция — «Брайль → латиница». Набрать знаки удобно на вкладке «⌨ Клавиатуры».', 'The reverse is “Braille → Latin”. Glyphs are easy to type with the “⌨ Keyboards” panel.'],
    wiki: ['Braille', 'Азбука_Брайля'], std: ['Unicode: Braille Patterns', 'https://www.unicode.org/charts/PDF/U2800.pdf'],
  });
  H('phonetic_decode', {
    inp: ['Слова фонетического алфавита: Alfa Bravo Charlie… или Able Baker Charlie…', 'Phonetic alphabet words: Alfa Bravo Charlie… or Able Baker Charlie…'],
    what: ['Берёт первую букву каждого слова (NATO/ICAO или старый US «Able Baker») и собирает слово; цифры-слова (zero…niner) становятся цифрами.', 'Takes the letter for each word (NATO/ICAO or the old US “Able Baker”) and assembles the text; digit words (zero…niner) become digits.'],
    ex: ['Alfa Bravo Charlie', 'ABC'],
    par: ['«Регистр» — заглавные или строчные. «Неизвестное слово» — ошибка, пропуск или первая буква.', '“Case” is upper or lower. “Unknown word” is an error, skip, or first letter.'],
    keep: ['«/» считается пробелом.', '“/” counts as a space.'],
    chk: ['Результат — слова; если слова алфавита искажены, выберите «первая буква».', 'The result is words; if alphabet words are distorted choose “first letter”.'],
    wiki: ['NATO phonetic alphabet', 'Фонетический_алфавит_НАТО'], std: ['ICAO Annex 10 (радиотелефония)', 'https://www.icao.int/'],
  });
  H('phonetic_encode', {
    what: ['Записывает буквы словами фонетического алфавита (NATO/ICAO или Able Baker).', 'Writes letters as phonetic alphabet words (NATO/ICAO or Able Baker).'],
    ex: ['ABC', 'Alfa Bravo Charlie', { alphabet: 'nato' }],
    par: ['«Алфавит»: NATO/ICAO или Able Baker (США, 1941–56).', '“Alphabet”: NATO/ICAO or Able Baker (US, 1941–56).'],
    keep: ['Пробел становится «/», цифры записываются словами.', 'A space becomes “/”, digits are written as words.'],
    chk: ['Обратная операция — «Фонетический алфавит → буквы».', 'The reverse is “Phonetic alphabet → letters”.'],
    wiki: ['NATO phonetic alphabet', 'Фонетический_алфавит_НАТО'],
  });
  H('callsign_order', {
    inp: ['Строки вроде «Charlie 3», «Able 7», «Baker-2».', 'Lines such as “Charlie 3”, “Able 7”, “Baker-2”.'],
    what: ['Сортирует строки по порядку слов фонетического алфавита (Able, Baker, Charlie… или Alfa, Bravo…) и склеивает числа.', 'Sorts lines by the order of the phonetic alphabet word (Able, Baker, Charlie… or Alfa, Bravo…) and joins the trailing numbers.'],
    ex: ['Charlie 3\nAble 7\nBaker 2', '723', { out: 'digits' }],
    par: ['«Выход»: склеенные числа, отсортированные строки или и то и другое.', '“Output”: concatenated numbers, sorted lines, or both.'],
    keep: ['Строки без слова алфавита пропускаются.', 'Lines without an alphabet word are skipped.'],
    chk: ['Полученное число проверьте как код или ID; порядок слов — главная гипотеза.', 'Check the resulting number as a code or ID; the word order is the main hypothesis.'],
    wiki: ['NATO phonetic alphabet', 'Фонетический_алфавит_НАТО'],
  });

  // ---------- Текстовые инструменты ----------
  H('reverse', {
    what: ['Переворачивает всю строку, каждое слово, каждую строку или группы по N символов.', 'Reverses the whole string, each word, each line or groups of N characters.'],
    ex: ['Hello World', 'dlroW olleH', { mode: 'all' }],
    par: ['«Что переворачивать» — всё, слова, строки или группы по N; «N» — размер группы.', '“What to reverse” is everything, words, lines, or groups of N; “N” is the group size.'],
    keep: ['Все символы сохраняются.', 'All characters are kept.'],
    chk: ['Читаемый текст после переворота. Если слова целы, а порядок слов обратный, возьмите «каждое слово».', 'Readable text after reversing. If words are intact but their order is reversed, pick “each word” mode.'],
    wiki: ['Palindrome', 'Палиндром'],
  });
  H('layout', {
    what: ['Переводит текст, набранный в другой раскладке: те же клавиши, другие буквы (ghbdtn ↔ привет).', 'Converts text typed in the wrong keyboard layout: the same keys, other letters (ghbdtn ↔ привет).'],
    ex: ['ghbdtn', 'привет', { dir: 'en2ru' }],
    par: ['«Направление»: EN → RU или RU → EN (стандартные раскладки QWERTY и ЙЦУКЕН).', '“Direction”: EN → RU or RU → EN (standard QWERTY and ЙЦУКЕН).'],
    keep: ['Знаки на клавишах цифрового ряда зависят от раскладки и могут отличаться.', 'Symbols on the number row depend on the layout and may differ.'],
    chk: ['Получились осмысленные слова. Ключи Виженера часто хранятся в виде «не той раскладки».', 'Meaningful words appear. Vigenère keys are often stored as “wrong layout” text.'],
    wiki: ['Keyboard layout', 'Раскладка_клавиатуры'],
  });
  H('translit', {
    what: ['Транслитерация между кириллицей и латиницей по простым правилам (ш → sh, ч → ch).', 'Transliteration between Cyrillic and Latin by simple rules (ш → sh, ч → ch).'],
    ex: ['privet', 'привет', { dir: 'lat2ru' }],
    par: ['«Направление»: кириллица → латиница или латиница → кириллица.', '“Direction”: Cyrillic → Latin or Latin → Cyrillic.'],
    keep: ['Обратное преобразование не всегда однозначно (x, y, w).', 'The reverse is not always unique (x, y, w).'],
    chk: ['Читаемые слова на русском. Разные системы транслита дают разные варианты — сверяйте по смыслу.', 'Readable Russian words. Different transliteration systems give different variants: check the meaning.'],
    wiki: ['Romanization of Russian', 'Транслитерация_русского_алфавита_латиницей'],
  });
  H('case', {
    what: ['Меняет регистр: ВСЕ ЗАГЛАВНЫЕ, все строчные или инверсия.', 'Changes case: ALL CAPITALS, all lowercase, or inversion.'],
    ex: ['Hello', 'hELLO', { mode: 'swap' }],
    par: ['«Режим»: заглавные, строчные, инвертировать.', '“Mode”: upper, lower, invert.'],
    keep: ['Регистр теряется (кроме инверсии, которая обратима).', 'Case is lost (except inversion, which is reversible).'],
    chk: ['Нужна только для выравнивания ввода; регистр может нести данные — смотрите «Регистр → биты».', 'Only for normalising input; case may carry data, see “Letter case → bits”.'],
    wiki: ['Letter case', 'Регистр_(буквы)'],
  });
  H('filter', {
    what: ['Оставляет только нужные символы (буквы, цифры, и т. д.) или удаляет по регулярному выражению.', 'Keeps only the characters you want (letters, digits, …) or removes them by a regular expression.'],
    ex: ['a1 b2-c3', 'abc', { mode: 'letters' }],
    par: ['«Режим»: только буквы, буквы и цифры, только цифры, убрать пробелы, убрать по regex. «Regex» — выражение для удаления.', '“Mode”: letters only, letters and digits, digits only, remove whitespace, remove by regex. “Regex” is the removal pattern.'],
    keep: ['Удалённые символы не вернуть, поэтому сохраняйте оригинал в отдельной ноде.', 'Removed characters cannot be recovered, so keep the original in a separate node.'],
    chk: ['Проверьте, что в результате нет лишних символов; для ID сверьте длину.', 'Check there are no extra characters; for an ID check the length.'],
    wiki: ['Regular expression', 'Регулярные_выражения'],
  });
  H('ws_prep', {
    what: ['Подготовка пробелов: обрезать края, привести переносы к LF, схлопнуть повторы, убрать все пробелы или только переносы.', 'Whitespace preparation: trim the edges, normalise line breaks to LF, collapse repeats, remove all spaces or only line breaks.'],
    ex: ['  a  b  ', ' a b ', { mode: 'collapse' }],
    par: ['«Вариант» — один из пяти режимов обработки пробелов.', '“Variant” is one of five whitespace modes.'],
    keep: ['Символы нулевой ширины не трогаются (для них есть отдельная нода).', 'Zero-width characters are left alone (they have their own node).'],
    chk: ['Сравнивайте длины до и после — так видно, что удалено.', 'Compare lengths before and after to see what was removed.'],
    wiki: ['Whitespace character', 'Пробельный_символ'],
  });
  H('replace', {
    what: ['Находит подстроку (или regex) и заменяет её другой.', 'Finds a substring (or regex) and replaces it with another.'],
    ex: ['a-b-c', 'abc', { find: '-', repl: '', regex: false }],
    par: ['«Найти» и «Заменить на». «Это regex» — искать как регулярное выражение (в замене работают $1, $2).', '“Find” and “Replace with”. “Is a regex” searches as a regular expression ($1, $2 work in the replacement).'],
    keep: ['Заменяются все вхождения.', 'All occurrences are replaced.'],
    chk: ['Сравните длину до и после; для regex проверьте на пробных строках.', 'Compare lengths before and after; test a regex on sample strings.'],
    wiki: ['Regular expression', 'Регулярные_выражения'],
  });
  H('slice', {
    what: ['Берёт часть строки: символы от «От» до «До» (с 1) с шагом; шаг 2 — каждый второй.', 'Takes part of the string: characters from “From” to “To” (1-based) with a step; step 2 means every second character.'],
    ex: ['abcdef', 'ace', { from: 1, to: 0, step: 2 }],
    par: ['«От» — первая позиция, «До» (0 = до конца), «Шаг».', '“From” is the first position, “To” (0 = to the end), “Step”.'],
    keep: ['Остальные символы отбрасываются.', 'The other characters are dropped.'],
    chk: ['Сверьте, что выбранный отрезок имеет ожидаемую длину.', 'Check the selected piece has the expected length.'],
    wiki: ['Substring', 'Подстрока'],
  });
  H('join', {
    inp: ['Два входа: A и B.', 'Two inputs: A and B.'],
    what: ['Склеивает два значения в одно через разделитель (например, фрагменты AgL + L2GD).', 'Joins two values into one with a separator (for example fragments AgL + L2GD).'],
    ex: ['AgL | L2GD', 'AgLL2GD', { sep: '' }],
    par: ['«Разделитель» — что вставить между A и B.', '“Separator” is inserted between A and B.'],
    keep: ['Порядок важен: A, потом B.', 'Order matters: A first, then B.'],
    chk: ['Для сборки ссылок или ключей проверяйте результат внешним способом.', 'For assembling links or keys, verify the result with an outside check.'],
    wiki: ['Concatenation', 'Конкатенация'],
  });
  H('join3', {
    inp: ['Три входа: A, B и C.', 'Three inputs: A, B and C.'],
    what: ['Склеивает три значения в одно через разделитель.', 'Joins three values into one with a separator.'],
    ex: ['AgL | L2GD | LrgQ', 'AgLL2GDLrgQ', { sep: '' }],
    par: ['«Разделитель» — вставляется между частями.', '“Separator” goes between the parts.'],
    keep: ['Порядок важен; для перебора порядков используйте «Перестановки фрагментов».', 'Order matters; to try orders use “Fragment permutations”.'],
    chk: ['Результат подтверждайте внешним источником.', 'Confirm the result with an outside source.'],
    wiki: ['Concatenation', 'Конкатенация'], demo: 'fragments',
  });
  H('interleave', {
    inp: ['Два входа: A и B.', 'Two inputs: A and B.'],
    what: ['Перемежает символы двух строк: A1 B1 A2 B2 …', 'Interleaves the characters of two strings: A1 B1 A2 B2 …'],
    ex: ['ace | bdf', 'abcdef'],
    par: null,
    keep: ['Если строки разной длины, остаток длинной дописывается в конец.', 'If the strings differ in length the rest of the longer one is appended.'],
    chk: ['Осмысленный результат; обратное разделение — «Часть строки» с шагом 2.', 'A meaningful result; to split again use “Part of the string” with step 2.'],
    wiki: ['Interleaving', 'Чередование'],
  });
  H('split_take', {
    what: ['Режет строку по разделителю и берёт часть с нужным номером (без разделителя — по переводам строк).', 'Splits the string by a separator and takes the part with the given number (with no separator, by line breaks).'],
    ex: ['a,b,c', 'b', { sep: ',', n: 2 }],
    par: ['«Разделитель» (пусто = перевод строки) и «Номер части» с 1.', '“Separator” (empty = line break) and “Part number” from 1.'],
    keep: ['Остальные части отбрасываются.', 'The other parts are dropped.'],
    chk: ['Номер части вне диапазона даёт пустой результат или ошибку.', 'A part number out of range gives an empty result or an error.'],
    wiki: ['String (computer science)', 'Строка_(тип_данных)'],
  });
  H('chunk', {
    what: ['Разбивает строку на группы по N символов и склеивает их через разделитель.', 'Splits the string into groups of N characters and joins them with a separator.'],
    ex: ['abcdef', 'ab cd ef', { n: 2, sep: ' ' }],
    par: ['«N символов» — размер группы, «Разделитель» — что ставить между группами.', '“N characters” is the group size, “Separator” goes between groups.'],
    keep: ['Все символы сохраняются.', 'All characters are kept.'],
    chk: ['Удобно перед «Двоичный → байты» и «Числа → символы».', 'Handy before “Binary → bytes” and “Numbers → characters”.'],
    wiki: ['String (computer science)', 'Строка_(тип_данных)'],
  });
  H('anagram_check', {
    inp: ['Два входа: текст A и текст B.', 'Two inputs: text A and text B.'],
    what: ['Сравнивает наборы букв и цифр двух строк без учёта регистра и пробелов и показывает лишние и недостающие.', 'Compares the letter and digit multisets of two strings ignoring case and spaces, and shows the extra and missing ones.'],
    ex: ['listen | silent', ['Анаграммы: да…', 'Anagram: yes…']],
    par: ['«Текст B» — если второй вход не подключён.', '“Text B” is used when the second input is not connected.'],
    keep: ['Только отчёт; сами строки не меняются.', 'A report only; the strings themselves are not changed.'],
    chk: ['Отчёт точный: «Анаграмма: да» означает совпадение мультимножеств букв.', 'The report is exact: “Anagram: yes” means the letter multisets match.'],
    wiki: ['Anagram', 'Анаграмма'],
  });
  H('anagram_solve', {
    what: ['Ищет слова (и пары-тройки слов), использующие все буквы входа, по встроенному словарю частотных слов.', 'Looks for words (and pairs/triples of words) using all the input letters, from the built-in frequent-word list.'],
    ex: ['tsop', 'stop\npost\nspot…', { lang: 'en' }],
    par: ['«Словарь» (авто, английский, русский), «Макс. слов», «Мин. длина слова», «Сколько показать».', '“Word list” (auto, English, Russian), “Max words”, “Min word length”, “Results to show”.'],
    keep: ['Работает для коротких строк (до 16 букв).', 'Works for short strings (up to 16 letters).'],
    chk: ['Кандидаты нужно оценивать по смыслу и контексту: анаграмма почти всегда имеет несколько вариантов.', 'Candidates must be judged by meaning and context: an anagram almost always has several answers.'],
    wiki: ['Anagram', 'Анаграмма'],
  });
  H('segment_map', {
    inp: ['Текст из нескольких строк.', 'Text of several lines.'],
    what: ['Применяет к каждой строке свою цепочку операций и собирает результат с исходными переводами строк. Так авто-поиск записывает составные сообщения, где строки зашифрованы по-разному.', 'Applies its own chain of operations to each line and joins the result with the original line breaks. This is how the auto search records compound messages whose lines are encrypted differently.'],
    ex: ['L krsh… / lxusglxoktj/znkyzgxz.vtm', ['I hope… / fromafriend/thestart.png', 'I hope… / fromafriend/thestart.png']],
    par: ['«План (JSON)»: по элементу на строку — список шагов {op, params} или null (оставить строку).', '“Plan (JSON)”: one item per line, a list of steps {op, params} or null (keep the line).'],
    keep: ['Переводы строк и строки без шагов не меняются.', 'Line breaks and lines without steps are unchanged.'],
    chk: ['Каждая часть должна читаться сама по себе; одна непрочитанная строка — повод разобрать её отдельно.', 'Each part should read on its own; an unread line is a reason to work on it separately.'],
    wiki: ['Cipher', 'Шифр'], exNoRun: true,
  });
  H('overlay_fill', {
    inp: ['Два входа: шаблон A с метками «#» и текст B.', 'Two inputs: a template A with “#” marks and text B.'],
    what: ['Заполняет метки в A символами из B — по очереди или с той же позиции: «H#LL#» + «EO» → HELLO.', 'Fills the marks in A with characters from B, in turn or at the same position: “H#LL#” + “EO” → HELLO.'],
    ex: ['H#LL# | EO', 'HELLO'],
    par: ['«Метка» — какой символ считать пропуском. «Брать из B» — по очереди или с той же позиции. «Текст B» — если вход не подключён.', '“Placeholder” marks a gap. “Take from B”: in turn or same position. “Text B” is used when the input is not connected.'],
    keep: ['Символы A вне меток остаются.', 'Characters of A outside the marks stay.'],
    chk: ['Результат должен быть цельным словом или фразой.', 'The result should be a whole word or phrase.'],
    wiki: ['Template (word processing)', 'Шаблон'],
  });
  H('pick_letters', {
    what: ['Извлекает символы по списку позиций (1,3,5-8,-1), только ЗАГЛАВНЫЕ буквы или цифры, символы внутри/после/перед меткой.', 'Extracts characters by a position list (1,3,5-8,-1), only UPPERCASE letters or digits, or characters inside/after/before a mark.'],
    ex: ['HELLO WORLD', 'HLO', { mode: 'index', indices: '1,3,5', scope: 'all' }],
    par: ['«Что выбрать», «Позиции», «Первая позиция =», «Область» (весь текст, каждое слово, каждая строка), «Считать» буквы или все символы, «Метка», «Склеить через».', '“What to pick”, “Positions”, “First position =”, “Scope” (whole text, each word, each line), “Count” letters or all characters, “Mark”, “Join with”.'],
    keep: ['Остальные символы отбрасываются.', 'The other characters are dropped.'],
    chk: ['Проверьте на известном примере: позиции в разных схемах нумеруются по-разному.', 'Test on a known sample: positions are numbered differently in different schemes.'],
    wiki: ['Steganography', 'Стеганография'],
  });
  H('extract_candidates', {
    inp: ['Длинный текст или лог.', 'A long text or a log.'],
    what: ['Ищет в длинном тексте hex, Base64, бинарные группы, ссылки, ID сервисов и числа; при номере 0 перечисляет всё с позициями.', 'Finds hex, Base64, binary groups, links, service IDs and numbers inside a long text; with number 0 it lists everything with positions.'],
    ex: ['log 73746f70 end', '73746f70', { kind: 'hex', n: 1 }],
    par: ['«Вид» кандидата и «Номер» (0 = показать список, иначе взять N-й).', '“Kind” of candidate and “Number” (0 = show the list, otherwise take the N-th).'],
    keep: ['Это поиск, а не расшифровка: найденное нужно подать в следующую ноду.', 'This is a search, not decoding: pass what you find to the next node.'],
    chk: ['Проверяйте контекст: в логах многое похоже на hex случайно.', 'Check the context: lots of things in logs look like hex by chance.'],
    wiki: ['Regular expression', 'Регулярные_выражения'], demo: 'log-hex',
  });

  // ---------- Хеши ----------
  const HASH_PAR = ['«Кодировка текста» — в какие байты превращается строка. «Обрезать пробелы» — убрать пробелы по краям. «Заглавный hex» — вывод заглавными.', '“Text encoding” sets the bytes the string is turned into. “Trim whitespace” strips the edges. “Uppercase hex” prints capitals.'];
  const HASH_KEEP = ['Хеш необратим: по нему нельзя восстановить текст, только проверить кандидата. Для файла-артефакта хешируются его байты.', 'A hash is not reversible: you can only check a candidate against it. For an artifact the file bytes are hashed.'];
  H('hash_md5', {
    what: ['Считает MD5 (128 бит) текста или файла.', 'Computes MD5 (128 bits) of text or a file.'],
    ex: ['hello', '5d41402abc4b2a76b9719d911017c592'],
    par: HASH_PAR, keep: HASH_KEEP,
    chk: ['Сравните с известным значением или проверьте кандидата в «Проверка хеша». MD5 не годится для защиты.', 'Compare with a known value or check a candidate with “Hash check”. MD5 is not suitable for security.'],
    wiki: ['MD5', 'MD5'], std: ['RFC 1321', 'https://www.rfc-editor.org/rfc/rfc1321'],
  });
  H('hash_sha1', {
    what: ['Считает SHA-1 (160 бит) текста или файла.', 'Computes SHA-1 (160 bits) of text or a file.'],
    ex: ['hello', 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d'],
    par: HASH_PAR, keep: HASH_KEEP,
    chk: ['Сравните с известным значением или проверьте кандидата.', 'Compare with a known value or check a candidate.'],
    wiki: ['SHA-1', 'SHA-1'], std: ['RFC 3174', 'https://www.rfc-editor.org/rfc/rfc3174'],
  });
  H('hash_sha256', {
    what: ['Считает SHA-256 (256 бит) текста или файла.', 'Computes SHA-256 (256 bits) of text or a file.'],
    ex: ['hello', '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'],
    par: HASH_PAR, keep: HASH_KEEP,
    chk: ['Сравните с известным значением или проверьте кандидата.', 'Compare with a known value or check a candidate.'],
    wiki: ['SHA-2', 'SHA-2'], std: ['FIPS 180-4', 'https://csrc.nist.gov/pubs/fips/180-4/upd1/final'],
  });
  H('hash_sha512', {
    what: ['Считает SHA-512 (512 бит) текста или файла.', 'Computes SHA-512 (512 bits) of text or a file.'],
    ex: ['hello', '9b71d224bd62f378…'],
    par: HASH_PAR, keep: HASH_KEEP,
    chk: ['Сравните с известным значением или проверьте кандидата.', 'Compare with a known value or check a candidate.'],
    wiki: ['SHA-2', 'SHA-2'], std: ['FIPS 180-4', 'https://csrc.nist.gov/pubs/fips/180-4/upd1/final'],
  });
  H('hash_crc32', {
    what: ['Считает контрольную сумму CRC32 (32 бита, как в zip и png) текста или файла.', 'Computes the CRC32 checksum (32 bits, as in zip and png) of text or a file.'],
    ex: ['hello', '3610a686'],
    par: HASH_PAR, keep: ['CRC32 — контрольная сумма, не криптографический хеш; коллизии легко подбираются.', 'CRC32 is a checksum, not a cryptographic hash; collisions are easy to craft.'],
    chk: ['Сверьте с CRC в заголовке zip/png.', 'Compare with the CRC in a zip/png header.'],
    wiki: ['Cyclic redundancy check', 'Циклический_избыточный_код'], std: ['PNG, §5.5 (CRC)', 'https://www.w3.org/TR/png/#5CRC-algorithm'],
  });
  H('hash_all', {
    what: ['Считает сразу MD5, SHA-1, SHA-256, SHA-512 и CRC32 и показывает таблицей.', 'Computes MD5, SHA-1, SHA-256, SHA-512 and CRC32 at once and shows a table.'],
    ex: ['hello', 'MD5 5d41402a…', {}],
    par: HASH_PAR, keep: HASH_KEEP,
    chk: ['Удобно, когда неизвестно, какой алгоритм использовал автор: найдите совпадающую строку по длине.', 'Handy when you do not know which algorithm the author used: match the line by length.'],
    wiki: ['Cryptographic hash function', 'Хеш-функция'], exNoRun: true,
  });
  H('hash_check', {
    inp: ['Кандидаты (по одному на строку) и контрольное значение (второй вход или параметр).', 'Candidates (one per line) and the target digest (second input or parameter).'],
    what: ['Проверяет, равен ли хеш кандидата (кандидатов) заданному значению; алгоритм определяется по длине: 8 CRC32, 32 MD5, 40 SHA-1, 64 SHA-256, 128 SHA-512.', 'Checks whether the hash of a candidate (or several) equals a given digest; the algorithm is detected by length: 8 CRC32, 32 MD5, 40 SHA-1, 64 SHA-256, 128 SHA-512.'],
    ex: ['hello | 5d41402abc4b2a76b9719d911017c592', 'hello', { output: 'match' }],
    par: ['«Хеш» (если второй вход не подключён), «Алгоритм», «Кодировка», «Каждая строка — отдельный кандидат», «Пробовать без пробелов по краям», «Вывод» (отчёт или найденный кандидат).', '“Digest” (when the second input is unused), “Algorithm”, “Encoding”, “Each line is a separate candidate”, “Also try without surrounding whitespace”, “Output” (report or the matching candidate).'],
    keep: ['Если ничего не совпало, режим «кандидат» выдаёт ошибку, а не пустоту.', 'If nothing matches, the “candidate” mode gives an error rather than empty output.'],
    chk: ['Совпадение хеша — сильное подтверждение (для MD5/SHA-256): ложных совпадений практически не бывает.', 'A hash match is strong confirmation (for MD5/SHA-256): false matches essentially never happen.'],
    wiki: ['Cryptographic hash function', 'Хеш-функция'],
  });
  H('hash_identify', {
    inp: ['Строка hex или Base64.', 'A hex or Base64 string.'],
    what: ['По длине и алфавиту строки подсказывает, чем она может быть: MD5, NTLM, SHA-1, SHA-256… или просто токен.', 'By the length and alphabet of the string, suggests what it could be: MD5, NTLM, SHA-1, SHA-256… or just a token.'],
    ex: ['5d41402abc4b2a76b9719d911017c592', 'MD5 / NTLM…'],
    par: null,
    keep: ['Это догадка по форме, а не доказательство.', 'This is a guess from the shape, not proof.'],
    chk: ['Подтвердите кандидатом через «Проверка хеша».', 'Confirm with a candidate through “Hash check”.'],
    wiki: ['Cryptographic hash function', 'Хеш-функция'], exNoRun: true,
  });
  H('calc', {
    inp: ['Выражение из целых чисел: 509 × 503 × 3301 или (7+3)^2.', 'An expression of whole numbers: 509 × 503 × 3301 or (7+3)^2.'],
    what: ['Точная целочисленная арифметика без округления: + − × ÷ % ^ и скобки. Режим «простые множители» раскладывает результат: 845145127 = 503 × 509 × 3301.', 'Exact integer arithmetic with no rounding: + − × ÷ % ^ and parentheses. The “prime factors” mode factors the result: 845145127 = 503 × 509 × 3301.'],
    ex: ['509 × 503 × 3301', '845145127'],
    par: ['«Что показать» — значение или простые множители. Деление должно быть нацело, иначе ошибка.', '“Show” is the value or the prime factors. Division must be exact, otherwise it is an error.'],
    keep: ['Числа произвольной длины (BigInt); дробей нет. Для разложения число не должно быть слишком большим.', 'Numbers of any length (BigInt); no fractions. The number must not be too large for factoring.'],
    chk: ['Проверьте обратным действием: множители должны перемножаться в исходное число.', 'Check it backwards: the factors must multiply back to the number.'],
    wiki: ['Integer factorization', 'Разложение_на_простые_множители'], demo: 'cic-math',
  });
})(typeof self !== 'undefined' ? self : this);
