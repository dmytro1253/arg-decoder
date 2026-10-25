// Нода «Архив»: список ZIP/JAR/gzip, извлечение записи как нового артефакта (с паролем ZipCrypto,
// с вложенными архивами), константы .class и поиск по содержимому всех записей.
// RAR/7z и WinZip-AES распаковывает отдельная нода «Архив RAR/7z (7-Zip)» (node-archive7z.js).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = G.ArgFiles;
  const U = NS.ui;
  const NT = G.NodeTypes || (G.NodeTypes = {});

  const MAX_ROWS = 300;
  const ARC_KEY = 'files:archive:';
  const NESTED_RE = /\.(zip|jar|apk|war|docx|xlsx|pptx|gz)$/i;

  function openCached(value, bytes) {
    const A = G.Artifacts;
    const key = ARC_KEY + A.idOf(value);
    const cached = A.runtimeGet(key);
    if (cached && cached.size === bytes.length) return cached.archive;
    const archive = NS.Archive.open(bytes);
    A.runtimeSet(key, { size: bytes.length, archive });
    return archive;
  }

  function extractHandle(value, bytes, p) {
    if (!String(p.entry).trim()) throw new Error(T('Укажи запись (имя, #номер или путь «a.zip!b.txt»)', 'Specify an entry (name, #index or a path like “a.zip!b.txt”)'));
    const r = NS.Archive.resolve(bytes, p.entry, p.password);
    const f = NS.Signatures.detect(r.bytes);
    const key = 'arc_' + G.Artifacts.idOf(value) + '_' + NS.keyOf(p.entry + '\u0000' + p.password);
    return NS.derive(key, NS.Archive.baseName(r.name), r.bytes, f.mime);
  }

  function classText(bytes, p) {
    const target = String(p.entry).trim() ? NS.Archive.resolve(bytes, p.entry, p.password).bytes : bytes;
    return NS.ClassFile.describe(target, { all: !p.literalsOnly });
  }

  function searchText(bytes, p, node) {
    if (!String(p.pattern).trim()) throw new Error(T('Введи, что искать (регулярное выражение)', 'Enter what to search for (a regular expression)'));
    const r = NS.Archive.grep(bytes, p.pattern, p.password);
    node.state.search = r;
    return r.lines.join('\n');
  }

  function compute([v], p, node) {
    const bytes = NS.requireArtifactBytes(v);
    node.state.handle = v;
    node.state.bytes = bytes;
    node.state.archive = null;
    node.state.search = null;
    if (p.output === 'class' && !String(p.entry).trim() && NS.Signatures.detect(bytes).id === 'class') return classText(bytes, p);
    node.state.archive = openCached(v, bytes);
    switch (p.output) {
      case 'extract': return extractHandle(v, bytes, p);
      case 'class': return classText(bytes, p);
      case 'search': return searchText(bytes, p, node);
      default: return NS.Archive.listing(node.state.archive);
    }
  }

  // ---------- интерфейс ----------
  async function saveEntry(node, entry, ui) {
    const a = node.state.archive;
    try {
      const data = await a.readAsync(entry, node.params.password);
      const f = NS.Signatures.detect(data);
      await U.saveArtifact(data, NS.Archive.baseName(entry.name), f.mime, ui);
    } catch (e) {
      ui.toast(e.message);
    }
  }

  function entryRow(node, e, ui) {
    const row = U.h('div', 'fx-row fx-entry');
    const flag = e.aes ? ' AES' : e.encrypted ? ' 🔒' : '';
    row.append(U.h('span', 'fx-name', e.name + flag), U.h('span', 'muted small fx-size', e.isDir ? '' : NS.fmtSize(e.size || 0)));
    if (e.isDir) return row;
    const pick = (output) => { node.params.entry = e.name; node.params.output = output; ui.requestEval(); };
    row.append(U.button(T('→ артефакт', '→ artifact'), () => saveEntry(node, e, ui), 'tiny'),
      U.button(T('на выход', 'to output'), () => pick('extract'), 'tiny'));
    if (/\.class$/i.test(e.name)) row.append(U.button(T('константы', 'constants'), () => pick('class'), 'tiny'));
    else if (NESTED_RE.test(e.name)) row.title = T('Вложенный архив: «на выход» и подключи ещё одну ноду «Архив»', 'Nested archive: use “to output” and connect another Archive node');
    return row;
  }

  function renderList(node, box, ui) {
    const a = node.state.archive;
    const filter = U.input('text', node.state.filter || '', T('фильтр по имени', 'filter by name'));
    const list = U.h('div', 'fx-list');
    const draw = () => {
      node.state.filter = filter.value;
      list.innerHTML = '';
      const q = filter.value.toLowerCase();
      const shown = a.entries.filter((e) => !q || e.name.toLowerCase().includes(q));
      shown.slice(0, MAX_ROWS).forEach((e) => list.appendChild(entryRow(node, e, ui)));
      if (shown.length > MAX_ROWS) list.appendChild(U.h('div', 'muted small', T('…ещё ', '…and ') + (shown.length - MAX_ROWS) + T(' (используй фильтр)', ' (use the filter)')));
    };
    filter.oninput = draw;
    const enc = a.entries.filter((e) => e.encrypted).length;
    const aes = a.entries.filter((e) => e.aes).length;
    const info = a.type.toUpperCase() + ': ' + a.entries.length + T(' записей', ' entries') + (enc ? T(', с паролем: ', ', password-protected: ') + enc : '')
      + (aes ? T(' (AES не поддерживается: ', ' (AES unsupported: ') + aes + ')' : '');
    box.append(U.h('div', 'muted small', info));
    if (a.note) box.append(U.h('div', 'fx-warn', a.note));
    box.append(filter, list);
    draw();
  }

  function renderSearch(node, box) {
    const r = node.state.search;
    if (!r) return;
    box.append(U.h('div', 'muted small', T('Просмотрено записей: ', 'Entries scanned: ') + r.scanned + T(', совпадений: ', ', matches: ') + r.lines.length
      + (r.skipped.length ? T(', пропущено: ', ', skipped: ') + r.skipped.length : '')));
    if (r.skipped.length) box.append(U.h('div', 'muted small', r.skipped.slice(0, 5).join('\n')));
  }

  NT.file_archive = {
    name: T('Архив (ZIP/JAR)', 'Archive (ZIP/JAR)'), cat: 'Файлы', wide: true,
    inputs: [T('файл', 'file')],
    desc: T('Список записей ZIP/JAR/APK/DOCX (имя, размер, метод, пароль), извлечение записи как нового артефакта, пароль ZipCrypto, вложенные архивы («a.zip!b.zip!c.txt»), константы .class и поиск по всем записям. RAR, 7z и WinZip-AES распаковывает нода «Архив RAR/7z (7-Zip)».',
      'Lists ZIP/JAR/APK/DOCX entries (name, size, method, password), extracts an entry as a new artifact, ZipCrypto passwords, nested archives (“a.zip!b.zip!c.txt”), .class constants and search across all entries. RAR, 7z and WinZip-AES are extracted by the Archive RAR/7z (7-Zip) node.'),
    params: [
      { key: 'output', label: T('Выход', 'Output'), type: 'select', default: 'list', options: [['list', T('Список записей (текст)', 'Entry list (text)')], ['extract', T('Запись (артефакт)', 'Entry (artifact)')], ['class', T('Константы .class (текст)', '.class constants (text)')], ['search', T('Поиск по содержимому', 'Search contents')]] },
      { key: 'entry', label: T('Запись (имя, #номер или путь через !)', 'Entry (name, #index or path with !)'), type: 'text', default: '' },
      { key: 'password', label: T('Пароль (ZipCrypto)', 'Password (ZipCrypto)'), type: 'text', default: '' },
      { key: 'pattern', label: T('Поиск (регулярное выражение)', 'Search (regular expression)'), type: 'text', default: '' },
      { key: 'literalsOnly', label: T('.class: только строковые литералы', '.class: string literals only'), type: 'bool', default: false },
    ],
    compute,
    update(node, res, body, ui) {
      const box = body.querySelector('.special') || body.appendChild(U.h('div', 'special'));
      const a = node.state.archive;
      const sig = a ? node.state.handle + '|' + node.params.output + '|' + (node.state.search ? node.state.search.lines.length : '') + '|' + a.entries.length : 'none';
      if (box.dataset.sig === sig && a) return;
      box.dataset.sig = sig;
      box.innerHTML = '';
      if (!a) return;
      renderList(node, box, ui);
      renderSearch(node, box);
    },
  };
})(typeof self !== 'undefined' ? self : this);
