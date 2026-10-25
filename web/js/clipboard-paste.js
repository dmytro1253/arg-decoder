// Буфер обмена холста: Ctrl+V с картинкой или файлом создаёт ноду-артефакт, текст — ноду «Ввод»,
// скопированные ноды переносятся между досками и окнами. В полях ввода всё работает как обычно.
(function (G) {
  'use strict';
  const T = G.T;
  const MARK = 'argdec-nodes:';
  const SPREAD = 36;

  const isEditable = (el) => !!el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable);
  const hasSelectedText = () => String(window.getSelection() || '').length > 0;

  /** Разбирает содержимое буфера обмена: { files, text }. Чистая функция, проверяется в браузере вручную. */
  function readClipboard(data) {
    return {
      files: Array.from((data && data.files) || []),
      text: (data && data.getData('text/plain')) || '',
    };
  }

  function mount(ctx) {
    const { view, annot, toast } = ctx;

    document.addEventListener('copy', (e) => {
      if (isEditable(e.target) || hasSelectedText() || annot.active) return;
      if (!view.copySelection() || !e.clipboardData) return;
      // Копия нод кладётся и в системный буфер с меткой, чтобы Ctrl+V отличал её от чужого текста или картинки.
      e.clipboardData.setData('text/plain', MARK + JSON.stringify(view.clipboard));
      e.preventDefault();
      toast(T('Скопировано нод: ', 'Nodes copied: ') + view.selectionSet().size);
    });

    document.addEventListener('paste', (e) => {
      if (isEditable(e.target) || !e.clipboardData) return;
      const { files, text } = readClipboard(e.clipboardData);
      e.preventDefault();
      if (files.length) { pasteFiles(files); return; }
      if (text.startsWith(MARK)) { pasteNodes(text.slice(MARK.length)); return; }
      if (text.trim()) {
        const c = view.viewCenter();
        view.addNode('input', c.x, c.y, { text });
        toast(T('Текст вставлен в новую ноду «Ввод»', 'Text pasted into a new Input node'));
        return;
      }
      if (!view.paste()) toast(T('В буфере обмена нечего вставлять', 'Nothing to paste from the clipboard'));
    });

    function pasteNodes(json) {
      try { view.clipboard = JSON.parse(json); } catch (err) { toast(T('Скопированные ноды повреждены', 'The copied nodes are damaged')); return; }
      if (!view.paste()) toast(T('В буфере обмена нечего вставлять', 'Nothing to paste from the clipboard'));
    }

    async function pasteFiles(files) {
      const c = view.viewCenter();
      let i = 0;
      for (const file of files) {
        const at = { x: c.x + i * SPREAD, y: c.y + i * SPREAD };
        i += 1;
        try {
          if (annot.active) await annot.placeFile(file, at); // в режиме рисования картинка становится объектом доски
          else await view.addArtifactFile(file, at.x, at.y);
        } catch (err) {
          toast(T('Не удалось вставить файл: ', 'Could not paste the file: ') + err.message);
        }
      }
      toast(T('Вставлено файлов: ', 'Files pasted: ') + files.length);
    }
  }

  G.ClipboardPaste = { MARK, mount, readClipboard };
})(typeof self !== 'undefined' ? self : this);
