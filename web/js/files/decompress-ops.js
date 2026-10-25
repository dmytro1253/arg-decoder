// Распаковка zlib / gzip / сырого deflate как операция графа и шаг авто-поиска.
// Формат определяется по заголовку (gzip 1F 8B 08, zlib 78 xx и другие CMF/FLG с делимостью на 31) или задаётся
// вручную; контрольные суммы (Adler-32, CRC-32 + длина) проверяются. Распаковщик общий с ZIP и PNG (inflate.js).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const C = G.Codec;
  const { def, lenient, inputBytes } = G.CipherOps;
  const MB = 1048576;
  const AUTO_MAX_OUT = MB;          // в авто-поиске больше 1 МБ не распаковываем
  const PROBE_MIN = 6;

  const LABEL = { gzip: 'gzip', zlib: 'zlib', raw: T('сырой deflate', 'raw deflate') };

  /** Распаковать байтовую строку: { bytes (байтовая строка), format, checksum, name, trailing }. */
  function unpack(bin, format, maxOut) {
    const r = G.ArgFiles.Inflate.decompress(C.binToArray(bin), { format, maxOut });
    return Object.assign({}, r, { bytes: C.arrayToBin(r.data) });
  }

  def({
    id: 'decompress', name: T('Распаковать zlib / gzip / deflate', 'Decompress zlib / gzip / deflate'), cat: 'Кодировки', prior: 2,
    desc: T('Распаковывает сжатые байты: gzip (1F 8B), zlib (78 9C, 78 DA…) и сырой deflate. «Авто» определяет формат по заголовку, сырой deflate — только если поток занимает весь вход. Проверяются Adler-32 (zlib) и CRC-32 с длиной (gzip). Вход — байтовая строка (после Base64, HEX, XOR) или файл; выход — байты (дальше «Байты → текст» или «Байты → файл»). Размер результата ограничен.',
      'Decompresses compressed bytes: gzip (1F 8B), zlib (78 9C, 78 DA…) and raw deflate. “Auto” picks the format by the header; raw deflate only if the stream fills the whole input. Adler-32 (zlib) and CRC-32 with the length (gzip) are checked. The input is a byte string (after Base64, HEX, XOR) or a file; the output is bytes (then Bytes → text or Bytes → file). The result size is limited.'),
    params: [
      { key: 'format', label: T('Формат', 'Format'), type: 'select', options: [['auto', T('Авто (по заголовку)', 'Auto (by the header)')], ['zlib', 'zlib'], ['gzip', 'gzip'], ['raw', T('сырой deflate', 'raw deflate')]], default: 'auto' },
      { key: 'maxMb', label: T('Предел результата, МБ', 'Result limit, MB'), type: 'number', default: 16 },
      G.CipherOps.STRICT_PARAM,
    ],
    run([v], p) {
      const maxMb = Number(p.maxMb);
      if (!(maxMb > 0) || maxMb > 256) throw new Error(T('Предел результата — от 0 до 256 МБ', 'The result limit is 0 to 256 MB'));
      const bin = inputBytes(v, 'auto');
      if (!bin.length) throw new Error(T('Пустой вход', 'Empty input'));
      const r = unpack(bin, p.format, Math.round(maxMb * MB));
      // Неверная контрольная сумма — либо повреждение, либо не тот ключ выше по цепочке: в строгом режиме это ошибка.
      if (r.checksum === 'bad') lenient(p.strict, T('Контрольная сумма ' + LABEL[r.format] + ' не совпала: данные повреждены или ключ выше по цепочке неверен', 'The ' + LABEL[r.format] + ' checksum does not match: the data are damaged or a key upstream is wrong'));
      if (r.checksum === 'missing') lenient(p.strict, T('Поток ' + LABEL[r.format] + ' оборван: контрольной суммы в конце нет', 'The ' + LABEL[r.format] + ' stream is cut short: no checksum at the end'));
      if (r.trailing > 0 && r.format !== 'raw') lenient(p.strict, T('После потока ещё ' + r.trailing + ' байт (не распакованы)', r.trailing + ' more bytes after the stream (not decompressed)'));
      return r.bytes;
    },
    // В авто-поиске: только байтовые строки (после Base64/HEX/XOR) с заголовком zlib/gzip или похожие на сырой deflate.
    probes(t) {
      if (t.length < PROBE_MIN || /[^\u0000-ÿ]/.test(t) || !/[\u0000-\u0008\u000e-\u001f\u007f-ÿ]/.test(t)) return [];
      return [{ format: 'auto', maxMb: AUTO_MAX_OUT / MB }];
    },
  });

  /** Байтовая строка — проверенный поток zlib/gzip (заголовок и контрольная сумма сошлись). Для доказательности шага. */
  function verified(t) {
    if (/[^\u0000-ÿ]/.test(t)) return false;
    const b = C.binToArray(t);
    if (!G.ArgFiles.Inflate.detect(b)) return false;
    try { return G.ArgFiles.Inflate.decompress(b, { format: 'auto', maxOut: AUTO_MAX_OUT }).checksum === 'ok'; } catch (e) { return false; }
  }

  /** Заголовок zlib/gzip у байтовой строки (без распаковки) — 'zlib' | 'gzip' | null. */
  function headerKind(t) {
    if (t.length < PROBE_MIN || /[^\u0000-ÿ]/.test(t)) return null;
    return G.ArgFiles.Inflate.detect(C.binToArray(t));
  }

  G.Decompress = { unpack, verified, headerKind, AUTO_MAX_OUT };
})(typeof self !== 'undefined' ? self : this);
