// Интерфейс на трёх языках: русский, English, українська. Каждая видимая строка пишется как T('Русский', 'English');
// украинский берётся из словаря web/js/i18n-uk.js по русскому тексту (точные строки и шаблоны с {0}, {1}…).
// Язык хранится в localStorage; смена языка перезагружает страницу, чтобы все модули перерисовались.
(function (G) {
  'use strict';
  const KEY = 'argdec.lang';
  const SUPPORTED = ['ru', 'en', 'uk'];
  const cache = new Map();
  let compiled = null;

  // Шаблон «Ключ {0} вне 0..255» → регулярка; украинский шаблон получает те же значения по номерам.
  function patterns() {
    if (compiled) return compiled;
    const dict = G.I18N_UK || { patterns: [] };
    compiled = dict.patterns.map(([ru, uk]) => {
      const order = [];
      const re = new RegExp('^' + ru.split(/(\{\d+\})/).map((part) => {
        const m = part.match(/^\{(\d+)\}$/);
        if (m) { order.push(Number(m[1])); return '([\\s\\S]*?)'; }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('') + '$');
      return { re, order, uk };
    });
    return compiled;
  }

  /** Украинский текст для русской строки интерфейса; без перевода — исходная строка. */
  function uk(ru) {
    if (typeof ru !== 'string' || !ru) return ru;
    const dict = G.I18N_UK;
    if (!dict) return ru;
    if (Object.prototype.hasOwnProperty.call(dict.exact, ru)) return dict.exact[ru];
    if (cache.has(ru)) return cache.get(ru);
    let out = ru;
    for (const p of patterns()) {
      const m = ru.match(p.re);
      if (!m) continue;
      const values = {};
      p.order.forEach((n, i) => { values[n] = m[i + 1]; });
      out = p.uk.replace(/\{(\d+)\}/g, (_, n) => (values[n] !== undefined ? values[n] : ''));
      break;
    }
    if (cache.size < 5000) cache.set(ru, out);
    return out;
  }

  function detect() {
    // ?lang=en|ru в адресе важнее сохранённого выбора (ссылки, скриншоты).
    try {
      const fromUrl = G.location && new URLSearchParams(G.location.search).get('lang');
      if (SUPPORTED.includes(fromUrl)) return fromUrl;
    } catch (e) { /* нет location в тестовом окружении */ }
    try {
      const saved = G.localStorage && G.localStorage.getItem(KEY);
      if (SUPPORTED.includes(saved)) return saved;
    } catch (e) { /* хранилище недоступно */ }
    const nav = (G.navigator && (G.navigator.language || '')) || '';
    if (/^uk/i.test(nav)) return 'uk';
    return /^(ru|be|kk)/i.test(nav) ? 'ru' : 'en';
  }

  const I18n = {
    lang: detect(),
    SUPPORTED,
    /** Строка на текущем языке. */
    t(ru, en) {
      if (I18n.lang === 'en') return en !== undefined ? en : ru;
      return I18n.lang === 'uk' ? uk(ru) : ru;
    },
    uk,
    /** Локаль для чисел и дат. */
    locale() { return { en: 'en-GB', uk: 'uk-UA' }[I18n.lang] || 'ru-RU'; },
    set(lang) {
      if (!SUPPORTED.includes(lang) || lang === I18n.lang) return;
      try { G.localStorage.setItem(KEY, lang); } catch (e) { /* без хранилища язык живёт до перезагрузки */ }
      I18n.lang = lang;
      // Явный ?lang= в адресе важнее сохранённого выбора: при смене языка его нужно заменить, иначе после
      // перезагрузки адрес снова выберет старый язык (с ?lang=uk кнопки EN/RU не работали).
      try {
        const url = new URL(G.location.href);
        if (url.searchParams.has('lang')) {
          url.searchParams.set('lang', lang);
          G.location.replace(url.href);
          return;
        }
      } catch (e) { /* нет location в тестовом окружении */ }
      if (G.location && G.location.reload) G.location.reload();
    },
  };

  G.I18n = I18n;
  G.T = I18n.t;
})(typeof self !== 'undefined' ? self : this);
