// Нода «Артефакт»: файл (картинка, звук, видео, любой файл) как исходная улика графа.
// Выход — ручка "artifact:<id>", которую принимают ноды обработки изображений, звука и файлов.
(function (G) {
  'use strict';
  const T = G.T;
  const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

  function preview(a) {
    if (a.kind === 'image') { const img = h('img', 'art-preview'); img.src = a.dataUrl; img.alt = a.name; return img; }
    if (a.kind === 'audio') { const el = h('audio', 'art-preview'); el.controls = true; el.src = a.dataUrl; return el; }
    if (a.kind === 'video') { const el = h('video', 'art-preview'); el.controls = true; el.src = a.dataUrl; return el; }
    return h('div', 'muted small', a.mime || T('файл', 'file'));
  }

  G.NodeTypes.artifact = {
    name: T('Артефакт (файл)', 'Artifact (file)'), cat: 'Ввод и вывод', inputs: [], wide: true,
    desc: T('Улика-файл: картинка, звук, видео, архив, лог. Перетащи файл на холст, вставь Ctrl+V или выбери кнопкой. Оригинал хранится без изменений.',
      'Evidence file: image, audio, video, archive, log. Drop a file on the canvas, paste with Ctrl+V or pick it with the button. The original is kept unchanged.'),
    params: [{ key: 'artifact', label: '', type: 'hidden', default: '' }],
    compute(_, p) {
      if (!p.artifact) throw new Error(T('Выбери файл', 'Pick a file'));
      if (!G.Artifacts.has(p.artifact)) throw new Error(T('Файл не найден в проекте', 'File is missing from the project'));
      return G.Artifacts.handle(p.artifact);
    },
    update(node, res, body, ui) {
      const box = body.querySelector('.special');
      const a = node.params.artifact && G.Artifacts.get(node.params.artifact);
      const sig = a ? a.id + (a.sha256 || '') : 'none';
      if (box.dataset.sig === sig) return;
      box.dataset.sig = sig;
      box.innerHTML = '';
      const input = h('input');
      input.type = 'file';
      input.hidden = true;
      input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        node.params.artifact = await G.Artifacts.addBlob(file, file.name);
        ui.requestEval();
      };
      const pick = h('button', 'btn small', a ? T('Заменить файл', 'Replace file') : T('Выбрать файл', 'Choose file'));
      pick.onclick = () => input.click();
      box.append(pick, input);
      if (!a) return;
      box.appendChild(preview(a));
      box.appendChild(h('div', 'muted small', `${a.name} · ${a.kind} · ${fmtSize(a.size)}` + (a.sha256 ? ' · SHA-256 ' + a.sha256.slice(0, 12) + '…' : '')));
    },
  };
})(typeof self !== 'undefined' ? self : this);
