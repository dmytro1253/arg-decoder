// Рабочее пространство: связывает проект (доски, улики, ключи) с графом, видом и слоем аннотаций.
// Отвечает за переключение досок, автосохранение, файл проекта, закрытие и возврат досок.
(function (G) {
  'use strict';
  const P = G.Project;
  const T = G.T;
  const SAVE_DELAY = 400;
  const CLOSED_LIMIT = P.MAX_CLOSED;

  class Workspace {
    /**
     * @param {{graph, view, annot, store, toast, tabsFactory}} deps
     * tabsFactory(handlers) -> { render(boards, activeId, closedCount), setStatus(text, kind) }
     */
    constructor(deps) {
      this.graph = deps.graph;
      this.view = deps.view;
      this.annot = deps.annot;
      this.store = deps.store;
      this.toast = deps.toast;
      this.project = P.create({});
      this.runtime = new Map(); // id доски -> { history, selection }: отмена и выделение у каждой доски свои
      this.closed = [];
      this.saveTimer = null;
      this.saving = false;
      this.pending = false;
      this.lastWarning = '';
      this.externalChange = false;
      this.tabs = deps.tabsFactory({
        switch: (id) => this.switchTo(id),
        create: () => this.addBoard({}),
        rename: (id, name) => this.rename(id, name),
        duplicate: (id) => this.duplicate(id),
        close: (id) => this.close(id),
        move: (id, i) => this.move(id, i),
        restore: () => this.restoreClosed(),
        exportBoard: (id) => this.exportBoard(id),
      });
    }

    // ---------- запуск ----------
    /** Загружает сохранённый проект; при его отсутствии открывает defaultGraph на первой доске. */
    async start(defaultPreset) {
      let loaded = null;
      try { loaded = await this.store.load(); } catch (e) { this.toast(T('Не удалось прочитать сохранённый проект: ', 'Could not read the saved project: ') + e.message, 6000); }
      let fit = false;
      if (loaded) {
        this.applyPayload(loaded.artifacts, loaded.project.keys, loaded.project.dossiers);
        this.project = loaded.project;
        fit = loaded.migrated;
        for (const w of loaded.warnings) this.toast(w, 8000);
        if (loaded.migrated) this.toast(T('Старый граф перенесён на первую доску нового проекта.', 'The old graph was moved to the first board of the new project.'), 6000);
      } else {
        this.project = P.create({ boards: [{ name: T('Старт', 'Start'), graph: defaultPreset }] });
        fit = true;
      }
      this.enterBoard(this.project.activeBoardId, { fit });
      this.watchOtherWindows();
      this.saveNow();
      // Кнопка «Прошлый проект» видна, только если есть резервная копия.
      if (this.store && this.store.loadBackup) this.store.loadBackup().then((b) => this.updateRestoreButton(!!b)).catch(() => {});
    }

    watchOtherWindows() {
      window.addEventListener('storage', (e) => {
        if (e.key !== P.STORAGE_KEY || !e.newValue) return;
        this.externalChange = true;
        this.tabs.setStatus(T('⚠ Проект изменён в другом окне — перезагрузи страницу, иначе правки перезапишут друг друга', '⚠ The project was changed in another window — reload, or edits will overwrite each other'), 'warn');
      });
      window.addEventListener('beforeunload', () => this.flush());
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.flush(); });
    }

    // ---------- состояние активной доски ----------
    rt(id) {
      if (!this.runtime.has(id)) this.runtime.set(id, { history: null, selection: [] });
      return this.runtime.get(id);
    }

    /** Переносит граф, камеру и аннотации из интерфейса в данные активной доски. */
    captureBoard() {
      const b = P.activeBoard(this.project);
      this.project = P.updateBoard(this.project, b.id, {
        graph: this.graph.toJSON(),
        view: { pan: { x: Math.round(this.view.pan.x), y: Math.round(this.view.pan.y) }, zoom: Math.round(this.view.zoom * 1000) / 1000 },
        annotations: this.annot.toJSON(),
      });
      // Свои досье живут в проекте: берём актуальный список из модели досье.
      if (G.Dossiers) this.project = { ...this.project, dossiers: G.Dossiers.customList() };
    }

    leaveBoard() {
      this.annot.commitEditor();
      this.captureBoard();
      const state = this.rt(this.project.activeBoardId);
      this.view.snapshotNow();
      state.history = this.view.history || null;
      state.selection = [...this.view.selectionSet()];
    }

    enterBoard(id, opts) {
      const board = this.project.boards.find((b) => b.id === id) || this.project.boards[0];
      this.project = P.setActive(this.project, board.id);
      const state = this.rt(board.id);
      this.view.stopAll();
      this.view.history = state.history;
      try {
        this.reportLoad(this.graph.load(board.graph), board.name);
      } catch (e) {
        this.graph.load(P.emptyGraph());
        this.toast(T('Доска «' + board.name + '» повреждена и открыта пустой: ', 'Board "' + board.name + '" is damaged and was opened empty: ') + e.message, 8000);
      }
      this.annot.load(board.annotations);
      // Камеру ставим до отрисовки: провода считают координаты портов через текущий масштаб.
      this.view.pan = { x: board.view.pan.x, y: board.view.pan.y };
      this.view.zoom = board.view.zoom;
      this.view.applyTransform();
      this.view.renderAll();
      requestAnimationFrame(() => this.view.drawWires());
      for (const nid of state.selection) if (this.graph.nodes.has(nid)) this.view.select(nid, true);
      if (!this.view.history || !this.view.history.stack.length) this.view.snapshotNow();
      if (opts && opts.fit) requestAnimationFrame(() => { this.view.fitAll(); this.scheduleSave(); });
      if (G.PresetGuide) G.PresetGuide.show(board, this.view);
      this.renderTabs();
    }

    // Отчёт загрузки графа: что пропущено или исправлено (ядро кладёт его в graph.loadReport).
    reportLoad(report, boardName) {
      const rep = report || this.graph.loadReport;
      if (!rep) return;
      const skipped = (rep.skipped || []).length, warned = (rep.warnings || []).length;
      if (!skipped && !warned) return;
      const first = (rep.warnings || [])[0];
      this.toast(T('Доска «' + boardName + '»: пропущено нод ' + skipped + ', исправлений ' + warned + (first ? ' — ' + first.message : ''),
        'Board "' + boardName + '": skipped nodes ' + skipped + ', fixes ' + warned + (first ? ' — ' + first.message : '')), 8000);
    }

    renderTabs() {
      this.tabs.render(this.project.boards.map((b) => ({ id: b.id, name: b.name })), this.project.activeBoardId, this.closed.length);
    }

    // ---------- операции над досками ----------
    switchTo(id) {
      if (id === this.project.activeBoardId || P.boardIndex(this.project, id) < 0) return;
      this.leaveBoard();
      this.enterBoard(id);
      this.scheduleSave();
    }

    /** Новая доска. opts: { name, graph, fit }. */
    addBoard(opts) {
      const o = opts || {};
      this.leaveBoard();
      const board = P.createBoard({ name: o.name || P.defaultBoardName(this.project), graph: o.graph, presetId: o.presetId });
      this.project = P.addBoard(this.project, board);
      this.enterBoard(board.id, { fit: o.fit });
      this.scheduleSave();
      return board;
    }

    /** Пример (пресет) открывается на новой доске, а не заменяет текущую. */
    openPreset(preset) {
      // Примеры с картинкой: сначала подгружаем образец и кладём его в проект как артефакт.
      if (G.Samples && G.Samples.needs(preset)) {
        G.Samples.resolve(preset)
          .then((nodes) => this.openPreset({ ...preset, nodes }))
          .catch((e) => this.toast(T('Не удалось загрузить картинку примера: ', 'Could not load the example image: ') + e.message, 6000));
        return null;
      }
      const board = this.addBoard({ name: P.uniqueName(this.project, preset.title), graph: { nodes: preset.nodes, links: preset.links }, presetId: preset.id || '', fit: true });
      // Раскладываем без наложений: заготовки примеров рассчитаны на сетку, а реальные ноды разной высоты.
      requestAnimationFrame(() => requestAnimationFrame(() => { this.view.autoLayout(); this.scheduleSave(); }));
      return board;
    }

    rename(id, name) {
      this.project = P.renameBoard(this.project, id, name);
      this.renderTabs();
      this.scheduleSave();
    }

    duplicate(id) {
      this.leaveBoard();
      const res = P.duplicateBoard(this.project, id);
      if (!res.board) return;
      this.project = res.project;
      this.enterBoard(res.board.id);
      this.scheduleSave();
      this.toast(T('Доска продублирована', 'Board duplicated'));
    }

    close(id) {
      if (P.boardIndex(this.project, id) < 0) return;
      const wasActive = id === this.project.activeBoardId;
      this.leaveBoard();
      const res = P.removeBoard(this.project, id);
      this.project = res.project;
      this.closed.push({ ...res.removed, runtime: this.runtime.get(id) || null });
      if (this.closed.length > CLOSED_LIMIT) this.closed.shift();
      this.runtime.delete(id);
      if (wasActive) this.enterBoard(this.project.activeBoardId); else this.renderTabs();
      this.scheduleSave();
      this.toast(T('Доска «' + res.removed.board.name + '» закрыта. Вернуть: кнопка ↶', 'Board "' + res.removed.board.name + '" closed. Reopen: the ↶ button'), 5000);
    }

    restoreClosed() {
      const entry = this.closed.pop();
      if (!entry) { this.toast(T('Закрытых досок нет', 'No closed boards')); return; }
      this.leaveBoard();
      this.project = P.restoreBoard(this.project, entry);
      if (entry.runtime) this.runtime.set(entry.board.id, entry.runtime);
      this.enterBoard(entry.board.id);
      this.scheduleSave();
    }

    move(id, index) {
      this.project = P.moveBoard(this.project, id, index);
      this.renderTabs();
      this.scheduleSave();
    }

    exportBoard(id) {
      if (id === this.project.activeBoardId) this.captureBoard();
      const b = this.project.boards.find((x) => x.id === id);
      if (!b) return;
      this.download(JSON.stringify(b.graph, null, 2), 'arg-graph-' + b.name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 40) + '.json');
      this.toast(T('Граф доски сохранён в файл (без вложений и рисунков)', 'Board graph saved (without attachments and drawings)'));
    }

    // ---------- проект целиком ----------
    applyPayload(artifacts, keys, dossiers) {
      G.Artifacts.clear();
      G.Artifacts.load(artifacts);
      if (G.Dossiers) { G.Dossiers.setCustom(dossiers); if (G.DossierUI) G.DossierUI.refresh(); }
      const bank = G.KeyBank;
      if (bank) {
        if (typeof bank.load === 'function') bank.load(keys);
        else if (typeof bank.fromJSON === 'function') bank.fromJSON(keys);
      }
    }

    currentKeys() { return G.KeyBank && typeof G.KeyBank.toJSON === 'function' ? G.KeyBank.toJSON() : []; }

    /** Заменяет весь проект (новый или из файла). */
    loadProject(project, opts) {
      this.view.stopAll();
      this.runtime.clear();
      this.closed = [];
      this.applyPayload(project.artifacts, project.keys, project.dossiers);
      this.project = project;
      this.view.history = null;
      this.enterBoard(project.activeBoardId, opts);
      this.saveNow();
    }

    /** Текущее состояние целиком (с банком ключей и вложениями) — для проверки «есть что терять» и резервной копии. */
    snapshot() {
      this.captureBoard();
      return { ...this.project, keys: this.currentKeys(), artifacts: G.Artifacts.toJSON() };
    }

    /**
     * Перед заменой проекта: спросить и сохранить резервную копию текущего. Возвращает true, если можно заменять.
     * Пустой проект заменяется без вопросов; копия пишется отдельно от автосохранения и восстанавливается кнопкой «Прошлый проект».
     */
    async confirmReplace(question) {
      const snap = this.snapshot();
      if (!P.hasContent(snap)) return true;
      const backup = this.store && this.store.saveBackup ? await this.store.saveBackup(snap, snap.artifacts) : { ok: false };
      const tail = backup.ok
        ? T('Копия текущего проекта сохранена в браузере: вернуть его можно кнопкой «Прошлый проект».', 'A copy of the current project is kept in the browser: the Previous project button brings it back.')
        : T('Резервную копию сохранить не удалось: текущий проект пропадёт, если не сохранить его в файл (Ctrl+S).', 'A backup copy could not be saved: the current project will be lost unless you save it to a file (Ctrl+S).');
      if (!confirm(question + ' ' + tail)) return false;
      this.updateRestoreButton(backup.ok);
      return true;
    }

    async newProject() {
      if (!(await this.confirmReplace(T('Начать новый проект? Текущий будет заменён.', 'Start a new project? The current one will be replaced.')))) return;
      this.loadProject(P.create({}));
    }

    /** Возвращает проект из резервной копии; текущий при этом сам уходит в копию (обмен). */
    async restorePrevious() {
      const prev = this.store && this.store.loadBackup ? await this.store.loadBackup() : null;
      if (!prev) { this.toast(T('Резервной копии прошлого проекта нет', 'There is no backup of a previous project')); this.updateRestoreButton(false); return; }
      if (!(await this.confirmReplace(T('Вернуть прошлый проект «' + prev.project.name + '»? Текущий будет заменён.', 'Bring back the previous project "' + prev.project.name + '"? The current one will be replaced.')))) return;
      this.loadProject(prev.project, { fit: false });
      this.toast(T('Прошлый проект возвращён: досок ' + prev.project.boards.length + ', ключей ' + prev.project.keys.length + ', вложений ' + prev.project.artifacts.length, 'Previous project restored: ' + prev.project.boards.length + ' boards, ' + prev.project.keys.length + ' keys, ' + prev.project.artifacts.length + ' attachments'));
    }

    updateRestoreButton(on) {
      const b = typeof document !== 'undefined' && document.getElementById('btn-restore');
      if (b) b.classList.toggle('hidden', !on);
    }

    download(text, name) {
      const blob = new Blob([text], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    saveFile() {
      this.captureBoard();
      const project = P.touch(this.project);
      this.download(P.serialize(project, G.Artifacts.toJSON(), this.currentKeys()), P.fileName(project));
      this.toast(T('Проект сохранён в файл вместе с вложениями', 'Project saved to a file together with its attachments'));
    }

    openFile(file) {
      const reader = new FileReader();
      reader.onerror = () => this.toast(T('Не удалось прочитать файл', 'Could not read the file'));
      reader.onload = () => {
        try { this.openText(String(reader.result), file.name); } catch (e) { this.toast(T('Не открыть: ', 'Cannot open: ') + e.message, 6000); }
      };
      reader.readAsText(file);
    }

    openText(text, fileName) {
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error(T('файл не читается как JSON', 'the file is not valid JSON')); }
      if (P.isProjectData(data)) {
        const project = P.normalize(data);
        this.confirmReplace(T('Открыть проект «' + project.name + '»? Текущий проект будет заменён.', 'Open the project "' + project.name + '"? The current project will be replaced.')).then((ok) => {
          if (!ok) return;
          this.loadProject(project, { fit: false });
          this.toast(T('Проект открыт: досок ' + project.boards.length + ', ключей ' + project.keys.length + ', вложений ' + project.artifacts.length, 'Project opened: ' + project.boards.length + ' boards, ' + project.keys.length + ' keys, ' + project.artifacts.length + ' attachments'));
        });
        return;
      }
      const converted = P.fromLegacyGraph(data);
      this.addBoard({ name: String(fileName || '').replace(/\.(argproj\.)?json$/i, '') || undefined, graph: converted.boards[0].graph, fit: true });
      this.toast(T('Граф открыт на новой доске', 'Graph opened on a new board'));
    }

    // ---------- автосохранение ----------
    scheduleSave() {
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.saveNow(), SAVE_DELAY);
    }

    /** Синхронная часть сохранения для закрытия страницы. */
    flush() {
      clearTimeout(this.saveTimer);
      if (this.externalChange) return;
      this.saveNow();
    }

    async saveNow() {
      clearTimeout(this.saveTimer);
      if (this.saving) { this.pending = true; return; }
      this.saving = true;
      try {
        this.captureBoard();
        this.project = P.touch(this.project);
        const res = await this.store.save({ ...this.project, keys: this.currentKeys() }, G.Artifacts.toJSON());
        this.reportSave(res);
      } catch (e) {
        this.tabs.setStatus(T('⚠ Не сохранено: ', '⚠ Not saved: ') + e.message, 'warn');
      } finally {
        this.saving = false;
        if (this.pending) { this.pending = false; this.scheduleSave(); }
      }
    }

    reportSave(res) {
      if (this.externalChange) return;
      if (res.warnings.length) {
        const text = res.warnings[0];
        this.tabs.setStatus('⚠ ' + text, 'warn');
        if (text !== this.lastWarning) { this.lastWarning = text; this.toast(text, 9000); }
        return;
      }
      this.lastWarning = '';
      const note = res.mode === 'idb' ? T(' (вложения в IndexedDB)', ' (attachments in IndexedDB)') : '';
      this.tabs.setStatus(T('Сохранено ', 'Saved ') + new Date().toLocaleTimeString() + note, 'ok');
    }
  }

  G.Workspace = Workspace;
})(typeof self !== 'undefined' ? self : this);
