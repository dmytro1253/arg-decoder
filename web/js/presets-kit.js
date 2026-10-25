// Строитель примеров-досок для разборов ARG: сетка «колонка × строка», цепочки и заметка об источнике.
// Каждый пример: { id, arg, group, title, desc, nodes, links, expect?, expectContains?, expectErrors?, auto | manual, discrepancy? }.
//  • expect — точные значения, которые должны встретиться среди результатов нод;
//  • expectErrors — id нод, где ошибка ожидаема (намеренный отрицательный пример);
//  • auto — { input, keys?, expect, top? }: что подаётся в авто-поиск и каким ожидается ответ;
//  • manual — причина, почему авто-поиск здесь не применим (нужен ключ извне, картинка/звук, действие в игре).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const COL = 290;
  const ROW = 230;
  const X0 = 40;
  const Y0 = 40;

  class Board {
    constructor() { this.nodes = []; this.links = []; this.k = 0; this.cols = new Map(); }

    /** Добавляет ноду в клетку (col,row). Возвращает её id. */
    add(type, col, row, params) {
      const id = 'n' + (++this.k);
      this.nodes.push({ id, type, x: X0 + col * COL, y: Y0 + row * ROW, params: params || {} });
      this.cols.set(id, { col, row });
      return id;
    }

    link(from, to, port) { this.links.push({ from, to, port: port || 0 }); }

    /** Нода справа от prev (в той же строке), подключённая к входу port. */
    then(prev, type, params, port, row) {
      const at = this.cols.get(prev);
      const id = this.add(type, at.col + 1, row === undefined ? at.row : row, params);
      this.link(prev, id, port || 0);
      return id;
    }

    /** Цепочка шагов [[type, params], …] от prev. Возвращает id последней ноды. */
    chain(prev, steps) {
      let cur = prev;
      for (const [type, params] of steps) cur = this.then(cur, type, params);
      return cur;
    }

    /** Подключает уже существующую ноду prev ко входу port ноды to (вторичный вход). */
    wire(prev, to, port) { this.link(prev, to, port); }

    note(col, row, text) { return this.add('note', col, row, { text }); }
  }

  /** Текст заметки: что это, откуда, насколько надёжно. */
  function sourceNote(what, source, reliability) {
    return what + '\n\n' + T('Источник: ', 'Source: ') + source + '\n' + T('Надёжность: ', 'Reliability: ') + reliability;
  }

  /** Собирает пример из доски и добавляет его в G.Presets. */
  function define(spec, board) {
    const arg = G.ArgCases ? G.ArgCases.get(spec.arg) : null;
    const preset = {
      id: spec.id, arg: spec.arg, group: arg ? arg.name : spec.arg, title: spec.title, desc: spec.desc,
      nodes: board.nodes, links: board.links, profile: 'neutral',
    };
    for (const key of ['expect', 'expectContains', 'expectErrors', 'auto', 'manual', 'discrepancy']) if (spec[key] !== undefined) preset[key] = spec[key];
    G.Presets.push(preset);
    return preset;
  }

  G.PresetKit = { Board, define, sourceNote };
})(typeof self !== 'undefined' ? self : this);
