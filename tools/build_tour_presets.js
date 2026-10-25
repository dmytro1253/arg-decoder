// Собирает web/js/presets-tour.js: по одному примеру на каждую операцию (данные — tools/tour-data.json,
// проверенные пары «вход → ответ») и отдельные примеры со звуком, картинками и файлами (образцы в web/samples).
//   node tools/make_tour_data.js > tools/tour-data.json   (если менялись операции)
//   node tools/build_tour_presets.js
'use strict';
const fs = require('fs');
const path = require('path');
const synth = require('../tests/fixtures/audio/synth');

const ROOT = path.join(__dirname, '..');
const DATA = require('./tour-data.json');
const js = (v) => JSON.stringify(v);

// Голые байты PCM (8 бит, 8 кГц) с тонами DTMF «42» и ZIP, разрезанный на две части в Base64.
const dtmf = synth.dtmf('42', {});
const PCM42 = Buffer.from(Array.from(dtmf.samples, (s) => Math.max(0, Math.min(255, Math.round(128 + s * 127))))).toString('base64');
const ZIP_A = 'UEsDBBQAAAAAAABgWV0TZGFXKwAAACsAAAAIAAAAbm90ZS50eHRCb3RoIGhhbHZlcyB3ZXJlIG5lZWRlZDogdGhlIGNvZGUgaXMgMDQ1';
const ZIP_B = 'MS4KUEsBAhQAFAAAAAAAAGBZXRNkYVcrAAAAKwAAAAgAAAAAAAAAAAAAAIABAAAAAG5vdGUudHh0UEsFBgAAAAABAAEANgAAAFEAAAAAAA==';

// Группы меню; кодировки делятся на две, перебор фрагментов — к перестановкам.
const groupOf = (it, i, all) => {
  if (it.op === 'permute_fragments') return 'transpositions';
  if (it.board !== 'encodings') return it.board;
  const split = all.findIndex((x) => x.op === 'base_convert');
  return i < split ? 'encodings' : 'codes';
};
// Отчёты с подписями на языке интерфейса проверяются по фрагменту, не целиком.
const CONTAINS = { vigenere_family: (it) => 'the signal repeats at midnight', hash_all: (it) => it.expect.split('\n')[0].split(/\s+/).pop() };

const rows = [];
DATA.forEach((it, i) => {
  if (it.chainFrom) { rows[rows.length - 1].next = [it.op, it.params, it.expect]; return; }
  rows.push({ group: groupOf(it, i, DATA), op: it.op, params: it.params, input: it.input, second: it.second === undefined ? null : it.second, expect: it.expect });
});
const dataLines = rows.map((r) => {
  const last = r.next ? r.next[2] : r.expect;
  const contains = CONTAINS[r.op] ? CONTAINS[r.op](r) : null;
  const row = [r.group, r.op, r.params, r.input, r.second, r.next ? [r.next[0], r.next[1]] : null, contains ? null : last, contains];
  return '    ' + js(row) + ',' + (/[А-Яа-яЁё]/.test(js(row)) ? ' // i18n-ok: данные примера' : '');
});

