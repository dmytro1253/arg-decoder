// Небольшие DOM-помощники для нод пакета «Файлы». Вся логика — в чистых модулях, здесь только вёрстка.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = (G.ArgFiles = G.ArgFiles || {});

  function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function button(label, onClick, cls) {
    const b = h('button', 'btn small' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    b.onclick = onClick;
    return b;
  }

  function field(label, input, cls) {
    const wrap = h('label', 'fx-field' + (cls ? ' ' + cls : ''));
    wrap.append(h('span', 'muted small', label), input);
    return wrap;
  }

  function input(type, value, placeholder) {
    const el = h('input', 'fx-input');
    el.type = type;
    el.value = value === undefined ? '' : value;
    if (placeholder) el.placeholder = placeholder;
    return el;
  }

  function select(options, value) {
    const el = h('select', 'fx-input');
    for (const [v, label] of options) {
      const o = h('option', '', label);
      o.value = v;
      el.appendChild(o);
    }
    el.value = value;
    return el;
  }

  /** Копирование в буфер: современный API, затем запасной через textarea (file:// без разрешения). */
  async function copy(text, ui) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = h('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e2) { /* буфер недоступен */ }
      ta.remove();
    }
    if (ui && ui.toast) ui.toast(T('Скопировано', 'Copied'));
  }

  /**
   * Отправить фрагмент в новую ноду «Ввод». Лид-интеграция: G.ArgFiles.hooks.sendToInput(text, ui)
   * или метод ui.spawnInputNode(text). Без них текст копируется в буфер.
   */
  function sendToInput(text, ui) {
    const hooks = NS.hooks || {};
    if (ui && typeof ui.spawnInputNode === 'function') { ui.spawnInputNode(text); return true; }
    if (typeof hooks.sendToInput === 'function') { hooks.sendToInput(text, ui); return true; }
    copy(text, ui);
    return false;
  }

  /** Сохранить байты как постоянный артефакт проекта и сообщить об этом. */
  async function saveArtifact(bytes, name, mime, ui) {
    try {
      const handle = await NS.saveAsArtifact(bytes, name, mime);
      const hooks = NS.hooks || {};
      if (typeof hooks.artifactSaved === 'function') hooks.artifactSaved(handle, name, ui);
      if (ui && ui.toast) ui.toast(T('Артефакт добавлен: ', 'Artifact added: ') + name + ' (' + NS.fmtSize(bytes.length) + ')');
      return handle;
    } catch (e) {
      if (ui && ui.toast) ui.toast(e.message);
      return null;
    }
  }

  const KV_ROW = (k, v) => {
    const row = h('div', 'fx-kv');
    row.append(h('span', 'fx-k', k), typeof v === 'string' ? h('span', 'fx-v', v) : v);
    return row;
  };

  NS.ui = { h, button, field, input, select, copy, sendToInput, saveArtifact, kv: KV_ROW };
  NS.hooks = NS.hooks || {};
})(typeof self !== 'undefined' ? self : this);
