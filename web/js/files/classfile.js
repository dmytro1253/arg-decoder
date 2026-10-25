// Разбор Java .class: версия, пул констант (строки, имена классов/методов), конец структуры.
// Нужен, чтобы находить в JAR встроенные идентификаторы и ссылки без декомпилятора.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = (G.ArgFiles = G.ArgFiles || {});

  const TAGS = {
    1: 'Utf8', 3: 'Integer', 4: 'Float', 5: 'Long', 6: 'Double', 7: 'Class', 8: 'String', 9: 'Fieldref', 10: 'Methodref',
    11: 'InterfaceMethodref', 12: 'NameAndType', 15: 'MethodHandle', 16: 'MethodType', 17: 'Dynamic', 18: 'InvokeDynamic', 19: 'Module', 20: 'Package',
  };
  // Размер тела записи пула (без байта тега) для тегов фиксированной длины.
  const FIXED_SIZE = { 3: 4, 4: 4, 5: 8, 6: 8, 7: 2, 8: 2, 9: 4, 10: 4, 11: 4, 12: 4, 15: 3, 16: 2, 17: 4, 18: 4, 19: 2, 20: 2 };

  // «Модифицированный UTF-8» JVM: NUL как C0 80, суррогаты по 3 байта.
  function decodeMutf8(b, start, end) {
    let s = '';
    for (let i = start; i < end;) {
      const c = b[i++];
      if (c < 0x80) s += String.fromCharCode(c);
      else if ((c & 0xe0) === 0xc0 && i < end) s += String.fromCharCode(((c & 0x1f) << 6) | (b[i++] & 0x3f));
      else if ((c & 0xf0) === 0xe0 && i + 1 < end) { s += String.fromCharCode(((c & 0x0f) << 12) | ((b[i] & 0x3f) << 6) | (b[i + 1] & 0x3f)); i += 2; }
      else s += '�';
    }
    return s;
  }

  function truncated() { return new Error(T('Файл .class оборван или повреждён', 'The .class file is truncated or corrupt')); }

  function skipMembers(b, pos) {
    // Поля/методы/атрибуты класса: считаем только длины, чтобы найти конец структуры.
    const need = (n) => { if (pos + n > b.length) throw truncated(); };
    const skipAttrs = () => {
      need(2);
      let n = NS.u16be(b, pos); pos += 2;
      while (n--) { need(6); pos += 6 + NS.u32be(b, pos + 2); if (pos > b.length) throw truncated(); }
    };
    for (let pass = 0; pass < 2; pass++) { // поля, затем методы
      need(2);
      let count = NS.u16be(b, pos); pos += 2;
      while (count--) { need(6); pos += 6; skipAttrs(); }
    }
    skipAttrs();
    return pos;
  }

  /**
   * Разобрать class-файл.
   * @returns {{major:number, minor:number, constants:{index:number,tag:string,value:string}[], strings:string[], names:string[], thisClass:string, end:number}}
   */
  function parse(b) {
    if (b.length < 10 || NS.u32be(b, 0) !== 0xcafebabe) throw new Error(T('Это не .class (нет CAFEBABE)', 'Not a .class file (no CAFEBABE)'));
    const minor = NS.u16be(b, 4);
    const major = NS.u16be(b, 6);
    const count = NS.u16be(b, 8);
    const raw = new Array(count);
    let pos = 10;
    for (let i = 1; i < count; i++) {
      if (pos >= b.length) throw truncated();
      const tag = b[pos++];
      if (!TAGS[tag]) throw new Error(T('Неизвестный тег пула констант: ' + tag, 'Unknown constant pool tag: ' + tag));
      if (tag === 1) {
        if (pos + 2 > b.length) throw truncated();
        const len = NS.u16be(b, pos);
        if (pos + 2 + len > b.length) throw truncated();
        raw[i] = { tag, text: decodeMutf8(b, pos + 2, pos + 2 + len) };
        pos += 2 + len;
      } else {
        const size = FIXED_SIZE[tag];
        if (pos + size > b.length) throw truncated();
        raw[i] = { tag, ref: size >= 2 ? NS.u16be(b, pos) : 0, ref2: size >= 4 ? NS.u16be(b, pos + 2) : 0, at: pos };
        pos += size;
        if (tag === 5 || tag === 6) i++; // Long/Double занимают два слота
      }
    }
    const utf = (i) => (raw[i] && raw[i].tag === 1 ? raw[i].text : '');
    const constants = [];
    const strings = [];
    const names = [];
    raw.forEach((c, i) => {
      if (!c) return;
      if (c.tag === 1) constants.push({ index: i, tag: 'Utf8', value: c.text });
      else if (c.tag === 8) { const v = utf(c.ref); strings.push(v); constants.push({ index: i, tag: 'String', value: v }); }
      else if (c.tag === 7) { const v = utf(c.ref); names.push(v); constants.push({ index: i, tag: 'Class', value: v }); }
    });
    if (pos + 8 > b.length) throw truncated();
    const thisIdx = NS.u16be(b, pos + 2);
    const thisClass = raw[thisIdx] && raw[thisIdx].tag === 7 ? utf(raw[thisIdx].ref) : '';
    const interfaces = NS.u16be(b, pos + 6);
    const end = skipMembers(b, pos + 8 + interfaces * 2);
    return { major, minor, constants, strings, names, thisClass, end };
  }

  /** Текст для просмотра: сначала строковые литералы (где обычно прячутся ID), затем остальные Utf8. */
  function describe(b, opts) {
    const o = Object.assign({ all: true }, opts || {});
    const c = parse(b);
    const lines = ['class ' + (c.thisClass || '?') + '  (Java ' + (c.major - 44) + ', major ' + c.major + ')'];
    const lits = new Set(c.strings);
    lines.push('', T('— Строковые литералы —', '— String literals —'));
    c.strings.forEach((s) => lines.push(JSON.stringify(s)));
    if (o.all) {
      lines.push('', T('— Остальные константы Utf8 (имена, сигнатуры) —', '— Other Utf8 constants (names, signatures) —'));
      c.constants.filter((k) => k.tag === 'Utf8' && !lits.has(k.value)).forEach((k) => lines.push(k.value));
    }
    return lines.join('\n');
  }

  /** Все строки класса для поиска: литералы + Utf8. */
  function allStrings(b) {
    const c = parse(b);
    return [...new Set(c.constants.filter((k) => k.tag === 'Utf8').map((k) => k.value))];
  }

  NS.ClassFile = { parse, describe, allStrings, decodeMutf8 };
})(typeof self !== 'undefined' ? self : this);
