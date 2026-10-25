// Примеры с картинками: SGA-фото из кейса mslan и тёмный кадр с почти невидимой строкой цифр.
// Картинка подставляется при открытии (params.sample → js/samples.js), поэтому авто-поиск к ним не применим.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const { Board, sourceNote } = G.PresetKit;
  const GROUP = T('Картинки: SGA и OCR', 'Images: SGA and OCR');
  const MANUAL = T('Нужна картинка: распознавание идёт по пикселям, авто-поиск работает только с текстом',
    'Needs an image: recognition works on pixels, the auto search only works on text');

  function push(spec, board) {
    G.Presets.push({ id: spec.id, group: GROUP, title: spec.title, desc: spec.desc, nodes: board.nodes, links: board.links,
      profile: 'mslan', expect: spec.expect, manual: spec.manual || MANUAL });
  }

  function sgaPhoto(id, sample, title, latin, answer, where) {
    const b = new Board();
    const img = b.add('artifact', 0, 0, { sample });
    const ru = b.then(img, 'img_sga', { output: 'ru' });
    b.then(ru, 'view');
    b.note(0, 1, sourceNote(
      T('SGA (шрифт стола зачарований) кодирует латиницу буква в букву. Нода режет картинку на строки, переводит их в сетку пикселей шрифта и подбирает шаблоны. Получается «' + latin + '»: это русский текст, набранный в английской раскладке, поэтому выход переключён на «кириллица (ЙЦУКЕН)». Рамки на картинке: зелёные — уверенные знаки. ' + where,
        'SGA (the enchanting table font) maps Latin letters one to one. The node cuts the image into lines, turns them into a font pixel grid and matches templates. The result is “' + latin + '”: Russian typed on an English layout, so the output is switched to “Cyrillic (ЙЦУКЕН)”. Boxes on the image: green means a confident glyph. ' + where),
      T('Telegram-канал автора (кейс mslan)', 'the author’s Telegram channel (mslan case)'),
      T('высокая: все знаки распознаны с уверенностью ≥ 90%', 'high: every glyph is recognised with ≥ 90% confidence')));
    push({ id, title, desc: latin.split('\n')[0] + ' → ' + answer.split('\n')[0], expect: [answer] }, b);
  }

  sgaPhoto('img-sga-poem', 'sga-poem', T('SGA-фото: «пьеса подходит к финальному акту»', 'SGA photo: “the play nears its final act”'),
    'gmtcf gjl[jlbn r abyfkmyjve frne',
    'пьеса подходит к финальному акту\nскоро я уравновешу чаши весов\nсердце тьмы зовёт тебя\nследуй за красным цветком', // i18n-ok: текст с картинки
    T('Четыре строки, 94 знака.', 'Four lines, 94 glyphs.'));
  sgaPhoto('img-sga-key', 'sga-key', T('SGA-фото: «ключ разбит на три части»', 'SGA photo: “the key is split into three parts”'),
    'nt,t ye;ty kbim rk.x',
    'тебе нужен лишь ключ\nон разбит на три части\nудачи', // i18n-ok: текст с картинки
    T('Тёмный фон с силуэтом: бинаризация по Отсу отделяет знаки от фона.', 'A dark background with a silhouette: Otsu binarisation separates the glyphs from the background.'));

  // Тёмный кадр: строка цифр в небе почти сливается с фоном (яркость 13–17 при фоне 9).
  (function vrfneo() {
    const b = new Board();
    const img = b.add('artifact', 0, 0, { sample: 'vrfneo' });
    const lift = b.then(img, 'img_adjust', { lift: 90, auto: 'levels' });
    const ocr = b.then(lift, 'img_ocr', { engine: 'tesseract', lang: 'eng', digits: true, preset: 'denoise', rx: 100, ry: 46, rw: 770, rh: 36 });
    const pairs = b.then(ocr, 'op:dec_codes', { width: '2', shift: 23 });
    const url = b.then(pairs, 'op:url_decode', { enc: 'cp1251', plus: true });
    const leet = b.then(url, 'op:ru_leet', { mode: 'phonetic' });
    b.then(leet, 'view');
    b.note(0, 1, sourceNote(
      T('Вверху кадра есть строка цифр, которую глазом почти не видно. 1) «Поднять тени» и автоуровни вытягивают её из черноты. 2) OCR (tesseract, только цифры) читает выделенную область — нажми «Распознать» в ноде. 3) Дальше обычная цепочка кейса: пары цифр +23 → %-коды CP1251 → русский латиницей → «тЫ Не СпАсешЬ НХ».',
        'At the top of the frame there is a line of digits the eye can barely see. 1) “Shadow lift” and auto-levels pull it out of the black. 2) OCR (tesseract, digits only) reads the selected region: press “Recognise” in the node. 3) Then the usual chain of the case: digit pairs +23 → CP1251 %-codes → Russian in Latin letters → “тЫ Не СпАсешЬ НХ”.'),
      T('картинка из кейса mslan; строка совпадает с примером «Пары +23 → CP1251 → русский латиницей»', 'an image from the mslan case; the line matches the example “Pairs +23 → CP1251 → Russian in Latin”'),
      T('высокая для цифр; OCR может ошибиться в одной-двух цифрах — сверяй с примером', 'high for the digits; OCR may miss a digit or two, so compare with that example')));
    push({
      id: 'img-vrfneo', title: T('Тёмный кадр: осветлить → OCR → пары +23', 'Dark frame: brighten → OCR → pairs +23'),
      desc: T('Почти невидимые цифры в небе → «тЫ Не СпАсешЬ НХ»', 'Barely visible digits in the sky → “тЫ Не СпАсешЬ НХ”'),
      expect: ['тЫ Не СпАсешЬ НХ'], // i18n-ok: ответ шифра
      manual: T('Нужна картинка и запуск OCR кнопкой «Распознать»; сами цифры авто-поиск решает (пример ru-leet)',
        'Needs the image and an OCR run with the Recognise button; the digits themselves are solved by the auto search (the ru-leet example)'),
    }, b);
  })();

  // Страница книги: OCR читает пять строк цифр, авто-поиск сам склеивает их в одну и находит ссылку.
  (function bookDigits() {
    const b = new Board();
    const img = b.add('artifact', 0, 0, { sample: 'book-digits' });
    const ocr = b.then(img, 'img_ocr', { engine: 'auto', lang: 'eng', digits: true, preset: 'auto', lines: 'keep', rx: 370, ry: 122, rw: 480, rh: 190 });
    b.then(ocr, 'view');
    b.then(ocr, 'auto', { depth: '3' }, 0, 1);
    b.note(0, 1, sourceNote(
      T('Книга в игре: на странице длинное число, перенесённое на пять строк. 1) OCR (только цифры) читает выделенную область — нажми «Распознать». Значок ↵ в выводе — это только показ переноса строки, в данных его нет. 2) Авто-поиск видит, что строки — одно перенесённое число, склеивает их сам и решает: пары цифр → +23 → URL → ссылка Catbox. Если нужна сразу одна строка, в OCR есть «Строки на выходе: склеить в одну».',
        'An in-game book: the page holds a long number wrapped over five lines. 1) OCR (digits only) reads the selected region: press Recognise. The ↵ sign in the output only shows a line break; it is not in the data. 2) Auto sees that the lines are one wrapped number, joins them by itself and solves it: digit pairs → +23 → URL → a Catbox link. For a single line straight away, OCR has “Lines in the output: join into one”.'),
      T('кейс mslan, снимок экрана книги (прислан для тестов программы)', 'the mslan case, a screenshot of the book (sent for the program tests)'),
      T('высокая: цифры совпадают с примером «Catbox: пары +23»', 'high: the digits match the “Catbox: pairs +23” example')));
    push({
      id: 'img-book-digits', title: T('Страница книги: OCR → авто-поиск', 'A book page: OCR → Auto'),
      desc: T('Пять строк цифр → одна строка → пары +23 → ссылка Catbox', 'Five lines of digits → one line → pairs +23 → a Catbox link'),
      expect: [], manual: T('Нужна картинка и запуск OCR кнопкой «Распознать»; сами цифры авто-поиск решает (пример catbox)',
        'Needs the image and an OCR run with the Recognise button; the digits themselves are solved by the auto search (the catbox example)'),
    }, b);
  })();
})(typeof self !== 'undefined' ? self : this);
