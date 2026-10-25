// Карточка справки по ноде: что делает, вход, пример, параметры, что сохраняется, как проверить, ссылки.
// Данные — в help-data*.js (G.HelpData). Карточка открывается кнопкой «?» на ноде; короткая строка
// (G.Help.short) используется во всплывающих подсказках палитры и быстрого поиска.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const MARGIN = 10;
  const SHORT_MAX = 150;

  const langIndex = () => (G.I18n && G.I18n.lang === 'en' ? 1 : 0);
  // Значение — строка или пара ['русский', 'English'].
  const pick = (v) => (Array.isArray(v) ? (G.I18n && G.I18n.lang === 'uk' ? G.I18n.uk(v[0]) : v[langIndex()]) : v);
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  /** Запись справки по типу ноды ('op:hex_decode' или 'view'). */
  function lookup(type) {
    const data = G.HelpData;
    if (!data) return null;
    const id = String(type).startsWith('op:') ? String(type).slice(3) : String(type);
    const entry = data.get(id);
    if (!entry) return null;
    const d = data.defaults;
    return {
      id,
      inp: pick(entry.inp || d.inp),
      what: pick(entry.what),
      ex: entry.ex ? [pick(entry.ex[0]), pick(entry.ex[1])] : null,
      par: pick(entry.par === null ? d.par : entry.par || d.par),
      keep: pick(entry.keep || d.keep),
      chk: pick(entry.chk || d.chk),
      wiki: entry.wiki || null,
      std: entry.std || null,
      demo: entry.demo || null,
    };
  }

  /** Ссылка на статью Википедии на языке интерфейса. Поиск с «go» сразу ведёт на статью с точным названием. */
  function wikiUrl(entry) {
    if (!entry || !entry.wiki) return null;
    const en = langIndex() === 1 || (G.I18n && G.I18n.lang === 'uk');
    const raw = String(entry.wiki[en ? 0 : 1] || entry.wiki[0]).split('#')[0].replace(/_/g, ' ');
    return 'https://' + (en ? 'en' : 'ru') + '.wikipedia.org/wiki/Special:Search?go=Go&search=' + encodeURIComponent(raw);
  }

  /** Короткая строка справки: первое предложение описания (для подсказок). */
  function short(type) {
    const e = lookup(type);
    if (!e) return '';
    const first = e.what.split(/(?<=[.!?])\s/)[0];
    return first.length > SHORT_MAX ? first.slice(0, SHORT_MAX - 1) + '…' : first;
  }

  /** Есть ли пример-пресет, видимый при текущем профиле. */
  function presetFor(demo) {
    if (!demo || !G.Presets) return null;
    const preset = G.Presets.find((p) => p.id === demo);
    if (!preset) return null;
    const active = G.Profiles ? G.Profiles.active().id : 'neutral';
    return !preset.profile || preset.profile === 'neutral' || preset.profile === active ? preset : null;
  }

  /** Примеры, где есть нода этого типа: сначала короткие учебные (по одной технике), потом остальные. */
  function examplesFor(type) {
    if (!type || !G.Presets) return [];
    const list = G.Presets.filter((p) => (p.nodes || []).some((n) => n.type === type));
    const rank = (p) => (/^tour-/.test(p.id) ? 0 : 1) * 1000 + (p.nodes || []).length;
    return list.sort((a, b) => rank(a) - rank(b));
  }

  // ---------- карточка ----------
  let card = null;
  let cardType = null;
  let onDocDown = null;
  let onKey = null;

  function close() {
    if (!card) return;
    card.remove();
    document.removeEventListener('pointerdown', onDocDown, true);
    document.removeEventListener('keydown', onKey, true);
    card = null;
    cardType = null;
  }

  function section(box, title, text) {
    const s = el('div', 'help-sec');
    s.append(el('div', 'help-label', title), el('div', 'help-text', text));
    box.appendChild(s);
  }

  function paramFields(def) {
    const labels = (def.params || []).filter((p) => p.label && p.type !== 'hidden').map((p) => p.label);
    return labels.length ? labels.slice(0, 14).join(' · ') : '';
  }

  function linkRow(e) {
    const row = el('div', 'help-links');
    const addLink = (label, href) => {
      const a = el('a', 'help-link', label);
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      row.appendChild(a);
    };
    const wiki = wikiUrl(e);
    if (wiki) addLink(T('Википедия ↗', 'Wikipedia ↗'), wiki);
    if (e.std) addLink(e.std[0] + ' ↗', e.std[1]);
    return row;
  }

  function buildCard(type, def, e) {
    const box = el('div', 'help-card');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', def.name);
    const head = el('div', 'help-head');
    const title = el('h3', '', def.name);
    const closeBtn = el('button', 'icon help-close', '×');
    closeBtn.title = T('Закрыть (Esc)', 'Close (Esc)');
    closeBtn.onclick = close;
    head.append(title, closeBtn);
    box.appendChild(head);

    box.appendChild(el('div', 'help-what', e.what));
    section(box, T('Вход', 'Input'), e.inp);
    if (e.ex) {
      const ex = el('div', 'help-sec');
      ex.appendChild(el('div', 'help-label', T('Пример', 'Example')));
      const row = el('div', 'help-ex');
      row.append(el('code', 'help-code', e.ex[0]), el('span', 'help-arrow', '→'), el('code', 'help-code', e.ex[1]));
      ex.appendChild(row);
      box.appendChild(ex);
    }
    section(box, T('Параметры', 'Parameters'), e.par);
    const fields = paramFields(def);
    if (fields) box.lastChild.appendChild(el('div', 'help-fields', fields));
    section(box, T('Что сохраняется и что теряется', 'What is kept and what is lost'), e.keep);
    section(box, T('Как проверить ответ', 'How to verify the answer'), e.chk);

    const foot = el('div', 'help-foot');
    foot.appendChild(linkRow(e));
    // Пример из справки, иначе — короткий пример, где эта нода уже стоит и подключена.
    const found = examplesFor(type);
    const demo = presetFor(e.demo);
    const preset = demo || found[0] || null;
    if (preset && G.Help.openExample) {
      const btn = el('button', 'btn small accent', T('Открыть пример', 'Open example'));
      btn.title = preset.title;
      btn.onclick = () => { close(); G.Help.openExample(preset); };
      foot.appendChild(btn);
    }
    box.appendChild(foot);
    const more = found.filter((p) => p !== preset).slice(0, 3);
    if (more.length && G.Help.openExample) {
      const list = el('div', 'help-sec help-more');
      list.appendChild(el('div', 'help-label', T('Ещё примеры с этой нодой', 'More examples with this node') + ' (' + (found.length - (found.includes(preset) ? 1 : 0)) + ')'));
      for (const p of more) {
        const b = el('button', 'help-ex-link', p.title);
        b.title = p.desc || '';
        b.onclick = () => { close(); G.Help.openExample(p); };
        list.appendChild(b);
      }
      box.appendChild(list);
    }
    return box;
  }

  function place(box, anchor) {
    const a = anchor.getBoundingClientRect();
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    let left = Math.min(a.left, window.innerWidth - w - MARGIN);
    left = Math.max(MARGIN, left);
    let top = a.bottom + 6;
    if (top + h > window.innerHeight - MARGIN) top = Math.max(MARGIN, a.top - h - 6);
    box.style.left = left + 'px';
    box.style.top = top + 'px';
  }

  /** Открывает карточку у кнопки anchor; повторный вызов для той же ноды закрывает её. */
  function toggle(type, anchor, fallbackToast) {
    if (card && cardType === type && card.dataset.anchor === (anchor && anchor.dataset.helpFor)) { close(); return; }
    close();
    const def = G.typeDef(type);
    const e = lookup(type);
    if (!def || !e) {
      if (fallbackToast) fallbackToast((def && (def.desc || def.name)) || String(type));
      return;
    }
    card = buildCard(type, def, e);
    cardType = type;
    card.dataset.anchor = (anchor && anchor.dataset.helpFor) || '';
    document.body.appendChild(card);
    place(card, anchor);
    onDocDown = (ev) => { if (card && !card.contains(ev.target) && ev.target !== anchor) close(); };
    onKey = (ev) => { if (ev.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onDocDown, true);
    document.addEventListener('keydown', onKey, true);
    const btn = card.querySelector('.help-close');
    if (btn) btn.focus({ preventScroll: true });
  }

  G.Help = { lookup, short, wikiUrl, toggle, close, presetFor, examplesFor, openExample: null };
})(typeof self !== 'undefined' ? self : this);
