// Нода «Инспектор файла»: формат по сигнатуре, размер, хеши, энтропия, hex-просмотр с поиском,
// данные после конца структуры (PNG IEND / JPEG EOI / ZIP EOCD …) и вложенные файлы как новые артефакты.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = G.ArgFiles;
  const U = NS.ui;
  const NT = G.NodeTypes || (G.NodeTypes = {});

  const MAX_EMBEDDED_ROWS = 30;
  const ANALYSIS_KEY = 'files:analysis:';

  const entropyNote = (e) => (e > 7.5 ? T('похоже на сжатые или зашифрованные данные', 'looks compressed or encrypted')
    : e < 1 ? T('почти пусто или повторы', 'nearly empty or repetitive')
      : e < 5 ? T('текст/структурированные данные', 'text or structured data') : T('смешанные данные', 'mixed data'));

  function nameFor(value, suffix, ext) {
    const item = G.Artifacts.get(G.Artifacts.idOf(value));
    const base = (item && item.name ? item.name : 'file').replace(/\.[^.]*$/, '');
    return base + suffix + (ext ? '.' + ext : '');
  }

  /** Полный разбор файла; кэшируется в runtime артефакта (пересчёт графа дёшев). */
  function analyze(value, bytes) {
    const A = G.Artifacts;
    const key = ANALYSIS_KEY + A.idOf(value);
    const cached = A.runtimeGet(key);
    if (cached && cached.size === bytes.length) return cached;
    const S = NS.Signatures;
    const format = S.detect(bytes);
    const end = S.findEnd(bytes, format.id);
    const tailFormat = end && end.tail > 0 ? S.detect(bytes.subarray(end.end)) : null;
    const result = {
      format, size: bytes.length, end, tailFormat,
      sha256: NS.toHex(NS.Hash.sha256(bytes)), md5: NS.toHex(NS.Hash.md5(bytes)),
      entropy: S.entropy(bytes), embedded: S.scanEmbedded(bytes, 64),
    };
    A.runtimeSet(key, result);
    return result;
  }

  function buildReport(name, a) {
    const lines = [
      T('Файл: ', 'File: ') + name,
      T('Формат: ', 'Format: ') + a.format.name + (a.format.mime ? ' (' + a.format.mime + ')' : ''),
      T('Размер: ', 'Size: ') + a.size + ' ' + T('байт', 'bytes') + ' (' + NS.fmtSize(a.size) + ')',
      'SHA-256: ' + a.sha256,
      'MD5: ' + a.md5,
      T('Энтропия: ', 'Entropy: ') + a.entropy.toFixed(2) + ' ' + T('бит/байт — ', 'bits/byte — ') + entropyNote(a.entropy),
    ];
    if (a.end) {
      lines.push(T('Структура заканчивается на смещении ', 'The structure ends at offset ') + NS.hex(a.end.end) + ' (' + a.end.marker + ')' + (a.end.truncated ? T(' — файл обрезан', ' — the file is truncated') : ''));
      lines.push(a.end.tail > 0
        ? T('ДАННЫЕ ПОСЛЕ КОНЦА: ' + a.end.tail + ' байт' + (a.tailFormat ? ', похоже на ' + a.tailFormat.name : ''), 'DATA AFTER THE END: ' + a.end.tail + ' bytes' + (a.tailFormat ? ', looks like ' + a.tailFormat.name : ''))
        : T('Лишних данных после конца нет.', 'No data after the end.'));
    } else {
      lines.push(T('Конец структуры для этого формата не определяется.', 'The end of structure is not determined for this format.'));
    }
    if (a.embedded.length) {
      lines.push(T('Вложенные сигнатуры:', 'Embedded signatures:'));
      a.embedded.forEach((e) => lines.push('  ' + NS.hex(e.offset, 8) + '  ' + e.name));
    }
    return lines.join('\n');
  }

  function derived(value, bytes, suffix, key, fmtOf) {
    const f = fmtOf || NS.Signatures.detect(bytes);
    return NS.derive(key + '_' + NS.keyOf(NS.Hash.hashHex('md5', bytes.subarray(0, 4096)) + bytes.length), nameFor(value, suffix, f.ext), bytes, f.mime);
  }

  function outputFor(value, bytes, a, p) {
    const A = G.Artifacts;
    const id = A.idOf(value);
    switch (p.output) {
      case 'sha256': return a.sha256;
      case 'tail': {
        if (!a.end) throw new Error(T('Для формата «' + a.format.name + '» конец структуры не определяется', 'The end of structure is not determined for “' + a.format.name + '”'));
        if (a.end.tail <= 0) throw new Error(T('После конца структуры данных нет', 'There is no data after the end of the structure'));
        return derived(value, bytes.subarray(a.end.end), '_tail', 'tail_' + id, a.tailFormat);
      }
      case 'carve': {
        const off = Math.floor(Number(p.carve));
        if (!(off > 0 && off < bytes.length)) throw new Error(T('Задай смещение внутри файла (больше 0)', 'Set an offset inside the file (greater than 0)'));
        const c = NS.Signatures.carve(bytes, off);
        return derived(value, c.bytes, '_at' + off.toString(16), 'carve_' + id + '_' + off, c.format);
      }
      default: return buildReport(A.get(id).name, a);
    }
  }

  // ---------- hex-просмотр ----------
  function parseOffset(text) {
    const t = String(text).trim();
    const n = /^0x/i.test(t) ? parseInt(t.slice(2), 16) : /^[0-9a-f]+h$/i.test(t) ? parseInt(t, 16) : parseInt(t, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function hexViewer(node, bytes) {
    const { h } = U;
    const HV = NS.HexView;
    const st = node.state.hex || (node.state.hex = { offset: 0, mode: 'hex', query: '' });
    const pre = h('pre', 'fx-pre');
    const status = h('div', 'muted small');
    const pos = U.input('text', '0x0');
    const q = U.input('text', st.query, T('что искать', 'search for'));
    const mode = U.select([['hex', 'HEX'], ['text', 'UTF-8'], ['utf16', 'UTF-16LE']], st.mode);
    const pageBytes = HV.COLS * HV.PAGE_ROWS;
    let hits = [];
    let hitIdx = -1;

    const draw = () => {
      const maxOff = Math.max(0, Math.floor((bytes.length - 1) / HV.COLS) * HV.COLS);
      st.offset = Math.min(maxOff, Math.max(0, Math.floor(st.offset / HV.COLS) * HV.COLS));
      pre.textContent = HV.format(bytes, st.offset, HV.PAGE_ROWS);
      pos.value = NS.hex(st.offset);
    };
    const jump = (off) => { st.offset = off; draw(); };
    const search = (step) => {
      try {
        if (step === 0 || !hits.length || st.query !== q.value || st.mode !== mode.value) {
          st.query = q.value; st.mode = mode.value;
          hits = HV.findAll(bytes, HV.parseQuery(q.value, mode.value), 0, 2000);
          hitIdx = -1;
        }
        if (!hits.length) { status.textContent = T('Не найдено', 'Not found'); return; }
        hitIdx = (hitIdx + 1) % hits.length;
        jump(hits[hitIdx]);
        status.textContent = T('Совпадение ', 'Match ') + (hitIdx + 1) + '/' + hits.length + T(' на смещении ', ' at offset ') + NS.hex(hits[hitIdx]);
      } catch (e) { status.textContent = e.message; }
    };

    pos.onchange = () => jump(parseOffset(pos.value));
    q.onkeydown = (ev) => { if (ev.key === 'Enter') search(hits.length && st.query === q.value ? 1 : 0); };
    const nav = h('div', 'fx-row');
    nav.append(
      U.button('⏮', () => jump(0), 'tiny'), U.button('◀', () => jump(st.offset - pageBytes), 'tiny'),
      pos, U.button('▶', () => jump(st.offset + pageBytes), 'tiny'), U.button('⏭', () => jump(bytes.length), 'tiny'));
    const find = h('div', 'fx-row');
    find.append(mode, q, U.button(T('Найти', 'Find'), () => search(0), 'tiny'), U.button(T('Далее', 'Next'), () => search(1), 'tiny'));
    const wrap = h('div', 'fx-hex');
    wrap.append(nav, find, status, pre);
    draw();
    wrap.jumpTo = jump;
    return wrap;
  }

  // ---------- интерфейс ноды ----------
  function section(title) { const s = U.h('div', 'fx-section'); s.appendChild(U.h('div', 'fx-title', title)); return s; }

  function summaryBlock(a, name, ui) {
    const s = section(T('Файл', 'File'));
    const sha = U.h('a', 'fx-copy', a.sha256);
    sha.href = '#';
    sha.title = T('Копировать SHA-256', 'Copy SHA-256');
    sha.onclick = (ev) => { ev.preventDefault(); U.copy(a.sha256, ui); };
    s.append(
      U.kv(T('Формат', 'Format'), a.format.name),
      U.kv(T('Размер', 'Size'), a.size + ' B (' + NS.fmtSize(a.size) + ')'),
      U.kv('SHA-256', sha),
      U.kv('MD5', a.md5),
      U.kv(T('Энтропия', 'Entropy'), a.entropy.toFixed(2) + ' — ' + entropyNote(a.entropy)));
    return s;
  }

  function tailBlock(node, a, bytes, value, hex, ui) {
    const s = section(T('Данные после конца структуры', 'Data after the end of structure'));
    if (!a.end) { s.appendChild(U.h('div', 'muted small', T('Для этого формата конец не определяется.', 'The end is not determined for this format.'))); return s; }
    if (a.end.tail <= 0) { s.appendChild(U.h('div', 'muted small', T('Лишних данных нет (' + a.end.marker + ').', 'No extra data (' + a.end.marker + ').'))); return s; }
    s.appendChild(U.h('div', 'fx-warn', T(a.end.tail + ' байт после ' + a.end.marker + ' (смещение ' + NS.hex(a.end.end) + ')' + (a.tailFormat ? ' — похоже на ' + a.tailFormat.name : ''),
      a.end.tail + ' bytes after ' + a.end.marker + ' (offset ' + NS.hex(a.end.end) + ')' + (a.tailFormat ? ' — looks like ' + a.tailFormat.name : ''))));
    const row = U.h('div', 'fx-row');
    row.append(
      U.button(T('Сохранить как артефакт', 'Save as artifact'), () => {
        const f = a.tailFormat || NS.Signatures.detect(bytes.subarray(a.end.end));
        U.saveArtifact(bytes.subarray(a.end.end), nameFor(value, '_tail', f.ext), f.mime, ui);
      }, 'accent'),
      U.button(T('Показать', 'Show'), () => hex.jumpTo(a.end.end)),
      U.button(T('Отдать на выход', 'Send to output'), () => { node.params.output = 'tail'; ui.requestEval(); }));
    s.appendChild(row);
    return s;
  }

  function embeddedBlock(node, a, bytes, value, hex, ui) {
    const s = section(T('Вложенные сигнатуры', 'Embedded signatures'));
    if (!a.embedded.length) { s.appendChild(U.h('div', 'muted small', T('Не найдены.', 'None found.'))); return s; }
    a.embedded.slice(0, MAX_EMBEDDED_ROWS).forEach((e) => {
      const row = U.h('div', 'fx-row fx-embedded');
      row.append(
        U.h('span', 'fx-mono', NS.hex(e.offset, 8) + '  ' + e.name),
        U.button(T('Показать', 'Show'), () => hex.jumpTo(e.offset), 'tiny'),
        U.button(T('→ артефакт', '→ artifact'), () => {
          const c = NS.Signatures.carve(bytes, e.offset);
          U.saveArtifact(c.bytes, nameFor(value, '_at' + e.offset.toString(16), c.format.ext), c.format.mime, ui);
        }, 'tiny'),
        U.button(T('На выход', 'To output'), () => { node.params.output = 'carve'; node.params.carve = e.offset; ui.requestEval(); }, 'tiny'));
      s.appendChild(row);
    });
    if (a.embedded.length > MAX_EMBEDDED_ROWS) s.appendChild(U.h('div', 'muted small', T('…ещё ', '…and ') + (a.embedded.length - MAX_EMBEDDED_ROWS)));
    return s;
  }

  NT.file_inspect = {
    name: T('Инспектор файла', 'File inspector'), cat: 'Файлы', wide: true,
    inputs: [T('файл', 'file')],
    desc: T('Определяет формат по сигнатуре, считает SHA-256/MD5 и энтропию, показывает hex с поиском, находит данные после конца файла (после IEND/EOI/EOCD) и вложенные файлы. Выход: отчёт, SHA-256, «хвост» или вырезанный фрагмент как новый артефакт.',
      'Detects the format by signature, computes SHA-256/MD5 and entropy, shows hex with search, finds data after the end of the file (after IEND/EOI/EOCD) and embedded files. Output: report, SHA-256, the “tail” or a carved fragment as a new artifact.'),
    params: [
      { key: 'output', label: T('Выход', 'Output'), type: 'select', default: 'report', options: [['report', T('Отчёт (текст)', 'Report (text)')], ['sha256', 'SHA-256'], ['tail', T('Хвост после конца (артефакт)', 'Tail after the end (artifact)')], ['carve', T('Вырезка по смещению (артефакт)', 'Carve at offset (artifact)')]] },
      { key: 'carve', label: T('Смещение для вырезки', 'Carve offset'), type: 'number', default: 0 },
    ],
    compute([v], p, node) {
      const bytes = NS.requireArtifactBytes(v);
      const a = analyze(v, bytes);
      node.state.analysis = a;
      node.state.bytes = bytes;
      node.state.handle = v;
      return outputFor(v, bytes, a, p);
    },
    update(node, res, body, ui) {
      const box = body.querySelector('.special') || body.appendChild(U.h('div', 'special'));
      const a = node.state.analysis;
      if (!a || !node.state.bytes) { box.innerHTML = ''; delete box.dataset.sig; return; }
      const sig = node.state.handle + a.sha256;
      if (box.dataset.sig === sig) return;
      box.dataset.sig = sig;
      box.innerHTML = '';
      const bytes = node.state.bytes;
      const value = node.state.handle;
      const hex = hexViewer(node, bytes);
      box.append(summaryBlock(a, '', ui), tailBlock(node, a, bytes, value, hex, ui), embeddedBlock(node, a, bytes, value, hex, ui), hex);
    },
  };

  NS.Inspector = { analyze, buildReport, parseOffset };
})(typeof self !== 'undefined' ? self : this);
