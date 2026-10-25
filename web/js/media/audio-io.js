// Связь звуковых нод с хранилищем артефактов: декодирование файла в PCM (WAV — точно, остальное
// через WebAudio), кэш, выбор канала/фрагмента, создание производных артефактов (картинка, WAV).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);

  const loading = new Map();   // id -> Promise<pcm>
  const failed = new Map();    // id -> текст ошибки
  const PCM_PREFIX = 'pcm:';

  const artifacts = () => {
    if (!G.Artifacts) throw new Error(T('Хранилище артефактов не загружено', 'Artifact store is not loaded'));
    return G.Artifacts;
  };

  /** Уже декодированный звук артефакта или null. */
  function peek(handle) {
    const A = artifacts();
    const id = A.idOf(handle);
    if (!id) return null;
    const own = A.runtimeGet(id);
    if (own && own.channels && own.sampleRate) return own;
    return A.runtimeGet(PCM_PREFIX + id) || null;
  }

  async function decodeBytes(bytes) {
    if (G.Wav.isWav(bytes)) {
      try { return Object.assign(G.Wav.parse(bytes), { native: true }); } catch (e) { /* экзотический WAV — пробуем WebAudio */ }
    }
    const Ctx = G.AudioContext || G.webkitAudioContext;
    if (!Ctx) throw new Error(T('Браузер не умеет декодировать этот формат (нет WebAudio)', 'This browser cannot decode this format (no WebAudio)'));
    const ctx = new Ctx();
    try {
      const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const buf = await ctx.decodeAudioData(copy);
      const channels = [];
      for (let c = 0; c < buf.numberOfChannels; c++) channels.push(Float32Array.from(buf.getChannelData(c)));
      return { sampleRate: buf.sampleRate, channels, duration: buf.duration, native: false };
    } finally {
      if (ctx.close) ctx.close().catch(() => {});
    }
  }

  /** Декодирует звук артефакта (аудио или звуковая дорожка видео); результат кэшируется. */
  function load(handle) {
    const A = artifacts();
    const art = A.require(handle);
    if (art.kind !== 'audio' && art.kind !== 'video') {
      throw new Error(T('Нужен аудио- или видеофайл, а пришёл «' + art.kind + '»', 'Need an audio or video file, got “' + art.kind + '”'));
    }
    const hit = peek(handle);
    if (hit) return Promise.resolve(hit);
    if (loading.has(art.id)) return loading.get(art.id);
    const bytes = A.bytes(art.id);
    if (!bytes) return Promise.reject(new Error(T('У файла нет данных', 'File has no data')));
    const p = decodeBytes(bytes).then((pcm) => {
      A.runtimeSet(PCM_PREFIX + art.id, pcm);
      failed.delete(art.id);
      return pcm;
    }).catch((e) => {
      const msg = e && e.message ? e.message : String(e);
      failed.set(art.id, T('Не удалось декодировать звук: ' + msg, 'Could not decode audio: ' + msg));
      throw e;
    }).finally(() => loading.delete(art.id));
    loading.set(art.id, p);
    return p;
  }

  /**
   * Синхронный доступ для compute(): готовый PCM или ошибка «идёт декодирование».
   * Промис кладётся в node.state.wait — update() по его завершению перезапускает вычисление.
   */
  function need(handle, node) {
    const A = artifacts();
    A.require(handle);
    const hit = peek(handle);
    if (hit) return hit;
    const id = A.idOf(handle);
    if (failed.has(id)) throw new Error(failed.get(id));
    const p = load(handle);
    if (node && node.state) node.state.wait = p;
    const err = new Error(T('Декодирую звук…', 'Decoding audio…'));
    err.pending = true;
    throw err;
  }

  /** Вызывается из update(): после загрузки просит пересчёт графа. */
  function hookPending(node, ui) {
    const p = node.state && node.state.wait;
    if (!p || node.state.waitHooked === p) return;
    node.state.waitHooked = p;
    const done = () => { if (node.state.wait === p) node.state.wait = null; ui.requestEval(); };
    p.then(done, done);
  }

  /**
   * Подготовка сигнала: канал, реверс, скорость (меняет частоту дискретизации «на лету»), интервал в секундах.
   * @returns {{samples:Float32Array, sampleRate:number, offset:number}} offset — начало фрагмента в исходном времени
   */
  function prepare(pcm, o) {
    const opt = Object.assign({ channel: 'mono', reverse: false, speed: 1, from: 0, to: 0 }, o || {});
    let samples = G.DSP.mixdown(pcm.channels, opt.channel);
    if (opt.reverse) samples = G.DSP.reverse(samples);
    const speed = opt.speed > 0 ? opt.speed : 1;
    const sr = pcm.sampleRate * speed;
    const a = Math.floor(Math.max(0, opt.from) * pcm.sampleRate);
    const b = opt.to > 0 ? Math.min(samples.length, Math.floor(opt.to * pcm.sampleRate)) : samples.length;
    if (b - a < 16) throw new Error(T('Пустой интервал', 'Empty time range'));
    return { samples: samples.subarray(a, b), sampleRate: sr, offset: a / pcm.sampleRate };
  }

  // ---------- Производные артефакты ----------
  function rgbaToDataUrl(img) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').putImageData(new G.ImageData(img.data, img.width, img.height), 0, 0);
    return c.toDataURL('image/png');
  }

  /** Картинка {width,height,data} как производный артефакт-изображение. @returns {string} handle */
  function putImage(key, img, name) {
    const A = artifacts();
    const dataUrl = rgbaToDataUrl(img);
    const meta = { name, mime: 'image/png', width: img.width, height: img.height };
    if (dataUrl) { meta.dataUrl = dataUrl; meta.size = Math.round(dataUrl.length * 0.75); }
    return A.handle(A.addDerived(key, 'image', img, meta));
  }

  /** Звук как производный артефакт (WAV 16 бит). @returns {string} handle */
  function putAudio(key, channels, sampleRate, name) {
    const A = artifacts();
    const bytes = G.Wav.encode(channels, sampleRate);
    const dataUrl = 'data:audio/wav;base64,' + G.Wav.toBase64(bytes);
    const pcm = { sampleRate, channels, duration: channels[0].length / sampleRate, native: true };
    return A.handle(A.addDerived(key, 'audio', pcm, { name, mime: 'audio/wav', dataUrl, size: bytes.length }));
  }

  /** Короткая подпись содержимого для ключей кэша. */
  function sig(parts) { return parts.map((p) => (typeof p === 'number' ? Math.round(p * 1e4) / 1e4 : String(p))).join('|'); }

  G.AudioIO = { peek, load, need, hookPending, prepare, putImage, putAudio, decodeBytes, rgbaToDataUrl, sig };
})(typeof self !== 'undefined' ? self : this);
