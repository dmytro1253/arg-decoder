// Модель графа: ноды, связи, вычисление значений, сохранение в JSON.
// Загрузка проверяет файл: параметры по схеме, порты, неизвестные типы, циклы. Всё, что пришлось
// отбросить или исправить, попадает в graph.loadReport (пропущенные ноды и предупреждения).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const FORMAT_VERSION = 2;

  // Описание типа ноды: операция из реестра («op:<id>») или специальная нода (NodeTypes).
  function typeDef(type) {
    if (type.startsWith('op:')) {
      const op = G.CipherOps.BY_ID[type.slice(3)];
      if (!op) return null;
      return {
        name: op.name, cat: op.cat, desc: op.desc, inputs: op.inputs, params: op.params,
        optionalFrom: 1,
        compute: (inputs, p, node) => {
          const params = G.CipherOps.checkedParams(op, p);
          const warnings = [];
          const value = G.CipherOps.collectWarnings(warnings, () => op.run(inputs, params));
          if (node && node.state) node.state.warnings = warnings;
          return value;
        },
      };
    }
    return (G.NodeTypes && G.NodeTypes[type]) || null;
  }

  function defaultsFor(def) {
    const out = {};
    for (const p of def.params || []) out[p.key] = p.default;
    return out;
  }

  // Достижима ли нода target, если идти по связям вперёд от start?
  function reaches(links, start, target) {
    const stack = [start];
    const seen = new Set();
    while (stack.length) {
      const cur = stack.pop();
      if (cur === target) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const l of links) if (l.from === cur) stack.push(l.to);
    }
    return false;
  }

  class Graph {
    constructor() {
      this.nodes = new Map();
      this.links = [];
      this.nextId = 1;
      this.results = new Map();
      this.loadReport = { version: FORMAT_VERSION, skipped: [], warnings: [] };
    }

    addNode(type, x, y, params) {
      const def = typeDef(type);
      if (!def) throw new Error(T('Неизвестный тип ноды: ', 'Unknown node type: ') + type);
      const id = 'n' + this.nextId++;
      const node = { id, type, x: Math.round(x), y: Math.round(y), params: Object.assign(defaultsFor(def), params || {}), state: {} };
      this.nodes.set(id, node);
      return node;
    }

    removeNode(id) {
      this.nodes.delete(id);
      this.links = this.links.filter((l) => l.from !== id && l.to !== id);
    }

    // Нода to зависит от from? (чтобы не допустить циклов)
    dependsOn(to, from) {
      if (to === from) return true;
      const stack = [from];
      const seen = new Set();
      while (stack.length) {
        const cur = stack.pop();
        if (cur === to) return true;
        if (seen.has(cur)) continue;
        seen.add(cur);
        for (const l of this.links) if (l.to === cur) stack.push(l.from);
      }
      return false;
    }

    connect(from, to, port) {
      // Цикл появится, если to уже находится выше по течению от from.
      if (from === to || this.dependsOn(to, from)) return false;
      this.links = this.links.filter((l) => !(l.to === to && l.port === port));
      this.links.push({ from, to, port });
      return true;
    }

    disconnect(to, port) {
      const link = this.links.find((l) => l.to === to && l.port === port);
      this.links = this.links.filter((l) => l !== link);
      return link || null;
    }

    linkInto(to, port) { return this.links.find((l) => l.to === to && l.port === port) || null; }

    // Проверка параметров ноды по схеме типа: неверное значение — понятная ошибка, а не зависание.
    paramProblems(node, def) {
      if (!def.params || !def.params.length) return null;
      const r = G.CipherOps.normalizeParams(def.params, node.params);
      return r.problems.length ? G.CipherOps.problemsText(r.problems) : null;
    }

    evaluate() {
      const memo = new Map();
      const visiting = new Set();
      const evalNode = (id) => {
        if (memo.has(id)) return memo.get(id);
        const node = this.nodes.get(id);
        const def = typeDef(node.type);
        if (visiting.has(id)) return { value: undefined, error: T('Цикл в графе', 'A cycle in the graph') };
        visiting.add(id);
        let blocked = null;
        const inputs = (def.inputs || []).map((_, i) => {
          const l = this.linkInto(id, i);
          if (!l || !this.nodes.has(l.from)) return undefined;
          const up = evalNode(l.from);
          if ((up.error || up.inputError) && !blocked) blocked = { nodeId: l.from, message: up.error || up.inputError.message };
          return up.value;
        });
        let res;
        if (blocked) {
          // Ошибка выше по цепочке: говорим, где именно, а не показываем «пусто».
          res = { value: undefined, error: T('Ошибка на входе: нода ' + blocked.nodeId + ' — ' + blocked.message, 'Input error in node ' + blocked.nodeId + ': ' + blocked.message), inputError: blocked };
        } else if (def.inputs && def.inputs.length && inputs[0] === undefined && !def.noInputOk) {
          res = { value: undefined, error: null, empty: true };
        } else {
          const bad = this.paramProblems(node, def);
          if (bad) res = { value: undefined, error: T('Неверный параметр ', 'Invalid parameter ') + bad };
          else {
            try {
              if (node.state) node.state.warnings = [];
              res = { value: def.compute(inputs, node.params, node), error: null };
              if (node.state && node.state.warnings && node.state.warnings.length) res.warnings = node.state.warnings.slice();
            } catch (e) {
              res = { value: undefined, error: e.message || String(e) };
            }
          }
        }
        visiting.delete(id);
        memo.set(id, res);
        return res;
      };
      for (const id of this.nodes.keys()) evalNode(id);
      this.results = memo;
      return memo;
    }

    toJSON() {
      return {
        version: FORMAT_VERSION,
        nodes: [...this.nodes.values()].map((n) => ({ id: n.id, type: n.type, x: n.x, y: n.y, params: n.params })),
        links: this.links.map((l) => ({ ...l })),
      };
    }

    // Сначала собираем новый граф во временные структуры: битый файл не должен испортить текущий.
    // Возвращает отчёт { version, skipped, warnings }; он же хранится в graph.loadReport.
    load(data) {
      if (!data || !Array.isArray(data.nodes)) throw new Error(T('в файле нет списка нод', 'the file has no node list'));
      const report = { version: Number(data.version) || 1, skipped: [], warnings: [] };
      if (report.version > FORMAT_VERSION) report.warnings.push({ kind: 'version', message: T('Файл сохранён более новой версией (' + report.version + '): часть данных может быть потеряна', 'The file was saved by a newer version (' + report.version + '): some data may be lost') });
      const nodes = new Map();
      let maxId = 0;
      for (const n of data.nodes) {
        if (!n || typeof n.type !== 'string' || n.id === undefined) { report.skipped.push({ id: n && n.id, type: n && n.type, reason: 'malformed' }); continue; }
        const def = typeDef(n.type);
        if (!def) { report.skipped.push({ id: String(n.id), type: n.type, reason: 'unknown-type' }); continue; }
        const id = String(n.id);
        if (nodes.has(id)) { report.warnings.push({ kind: 'duplicate', nodeId: id, message: T('Повтор id ноды ' + id + ' пропущен', 'Duplicate node id ' + id + ' was skipped') }); continue; }
        const x = Number.isFinite(Number(n.x)) ? Number(n.x) : 0;
        const y = Number.isFinite(Number(n.y)) ? Number(n.y) : 0;
        const given = n.params && typeof n.params === 'object' && !Array.isArray(n.params) ? n.params : {};
        const merged = Object.assign(defaultsFor(def), given);
        // Параметры приводятся к схеме: неверные значения заменяются значениями по умолчанию.
        const checked = G.CipherOps.normalizeParams(def.params, merged);
        for (const pr of checked.problems) {
          report.warnings.push({ kind: 'param', nodeId: id, key: pr.key, message: T('Нода ' + id + ', «' + pr.label + '»: ' + pr.reason + ' — взято значение по умолчанию', 'Node ' + id + ', “' + pr.label + '”: ' + pr.reason + ' — the default was used') });
        }
        nodes.set(id, { id, type: n.type, x, y, params: checked.values, state: {} });
        maxId = Math.max(maxId, parseInt(id.replace(/\D/g, ''), 10) || 0);
      }
      const links = [];
      for (const l of Array.isArray(data.links) ? data.links : []) {
        if (!l) continue;
        const from = String(l.from), to = String(l.to), port = Number(l.port) || 0;
        if (!nodes.has(from) || !nodes.has(to) || !Number.isInteger(port) || port < 0) {
          report.warnings.push({ kind: 'link', message: T('Связь ' + from + ' → ' + to + ' пропущена: нет ноды или неверный порт', 'The link ' + from + ' → ' + to + ' was skipped: a missing node or a bad port') });
          continue;
        }
        const ports = (typeDef(nodes.get(to).type).inputs || []).length;
        if (port >= ports) { report.warnings.push({ kind: 'port', message: T('Связь в ноду ' + to + ' пропущена: нет входа №' + (port + 1), 'The link into node ' + to + ' was skipped: there is no input #' + (port + 1)) }); continue; }
        if (from === to || reaches(links, to, from)) {
          report.warnings.push({ kind: 'cycle', message: T('Связь ' + from + ' → ' + to + ' пропущена: она создала бы цикл', 'The link ' + from + ' → ' + to + ' was skipped: it would create a cycle') });
          continue;
        }
        const dup = links.findIndex((x) => x.to === to && x.port === port);
        if (dup >= 0) { links.splice(dup, 1); report.warnings.push({ kind: 'duplicate-link', message: T('Два провода в один вход ноды ' + to + ': оставлен последний', 'Two wires into one input of node ' + to + ': the last one was kept') }); }
        links.push({ from, to, port });
      }
      this.nodes = nodes;
      this.links = links;
      this.nextId = maxId + 1;
      this.loadReport = report;
      return report;
    }
  }

  G.Graph = Graph;
  G.typeDef = typeDef;
})(typeof self !== 'undefined' ? self : this);
