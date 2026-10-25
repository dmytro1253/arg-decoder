// Чтение и запись WAV (PCM 8/16/24/32 бит и float 32/64) без WebAudio.
// WAV разбирается точно и с исходной частотой дискретизации; остальные форматы декодирует браузер.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);

  const tag = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

  function isWav(bytes) {
    return !!bytes && bytes.length >= 12 && tag(bytes, 0) === 'RIFF' && tag(bytes, 8) === 'WAVE';
  }

  /** @returns {{sampleRate:number, channels:Float32Array[], bits:number, duration:number}} */
  function parse(bytes) {
    if (!isWav(bytes)) throw new Error(T('Это не WAV-файл', 'Not a WAV file'));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let fmt = null, dataStart = -1, dataLen = 0;
    let pos = 12;
    while (pos + 8 <= bytes.length) {
      const id = tag(bytes, pos);
      let size = view.getUint32(pos + 4, true);
      const body = pos + 8;
      if (id === 'fmt ') {
        fmt = { format: view.getUint16(body, true), channels: view.getUint16(body + 2, true), rate: view.getUint32(body + 4, true), bits: view.getUint16(body + 14, true) };
        if (fmt.format === 0xfffe && size >= 26) fmt.format = view.getUint16(body + 24, true);
      } else if (id === 'data') {
        if (size === 0 || size === 0xffffffff || body + size > bytes.length) size = bytes.length - body;
        dataStart = body; dataLen = size;
        break;
      }
      pos = body + size + (size & 1);
    }
    if (!fmt) throw new Error(T('В WAV нет блока fmt', 'WAV has no fmt chunk'));
    if (dataStart < 0) throw new Error(T('В WAV нет блока data', 'WAV has no data chunk'));
    if (!fmt.channels || !fmt.rate) throw new Error(T('Повреждённый заголовок WAV', 'Corrupt WAV header'));
    const bytesPer = fmt.bits >> 3;
    const isFloat = fmt.format === 3;
    if (!(fmt.format === 1 || isFloat) || ![8, 16, 24, 32, 64].includes(fmt.bits) || (isFloat && fmt.bits !== 32 && fmt.bits !== 64)) {
      throw new Error(T('Формат WAV не поддерживается (код ' + fmt.format + ', ' + fmt.bits + ' бит)', 'Unsupported WAV format (code ' + fmt.format + ', ' + fmt.bits + ' bit)'));
    }
    const frames = Math.floor(dataLen / (bytesPer * fmt.channels));
    const channels = Array.from({ length: fmt.channels }, () => new Float32Array(frames));
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < fmt.channels; c++) {
        const o = dataStart + (i * fmt.channels + c) * bytesPer;
        let v;
        if (isFloat) v = fmt.bits === 32 ? view.getFloat32(o, true) : view.getFloat64(o, true);
        else if (fmt.bits === 8) v = (view.getUint8(o) - 128) / 128;
        else if (fmt.bits === 16) v = view.getInt16(o, true) / 32768;
        else if (fmt.bits === 24) v = ((view.getUint8(o) | (view.getUint8(o + 1) << 8) | (view.getInt8(o + 2) << 16))) / 8388608;
        else v = view.getInt32(o, true) / 2147483648;
        channels[c][i] = v;
      }
    }
    return { sampleRate: fmt.rate, channels, bits: fmt.bits, duration: frames / fmt.rate };
  }

  /** Кодирует каналы в 16-битный PCM WAV (значения обрезаются до [-1, 1]). */
  function encode(channels, sampleRate) {
    const nch = channels.length, n = nch ? channels[0].length : 0;
    if (!nch) throw new Error(T('Нет каналов для записи', 'No channels to write'));
    const dataLen = n * nch * 2;
    const out = new Uint8Array(44 + dataLen);
    const v = new DataView(out.buffer);
    const put = (o, s) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
    put(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); put(8, 'WAVE'); put(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nch, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * nch * 2, true);
    v.setUint16(32, nch * 2, true); v.setUint16(34, 16, true); put(36, 'data'); v.setUint32(40, dataLen, true);
    let o = 44;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < nch; c++) {
        const s = Math.max(-1, Math.min(1, channels[c][i]));
        v.setInt16(o, Math.round(s < 0 ? s * 32768 : s * 32767), true);
        o += 2;
      }
    }
    return out;
  }

  /** Base64 больших массивов байт порциями (btoa на огромной строке падает). */
  function toBase64(bytes) {
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }

  G.Wav = { isWav, parse, encode, toBase64 };
})(typeof self !== 'undefined' ? self : this);
