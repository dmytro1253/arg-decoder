// Тур по нодам: каждая операция и спецнода программы — в отдельном примере с настоящими данными.
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
  const short = (s) => { const t = String(s).replace(/\s+/g, ' '); return t.length > 36 ? t.slice(0, 35) + '…' : t; };
  const op = (id) => G.CipherOps.BY_ID[id] || { name: id, params: [] };

  // Заметка из описания самой операции (оно уже переведено) и её параметров в этом примере.
  function opNote(id, params) {
    const def = op(id);
    const list = Object.entries(params || {}).map(([k, v]) => {
      const q = (def.params || []).find((x) => x.key === k);
      const opt = q && q.options && q.options.find((o) => (Array.isArray(o) ? o[0] : o) === v);
      return (q ? q.label : k) + ': ' + (opt && Array.isArray(opt) ? opt[1] : v);
    });
    return def.desc + (list.length ? '\n\n' + T('Параметры примера: ', 'Parameters in this example: ') + list.join('; ') : '')
      + '\n\n' + T('Ответ этого примера проверяется тестами программы.', 'The answer of this example is checked by the program tests.');
  }

  // [группа, операция, параметры, вход, второй вход или null, следующая операция или null, ответ, фрагмент ответа]
  const OPS = [
    ["squares","bifid",{"key":"LANTERN","dir":"dec"},"NNEKORRGGTFUQUKVPZD",null,null,"THEKEYISUNDERTHEMAT",null],
    ["squares","trifid",{"key":"FELIX","dir":"dec"},"GSFMQZIF+KEFVDJL",null,null,"MEETATTHEOLDMILL",null],
    ["squares","adfgx",{"square":"BTALPDHOZKQFVSNGICUXMREWY","key":"CARGO","dir":"dec"},"FAXDGADDDXDGFAXAFAFAFAAF",null,null,"ATTACKATDAWN",null],
    ["squares","adfgvx",{"square":"PH0QG64MEA1YL2NOFDXKR3CVS5ZW7BJ9UTI8","key":"PRIVACY","dir":"dec"},"XDFGDDXVDFDGXFGGGAGGVDGA",null,null,"ATTACKAT1200",null],
    ["squares","four_square",{"dir":"dec"},"FYNFNEHWBXAFFOKHMD",null,null,"HELPMEOBIWANKENOBI",null],
    ["squares","two_square",{"dir":"dec"},"LAGRZOKWPNEGKWWU",null,null,"IOINUSATTHEGATEX",null],
    ["squares","nihilist",{"dir":"dec"},"37 106 62 36 67 47 86 26 104 53 62 77 27 55 57 66 55 36 54 27",null,null,"DYNAMITEWINTERPALACE",null],
    ["squares","playfair",{"key":"playfair example"},"BMODZBXDNABEKUDMUIXMMOUVIF",null,null,"hidethegoldinthetrexestump",null],
    ["keyed","vigenere_family",{"key":"ORACLE","dir":"dec"},"hye utkbrl tptsrtu lx azdptkvk",null,null,null,"the signal repeats at midnight"],
    ["keyed","running_key",{"key":"itwasabrightcolddayinaprilandtheclockswerestrikingthirteen","dir":"dec"},"baa vsumk wvlgu oe qlnc",null,null,"the vault opens at nine",null],
    ["keyed","keyed_caesar",{"key":"NIGHTJAR","n":3,"dir":"dec"},"bpllpz wdr zdewr uhttew",null,null,"follow the white rabbit",null],
    ["keyed","hill",{"key":"GYBNQKURP","dir":"dec"},"POHUPWLNA",null,null,"ACTNOWXXX",null],
    ["keyed","chaocipher",{"dir":"dec"},"OAHQHCNYNXTSZJRRHJBYHQKSOUJY",null,null,"WELLDONEISBETTERTHANWELLSAID",null],
    ["keyed","porta",{"key":"FORTIFICATION"},"oxxzep ktr wiigiowa",null,null,"define the frontier",null],
    ["keyed","enigma",{"model":"M3","rotors":"I II III","reflector":"B","rings":"AAA","positions":"ABC","plugboard":"AV BS CG"},"SOJONXLIBADLRYGKES",null,null,"WEATHERREPORTCLEAR",null],
    ["keyed","affine",{"alpha":"en","a":5,"b":8},"ihhwvc swfrcp",null,null,"affine cipher",null],
    ["keyed","autokey",{"key":"queen","alpha":"en"},"qnxepk tm dcgn",null,null,"attack at dawn",null],
    ["keyed","rc4",{"key":"Secret","fmt":"text"},"E \u001fd_Ã[85RTKõ",null,null,"Attack at dawn",null],
    ["keyed","xor_keep",{"key":"7","fmt":"num","keep":"nonalnum"},"Obkkh, Phukc!",null,null,"Hello, World!",null],
    ["keyed","substitute",{"from":"abcdefghijklmnopqrstuvwxyz","to":"qwertyuiopasdfghjklzxcvbnm"},"epc vkrc hl k shc",null,null,"the cake is a lie",null],
    ["transpositions","rail_fence",{"rails":3,"dir":"dec"},"WECRLTEERDSOEEFEAOCAIVDEN",null,null,"WEAREDISCOVEREDFLEEATONCE",null],
    ["transpositions","scytale",{"rows":4,"dir":"dec"},"IRYYATBHMVAEHEDLURLP",null,null,"IAMHURTVERYBADLYHELP",null],
    ["transpositions","route_cipher",{"width":4,"route":"spiral_cw","dir":"dec"},"WEARSEXDERCEDIVO",null,null,"WEAREDISCOVEREDX",null],
    ["transpositions","myszkowski",{"key":"TOMATO","dir":"dec"},"ROFOACDTEDSEEEACWEIVRLENE",null,null,"WEAREDISCOVEREDFLEEATONCE",null],
    ["transpositions","transpose",{"w":4,"dir":"cols"},"NTCIIJANGALGHRL!",null,null,"NIGHTJARCALLING!",null],
    ["transpositions","swap_pairs",{},"EMTEEMTAONNO",null,null,"MEETMEATNOON",null],
    ["transpositions","slice",{"from":1,"to":0,"step":3},"TxxHxxExxKxxExxY",null,null,"THEKEY",null],
    ["transpositions","chunk",{"n":5,"sep":" "},"ATTACKATDAWN",null,null,"ATTAC KATDA WN",null],
    ["transpositions","interleave",{},"HLOOL","ELWRD",null,"HELLOWORLD",null],
    ["symbols","pigpen_decode",{},"<· ⊐· ┘ ┌· ⊔· ∨ < ⊓ □ ∨ ┐· ⊏· <",null,null,"XMARKSTHESPOT",null],
    ["symbols","pigpen_encode",{},"enderman",null,null,"□ □· ⊐ □ ┌· ⊐· ┘ □·",null],
    ["symbols","runes_decode",{},"ᛟᛞᛁᚾ ᛊᛖᛖᛊ ᚨᛚᛚ",null,null,"odin sees all",null],
    ["symbols","runes_encode",{},"odin sees all",null,null,"ᛟᛞᛁᚾ ᛊᛖᛖᛊ ᚨᛚᛚ",null],
    ["symbols","braille_decode",{},"⠞⠕⠥⠉⠓⠀⠞⠓⠑⠀⠺⠁⠇⠇",null,null,"touch the wall",null],
    ["symbols","braille_encode",{},"touch the wall",null,null,"⠞⠕⠥⠉⠓⠀⠞⠓⠑⠀⠺⠁⠇⠇",null],
    ["symbols","greek_translit",{"dir":"gr2lat"},"ΑΡΓΟΝΑΥΤΗΣ",null,null,"argonaytes",null],
    ["symbols","phonetic_decode",{},"November Oscar Tango Charlie Hotel",null,null,"NOTCH",null],
    ["symbols","phonetic_encode",{"alphabet":"nato"},"SOS",null,null,"Sierra Oscar Sierra",null],
    ["symbols","sga_encode",{},"herobrine",null,null,"⍑ᒷ∷𝙹ʖ∷╎リᒷ",null],
    ["symbols","morse_encode",{"lang":"en"},"OLD ROOT",null,null,"--- .-.. -.. / .-. --- --- -",null],
    ["symbols","binary_pixels",{"width":5,"scale":1},"01110100011000111111100011000110001",null,null," ███ \n█   █\n█   █\n█████\n█   █\n█   █\n█   █",null],
    ["symbols","callsign_order",{"out":"digits"},"Charlie 5\nAble 4\nEasy 2\nBaker 8\nDog 2",null,null,"48522",null],
    ["encodings","base91_decode",{},",X^Ic)jTh#w<pE}kYB+Jf,mC",null,null,"the archive is open",null],
    ["encodings","base91_encode",{},"the archive is open",null,null,",X^Ic)jTh#w<pE}kYB+Jf,mC",null],
    ["encodings","octal_decode",{},"162 157 157 155 040 064 060 064",null,null,"room 404",null],
    ["encodings","octal_encode",{},"room 404",null,null,"162 157 157 155 040 064 060 064",null],
    ["encodings","ebcdic_decode",{},"ÔÁÉÕÆÙÁÔÅ",null,null,"MAINFRAME",null],
    ["encodings","ebcdic_encode",{},"MAINFRAME",null,null,"ÔÁÉÕÆÙÁÔÅ",null],
    ["encodings","uudecode",{},"begin 644 data.bin\n-8F5G:6X@=&AE(&5N9```\n`\nend",null,null,"begin the end",null],
    ["encodings","uuencode",{},"begin the end",null,null,"begin 644 data.bin\n-8F5G:6X@=&AE(&5N9```\n`\nend",null],
    ["encodings","qp_decode",{},"=D0=9A=D0=BB=D1=8E=D1=87: =D0=BD=D0=BE=D1=87=D1=8C",null,null,"Ключ: ночь",null], // i18n-ok: данные примера
    ["encodings","qp_encode",{},"Ключ: ночь",null,null,"=D0=9A=D0=BB=D1=8E=D1=87: =D0=BD=D0=BE=D1=87=D1=8C",null], // i18n-ok: данные примера
    ["encodings","punycode_decode",{},"xn--80aa0aqw.xn--p1ai",null,null,"тайна.рф",null], // i18n-ok: данные примера
    ["encodings","punycode_encode",{},"тайна.рф",null,null,"xn--80aa0aqw.xn--p1ai",null], // i18n-ok: данные примера
    ["encodings","base58_decode",{},"StV1DL6CwTryKyV",null,null,"hello world",null],
    ["encodings","rot47",{},"|66E o hib_P",null,null,"Meet @ 9:30!",null],
    ["encodings","rot5",{},"9703770706",null,null,"4258225251",null],
    ["encodings","rot18",{},"Ebbz 656",null,null,"Room 101",null],
    ["encodings","rot8000",{},"籱籲籭籭籮籷 籲籷 籹籵籪籲籷 籼籲籰籱籽",null,null,"hidden in plain sight",null],
    ["codes","base_convert",{"from":16,"to":10},"DEADBEEF",null,null,"3735928559",null],
    ["codes","a1z26",{"alpha":"en"},"14 9 7 8 20",null,null,"night",null],
    ["codes","letters_to_numbers",{"alpha":"en"},"NIGHT",null,null,"14 9 7 8 20",null],
    ["codes","text_to_codes",{},"ARG",null,null,"65 82 71",null],
    ["codes","url_encode",{},"ключ = 42",null,null,"%D0%BA%D0%BB%D1%8E%D1%87%20%3D%2042",null], // i18n-ok: данные примера
    ["codes","hex_encode",{},"stop",null,null,"73 74 6F 70",null],
    ["codes","base64_encode",{},"stop",null,null,"c3RvcA==",null],
    ["codes","base32_encode",{},"stop",null,null,"ON2G64A",null],
    ["codes","binary_encode",{},"Hi",null,null,"01001000 01101001",null],
    ["codes","text_encode",{"enc":"cp1251"},"Привет",null,["hex_encode",{"enc":"latin1"}],"CF F0 E8 E2 E5 F2",null], // i18n-ok: данные примера
    ["codes","unescape",{},"\\u0048\\x65llo &#x2764; U+0021",null,null,"Hello ❤ !",null],
    ["codes","translit",{"dir":"ru2lat"},"Шифр Цезаря",null,null,"Shifr Tsezarya",null], // i18n-ok: данные примера
    ["codes","keyboard_shift",{"n":-1},"jrtpntomr",null,null,"herobrine",null],
    ["codes","filter",{"mode":"letters"},"T-H-E 1 K.E.Y 2",null,null,"THEKEY",null],
    ["hidden","zero_width",{"mode":"bits"},"Nothing to see​‌‌​‌​​​‍​‌‌​‌​​‌‍​‌‌​​‌​​‍​‌‌​​‌​‌ here.",null,["binary_decode",{}],"hide",null],
    ["hidden","acrostic",{"n":1,"by":"words"},"Every New Day Every Room Matters And Nothing",null,null,"ENDERMAN",null],
    ["hidden","book_cipher",{"unit":"words","book":"In the beginning the forest was silent and the old mill stood alone by the river"},"7 10 11",null,null,"silent old mill",null],
    ["hidden","pick_letters",{"mode":"upper"},"the Key is hidden in thE capitals, You see",null,null,"KEY",null],
    ["hidden","overlay_fill",{"mark":"#","mode":"seq"},"N#GHT#AR","IJ",null,"NIGHTJAR",null],
    ["hashes","hash_sha1",{},"nightjar",null,null,"3ff80a7b0a680e446fe334c4640f81313e716e32",null],
    ["hashes","hash_sha256",{},"nightjar",null,null,"43775932ce106a474e91158de24cfbba11d6f58e1d4e344ff7297ad1288dd084",null],
    ["hashes","hash_sha512",{},"nightjar",null,null,"94a0e90cc710a2d0de3537a024da78dbfe3185e7cc490888e1841ea7fb4d83027271fc57aa451486d3dbd1f2a20883d6c2a861101e33c64297dad40128181d58",null],
    ["hashes","hash_crc32",{},"nightjar",null,null,"612e5473",null],
    ["hashes","hash_all",{},"nightjar",null,null,null,"43a1ea6d499f04c780219c8b0bd9126b"],
    ["hashes","openssl_decrypt",{"key":"secret"},"U2FsdGVkX1/Zu4Xl5dNXFoMWT3JaQDGpr22Xz/By6B0bkzDmDnqPyW0bIbCY+Iuw",null,null,"Meet at dawn, Ёлка!",null], // i18n-ok: данные примера
    ["transpositions","permute_fragments",{"sep":" ","join":"","contains":"CAB","limit":20},"IN CAB OUT",null,null,"INCABOUT\nCABINOUT\nOUTINCAB\nINOUTCAB\nCABOUTIN\nOUTCABIN",null],
  ];
  for (const [group, id, params, input, second, next, expect, contains] of OPS) {
    const b = new Board();
    const src = b.add('input', 0, 0, { text: input });
    const node = b.add('op:' + id, second === null ? 1 : 2, 0, params);
    b.link(src, node, 0);
    if (second !== null) b.link(b.add('input', 1, 0, { text: second }), node, 1);
    const last = next ? b.then(node, 'op:' + next[0], next[1]) : node;
    b.then(last, 'view');
    b.note(0, 1, opNote(id, params) + (next ? '\n\n' + op(next[0]).name + ': ' + op(next[0]).desc : ''));
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
    const pcm = b.then(b.then(b.add('input', 0, 0, { text: "gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYKCgH18foCAfn1/ho2NgnNpbXyOlpCDeXl+gXtwbHiRpqaNalRYc5CclIV+hIyIdWBabZGusJZxWlxxh42Hf4OQmpJ3W1FkiamvmnpmZ3WBgHd1gpmmnX5bTV2BoKiYgHN1f4B2aWl9m6+mhmFQXHqVnJGCfoWLhXBdXXWZsayOalhgd4qOhX+Fk5mNcFZTbJKtrJN0ZGl5gn93d4edppd1Vk5liqWnk3xxdn9/c2hshKGvoHxaUGKBmZyOgH6GioFsXGF9oLKnhWNXZHyNjYR/h5SXh2lUV3WbsKiLbmJrfIN+d3qMoKSQbFFRbZKopI13cHiAfXFocYumrplzVVFoiZyai35+h4l8Z1tmhqeyoHxdV2mCj42DgIqWlYBjUlx+orGjg2hibn6EfXd9kKKhiGVPVnaZqqCIdHB5gHtvaXaSqquRa1FUcI+fmId8f4eHeGRcbI6ssZhzWVluh5GLgoGMlpF6XlJjh6ixnXxkY3KBhHx4gZWjnIBeTlx/oKucgnBxe4B5bWt8mKyniGJPWXiVoJWEe4CHhHRhXnSWsK2Qa1ZcdIuSioGCjpaNc1lUapCtr5V0YWR2g4R7eYWYo5d3WE5jiKWqlnxucXyAd2xugp6toX9bTl+Am6CSgXuBh4FvX2J7nrKoh2NUYHqPkoiAhJCUh21WV3OZsKuObl9neYWDe3uJnKKQb1NRa5CpqJB3bXN+f3VscoijrJp2Vk9miJ+fjn56goZ+a19mg6Syon5dVGWAkpGGgIaRkoJnVVx8oLKmhWhean2Ggnt9jZ6fiWdQVXOYrKSKcmx1f350bXaPp6qSbVFSbY+hnIp7e4KFemhfbIyqsZp1WFZrhpSQhYCIkpB8YVRihaeyn31jX26Bh4F7gJGfm4JgTlp9oK2fhG9sd4B9cm57lammimRPVnWWo5qGeXuDhHdlYXOUrq6SbFVYcYuWj4OBiZKMdl1VaY6ssJh1X2ByhIiAe4OUoJd6Wk9hhqatmn1rbXmAe3FwgJqon4FhVWJ+lZuQgXp9goF4cHF9jZaShHZwdH6EhoOAgIKCgX9+f4CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgoKAf4CBgHp2eIKNkIl9eHyBfnRtdImcno13bnV/fXBodJOsqo1rYG1+f3FqepqwqIZkWmp/g3hxf5yvo35dVmqCiH53g52rnHdXVGyHj4V8hpymlW9SU2+NloqAhpigjWlPVXWUnI+BhJOZhmROWXybopKAgY2SgGFQXoOjp5N+e4eLe2BTZYupqZF6dYCGeGFYbJKuqo50b3qCd2NedJmxqYltaHWAeWhle56ypoNmYnKAfG5sgqKyoXteXXGCgXRzh6SvmnRYWnGGhnt4iqOqk2xTWHSLjYF9i6Gki2VPWXmSlIZ/i5ydhF9NXH+ZmoqAiJeWfVtOYYagn4x/hJGPd1lQZ42no4x7foqJdFlUbpWspIp2eIOEclxadpywpIZwcX6Bcl9hfqKyooBpa3qAdGVohaeynXliZXeBeGtvi6mwmHJbYXeDfXJ2j6qskWpVX3iIhHh7kainiWNRX3yOin5/kqSggVxPYYGVkYOBkJ+ZelhOZYicloaAjJmSc1VQao+jm4d+h5KLb1RTcZeonYZ6gYyFbFVZeZ6tnoN1e4aBa1hfgKWwnH5udIF+bF1miKqxmXhnb31+b2Nuj62wlHBganyAdGp1lK6sjWlaZ3yDenB7l66ohmFVZn6IgHeAmauhfltSZ4OPh3yDmKaadlVRaYmWjYCElaGSb1JSbpCckoKCkZqLalBUdJejlYN/i5OFZlBZfJ6ol4F7hYx/ZFNfhKWrln11foZ8ZFdmi6utlHdueIJ6Zlxukq+tkHFnc397amN1mLGqimlhb39+cGp8nbGmg2JbbYCCdnGCn6+ge1tYbYOHfHeGn6uZc1VVb4iOg3yInqaSbFFVc4+ViH+ImqCKZU5XeJabjYCGlZmDYU5bf52hj4CCj5J9Xk9hh6SlkH19iIt5XVNojqqoj3h2goZ2Xlhvlq+oi3NwfIJ1YV53nLKnhmxpd4B3ZmV+obOjgGRjdIB6bGyFpbKeeF1fc4J/c3OJpq+XcFdcdIeFeXmNpKiPa1hgeIqJgH6Kl5eFbmRsfomJgoCFi4qAdXJ4gIWEgYCBgoGAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA=" }), 'op:base64_decode'), 'raw_pcm', { format: 'u8', channels: 1, rate: 8000 });
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
    b.then(b.then(b.add('artifact', 0, 0, { sample: 'rar5-locked' }), 'file_archive7z', { output: 'list', password: 'password' }), 'view');
    media({ id: 'tour-rar-password', group: 'files', title: T('RAR с паролем (7-Zip)', 'A password-protected RAR (7-Zip)'), desc: T('RAR5 с зашифрованными именами, пароль password → 4 файла', 'RAR5 with encrypted names, password password → 4 files'),
      expectBrowser: [], manual: T('7-Zip работает в браузере (WebAssembly)', '7-Zip runs in the browser (WebAssembly)') }, b,
    T('В RAR5 с зашифрованными заголовками без пароля не видно даже имён файлов. Нода 7-Zip с паролем открывает список; «Запись (артефакт)» достаёт нужный файл.',
      'In a RAR5 with encrypted headers even the file names are hidden without the password. The 7-Zip node with the password opens the list; "Entry (artifact)" extracts a file.'),
    T('тесты libarchive (BSD-2-Clause), test_read_format_rar5_encrypted_filenames', 'the libarchive tests (BSD-2-Clause), test_read_format_rar5_encrypted_filenames'));
  })();
  (function () {
    const b = new Board();
    const f1 = b.then(b.then(b.add('input', 0, 0, { text: "UEsDBBQAAAAAAABgWV0TZGFXKwAAACsAAAAIAAAAbm90ZS50eHRCb3RoIGhhbHZlcyB3ZXJlIG5lZWRlZDogdGhlIGNvZGUgaXMgMDQ1" }), 'op:base64_decode'), 'bytes_to_file', { read: 'auto', name: 'part1.bin' });
    const f2 = b.then(b.then(b.add('input', 0, 1, { text: "MS4KUEsBAhQAFAAAAAAAAGBZXRNkYVcrAAAAKwAAAAgAAAAAAAAAAAAAAIABAAAAAG5vdGUudHh0UEsFBgAAAAABAAEANgAAAFEAAAAAAA==" }), 'op:base64_decode'), 'bytes_to_file', { read: 'auto', name: 'part2.bin' });
    const joined = b.then(f1, 'file_concat', { name: 'joined.zip' });
    b.link(f2, joined, 1);
    b.then(b.then(b.then(joined, 'file_archive', { output: 'extract', entry: 'note.txt' }), 'file_to_bytes', { as: 'utf8' }), 'view');
    media({ id: 'tour-join-parts', group: 'files', noteRow: 2, title: T('Архив из двух частей', 'An archive in two parts'), desc: T('Две половины Base64 → ZIP → note.txt: код 0451', 'Two Base64 halves → ZIP → note.txt: the code 0451'),
      expect: ['Both halves were needed: the code is 0451.\n'] }, b,
    T('Архив разрезан на две части, и по отдельности ни одна не открывается. Каждая часть: Base64 → байты → «Байты → файл»; «Склейка файлов» соединяет их по порядку входов, и получается целый ZIP.',
      'The archive is cut into two parts, and neither opens alone. Each part: Base64 → bytes → "Bytes → file"; "Join files" puts them together in input order, and a whole ZIP comes out.'));
  })();
})(typeof self !== 'undefined' ? self : this);
