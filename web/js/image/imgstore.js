// Мост между артефактами (G.Artifacts) и пикселями: декодирование оригинала в {width,height,data},
// производные версии по рецепту (G.Artifacts.addDerived) и PNG для скачивания. Только браузер (canvas).
// Оригиналы не меняются. Декодированные пиксели лежат в runtime-кэше артефакта.
(function (G) {
  'use strict';

  const T = G.T || ((ru) => ru);
  const pending = new Map(); // id -> Promise
  const listeners = [];
  const derivedOrder = []; // ключи производных в порядке создания: старые вытесняются, чтобы память не росла
  const MAX_DERIVED = 40;

  const A = () => G.Artifacts;
  const isPixels = (v) => v && typeof v.width === 'number' && v.data && v.data.length === v.width * v.height * 4;

  function hash(str) {
    let h1 = 0x811c9dc5, h2 = 0x1b873593;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 + c, 2246822519) >>> 0; }
    return h1.toString(36) + h2.toString(36) + str.length.toString(36);
  }

  function decodeDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve({ width: d.width, height: d.height, data: d.data });
      };
      img.onerror = () => reject(new Error(T('Не удалось декодировать изображение', 'Could not decode the image')));
      img.src = dataUrl;
    });
  }

  function notify() { listeners.slice().forEach((fn) => { try { fn(); } catch (e) { /* слушатель не должен ломать декодер */ } }); }

  /** Подписка на «появились новые пиксели» (нода просит пересчёт графа). */
  function onReady(fn) { if (!listeners.includes(fn)) listeners.push(fn); }

  /**
   * Пиксели по значению из графа ("artifact:<id>"): сразу, если уже декодированы, иначе undefined —
   * тогда запускается декодирование и по готовности вызываются слушатели onReady. Ошибки — в исключение.
   */
  function get(value) {
    const id = A().idOf(value);
    const a = id && A().get(id);
    if (!a) throw new Error(T('Нужен вход-изображение (артефакт)', 'An image artifact input is required'));
    if (a.kind !== 'image') throw new Error(T('Ожидалось изображение, а пришёл «' + a.kind + '»', 'Expected an image, got "' + a.kind + '"'));
    const cached = A().runtimeGet(id);
    if (isPixels(cached)) return cached;
    if (a.error) throw new Error(a.error);
    if (!pending.has(id) && a.dataUrl) {
      pending.set(id, decodeDataUrl(a.dataUrl).then((px) => { A().runtimeSet(id, px); }, (e) => { a.error = e.message; }).then(() => { pending.delete(id); notify(); }));
    }
    return undefined;
  }

  /** Оригинал (до обработки) для сравнения «до/после»: идёт по цепочке source у производных. */
  function sourceOf(value) {
    const id = A().idOf(value);
    const a = id && A().get(id);
    return a && a.sourceHandle ? sourceOf(a.sourceHandle) : value;
  }

  function pngDataUrl(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
    return canvas.toDataURL('image/png');
  }

  /**
   * Производное изображение: ключ = исходная ручка + рецепт. Одинаковый рецепт переиспользует результат.
   * Возвращает ручку "artifact:d_…". Позже читается через get(), байты PNG — лениво (Artifacts.bytes).
   */
  function derive(srcHandle, recipeKey, make, name) {
    const key = hash(srcHandle + '|' + recipeKey);
    const id = 'd_' + key;
    if (!A().has(id) || !isPixels(A().runtimeGet(id))) {
      const px = make();
      derivedOrder.push(id);
      while (derivedOrder.length > MAX_DERIVED) { const old = derivedOrder.shift(); if (old !== id) A().remove(old); }
      A().addDerived(key, 'image', px, { name: name || T('Обработанное изображение', 'Processed image'), mime: 'image/png', width: px.width, height: px.height, sourceHandle: srcHandle });
      const item = A().get(id);
      let url = null;
      Object.defineProperty(item, 'dataUrl', { configurable: true, enumerable: false, get() { if (!url) url = pngDataUrl(px); return url; } });
      Object.defineProperty(item, 'size', { configurable: true, enumerable: false, get() { return Math.round(this.dataUrl.length * 0.75); } });
    }
    return A().handle(id);
  }

  G.ImgStore = { get, derive, sourceOf, onReady, pngDataUrl, isPixels, hash };
})(typeof self !== 'undefined' ? self : this);
