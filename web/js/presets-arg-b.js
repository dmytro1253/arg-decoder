// Примеры из разборов ARG, часть 2: Portal, Cicada 3301, Year Zero, Oxenfree, Inscryption, Sombra.
// Шифртексты — только из отчётов deep-research (1) и (3). Где точного шифртекста нет, примера-графа нет (см. досье).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const { Board, define, sourceNote } = G.PresetKit;

  // ---------- Portal ARG ----------
  (function portal() {
    const SRC = 'Combine OverWiki «Portal ARG»; Valve / Steam (Portal update, 2010-03-01)';
    const RELI = T('высокая для цепочки, но вторичная (фанатская реконструкция)', 'high for the chain but secondary (a fan reconstruction)');
    const b = new Board();
    const phone = b.add('input', 0, 0, { text: '(425) 822-5251' });
    const frag = b.add('input', 0, 1, { text: '9459 C6CA C8C2 03B8 128B 7CC6 3068 D4FD' });
    const joined = b.then(frag, 'op:ws_prep', { mode: 'nospace' });
    const check = b.add('op:hash_check', 2, 0, { digest: '', alg: 'auto', enc: 'utf8', lines: true, loose: true, output: 'report' });
    b.wire(phone, check, 0); b.wire(joined, check, 1);
    b.then(check, 'view');
    b.then(phone, 'op:hash_md5', { enc: 'utf8', strip: false, upper: false }, 0, 2);
    b.note(0, 3, sourceNote(
      T('MD5 не «расшифровывают»: кандидата вычисляют и сравнивают. Восемь SSTV-файлов дали куски (dinosaur18 9459, dinosaur25 C6CA, dinosaur4 C8C2, dinosaur20 03B8, dinosaur7 128B, dinosaur16 7CC6, dinosaur2 3068, dinosaur13 D4FD); после сортировки меток 1–32 получилась строка, показанная во втором вводе (порядок взят из итога в отчёте — метки отдельных картинок там не приведены). MD5 точных байтов «(425) 822-5251» (без перевода строки) совпадает с ней, и номер действительно вёл на BBS. Нижняя нода — сам хеш, посчитанный от кандидата.',
        'MD5 is not “decrypted”: a candidate is computed and compared. Eight SSTV files gave fragments (dinosaur18 9459, dinosaur25 C6CA, dinosaur4 C8C2, dinosaur20 03B8, dinosaur7 128B, dinosaur16 7CC6, dinosaur2 3068, dinosaur13 D4FD); after sorting by labels 1–32 the string in the second input resulted (the order is taken from the report’s final result, the per-image labels are not given there). The MD5 of the exact bytes “(425) 822-5251” (no newline) equals it, and the number really led to the BBS. The bottom node is the hash computed from the candidate.'),
      SRC, RELI));
    define({
      id: 'pt-md5-phone', arg: 'portal', title: T('Portal: MD5 телефона (425) 822-5251', 'Portal: MD5 of the phone (425) 822-5251'),
      desc: T('Не декодирование, а проверка кандидата хешем', 'Not decoding but verifying a candidate by hash'),
      expect: ['9459C6CAC8C203B8128B7CC63068D4FD', '9459c6cac8c203b8128b7cc63068d4fd'], expectContains: ['MATCH [MD5]'],
      manual: T('Хеш не обращается: номер телефона — гипотеза из другого артефакта, её можно только проверить вычислением.', 'A hash cannot be reversed: the phone number is a hypothesis from another artifact and can only be verified by computing.'),
    }, b);

    // dinosaur5: заявленный MD5 «фразы про quick brown fox» не совпал с классическим
    const f = new Board();
    const phrase = f.add('input', 0, 0, { text: 'The quick brown fox jumps over the lazy dog' });
    const claimed = f.add('input', 0, 1, { text: '9E107D9D372BB6821BD91D3542A419D6' });
    const fcheck = f.add('op:hash_check', 1, 0, { digest: '', alg: 'auto', enc: 'utf8', lines: true, loose: true, output: 'report' });
    f.wire(phrase, fcheck, 0); f.wire(claimed, fcheck, 1);
    f.then(fcheck, 'view');
    f.then(phrase, 'op:hash_md5', { enc: 'utf8', strip: false, upper: false }, 0, 2);
    f.note(0, 3, sourceNote(
      T('РАСХОЖДЕНИЕ ИСТОЧНИКА. dinosaur5.wav передаёт по Morse 9E107D9D372BB6821BD91D3542A419D6, и отчёт называет это «известным MD5 фразы про quick brown fox». Но MD5 классической панграммы — 9e107d9d372bb6826bd81d3542a419d6: отличаются две шестнадцатеричные цифры. Либо опечатка в транскрипции, либо другая фраза (точная фраза в отчёте не указана; здесь взята стандартная панграмма). Назначение файла — подсказать ТИП дайджеста (MD5). Исправлять строку молча нельзя.',
        'SOURCE DISCREPANCY. dinosaur5.wav carries 9E107D9D372BB6821BD91D3542A419D6 in Morse, and the report calls it “the known MD5 of the quick brown fox phrase”. But the MD5 of the classic pangram is 9e107d9d372bb6826bd81d3542a419d6: two hexadecimal digits differ. Either a transcription typo or a different phrase (the exact phrase is not given in the report; the standard pangram is used here). The file’s purpose is to hint the TYPE of digest (MD5). Do not fix the string silently.'),
      SRC, T('средняя: точная фраза и побуквенная транскрипция Morse не приведены', 'medium: the exact phrase and a letter-by-letter Morse transcription are not given')));
    define({
      id: 'pt-fox-md5', arg: 'portal', title: T('Portal: MD5 «fox» не совпадает', 'Portal: the “fox” MD5 does not match'),
      desc: T('9E107D9D…BB6821BD91D… против MD5 стандартной панграммы', '9E107D9D…BB6821BD91D… vs the MD5 of the standard pangram'),
      expect: ['9e107d9d372bb6826bd81d3542a419d6'], discrepancy: T('заявленный MD5 ≠ вычисленный для классической панграммы', 'the claimed MD5 ≠ the computed one for the classic pangram'),
      manual: T('Проверка хеша, а не расшифровка.', 'A hash check, not a decryption.'),
    }, f);
  })();

  // ---------- Cicada 3301 ----------
  (function cicada() {
    const SRC = 'github.com/aadishgoel/Cicada-3301; Boxentriq walkthrough; Wikimedia Commons (first image)';
    const s = new Board();
    const ct = s.add('input', 0, 0, { text: 'lxxt>33m2mqkyv2gsq3q=w]O2ntk' });
    const ok = s.then(ct, 'op:char_shift', { n: -4, wrap: 'none' });
    s.then(ok, 'view');
    const wrong = s.then(ct, 'op:caesar', { alpha: 'en', n: -4 }, 0, 1);
    s.then(wrong, 'view');
    s.note(0, 2, sourceNote(
      T('Из сырого содержимого JPEG: CLAVDIVS CAESAR says "lxxt>33m2mqkyv2gsq3q=w]O2ntk". Нужно вычесть 4 из КОДА КАЖДОГО символа (не только букв): верхняя ветка даёт http://i.imgur.com/m9sYK.jpg. Нижняя — обычный Цезарь −4 по алфавиту: он не трогает «>», «3», «]» и даёт мусор. Назвать это «Caesar 4» опасно. Картинка на Imgur оказалась приманкой; настоящий слой извлекался OutGuess (внешний инструмент).',
        'From the raw contents of the JPEG: CLAVDIVS CAESAR says "lxxt>33m2mqkyv2gsq3q=w]O2ntk". Subtract 4 from the CODE OF EVERY character (not only letters): the top branch gives http://i.imgur.com/m9sYK.jpg. The bottom one is an ordinary alphabetic Caesar −4: it leaves “>”, “3”, “]” alone and gives garbage. Calling it “Caesar 4” is risky. The Imgur picture was a decoy; the real layer was extracted with OutGuess (an external tool).'),
      SRC, T('высокая для конкретного преобразования', 'high for this specific transformation')));
    define({
      id: 'cic-shift', arg: 'cicada', title: T('Cicada 3301: сдвиг кода символа −4 (не Цезарь)', 'Cicada 3301: character-code shift −4 (not Caesar)'),
      desc: 'lxxt>33m2mqkyv2gsq3q=w]O2ntk → http://i.imgur.com/m9sYK.jpg', expect: ['http://i.imgur.com/m9sYK.jpg'],
      auto: { input: 'lxxt>33m2mqkyv2gsq3q=w]O2ntk', expect: 'http://i.imgur.com/m9sYK.jpg', top: 1 },
    }, s);

    const m = new Board();
    const expr = m.add('input', 0, 0, { text: '509 × 503 × 3301' });
    const product = m.then(expr, 'op:calc', { mode: 'value' });
    m.then(product, 'view');
    const fac = m.then(product, 'op:calc', { mode: 'factors' }, 0, 1);
    m.then(fac, 'view');
    m.note(0, 2, sourceNote(
      T('Книжный шифр привёл к телефону; запись назвала три простых числа, связанных с final.jpg: 3301 и размеры картинки 509 и 503 (509×503 пикселей). Их произведение 845145127 — следующий домен (845145127.com). Нижняя ветка раскладывает число обратно на простые множители. Дальше OutGuess выдал сообщение PGP: gpg: Good signature from "Cicada 3301 (845145127)".',
        'The book cipher led to a phone number; the recording named three primes tied to final.jpg: 3301 and the image dimensions 509 and 503 (509×503 pixels). Their product 845145127 is the next domain (845145127.com). The lower branch factors the number back into primes. OutGuess then yielded a PGP message: gpg: Good signature from "Cicada 3301 (845145127)".'),
      'Boxentriq walkthrough; scream314/cicada3301 (2012.md)', T('высокая для арифметики; организатор не установлен', 'high for the arithmetic; the organiser is not identified')));
    define({
      id: 'cic-math', arg: 'cicada', title: T('Cicada 3301: 509 × 503 × 3301 = 845145127', 'Cicada 3301: 509 × 503 × 3301 = 845145127'),
      desc: T('Арифметика и простые множители', 'Arithmetic and prime factors'), expect: ['845145127', '503 × 509 × 3301'],
      manual: T('Числа берутся из размеров картинки и подсказки по телефону, а не из шифртекста.', 'The numbers come from the image dimensions and the phone clue, not from a ciphertext.'),
    }, m);
  })();

  // ---------- Year Zero (нет точного шифртекста: только план) ----------
  (function yearzero() {
    const b = new Board();
    b.note(0, 0, sourceNote(
      T('У Year Zero в отчётах нет точной шифрованной строки, поэтому цепочки операций здесь нет, только карта этапов. 14 февраля 2007: USB на концерте, статика в конце трека → спектрограмма → изображение. 19 февраля: 2432.mp3, спектрограмма показывает номер 1-216-333-1810, телефон ведёт на сайт. 22 февраля: один быстрый кадр teaser → yearzero.nin.com/0024/. 7 марта: тайм-коды в видео дают буквы домена. 13 марта: файл в пакете GarageBand «Our End Trip» → номер дела 6455da04. Сведение каналов в моно дало «red horse vector», Morse дал «grace the teacher». Это результаты этапов, а не шифртексты.',
        'The reports give no exact ciphertext for Year Zero, so there is no operation chain here, only a map of the stages. 14 Feb 2007: a USB at a concert, static at the end of a track → spectrogram → an image. 19 Feb: 2432.mp3, the spectrogram shows the number 1-216-333-1810, the phone leads to a site. 22 Feb: one fast teaser frame → yearzero.nin.com/0024/. 7 Mar: timecodes in a video give the letters of a domain. 13 Mar: a file in the GarageBand package “Our End Trip” → case number 6455da04. Summing channels to mono gave “red horse vector”, Morse gave “grace the teacher”. These are stage results, not ciphertexts.'),
      'Wikipedia: Campaign timeline of Year Zero', T('высокая (хорошо сохранённая хронология)', 'high (a well-preserved timeline)')));
    b.note(1, 0, T('Что понадобится: спектрограмма (нода «Спектрограмма»), сведение каналов, покадровый просмотр видео, Morse. Загрузите свой файл через ноду «Артефакт».', 'What you will need: the spectrogram node, channel mixing, frame-by-frame video, Morse. Load your own file through the Artifact node.'));
    define({
      id: 'yz-plan', arg: 'yearzero', title: T('Year Zero: карта этапов (без шифртекста)', 'Year Zero: a stage map (no ciphertext)'),
      desc: T('Спектрограмма → номер → сайт; шифртекста в источниках нет', 'Spectrogram → number → site; no ciphertext in the sources'),
      manual: T('В источниках нет точного шифртекста: этапы идут через звук, видео и физические носители.', 'The sources give no exact ciphertext: the stages go through audio, video and physical media.'),
    }, b);
  })();

  // ---------- Oxenfree ----------
  (function oxenfree() {
    const SRC = 'Game Detectives Wiki: Oxenfree ARG';
    const RELI = T('высокая', 'high');
    const m = new Board();
    const sms = m.add('input', 0, 0, { text: '--. --- --- -.. / .-- --- .-. -.- / -.. .-.. / -... -... / .-.. .. ... - . -. / -.-. .-.. --- ... .' });
    const dec = m.then(sms, 'op:morse_decode', { lang: 'en' });
    const up = m.then(dec, 'op:case', { mode: 'upper' });
    m.then(up, 'view');
    m.note(0, 1, sourceNote(
      T('SMS на Beacon Beach. В Morse нет регистра: заглавный вид «GOOD WORK DL BB LISTEN CLOSE» — запись источника. «DL BB» прочитали как Download Beacon Beach; в скачанной версии нашлось «SEARCH TWITTER 4 NUM SEARCH TWITTER 4». В более поздней версии трека каналы несли разное: слева «DELETES NOT NEEDED PLEASE STAND BY SOS», справа «SOS KANALOA…» (нужна проверка каждого канала).',
        'An SMS at Beacon Beach. Morse has no case: the uppercase form “GOOD WORK DL BB LISTEN CLOSE” is how the source prints it. “DL BB” was read as Download Beacon Beach; the downloaded version contained “SEARCH TWITTER 4 NUM SEARCH TWITTER 4”. In a later version of the track the channels carried different messages: left “DELETES NOT NEEDED PLEASE STAND BY SOS”, right “SOS KANALOA…” (check each channel).'),
      SRC, RELI));
    define({
      id: 'ox-morse', arg: 'oxenfree', title: T('Oxenfree: Morse из SMS', 'Oxenfree: Morse from the SMS'),
      desc: T('GOOD WORK DL BB LISTEN CLOSE', 'GOOD WORK DL BB LISTEN CLOSE'), expect: ['GOOD WORK DL BB LISTEN CLOSE'],
      auto: { input: '--. --- --- -.. / .-- --- .-. -.- / -.. .-.. / -... -... / .-.. .. ... - . -. / -.-. .-.. --- ... .', expect: 'good work dl bb listen close', top: 1 },
    }, m);

    const d = new Board();
    const nums = d.add('input', 0, 0, { text: '108 101 97 118 101 32 112 111 115 115 105 98 108 101' });
    const txt = d.then(nums, 'op:dec_codes', { width: 'sep', shift: 0 });
    d.then(txt, 'view');
    d.note(0, 1, sourceNote(
      T('Атрибут alt картинки в HTML сайта Edwards Island. Десятичные байты дают строчное «leave possible»; Game Detectives печатает смысловой вид «LEAVE POSSIBLE», но регистр байтов нужно отличать от регистра источника и не менять автоматически.',
        'The alt attribute of an image in the HTML of the Edwards Island site. Decimal bytes give lowercase “leave possible”; Game Detectives prints the semantic form “LEAVE POSSIBLE”, but the case of the bytes must be told apart from the source’s case and not changed automatically.'),
      SRC, RELI));
    define({
      id: 'ox-decimal', arg: 'oxenfree', title: T('Oxenfree: десятичные байты из HTML', 'Oxenfree: decimal bytes from HTML'),
      desc: '108 101 97 … → leave possible', expect: ['leave possible'],
      auto: { input: '108 101 97 118 101 32 112 111 115 115 105 98 108 101', expect: 'leave possible', top: 1 },
    }, d);

    const a = new Board();
    const letters = a.add('input', 0, 0, { text: 'D I E L N I A I W R M R S' });
    const target = a.add('input', 0, 1, { text: 'MILNER IS WARD' });
    const chk = a.add('op:anagram_check', 1, 0, { other: '' });
    a.wire(letters, chk, 0); a.wire(target, chk, 1);
    a.then(chk, 'view');
    a.note(0, 2, sourceNote(
      T('РАСХОЖДЕНИЕ ИСТОЧНИКА. Пропущенные буквы «D I E L N I A I W R M R S» — 13 букв с тремя I, а «MILNER IS WARD» — 12 букв с двумя I: в наборе лишняя I. Сам ответ подтверждён действием: его отправили Xray, аккаунт ретвитнул, после чего началась физическая стадия на Fort Ward. Значит, лишняя I — вероятно, особенность транскрипции в источнике; её нельзя «вычищать» без оригинала.',
        'SOURCE DISCREPANCY. The missing letters “D I E L N I A I W R M R S” are 13 letters with three I’s, while “MILNER IS WARD” is 12 letters with two I’s: the set has an extra I. The answer itself was confirmed by an action: it was sent to Xray, the account retweeted it, and the physical stage at Fort Ward began. So the extra I is probably an artifact of the source’s transcription; do not “clean” it without the original.'),
      SRC, T('высокая для ответа; транскрипция букв с лишней I', 'high for the answer; the letter transcription has an extra I')));
    define({
      id: 'ox-anagram', arg: 'oxenfree', title: T('Oxenfree: анаграмма MILNER IS WARD (лишняя I)', 'Oxenfree: anagram MILNER IS WARD (an extra I)'),
      desc: T('Проверка анаграммы показывает лишнюю букву', 'The anagram check shows an extra letter'),
      expectContains: ['Extra in A (not in B): i'], discrepancy: T('в наборе букв лишняя I', 'the letter set has an extra I'),
      manual: T('Анаграмма проверяется по известному ответу из контекста; перебор без цели даёт множество слов.', 'An anagram is checked against a known answer from the context; a search without a target gives many words.'),
    }, a);
  })();

  // ---------- Inscryption ----------
  (function inscryption() {
    const SRC = T('Steam-руководство по ARG Inscryption (community master doc)', 'Steam guide to the Inscryption ARG (community master doc)');
    const RELI = T('высокая для игровых этапов', 'high for the game stages');
    const b = new Board();
    const clue = b.add('input', 0, 0, { text: 'MYCOLOG1ST12|P3RHAPS??|BLOOD$L3TT3R8OX' });
    const parts = [1, 2, 3].map((k) => b.then(clue, 'op:split_take', { sep: '|', n: k }, 0, k - 1));
    parts.forEach((p) => b.then(p, 'view'));
    const r = [b.add('input', 0, 3, { text: '918234489010' }), b.add('input', 0, 4, { text: '8339344??' }), b.add('input', 0, 5, { text: '8043!$702D!!$666' })];
    const joinNode = b.add('op:join3', 1, 4, { sep: '|' });
    r.forEach((id, i) => b.wire(id, joinNode, i));
    b.then(joinNode, 'view');
    b.note(2, 0, sourceNote(
      T('Строка из короткого кадра видео — не один шифр, а три инструкции к разным источникам: MYCOLOG1ST12 → первые 12 цифр имени Mycobot; P3RHAPS?? → фальшивая ссылка/кредит Beeper; BLOOD$L3TT3R8OX → скрытый текст 4:3 Bonelord. Нижние три ввода — то, что игроки получили в игре. Склейка через «|» — ключ: в Act 2 по Ctrl+C открывается консоль, команда «decode log.txt», затем ключ, затем «save log.txt». Дальше SE:167BP:TRU правит SaveFile.gwsave и игра выдаёт IAMLRNED2MCH (в источнике один раз встречается и «IAMLRNED2MUCH» как смысл — хранится точная форма IAMLRNED2MCH). Ключ — результат нескольких подзадач, консоль игры — проверка.',
        'The line from a short video frame is not one cipher but three instructions to different sources: MYCOLOG1ST12 → the first 12 digits of Mycobot’s name; P3RHAPS?? → a fake Beeper credit/link; BLOOD$L3TT3R8OX → hidden 4:3 Bonelord text. The three inputs below are what players obtained in the game. Joined with “|” it is the key: in Act 2, Ctrl+C opens a console, the command “decode log.txt”, then the key, then “save log.txt”. Next, SE:167BP:TRU edits SaveFile.gwsave and the game prints IAMLRNED2MCH (the source once shows “IAMLRNED2MUCH” as the meaning; the exact form IAMLRNED2MCH is kept). The key is the result of several sub-tasks, the game console is the validation.'),
      SRC, RELI));
    define({
      id: 'in-meta-key', arg: 'inscryption', title: T('Inscryption: ключ из трёх частей через «|»', 'Inscryption: a key from three parts joined with “|”'),
      desc: 'MYCOLOG1ST12|P3RHAPS??|BLOOD$L3TT3R8OX → 918234489010|8339344??|8043!$702D!!$666',
      expect: ['MYCOLOG1ST12', 'P3RHAPS??', 'BLOOD$L3TT3R8OX', '918234489010|8339344??|8043!$702D!!$666'],
      manual: T('Каждая часть добывается отдельным игровым действием, подсказку нельзя расшифровать формулой.', 'Each part is obtained by a separate game action; the clue cannot be decrypted by a formula.'),
    }, b);
  })();

  // ---------- Sombra ----------
  (function sombra() {
    const b = new Board();
    const b64 = 'U2FsdGVkX1+vupppZksvRf5pq5g5XjFRIipRkwB0K1Y96Qsv2L\nm+31cmzaAILwytX/z66ZVWEQM/ccf1g+9m5Ubu1+sit+A9cenD\nxxqkIaxbm4cMeh2oKhqIHhdaBKOi6XX2XDWpa6+P5o9MQw==';
    const inp = b.add('input', 0, 0, { text: b64 });
    const raw = b.then(inp, 'op:base64_decode', { strict: false });
    const insp = b.then(raw, 'op:openssl_inspect', {});
    b.then(insp, 'view');
    b.note(0, 1, sourceNote(
      T('Summer Games (Sombra ARG). Base64-слой верен: 109 байт, первые восемь — «Salted__». Это не расшифрованный текст, а двоичный контейнер OpenSSL с солью. Источник помечает дальнейшее как НЕ РАЗГАДАННОЕ. Правильный результат инструмента: «валидная Base64, контейнер опознан, открытый текст неизвестен» — и остановка, без угадывания.',
        'Summer Games (Sombra ARG). The Base64 layer is valid: 109 bytes, the first eight are “Salted__”. This is not decrypted text but a binary OpenSSL envelope with a salt. The source marks the rest as UNSOLVED. The right tool result is “valid Base64, container recognised, plaintext unknown” and a stop, with no guessing.'),
      'Game Detectives Wiki: Sombra ARG', T('высокая для Base64-слоя; дальше не разгадано', 'high for the Base64 layer; unsolved beyond it')));
    define({
      id: 'so-base64-salted', arg: 'sombra', title: T('Sombra: Base64 → Salted__ (не разгадано)', 'Sombra: Base64 → Salted__ (unsolved)'),
      desc: T('Стоп на контейнере OpenSSL, а не «магическая расшифровка»', 'Stop at the OpenSSL container, not a “magic decrypt”'),
      expectContains: ['Salted__', 'Total bytes: 109'],
      manual: T('Двоичный контейнер OpenSSL: нужен пароль, которого в источниках нет. Авто-поиск не должен выдавать «ответ».', 'A binary OpenSSL container: it needs a password that the sources do not give. Auto must not claim an “answer”.'),
    }, b);
  })();
})(typeof self !== 'undefined' ? self : this);
