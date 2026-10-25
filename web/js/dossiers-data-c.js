// Встроенные досье, часть 3: Killing Floor 2, Dr. Langeskov, 76543, Steam Winter 2015.
// Факты — из проверки программы на этих завершённых ARG (2026-10-23) и исторических сводок Game Detectives.
// Этапы, которые программа не прошла сама, помечены честно: «нужен контекст», «точный вход недоступен».
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const D = G.Dossiers;
  const src = (name, url, reliability, note) => ({ name, url, reliability, note });
  const stage = (artifact, technique, result, status, note) => ({ artifact, technique, result, status: status || 'verified', note: note || '' });
  const tech = (name, example) => ({ name, example });

  D.register({
    id: 'kf2', arg: 'kf2', title: 'Killing Floor 2: From a Friend',
    period: '2017', platform: T('Steam-объявления / PNG / видео / WAV / RAR', 'Steam announcements / PNG / video / WAV / RAR'),
    creators: 'Tripwire Interactive', status: T('Завершена раскрытием Summer Sideshow', 'Finished with the Summer Sideshow reveal'),
    summary: T('Объявление со сдвигом Цезаря (текст −3, путь −6) вело к thestart.png; дальше — перестановка столбцов со значимым двойным пробелом, скрытая часть картинки, спектрограмма с Enigma, Виженер с необычным ключом и RAR с паролем, из фрагментов которого собирается пазл.',
      'An announcement with Caesar shifts (text −3, path −6) led to thestart.png; then a columnar transposition with a significant double space, a hidden part of an image, a spectrogram with Enigma, a Vigenère with an unusual key and a password RAR whose fragments make a puzzle.'),
    sources: [
      src('Game Detectives: Killing Floor 2', 'https://wiki.gamedetectives.net/w/Killing_Floor_2', 'high', T('Карта этапов и транскрипции.', 'The stage map and transcriptions.')),
      src(T('r/codes: перестановка', 'r/codes: transposition'), 'https://www.reddit.com/r/codes/comments/69abg1/comment/dh55bs2/', 'high', T('Точный вход с двумя пробелами.', 'The exact input with two spaces.')),
    ],
    stages: [
      stage(T('Объявление: текст + путь', 'Announcement: text + path'), T('Цезарь −3 и −6 по строкам', 'Caesar −3 and −6 by line'), 'fromafriend/thestart.png', 'verified', T('Авто-поиск решает целиком (части по строкам).', 'The auto search solves it whole (parts by line).')),
      stage(T('Перестановка (55 символов)', 'Transposition (55 characters)'), T('Порядок столбцов подбирается', 'The column order is searched'), 'Is there anyone out there looking? Check the mods page!', 'verified', T('Версия с одним пробелом — ошибка транскрипции.', 'The one-space version is a transcription error.')),
      stage('Puzzle.png', T('Уровни: чёрная 0, белая 20', 'Levels: black 0, white 20'), T('Проявляется часть пазла', 'A puzzle part appears'), 'verified', T('Ручная обработка картинки.', 'Manual image processing.')),
      stage('sample.wav', T('Спектрограмма → Enigma', 'Spectrogram → Enigma'), T('Пароль архива', 'The archive password'), 'context', T('Скрытый текст спектрограммы не прочитан, поэтому настроек Энигмы нет; сама нода «Энигма» (I/M3/M4) в программе есть.', 'The hidden spectrogram text was not read, so the Enigma settings are unknown; the Enigma node (I/M3/M4) itself exists.')),
      stage('Ybn avogyo wii erqenje…', T('Виженер, ключ ANTONWOULDBEPROUND', 'Vigenère, key ANTONWOULDBEPROUND'), 'You missed the package…', 'verified', T('Ключ из прошлого этапа; слепо не решается.', 'The key comes from an earlier stage; not solvable blind.')),
      stage('Package.rar', T('RAR4, заголовки зашифрованы паролем', 'RAR4 with password-encrypted headers'), T('Фрагменты финального пазла', 'Final puzzle fragments'), 'context', T('Нода «Архив RAR/7z» открывает такие архивы с паролем, но пароль этого архива (из этапа Энигмы) неизвестен: проверен только честный отказ без пароля.', 'The Archive RAR/7z node opens such archives with a password, but this archive’s password (from the Enigma stage) is unknown: only the honest refusal without a password was checked.')),
    ],
    techniques: [tech(T('Цезарь по частям', 'Caesar by parts'), '−3 / −6'), tech(T('Перестановка столбцов', 'Columnar transposition'), '12 columns'), tech(T('Виженер', 'Vigenère'), 'ANTONWOULDBEPROUND'), tech(T('Уровни картинки', 'Image levels'), '0…20')],
    open: [T('Спектральная загадка не пройдена, поэтому неизвестны настройки Энигмы и пароль RAR; инструменты для обоих этапов есть.', 'The spectral puzzle is not done, so the Enigma settings and the RAR password are unknown; the tools for both stages exist.')],
    presets: ['kf2-compound', 'kf2-columnar', 'kf2-vigenere'],
  });

  D.register({
    id: 'langeskov', arg: 'langeskov', title: 'Dr. Langeskov',
    period: '2015', platform: T('сайт crowscrowscrows.com / MP3 со SSTV / PNG / PDF по частям', 'the crowscrowscrows.com site / MP3 with SSTV / PNG / a PDF in parts'),
    creators: 'Crows Crows Crows', status: T('Завершена выпуском игры 4 декабря 2015', 'Finished with the game release on 4 December 2015'),
    summary: T('Письма на сайте прятали двоичные, hex, Base64, Base32 и ASCII85 строки; MP3 содержали SSTV-картинки (Scottie S1 без VIS-заголовка), имя файла 74647075756a66 было подсказкой scottie, а PDF был разрезан на «.pdfaa» и «.wav».',
      'Messages on the site hid binary, hex, Base64, Base32 and ASCII85 strings; the MP3s carried SSTV pictures (Scottie S1 without a VIS header), the file name 74647075756a66 was the hint scottie, and a PDF was cut into a “.pdfaa” and a “.wav”.'),
    sources: [
      src('Game Detectives: Dr. Langeskov ARG', 'https://wiki.gamedetectives.net/w/Dr._Langeskov_ARG', 'high', T('Сводка маршрута.', 'The route summary.')),
      src('crowscrowscrows.com/report', 'https://crowscrowscrows.com/report/', 'high', T('Оригинальные страницы и файлы.', 'The original pages and files.')),
    ],
    stages: [
      stage('4.html', T('Двоичный код', 'Binary'), 'elgar-INVOICE.html'),
      stage('admin.html', 'HEX / Base64', 'sounds/boot.mp3 · oh no :('),
      stage('boot.mp3, signature.mp3, 74647075756a66.mp3', T('SSTV, режим по периоду строк (VIS нет)', 'SSTV, mode from the line period (no VIS)'), T('Картинки: корабль, горы с шаром, телефонная клавиатура', 'Pictures: a ship, mountains with a balloon, a phone keypad'), 'verified', T('Сверка с историческими картинками не выполнена (они недоступны).', 'Not compared with the historical pictures (they are unavailable).')),
      stage('74647075756a66', T('hex → Цезарь −1', 'hex → Caesar −1'), 'scottie'),
      stage(T('Письмо 5346044', 'Message 5346044'), T('Два куска Base32', 'Two Base32 runs'), T('Продолжение письма', 'The rest of the message')),
      stage(T('Письмо 5346061', 'Message 5346061'), 'ASCII85', '45.925596 8.559730'),
      stage('garden-landscaping.pdfaa + cipresso.wav', T('Бинарная склейка', 'Binary join'), T('PDF 924 346 байт', 'A 924,346-byte PDF'), 'verified', T('Содержимое страниц не проверялось.', 'The page content was not checked.')),
      stage('theme.wav.bmp', T('Байты картинки как звук (raw PCM)', 'Image bytes as sound (raw PCM)'), T('Не прочитано', 'Not read'), 'context'),
    ],
    techniques: [tech(T('Кодировки', 'Encodings'), 'binary / hex / Base64 / Base32 / ASCII85'), tech('SSTV', 'Scottie S1'), tech(T('Склейка файлов', 'File join'), '.pdfaa + .wav'), tech(T('Наложение картинок', 'Image overlay'), 'signature.png + noise')],
    open: [T('Наложение signature.png и mayflower-noise.png и смысл raw-PCM из BMP не подтверждены.', 'The overlay of signature.png and mayflower-noise.png and the meaning of the BMP raw PCM are not confirmed.')],
    presets: ['dl-binary', 'dl-hex', 'dl-base64', 'dl-base32', 'dl-ascii85', 'dl-scottie', 'dl-sstv'],
  });

  D.register({
    id: 'a76543', arg: 'a76543', title: '76543',
    period: '2017–2018', platform: T('Discord-бот / web / физический тайник / QR', 'Discord bot / web / a physical cache / QR'),
    creators: T('Не установлен', 'Not identified'), status: T('Завершена (финальные титры по сводке)', 'Finished (final credits per the summary)'),
    summary: T('Длинный Виженер с ключом argsevensixfivefourthree (находится Python-движком без подсказок), фонетический алфавит в прозе (BE2DA394), простые числа и арифметика, тёмный QR со стёртыми ориентирами и QR физического тайника.',
      'A long Vigenère with the key argsevensixfivefourthree (found by the Python engine without hints), a phonetic alphabet in prose (BE2DA394), primes and arithmetic, a dark QR with erased finder patterns and the QR of a physical cache.'),
    sources: [src('Game Detectives: 76543', 'https://wiki.gamedetectives.net/w/76543', 'high', T('Маршрут; часть пути шла через живого бота.', 'The route; part of it went through a live bot.'))],
    stages: [
      stage(T('Начальное сообщение', 'The first message'), T('Виженер без ключа', 'Vigenère without a key'), 'Some say he disguised himself…', 'verified', T('Узнать Шекспира — вывод человека.', 'Recognising Shakespeare is a human conclusion.')),
      stage(T('Повествование', 'Narration'), T('Фонетический алфавит в прозе', 'A phonetic alphabet in prose'), 'BE2DA394', 'context', T('Нужна ручная нормализация форм слов.', 'Word forms need manual normalisation.')),
      stage('2*3*76543', T('Точная арифметика', 'Exact arithmetic'), '459258', 'verified', T('В имени аккаунта опечатка 456258ARG.', 'The account name has the typo 456258ARG.')),
      stage(T('Тёмный QR 220×220', 'A dark 220×220 QR'), T('Выравнивание + восстановление ориентиров', 'Equalisation + finder-pattern repair'), 'Your key is primes', 'verified', T('Ориентиры дорисованы программой — это помечено в результате.', 'The finder patterns are redrawn by the program, and the result says so.')),
      stage(T('QR тайника', 'The cache QR'), 'jsQR', 'Oh hello. Say my name.'),
      stage(T('Бот, DTMF, финальный адрес', 'The bot, DTMF, the final address'), '—', '—', 'noinput', T('Исходных записей нет.', 'No original recordings.')),
    ],
    techniques: [tech(T('Виженер', 'Vigenère'), T('ключ из 24 букв', 'a 24-letter key')), tech('QR', T('восстановление ориентиров', 'finder repair')), tech(T('Арифметика', 'Arithmetic'), '2×3×76543')],
    open: [T('Строка RC4 «Nope / prime / 0d0d0bc3» в источнике не воспроизводится; нестандартные руны и сдвиги требуют исходного алфавита.', 'The RC4 line “Nope / prime / 0d0d0bc3” does not reproduce from the source; the non-standard runes and shifts need the original alphabet.')],
    presets: ['ar-vigenere', 'ar-calc'],
  });

  D.register({
    id: 'steam2015', arg: 'steam2015', title: 'Steam Winter 2015',
    period: '2015', platform: T('Steam: комикс, карточки, WAV, поиск', 'Steam: a comic, cards, WAV, search'),
    creators: 'Valve', status: T('Завершена выдачей Red Herring Badge', 'Finished with the Red Herring Badge'),
    summary: T('Штрихкод обложки, бледные символы на карточках (система Dungeon Master), три WAV со спектральным паролем и японской речью, фонетический алфавит в повествовании и анаграмма BULLET HELL.',
      'A cover barcode, faint symbols on the cards (a Dungeon Master system), three WAVs with a spectral password and Japanese speech, a phonetic alphabet in the narration and the anagram BULLET HELL.'),
    sources: [
      src('Game Detectives: Steam Winter 2015', 'https://wiki.gamedetectives.net/w/Steam_Winter_2015', 'high', T('Сводка, хронология и улики.', 'The summary, timeline and clues.')),
    ],
    stages: [
      stage(T('Обложка комикса', 'The comic cover'), T('Штрихкод (не QR)', 'A barcode (not QR)'), '—', 'context', T('Свой декодер штрихкодов кроме QR в программе не реализован.', 'The program has no own decoder for barcodes other than QR.')),
      stage(T('Карточки Taffy и 6', 'Cards Taffy and 6'), T('Уровни → символы', 'Levels → symbols'), T('Имя следующего WAV', 'The next WAV name'), 'context'),
      stage('loyagorku.wav', T('Спектрограмма', 'Spectrogram'), '1v7531', 'context', T('Программа сама пароль не прочитала.', 'The program did not read the password itself.')),
      stage(T('Повествование', 'Narration'), T('Фонетический алфавит + «четыре раза»', 'Phonetic alphabet + “four times”'), 'LLLLHTBEEU', 'context'),
      stage('LLLLHTBEEU', T('Анаграмма', 'Anagram'), 'hell bullet → BULLET HELL'),
    ],
    techniques: [tech(T('Анаграмма', 'Anagram'), 'LLLLHTBEEU'), tech(T('Уровни картинки', 'Image levels'), T('бледные символы', 'faint symbols'))],
    open: [T('Steam SEARCH и выдача значка были серверными механизмами и сейчас не воспроизводятся.', 'Steam SEARCH and the badge were server mechanisms and cannot be reproduced now.')],
    presets: ['sw-anagram'],
  });
})(typeof self !== 'undefined' ? self : this);
