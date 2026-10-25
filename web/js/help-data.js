// Справочные карточки для нод («?» на ноде, подсказки в палитре). Реестр + кодировки.
// i18n-file-ok: все тексты — пары ['русский', 'English'], полноту проверяет tests/help.test.js.
// Запись: H(id, { inp, what, ex: [до, после, параметры?], par, keep, chk, wiki: [EN, RU], std: [подпись, url], demo })
// Все тексты — пары ['русский', 'English']. id — id операции (G.CipherOps.OPS) или тип спец-ноды (G.NodeTypes).
// Данные разнесены по файлам help-data*.js (каждый < 800 строк); логика карточки — в help.js.
(function (G) {
  'use strict';
  const ENTRIES = {};
  function H(id, entry) { ENTRIES[id] = entry; }

  // Значения по умолчанию для полей, которые не заданы в записи (по категории операции).
  const DEFAULTS = {
    inp: ['Текст (строка).', 'Text (a string).'],
    par: ['Параметров нет.', 'No parameters.'],
    keep: ['Результат — новая строка; исходная нода-источник не меняется.', 'The result is a new string; the source node is not changed.'],
    chk: ['Результат должен читаться как осмысленный текст или продолжаться следующим шагом; сверьте с внешним источником.', 'The result should read as meaningful text or feed the next step; confirm it with an outside source.'],
  };

  G.HelpData = {
    entries: ENTRIES,
    defaults: DEFAULTS,
    add: H,
    get(id) { return ENTRIES[id] || null; },
  };

  // ---------- Кодировки: HEX, Base*, двоичный, числа ----------
  H('hex_decode', {
    inp: ['Текст из пар шестнадцатеричных цифр (0–9, A–F).', 'Text made of pairs of hexadecimal digits (0–9, A–F).'],
    what: ['Каждая пара hex-цифр превращается в один байт, байты склеиваются в строку.', 'Every pair of hex digits becomes one byte and the bytes are joined into a string.'],
    ex: ['54 30 39', 'T09'],
    par: null,
    keep: ['Пробелы, запятые, префикс 0x и регистр цифр не важны и отбрасываются. Нечётное число цифр — ошибка.', 'Spaces, commas, the 0x prefix and digit case do not matter and are dropped. An odd number of digits is an error.'],
    chk: ['Если получились не буквы, а «мусор», это, скорее всего, ещё одно кодирование (Base64, сдвиг кодов) или кодировка CP1251 — подключите «Байты → текст».', 'If you get junk instead of letters, it is probably another layer (Base64, code shift) or CP1251 text: connect “Bytes → text”.'],
    wiki: ['Hexadecimal', 'Шестнадцатеричная система счисления'], std: ['RFC 4648, §8 (Base16)', 'https://www.rfc-editor.org/rfc/rfc4648#section-8'], demo: 'hex-plain',
  });
  H('hex_encode', {
    what: ['Каждый символ записывается кодом своего байта в hex. Это обратная операция к «HEX → байты».', 'Every character is written as the hex code of its byte. The reverse of “HEX → bytes”.'],
    ex: ['Hi', '48 69'],
    par: ['Кодировка — как превратить символы в байты (UTF-8 по умолчанию). Разделитель — что ставить между байтами.', 'Encoding is how characters become bytes (UTF-8 by default). Separator is what goes between bytes.'],
    keep: ['Ничего не теряется: по hex можно восстановить текст при той же кодировке.', 'Nothing is lost: the text can be restored from the hex with the same encoding.'],
    chk: ['Прогоните результат через «HEX → байты» — должен вернуться исходный текст.', 'Run the result through “HEX → bytes”: you should get the original text back.'],
    wiki: ['Hexadecimal', 'Шестнадцатеричная система счисления'], std: ['RFC 4648, §8 (Base16)', 'https://www.rfc-editor.org/rfc/rfc4648#section-8'],
  });
  H('base64_decode', {
    inp: ['Текст из символов A–Z a–z 0–9 + / (или - _ для URL-варианта), часто с «=» в конце.', 'Text of A–Z a–z 0–9 + / characters (or - _ in the URL variant), often ending with “=”.'],
    what: ['Расшифровывает Base64 в байты. Понимает обычный и URL-безопасный алфавит, сам добавляет пропавшие «=».', 'Decodes Base64 into bytes. Understands the standard and URL-safe alphabets and adds missing “=” itself.'],
    ex: ['SGVsbG8=', 'Hello'],
    par: ['«Строго» — вместо предупреждения о неканоничных хвостовых битах выдаёт ошибку.', '“Strict” turns the warning about non-canonical trailing bits into an error.'],
    keep: ['Результат — байты (символы 0–255). Если это текст в UTF-8 или CP1251, добавьте «Байты → текст».', 'The result is bytes (characters 0–255). For UTF-8 or CP1251 text add “Bytes → text”.'],
    chk: ['Длина без «=» не должна давать остаток 1 по модулю 4. Читаемый текст или известная сигнатура файла (PNG, ZIP) — признак успеха.', 'The unpadded length must not leave a remainder of 1 modulo 4. Readable text or a known file signature (PNG, ZIP) means success.'],
    wiki: ['Base64', 'Base64'], std: ['RFC 4648, §4–5 (Base64)', 'https://www.rfc-editor.org/rfc/rfc4648#section-4'], demo: 'gd-b64',
  });
  H('base64_encode', {
    what: ['Превращает текст в Base64: сначала символы в байты выбранной кодировкой, затем по 6 бит в символ алфавита.', 'Turns text into Base64: characters become bytes in the chosen encoding, then 6 bits at a time become alphabet symbols.'],
    ex: ['Hello', 'SGVsbG8='],
    par: ['Кодировка определяет, какими байтами записываются не-ASCII символы.', 'The encoding decides which bytes non-ASCII characters are written as.'],
    keep: ['Без потерь: «Base64 → байты» с той же кодировкой возвращает исходник.', 'Lossless: “Base64 → bytes” with the same encoding returns the original.'],
    chk: ['Проверьте обратной операцией. Длина результата кратна 4.', 'Check it with the reverse operation. The result length is a multiple of 4.'],
    wiki: ['Base64', 'Base64'], std: ['RFC 4648, §4 (Base64)', 'https://www.rfc-editor.org/rfc/rfc4648#section-4'],
  });
  H('base32_decode', {
    inp: ['Текст из букв A–Z и цифр 2–7, возможно с «=» в конце.', 'Text of letters A–Z and digits 2–7, possibly ending with “=”.'],
    what: ['Расшифровывает Base32 (RFC 4648) в байты: каждые 8 символов дают 5 байт.', 'Decodes Base32 (RFC 4648) into bytes: every 8 characters give 5 bytes.'],
    ex: ['JBSWY3DP', 'Hello'],
    par: ['«Строго» превращает предупреждения о недопустимой длине и ненулевых хвостовых битах в ошибку.', '“Strict” turns warnings about an impossible length or non-zero trailing bits into errors.'],
    keep: ['Результат — байты. Регистр букв не важен.', 'The result is bytes. Letter case does not matter.'],
    chk: ['Алфавит Base32 не содержит 0, 1, 8, 9 — их наличие говорит, что это другая кодировка (hex, Base36, Crockford).', 'The Base32 alphabet has no 0, 1, 8, 9: if they appear, it is another encoding (hex, Base36, Crockford).'],
    wiki: ['Base32', 'Base32'], std: ['RFC 4648, §6 (Base32)', 'https://www.rfc-editor.org/rfc/rfc4648#section-6'],
  });
  H('base32_encode', {
    what: ['Записывает текст в Base32 (алфавит A–Z и 2–7, по 5 бит на символ).', 'Writes text in Base32 (alphabet A–Z and 2–7, 5 bits per character).'],
    ex: ['Hello', 'JBSWY3DP'],
    par: ['Кодировка — какими байтами записывать символы.', 'Encoding: which bytes the characters are written as.'],
    keep: ['Без потерь при той же кодировке.', 'Lossless with the same encoding.'],
    chk: ['Проверьте обратной операцией «Base32 → байты».', 'Check with the reverse “Base32 → bytes”.'],
    wiki: ['Base32', 'Base32'], std: ['RFC 4648, §6 (Base32)', 'https://www.rfc-editor.org/rfc/rfc4648#section-6'],
  });
  H('base58_decode', {
    inp: ['Текст из алфавита Base58 (без 0, O, I, l).', 'Text in the Base58 alphabet (no 0, O, I, l).'],
    what: ['Декодирует Base58 (алфавит Bitcoin) в байты как большое число в системе по основанию 58.', 'Decodes Base58 (the Bitcoin alphabet) into bytes, reading it as a big base-58 number.'],
    ex: ['StV1DL6CwTryKyV', 'hello world'],
    par: null,
    keep: ['Ведущие «1» превращаются в нулевые байты. Контрольная сумма (Base58Check) не проверяется.', 'Leading “1”s become zero bytes. The Base58Check checksum is not verified.'],
    chk: ['Символы 0, O, I, l в строке означают, что это не Base58. Результат часто бывает не текстом, а адресом или хешем — смотрите длину (25, 32 байта).', 'The characters 0, O, I, l mean it is not Base58. The result is often an address or hash rather than text: look at the length (25, 32 bytes).'],
    wiki: ['Binary-to-text encoding#Base58', 'Base58'], std: ['Base58 в Bitcoin Wiki', 'https://en.bitcoin.it/wiki/Base58Check_encoding'],
  });
  H('binary_decode', {
    inp: ['Строка из нулей и единиц (с пробелами или без).', 'A string of zeros and ones (with or without spaces).'],
    what: ['Группы битов превращаются в байты: «01001000 01101001» → «Hi».', 'Groups of bits become bytes: “01001000 01101001” → “Hi”.'],
    ex: ['01001000 01101001', 'Hi'],
    par: ['«Бит в группе» — 8 или 7 (ASCII), когда пробелов нет. «Строго» — ошибка вместо предупреждения о неполном хвосте.', '“Bits per group” is 8 or 7 (ASCII) when there are no spaces. “Strict” turns a warning about an incomplete tail into an error.'],
    keep: ['Неполная последняя группа отбрасывается с предупреждением.', 'An incomplete last group is dropped with a warning.'],
    chk: ['Если читаемого текста нет, попробуйте группу в 7 бит, инверсию битов или обратный порядок.', 'If nothing readable appears, try 7-bit groups, inverted bits or reversed order.'],
    wiki: ['Binary code', 'Двоичный код'],
  });
  H('binary_encode', {
    what: ['Записывает каждый байт текста восемью битами.', 'Writes every byte of the text as eight bits.'],
    ex: ['Hi', '01001000 01101001'],
    par: ['Кодировка — как символы превращаются в байты.', 'Encoding: how characters become bytes.'],
    keep: ['Без потерь при той же кодировке.', 'Lossless with the same encoding.'],
    chk: ['Обратная операция «Двоичный → байты».', 'The reverse operation is “Binary → bytes”.'],
    wiki: ['Binary code', 'Двоичный код'],
  });
  H('dec_codes', {
    inp: ['Десятичные числа — коды символов (через разделители или пары/тройки цифр).', 'Decimal numbers that are character codes (separated, or digit pairs/triples).'],
    what: ['Числа превращаются в символы по коду; перед этим к каждому можно прибавить сдвиг.', 'Numbers become characters by code; a shift can be added to each one first.'],
    ex: ['72 101 108 108 111', 'Hello', { width: 'sep' }],
    par: ['«Разбивка» — как резать цифры (по разделителям, по 2 или 3). «Прибавить» — сдвиг к каждому коду перед превращением в символ.', '“Split” decides how digits are cut (by separators, 2 or 3 digits). “Add” is a shift applied to every code before conversion.'],
    keep: ['Коды вне диапазона символа дают ошибку; выбранная разбивка влияет на результат — пробуйте варианты.', 'Codes out of range give an error; the split changes the result, so try the options.'],
    chk: ['Читаемый текст или %HH-последовательность для следующего шага «URL-декодирование».', 'Readable text, or a %HH sequence for the next “URL decoding” step.'],
    wiki: ['Character encoding', 'Кодировка символов'],
  });
  H('text_to_codes', {
    what: ['Записывает каждый символ его десятичным кодом; из кода можно вычесть сдвиг.', 'Writes every character as its decimal code; a shift can be subtracted from it.'],
    ex: ['Hi', '72 105'],
    par: ['«Вычесть» — число, которое вычитается из каждого кода. «Разделитель» — что ставить между числами.', '“Subtract” is subtracted from every code. “Separator” goes between the numbers.'],
    keep: ['Без потерь: «Числа → символы» с тем же сдвигом возвращает текст.', 'Lossless: “Numbers → characters” with the same shift restores the text.'],
    chk: ['Обратная проверка через «Числа → символы».', 'Verify through “Numbers → characters”.'],
    wiki: ['Unicode', 'Юникод'],
  });
  H('a1z26', {
    inp: ['Числа — номера букв в алфавите (через пробелы/запятые или цифровые пары).', 'Numbers that are letter positions in the alphabet (separated, or digit pairs).'],
    what: ['Классическая замена A=1, B=2 … Z=26: каждое число становится буквой алфавита.', 'The classic substitution A=1, B=2 … Z=26: every number becomes a letter of the alphabet.'],
    ex: ['8 5 12 12 15', 'hello'],
    par: ['«Алфавит» — латиница, кириллица (33 или 32) или украинский. «Первая буква =» — с 0 или с 1. «Разбивка» — по разделителям или по 2 цифры.', '“Alphabet” is Latin, Cyrillic (33 or 32) or Ukrainian. “First letter =” is 0- or 1-based. “Split” is by separators or 2 digits.'],
    keep: ['Число вне алфавита — ошибка (для циклического варианта есть «Числа → буквы (по модулю)»).', 'A number outside the alphabet is an error (for the wrap-around variant use “Numbers → letters (modulo)”).'],
    chk: ['Выбор алфавита (русский с Ё или без неё) меняет номера: перебирайте варианты, пока не появятся слова.', 'The alphabet choice (Russian with or without Ё) shifts the numbers: try the options until words appear.'],
    wiki: ['Substitution cipher', 'Шифр простой замены'],
  });
  H('letters_to_numbers', {
    what: ['Каждая буква заменяется её номером в алфавите.', 'Every letter is replaced by its position in the alphabet.'],
    ex: ['abc', '1 2 3'],
    par: ['«Алфавит» и «первая буква =» задают нумерацию.', '“Alphabet” and “first letter =” define the numbering.'],
    keep: ['Регистр теряется; не-буквы обычно пропускаются.', 'Case is lost; non-letters are normally skipped.'],
    chk: ['Обратная операция — «Числа → буквы (A1Z26)».', 'The reverse is “Numbers → letters (A1Z26)”.'],
    wiki: ['Substitution cipher', 'Шифр простой замены'],
  });
  H('url_decode', {
    inp: ['Текст с последовательностями %HH (например %D0%9F) и, возможно, знаками «+».', 'Text with %HH sequences (for example %D0%9F) and possibly “+” signs.'],
    what: ['Заменяет %HH на байты и читает их в выбранной кодировке (UTF-8, CP1251, KOI8-R).', 'Replaces %HH with bytes and reads them in the chosen encoding (UTF-8, CP1251, KOI8-R).'],
    ex: ['%CA%D2%CE', 'КТО', { enc: 'cp1251' }],
    par: ['«Кодировка» — как читать байты. «+ = пробел» — считать плюс пробелом (как в формах).', '“Encoding” is how bytes are read. “+ = space” treats a plus as a space (as in web forms).'],
    keep: ['Неверная кодировка даёт «кракозябры» — просто выберите другую.', 'The wrong encoding gives mojibake: just pick another one.'],
    chk: ['Кириллица по %C0…%FF — почти наверняка CP1251; %D0/%D1 — UTF-8.', 'Cyrillic as %C0…%FF is almost certainly CP1251; %D0/%D1 pairs mean UTF-8.'],
    wiki: ['Percent-encoding', 'URL#Кодирование_URL'], std: ['RFC 3986, §2.1', 'https://www.rfc-editor.org/rfc/rfc3986#section-2.1'], demo: 'ktoty',
  });
  H('url_encode', {
    what: ['Записывает небезопасные символы как %HH в выбранной кодировке.', 'Writes unsafe characters as %HH in the chosen encoding.'],
    ex: ['КТО', '%CA%D2%CE', { enc: 'cp1251' }],
    par: ['Кодировка — какими байтами записывать не-ASCII символы.', 'Encoding: which bytes non-ASCII characters are written as.'],
    keep: ['Без потерь при той же кодировке.', 'Lossless with the same encoding.'],
    chk: ['Обратная операция — «URL-декодирование».', 'The reverse is “URL decoding”.'],
    wiki: ['Percent-encoding', 'URL#Кодирование_URL'], std: ['RFC 3986, §2.1', 'https://www.rfc-editor.org/rfc/rfc3986#section-2.1'],
  });
  H('bytes_decode', {
    inp: ['Байты (символы с кодами 0–255), например после HEX или Base64.', 'Bytes (characters with codes 0–255), for example after HEX or Base64.'],
    what: ['Читает байты как текст в выбранной кодировке: UTF-8, CP1251 или KOI8-R.', 'Reads bytes as text in the chosen encoding: UTF-8, CP1251 or KOI8-R.'],
    ex: ['Ð\u009fÑ\u0080', 'Пр'],
    par: ['Кодировка — как интерпретировать байты.', 'Encoding: how to interpret the bytes.'],
    keep: ['Недопустимые последовательности UTF-8 заменяются знаком �.', 'Invalid UTF-8 sequences are replaced by the � sign.'],
    chk: ['Если видите «Ð\u009fÑ\u0080» или «Ðü», значит текст уже в UTF-8, а вы читаете его как байты по одному — выберите UTF-8.', 'Strings like “Ð\u009fÑ\u0080” mean UTF-8 text read byte by byte: pick UTF-8.'],
    wiki: ['Character encoding', 'Кодировка символов'], std: ['RFC 3629 (UTF-8)', 'https://www.rfc-editor.org/rfc/rfc3629'],
    exNoRun: true,
  });
  H('text_encode', {
    what: ['Превращает текст в байты выбранной кодировкой; байты показываются как символы 0–255.', 'Turns text into bytes in the chosen encoding; the bytes are shown as characters 0–255.'],
    ex: ['Пр', 'Ð\u009fÑ\u0080'],
    par: ['Кодировка: UTF-8, CP1251, KOI8-R или «байты как есть» (символы строго 0–255).', 'Encoding: UTF-8, CP1251, KOI8-R or “bytes as is” (characters strictly 0–255).'],
    keep: ['Символ, которого нет в кодировке, даёт ошибку, а не подмену.', 'A character missing from the encoding gives an error, not a substitution.'],
    chk: ['Обратная операция — «Байты → текст».', 'The reverse is “Bytes → text”.'],
    wiki: ['Character encoding', 'Кодировка символов'], std: ['RFC 3629 (UTF-8)', 'https://www.rfc-editor.org/rfc/rfc3629'],
  });
  H('morse_decode', {
    inp: ['Точки и тире: буквы через пробел, слова через «/» или три пробела.', 'Dots and dashes: letters separated by spaces, words by “/” or three spaces.'],
    what: ['Расшифровывает азбуку Морзе в буквы и цифры (латиница или кириллица).', 'Decodes Morse code into letters and digits (Latin or Cyrillic).'],
    ex: ['.... . .-.. .-.. ---', 'hello'],
    par: ['«Язык» — латинский или русский набор знаков. Понимает «·» и «−» вместо «.» и «-».', '“Language” is the Latin or Russian symbol set. Understands “·” and “−” in place of “.” and “-”.'],
    keep: ['Неизвестный код даёт «?». Регистр не кодируется.', 'An unknown code gives “?”. Case is not encoded.'],
    chk: ['Если разбивка на буквы неверна, получится набор одиночных E/T/I/M — проверьте пробелы между буквами. Набрать знаки удобно на вкладке «⌨ Клавиатуры».', 'A wrong letter split gives lots of single E/T/I/M: check the spaces between letters. Glyphs are easy to type with the “⌨ Keyboards” panel.'],
    wiki: ['Morse code', 'Азбука Морзе'], std: ['ITU-R M.1677-1', 'https://www.itu.int/rec/R-REC-M.1677-1-200910-I/en'],
  });
  H('morse_encode', {
    what: ['Записывает текст азбукой Морзе: буквы через пробел, слова через «/».', 'Writes text in Morse code: letters separated by spaces, words by “/”.'],
    ex: ['HELLO', '.... . .-.. .-.. ---'],
    par: ['«Язык» — латиница или кириллица.', '“Language” is Latin or Cyrillic.'],
    keep: ['Регистр теряется; знаки без кода в Морзе пропускаются.', 'Case is lost; characters with no Morse code are skipped.'],
    chk: ['Обратная операция — «Морзе → текст».', 'The reverse is “Morse → text”.'],
    wiki: ['Morse code', 'Азбука Морзе'], std: ['ITU-R M.1677-1', 'https://www.itu.int/rec/R-REC-M.1677-1-200910-I/en'],
  });
  H('base_convert', {
    inp: ['Целое число в исходной системе счисления.', 'An integer in the source numeral system.'],
    what: ['Переводит целое число из одной системы счисления в другую (2–36).', 'Converts an integer from one numeral system to another (2–36).'],
    ex: ['836', '344', { from: 10, to: 16 }],
    par: ['«Из» и «в» — основания систем (10 — десятичная, 16 — шестнадцатеричная, 2 — двоичная).', '“From” and “to” are the bases (10 decimal, 16 hexadecimal, 2 binary).'],
    keep: ['Большие числа считаются точно (BigInt). Дробные числа не поддерживаются.', 'Big numbers are exact (BigInt). Fractions are not supported.'],
    chk: ['Обратная конвертация должна вернуть исходное число.', 'Converting back must give the original number.'],
    wiki: ['Positional notation', 'Позиционная система счисления'],
  });
  H('base85_decode', {
    inp: ['Текст в Ascii85 (возможно в «<~ … ~>») или Z85.', 'Text in Ascii85 (possibly inside “<~ … ~>”) or Z85.'],
    what: ['Расшифровывает Base85: каждые 5 символов дают 4 байта. Есть варианты Ascii85 (Adobe) и Z85 (ZeroMQ).', 'Decodes Base85: every 5 characters give 4 bytes. Variants: Ascii85 (Adobe) and Z85 (ZeroMQ).'],
    ex: ['<~9jqo^~>', 'Man ', { variant: 'ascii85' }],
    par: ['«Вариант» — Ascii85 или Z85 (у них разные алфавиты). «Строго» — ошибка вместо предупреждения о неполной группе.', '“Variant” is Ascii85 or Z85 (different alphabets). “Strict” turns the incomplete-group warning into an error.'],
    keep: ['Результат — байты; в Ascii85 «z» означает четыре нулевых байта.', 'The result is bytes; in Ascii85 “z” means four zero bytes.'],
    chk: ['Длина Z85 кратна 5. Если текст не читается, смените вариант алфавита.', 'Z85 length is a multiple of 5. If the text is not readable, switch the alphabet variant.'],
    wiki: ['Ascii85', 'Ascii85'], std: ['ZeroMQ RFC 32/Z85', 'https://rfc.zeromq.org/spec/32/'], demo: 'dng-z85',
  });
  H('unescape', {
    inp: ['Текст с экранированием: \\u0041, \\x41, &#65;, &#x41;, &amp;, U+0041.', 'Text with escapes: \\u0041, \\x41, &#65;, &#x41;, &amp;, U+0041.'],
    what: ['Превращает записи символов кодами обратно в сами символы.', 'Turns character escape sequences back into the characters themselves.'],
    ex: ['\\u0048\\u0069 &#33;', 'Hi !'],
    par: null,
    keep: ['Обычный текст вокруг сохраняется как есть.', 'Ordinary text around the escapes is kept as is.'],
    chk: ['Читаемый текст на выходе; если остались «\\», вложенный уровень экранирования — повторите операцию.', 'Readable text on output; if “\\” remains, there is a nested escaping level: apply it again.'],
    wiki: ['Escape sequence', 'Экранирование_(информатика)'],
  });
  H('base91_decode', {
    inp: ['Текст в алфавите basE91 (91 печатный символ).', 'Text in the basE91 alphabet (91 printable characters).'],
    what: ['Расшифровывает basE91 — более плотную, чем Base64, текстовую запись байтов.', 'Decodes basE91, a denser text encoding of bytes than Base64.'],
    ex: ['fPNKd', 'test'],
    par: null,
    keep: ['Результат — байты.', 'The result is bytes.'],
    chk: ['Символы вне алфавита (пробел, «-», «\\», «\'») вызывают ошибку — значит, это не basE91.', 'Characters outside the alphabet (space, “-”, “\\”, “\'”) cause an error: it is not basE91.'],
    wiki: ['Binary-to-text encoding#Encoding_standards', 'Base64'], std: ['basE91 (Joachim Henke)', 'https://base91.sourceforge.net/'],
  });
  H('base91_encode', {
    what: ['Записывает текст в basE91.', 'Writes text in basE91.'],
    ex: ['test', 'fPNKd'],
    par: null,
    keep: ['Без потерь.', 'Lossless.'],
    chk: ['Обратная операция — «Base91 → байты».', 'The reverse is “Base91 → bytes”.'],
    wiki: ['Binary-to-text encoding#Encoding_standards', 'Base64'], std: ['basE91 (Joachim Henke)', 'https://base91.sourceforge.net/'],
  });
  H('uudecode', {
    inp: ['Текст в формате uuencode: строки, начинающиеся с символа длины.', 'Text in uuencode format: lines that start with a length character.'],
    what: ['Расшифровывает uuencode (Unix-to-Unix) — старую почтовую запись бинарных данных.', 'Decodes uuencode (Unix-to-Unix), an old mail format for binary data.'],
    ex: ['#0V%T', 'Cat'],
    par: null,
    keep: ['Строки «begin»/«end» игнорируются.', 'The “begin”/“end” lines are ignored.'],
    chk: ['Первый символ строки задаёт её длину; несоответствие длины — признак другого формата.', 'The first character of a line gives its length; a mismatch means another format.'],
    wiki: ['Uuencoding', 'Uuencode'],
  });
  H('uuencode', {
    what: ['Записывает текст в uuencode.', 'Writes text in uuencode.'],
    ex: ['Cat', '#0V%T', { header: false }],
    par: ['«begin / end» — добавлять ли служебные строки.', '“begin / end” toggles the header and footer lines.'],
    keep: ['Без потерь.', 'Lossless.'],
    chk: ['Обратная операция — «uudecode».', 'The reverse is “uudecode”.'],
    wiki: ['Uuencoding', 'Uuencode'],
  });
  H('qp_decode', {
    inp: ['Текст почтового формата с =XX (например =D0=9F).', 'Mail-format text with =XX sequences (for example =D0=9F).'],
    what: ['Расшифровывает quoted-printable: =XX становятся байтами, «=» в конце строки — мягкий перенос.', 'Decodes quoted-printable: =XX become bytes and a trailing “=” is a soft line break.'],
    ex: ['=D0=9F=D1=80', 'Пр'],
    par: ['«Кодировка» — как читать получившиеся байты.', '“Encoding” is how the resulting bytes are read.'],
    keep: ['Обычные символы остаются как есть.', 'Ordinary characters stay as they are.'],
    chk: ['=D0/=D1 — UTF-8, =C0…=FF — однобайтовая кодировка (CP1251, KOI8-R).', '=D0/=D1 pairs mean UTF-8; =C0…=FF means a single-byte encoding (CP1251, KOI8-R).'],
    wiki: ['Quoted-printable', 'Quoted-printable'], std: ['RFC 2045, §6.7', 'https://www.rfc-editor.org/rfc/rfc2045#section-6.7'],
  });
  H('qp_encode', {
    what: ['Записывает не-ASCII символы как =XX (quoted-printable).', 'Writes non-ASCII characters as =XX (quoted-printable).'],
    ex: ['Пр', '=D0=9F=D1=80'],
    par: ['Кодировка — какими байтами записывать символы.', 'Encoding: which bytes the characters are written as.'],
    keep: ['Без потерь при той же кодировке.', 'Lossless with the same encoding.'],
    chk: ['Обратная операция — «Quoted-printable → текст».', 'The reverse is “Quoted-printable → text”.'],
    wiki: ['Quoted-printable', 'Quoted-printable'], std: ['RFC 2045, §6.7', 'https://www.rfc-editor.org/rfc/rfc2045#section-6.7'],
  });
  H('punycode_decode', {
    inp: ['Метка или домен вида xn--mnchen-3ya (или сырой Punycode).', 'A label or domain like xn--mnchen-3ya (or raw Punycode).'],
    what: ['Превращает Punycode (запись юникодных доменов ASCII-символами) обратно в Unicode.', 'Turns Punycode (the ASCII form of Unicode domains) back into Unicode.'],
    ex: ['xn--mnchen-3ya', 'münchen'],
    par: null,
    keep: ['Без «xn--» строка читается целиком как сырой Punycode.', 'Without “xn--” the whole string is read as raw Punycode.'],
    chk: ['Результат — слово с нелатинскими буквами, часто омограф известного адреса.', 'The result is a word with non-Latin letters, often a look-alike of a familiar address.'],
    wiki: ['Punycode', 'Punycode'], std: ['RFC 3492', 'https://www.rfc-editor.org/rfc/rfc3492'],
  });
  H('punycode_encode', {
    what: ['Записывает Unicode-текст в Punycode (ASCII).', 'Writes Unicode text in Punycode (ASCII).'],
    ex: ['münchen', 'xn--mnchen-3ya'],
    par: ['«Префикс xn--» — добавлять ли префикс домена.', '“xn-- prefix” toggles the domain prefix.'],
    keep: ['Без потерь.', 'Lossless.'],
    chk: ['Обратная операция — «Punycode → Unicode».', 'The reverse is “Punycode → Unicode”.'],
    wiki: ['Punycode', 'Punycode'], std: ['RFC 3492', 'https://www.rfc-editor.org/rfc/rfc3492'],
  });
  H('octal_decode', {
    inp: ['Восьмеричные коды (101 102 103 или \\101\\102).', 'Octal codes (101 102 103 or \\101\\102).'],
    what: ['Восьмеричные числа превращаются в байты. Без разделителей строка режется по 3 цифры.', 'Octal numbers become bytes. With no separators the string is cut into 3-digit groups.'],
    ex: ['110 151', 'Hi'],
    par: null,
    keep: ['Значение больше байта (выше 377) — ошибка.', 'A value above a byte (over 377) is an error.'],
    chk: ['Цифры 8 и 9 в строке означают, что это не восьмеричная запись.', 'Digits 8 and 9 mean this is not octal.'],
    wiki: ['Octal', 'Восьмеричная система счисления'],
  });
  H('octal_encode', {
    what: ['Записывает каждый байт текста тремя восьмеричными цифрами.', 'Writes every byte of the text as three octal digits.'],
    ex: ['Hi', '110 151'],
    par: ['«Разделитель» — что ставить между числами.', '“Separator” goes between the numbers.'],
    keep: ['Без потерь.', 'Lossless.'],
    chk: ['Обратная операция — «Восьмеричные → байты».', 'The reverse is “Octal codes → bytes”.'],
    wiki: ['Octal', 'Восьмеричная система счисления'],
  });
  H('ebcdic_decode', {
    inp: ['Байты в кодировке EBCDIC (cp037) — например, после «HEX → байты».', 'Bytes in EBCDIC (cp037), for example after “HEX → bytes”.'],
    what: ['Читает байты IBM EBCDIC (cp037) как текст — кодировку мейнфреймов.', 'Reads IBM EBCDIC (cp037) bytes as text, the mainframe encoding.'],
    ex: ['C8 85 93 93 96', 'Hello'],
    par: null,
    keep: ['Результат — обычный текст.', 'The result is ordinary text.'],
    chk: ['EBCDIC даёт буквы на кодах C1–E9 и цифры на F0–F9: hex вида «C8 85 93» — характерный признак.', 'EBCDIC letters sit at C1–E9 and digits at F0–F9: hex such as “C8 85 93” is characteristic.'],
    wiki: ['EBCDIC', 'EBCDIC'], exNoRun: true,
  });
  H('ebcdic_encode', {
    what: ['Записывает текст байтами EBCDIC (cp037).', 'Writes text as EBCDIC (cp037) bytes.'],
    ex: ['Hello', 'C8 85 93 93 96'],
    par: null,
    keep: ['Символы вне cp037 дают ошибку.', 'Characters outside cp037 give an error.'],
    chk: ['Покажите результат через «Текст → HEX» или проверьте обратной операцией.', 'Show the result through “Text → HEX” or verify with the reverse operation.'],
    wiki: ['EBCDIC', 'EBCDIC'], exNoRun: true,
  });
  H('binary_pixels', {
    inp: ['Строки из нулей и единиц (сетка).', 'Rows of zeros and ones (a grid).'],
    what: ['Рисует сетку из 0/1 символами «█» и пробелами, чтобы увидеть картинку (QR-подобные узоры, пиксельные надписи).', 'Draws a 0/1 grid with “█” and spaces so you can see the picture (QR-like patterns, pixel lettering).'],
    ex: ['10101\n01010', '█ █ █\n  █ █ '],
    par: ['«Ширина» — длина строки (0 = взять строки входа или квадрат). «Символ для 1/0» — чем рисовать, «Повтор по горизонтали» — растяжение, «Инвертировать» — поменять 0 и 1.', '“Width” is the row length (0 = use input rows or a square). “Character for 1/0” is what to draw with, “Horizontal repeat” stretches, “Invert” swaps 0 and 1.'],
    keep: ['Это только вывод для глаз: настоящий QR читается нодой «Изображение: QR».', 'This is output for the eye only: a real QR is read by the “Image: QR” node.'],
    chk: ['Если узор не проявился, подберите ширину; для QR ширина — сторона квадрата.', 'If no pattern shows up, adjust the width; for QR it is the side of the square.'],
    wiki: ['Pixel art', 'Пиксельная_графика'], exNoRun: true,
  });
})(typeof self !== 'undefined' ? self : this);
