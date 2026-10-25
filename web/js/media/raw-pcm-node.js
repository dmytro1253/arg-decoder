// «Байты → звук (raw PCM)»: любой файл читается как сырые отсчёты звука (аудит 2026-10-23, Dr. Langeskov:
// theme.wav.bmp — картинка, байты которой задумано слушать). Формат отсчёта, каналы, частота, смещение заголовка
// задаются явно: переименования расширения для этого недостаточно. Выход — звуковой артефакт (WAV 16 бит).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const NS = G.ArgFiles;
  const FORMATS = {
    u8: { bytes: 1, read: (b, o) => (b[o] - 128) / 128 },
    s8: { bytes: 1, read: (b, o) => ((b[o] << 24) >> 24) / 128 },
    s16le: { bytes: 2, read: (b, o) => ((b[o] | (b[o + 1] << 8)) << 16 >> 16) / 32768 },
    s16be: { bytes: 2, read: (b, o) => (((b[o] << 8) | b[o + 1]) << 16 >> 16) / 32768 },
    s24le: { bytes: 3, read: (b, o) => ((b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) << 8 >> 8) / 8388608 },
    s32le: { bytes: 4, read: (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) / 2147483648 },
    f32le: { bytes: 4, read: (b, o) => new DataView(b.buffer, b.byteOffset + o, 4).getFloat32(0, true) },
  };
  const MAX_SECONDS = 600;

  /** Байты → каналы Float32Array. Неполный последний кадр отбрасывается. */
  function decodeRaw(bytes, p) {
    const fmt = FORMATS[p.format] || FORMATS.u8;
    const ch = Math.max(1, Math.min(8, Math.floor(Number(p.channels) || 1)));
    const rate = Math.max(1000, Math.min(192000, Math.floor(Number(p.rate) || 8000)));
    const start = Math.max(0, Math.floor(Number(p.offset) || 0));
    const frame = fmt.bytes * ch;
    const frames = Math.min(Math.floor((bytes.length - start) / frame), MAX_SECONDS * rate);
    if (frames <= 0) throw new Error(T('После смещения не осталось байт для звука', 'No bytes are left for audio after the offset'));
    const channels = Array.from({ length: ch }, () => new Float32Array(frames));
    for (let i = 0; i < frames; i++) for (let c = 0; c < ch; c++) {
      const v = fmt.read(bytes, start + i * frame + c * fmt.bytes);
      channels[c][i] = Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
    }
    return { channels, rate, frames, cut: frames === MAX_SECONDS * rate };
  }

  G.NodeTypes.raw_pcm = {
    name: T('Байты → звук (raw PCM)', 'Bytes → audio (raw PCM)'), cat: 'Звук и видео', inputs: [T('файл/байты', 'file/bytes')],
    desc: T('Читает любой файл или байтовую строку как сырые отсчёты звука: формат отсчёта, каналы, частота и смещение заголовка задаются явно. Нужен, когда звук спрятан в «картинке» или файле без заголовка. Выход — звуковой артефакт для спектрограммы, Морзе, DTMF и SSTV.',
      'Reads any file or byte string as raw audio samples: the sample format, channels, rate and header offset are set explicitly. Use it when sound hides in an “image” or a headerless file. The output is an audio artifact for the spectrogram, Morse, DTMF and SSTV.'),
    params: [
      { key: 'format', label: T('Формат отсчёта', 'Sample format'), type: 'select', options: [['u8', T('8 бит без знака', '8-bit unsigned')], ['s8', T('8 бит со знаком', '8-bit signed')], ['s16le', '16-bit LE'], ['s16be', '16-bit BE'], ['s24le', '24-bit LE'], ['s32le', '32-bit LE'], ['f32le', 'float 32 LE']], default: 'u8' },
      { key: 'channels', label: T('Каналов', 'Channels'), type: 'number', default: 1 },
      { key: 'rate', label: T('Частота, Гц', 'Sample rate, Hz'), type: 'number', default: 8000 },
      { key: 'offset', label: T('Пропустить байт в начале (заголовок)', 'Skip bytes at the start (header)'), type: 'number', default: 0 },
    ],
    compute([v], p, node) {
      if (v === undefined || v === '') throw new Error(T('Подключи файл или байты', 'Connect a file or bytes'));
      const bytes = NS.bytesAuto(v);
      const r = decodeRaw(bytes, p);
      node.state.info = { seconds: r.frames / r.rate, cut: r.cut, size: bytes.length };
      const key = 'raw_' + NS.keyOf(String(v).slice(0, 200) + bytes.length + JSON.stringify([p.format, p.channels, p.rate, p.offset]));
      return G.AudioIO.putAudio(key, r.channels, r.rate, T('сырые байты.wav', 'raw bytes.wav'));
    },
    update(node, res, body) {
      let box = body.querySelector('.special');
      if (!box) { box = document.createElement('div'); body.appendChild(box); }
      const i = node.state.info;
      box.className = 'special small ' + (res.error || (i && i.cut) ? 'fx-warn' : 'muted');
      box.textContent = res.error ? res.error : i ? NS.fmtSize(i.size) + ' → ' + i.seconds.toFixed(2) + T(' с звука', ' s of audio') + (i.cut ? T(' (обрезано до ' + MAX_SECONDS + ' с)', ' (cut to ' + MAX_SECONDS + ' s)') : '') : '';
    },
  };

  G.RawPcm = { decodeRaw, FORMATS };
})(typeof self !== 'undefined' ? self : this);
