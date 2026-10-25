// Встроенные досье, часть 2: Cicada 3301, Year Zero, Oxenfree, Inscryption, Sombra, Searching For a World…, I Love Bees.
// Факты — только из отчётов deep-research (1) и (3). Где точного шифртекста нет — этап помечен «точный вход недоступен».
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const D = G.Dossiers;
  const src = (name, url, reliability, note) => ({ name, url, reliability, note });
  const stage = (artifact, technique, result, status, note) => ({ artifact, technique, result, status: status || 'verified', note: note || '' });
  const tech = (name, example) => ({ name, example });
  const NO_INPUT = T('Точный вход недоступен; воспроизводимый прогон невозможен.', 'The exact input is unavailable; a reproducible run is impossible.');

  D.register({
    id: 'cicada', arg: 'cicada', title: 'Cicada 3301',
    period: '2012', platform: T('JPEG / web / телефон / OutGuess / PGP / физические QR-плакаты', 'JPEG / web / phone / OutGuess / PGP / physical QR posters'),
    creators: T('Организатор не установлен', 'The organiser is not identified'),
    status: T('Исследована только первая головоломка 2012 года', 'Only the first 2012 puzzle is covered'),
    summary: T('Первое изображение имеет размер 509×503 пикселей. В сыром содержимом JPEG стоит CLAVDIVS CAESAR says "lxxt>33m2mqkyv2gsq3q=w]O2ntk": вычитание 4 из кода КАЖДОГО символа даёт URL-приманку. Настоящий слой извлекает OutGuess; книжный шифр привёл к телефону, произведение 509×503×3301 — к домену, PGP подтвердил подпись.',
      'The first image is 509×503 pixels. The raw content of the JPEG contains CLAVDIVS CAESAR says "lxxt>33m2mqkyv2gsq3q=w]O2ntk": subtracting 4 from the code of EVERY character gives a decoy URL. The real layer is extracted with OutGuess; a book cipher led to a phone number, the product 509×503×3301 to a domain, and PGP confirmed the signature.'),
    sources: [
      src('Cicada-3301 (aadishgoel)', 'https://github.com/aadishgoel/Cicada-3301', 'high', T('Технический разбор OutGuess и строки.', 'A technical OutGuess and string walkthrough.')),
      src('Boxentriq walkthrough', 'https://www.boxentriq.com/guides/cicada-3301-first-puzzle-walkthrough', 'high', T('Двойные пробелы в book-тексте значимы.', 'Double spaces in the book text are significant.')),
      src('scream314/cicada3301 (2012.md)', 'https://github.com/scream314/cicada3301/blob/master/2012.md', 'high', T('Результат проверки PGP.', 'The PGP verification result.')),
      src('Wikimedia Commons: first message', 'https://commons.wikimedia.org/wiki/File:Cicada3301%27s_First_Message.jpg', 'high', T('Сохранённая копия первого изображения (509×503).', 'A preserved copy of the first image (509×503).')),
    ],
    stages: [
      stage('Start.jpg', T('Просмотр сырого текста файла', 'Reading the raw text of the file'), 'CLAVDIVS CAESAR says "lxxt>33m2mqkyv2gsq3q=w]O2ntk"'),
      stage('lxxt>33m2mqkyv2gsq3q=w]O2ntk', T('Вычесть 4 из кода каждого символа (не Цезарь по алфавиту)', 'Subtract 4 from every character code (not an alphabetic Caesar)'), 'http://i.imgur.com/m9sYK.jpg', 'verified', T('Это приманка.', 'This is a decoy.')),
      stage('Start.jpg', 'outguess -r Start.jpg Start.txt', T('Reddit-URL + book-коды', 'A Reddit URL + book codes'), 'verified', T('Двойные пробелы нельзя схлопывать.', 'Double spaces must not be collapsed.')),
      stage(T('Книжный шифр', 'The book cipher'), T('Номера → слова/буквы', 'Numbers → words/letters'), '2143909608', 'verified', T('Телефон из книжного шифра.', 'The phone number from the book cipher.')),
      stage('509 × 503 × 3301', T('Три простых числа: размеры картинки и 3301', 'Three primes: the image dimensions and 3301'), '845145127 (845145127.com)', 'verified'),
      stage(T('Следующее изображение', 'The next image'), 'OutGuess → PGP', 'gpg: Good signature from "Cicada 3301 (845145127)"', 'verified', T('Личность организаторов отсюда не следует.', 'This says nothing about who the organisers are.')),
    ],
    techniques: [tech(T('Сдвиг кода символа', 'Character code shift'), '−4 per char'), tech('OutGuess', 'outguess -r'), tech(T('Книжный шифр', 'Book cipher'), T('двойные пробелы значимы', 'double spaces matter')), tech(T('Арифметика', 'Arithmetic'), '509 × 503 × 3301 = 845145127'), tech('PGP', T('проверка подписи', 'signature check'))],
    open: [T('Поздняя цепочка вне рамок исследования.', 'The late chain is outside the scope of the study.'), T('Нормализация пробелов должна быть явной, а не автоматической.', 'Whitespace normalisation must be explicit, never automatic.')],
    presets: ['cic-shift', 'cic-math'],
  });

  D.register({
    id: 'yearzero', arg: 'yearzero', title: 'Year Zero',
    period: '2007', platform: T('USB / MP3 / видео / web / физические носители', 'USB / MP3 / video / web / physical media'),
    creators: T('Nine Inch Nails (кампания к альбому)', 'Nine Inch Nails (the album campaign)'), status: T('Хронология хорошо сохранена; точных шифртекстов в отчётах нет', 'A well-preserved timeline; the reports give no exact ciphertexts'),
    summary: T('14 февраля 2007: USB на концерте, статика в конце трека образует при спектрограмме изображение. 19 февраля: 2432.mp3, спектрограмма показывает 1-216-333-1810. 22 февраля: быстрый кадр teaser → yearzero.nin.com/0024/. Дальше — тайм-коды, GarageBand-пакет, сведение каналов и Morse.',
      '14 Feb 2007: a USB at a concert, static at the end of a track forms an image in the spectrogram. 19 Feb: 2432.mp3, the spectrogram shows 1-216-333-1810. 22 Feb: a fast teaser frame → yearzero.nin.com/0024/. Then timecodes, a GarageBand package, channel summing and Morse.'),
    sources: [src('Wikipedia: Campaign timeline of Year Zero', 'https://en.wikipedia.org/wiki/Campaign_timeline_of_Year_Zero', 'high', T('Хронология; побайтовых образов не все.', 'A timeline; not every byte-exact image survives.'))],
    stages: [
      stage('My Violent Heart (USB)', T('Спектрограмма статики в конце', 'Spectrogram of the static at the end'), T('Изображение The Presence', 'The image of The Presence'), 'noinput', NO_INPUT),
      stage('2432.mp3', T('Спектрограмма', 'Spectrogram'), '1-216-333-1810', 'noinput', T('Номер телефона ведёт на сайт; сам аудиофайл в источниках не приложен.', 'The phone number leads to a site; the audio file itself is not attached in the sources.')),
      stage(T('Один быстрый кадр teaser', 'One fast teaser frame'), T('Покадровый просмотр', 'Frame stepping'), 'yearzero.nin.com/0024/', 'noinput'),
      stage(T('Survivalism: дисплеи и тайм-коды', 'Survivalism: displays and timecodes'), T('Буквы из кадров', 'Letters from frames'), T('Следующий домен', 'The next domain'), 'noinput'),
      stage(T('Пакет GarageBand «Our End Trip»', 'The GarageBand package “Our End Trip”'), T('Дополнительный файл', 'An extra file'), '6455da04', 'noinput'),
      stage('The Great Destroyer', T('Сложение каналов L+R в моно', 'Summing L+R to mono'), 'red horse vector', 'noinput'),
      stage('Another Version of the Truth', 'Morse', 'grace the teacher', 'noinput'),
    ],
    techniques: [tech(T('Спектрограмма', 'Spectrogram'), '2432.mp3'), tech(T('Покадровый просмотр', 'Frame stepping'), 'teaser'), tech(T('Сведение каналов', 'Channel summing'), 'L + R'), tech('Morse', 'grace the teacher')],
    open: [T('Термохромное покрытие CD со скрытой двоичной последовательностью: точная последовательность в источнике не опубликована.', 'The thermochromic CD coating with a hidden binary sequence: the exact sequence is not published in the source.')],
    presets: ['yz-plan'],
  });

  D.register({
    id: 'oxenfree', arg: 'oxenfree', title: 'Oxenfree ARG',
    period: '2016', platform: T('игра / радио / телефон / Twitter / web / аудио / физические носители', 'game / radio / phone / Twitter / web / audio / physical media'),
    creators: T('Не указаны в отчётах', 'Not given in the reports'), status: T('Хорошо задокументирован; часть исторических эндпойнтов изменилась', 'Well documented; some historical endpoints have changed'),
    summary: T('Десять радио-аномалий дают позывные и цифры; сортировка Able…Jig даёт телефон (916)-936-3733. Дальше Morse по телефону и в SMS, стерео-каналы, обратное воспроизведение, HTML alt с десятичными байтами и, наконец, анаграмма MILNER IS WARD, подтверждённая ретвитом Xray.',
      'Ten radio anomalies give callsigns and digits; sorting Able…Jig gives the phone (916)-936-3733. Then Morse by phone and in an SMS, stereo channels, reversed playback, an HTML alt with decimal bytes, and finally the anagram MILNER IS WARD, confirmed by an Xray retweet.'),
    sources: [src('Game Detectives Wiki: Oxenfree ARG', 'https://wiki.gamedetectives.net/w/Oxenfree_ARG', 'high', T('Полный write-up.', 'A full write-up.'))],
    stages: [
      stage(T('10 радио-аномалий (Able, Baker, … Jig)', '10 radio anomalies (Able, Baker, … Jig)'), T('Сортировка позывных по алфавиту, склейка цифр', 'Sorting callsigns alphabetically, concatenating digits'), '(916)-936-3733 (91-OXENFREE)', 'noinput', T('Цифры отдельных позывных в отчёте не приведены.', 'The digits of the individual callsigns are not in the report.')),
      stage('--. --- --- -.. / .-- --- .-. -.- / …', 'Morse', 'GOOD WORK DL BB LISTEN CLOSE', 'verified', T('Morse не различает регистр; заглавный вид — запись источника.', 'Morse has no case; the uppercase form is how the source prints it.')),
      stage(T('Поздняя версия трека, стерео', 'A later version of the track, stereo'), T('Изоляция каналов', 'Channel isolation'), T('Слева «DELETES NOT NEEDED PLEASE STAND BY SOS», справа «SOS KANALOA…»', 'Left “DELETES NOT NEEDED PLEASE STAND BY SOS”, right “SOS KANALOA…”'), 'verified'),
      stage(T('Звук на сайте Edwards Island', 'Audio on the Edwards Island site'), T('Воспроизвести задом наперёд → Morse', 'Play backwards → Morse'), 'DONT LISTEN TO ALEX TELL XRAY IT IS TIME TO GO', 'noinput'),
      stage('108 101 97 118 101 32 112 111 115 115 105 98 108 101', T('Десятичные байты → ASCII', 'Decimal bytes → ASCII'), 'leave possible', 'verified', T('Источник печатает LEAVE POSSIBLE; байты дают строчные.', 'The source prints LEAVE POSSIBLE; the bytes give lowercase.')),
      stage('D I E L N I A I W R M R S', T('Анаграмма', 'Anagram'), 'MILNER IS WARD', 'discrepancy', T('В наборе три I, в ответе две: лишняя I. Ответ подтверждён ретвитом Xray и физической стадией на Fort Ward.', 'The set has three I’s, the answer two: an extra I. The answer was confirmed by Xray’s retweet and the physical stage at Fort Ward.')),
    ],
    techniques: [tech('Morse', 'SMS'), tech(T('Стерео-каналы', 'Stereo channels'), 'L / R'), tech(T('Обратное аудио', 'Reversed audio'), '→ Morse'), tech(T('Десятичные байты', 'Decimal bytes'), '108 101 97 … → leave possible'), tech(T('Анаграмма', 'Anagram'), 'MILNER IS WARD')],
    open: [T('Некоторые исторические web/audio-эндпойнты уже изменились.', 'Some historical web/audio endpoints have changed.'), T('Лишняя I в наборе букв анаграммы: опечатка транскрипции или иной набор.', 'The extra I in the anagram letters: a transcription slip or a different set.')],
    presets: ['ox-morse', 'ox-decimal', 'ox-anagram'],
  });

  D.register({
    id: 'inscryption', arg: 'inscryption', title: 'Inscryption ARG',
    period: '2021', platform: T('игра / файлы сохранений / web / дискеты / физические носители', 'game / save files / web / floppies / physical media'),
    creators: T('Не указаны в отчётах', 'Not given in the reports'), status: T('Игровые стадии воспроизводимы; часть внешних сайтов и записей исчезла', 'The game stages are reproducible; some external sites and recordings are gone'),
    summary: T('Строка MYCOLOG1ST12|P3RHAPS??|BLOOD$L3TT3R8OX — не один шифр, а три инструкции к разным источникам. Склеенный через «|» ключ вводится в консоль игры (Ctrl+C при загрузке Act 2): decode log.txt, ключ, save log.txt. Дальше правка SaveFile.gwsave, Morse в аудио и в мигающем сундуке, и физические дискеты с «#».',
      'The string MYCOLOG1ST12|P3RHAPS??|BLOOD$L3TT3R8OX is not one cipher but three instructions to different sources. The key, joined with “|”, is typed into the game console (Ctrl+C while Act 2 loads): decode log.txt, the key, save log.txt. Then a SaveFile.gwsave edit, Morse in audio and in a flashing chest, and physical floppies with “#”.'),
    sources: [src(T('Steam-руководство (community master doc)', 'Steam guide (community master doc)'), 'https://steamcommunity.com/sharedfiles/filedetails/?id=3001420353', 'high', T('Есть мелкие опечатки (IAMLRNED2MCH против пояснения IAMLRNED2MUCH).', 'Small typos exist (IAMLRNED2MCH vs the gloss IAMLRNED2MUCH).'))],
    stages: [
      stage('MYCOLOG1ST12|P3RHAPS??|BLOOD$L3TT3R8OX', T('Три инструкции: имя Mycobot (12 цифр), фальшивая ссылка Beeper, скрытый текст Bonelord 4:3', 'Three instructions: Mycobot’s name (12 digits), a fake Beeper link, hidden 4:3 Bonelord text'), '918234489010|8339344??|8043!$702D!!$666', 'verified', T('Ключ — результат трёх подзадач, консоль игры — проверка.', 'The key is the result of three sub-tasks; the game console is the validation.')),
      stage('SE:167BP:TRU', T('Править SaveFile.gwsave: Story Event 167, rlength+1, bonelordPuzzleActive=true', 'Edit SaveFile.gwsave: Story Event 167, rlength+1, bonelordPuzzleActive=true'), 'IAMLRNED2MCH', 'verified', T('Хранится точная форма; смысловое «MUCH» — только пояснение.', 'The exact form is kept; “MUCH” is only a gloss.')),
      stage('Archivist audio / chest', 'Morse', 'BIG EAR / NOCHANCE', 'verified'),
      stage(T('Дискеты backup_#2#.txt, backup_##3.txt, backup_1##.txt', 'Floppies backup_#2#.txt, backup_##3.txt, backup_1##.txt'), T('Наложение трёх файлов', 'Overlaying three files'), 'e-FuQZ6hTS0 / THANKYOUFOR#|PLAYING##|NSCRYPTIONFRIEND', 'noinput', T('Содержимое отдельных дискет в отчёте не приведено.', 'The contents of the individual floppies are not in the report.')),
    ],
    techniques: [tech(T('Ключ из нескольких ветвей', 'A key from several branches'), '918234489010|8339344??|8043!$702D!!$666'), tech(T('Правка сохранения', 'Save editing'), 'SE:167BP:TRU'), tech('Morse', 'BIG EAR / NOCHANCE'), tech(T('Наложение с #', 'Overlay with #'), 'e-FuQZ6hTS0')],
    open: [T('Часть внешних сайтов и Twitch-записей исчезла.', 'Some external sites and Twitch recordings have disappeared.')],
    presets: ['in-meta-key'],
  });

  D.register({
    id: 'sombra', arg: 'sombra', title: 'Sombra ARG (Overwatch)',
    period: '2016', platform: 'Overwatch video / web / image',
    creators: T('Не указаны в отчётах', 'Not given in the reports'), status: T('Стадия OpenSSL/Base64 осталась нерешённой', 'The OpenSSL/Base64 stage stayed unsolved'),
    summary: T('Hex-блок в видео Ana на 1:16 + XOR 23 даёт повторяющуюся испанскую фразу и кусок «somb»; второй блок — «ra». Вертикальные штрих-коды → hex → двоичный → пиксели → QR. Строка Summer Games — валидная Base64 на 109 байт с префиксом Salted__: контейнер OpenSSL, открытый текст неизвестен.',
      'A hex block in the Ana video at 1:16 + XOR 23 gives a repeating Spanish phrase and the piece “somb”; the second block gives “ra”. Vertical barcodes → hex → binary → pixels → QR. The Summer Games string is valid Base64 of 109 bytes with the prefix Salted__: an OpenSSL container with unknown plaintext.'),
    sources: [src('Game Detectives Wiki: Sombra ARG', 'https://wiki.gamedetectives.net/w/Sombra_ARG', 'high', T('Точные ciphertext и документация решений.', 'Exact ciphertext and solver documentation.'))],
    stages: [
      stage(T('Hex-блок Ana 1:16', 'The Ana hex block at 1:16'), T('hex → байты; XOR константой 23', 'hex → bytes; XOR with the constant 23'), T('«…la que tiene la información; tiene el poder…» + somb', '“…la que tiene la información; tiene el poder…” + somb'), 'discrepancy', T('Правило для точек и пробелов описано неполно (XOR 0x17 затронул бы и их): параметризация не определена. Полный hex в отчёте не приведён.', 'The rule for dots and spaces is incompletely described (XOR 0x17 would change them too): the parameterisation is undefined. The full hex is not in the report.')),
      stage(T('Вертикальные штрих-коды Developer Update', 'Vertical barcodes of the Developer Update'), 'barcode → hex → binary → pixels → QR', T('Испанское сообщение', 'A Spanish message'), 'noinput'),
      stage(T('Опубликованный бинарный дамп (111 групп по 16 бит)', 'The published binary dump (111 groups of 16 bits)'), T('«Группы битов → строки сетки» (12,12,13 бит; 3 группы; 3 колонки) → «Биты → изображение» → QR', 'Bit groups → grid rows (12,12,13 bits; 3 groups; 3 columns) → Bits → image → QR'), '¿Estuvo eso facilito? Ahora que tengo su atención, déjenme se las pongo más difícil.', 'verified', T('Геометрию вывели вручную из самого дампа: ведущие нули групп (4/4/3) дают 12+12+13 = 37 модулей (QR версии 5), шаблоны поиска — порядок строк (в строке текста стоят строки L, 12+L, 24+L, короткая последняя — строка 36). Ответ при подборе не использовался; авто-поиск эту геометрию сам не подбирает.', 'The geometry was derived by hand from the dump itself: the leading zeros of the groups (4/4/3) give 12+12+13 = 37 modules (QR version 5), and the finder patterns give the row order (a text line holds rows L, 12+L, 24+L; the short last line is row 36). No answer was used; Auto does not find this geometry by itself.')),
      stage('U2FsdGVkX1+vupppZksvRf5pq5g5XjFRIipRkwB0K1Y96Qsv2L…', 'Base64', T('109 байт, префикс Salted__', '109 bytes, prefix Salted__'), 'verified', T('Это не открытый текст, а контейнер OpenSSL с солью; дальше не разгадано.', 'This is not plaintext but an OpenSSL envelope with a salt; unsolved beyond it.')),
    ],
    techniques: [tech('hex → XOR', '23'), tech(T('Штрих-код → QR', 'Barcode → QR'), 'hex → binary → pixels'), tech('Base64 + OpenSSL', 'Salted__')],
    open: [T('Дальнейшее дешифрование Summer Games не решено; инструмент должен остановиться на распознанном контейнере.', 'Decrypting Summer Games further is unsolved; a tool should stop at the recognised container.'), T('Точное правило обработки пунктуации в XOR-стадии нужно восстановить из истории решения.', 'The exact punctuation handling of the XOR stage must be recovered from the solving history.')],
    presets: ['so-base64-salted'],
  });

  D.register({
    id: 'searchworld', arg: 'searchworld', title: 'Searching For a World That Doesn’t Exist',
    period: '2025–2026', platform: T('Minecraft / видео / Google Drive / PDF', 'Minecraft / video / Google Drive / PDF'),
    creators: T('Не указаны в отчётах', 'Not given in the reports'), status: T('Механизм описан; полная последовательность не опубликована', 'The mechanism is described; the full sequence is not published'),
    summary: T('За кратчайший миг инвентаря берётся первый символ названия каждого предмета, а количество предметов управляет регистром: один light block даёт «1», три zombie heads — заглавную «Z», vine — «v». Символы складываются в ссылку на Google Drive (две записи по ~100 минут и PDF).',
      'In a very brief flash of the inventory, the first character of each item name is taken and the item count controls the case: one light block gives “1”, three zombie heads give an uppercase “Z”, vine gives “v”. The characters are assembled into a Google Drive link (two recordings of about 100 minutes and a PDF).'),
    sources: [src('ARGNet', 'https://www.argn.com/2025/11/the_king_in_yellow_as_found_footage_minecraft_arg/', 'high', T('Документирует механизм, но не полный слот-за-слотом вход.', 'Documents the mechanism but not the full slot-by-slot input.'))],
    stages: [stage(T('Вспышка инвентаря', 'An inventory flash'), T('Первый символ названия; количество → регистр', 'First character of the name; count → case'), T('Google Drive URL', 'A Google Drive URL'), 'noinput', NO_INPUT + ' ' + T('Нельзя восстанавливать инвентарь из готовой ссылки.', 'The inventory must not be reconstructed from a finished link.'))],
    techniques: [tech(T('Визуальный алфавит', 'A visual alphabet'), T('slot / count → character', 'slot / count → character')), tech('Standard Galactic Alphabet', T('позднее продолжение серии', 'a later continuation of the series'))],
    open: [T('Полная последовательность inventory-токенов не опубликована текстом.', 'The full sequence of inventory tokens is not published as text.')],
    presets: [],
  });

  D.register({
    id: 'ilovebees', arg: 'ilovebees', title: 'I Love Bees',
    period: '2004', platform: T('web / GPS / таксофоны / аудио / физические носители', 'web / GPS / payphones / audio / physical media'),
    creators: T('Кампания к Halo 2', 'The Halo 2 campaign'), status: T('Исторически хорошо подтверждён; отдельного шифра нет', 'Historically well confirmed; no standalone cipher'),
    summary: T('В августе 2004 сайт опубликовал сначала 220, затем 210 GPS-позиций, потом времена. В назначенный момент соответствующий таксофон звонил; правильное кодовое слово отмечало успех и открывало новый звуковой файл.',
      'In August 2004 the site published first 220, then 210 GPS positions, then times. At the appointed moment the matching payphone rang; the right codeword marked success and released a new sound file.'),
    sources: [src('ARGNet: I Love Bees retrospective', 'https://www.argn.com/2004/12/halo_2s_i_love_bees_alternate_reality_game/', 'high', T('Современный обзор; нет одной полной тройки «координата + время + кодовое слово».', 'A contemporary overview; no single full triple “coordinate + time + codeword”.'))],
    stages: [stage(T('GPS-позиция + время', 'A GPS position + time'), T('Ответить на звонок таксофона, назвать кодовое слово', 'Answer the payphone, say the codeword'), T('Новый звуковой файл', 'A new sound file'), 'noinput', NO_INPUT)],
    techniques: [tech(T('Проверка внешним действием', 'Validation by an external action'), T('координата → время → таксофон → кодовое слово', 'coordinate → time → payphone → codeword'))],
    open: [T('Для отдельного звонка нет полной пары точных координат, времени и кодового слова.', 'There is no full pair of exact coordinates, time and codeword for a single call.')],
    presets: [],
  });
})(typeof self !== 'undefined' ? self : this);
