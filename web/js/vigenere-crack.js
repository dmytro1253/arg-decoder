// Взлом Виженера без ключа: частотный подбор сдвигов по столбцам + доводка ключа по оценке языка.
// На коротких строках (меньше ~5 букв на позицию ключа) результат ненадёжен — это кандидаты.
(function (G) {
  'use strict';
  const C = G.Codec;
  const MAX_TEXT = 1500;
  const MAX_KEY = 20;

  function freqsFor(alphaName) {
    const d = G.LANG_DATA[alphaName === 'en' ? 'en' : alphaName === 'uk33' && G.LANG_DATA.uk ? 'uk' : 'ru'];
    if (alphaName !== 'ru33') return d.mono;
    // В модели нет «ё»: вставляем её с малой частотой после «е».
    const m = d.mono.slice();
    m.splice(6, 0, 0.001);
    return m;
  }

  function decryptWith(text, shifts, alphaName) {
    return G.CipherOps.periodic(text, shifts.map((s) => C.ALPHABETS[alphaName][s]).join(''), alphaName, 'vigenere', 'dec', true);
  }

  function evaluate(text) {
    const a = G.Scorer.analyze(text, []);
    return a.natural;
  }

  /**
   * @param {string} text
   * @param {{maxKeyLen?:number, top?:number}} opts
   * @returns {Array<{key:string, text:string, alpha:string, score:number}>}
   */
  function crack(text, opts) {
    G.Scorer.init();
    // Длинный текст обрезаем: для подбора ключа хватает первых букв, а интерфейс не должен зависать.
    const fullText = text;
    text = text.slice(0, MAX_TEXT);
    const maxKeyLen = Math.min(MAX_KEY, (opts && opts.maxKeyLen) || 10);
    const top = (opts && opts.top) || 5;
    const cyr = (text.match(/[а-яёіїєґ]/gi) || []).length;
    const lat = (text.match(/[a-z]/gi) || []).length;
    const alphaName = cyr > lat ? (G.LANG_DATA.uk ? C.autoCyrillic(text) : 'ru33') : 'en';
    const alpha = C.ALPHABETS[alphaName];
    const m = alpha.length;
    const freqs = freqsFor(alphaName);
    const idx = Array.from(text.toLowerCase()).map((ch) => alpha.indexOf(ch)).filter((i) => i >= 0);
    const out = [];
    const limit = Math.min(maxKeyLen, Math.max(1, Math.floor(idx.length / 2)));

    for (let L = 1; L <= limit; L++) {
      // 1) Частотная оценка каждой позиции ключа.
      const shifts = [];
      for (let col = 0; col < L; col++) {
        let bestK = 0, bestV = -Infinity;
        for (let k = 0; k < m; k++) {
          let v = 0;
          for (let i = col; i < idx.length; i += L) v += Math.log(freqs[C.mod(idx[i] - k, m)] + 1e-4);
          if (v > bestV) { bestV = v; bestK = k; }
        }
        shifts.push(bestK);
      }
      // 2) Доводка: по очереди меняем каждую позицию, пока оценка растёт.
      let best = evaluate(decryptWith(text, shifts, alphaName));
      for (let round = 0; round < 3; round++) {
        let improved = false;
        for (let col = 0; col < L; col++) {
          let bestK = shifts[col];
          for (let k = 0; k < m; k++) {
            shifts[col] = k;
            const v = evaluate(decryptWith(text, shifts, alphaName));
            if (v > best + 1e-6) { best = v; bestK = k; improved = true; }
          }
          shifts[col] = bestK;
        }
        if (!improved) break;
      }
      const key = shifts.map((s) => alpha[s]).join('');
      // Короткие ключи предпочтительнее при равной оценке: длинный ключ подгоняется под что угодно.
      const penalty = L / Math.max(1, idx.length) * 0.8;
      out.push({ key, alpha: alphaName, text: decryptWith(fullText, shifts, alphaName), score: best - penalty });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, top);
  }

  G.VigenereCrack = { crack };
})(typeof self !== 'undefined' ? self : this);
