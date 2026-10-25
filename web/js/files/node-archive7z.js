// Нода «Архив RAR/7z (7-Zip)»: настоящая распаковка RAR 4/5 (и с зашифрованными заголовками), 7z (и AES),
// а также tar/xz/bzip2/cab/iso и других форматов 7-Zip — локально, через 7-Zip WebAssembly (files/sevenzip.js).
// Распаковка асинхронная: запускается сама при смене файла или пароля, результат хранится в ноде до следующей смены.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = G.ArgFiles;
  const U = NS.ui;
  const NT = G.NodeTypes || (G.NodeTypes = {});
  const MAX_ROWS = 300;

  function pickEntry(files, entry) {
    const want = String(entry).trim();
    if (!want) throw new Error(T('Укажи запись (имя или #номер)', 'Specify an entry (name or #index)'));
    const byIndex = /^#(\d+)$/.exec(want);
    const f = byIndex ? files[Number(byIndex[1]) - 1] : files.find((x) => x.path === want) || files.find((x) => x.path.split('/').pop() === want);
    if (!f) throw new Error(T('Нет такой записи: ', 'No such entry: ') + want);
    return f;
  }

  function listing(done) {
    const head = (done.type || '?') + ': ' + done.entries.length + T(' записей', ' entries') + (done.headersEncrypted ? T(' · заголовки зашифрованы', ' · headers encrypted') : '');
    return [head].concat(done.entries.map((e, i) => '#' + (i + 1) + '\t' + e.path + (e.dir ? '/' : '\t' + (e.size || 0)) + (e.encrypted ? '\t🔒' : ''))).join('\n');
  }

  async function unpack(node, sig, bytes, password) {
    node.state.running = sig;
    try {
      const Z = NS.SevenZip;
      const info = await Z.list(bytes, password);
      const files = await Z.extractAll(bytes, password);
      node.state.done = Object.assign({ sig, files }, info);
      node.state.error = null;
    } catch (e) {
      node.state.done = null;
      node.state.error = { sig, message: (e && e.message) || String(e) };
    } finally {
      node.state.running = null;
      if (node.state.ui) node.state.ui.requestEval();
    }
  }

  function compute([v], p, node) {
    const bytes = NS.requireArtifactBytes(v);
    const sig = G.Artifacts.idOf(v) + '|' + bytes.length + '|' + p.password;
    node.state.sig = sig;
    const done = node.state.done;
    if (!done || done.sig !== sig) {
      if (node.state.error && node.state.error.sig === sig) throw new Error(node.state.error.message);
      const a = NS.SevenZip.availability();
      if (!a.ok) throw new Error(a.reason);
      if (node.state.running !== sig) node.state.pending = unpack(node, sig, bytes, p.password);
      return undefined;
    }
    if (p.output === 'extract') {
      const f = pickEntry(done.files, p.entry);
      const mime = NS.Signatures.detect(f.bytes).mime;
      return NS.derive('7z_' + G.Artifacts.idOf(v) + '_' + NS.keyOf(f.path + '\u0000' + p.password), f.path.split('/').pop(), f.bytes, mime);
    }
    return listing(done);
  }

  NT.file_archive7z = {
    name: T('Архив RAR/7z (7-Zip)', 'Archive RAR/7z (7-Zip)'), cat: 'Файлы', wide: true,
    inputs: [T('файл', 'file')],
    desc: T('Распаковывает RAR 4/5 (в том числе с зашифрованными паролем заголовками), 7z (в том числе AES), а также tar, xz, bzip2, cab, iso и другие форматы 7-Zip. Работает локально: 7-Zip 24.09 в WebAssembly, файлы остаются в памяти браузера. Неверный пароль и повреждённый архив называются прямо. Нужен запуск через локальный сервер (из file:// браузер не загрузит wasm).',
      'Extracts RAR 4/5 (including password-encrypted headers), 7z (including AES), and tar, xz, bzip2, cab, iso and other 7-Zip formats. Runs locally: 7-Zip 24.09 in WebAssembly, the files stay in browser memory. A wrong password and a damaged archive are named plainly. Needs the local server (from file:// the browser will not load wasm).'),
    params: [
      { key: 'output', label: T('Выход', 'Output'), type: 'select', default: 'list', options: [['list', T('Список записей (текст)', 'Entry list (text)')], ['extract', T('Запись (артефакт)', 'Entry (artifact)')]] },
      { key: 'entry', label: T('Запись (имя или #номер)', 'Entry (name or #index)'), type: 'text', default: '' },
      { key: 'password', label: T('Пароль', 'Password'), type: 'text', default: '' },
    ],
    compute,
    update(node, res, body, ui) {
      node.state.ui = ui;
      const box = body.querySelector('.special') || body.appendChild(U.h('div', 'special'));
      const done = node.state.done && node.state.done.sig === node.state.sig ? node.state.done : null;
      const sig = (done ? 'done' : node.state.running ? 'run' : 'idle') + '|' + node.state.sig + '|' + (res.error || '');
      if (box.dataset.sig === sig) return;
      box.dataset.sig = sig;
      box.innerHTML = '';
      if (node.state.running) { box.append(U.h('div', 'muted small', T('Распаковываю (7-Zip WebAssembly)…', 'Extracting (7-Zip WebAssembly)…'))); return; }
      if (!done) return;
      box.append(U.h('div', 'muted small', listing(done).split('\n')[0]));
      const list = U.h('div', 'fx-list');
      done.files.slice(0, MAX_ROWS).forEach((f, i) => {
        const row = U.h('div', 'fx-row fx-entry');
        row.append(U.h('span', 'fx-name', f.path), U.h('span', 'muted small fx-size', NS.fmtSize(f.bytes.length)));
        row.append(U.button(T('на выход', 'to output'), () => { node.params.entry = '#' + (i + 1); node.params.output = 'extract'; ui.requestEval(); }, 'tiny'),
          U.button(T('→ артефакт', '→ artifact'), () => U.saveArtifact(f.bytes, f.path.split('/').pop(), NS.Signatures.detect(f.bytes).mime, ui).catch((e) => ui.toast(e.message)), 'tiny'));
        list.appendChild(row);
      });
      box.append(list);
    },
  };
})(typeof self !== 'undefined' ? self : this);