const code = `// Тур по нодам: каждая операция и спецнода программы — в отдельном примере с настоящими данными.
// Шифротексты сделаны самими нодами (режим «зашифровать» или обратная операция) и проверены расшифровкой
// (tools/make_tour_data.js); звук, картинки и файлы — образцы в web/samples (tools/make_tour_samples.js,
// tools/make_tour_images.py). Файл собран tools/build_tour_presets.js; tests/tour.test.js сверяет ответы и покрытие.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const { Board, sourceNote } = G.PresetKit;
  const GROUPS = {
    squares: T('Шифры с квадратом', 'Square ciphers'), keyed: T('Шифры с ключом', 'Keyed ciphers'),
    transpositions: T('Перестановки', 'Transpositions'), symbols: T('Символы и алфавиты', 'Symbols and alphabets'),
    encodings: T('Кодировки', 'Encodings'), codes: T('Числа и байты', 'Numbers and bytes'),
    hidden: T('Скрытый текст', 'Hidden text'), hashes: T('Хеши и OpenSSL', 'Hashes and OpenSSL'),
    audio: T('Звук и сжатые данные', 'Audio and compressed data'), images: T('Картинки: стеганография', 'Images: steganography'), files: T('Файлы и архивы', 'Files and archives'),
  };
  const push = (spec, b) => G.Presets.push(Object.assign({ nodes: b.nodes, links: b.links, profile: 'neutral' }, spec));
  const short = (s) => { const t = String(s).replace(/\\s+/g, ' '); return t.length > 36 ? t.slice(0, 35) + '…' : t; };
  const op = (id) => G.CipherOps.BY_ID[id] || { name: id, params: [] };

  // Заметка из описания самой операции (оно уже переведено) и её параметров в этом примере.
  function opNote(id, params) {
    const def = op(id);
    const list = Object.entries(params || {}).map(([k, v]) => {
      const q = (def.params || []).find((x) => x.key === k);
      const opt = q && q.options && q.options.find((o) => (Array.isArray(o) ? o[0] : o) === v);
      return (q ? q.label : k) + ': ' + (opt && Array.isArray(opt) ? opt[1] : v);
    });
    return def.desc + (list.length ? '\\n\\n' + T('Параметры примера: ', 'Parameters in this example: ') + list.join('; ') : '')
      + '\\n\\n' + T('Ответ этого примера проверяется тестами программы.', 'The answer of this example is checked by the program tests.');
  }

  // [группа, операция, параметры, вход, второй вход или null, следующая операция или null, ответ, фрагмент ответа]
  const OPS = [
${dataLines.join('\n')}
  ];
  for (const [group, id, params, input, second, next, expect, contains] of OPS) {
    const b = new Board();
    const src = b.add('input', 0, 0, { text: input });
    const node = b.add('op:' + id, second === null ? 1 : 2, 0, params);
    b.link(src, node, 0);
    if (second !== null) b.link(b.add('input', 1, 0, { text: second }), node, 1);
    const last = next ? b.then(node, 'op:' + next[0], next[1]) : node;
    b.then(last, 'view');
    b.note(0, 1, opNote(id, params) + (next ? '\\n\\n' + op(next[0]).name + ': ' + op(next[0]).desc : ''));
    const answer = expect !== null ? expect : contains;
    push({ id: 'tour-' + id, group: GROUPS[group], title: op(id).name + (next ? ' → ' + op(next[0]).name : ''),
      desc: short(second === null ? input : input + ' + ' + second) + ' → ' + short(answer),
      ...(expect !== null ? { expect: [expect] } : { expectContains: [contains] }),
      manual: T('Пример одной операции: ключ и параметры уже стоят в ноде', 'An example of one operation: the key and parameters are already set in the node') }, b);
  }

  const SYNTH = T('синтезировано для программы (tools/make_tour_samples.js, tools/make_tour_images.py)', 'synthesised for the program (tools/make_tour_samples.js, tools/make_tour_images.py)');
  const SURE = T('высокая: ответ задан при синтезе и проверяется тестами', 'high: the answer was set at synthesis and is checked by tests');
  const media = (spec, b, text, source) => {
    b.note(0, spec.noteRow || 1, sourceNote(text, source || SYNTH, SURE));
    push({ id: spec.id, group: GROUPS[spec.group], title: spec.title, desc: spec.desc, expect: spec.expect, expectContains: spec.expectContains, expectBrowser: spec.expectBrowser,
      manual: spec.manual || T('Файл разбирают ноды; авто-поиск работает с текстом', 'Nodes take the file apart; Auto works with text') }, b);
  };

  // ---------- поиск ссылок ----------
  (function () {
    const b = new Board();
    b.then(b.then(b.add('input', 0, 0, { text: 'Mirror for the logs: hxxps://pastebin[.]com/raw/aB3dE7fG (the old one is dead)' }), 'links'), 'view');
    b.note(0, 1, T('Ссылки в ARG часто «обезврежены» (hxxp, [.], пробелы) или перевёрнуты. «Поиск ссылок» находит их и ID, похожие на YouTube, Drive, Catbox, Pastebin, и восстанавливает адрес; кнопка «проверить» узнаёт через локальный сервер, существует ли страница.',
      'ARG links are often defanged (hxxp, [.], spaces) or reversed. "Link finder" finds them and IDs that look like YouTube, Drive, Catbox, Pastebin, and restores the address; the check button asks the local server whether the page exists.'));
    push({ id: 'tour-links', group: GROUPS.hidden, title: T('Поиск ссылок', 'Link finder'), desc: 'hxxps://pastebin[.]com/raw/… → https://pastebin.com/raw/…',
      expect: ['https://pastebin.com/raw/aB3dE7fG'], manual: T('Пример одной операции: ключ и параметры уже стоят в ноде', 'An example of one operation: the key and parameters are already set in the node') }, b);
  })();

  // ---------- звук ----------
  (function () {
    const b = new Board();
    const pic = b.then(b.add('artifact', 0, 0, { sample: 'sstv-robot36' }), 'sstv_audio', { mode: 'auto' });
    const crop = b.then(pic, 'img_geom', { cx: 44, cy: 4, cw: 231, ch: 231, scale: 2 });
    b.then(b.then(crop, 'img_qr'), 'view');
    media({ id: 'tour-sstv', group: 'audio', title: T('SSTV: картинка из звука → QR', 'SSTV: a picture from audio → QR'),
      desc: T('Robot 36 → картинка → обрезка → QR: PASSWORD: NIGHTJAR', 'Robot 36 → picture → crop → QR: PASSWORD: NIGHTJAR'), expect: ['PASSWORD: NIGHTJAR'] }, b,
    T('SSTV — способ передавать картинки звуком по радио; в ARG такие записи прячут в видео и аудиофайлах. Нода «SSTV из звука» сама узнаёт режим по коду VIS в начале записи (здесь Robot 36, 37 секунд) и рисует картинку. На ней QR-код: «Обрезка» вырезает и увеличивает его, нода QR читает текст.',
      'SSTV sends pictures as sound over radio; ARGs hide such recordings in videos and audio files. The "SSTV from audio" node detects the mode from the VIS code at the start (Robot 36 here, 37 seconds) and draws the picture. It holds a QR code: "Crop" cuts it out and enlarges it, and the QR node reads the text.'));
  })();
  (function () {
    const b = new Board();
    b.then(b.then(b.add('artifact', 0, 0, { sample: 'morse-oldroot' }), 'morse_audio', { out: 'text' }), 'view');
    media({ id: 'tour-morse-audio', group: 'audio', title: T('Морзе из звука', 'Morse from audio'), desc: T('Тон 700 Гц → OLDROOT', 'A 700 Hz tone → OLDROOT'), expect: ['OLDROOT'] }, b,
      T('Нода находит частоту тона, порог и длину точки, затем собирает точки и тире в текст. Переключатель «Выход» показывает либо точки и тире, либо сразу текст.',
        'The node finds the tone frequency, threshold and dot length, then turns dots and dashes into text. The Output switch shows either dots and dashes or the text right away.'));
  })();
  (function () {
    const b = new Board();
    b.then(b.then(b.add('artifact', 0, 0, { sample: 'dtmf-425822' }), 'dtmf_audio'), 'view');
    media({ id: 'tour-dtmf', group: 'audio', title: T('DTMF: тоны кнопок телефона', 'DTMF: phone key tones'), desc: T('Звук набора номера → 425822', 'A dialling sound → 425822'), expect: ['425822'] }, b,
      T('Каждая кнопка телефона звучит двумя частотами сразу. Нода слушает их и выписывает цифры; длинная пауза между группами становится пробелом. В Petscop так спрятан номер BBS.',
        'Each phone key sounds as two frequencies at once. The node listens to them and writes the digits; a long pause between groups becomes a space. Petscop hides a BBS number like this.'));
  })();
  (function () {
    const b = new Board();
    const pcm = b.then(b.then(b.add('input', 0, 0, { text: ${js(PCM42)} }), 'op:base64_decode'), 'raw_pcm', { format: 'u8', channels: 1, rate: 8000 });
    b.then(b.then(pcm, 'dtmf_audio'), 'view');
    media({ id: 'tour-raw-pcm', group: 'audio', title: T('Байты → звук (без заголовка WAV)', 'Bytes → audio (no WAV header)'), desc: T('Base64 → байты → звук 8 бит, 8 кГц → DTMF 42', 'Base64 → bytes → 8-bit 8 kHz audio → DTMF 42'), expect: ['42'] }, b,
      T('Иногда звук дают голыми байтами, без заголовка WAV. «Байты → звук» читает их как отсчёты (здесь 8 бит без знака, 8000 Гц, моно), и дальше работает любая звуковая нода: DTMF слышит 42.',
        'Sometimes audio is given as bare bytes without a WAV header. "Bytes → audio" reads them as samples (8-bit unsigned, 8000 Hz, mono here), and any audio node works after it: DTMF hears 42.'));
  })();

  // ---------- картинки ----------
  (function () {
    const b = new Board();
    b.then(b.then(b.add('artifact', 0, 0, { sample: 'lsb-lighthouse' }), 'img_lsb', { channels: 'rgb', bits: 1, bitOrder: 'msb', scan: 'row', limit: 72 }), 'view');
    media({ id: 'tour-lsb', group: 'images', title: T('LSB: текст в младших битах пикселей', 'LSB: text in the low bits of pixels'), desc: T('Картинка маяка → The password is NIGHTJAR…', 'A lighthouse picture → The password is NIGHTJAR…'),
      expectBrowser: ['The password is NIGHTJAR. The keeper hid the logbook in the lighthouse.'], manual: T('Картинку декодирует браузер; авто-поиск работает с текстом', 'The browser decodes the picture; Auto works with text') }, b,
    T('Сообщение записано в самый младший бит красного, зелёного и синего канала первых пикселей. Глазом картинка не меняется. «LSB-извлечение» собирает эти биты в байты (старший бит первым, по строкам), «Макс. байт» обрезает шум после сообщения.',
      'The message is written into the lowest bit of the red, green and blue channels of the first pixels. The picture looks the same. "LSB extraction" collects these bits into bytes (most significant bit first, by rows); "Max output bytes" cuts the noise after the message.'));
  })();
  (function () {
    const b = new Board();
    b.then(b.then(b.add('artifact', 0, 0, { sample: 'lsb-plane' }), 'img_bits', { name: 'r', bit: 0 }), 'view');
    media({ id: 'tour-bit-plane', group: 'images', title: T('Битовая плоскость: где спрятаны данные', 'Bit plane: where the data hides'), desc: T('Обычная картинка → младший бит красного → LOOK UP', 'An ordinary picture → the low bit of red → LOOK UP'),
      expectBrowser: [], manual: T('Ответ — картинка: его видно в «Результате»', 'The answer is a picture: see it in the Result node') }, b,
    T('Каждый бит каждого канала можно показать отдельной чёрно-белой картинкой. Изменение младшего бита глазом не видно, поэтому в нём удобно прятать рисунок: здесь в младшем бите красного канала нарисована надпись LOOK UP. В самой картинке её нет, а «Битовая плоскость» (канал R, бит 0) показывает её в «Результате». Если не знаешь, где искать, перебери каналы и биты 0–2.',
      'Each bit of each channel can be shown as a separate black-and-white picture. A change in the low bit is invisible to the eye, so it is a handy place to hide a drawing: here the text LOOK UP is drawn in the low bit of the red channel. The picture itself does not show it, and "Bit plane" (channel R, bit 0) shows it in the Result node. If you do not know where to look, go through the channels and bits 0–2.'));
  })();
  (function () {
    const b = new Board();
    const mix = b.then(b.add('artifact', 0, 0, { sample: 'xor-a' }), 'img_combine', { mode: 'xor' });
    b.link(b.add('artifact', 0, 1, { sample: 'xor-b' }), mix, 1);
    b.then(mix, 'view');
    media({ id: 'tour-xor-images', group: 'images', noteRow: 2, title: T('XOR двух картинок', 'XOR of two pictures'), desc: T('Два кадра шума → 7319', 'Two noise frames → 7319'),
      expectBrowser: [], manual: T('Ответ — картинка: его видно в «Результате»', 'The answer is a picture: see it in the Result node') }, b,
    T('Каждый кадр по отдельности — белый шум. Если наложить их режимом XOR (нода «Две картинки → одна»), одинаковый шум исчезает и остаётся то, чем кадры отличались: число 7319.',
      'Each frame alone is white noise. Combining them in XOR mode ("Two images → one") cancels the shared noise and leaves only the difference: the number 7319.'));
  })();

  // ---------- файлы ----------
  (function () {
    const b = new Board();
    b.then(b.then(b.add('artifact', 0, 0, { sample: 'photo-logbook' }), 'img_meta'), 'view');
    media({ id: 'tour-png-meta', group: 'files', title: T('Метаданные картинки и данные после конца', 'Picture metadata and data after the end'), desc: T('logbook.png → комментарий и 246 байт после IEND', 'logbook.png → a comment and 246 bytes after IEND'),
      expectBrowser: [], manual: T('Картинку разбирает браузер; авто-поиск работает с текстом', 'The browser parses the picture; Auto works with text') }, b,
    T('Картинка выглядит обычной, но в PNG есть текстовый комментарий «Not everything ends at IEND», а после конца картинки (чанк IEND) дописаны ещё байты, начинающиеся с PK — это ZIP. Следующий пример его достаёт.',
      'The picture looks ordinary, but the PNG has a text comment "Not everything ends at IEND", and more bytes starting with PK are appended after the end of the image (the IEND chunk): a ZIP. The next example extracts it.'));
  })();
  (function () {
    const b = new Board();
    const photo = b.add('artifact', 0, 0, { sample: 'photo-logbook' });
    b.then(photo, 'file_inspect', { output: 'report' }, 0, 1);
    const text = b.then(b.then(photo, 'file_archive', { output: 'extract', entry: 'logbook.txt' }), 'file_to_bytes', { as: 'utf8' });
    b.then(b.then(text, 'log_view', { output: 'filter', search: 'key' }), 'view');
    media({ id: 'tour-zip-in-png', group: 'files', noteRow: 2, title: T('ZIP внутри картинки', 'A ZIP inside a picture'), desc: T('logbook.png → архив → logbook.txt → строка с key', 'logbook.png → archive → logbook.txt → the line with key'),
      expectContains: ['Day 12: the keeper hid the brass key under the third step.'] }, b,
    T('«Инспектор файла» показывает, что после PNG лежит ZIP. Нода «Архив» открывает его прямо из картинки и достаёт logbook.txt, «Файл → байты» делает из него текст, а «Просмотр лога» оставляет только строки со словом key.',
      '"File inspector" shows that a ZIP follows the PNG. The "Archive" node opens it straight from the picture and extracts logbook.txt, "File → bytes" turns it into text, and "Log viewer" keeps only the lines with the word key.'));
  })();
  (function () {
    const b = new Board();
    b.then(b.then(b.add('artifact', 0, 0, { sample: 'photo-logbook' }), 'file_strings', { kinds: 'all', minLen: 8, regex: 'key|step' }), 'view');
    media({ id: 'tour-strings', group: 'files', title: T('Строки из файла', 'Strings from a file'), desc: T('Читаемые фразы прямо в байтах файла', 'Readable phrases right in the file bytes'),
      expectContains: ['Day 12: the keeper hid the brass key under the third step.'] }, b,
    T('Самый быстрый первый шаг с незнакомым файлом: вытащить из байтов всё, что похоже на текст. Фильтр key|step оставляет нужные строки — они видны даже без распаковки архива.',
      'The fastest first step with an unknown file: pull everything that looks like text out of the bytes. The key|step filter keeps the useful lines; they show even without unpacking the archive.'));
  })();
  (function () {
    const b = new Board();
    const rar = b.add('artifact', 0, 0, { sample: 'rar5-vault' });
    b.then(rar, 'file_archive7z', { output: 'list', password: 'lighthouse' }, 0, 1);
    // Части по сторонам света, по часовой стрелке от севера: N, E, S, W (в архиве они лежат по алфавиту).
    // Четыре извлечения — в ряд (ноды 7-Zip высокие), под ними склейка и расшифровка.
    const parts = ['north.txt', 'east.txt', 'south.txt', 'west.txt'].map((entry, i) => b.add('file_archive7z', 1 + i, 1, { output: 'extract', entry, password: 'lighthouse' }));
    parts.forEach((p) => b.link(rar, p, 0));
    const joined = b.add('file_concat', 1, 3, { name: 'message.b64' });
    parts.forEach((p, i) => b.link(p, joined, i));
    const text = b.then(b.then(joined, 'file_to_bytes', { as: 'utf8' }), 'op:base64_decode');
    b.then(text, 'view');
    media({ id: 'tour-rar-password', group: 'files', noteRow: 2, title: T('RAR с паролем: четыре части → послание', 'A password RAR: four parts → a message'),
      desc: T('Пароль lighthouse → north, east, south, west → Base64 → текст', 'Password lighthouse → north, east, south, west → Base64 → text'),
      expectBrowser: ['The keeper left one last entry: the lamp still works. Light it at 02:00 and wait for the answer.'],
      manual: T('7-Zip работает в браузере (WebAssembly)', '7-Zip runs in the browser (WebAssembly)') }, b,
    T('vault.rar — RAR5 с зашифрованными заголовками: без пароля не видно даже имён файлов. Пароль lighthouse (маяк — разгадка прошлых примеров) открывает список: east, north, south, west. По отдельности каждая часть — бессмысленный обрывок Base64. Стороны света читают по часовой стрелке от севера: север, восток, юг, запад — в таком порядке части подключены к «Склейке файлов». Склеенный Base64 раскодируется в последнюю запись смотрителя.',
      'vault.rar is a RAR5 with encrypted headers: without the password even the file names are hidden. The password lighthouse (the answer of the previous examples) opens the list: east, north, south, west. Each part alone is a meaningless piece of Base64. Compass points are read clockwise from north: north, east, south, west, and that is the order in which the parts go into "Join files". The joined Base64 decodes into the keeper’s last entry.'),
    T('сделано для программы (WinRAR, tests/fixtures/archives/vault-lighthouse.rar)', 'made for the program (WinRAR, tests/fixtures/archives/vault-lighthouse.rar)'));
  })();
  (function () {
    const b = new Board();
    const f1 = b.then(b.then(b.add('input', 0, 0, { text: ${js(ZIP_A)} }), 'op:base64_decode'), 'bytes_to_file', { read: 'auto', name: 'part1.bin' });
    const f2 = b.then(b.then(b.add('input', 0, 1, { text: ${js(ZIP_B)} }), 'op:base64_decode'), 'bytes_to_file', { read: 'auto', name: 'part2.bin' });
    const joined = b.then(f1, 'file_concat', { name: 'joined.zip' });
    b.link(f2, joined, 1);
    b.then(b.then(b.then(joined, 'file_archive', { output: 'extract', entry: 'note.txt' }), 'file_to_bytes', { as: 'utf8' }), 'view');
    media({ id: 'tour-join-parts', group: 'files', noteRow: 2, title: T('Архив из двух частей', 'An archive in two parts'), desc: T('Две половины Base64 → ZIP → note.txt: код 0451', 'Two Base64 halves → ZIP → note.txt: the code 0451'),
      expect: ['Both halves were needed: the code is 0451.\\n'] }, b,
    T('Архив разрезан на две части, и по отдельности ни одна не открывается. Каждая часть: Base64 → байты → «Байты → файл»; «Склейка файлов» соединяет их по порядку входов, и получается целый ZIP.',
      'The archive is cut into two parts, and neither opens alone. Each part: Base64 → bytes → "Bytes → file"; "Join files" puts them together in input order, and a whole ZIP comes out.'));
  })();
})(typeof self !== 'undefined' ? self : this);
`;
fs.writeFileSync(path.join(ROOT, 'web', 'js', 'presets-tour.js'), code);
console.log('presets-tour.js:', rows.length, 'operation examples,', (code.length / 1024).toFixed(0), 'KB');
