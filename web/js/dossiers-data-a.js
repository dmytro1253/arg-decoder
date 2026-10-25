// Встроенные досье, часть 1: OldRoot, HERMatrix, AlphaVer, Endermite, Archive11, Portal.
// Факты — только из отчётов deep-research (1) и (3). Расхождения и пробелы источников названы прямо.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const D = G.Dossiers;
  const src = (name, url, reliability, note) => ({ name, url, reliability, note });
  const stage = (artifact, technique, result, status, note) => ({ artifact, technique, result, status: status || 'verified', note: note || '' });
  const tech = (name, example) => ({ name, example });

  D.register({
    id: 'oldroot', arg: 'oldroot', title: 'OldRoot Mystery',
    period: '2014–2016', platform: 'Minecraft + Reddit / Imgur / SoundCloud / Tumblr / web',
    creators: T('Псевдоним OldRoot; реальная личность не установлена', 'The pseudonym OldRoot; the real identity is not established'),
    status: T('Поздняя цепочка частично не разгадана', 'The late chain is partly unsolved'),
    summary: T('Первая публикация — 11 июля 2014 года. Создатель позже писал, что хотел «code based ARG» с собственными кодами, которые нельзя решить одним сайтом-декодером. Цепочка идёт через яркость изображения, аудио-спектрограмму, исходный код страницы, Morse, Цезарь, Виженер, двоичные и числовые слои.',
      'The first publication was on 11 July 2014. The creator later wrote that the goal was a “code based ARG” with custom codes that no single decoder site solves. The chain runs through image brightness, an audio spectrogram, page source, Morse, Caesar, Vigenère, and binary and numeric layers.'),
    sources: [
      src(T('Write-up и история (gist Voltasalt)', 'Write-up and history (Voltasalt gist)'), 'https://gist.github.com/Voltasalt/ac431e32f1667e914897', 'high', T('Современный решению журнал; точные строки.', 'A log contemporary with the solving; exact strings.')),
      src(T('Заключение создателя (r/OldRoot)', 'Creator’s conclusion (r/OldRoot)'), 'https://www.reddit.com/r/OldRoot/comments/5f2zhh/conclusion/', 'high', T('Подтверждает замысел и публикует финальный числовой код без объяснения правила.', 'Confirms the intent and publishes the final numeric code without explaining the rule.')),
      src(T('Продолжение сообщества: финальный код', 'Community follow-up: the final code'), 'https://www.reddit.com/r/OldRoot/comments/ne2rd8/all_of_the_dots_are_finally_starting_to_connect/', 'mid-high', T('Связывает финальную строку с modulo-26 решением.', 'Ties the final string to the modulo-26 solution.')),
      src(T('Ретроспектива r/OldRoot', 'r/OldRoot retrospective'), '', 'mid-high', T('Богата деталями, но старые ссылки и транскрипции могут содержать ошибки.', 'Rich in detail, but old links and transcriptions may contain errors.')),
    ],
    stages: [
      stage(T('Очень тёмный скриншот Minecraft', 'A very dark Minecraft screenshot'), T('Повысить яркость', 'Raise brightness'), T('Прозрачная ссылка на SoundCloud «it has begun»', 'A faint SoundCloud link “it has begun”')),
      stage('WAV', T('Спектрограмма', 'Spectrogram'), 'silentraven', 'verified', T('То же слово найдено паролем в исходном HTML защищённой страницы: независимая проверка повторным использованием.', 'The same word was found as a password in the HTML source of a protected page: an independent reuse check.')),
      stage('ZH DUH ZDLWLQJ', T('Цезарь −3 (ROT23 вперёд)', 'Caesar −3 (ROT23 forward)'), 'WE ARE WAITING', 'verified', T('Рядом Morse давал OLDROOT, а fm3Yw0b — суффикс Imgur (регистр важен).', 'Morse next to it gave OLDROOT, and fm3Yw0b was an Imgur suffix (case matters).')),
      stage('WUDSSHG LQ D SULVRQ RI ZRRG', T('Цезарь −3', 'Caesar −3'), 'TRAPPED IN A PRISON OF WOOD', 'verified', T('Строка из whitelist-заявки.', 'A line from a whitelist application.')),
      stage('jXz4y07.png', T('Яркость → семь строк двоичного кода; неразборчивые строки перебирали программно с условием «валидный Imgur ID»', 'Brightness → seven binary lines; unreadable lines were brute-forced under the constraint “a valid Imgur ID”'), 'dDbhUzA', 'noinput', T('Точные двоичные строки в источниках отсутствуют.', 'The exact binary lines are not in the sources.')),
      stage(T('Числа после ещё одного высветления', 'Numbers after another brightening'), 'octal → hex → Base32 → ASCII', 'ozTMBqT', 'noinput', T('Результат известен, исходные числа не опубликованы.', 'The result is known; the source numbers are not published.')),
      stage('JSH ALWE PROIR ELR DRWE FRIFVP XUS WYEYES', T('Виженер, ключ LENORE', 'Vigenère, key LENORE'), 'YOU MUST LEARN THE PAST BEUORE THE FUTURE', 'discrepancy', T('Write-up приводит BEFORE; стандартный расчёт даёт BEUORE. Нужна повторная транскрипция оригинала.', 'The write-up prints BEFORE; the standard computation gives BEUORE. The original must be re-transcribed.')),
      stage('27 12 12 15 6 20 … 4 9 14 7 19 15 13 21 3 8?', T('A1Z26, продлённый по модулю 26 (27→A, 30→D)', 'A1Z26 extended modulo 26 (27→A, 30→D)'), 'ALL OF THE DOTS ARE FINALLY STARTING TO CONNECT, WHO KNEW DOLPHINS WERE HIDING SO MUCH?', 'hypothesis', T('Арифметика проверена; замысел автора (именно modulo) не доказан.', 'The arithmetic is verified; the author’s intent (modulo specifically) is unproven.')),
    ],
    techniques: [
      tech(T('Яркость / уровни', 'Brightness / levels'), T('почти чёрная картинка → скрытая ссылка', 'a nearly black picture → a hidden link')),
      tech(T('Спектрограмма', 'Spectrogram'), 'WAV → silentraven'),
      tech(T('Цезарь −3', 'Caesar −3'), 'ZH DUH ZDLWLQJ → WE ARE WAITING'),
      tech(T('Виженер', 'Vigenère'), 'LENORE'),
      tech(T('Числа по модулю 26', 'Numbers modulo 26'), '27 → A, 30 → D'),
      tech(T('Исходный код страницы', 'Page source'), T('пароль внутри HTML', 'a password inside the HTML')),
      tech(T('Ограниченный перебор', 'Constrained brute force'), T('неразборчивые биты + условие «валидный Imgur ID»', 'unreadable bits + the constraint “a valid Imgur ID”')),
    ],
    open: [
      T('Поздние части ARG остаются неполными; нового подтверждённого прогресса в ключевых ветвях не отмечено.', 'The late parts of the ARG stay incomplete; no new confirmed progress in the key branches is recorded.'),
      T('LENORE: BEUORE против BEFORE — нужна повторная побуквенная транскрипция изображения.', 'LENORE: BEUORE vs BEFORE — the image needs a fresh letter-by-letter transcription.'),
      T('Правило modulo-26 для 27 и 30 автором не объявлено; значения могут нести скрытый смысл — не установлено.', 'The author never declared the modulo-26 rule for 27 and 30; the values may carry a hidden meaning — not established.'),
      T('octal → hex → Base32: точные исходные числа неизвестны.', 'octal → hex → Base32: the exact source numbers are unknown.'),
    ],
    presets: ['or-caesar-waiting', 'or-caesar-prison', 'or-lenore', 'or-modular'],
  });

  D.register({
    id: 'hermatrix', arg: 'hermatrix', title: 'HERMatrix',
    period: '2021', platform: 'Hermitcraft Season 8 / Minecraft + web (hermatrix.net)',
    creators: T('Docm77 и Rendog (при участии других Hermits в подсказках)', 'Docm77 and Rendog (with other Hermits in the clues)'),
    status: T('Криптографический слой решён и принят терминалом', 'The cryptographic layer is solved and accepted by the terminal'),
    summary: T('Ранняя фаза: QR-код в видео ведёт на hermatrix.net, ввод #FFFFFF8 останавливает меняющиеся символы и показывает координаты 1534 21 -266. Позже имена спасённых аксолотлей дали LMVCCIKB; ключ LUCY и подсказка «Vigenere» + «Cipher» (коза и попугай) привели к слову ASTEROID, которое открыло Hermitheus Defence Array.',
      'Early phase: a QR code in a video leads to hermatrix.net, entering #FFFFFF8 stops the changing symbols and shows the coordinates 1534 21 -266. Later the names of rescued axolotls gave LMVCCIKB; the key LUCY and the hint “Vigenere” + “Cipher” (a goat and a parrot) led to the word ASTEROID, which opened the Hermitheus Defence Array.'),
    sources: [
      src('r/HermitCraft: HERMatrix ARG Episode 4', 'https://www.reddit.com/r/HermitCraft/comments/ohj6et/hermatrix_arg_episode_4/', 'high', T('Точный шифртекст, ключ и принятие результата терминалом.', 'The exact ciphertext, key and acceptance by the terminal.')),
      src(T('Комментарий Docm77', 'Docm77’s comment'), '', 'high', T('Подтверждает авторство Doc и Ren.', 'Confirms the authorship of Doc and Ren.')),
    ],
    stages: [
      stage(T('QR в видео', 'A QR in a video'), T('QR-ридер → веб-терминал hermatrix.net', 'QR reader → the hermatrix.net web terminal'), 'hermatrix.net'),
      stage('#FFFFFF8', T('Ввод на сайте', 'Typed into the site'), '1534 21 -266', 'verified', T('Координаты проверены на seed Hermitcraft S8: район базы Xisuma.', 'The coordinates were checked on the Hermitcraft S8 seed: near Xisuma’s base.')),
      stage('K, C, C, V, L, I, M, B → LMVCCIKB', T('Порядок букв по видео Xisuma', 'The letter order from Xisuma’s video'), 'LMVCCIKB'),
      stage('LMVCCIKB', T('Виженер, P = C − K, ключ LUCY', 'Vigenère, P = C − K, key LUCY'), 'ASTEROID', 'verified', T('Введено в терминал HDA и открыло следующий узел — сильная независимая проверка. Первичный артефакт, давший ключ LUCY, слабо задокументирован.', 'Typed into the HDA terminal and opened the next node — a strong independent check. The primary artifact that gave the key LUCY is poorly documented.')),
    ],
    techniques: [tech('QR', '→ hermatrix.net'), tech(T('Координаты', 'Coordinates'), '1534 21 -266'), tech(T('Виженер', 'Vigenère'), 'LMVCCIKB + LUCY → ASTEROID')],
    open: [
      T('Происхождение ключа LUCY: первичный артефакт не найден (статус: «известен из решения»).', 'Where the key LUCY came from: the primary artifact is missing (status: “known from the solution”).'),
      T('Гипотеза о redstone/note blocks решателями не подтверждена: часть увиденного оказалась особенностью resource pack.', 'The redstone/note-block hypothesis was not confirmed: part of what was seen was a resource pack feature.'),
      T('Не перебирайте веб-форму силой: ARG задуман как загадка по подсказкам, а не по числу запросов.', 'Do not brute-force the web form: the ARG is a clue puzzle, not a request-count one.'),
    ],
    presets: ['hm-vigenere'],
  });

  D.register({
    id: 'alphaver', arg: 'alphaver', title: 'AlphaVer / Minecraft Alpha 1.0.16 Versions',
    period: '2021–2022', platform: T('Minecraft-подобная вымышленная сборка + JAR / RAR / YouTube', 'A Minecraft-like fictional build + JAR / RAR / YouTube'),
    creators: T('«Lead dev» упомянут в файле 39_0.txt; имя не указано', '“lead dev” is mentioned in the file 39_0.txt; no name is given'),
    status: T('Документирован фанатским репозиторием; PH2-путь не воспроизводится', 'Documented by a fan repository; the PH2 path is not reproducible'),
    summary: T('Вымышленный web-сериал/ARG о закрытой ветви Alpha 1.0.16. Первые публикации — август 2021. Главное правило: строки вроде 9b4c383a911ec выглядят как hex, но это токены для особого блока Input Block ID 120. Ввод первых трёх кодов приводит к появлению в Minecraft log пароля к PH1.rar.',
      'A fictional web series/ARG about a closed branch of Alpha 1.0.16. The first posts are from August 2021. The key rule: strings like 9b4c383a911ec look like hex but are tokens for a special block, Input Block ID 120. Entering the first three codes makes a password for PH1.rar appear in the Minecraft log.'),
    sources: [
      src(T('Репозиторий AlphaVer (NexTre-dev)', 'AlphaVer repository (NexTre-dev)'), 'https://github.com/NexTre-dev/alphaver', 'mid-high', T('Подробный, но фанатский архив, не официальный канал автора.', 'A detailed but fan archive, not the author’s official channel.')),
      src('lore/codes.md', 'https://github.com/NexTre-dev/alphaver/blob/main/lore/codes.md', 'mid-high', T('Говорит «8 кодов», нумерует 0…8, позиции 5 и 8 помечены unknown — внутренняя несогласованность.', 'Says “8 codes”, numbers 0…8, and positions 5 and 8 are marked unknown — an internal inconsistency.')),
      src('resources/lilypad-analyzation.md', 'https://github.com/NexTre-dev/alphaver/blob/main/resources/lilypad-analyzation.md', 'mid-high', ''),
    ],
    stages: [
      stage('9b4c383a911ec / b7c21f611ea08 / f69d58d25d950', T('Ввести как ТОКЕНЫ в Input Block ID 120 (игровое действие, не декодирование)', 'Enter as TOKENS into Input Block ID 120 (a game action, not decoding)'), 'ab99d76f9a4c41a0f3591b122bbc985c (Minecraft log)', 'verified', T('Никакого hex→ASCII между шагами нет; точный алгоритм блока не установлен.', 'There is no hex→ASCII between the steps; the block’s exact algorithm is not established.')),
      stage('PH1.rar', T('Открыть архив паролем из лога (регистр не менять)', 'Open the archive with the password from the log (do not change case)'), 'stdout.txt → YouTube URL'),
      stage('ly.class (client JAR)', T('Декомпиляция', 'Decompiling'), 'imgur9F0A3un → Imgur 9F0A3un'),
      stage('World 2', T('Координаты столба', 'Coordinates of a pillar'), '392 98 -356'),
      stage(T('Остальные Input Block', 'The other Input Block codes'), T('Ввод всех кодов → PH2.rar', 'Entering all codes → PH2.rar'), 'c74329a1…19ab', 'noinput', T('Позиции 5 и 8 неизвестны: PH2-путь по таблице не воспроизводится.', 'Positions 5 and 8 are unknown: the PH2 path cannot be reproduced from the table.')),
    ],
    techniques: [tech(T('Hex-подобные токены', 'Hex-like tokens'), T('НЕ декодировать как hex', 'do NOT decode as hex')), tech(T('Пароль-архив', 'Archive password'), 'PH1.rar'), tech(T('Декомпиляция JAR', 'JAR decompiling'), 'imgur9F0A3un'), tech(T('Координаты', 'Coordinates'), '392 98 -356')],
    open: [
      T('Алгоритм Input Block ID 120 (три токена → пароль) в документах не установлен — нельзя описывать его как MD5 от токенов.', 'The Input Block ID 120 algorithm (three tokens → a password) is not established — it must not be described as an MD5 of the tokens.'),
      T('PH2-путь: точный вход недоступен, воспроизводимый прогон невозможен.', 'The PH2 path: the exact input is unavailable, a reproducible run is impossible.'),
      T('Нужны разные типы данных: hex-байты, hex-подобный идентификатор, хеш-дайджест, пароль из hex-символов.', 'Different data types are needed: hex bytes, a hex-like identifier, a hash digest, a password made of hex characters.'),
    ],
    presets: ['av-token-not-hex', 'av-imgur'],
  });

  D.register({
    id: 'endermite', arg: 'endermite', title: 'Endermite / Jimmy',
    period: '2026', platform: 'Minecraft + latest.log / video / Google Drive / r/MinecraftARGs',
    creators: T('Reddit-аккаунт Kiwuthegamer назвал себя создателем; личность не установлена', 'The Reddit account Kiwuthegamer called itself the creator; the identity is not established'),
    status: T('ARG на момент треда продолжался; рабочее название дано по ключевому слову', 'The ARG was still running at the time of the thread; the working name comes from the keyword'),
    summary: T('Облака разной высоты читаются как регистр букв Drive-ссылки; в latest.log — мод raqrezvgr (ROT13 = endermite), hex 73746f70 (stop) и 41414141 (AAAA), wfvwjealw (сдвиг +8 = endermite). Ключ ENDERMITE открывает две строки из видео: help me please и LET ME FREE.',
      'Clouds of different heights read as the letter case of a Drive link; latest.log holds a mod raqrezvgr (ROT13 = endermite), hex 73746f70 (stop) and 41414141 (AAAA), and wfvwjealw (shift +8 = endermite). The key ENDERMITE opens two lines from the video: help me please and LET ME FREE.'),
    sources: [
      src('r/MinecraftARGs: Endermite/Jimmy thread', 'https://www.reddit.com/r/MinecraftARGs/comments/1ssbswe/yall_need_to_get_on_this_arg_looking_for_help_to/', 'mid-high', T('Точные строки есть, создатель присутствует в треде; ARG ещё шёл.', 'Exact strings are present and the creator is in the thread; the ARG was still running.')),
    ],
    stages: [
      stage(T('Знак «drive», облака high/low', 'A “drive” sign, high/low clouds'), T('Высокие = заглавные, низкие = строчные', 'High = uppercase, low = lowercase'), T('Drive-URL (регистр важен)', 'A Drive URL (case matters)'), 'noinput', T('Точной последовательности облаков в источнике нет.', 'The exact cloud sequence is not in the source.')),
      stage('raqrezvgr 0.0.3-beta1', 'ROT13', 'endermite'),
      stage('wfvwjealw', T('Цезарь +8 (= −18)', 'Caesar +8 (= −18)'), 'endermite', 'verified', T('Источник говорит «shifted 18» — зависит от направления; нужны обе формы.', 'The source says “shifted 18” — direction-dependent; both forms are needed.')),
      stage('73746f70 / 41414141', 'hex → ASCII', 'stop / AAAA'),
      stage('lrot dq xeiefh', T('Стандартный Виженер, ключ ENDERMITE', 'Standard Vigenère, key ENDERMITE'), 'help me please', 'discrepancy', T('Решатель назвал «Variant Beaufort»; точно получается Виженер. Beaufort даёт twpl ow lpwaiw, Variant — perx uc fxmisk.', 'The solver called it “Variant Beaufort”; the exact result is Vigenère. Beaufort gives twpl ow lpwaiw, Variant gives perx uc fxmisk.')),
      stage('PRW QV RZXI', T('Стандартный Виженер, ключ ENDERMITE', 'Standard Vigenère, key ENDERMITE'), 'LET ME FREE', 'discrepancy', T('Тот же спор о названии метода.', 'The same dispute about the method name.')),
      stage(T('Конец видео', 'The end of the video'), T('Спектрограмма четырёх сигналов', 'Spectrogram of four beeps'), 'PG56', 'unresolved', T('Следующее преобразование не найдено.', 'The next transformation is not found.')),
      stage(T('3:45 видео: 14 строк по семь символов', '3:45 of the video: 14 strings of seven characters'), '?', '?', 'unresolved', T('Функция не установлена.', 'The function is not established.')),
    ],
    techniques: [tech('ROT13', 'raqrezvgr → endermite'), tech(T('Цезарь с направлением', 'Caesar with direction'), 'wfvwjealw: +8 / −18'), tech('hex → ASCII', '73746f70 → stop'), tech(T('Виженер', 'Vigenère'), 'ENDERMITE'), tech(T('Коды § в логе', '§ codes in the log'), '§k … §r'), tech(T('Спектрограмма', 'Spectrogram'), 'PG56')],
    open: [
      T('PG56 и 14 семисимвольных строк: связь и следующая операция не найдены; попытки читать их как числа/YouTube ID не удались.', 'PG56 and the 14 seven-character strings: the link and the next operation are not found; reading them as numbers/YouTube IDs failed.'),
      T('Название метода в треде («Variant Beaufort») неточно — программа должна показывать формулу.', 'The method name in the thread (“Variant Beaufort”) is inaccurate — a tool must show the formula.'),
    ],
    presets: ['em-rot13', 'em-hex', 'em-shift-direction', 'em-vigenere', 'em-log', 'em-frames-unsolved'],
  });

  D.register({
    id: 'archive11', arg: 'archive11', title: 'Archive11',
    period: T('≈2025 (дата запуска не установлена)', '≈2025 (the launch date is not established)'), platform: 'Minecraft YouTube',
    creators: T('Канал Archive11; автор не установлен', 'The Archive11 channel; the author is not established'),
    status: T('Малый ARG; подтверждены лишь два hex-слоя', 'A small ARG; only two hex layers are confirmed'),
    summary: T('Канал примерно с 40 подписчиками: видео Archive_# и Archive.Recover#, отключённые комментарии, скрытый плейлист archive.missing1. Воспроизводимы только 476F6E65 → Gone и 616C6C → all.',
      'A channel with about 40 subscribers: videos Archive_# and Archive.Recover#, disabled comments, a hidden playlist archive.missing1. Only 476F6E65 → Gone and 616C6C → all are reproducible.'),
    sources: [src('r/Minecraft: «Found a low-profile ARG»', 'https://www.reddit.com/r/Minecraft/comments/1o0wslm/found_a_lowprofile_arg_in_minecraft_youtube_videos/', 'low-mid', T('Единственное обсуждение; точный hex воспроизводим, общий нарратив слабо подтверждён.', 'The only discussion; the exact hex is reproducible, the overall narrative is weakly confirmed.'))],
    stages: [
      stage(T('Конец первого видео скрытого плейлиста', 'The end of the first video of the hidden playlist'), 'hex → ASCII', '476F6E65 → Gone'),
      stage(T('Изображение плейлиста', 'The playlist image'), 'hex → ASCII', '616C6C → all'),
      stage(T('Другие зашифрованные описания', 'Other encrypted descriptions'), '?', T('«Just archived. Everything and everyone» (смысл)', '“Just archived. Everything and everyone” (the meaning)'), 'noinput', T('Точный вход недоступен; воспроизводимый прогон невозможен.', 'The exact input is unavailable; a reproducible run is impossible.')),
    ],
    techniques: [tech('hex → ASCII', '476F6E65 → Gone'), tech(T('Нумерация архивов', 'Archive numbering'), 'Archive_#'), tech(T('Скрытый плейлист', 'A hidden playlist'), 'archive.missing1')],
    open: [T('Общий финал ARG не установлен.', 'The overall ending is not established.'), T('Гипотеза, что скриншоты «могут содержать координаты», — не факт.', 'The idea that screenshots “may contain coordinates” is a hypothesis, not a fact.')],
    presets: ['a11-hex'],
  });

  D.register({
    id: 'portal', arg: 'portal', title: 'Portal ARG',
    period: '2010', platform: T('Portal + файлы игры + телефонная BBS', 'Portal + game files + a telephone BBS'),
    creators: T('Команда разработчиков Portal 2 / Valve', 'The Portal 2 development team / Valve'),
    status: T('Завершён; исторический BBS-эндпойнт больше нельзя считать доступным', 'Finished; the historical BBS endpoint can no longer be assumed reachable'),
    summary: T('1 марта 2010 Valve выпустила обновление Portal с одной строкой в changelog — изменением частоты радио. В игре появились 26 радио (dinosaur1…26.wav): Morse и SSTV. Восемь SSTV-файлов дают 32 hex-символа, MD5 телефона (425) 822-5251; номер ведёт на BBS «GLaDOS», логин backup/backup.',
      'On 1 March 2010 Valve released a Portal update with one changelog line about a radio frequency change. The game gained 26 radios (dinosaur1…26.wav): Morse and SSTV. Eight SSTV files give 32 hex characters, the MD5 of the phone (425) 822-5251; the number leads to the “GLaDOS” BBS, login backup/backup.'),
    sources: [
      src(T('Valve / Steam: обновление Portal', 'Valve / Steam: the Portal update'), '', 'very-high', T('Подтверждает дату и триггер ARG; полной цепочки решения не содержит.', 'Confirms the date and trigger; holds no full solver chain.')),
      src('Combine OverWiki: Portal ARG', 'https://combineoverwiki.net/wiki/Portal_ARG', 'high', T('Очень подробно, но вторично; сама страница просит правки.', 'Very detailed but secondary; the page itself asks for cleanup.')),
    ],
    stages: [
      stage('dinosaur2/4/7/13/16/18/20/25.wav', T('SSTV; 4 картинки на файл; сортировка меток 1–32', 'SSTV; 4 pictures per file; sorting labels 1–32'), '9459 C6CA C8C2 03B8 128B 7CC6 3068 D4FD', 'verified', T('Порядок в нашем примере взят из итога отчёта.', 'The order in our example is taken from the report’s result.')),
      stage('(425) 822-5251', T('MD5 точных байтов, без перевода строки', 'MD5 of the exact bytes, no newline'), '9459C6CAC8C203B8128B7CC63068D4FD', 'verified', T('Хеш не «расшифровывают»: кандидата считают и сравнивают.', 'A hash is not “decrypted”: a candidate is computed and compared.')),
      stage('dinosaur5.wav', T('Morse → MD5-подсказка типа дайджеста', 'Morse → an MD5 digest-type hint'), '9E107D9D372BB6821BD91D3542A419D6', 'discrepancy', T('MD5 стандартной панграммы — 9e107d9d372bb6826bd81d3542a419d6; две цифры отличаются. Точная фраза в отчёте не названа.', 'The MD5 of the standard pangram is 9e107d9d372bb6826bd81d3542a419d6; two digits differ. The exact phrase is not named in the report.')),
      stage('dinosaur12.wav', 'Morse', 'backup / backup', 'noinput', T('Точная Morse-строка в отчёте не приведена.', 'The exact Morse string is not in the report.')),
      stage(T('Подчёркнутые символы в сообщении Valve', 'Underlined characters in Valve’s message'), T('Перестановка букв', 'Letter reordering'), 'drattmann / h0nee', 'noinput'),
      stage(T('Поддельный BSOD', 'A fake BSOD'), 'hex → EBCDIC', 'SUSPENDUNTILEEE', 'noinput', T('Полный hex рядом с результатом не напечатан.', 'The full hex is not printed next to the result.')),
    ],
    techniques: [tech('Morse', 'dinosaur12.wav'), tech('SSTV', '8 × dinosaurN.wav'), tech(T('Проверка MD5-кандидата', 'MD5 candidate check'), '(425) 822-5251'), tech('QBasic / EBCDIC', 'Cooperative Trial Completed')],
    open: [T('Отчёт называет 9E107D9D…BB6821BD91D… «известным MD5 фразы про quick brown fox», но он не совпадает с MD5 классической панграммы — опечатка или другая фраза.', 'The report calls 9E107D9D…BB6821BD91D… “the known MD5 of the quick brown fox phrase”, but it does not equal the MD5 of the classic pangram: a typo or another phrase.'), T('Метки отдельных SSTV-картинок 1–32 не приведены.', 'The labels 1–32 of the individual SSTV pictures are not given.')],
    presets: ['pt-md5-phone', 'pt-fox-md5'],
  });
})(typeof self !== 'undefined' ? self : this);
