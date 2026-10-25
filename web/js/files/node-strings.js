// Нода «Строки»: достаёт читаемые строки из файла или двоичного текста. Выход — обычный текст
// (одна строка на запись), поэтому дальше можно подключать Base64/HEX/Авто и любые другие ноды.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = G.ArgFiles;
  const NT = G.NodeTypes || (G.NodeTypes = {});

  const KIND_OPTIONS = [
    ['all', T('ASCII + UTF-8 + UTF-16LE', 'ASCII + UTF-8 + UTF-16LE')],
    ['ascii', 'ASCII'],
    ['utf8', T('UTF-8 (с не-ASCII)', 'UTF-8 (with non-ASCII)')],
    ['utf16le', 'UTF-16LE'],
    ['utf16be', 'UTF-16BE'],
  ];

  NT.file_strings = {
    name: T('Строки из файла', 'Strings from file'), cat: 'Файлы',
    inputs: [T('файл/данные', 'file/data')],
    desc: T('Извлекает ASCII, UTF-8 и UTF-16 строки с минимальной длиной и фильтром по регулярному выражению. Принимает артефакт или любые байты (результат HEX/Base64). Выход — текст, по строке на запись.',
      'Extracts ASCII, UTF-8 and UTF-16 strings with a minimum length and a regex filter. Accepts an artifact or any bytes (HEX/Base64 output). Output is text, one string per line.'),
    params: [
      { key: 'kinds', label: T('Кодировки', 'Encodings'), type: 'select', options: KIND_OPTIONS, default: 'all' },
      { key: 'minLen', label: T('Мин. длина', 'Min length'), type: 'number', default: 4 },
      { key: 'regex', label: T('Фильтр (регулярное выражение)', 'Filter (regular expression)'), type: 'text', default: '' },
      { key: 'ignoreCase', label: T('Без учёта регистра', 'Ignore case'), type: 'bool', default: true },
      { key: 'offsets', label: T('Показывать смещения', 'Show offsets'), type: 'bool', default: false },
      { key: 'limit', label: T('Лимит строк', 'Line limit'), type: 'number', default: 5000 },
    ],
    compute([v], p, node) {
      const bytes = NS.bytesAuto(v);
      const r = NS.Strings.extractStrings(bytes, p);
      const byKind = {};
      r.items.forEach((s) => { byKind[s.kind] = (byKind[s.kind] || 0) + 1; });
      node.state.summary = { size: bytes.length, count: r.items.length, truncated: r.truncated, byKind };
      return NS.Strings.formatStrings(r.items, p.offsets);
    },
    update(node, res, body) {
      const box = body.querySelector('.special') || body.appendChild(document.createElement('div'));
      box.classList.add('special');
      const s = node.state.summary;
      if (!s || res.value === undefined) { box.textContent = ''; return; }
      const parts = Object.keys(s.byKind).map((k) => k + ': ' + s.byKind[k]).join(', ');
      box.textContent = T('Найдено строк: ', 'Strings found: ') + s.count + (parts ? ' (' + parts + ')' : '') + T(' · байт: ', ' · bytes: ') + s.size
        + (s.truncated ? T(' · показана только часть — подними лимит или сузь фильтр', ' · partial — raise the limit or narrow the filter') : '');
      box.className = 'special muted small' + (s.truncated ? ' fx-warn' : '');
    },
  };
})(typeof self !== 'undefined' ? self : this);
