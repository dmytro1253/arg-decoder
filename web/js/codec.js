// Низкоуровневые помощники: алфавиты, байтовые строки, CP1251, раскладка, Морзе.
// «Байтовая строка» — JS-строка, где каждый символ имеет код 0..255.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);

  const ALPHABETS = {
    en: 'abcdefghijklmnopqrstuvwxyz',
    ru33: 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя', // i18n-ok: данные
    ru32: 'абвгдежзийклмнопрстуфхцчшщъыьэюя', // i18n-ok: данные
    uk33: 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя', // i18n-ok: данные
    uk32: 'абвгдеєжзиіїйклмнопрстуфхцчшщьюя', // i18n-ok: данные
  };

  const ALPHABET_OPTIONS = [
    ['auto', T('Авто (лат + кир)', 'Auto (Latin + Cyrillic)')],
    ['en', T('Латиница (26)', 'Latin (26)')],
    ['ru33', T('Кириллица с Ё (33)', 'Cyrillic with Ё (33)')],
    ['ru32', T('Кириллица без Ё (32)', 'Cyrillic without Ё (32)')],
    ['uk33', T('Украинский (33)', 'Ukrainian (33)')],
    ['uk32', T('Украинский без Ґ (32)', 'Ukrainian without Ґ (32)')],
  ];

  // Буквы всех поддерживаемых алфавитов: латиница, русская и украинская кириллица (в т. ч. ґ є і ї).
  const LETTER_CLASS = 'a-zа-яёіїєґ'; // i18n-ok: данные
  const CYR_CLASS = 'а-яёіїєґ'; // i18n-ok: данные
  const UPPER_CLASS = 'A-ZА-ЯЁІЇЄҐ'; // i18n-ok: данные
  const UK_ONLY = /[іїєґ]/i;
  const RU_ONLY = /[ыэъё]/i;

  function isLatin(ch) { return /[a-z]/i.test(ch); }
  function isCyr(ch) { return /[а-яёіїєґ]/i.test(ch); }
  function isLetter(ch) { return /[a-zа-яёіїєґ]/i.test(ch); }

  // Какую кириллицу считать в режиме «auto»: украинскую, если в тексте есть ґ є і ї и нет ы э ъ ё.
  function autoCyrillic(text) {
    return UK_ONLY.test(text) && !RU_ONLY.test(text) ? 'uk33' : 'ru33';
  }

  // Для режима «auto»: латинский символ — en, кириллический — ru33 (или uk33, см. autoCyrillic).
  function alphabetFor(ch, mode, cyr) {
    if (mode !== 'auto') return ALPHABETS[mode];
    if (isLatin(ch)) return ALPHABETS.en;
    if (isCyr(ch)) return ALPHABETS[cyr || 'ru33'];
    return null;
  }

  // Применяет fn(index, alphabetLength, alphabet) к буквам с сохранением регистра.
  // fn возвращает новый индекс или null (оставить символ как есть).
  function mapLetters(text, mode, fn) {
    let out = '';
    let letterNo = 0;
    const cyr = mode === 'auto' ? autoCyrillic(text) : null;
    for (const ch of text) {
      const alpha = alphabetFor(ch, mode, cyr);
      const lower = ch.toLowerCase();
      const idx = alpha ? alpha.indexOf(lower) : -1;
      if (idx < 0) { out += ch; continue; }
      const res = fn(idx, alpha.length, alpha, letterNo++);
      if (res === null || res === undefined) { out += ch; continue; }
      const mapped = alpha[((res % alpha.length) + alpha.length) % alpha.length];
      out += ch === lower ? mapped : mapped.toUpperCase();
    }
    return out;
  }

  function mod(a, m) { return ((a % m) + m) % m; }

  function modInverse(a, m) {
    a = mod(a, m);
    for (let x = 1; x < m; x++) if ((a * x) % m === 1) return x;
    return null;
  }

  // ---------- CP1251 ----------
  const CP1251_HIGH =
    'ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—�™љ›њќћџ ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї°±Ііґµ¶·ё№є»јЅѕї' + // i18n-ok: данные
    'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя'; // i18n-ok: данные
  const CP1251_ENC = new Map();
  for (let i = 0; i < 128; i++) CP1251_ENC.set(String.fromCharCode(i), i);
  for (let i = 0; i < 128; i++) CP1251_ENC.set(CP1251_HIGH[i], 128 + i);

  // KOI8-R: верхняя половина (0x80–0xFF) записана явно, чтобы кодирование не зависело от TextEncoder.
  const KOI8R_HIGH =
    '─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ё╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡Ё╢╣╤╥╦╧╨╩╪╫╬©' + // i18n-ok: данные
    'юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ'; // i18n-ok: данные
  const KOI8R_ENC = new Map();
  for (let i = 0; i < 128; i++) KOI8R_ENC.set(String.fromCharCode(i), i);
  for (let i = 0; i < 128; i++) KOI8R_ENC.set(KOI8R_HIGH[i], 128 + i);

  function decodeBytes(bin, encoding) {
    if (encoding === 'latin1') return bin;
    if (encoding === 'koi8r') {
      let out = '';
      for (let i = 0; i < bin.length; i++) {
        const c = bin.charCodeAt(i);
        out += c < 128 ? bin[i] : KOI8R_HIGH[c - 128];
      }
      return out;
    }
    if (encoding === 'cp1251') {
      let out = '';
      for (let i = 0; i < bin.length; i++) {
        const c = bin.charCodeAt(i);
        out += c < 128 ? bin[i] : CP1251_HIGH[c - 128];
      }
      return out;
    }
    const bytes = binToArray(bin);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      throw new Error(T('Байты не являются корректным UTF-8', 'The bytes are not valid UTF-8'));
    }
  }

  function encodeText(text, encoding) {
    if (encoding === 'cp1251') {
      let out = '';
      for (const ch of text) {
        const b = CP1251_ENC.get(ch);
        if (b === undefined) throw new Error(T('Символ «' + ch + '» нельзя записать в CP1251', 'Character “' + ch + '” cannot be written in CP1251'));
        out += String.fromCharCode(b);
      }
      return out;
    }
    if (encoding === 'koi8r') {
      let out = '';
      for (const ch of text) {
        const b = KOI8R_ENC.get(ch);
        if (b === undefined) throw new Error(T('Символ «' + ch + '» нельзя записать в KOI8-R', 'Character “' + ch + '” cannot be written in KOI8-R'));
        out += String.fromCharCode(b);
      }
      return out;
    }
    if (encoding === 'latin1') {
      for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) > 255) throw new Error(T('Символ «' + text[i] + '» не помещается в один байт', 'Character “' + text[i] + '” does not fit in one byte'));
      }
      return text;
    }
    return arrayToBin(new TextEncoder().encode(text));
  }

  // Строка целиком состоит из «байтовых» символов 0..255?
  function isByteString(text) {
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) > 255) return false;
    return true;
  }

  // Текст → байты «как есть», если он уже байтовый, иначе UTF-8. Двусмысленно для «é»:
  // операции, где важна однозначность, берут явный параметр кодировки (encodeText).
  function toBytesAuto(text) {
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) > 255) return encodeText(text, 'utf8');
    return text;
  }

  function binToArray(bin) {
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i) & 255;
    return arr;
  }

  function arrayToBin(arr) {
    let out = '';
    for (let i = 0; i < arr.length; i += 4096) out += String.fromCharCode.apply(null, arr.subarray ? arr.subarray(i, i + 4096) : arr.slice(i, i + 4096));
    return out;
  }

  // ---------- Раскладка клавиатуры ----------
  const LAYOUT_EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`QWERTYUIOP{}ASDFGHJKL:\"ZXCVBNM<>~";
  const LAYOUT_RU = 'йцукенгшщзхъфывапролджэячсмитьбюёЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮЁ'; // i18n-ok: данные
  const EN2RU = new Map();
  const RU2EN = new Map();
  for (let i = 0; i < LAYOUT_EN.length; i++) {
    EN2RU.set(LAYOUT_EN[i], LAYOUT_RU[i]);
    RU2EN.set(LAYOUT_RU[i], LAYOUT_EN[i]);
  }
  // Украинская ЙЦУКЕН: на месте ъ ы э ё — ї і є и апостроф.
  const LAYOUT_UK = "йцукенгшщзхїфівапролджєячсмитьбю'ЙЦУКЕНГШЩЗХЇФІВАПРОЛДЖЄЯЧСМИТЬБЮ₴"; // i18n-ok: данные
  const EN2UK = new Map();
  const UK2EN = new Map();
  for (let i = 0; i < LAYOUT_EN.length; i++) {
    EN2UK.set(LAYOUT_EN[i], LAYOUT_UK[i]);
    UK2EN.set(LAYOUT_UK[i], LAYOUT_EN[i]);
  }
  function layout(text, dir) {
    const map = { ru2en: RU2EN, en2uk: EN2UK, uk2en: UK2EN }[dir] || EN2RU;
    let out = '';
    for (const ch of text) out += map.has(ch) ? map.get(ch) : ch;
    return out;
  }

  // ---------- Транслитерация ----------
  const TRANSLIT = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k',
    л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  const BACK_TRANSLIT = [
    ['shch', 'щ'], ['yo', 'ё'], ['zh', 'ж'], ['kh', 'х'], ['ts', 'ц'], ['ch', 'ч'], ['sh', 'ш'], // i18n-ok: данные
    ['yu', 'ю'], ['ya', 'я'], ['a', 'а'], ['b', 'б'], ['v', 'в'], ['g', 'г'], ['d', 'д'], ['e', 'е'], // i18n-ok: данные
    ['z', 'з'], ['i', 'и'], ['y', 'ы'], ['k', 'к'], ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'], // i18n-ok: данные
    ['p', 'п'], ['r', 'р'], ['s', 'с'], ['t', 'т'], ['u', 'у'], ['f', 'ф'], ['h', 'х'], ['c', 'ц'], // i18n-ok: данные
    ['j', 'й'], ['w', 'в'], ['x', 'кс'], ['q', 'к'], // i18n-ok: данные
  ];
  function translitRuToLat(text) {
    let out = '';
    for (const ch of text) {
      const low = ch.toLowerCase();
      if (!(low in TRANSLIT)) { out += ch; continue; }
      const t = TRANSLIT[low];
      out += ch === low ? t : t.charAt(0).toUpperCase() + t.slice(1);
    }
    return out;
  }
  function translitLatToRu(text) {
    let out = '';
    let i = 0;
    while (i < text.length) {
      let matched = false;
      for (const [lat, ru] of BACK_TRANSLIT) {
        const part = text.substr(i, lat.length);
        if (part.toLowerCase() === lat) {
          out += part[0] === part[0].toUpperCase() && part[0] !== part[0].toLowerCase() ? ru.toUpperCase() : ru;
          i += lat.length;
          matched = true;
          break;
        }
      }
      if (!matched) out += text[i++];
    }
    return out;
  }

  // ---------- Морзе ----------
  const MORSE_EN = {
    a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---',
    k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-',
    u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..',
    0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...',
    8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.',
    '-': '-....-', ':': '---...', '=': '-...-', '@': '.--.-.',
  };
  const MORSE_RU = {
    а: '.-', б: '-...', в: '.--', г: '--.', д: '-..', е: '.', ж: '...-', з: '--..', и: '..', й: '.---',
    к: '-.-', л: '.-..', м: '--', н: '-.', о: '---', п: '.--.', р: '.-.', с: '...', т: '-', у: '..-',
    ф: '..-.', х: '....', ц: '-.-.', ч: '---.', ш: '----', щ: '--.-', ъ: '--.--', ы: '-.--', ь: '-..-',
    э: '..-..', ю: '..--', я: '.-.-',
    0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...',
    8: '---..', 9: '----.', '.': '......', ',': '.-.-.-', '?': '..--..', '!': '--..--',
  };
  function invert(obj) {
    const m = new Map();
    for (const k of Object.keys(obj)) m.set(obj[k], k);
    return m;
  }
  const MORSE_DEC = { en: invert(MORSE_EN), ru: invert(MORSE_RU) };
  const MORSE_ENC = { en: MORSE_EN, ru: MORSE_RU };

  // Безопасное отображение байтовых/управляющих символов.
  function visible(text) {
    let out = '';
    for (const ch of text) {
      const c = ch.codePointAt(0);
      if (c === 10) out += '↵\n';
      else if (c === 9) out += '⇥';
      else if (c < 32 || (c >= 127 && c < 160)) out += '·';
      else out += ch;
    }
    return out;
  }

  function toHexView(text) {
    const parts = [];
    for (const ch of text) {
      const c = ch.codePointAt(0);
      parts.push(c < 256 ? c.toString(16).toUpperCase().padStart(2, '0') : 'U+' + c.toString(16).toUpperCase());
    }
    return parts.join(' ');
  }

  G.Codec = {
    ALPHABETS, ALPHABET_OPTIONS, alphabetFor, autoCyrillic, mapLetters, mod, modInverse, isLatin, isCyr, isLetter,
    LETTER_CLASS, CYR_CLASS, UPPER_CLASS, KOI8R_HIGH, isByteString,
    decodeBytes, encodeText, toBytesAuto, binToArray, arrayToBin, layout,
    translitRuToLat, translitLatToRu, MORSE_DEC, MORSE_ENC, visible, toHexView,
  };
})(typeof self !== 'undefined' ? self : this);
