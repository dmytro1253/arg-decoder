// Профили расследований и банк ключей проекта.
// Приложение универсальное: по умолчанию действует профиль «neutral» (без чьих-либо ключей,
// ключевых слов и «любимых» параметров). Дело mslan — один из необязательных профилей.
// KeyBank — ключи, найденные или введённые пользователем в этом проекте, с происхождением каждого.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const LS_PROFILE = 'argdec.profile';
  const LS_KEYBANK = 'argdec.keybank';
  const LS_OLD_KEYS = 'argdec.keys';
  const MAX_KEY = 200;
  const MAX_KEYS = 2000;
  const DEFAULT_PROFILE = 'neutral';

  function store(key, value) {
    try {
      if (G.localStorage) {
        if (value === null) G.localStorage.removeItem(key);
        else G.localStorage.setItem(key, value);
      }
    } catch (e) { /* хранилище недоступно — состояние живёт до перезагрузки */ }
  }
  function fetchStored(key) {
    try { return G.localStorage ? G.localStorage.getItem(key) : null; } catch (e) { return null; }
  }

  // ===================== Банк ключей проекта =====================
  let entries = [];
  const keyListeners = [];

  function normalizeKey(value) {
    return String(value === undefined || value === null ? '' : value).trim().slice(0, MAX_KEY);
  }
  const sameKey = (a, b) => a.toLowerCase() === b.toLowerCase();
  function persistKeys() {
    store(LS_KEYBANK, JSON.stringify(entries));
    for (const fn of keyListeners) { try { fn(entries.slice()); } catch (e) { /* слушатель не должен ломать банк */ } }
  }

  const KeyBank = {
    /** Копия списка: [{ value, source, added }]. */
    list() { return entries.map((e) => ({ ...e })); },
    values() { return entries.map((e) => e.value); },
    has(value) { const v = normalizeKey(value); return !!v && entries.some((e) => sameKey(e.value, v)); },
    sourceOf(value) { const v = normalizeKey(value); const e = entries.find((x) => sameKey(x.value, v)); return e ? e.source : null; },
    /** Добавляет ключ. source — откуда он взят («user», «ROT13 из ноды n3», «лог, строка 14»…). */
    add(value, source) {
      const v = normalizeKey(value);
      if (!v || entries.length >= MAX_KEYS) return null;
      const known = entries.find((e) => sameKey(e.value, v));
      if (known) return { ...known };
      const entry = { value: v, source: String(source || 'user').slice(0, 200), added: Date.now() };
      entries = entries.concat([entry]);
      persistKeys();
      return { ...entry };
    },
    remove(value) {
      const v = normalizeKey(value);
      const next = entries.filter((e) => !sameKey(e.value, v));
      if (next.length === entries.length) return false;
      entries = next;
      persistKeys();
      return true;
    },
    clear() { entries = []; persistKeys(); },
    /** Для сохранения в проект. */
    toJSON() { return entries.map((e) => ({ ...e })); },
    /**
     * Без аргумента — читает сохранённое в браузере (и переносит старый список «Ключи»);
     * с аргументом (массив строк, записей или { keys }) — заменяет банк данными проекта.
     */
    load(data) {
      let list = data;
      if (list === undefined) {
        const raw = fetchStored(LS_KEYBANK);
        try { list = raw ? JSON.parse(raw) : null; } catch (e) { list = null; }
        if (!list) {
          let old = [];
          try { old = JSON.parse(fetchStored(LS_OLD_KEYS) || '[]'); } catch (e) { old = []; }
          list = (Array.isArray(old) ? old : []).map((v) => ({ value: v, source: 'user' }));
        }
      }
      if (list && !Array.isArray(list) && Array.isArray(list.keys)) list = list.keys;
      const next = [];
      for (const item of Array.isArray(list) ? list : []) {
        const isObj = item && typeof item === 'object';
        const v = normalizeKey(isObj ? item.value : item);
        if (!v || next.some((e) => sameKey(e.value, v)) || next.length >= MAX_KEYS) continue;
        next.push({ value: v, source: String((isObj && item.source) || 'user').slice(0, 200), added: Number.isFinite(isObj && item.added) ? item.added : Date.now() });
      }
      entries = next;
      persistKeys();
      return KeyBank.list();
    },
    onChange(fn) { keyListeners.push(fn); },
  };

  // ===================== Профили =====================
  const profiles = new Map();
  const profileListeners = [];
  let activeId = DEFAULT_PROFILE;

  const uniq = (arr) => [...new Set(arr)];

  /** Собирает профиль из описания и добавляет к нему совместимое API «досье» (keys, userKeys…). */
  function makeProfile(spec) {
    const p = Object.assign({
      id: '', name: '', description: '', baseKeys: [], keywords: [], probeShifts: [],
      // Бонусы поиска: у нейтрального профиля все нули.
      bonuses: { favorites: 0, keywords: 0, becameId: 0 },
      // Как опознавать канал автора (точное совпадение, не подстрока).
      authorMatch: { handles: [], channelIds: [], names: [] },
      channel: '', channelId: '', channelUrl: '',
      techniques: [], chain: [], open: [], foreign: [], workflow: [],
    }, spec);
    Object.defineProperties(p, {
      // Все ключи для перебора: сначала ключи проекта, потом встроенные ключи профиля.
      keys: { get() { return uniq(KeyBank.values().concat(p.baseKeys)); }, enumerable: true },
      userKeys: { get() { return KeyBank.values(); }, enumerable: true },
    });
    p.setUserKeys = (list) => { KeyBank.load((list || []).map((k) => ({ value: k, source: KeyBank.sourceOf(k) || 'user' }))); };
    return Object.freeze(p);
  }

  const NEUTRAL = makeProfile({
    id: 'neutral',
    name: T('Нейтральный', 'Neutral'),
    description: T('Универсальный режим: без чужих ключей, ключевых слов и «любимых» параметров. Поиск опирается только на язык, структуру и ключи вашего проекта.', 'The universal mode: no foreign keys, keywords or favourite parameters. Search relies only on language, structure and your project keys.'),
    techniques: [
      [T('HEX → ASCII', 'HEX → ASCII'), '48 65 6C 6C 6F → Hello'],
      [T('Цезарь / ROT13', 'Caesar / ROT13'), 'raqrezvgr → endermite'],
      [T('Виженер с ключом', 'Vigenère with a key'), 'LMVCCIKB + LUCY → ASTEROID'],
      [T('Числа → буквы по модулю', 'Numbers → letters modulo'), '27 12 12 15 → ALLO'],
    ],
    workflow: [
      T('Сохранить точный оригинал: регистр, переносы, подчёркивания, нули.', 'Keep the exact original: case, line breaks, underscores, zeros.'),
      T('Похоже на ссылку или ID — сначала проверить без преобразований.', 'Looks like a link or an ID — check it as is first.'),
      T('Чётная строка из 0-9A-F — HEX → байты.', 'An even string of 0-9A-F — HEX → bytes.'),
      T('Только цифры — пары/тройки, номера букв (в том числе по модулю).', 'Digits only — pairs/triples, letter numbers (also modulo).'),
      T('Появились %HH — URL-декодирование, CP1251 или UTF-8.', 'If %HH appears — URL decoding, CP1251 or UTF-8.'),
      T('Найденное слово может быть ключом к другой улике — добавьте его в банк ключей.', 'A found word may be the key to another clue — add it to the key bank.'),
      T('Находку подтверждать внешним источником, а не только формой строки.', 'Confirm a finding with an outside source, not only by the shape of the string.'),
    ],
  });

  const MSLAN = makeProfile({
    id: 'mslan',
    name: 'mslan',
    description: T('Дело mslan: ключи, ключевые слова и приёмы этого автора (+23, раскладка, Виженер). Включайте только для этого расследования.', 'The mslan case: this author’s keys, keywords and habits (+23, keyboard layout, Vigenère). Enable it only for that investigation.'),
    baseKeys: ['yfqlbvtyz', 'найдименя', 'mslan', 'mslangreen', 'mslangreen143', 'mslang', 'void', 'ктоты', 'whoareyou', 'сансара', 'навсегда', 'прощай', 'помогинам', 'дневник', 'danny', 'дэнни', 'zombie', 'зомби', '836', '1836', '839', '23', '143', '34'], // i18n-ok: данные
    keywords: ['mslan', 'youtube', 'youtu.be', 'drive.google', 'catbox', 'найди', 'помоги', 'кто ты', 'void', 'наблюдал', 'самим собой'], // i18n-ok: данные
    bonuses: { favorites: 8, keywords: 15, becameId: 35 },
    // Сдвиги кодов, которые автор любит (пробуются как ±N).
    probeShifts: [23],
    authorMatch: { handles: ['mslangreen'], channelIds: ['UC3_d3GMJAzf6eUOS_nXsfDw'], names: ['mslan', 'mslangreen'] },
    channel: '@MslanGreen',
    channelId: 'UC3_d3GMJAzf6eUOS_nXsfDw',
    channelUrl: 'https://www.youtube.com/@MslanGreen',

    techniques: [
      ['HEX → ASCII', T('31 6E 7A 47 … → 1nzGhNHVEQ… (ID папки Google Drive)', '31 6E 7A 47 … → 1nzGhNHVEQ… (a Google Drive folder ID)')],
      [T('Сдвиг кодов +23', 'Code shift +23'), T('?82- → VOID; T09XS<<cK1! → kGPojSSzbH8. Это +23 десятичных, не 0x23', '?82- → VOID; T09XS<<cK1! → kGPojSSzbH8. This is +23 decimal, not 0x23')],
      [T('Пары цифр +23', 'Digit pairs +23'), T('14 44 42 → %CA → после URL-декодирования в CP1251: «КТО ТЫ?»', '14 44 42 → %CA → after URL decoding in CP1251: “КТО ТЫ?”')],
      ['URL + CP1251', '%CA%D2%CE+%D2%DB%3F → КТО ТЫ? (' + T('«+» — пробел', '“+” is a space') + ')'], // i18n-ok: данные
      [T('Раскладка', 'Keyboard layout'), T('yfq lbv tyz → най дим еня (ключ Виженера)', 'yfq lbv tyz → най дим еня (a Vigenère key)')],
      [T('Виженер', 'Vigenère'), T('h2njbrLB5kj + yfqlbvtyz → j2itqqQI5mk, цифры не тратят ключ', 'h2njbrLB5kj + yfqlbvtyz → j2itqqQI5mk, digits do not use up the key')],
      [T('Base64 → реверс → Цезарь', 'Base64 → reverse → Caesar'), T('0YjQu9Cp… → шлЩфоъшъЫ → ЫъшъофЩлш → −12 (33 буквы) → ПомогиНам', '0YjQu9Cp… → шлЩфоъшъЫ → ЫъшъофЩлш → −12 (33 letters) → ПомогиНам')], // i18n-ok: данные
      [T('Реверс', 'Reverse'), 'саНетисапС… → КтоНибудьПожалуйстаСпаситеНас'], // i18n-ok: данные
      [T('Маска ID', 'ID mask'), T('_y_xPVyp_H_ → ответы на загадки + перебор → yygxPVyp8H0', '_y_xPVyp_H_ → riddle answers + brute force → yygxPVyp8H0')],
      [T('Склейка фрагментов', 'Joining fragments'), T('AgL + L2GD + LrgQ из описаний → AgLL2GDLrgQ', 'AgL + L2GD + LrgQ from the descriptions → AgLL2GDLrgQ')],
      [T('Прямой ID', 'Direct ID'), T('sQjZoZ5abcw — сначала проверить без преобразований', 'sQjZoZ5abcw — check it as is first')],
    ],
    chain: [
      [T('Найди меня', 'Find me'), 'AgLL2GDLrgQ', T('Склейка трёх фрагментов из описаний', 'Joining three fragments from the descriptions')],
      [T('Белое пространство', 'White space'), 'JXIHg6qthWk', T('ID в субтитрах', 'ID in the subtitles')],
      [T('Сансара', 'Samsara'), 'j2itqqQI5mk', T('Виженер, ключ yfqlbvtyz', 'Vigenère, key yfqlbvtyz')],
      [T('Навсегда', 'Forever'), 'yygxPVyp8H0', T('Маска + перебор двух пропусков', 'Mask + brute force of two gaps')],
      ['839', 'kGPojSSzbH8', 'HEX → ASCII → +23'],
      [T('прощай.', 'goodbye.'), 'sQjZoZ5abcw', T('Прямой ID', 'Direct ID')],
    ],
    open: [
      [T('Книга: название', 'Book: title'), 'PSRLVMBHALDPRNG (15)'],
      [T('Книга: автор', 'Book: author'), 'CRBLQYCURKUZD (13)'],
      [T('Подсказка автора', 'Author’s hint'), T('«Тот же код что ссылка но с обратной стороны»', '“The same code as the link but from the other side”')],
      [T('Спойлер к финалу', 'Finale spoiler'), T('«всё это время я наблюдал за самим собой»', '“all this time I was watching myself”')],
      [T('Не объяснено', 'Unexplained'), T('табличка 836, порядок слотов 1-8-3-6', 'the 836 sign, slot order 1-8-3-6')],
    ],
    // Что встречалось в зарубежных Minecraft-ARG — на случай, если автор возьмёт приём оттуда.
    foreign: [
      [T('Стол зачарований (SGA)', 'Enchanting table (SGA)'), T('Простая замена букв значками — встречается в головоломках по Minecraft. Нода «Стол зачарований → текст».', 'A simple substitution of letters by glyphs, seen in Minecraft puzzles. The “Enchanting table → text” node.')],
      ['Minecraft Dungeons II ARG', T('hex в адресе ссылки, leet (1NF3C7ED), Z85 → hex, сетка 15×6 с поворотом + Виженер, Атбаш, Цезарь 3 и 9, тап-код, DTMF → телефонная клавиатура, номера букв.', 'hex in a link address, leet (1NF3C7ED), Z85 → hex, a 15×6 grid with rotation + Vigenère, Atbash, Caesar 3 and 9, tap code, DTMF → phone keypad, letter numbers.')],
      [T('Found-footage ARG «книга в мире»', 'Found-footage ARG “book in the world”'), T('Шифр в книге не решался «в лоб»: первые буквы предметов в инвентаре (заглавная — если их несколько) складывались в ссылку на Google Drive. Нода «Буквы из слов (акростих)».', 'The cipher in the book was not solved head-on: the first letters of inventory items (capital if there were several) spelled a Google Drive link. The “Letters from words (acrostic)” node.')],
      [T('Скрытый текст', 'Hidden text'), T('Невидимые символы нулевой ширины в описаниях, кириллица вместо похожей латиницы, коды цвета § в книгах и табличках.', 'Zero-width characters in descriptions, Cyrillic instead of look-alike Latin, § colour codes in books and signs.')],
      [T('Звук и картинки', 'Audio and images'), T('Спектрограмма, SSTV, DTMF-тоны, азбука Морзе в шумах — сначала извлечь вне программы, потом вставить цифры/точки сюда.', 'Spectrogram, SSTV, DTMF tones, Morse in noise — extract them first, then paste the digits/dots here.')],
    ],
    workflow: [
      T('Сохранить точный оригинал: регистр, подчёркивания, нули.', 'Keep the exact original: case, underscores, zeros.'),
      T('Похоже на ID — сначала проверить прямую ссылку.', 'Looks like an ID — check the direct link first.'),
      T('Чётная строка из 0-9A-F — HEX → байты.', 'An even string of 0-9A-F — HEX → bytes.'),
      T('Только цифры — пары/тройки, сдвиг +23 и обратный.', 'Digits only — pairs/triples, shift +23 and its inverse.'),
      T('Появились %HH — URL-декодирование, CP1251 или UTF-8.', 'If %HH appears — URL decoding, CP1251 or UTF-8.'),
      T('Base64 и реверс, если позволяет формат.', 'Base64 and reverse, if the format allows.'),
      T('Короткие латинские фрагменты — раскладка, сборка ключа.', 'Short Latin fragments — keyboard layout, assembling a key.'),
      T('Девять знаков вопроса — Виженер с буквенным ключом.', 'Nine question marks — Vigenère with a letter key.'),
      T('Маска с пропусками — ограниченный перебор и проверка через YouTube.', 'A mask with gaps — bounded brute force and a YouTube check.'),
      T('Находку подтверждать метаданными канала, а не синтаксисом ID.', 'Confirm a finding by the channel metadata, not the ID syntax.'),
    ],
  });

  profiles.set(NEUTRAL.id, NEUTRAL);
  profiles.set(MSLAN.id, MSLAN);

  const Profiles = {
    DEFAULT: DEFAULT_PROFILE,
    list() { return [...profiles.values()]; },
    get(id) { return profiles.get(id) || null; },
    active() { return profiles.get(activeId); },
    setActive(id) {
      const p = profiles.get(id);
      if (!p) throw new Error(T('Нет такого профиля: ' + id, 'No such profile: ' + id));
      activeId = id;
      store(LS_PROFILE, id);
      for (const fn of profileListeners) { try { fn(p); } catch (e) { /* слушатель не должен ломать переключение */ } }
      return p;
    },
    /** Все ключи для перебора: банк проекта + встроенные ключи активного профиля. */
    keys() { return Profiles.active().keys; },
    /** Регистрирует свой профиль (например, из файла дела). */
    register(spec) {
      if (!spec || !spec.id || profiles.has(spec.id)) throw new Error(T('Профиль уже есть или без id', 'The profile already exists or has no id'));
      const p = makeProfile(spec);
      profiles.set(p.id, p);
      return p;
    },
    onChange(fn) { profileListeners.push(fn); },
  };

  KeyBank.load();
  const saved = fetchStored(LS_PROFILE);
  if (saved && profiles.has(saved)) activeId = saved;

  G.KeyBank = KeyBank;
  G.Profiles = Profiles;
  // Совместимость: AuthorProfile всегда указывает на активный профиль.
  Object.defineProperty(G, 'AuthorProfile', { get() { return Profiles.active(); }, set() { /* только чтение */ }, configurable: true, enumerable: true });
})(typeof self !== 'undefined' ? self : this);
