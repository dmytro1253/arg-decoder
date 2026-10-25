// Справочные карточки спец-нод: ввод/вывод, проверки, автоподбор, файлы, изображения, звук и видео.
// i18n-file-ok: все тексты — пары ['русский', 'English'], полноту проверяет tests/help.test.js.
// Ключ — тип ноды из G.NodeTypes. Формат записи — см. help-data.js.
(function (G) {
  'use strict';
  const H = G.HelpData.add;
  const NOPAR = ['Параметров нет.', 'No parameters.'];
  const REGION = ['«Область» (кнопка «Область» и выделение мышью) ограничивает обработку частью большого кадра.', 'The region (the “Region” button, then drag) limits processing to part of a large frame.'];

  // ---------- Ввод и вывод ----------
  H('input', {
    inp: ['Входов нет — вы вводите текст сами (строка с любыми символами).', 'No inputs: you type the text yourself (any characters).'],
    what: ['Источник данных графа: сюда вставляется шифр, ключ или фрагмент. Можно создать несколько вводов для частей и ключей.', 'The data source of the graph: paste a cipher, a key or a fragment here. You can create several inputs for parts and keys.'],
    ex: ['48 65 6C 6C 6F', ['→ дальше в цепочку', 'on to the chain']],
    par: ['«Текст» — само значение. Ctrl+V с текстом на холсте создаёт такую ноду.', '“Text” is the value itself. Ctrl+V with text on the canvas creates such a node.'],
    keep: ['Текст хранится точно, как введён: регистр, переносы, пробелы, нули.', 'The text is stored exactly as typed: case, line breaks, spaces, zeros.'],
    chk: ['Сохраняйте точный оригинал: копируйте шифр без правок, исправления делайте в отдельных нодах.', 'Keep the exact original: copy the cipher untouched and do corrections in separate nodes.'],
    wiki: ['Plaintext', 'Открытый_текст'], exNoRun: true, demo: 'welcome',
  });
  H('view', {
    inp: ['Любая строка (один вход).', 'Any string (one input).'],
    what: ['Показывает значение крупно, распознаёт в нём ссылки и YouTube ID и предлагает их проверить.', 'Shows the value large, recognises links and YouTube IDs in it, and offers to check them.'],
    ex: ['https://youtu.be/dQw4w9WgXcQ', ['ссылка распознана', 'link recognised']],
    par: NOPAR,
    keep: ['Не изменяет значение — только показывает его.', 'Does not change the value, only displays it.'],
    chk: ['Найденное нужно проверять внешним способом (откройте ссылку, сверьте канал).', 'What it finds must be checked externally (open the link, check the channel).'],
    wiki: ['Hyperlink', 'Гиперссылка'], exNoRun: true,
  });
  H('note', {
    inp: ['Входов нет.', 'No inputs.'],
    what: ['Свободная заметка на холсте для гипотез, подсказок и источников. Ничего не вычисляет и не передаёт дальше.', 'A free note on the canvas for hypotheses, hints and sources. It computes nothing and passes nothing on.'],
    ex: [['Подсказка: ключ из описания', 'Hint: key from the description'], ['заметка', 'note']],
    par: ['Единственное поле — текст заметки.', 'The only field is the note text.'],
    keep: ['Заметка сохраняется вместе с проектом.', 'The note is saved with the project.'],
    chk: ['Записывайте, откуда взято значение: источник нужен, чтобы вывод можно было перепроверить.', 'Record where a value came from: the source lets others re-verify the conclusion.'],
    wiki: ['Note-taking', 'Конспект'], exNoRun: true,
  });
  H('artifact', {
    inp: ['Входов нет — файл добавляется перетаскиванием на холст, Ctrl+V или кнопкой.', 'No inputs: add a file by dropping it on the canvas, Ctrl+V or the button.'],
    what: ['Файл-улика (картинка, звук, видео, архив, лог). Исходник хранится без изменений, а в граф уходит «ручка» файла.', 'An evidence file (image, audio, video, archive, log). The original is stored unchanged and a handle to it flows through the graph.'],
    ex: ['screenshot.png', 'artifact:…'],
    par: ['Выбор файла; параметры хранятся внутри проекта.', 'File choice; the data are stored inside the project.'],
    keep: ['Оригинал никогда не меняется; все обработки создают новые производные версии в памяти.', 'The original is never modified; every processing step creates new derived versions in memory.'],
    chk: ['Для подтверждения сохраняйте хеш: ноды «Файл» и «Хеши» посчитают SHA-256 исходного файла.', 'Keep a hash for verification: the Files and Hashes nodes compute the SHA-256 of the original file.'],
    wiki: ['Digital forensics', 'Компьютерная_криминалистика'], exNoRun: true,
  });

  // ---------- Проверка ----------
  H('analyze', {
    inp: ['Любая строка.', 'Any string.'],
    what: ['Разбор строки: длина, алфавит, индекс совпадений, на что она похожа (hex, Base64, ссылка, ID). Передаёт значение дальше без изменений.', 'String analysis: length, alphabet, index of coincidence, what it resembles (hex, Base64, link, ID). Passes the value on unchanged.'],
    ex: ['48656C6C6F', ['длина 10, hex', 'length 10, hex']],
    par: NOPAR,
    keep: ['Значение не меняется; это только подсказка о шифре.', 'The value is not changed; it is only a hint about the cipher.'],
    chk: ['Индекс совпадений ≈ 0,066 для английского и ≈ 0,055 для русского текста, ≈ 0,038 для случайных букв: по нему отличают подстановку от многоалфавитного шифра.', 'The index of coincidence is ≈ 0.066 for English and ≈ 0.055 for Russian text, ≈ 0.038 for random letters: it tells a substitution from a polyalphabetic cipher.'],
    wiki: ['Index of coincidence', 'Индекс_совпадений'], exNoRun: true,
  });
  H('youtube', {
    inp: ['11-символьный ID видео или ссылка YouTube.', 'An 11-character video ID or a YouTube link.'],
    what: ['Проверяет ID через YouTube oEmbed: существует ли видео, как называется и какой канал. Нужен локальный сервер программы.', 'Checks the ID through YouTube oEmbed: whether the video exists, its title and channel. Needs the program’s local server.'],
    ex: ['dQw4w9WgXcQ', ['есть: название и канал', 'exists: title and channel']],
    par: ['«Проверять автоматически» — запускать при изменении входа.', '“Check automatically” runs the check whenever the input changes.'],
    keep: ['Это только запрос в сеть; значение не меняется. Работает лишь при запуске через лаунчер.', 'This is only a network query; the value is not changed. It works only when started through the launcher.'],
    chk: ['Существование видео — слабое доказательство. Подтверждайте находку метаданными канала, а не формой ID.', 'A video merely existing is weak evidence. Confirm a finding by channel metadata, not by the shape of the ID.'],
    wiki: ['OEmbed', 'OEmbed'], std: ['oEmbed', 'https://oembed.com/'], exNoRun: true,
  });
  H('mask', {
    inp: ['Маска с пропусками «_» или «?», например _y_xPVyp_H_.', 'A mask with gaps “_” or “?”, for example _y_xPVyp_H_.'],
    what: ['Подставляет в пропуски символы выбранного набора и проверяет каждый вариант через YouTube; останавливается на первом найденном.', 'Fills the gaps with characters from the chosen set and checks every variant through YouTube; stops at the first hit.'],
    ex: ['_y_xPVyp_H_', 'yygxPVyp8H0'],
    par: ['«Маска», «Символы пропуска», «Набор» (или свой), «Остановиться на первом». Число вариантов растёт как размер набора в степени числа пропусков.', '“Mask”, “Gap characters”, “Set” (or custom), “Stop at the first hit”. The variant count grows as the set size to the power of the number of gaps.'],
    keep: ['При большом числе вариантов спрашивает подтверждение и ограничивает перебор.', 'With many variants it asks for confirmation and caps the search.'],
    chk: ['Попадание в существующее видео ещё не доказательство. Сверьте с контекстом и каналом.', 'A hit on an existing video is not yet proof. Check the context and the channel.'],
    wiki: ['Brute-force attack', 'Атака_полным_перебором'], demo: 'mask', exNoRun: true,
  });
  H('links', {
    inp: ['Текст со ссылками, в том числе «обезвреженными» (hxxp, [.]) и перевёрнутыми.', 'Text with links, including defanged (hxxp, [.]) and reversed ones.'],
    what: ['Находит ссылки и ID, похожие на YouTube, Drive, Catbox, Pastebin, Imgur и т. д.; на выход идёт первая найденная.', 'Finds links and IDs that look like YouTube, Drive, Catbox, Pastebin, Imgur etc.; the first one found is the output.'],
    ex: ['hxxps://files[.]catbox[.]moe/1gukbv.png', 'https://files.catbox.moe/1gukbv.png'],
    par: ['«Слабые совпадения» — показывать и неуверенные находки.', '“Weak matches” also shows low-confidence finds.'],
    keep: ['Ссылка только восстанавливается, не открывается.', 'The link is only reconstructed, not opened.'],
    chk: ['Открывайте найденное в безопасной среде и сверяйте домен: похожий домен может быть подделкой.', 'Open finds in a safe environment and check the domain: a look-alike domain may be fake.'],
    wiki: ['Defanging (cybersecurity)', 'URL'], exNoRun: true,
  });

  // ---------- Авто ----------
  H('auto', {
    inp: ['Любая строка-шифр.', 'Any cipher string.'],
    what: ['Перебирает цепочки известных приёмов (до выбранной глубины) и показывает лучшие результаты. Кликом результат выбирается, «В граф» разворачивает цепочку нодами.', 'Tries chains of known techniques (up to the chosen depth) and shows the best results. A click picks a result and “To graph” expands the chain into nodes.'],
    ex: ['48656C6C6F20776F726C64', 'Hello world'],
    par: ['«Глубина» — сколько операций подряд пробовать (2 быстро, 4 глубоко). Учитываются ключи проекта и активный профиль.', '“Depth” is how many operations in a row to try (2 fast, 4 deep). Project keys and the active profile are taken into account.'],
    keep: ['Исходная строка не меняется. Если ничего не убедительно, нода так и говорит.', 'The source string is not changed. If nothing is convincing, the node says so.'],
    chk: ['Оценка — эвристика по языковой статистике; проверьте цепочку глазами и внешним источником.', 'The score is a heuristic from language statistics; check the chain by eye and with an outside source.'],
    wiki: ['Cryptanalysis', 'Криптоанализ'], exNoRun: true, demo: 'welcome',
  });
  H('vigcrack', {
    inp: ['Шифртекст, зашифрованный Виженером (или Бофортом).', 'Ciphertext encrypted with Vigenère (or Beaufort).'],
    what: ['Встроенный подбор Виженера без подсказок: короткий текст — полный перебор коротких ключей и словарь; длинный — частотный анализ с итеративным поиском. Ключи проекта пробуются первыми.', 'The built-in Vigenère solver, no hints needed: a short text gets a full short-key brute force plus a dictionary; a long one gets frequency analysis with iterated search. Project keys are tried first.'],
    ex: ['j2itqqQI5mk', 'h2njbrLB5kj'],
    par: ['«Движок» (браузер или Python), «Стратегия», «Шифр» (Виженер/Бофорт/Вариант), «Язык», «Алфавит», «Макс. длина ключа», «Видеокарта (CUDA)», «Глубокий перебор в браузере».', '“Engine” (browser or Python), “Strategy”, “Cipher” (Vigenère/Beaufort/Variant), “Language”, “Alphabet”, “Max key length”, “Graphics card (CUDA)”, “Deep browser brute force”.'],
    keep: ['Короткие тексты дают много ложных ключей: нужен смысл, а не только оценка.', 'Short texts yield many false keys: you need meaning, not just a score.'],
    chk: ['Принимайте ключ, если расшифровка читается целиком и ключ — осмысленное слово или известен из контекста.', 'Accept a key if the whole decryption reads and the key is a meaningful word or known from context.'],
    wiki: ['Vigenère cipher#Cryptanalysis', 'Шифр_Виженера'], exNoRun: true,
  });

  // ---------- Файлы ----------
  H('file_inspect', {
    inp: ['Файл-артефакт.', 'An artifact file.'],
    what: ['Определяет формат по сигнатуре, считает SHA-256/MD5 и энтропию, показывает hex, ищет данные после конца файла (после IEND/EOI/EOCD) и вложенные файлы.', 'Detects the format by signature, computes SHA-256/MD5 and entropy, shows hex, and finds data after the end of the file (after IEND/EOI/EOCD) and embedded files.'],
    ex: ['image.png', ['PNG, 12 КБ, хвост 340 байт', 'PNG, 12 KB, 340 trailing bytes']],
    par: ['«Выход»: отчёт, SHA-256, «хвост» или вырезанный фрагмент как новый артефакт. «Смещение» для вырезания.', '“Output”: a report, SHA-256, the “tail” or a carved fragment as a new artifact. “Carve offset” for carving.'],
    keep: ['Исходный файл не меняется; вырезанное — новый артефакт.', 'The original file is not changed; carved data become a new artifact.'],
    chk: ['Хвост после IEND/EOI с сигнатурой ZIP или текстом — сильный признак вложения. Энтропия около 8 бит/байт — сжатие или шифрование.', 'A tail after IEND/EOI starting with a ZIP signature or text is a strong sign of hidden data. Entropy near 8 bits/byte means compression or encryption.'],
    wiki: ['File format#Magic number', 'Сигнатура_файла'], std: ['PNG, §5 (структура)', 'https://www.w3.org/TR/png/#5DataRep'], exNoRun: true,
  });
  H('file_strings', {
    inp: ['Файл-артефакт или любые байты (например, после HEX/Base64).', 'An artifact file or any bytes (for example after HEX/Base64).'],
    what: ['Достаёт из файла строки ASCII, UTF-8 и UTF-16 заданной минимальной длины, с фильтром; по одной в строке.', 'Extracts ASCII, UTF-8 and UTF-16 strings of a minimum length from a file, with a filter; one per line.'],
    ex: ['program.exe', ['строки текста…', 'text strings…']],
    par: ['«Кодировки», «Мин. длина», «Фильтр (regex)», «Игнорировать регистр», «Показывать смещения», «Лимит строк».', '“Encodings”, “Min length”, “Filter (regex)”, “Ignore case”, “Show offsets”, “Line limit”.'],
    keep: ['Это выборка читаемого, а не весь файл.', 'This is a selection of readable parts, not the whole file.'],
    chk: ['Короткая минимальная длина даёт мусор; начните с 6–8 и смотрите смещения.', 'A short minimum length gives junk; start from 6–8 and look at the offsets.'],
    wiki: ['Strings (Unix)', 'Strings_(программа)'], exNoRun: true,
  });
  H('file_archive', {
    inp: ['Файл-артефакт: ZIP, JAR, APK, DOCX…', 'An artifact file: ZIP, JAR, APK, DOCX…'],
    what: ['Показывает содержимое ZIP-подобных архивов, извлекает запись как новый артефакт, подбирает ZipCrypto, заходит во вложенные архивы и ищет константы в .class.', 'Lists ZIP-like archives, extracts an entry as a new artifact, handles ZipCrypto, enters nested archives and searches constants in .class files.'],
    ex: ['archive.zip', ['список записей', 'a list of entries']],
    par: ['«Выход», «Запись» (имя, #номер или путь с «!»), «Пароль (ZipCrypto)», «Поиск (regex)», «.class: только строки».', '“Output”, “Entry” (name, #index or a path with “!”), “Password (ZipCrypto)”, “Search (regex)”, “.class: string literals only”.'],
    keep: ['RAR, 7z и WinZip-AES распаковывает нода «Архив RAR/7z (7-Zip)».', 'RAR, 7z and WinZip-AES are extracted by the Archive RAR/7z (7-Zip) node.'],
    chk: ['Сверяйте CRC32 записей и размеры; пароль подтверждается успешной распаковкой.', 'Compare entry CRC32s and sizes; a password is confirmed by a successful extraction.'],
    wiki: ['ZIP (file format)', 'ZIP'], std: ['PKWARE APPNOTE', 'https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT'], exNoRun: true,
  });
  H('file_archive7z', {
    inp: ['Файл-артефакт: RAR 4/5, 7z, tar, xz, bzip2, cab, iso…', 'An artifact file: RAR 4/5, 7z, tar, xz, bzip2, cab, iso…'],
    what: ['Распаковывает RAR (и с зашифрованными заголовками) и 7z (и AES) локально через 7-Zip в WebAssembly; записи выходят новыми артефактами.', 'Extracts RAR (including encrypted headers) and 7z (including AES) locally through 7-Zip in WebAssembly; entries come out as new artifacts.'],
    ex: ['Package.rar', ['список записей или «Неверный пароль»', 'an entry list or “Wrong password”']],
    par: ['«Выход» (список или запись), «Запись» (имя или #номер), «Пароль».', '“Output” (list or entry), “Entry” (name or #index), “Password”.'],
    keep: ['Файлы остаются в памяти браузера; предел — 256 МБ и 5000 файлов за раз.', 'The files stay in browser memory; the limit is 256 MB and 5000 files at once.'],
    chk: ['Верный пароль подтверждается успешной распаковкой; неверный 7-Zip называет прямо.', 'A right password is confirmed by a successful extraction; 7-Zip names a wrong one plainly.'],
    wiki: ['RAR (file format)', 'RAR'], std: ['7-Zip', 'https://www.7-zip.org/'], exNoRun: true,
  });
  H('bytes_to_file', {
    inp: ['Байтовая строка (после HEX, Base64, XOR…) или текст.', 'A byte string (after HEX, Base64, XOR…) or text.'],
    what: ['Делает из байтов файл-артефакт; тип и расширение определяются по сигнатуре, байты не меняются.', 'Turns bytes into a file artifact; the type and extension come from the signature, the bytes are unchanged.'],
    ex: ['89 50 4E 47 … → HEX → bytes', ['data.png (PNG)', 'data.png (PNG)']],
    par: ['«Вход читать как»: байтовая строка, UTF-8, HEX или Base64. «Имя файла».', '“Read the input as”: byte string, UTF-8, HEX or Base64. “File name”.'],
    keep: ['Сам текст не меняется: меняется только тип значения (файл вместо строки).', 'The data are not changed: only the kind of value changes (a file instead of a string).'],
    chk: ['Подключите «Инспектор файлов»: сигнатура и размер должны совпасть с ожиданием.', 'Connect the file inspector: the signature and size should match your expectation.'],
    wiki: ['File format#Magic number', 'Сигнатура_файла'], exNoRun: true,
  });
  H('file_to_bytes', {
    inp: ['Файл-артефакт.', 'An artifact file.'],
    what: ['Отдаёт содержимое файла байтовой строкой, HEX, Base64 или текстом UTF-8 — для XOR, хешей и текстовых операций.', 'Outputs the file as a byte string, HEX, Base64 or UTF-8 text, for XOR, hashes and text operations.'],
    ex: ['image.png', ['89 50 4e 47 0d 0a 1a 0a …', '89 50 4e 47 0d 0a 1a 0a …']],
    par: ['«Выход» и «Максимум байт» (защита от огромных файлов).', '“Output” and “Max bytes” (protection from huge files).'],
    keep: ['Байты точные; обрезка по лимиту показывается предупреждением.', 'The bytes are exact; a cut at the limit is shown as a warning.'],
    chk: ['Сравните размер с инспектором файлов.', 'Compare the size with the file inspector.'],
    wiki: ['Byte', 'Байт'], exNoRun: true,
  });
  H('file_concat', {
    inp: ['До четырёх частей: артефакты или байтовые строки, по порядку входов.', 'Up to four parts: artifacts or byte strings, in input order.'],
    what: ['Склеивает части побайтно в новый файл и показывает границы частей и тип результата; для PDF сверяет заявленную длину.', 'Joins the parts byte by byte into a new file and shows the part boundaries and the result type; for PDF it checks the declared length.'],
    ex: ['report.pdfaa + cipresso.wav', ['report.pdf (PDF), длина совпадает', 'report.pdf (PDF), the length matches']],
    par: ['«Имя результата».', '“Result name”.'],
    keep: ['Текстовый Join склеивает строки; эта нода — байты файлов.', 'The text Join joins strings; this node joins file bytes.'],
    chk: ['Сумма размеров частей равна итогу; у PDF в конце %%EOF.', 'The part sizes add up to the total; a PDF ends with %%EOF.'],
    wiki: ['Concatenation', 'Конкатенация'], exNoRun: true,
  });
  H('bits_to_image', {
    inp: ['Строки из 0 и 1 (или своих символов).', 'Rows of 0 and 1 (or your own characters).'],
    what: ['Строит картинку-артефакт из битов: ширина, порядок по строкам или столбцам, отражения, инверсия, масштаб и белое поле для QR.', 'Builds an image artifact from bits: width, row or column order, flips, inversion, scale and a white margin for QR.'],
    ex: ['1110111 1000001 …', ['картинка 7×7 клеток', 'a 7×7-cell image']],
    par: ['«Ширина», символы клеток, «Порядок», отражения, «Инвертировать», «Пикселей на клетку», «Белое поле».', '“Width”, cell characters, “Order”, flips, “Invert”, “Pixels per cell”, “White margin”.'],
    keep: ['Если ряды не делятся на строки, сетка режется по ширине; неполный ряд добивается белым.', 'If the bits are not split into lines, the grid is cut by width; an incomplete row is padded with white.'],
    chk: ['Для QR нужны три квадрата-ориентира по углам; если их нет — попробуйте транспонировать или отразить.', 'A QR needs three finder squares in the corners; if they are missing, try transposing or flipping.'],
    wiki: ['QR code', 'QR-код'], exNoRun: true,
  });
  H('img_combine', {
    inp: ['Две картинки: A и B.', 'Two images: A and B.'],
    what: ['Накладывает B на A: разность, XOR, сумма, умножение, «экран», среднее или прозрачность; B можно сдвинуть или растянуть до размера A.', 'Overlays B onto A: difference, XOR, add, multiply, screen, average or opacity; B can be shifted or stretched to the size of A.'],
    ex: ['signature.png + noise.png', ['разность проявляет скрытое', 'the difference reveals what is hidden']],
    par: ['«Как смешать», «Прозрачность B», «Сдвиг B по X/Y», «Растянуть B».', '“Blend”, “B opacity”, “B offset X/Y”, “Stretch B”.'],
    keep: ['Размер результата — как у A; исходники не меняются.', 'The result has the size of A; the originals are unchanged.'],
    chk: ['Если в разности видны только края — картинки сдвинуты: подберите сдвиг.', 'If the difference shows only edges, the images are misaligned: adjust the offset.'],
    wiki: ['Blend modes', 'Режимы_наложения'], exNoRun: true,
  });
  H('raw_pcm', {
    inp: ['Файл-артефакт или байтовая строка.', 'An artifact file or a byte string.'],
    what: ['Читает байты как сырые отсчёты звука с заданным форматом, каналами, частотой и смещением заголовка; выход — звук для спектрограммы и декодеров.', 'Reads bytes as raw audio samples with the given format, channels, rate and header offset; the output is audio for the spectrogram and decoders.'],
    ex: ['theme.wav.bmp', ['звук 8 бит, 8 кГц', '8-bit audio, 8 kHz']],
    par: ['«Формат отсчёта», «Каналов», «Частота», «Пропустить байт в начале».', '“Sample format”, “Channels”, “Sample rate”, “Skip bytes at the start”.'],
    keep: ['Байты не меняются; неполный последний кадр отбрасывается.', 'The bytes are unchanged; an incomplete last frame is dropped.'],
    chk: ['Пробуйте 8 бит без знака и 16 бит LE на 8000/11025/22050/44100 Гц и смотрите спектрограмму.', 'Try 8-bit unsigned and 16-bit LE at 8000/11025/22050/44100 Hz and look at the spectrogram.'],
    wiki: ['Pulse-code modulation', 'Импульсно-кодовая_модуляция'], exNoRun: true,
  });
  H('log_view', {
    inp: ['Текстовый артефакт (большой лог) или текст.', 'A text artifact (a large log) or text.'],
    what: ['Просмотр большого лога: номера строк, поиск, подсветка hex/Base64/URL/координат/§-кодов. Выделение можно отправить в новую ноду «Ввод».', 'Browsing a large log: line numbers, search, highlighting of hex/Base64/URLs/coordinates/§ codes. A selection can be sent to a new Input node.'],
    ex: ['latest.log', ['строки, подходящие под фильтр', 'lines matching the filter']],
    par: ['«Выход» (весь текст, совпавшие строки с контекстом, список кандидатов), «Фильтр», «Это regex», «Игнорировать регистр», «Инвертировать», «Строк контекста», «Что извлекать».', '“Output” (whole text, matching lines with context, candidate list), “Filter”, “Filter is a regex”, “Ignore case”, “Invert”, “Context lines”, “What to extract”.'],
    keep: ['Исходный лог не меняется.', 'The original log is not changed.'],
    chk: ['Сохраняйте номер строки найденного: он нужен, чтобы другие могли перепроверить находку.', 'Keep the line number of a find so others can re-verify it.'],
    wiki: ['Log file', 'Журнал_(информатика)'], exNoRun: true,
  });

  // ---------- Изображения ----------
  H('img_adjust', {
    inp: ['Изображение (артефакт).', 'An image (artifact).'],
    what: ['Яркость, контраст, гамма, уровни, подъём теней, автоуровни, инверсия, серый, порог и выбор канала R/G/B/A — чтобы проявить скрытое тёмное на тёмном.', 'Brightness, contrast, gamma, levels, shadow lift, auto-levels, invert, grayscale, threshold and R/G/B/A channel selection to reveal hidden dark-on-dark content.'],
    ex: [['тёмная картинка', 'a dark picture'], ['проявленный текст', 'revealed text']],
    par: ['«Канал», «Серое», «Чёрная/белая точка», «Подъём теней», «Гамма», «Яркость», «Контраст», «Авто», «Инверсия», «Порог» и его уровень. Порядок применения: канал → серое → уровни → тени → гамма → яркость/контраст → авто → инверсия → порог.', '“Channel”, “Grayscale”, “Black/white point”, “Shadow lift”, “Gamma”, “Brightness”, “Contrast”, “Auto”, “Invert”, “Threshold” and its level. Order: channel → gray → levels → shadows → gamma → brightness/contrast → auto → invert → threshold.'],
    keep: ['Оригинал не меняется; результат — новая производная версия. Кнопка «до/после» сравнивает с исходником.', 'The original is not changed; the result is a new derived version. The before/after button compares with the original.'],
    chk: ['Проявленное должно присутствовать и при других настройках; артефакт сжатия JPEG легко принять за скрытый текст.', 'What you reveal should survive other settings; JPEG compression artefacts are easily mistaken for hidden text.'],
    wiki: ['Image editing', 'Обработка_изображений'], exNoRun: true,
  });
  H('img_geom', {
    inp: ['Изображение (артефакт).', 'An image (artifact).'],
    what: ['Кадрирование по области, поворот на 90/180/270°, отражения и масштабирование без сглаживания.', 'Cropping by region, 90/180/270° rotation, flips and nearest-neighbour scaling.'],
    ex: [['большой скриншот', 'a large screenshot'], ['увеличенный фрагмент', 'an enlarged fragment']],
    par: ['«Поворот», «Отразить по горизонтали/вертикали», «Масштаб» (0,1–16). Область задаётся кнопкой «Область» и выделением мышью. Порядок: кадр → поворот → отражение → масштаб.', '“Rotate”, “Flip horizontally/vertically”, “Scale” (0.1–16). The region is set with the “Region” button and a mouse drag. Order: crop → rotate → flip → scale.'],
    keep: ['Оригинал не меняется; масштабирование без сглаживания сохраняет пиксели чёткими.', 'The original is not changed; scaling without smoothing keeps pixels crisp.'],
    chk: ['Для OCR увеличивайте мелкий текст в 2–4 раза без сглаживания.', 'For OCR enlarge small text 2–4× without smoothing.'],
    wiki: ['Image scaling', 'Масштабирование_изображений'], exNoRun: true,
  });
  H('img_bits', {
    inp: ['Изображение (артефакт), лучше без потерь (PNG).', 'An image (artifact), preferably lossless (PNG).'],
    what: ['Показывает один бит выбранного канала как чёрно-белую картинку (бит 0 — младший). Так находят узоры в младших битах (LSB-стеганография).', 'Shows one bit of the chosen channel as a black-and-white image (bit 0 is the least significant). Used to spot patterns in low bits (LSB steganography).'],
    ex: [['PNG с данными в младшем бите', 'a PNG with data in the low bit'], ['чёрно-белый узор', 'a black-and-white pattern']],
    par: ['«Канал» (R, G, B, A, яркость) и «Бит» от 0 до 7.', '“Channel” (R, G, B, A, luma) and “Bit” from 0 to 7.'],
    keep: ['Пересохранение в JPEG уничтожает скрытые биты — работайте с исходником.', 'Re-saving as JPEG destroys hidden bits, so use the original file.'],
    chk: ['Упорядоченный узор или текст в плоскости — признак вложения; шум без структуры — обычно норма.', 'An orderly pattern or text in a plane is a sign of embedding; structureless noise is usually normal.'],
    wiki: ['Bit plane', 'Битовая_плоскость'], exNoRun: true,
  });
  H('img_lsb', {
    inp: ['Изображение (артефакт), лучше PNG/BMP.', 'An image (artifact), preferably PNG/BMP.'],
    what: ['Собирает младшие биты пикселей в байты. Выход — строка (один символ на байт), которую можно подать в цепочки Base64/hex/текст.', 'Collects the low bits of pixels into bytes. The output is a string (one character per byte) you can feed into Base64/hex/text chains.'],
    ex: [['PNG с вложением', 'a PNG with embedded data'], ['PK… или читаемый текст', 'PK… or readable text']],
    par: ['«Каналы» (порядок обхода), «Младших бит на канал», «Порядок бит в байте», «Сканирование» (по строкам/столбцам), «Пропустить бит», «Инверсия», «Лимит байт».', '“Channels” (traversal order), “Low bits per channel”, “Bit order in a byte”, “Scan” (rows/columns), “Skip bits”, “Invert”, “Max bytes”.'],
    keep: ['Результат зависит от всех настроек: инструмент не знает, как автор прятал данные, — пробуйте варианты.', 'The result depends on all settings: the tool does not know how the author embedded data, so try variants.'],
    chk: ['Успех — сигнатура файла (PK, PNG, %PDF) или читаемый текст в начале вывода.', 'Success is a file signature (PK, PNG, %PDF) or readable text at the start of the output.'],
    wiki: ['Steganography#Digital', 'Стеганография'], exNoRun: true,
  });
  H('img_meta', {
    inp: ['Изображение (артефакт).', 'An image (artifact).'],
    what: ['Показывает размер, формат, текстовые чанки PNG, комментарии JPEG/GIF, текст EXIF и данные после конца изображения (с поиском сигнатур).', 'Shows size, format, PNG text chunks, JPEG/GIF comments, EXIF text and data after the end of the image (with a signature scan).'],
    ex: ['photo.jpg', ['EXIF, комментарий, хвост', 'EXIF, comment, trailing data']],
    par: NOPAR,
    keep: ['Только отчёт; файл не меняется.', 'A report only; the file is not changed.'],
    chk: ['GPS-координаты и камера в EXIF — частые следы; хвост после конца изображения всегда стоит проверить.', 'GPS coordinates and camera in EXIF are common clues; a tail after the end of the image is always worth checking.'],
    wiki: ['Exif', 'Exif'], std: ['PNG: текстовые чанки', 'https://www.w3.org/TR/png/#11textinfo'], exNoRun: true,
  });
  H('img_ocr', {
    inp: ['Изображение (артефакт) с текстом.', 'An image (artifact) with text.'],
    what: ['Распознаёт текст на картинке локально (tesseract.js: английский, русский, украинский) или шрифт Minecraft по пиксельной сетке.', 'Recognises text in an image locally (tesseract.js: English, Russian, Ukrainian) or the Minecraft font from its pixel grid.'],
    ex: [['скриншот книги', 'a screenshot of a book'], ['распознанный текст', 'recognised text']],
    par: ['«Движок», «Язык», «Только цифры», «Предобработка» (авто пробует несколько вариантов), область выделяется кнопкой «Область».', '“Engine”, “Language”, “Digits only”, “Preprocessing” (auto tries several variants); select the region with the “Region” button.'],
    keep: ['Распознавание вероятностное: ошибки в похожих символах (0/O, 1/l) обычны.', 'Recognition is probabilistic: mistakes on similar characters (0/O, 1/l) are common.'],
    chk: ['Всегда сверяйте с картинкой; для цифр и ID перепроверьте каждый знак глазами.', 'Always compare with the picture; for digits and IDs re-check every character by eye.'],
    wiki: ['Optical character recognition', 'Оптическое_распознавание_символов'], exNoRun: true,
  });
  H('img_qr', {
    inp: ['Изображение (артефакт) с QR-кодом.', 'An image (artifact) with a QR code.'],
    what: ['Читает QR-коды (jsQR, локально); другие штрихкоды — если браузер поддерживает BarcodeDetector. Пробует инверсию, автоуровни и масштаб.', 'Reads QR codes (jsQR, local); other barcodes only if the browser has BarcodeDetector. Tries inversion, auto-levels and scaling.'],
    ex: [['фото с QR', 'a photo with a QR code'], 'https://…'],
    par: [REGION[0], REGION[1]],
    keep: ['Найденный код обводится на картинке; оригинал не меняется.', 'The found code is outlined on the picture; the original is not changed.'],
    chk: ['Открывайте содержимое QR осторожно: ссылка может вести на небезопасный сайт.', 'Open QR content with care: the link may lead to an unsafe site.'],
    wiki: ['QR code', 'QR-код'], std: ['ISO/IEC 18004 (QR Code)', 'https://www.iso.org/standard/62021.html'], exNoRun: true,
  });
  H('img_sga', {
    inp: ['Изображение (артефакт) со знаками стола зачарований.', 'An image (artifact) with enchanting-table glyphs.'],
    what: ['Читает шрифт Standard Galactic из Minecraft: бинаризация по цвету → строки → сетка пикселей шрифта → сопоставление с шаблонами. Выход — латинские буквы клавиш.', 'Reads the Minecraft Standard Galactic font: colour binarisation → lines → font pixel grid → template matching. The output is the Latin letters of the keys.'],
    ex: [['скриншот знаков', 'a screenshot of glyphs'], 'THE END IS NEAR'],
    par: ['«Порог яркости» и «Пикселей картинки на пиксель шрифта» (0 — авто), «Выход» (латиница или кириллица ЙЦУКЕН), область.', '“Brightness threshold” and “Image pixels per font pixel” (0 = auto), “Output” (Latin or Cyrillic ЙЦУКЕН), region.'],
    keep: ['Знаки без шаблона дают «?». Зелёная подсветка — уверенные знаки, жёлтая — неподтверждённые шаблоны, красная — неизвестные.', 'Glyphs without a template give “?”. Green overlay means confident glyphs, yellow unverified templates, red unknown.'],
    chk: ['Сравните результат с картинкой знак за знаком; осмысленные слова — главное подтверждение.', 'Compare the result glyph by glyph with the picture; meaningful words are the main confirmation.'],
    wiki: ['Standard Galactic Alphabet', 'Стандартный_галактический_алфавит'], demo: 'sga', exNoRun: true,
  });

  // ---------- Звук и видео ----------
  H('spectrogram', {
    inp: ['Аудио или видео (артефакт).', 'Audio or video (artifact).'],
    what: ['Строит спектрограмму и осциллограмму: размер БПФ, окно, перекрытие, диапазоны частоты и дБ, шкала, палитры. Выход — картинка (её можно прочесть OCR) или фрагмент WAV.', 'Builds a spectrogram and waveform: FFT size, window, overlap, frequency and dB range, scale, colour maps. The output is an image (OCR can read it) or a WAV segment.'],
    ex: ['audio.wav', ['слова в спектре', 'words in the spectrum']],
    par: ['«Размер БПФ», «Окно», «Перекрытие», «Канал», «Реверс», «Скорость», «Мин./макс. частота», «Шкала», «Палитра», автоуровни и диапазон дБ. Выделение мышью — фрагмент, колесо — масштаб по времени.', '“FFT size”, “Window”, “Overlap”, “Channel”, “Reverse”, “Speed”, “Min/max frequency”, “Scale”, “Colour map”, auto levels and dB range. Drag to select, wheel to zoom in time.'],
    keep: ['Исходный звук не меняется; на картинке видна только выбранная полоса частот.', 'The original audio is not changed; the picture shows only the chosen frequency band.'],
    chk: ['Слова на спектрограмме читаются глазами при подходящем БПФ (обычно 2048–8192) и диапазоне частот; подберите контраст.', 'Words on a spectrogram are readable by eye with a suitable FFT (usually 2048–8192) and frequency range; adjust the contrast.'],
    wiki: ['Spectrogram', 'Спектрограмма'], exNoRun: true,
  });
  H('morse_audio', {
    inp: ['Аудио или видео (артефакт) с тональным Морзе.', 'Audio or video (artifact) with tone Morse.'],
    what: ['Находит тон, порог и длину точки, выдаёт точки/тире (для ноды «Морзе → текст») или готовый текст. Сомнительные места помечаются.', 'Finds the tone, threshold and dot length and outputs dots/dashes (for the “Morse → text” node) or decoded text. Uncertain spots are marked.'],
    ex: ['beeps.wav', '.... . .-.. .-.. ---'],
    par: ['«Канал», «С/до секунды», «Частота тона» (0 — авто), «Порог», «Длина точки» (0 — оценка), «Алфавит», «Выход», «Помечать неуверенные места».', '“Channel”, “From/to second”, “Tone frequency” (0 = auto), “Threshold”, “Dot length” (0 = estimate), “Alphabet”, “Output”, “Mark uncertain spots”.'],
    keep: ['Результат зависит от качества записи; шум даёт лишние знаки.', 'The result depends on recording quality; noise produces extra symbols.'],
    chk: ['Проверьте глазами на спектрограмме: точки и тире видны как короткие и длинные полосы.', 'Check by eye on a spectrogram: dots and dashes appear as short and long bars.'],
    wiki: ['Morse code', 'Азбука_Морзе'], std: ['ITU-R M.1677-1', 'https://www.itu.int/rec/R-REC-M.1677-1-200910-I/en'], exNoRun: true,
  });
  H('dtmf_audio', {
    inp: ['Аудио или видео (артефакт) с тонами набора номера.', 'Audio or video (artifact) with dial tones.'],
    what: ['Распознаёт телефонные тоны DTMF (алгоритм Гёрцеля на 8 частотах) и выдаёт цифры 0–9, *, #, A–D. Паузы можно превращать в пробелы для мультитапа.', 'Detects DTMF phone tones (the Goertzel algorithm on 8 frequencies) and outputs digits 0–9, *, #, A–D. Pauses can become spaces for multitap.'],
    ex: ['dial.wav', '44 33 555 555 666'],
    par: ['«Канал», «С/до секунды», «Окно анализа», «Мин. длина тона», «Мин. амплитуда», «Пауза → пробел, мс», «Выход».', '“Channel”, “From/to second”, “Analysis window”, “Min tone length”, “Min amplitude”, “Pause → space, ms”, “Output”.'],
    keep: ['Слабые и искажённые тоны могут быть пропущены; понижайте минимальную амплитуду.', 'Weak or distorted tones may be missed; lower the minimum amplitude.'],
    chk: ['Результат подайте в «Телефон: нажатия → буквы». Сверьте число тонов на спектрограмме.', 'Feed the result to “Phone: key presses → letters”. Compare the tone count on a spectrogram.'],
    wiki: ['Dual-tone multi-frequency signaling', 'DTMF'], std: ['ITU-T Q.23', 'https://www.itu.int/rec/T-REC-Q.23/en'], demo: 't9', exNoRun: true,
  });
  H('sstv_audio', {
    inp: ['Аудио или видео (артефакт) с сигналом SSTV.', 'Audio or video (artifact) with an SSTV signal.'],
    what: ['Декодирует медленное телевидение SSTV (Robot 36, Martin M1/M2, Scottie S1/S2) в картинку.', 'Decodes slow-scan television SSTV (Robot 36, Martin M1/M2, Scottie S1/S2) into a picture.'],
    ex: ['sstv.wav', ['картинка', 'a picture']],
    par: ['«Канал», «С/до секунды», «Режим» (по VIS-коду или вручную). Остальные режимы (Robot 72, PD, Scottie DX…) не реализованы.', '“Channel”, “From/to second”, “Mode” (from the VIS code or manual). Other modes (Robot 72, PD, Scottie DX…) are not implemented.'],
    keep: ['Проверено на синтетических сигналах; реальные записи проверяйте глазами.', 'Verified on synthetic signals; check real recordings by eye.'],
    chk: ['Сдвиг и наклон изображения говорят о неверном режиме или частоте дискретизации.', 'A skewed or sheared picture points to the wrong mode or sample rate.'],
    wiki: ['Slow-scan television', 'Медленное_телевидение'], exNoRun: true,
  });
  H('video_frames', {
    inp: ['Локальное видео (артефакт).', 'A local video (artifact).'],
    what: ['Покадровый просмотр: шаг ±1 кадр, время и номер кадра, «кадр → картинка», контактный лист и «звук → артефакт» для спектрограммы.', 'Frame-by-frame viewing: ±1 frame stepping, time and frame number, “frame → image”, a contact sheet and “audio → artifact” for the spectrogram.'],
    ex: ['clip.mp4', ['кадр 123 как картинка', 'frame 123 as a picture']],
    par: ['«Кадров в секунду» (браузер не сообщает частоту — выберите вручную), параметры листа: каждый N-й кадр, диапазон, максимум кадров, столбцы, ширина плитки.', '“Frames per second” (the browser does not report it, so set it), sheet settings: every N-th frame, range, max frames, columns, tile width.'],
    keep: ['Видео не меняется; кадры сохраняются как новые картинки-артефакты.', 'The video is not changed; frames are saved as new image artifacts.'],
    chk: ['Мелькнувший на одном кадре текст или код найдите по контактному листу и затем перепроверьте на полноразмерном кадре.', 'Text or a code that flashes on one frame can be found on the contact sheet, then re-checked on the full-size frame.'],
    wiki: ['Frame rate', 'Частота_кадров'], exNoRun: true,
  });
})(typeof self !== 'undefined' ? self : this);
