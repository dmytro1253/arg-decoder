// i18n-file-ok: входные строки и ожидаемые ответы — данные (русские шифртексты старых примеров); причины manual обёрнуты в T.
// Метаданные авто-поиска для старых примеров (presets.js): что подаётся в «⚡ Расшифровать» и какой ответ ожидается,
// либо почему авто-поиск тут не применим («manual»). Для новых примеров по ARG те же поля задаются в самих файлах.
// auto: { input, keys?, profile?, expect, top? } — top = допустимое место ответа в выдаче (по умолчанию первое).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);

  const META = {
    welcome: { auto: { input: '48656C6C6F20776F726C64', expect: 'Hello world' } },
    // Ответ — строка в форме ID: отличить верную от неверной можно только проверкой на YouTube, поэтому допускаем третье место.
    vigenere: { auto: { input: 'h2njbrLB5kj', keys: ['yfqlbvtyz'], profile: 'mslan', expect: 'j2itqqQI5mk', top: 3 } },
    hex23: { auto: { input: '54303958533C3C634B3121', profile: 'mslan', expect: 'kGPojSSzbH8' } },
    ktoty: { auto: { input: '14444214452714444620144527144543142847', expect: 'КТО ТЫ?' } },
    catbox: { auto: { input: '81939389921428421427471427477982857892237674937588972386887814274726809484759523898780', expect: 'https://files.catbox.moe/1gukbv.png' } },
    drive: { auto: { input: '31 6E 7A 47 68 4E 48 56 45 51 48 62 69 36 41 50 7A 55 55 36 42 65 47 70 7A 34 32 37 53 4D 75 62 6D', expect: '1nzGhNHVEQHbi6APzUU6BeGpz427SMubm' } },
    pomogi: { auto: { input: '0YjQu9Cp0YTQvtGK0YjRitCr', expect: 'ПомогиНам' } },
    mask: { manual: T('Маска из двух пропусков перебирается ответами на загадки и проверкой на YouTube — нужен внешний сервис.', 'A mask with two gaps is solved with riddle answers and a YouTube check: an external service is needed.') },
    book: { manual: T('Не разгадано: подтверждённого ответа нет, авто-поиск не должен его выдумывать.', 'Unsolved: there is no confirmed answer and auto must not invent one.') },
    void: { auto: { input: '3F38322D', expect: 'VOID' } },
    'kto-reverse': { auto: { input: 'саНетисапСатсйулажоПьдубиНотК', expect: 'КтоНибудьПожалуйстаСпаситеНас' } },
    fragments: { manual: T('Три фрагмента берутся из описаний разных роликов: склейка — решение человека, не шифр.', 'The three fragments come from the descriptions of different videos: joining them is a human decision, not a cipher.') },
    'key-parts': { manual: T('Ключ собирается из трёх частей разных источников, порядок частей выбирает человек.', 'The key is assembled from three parts of different sources; a human picks the order.') },
    'ru-leet': { auto: { input: '93144543205528206014464714442592281447331445442055144530', profile: 'mslan', expect: 'тЫ Не СпАсешЬ НХ' } },
    kira: { auto: { input: '14462514472514463314444214474214474314452714464314463014', profile: 'mslan', expect: '%елТыъКира', top: 3 } },
    direct: { auto: { input: 'sQjZoZ5abcw', expect: 'sQjZoZ5abcw' } },
    'dng-hex': { auto: { input: '0x7370696365776f6f64', expect: 'spicewood' } },
    'dng-leet': { auto: { input: '1NF3C7ED', expect: 'INFECTED' } },
    'dng-z85': { auto: { input: 'h-9ALhz)lzh-0uLhBxwWhBPIWhz)lzhz)xGhAiP:hz)AH', expect: 'the silence echoes' } },
    'dng-grid': { auto: { input: 'NRCXOJNTNYHJMGSCBPOWIIPCCBVLWM', keys: ['EVERYSOUL'], expect: 'FOLLOWTHESCULKTOTHEANCIENTCITY' } },
    'dng-hexvig': { auto: { input: '77 6C 77 20 79 65 65 77 68 72 20 7A 67 65 65 6C 20 62 73 6D', keys: ['descent'], expect: 'the warden hears you' } },
    'gd-b64': { auto: { input: 'Y3J5c3RhbGxpbmUgdHJ1dGhzIA==', expect: 'crystalline truths ' } },
    sga: { auto: { input: 'ℸ ̣⍑ᒷ ᒷリ↸ ╎ᓭ リᒷ⍊ᒷ∷ ℸ ̣⍑ᒷ ᒷリ↸', expect: 'the end is never the end' } },
    tap: { auto: { input: '.. ...  . .....  .... ..  ... ....  . ..  .... ..  .. ....  ... ...  . .....', expect: 'HEROBRINE' } },
    t9: { auto: { input: '66 666 8 222 44', expect: 'notch' } },
    bacon: { auto: { input: 'ABBAB ABBBA BAABB AAABA AABBB', expect: 'NOTCH' } },
    // «ENDERMAN» — имя собственное из Minecraft, его нет в частотном словаре: чужая подстановка букв слегка обгоняет.
    polybius: { auto: { input: '15 33 14 15 42 32 11 33', expect: 'ENDERMAN', top: 3 } },
    atbash: { auto: { input: 'dzpv fk svilyirmv', expect: 'wake up herobrine' } },
    homoglyph: { auto: { input: 'Thе quick brоwn fох jumps over thе lаzy dog', expect: 'The quick brown fox jumps over the lazy dog' } },
    'numbers-mod': { auto: { input: '27 12 12 15 6 20 8 5 4 15 20 19 1 18 5 6 9 14 1 12 12 25\n19 20 1 18 20 9 14 7 20 15 3 15 14 14 5 3 20,\n23 8 15 11 14 5 23 30 15 12 16 8 9 14 19 23 5 18 5 8 9\n4 9 14 7 19 15 13 21 3 8?', expect: 'ALLOFTHEDOTSAREFINALLYSTARTINGTOCONNECT WHOKNEWDOLPHINSWEREHIDINGSOMUCH', top: 3 } },
    'hex-plain': { auto: { input: '41414141', expect: 'AAAA' } },
    'log-hex': { auto: { input: 'jimmyy1[local:E:73746f70] logged in with entity id 65', expect: 'stop' } },
    'case-bits': { manual: T('Текст читаем «как есть»; скрытый канал (регистр букв) глазами декодера не виден — его надо заподозрить.', 'The text is readable as is; the hidden channel (letter case) is invisible to a decoder: you have to suspect it.') },
  };

  for (const preset of G.Presets) if (META[preset.id]) Object.assign(preset, META[preset.id]);
  G.PresetAutoMeta = META;
})(typeof self !== 'undefined' ? self : this);
