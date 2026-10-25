// Примеры 1.2: QR из бинарного дампа Sombra, сжатый слой под XOR, текст в спектрограмме звука.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const { Board, define, sourceNote } = G.PresetKit;
  const GROUP = T('Звук и сжатые данные', 'Audio and compressed data');

  // Sombra: опубликованный бинарный дамп; геометрия выведена из самого дампа (см. досье Sombra).
  const DUMP = "0000111111101100 0000010010110001 0000000001111111 0000001001111001 0000000101010011 0001111111010111 0000001110100000 0000101101101010 0001101101011110\n0000100000100000 0000001011000111 0001010101000001 0000100100011001 0000011010010000 0001111101111001 0000101001000011 0000101111010100 0001011111111001\n0000101110101001 0000111110000011 0000100001011101 0000010010101010 0000101111110000 0001010110000010 0000101011111111 0000010010010110 0000100000111101\n0000101110101101 0000011101001000 0000111001011101 0000100000000000 0000110010100001 0001001001010010 0000011110010011 0000001100100100 0000000101100000\n0000101110101111 0000011111110100 0000001101011101 0000000111101001 0000000000101011 0000100000000110 0000011001011000 0000101000101111 0001101111111110\n0000100000100100 0000011100011001 0001110001000001 0000001100001000 0000110100000011 0001101101001011 0000000000001100 0000001111000011 0001110100010100\n0000111111101010 0000101010101010 0001010101111111 0000001111110001 0000100111001000 0001111110110111 0000111111100100 0000011110001110 0000100101010110\n0000000000000101 0000001011001000 0000010100000000 0000111011011100 0000100001100110 0001000001010000 0000100000100001 0000011100100011 0000001100011000\n0000111100101000 0000000111110110 0000010010011101 0000110010110011 0000110111110111 0000010100110010 0000101110100100 0000011000110100 0000010111110001\n0000100110000000 0000010001111100 0000000100100010 0000011000000010 0000111011111001 0000100110101001 0000101110101000 0000000010111001 0000011011010111\n0000010110110000 0000010110101000 0001000111011000 0000110111101001 0000110000100001 0001100001110000 0000101110101010 0000001010000111 0000000110111100\n0000111101011001 0000110110111010 0000110110011100 0000000000001000 0000000000100000 0001111111101111 0000100000101111 0000111011111010 0000110000100100\n0000111111101101 0000000101110010 0001100011001111";
  (function sombraQr() {
    const b = new Board();
    // Две строки: дамп и раскладка сверху, картинка и QR справа, ответ под QR — граф целиком помещается на экране.
    const src = b.add('input', 0, 0, { text: DUMP });
    const rows = b.then(src, 'op:bit_rows', { keep: '12,12,13', perRow: 3, columns: 3 });
    const img = b.then(rows, 'bits_to_image', { width: 0, scale: 8, margin: 4 });
    const qr = b.then(img, 'img_qr');
    const view = b.add('view', 3, 2);
    b.link(qr, view);
    b.note(0, 1, sourceNote(
      T('111 групп по 16 бит. Ведущие нули групп (4/4/3) дают 12 + 12 + 13 = 37 значащих бит — ширина QR версии 5. Шаблоны поиска QR показывают порядок строк: в строке текста стоят строки QR L, 12 + L и 24 + L, короткая последняя строка — нижняя строка QR. Параметры выведены человеком из структуры дампа, без ответа; авто-поиск их не подбирает.',
        '111 groups of 16 bits. The leading zeros of the groups (4/4/3) give 12 + 12 + 13 = 37 significant bits, the width of a version-5 QR code. The QR finder patterns show the row order: a text line holds QR rows L, 12 + L and 24 + L, and the short last line is the bottom QR row. The parameters were derived by hand from the structure of the dump, without the answer; Auto does not find them.'),
      'Game Detectives wiki, Sombra ARG', T('высокая: QR читается целиком, без ремонта', 'high: the QR code reads in full, without repair')));
    define({ id: 'sombra-qr', arg: 'sombra', title: T('Sombra: бинарный дамп → QR', 'Sombra: binary dump → QR'),
      desc: T('Группы битов → строки сетки → картинка → QR → испанское сообщение', 'Bit groups → grid rows → image → QR → a Spanish message'),
      expect: ['¿Estuvo eso facilito? Ahora que tengo su atención, déjenme se las pongo más difícil.'],
      manual: T('Параметры геометрии заданы вручную; QR читается нодой', 'The geometry parameters are set by hand; the QR node reads the code') }, b);
  })();

  // Base64 → XOR → zlib → UTF-8: данные сделаны средствами Python (zlib, base64, свой XOR), ключ 2D.
  (function xorZlib() {
    const b = new Board();
    const src = b.add('input', 0, 0, { text: "Vfcw5/wgrR0laPx48ykDzTcDbSabaYgkvRlDQs7CENrFr70XoVwXmGoBjKyD4U8F/1hkg4TzjnPlHOhaOXpGUgNjPJXJKAi1i0Ay+TswrA==" });
    const bytes = b.then(src, 'op:base64_decode');
    const key = b.add('input', 1, 1, { text: '2d' });
    const xor = b.then(bytes, 'op:xor', { fmt: 'hex' });
    b.wire(key, xor, 1);
    const inf = b.then(xor, 'op:decompress', { format: 'auto' });
    const txt = b.then(inf, 'op:bytes_decode', { enc: 'utf8' });
    b.then(txt, 'view');
    b.note(0, 2, T('Сжатый слой под XOR. Ключ 2D выводит и авто-поиск: начало потока zlib (78 DA) известно заранее, а контрольная сумма Adler-32 подтверждает и ключ, и распаковку. Вставь Base64 в панель «Авто», чтобы проверить.',
      'A compressed layer under XOR. Auto derives the key 2D too: the start of a zlib stream (78 DA) is known in advance, and the Adler-32 checksum confirms both the key and the decompression. Paste the Base64 into the Auto panel to check.'));
    G.Presets.push({ id: 'xor-zlib', group: GROUP, title: T('Base64 → XOR → zlib → текст', 'Base64 → XOR → zlib → text'),
      desc: T('Ключ XOR выводится из заголовка zlib, сумма Adler-32 его подтверждает', 'The XOR key comes from the zlib header, Adler-32 confirms it'),
      nodes: b.nodes, links: b.links, profile: 'neutral', expect: ["The second fragment is hidden behind the clock tower; bring the brass key at dawn."],
      auto: { input: "Vfcw5/wgrR0laPx48ykDzTcDbSabaYgkvRlDQs7CENrFr70XoVwXmGoBjKyD4U8F/1hkg4TzjnPlHOhaOXpGUgNjPJXJKAi1i0Ay+TswrA==", expect: "The second fragment is hidden behind the clock tower; bring the brass key at dawn.", top: 1 } });
  })();

  // Текст, нарисованный в спектрограмме звука (синтетический образец).
  (function spectrogramText() {
    const b = new Board();
    const wav = b.add('artifact', 0, 0, { sample: 'spectro-pg56' });
    b.then(wav, 'spectrogram', { fmax: 0, cmap: 'inferno' });
    b.note(0, 1, sourceNote(T('Синтетический звук: надпись PG56 нарисована частотами. В ARG так прячут пароли (Inscryption, Killing Floor 2). Выдели участок мышью, чтобы увеличить; кнопка PNG сохранит картинку для OCR.',
      'Synthetic audio: the text PG56 is drawn with frequencies. ARGs hide passwords like this (Inscryption, Killing Floor 2). Drag over a part to zoom in; the PNG button saves the picture for OCR.'),
      T('синтезирован для тестов программы (tests/fixtures/audio/synth.js)', 'synthesised for the program tests (tests/fixtures/audio/synth.js)'), T('высокая: надпись задана при синтезе', 'high: the text was set at synthesis')));
    G.Presets.push({ id: 'audio-spectrogram', group: GROUP, title: T('Текст в спектрограмме звука', 'Text in an audio spectrogram'),
      desc: T('WAV → спектрограмма → надпись PG56', 'WAV → spectrogram → the text PG56'), nodes: b.nodes, links: b.links, profile: 'neutral',
      manual: T('Надпись читает человек или OCR по сохранённой картинке', 'A person or OCR on the saved picture reads the text') });
  })();
})(typeof self !== 'undefined' ? self : this);
