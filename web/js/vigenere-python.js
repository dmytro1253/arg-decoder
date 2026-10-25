// Клиент встроенного Python-движка подбора Виженера на сервере (CPU/CUDA, словари на миллионы слов).
// Возвращает строки в том же формате, что и браузерный VigenereAuto.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const POLL_MS = 700;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // «ru-33» → «ru33»: имена алфавитов операций графа.
  const alphaName = (a) => String(a || '').replace('-', '');

  function toRow(r, variant) {
    const alpha = alphaName(r.alpha);
    return {
      key: r.key, alpha, alphaLabel: r.alpha, variant, keylen: r.keylen, final: r.final, words: r.words, cov: r.cov,
      plain: r.plain, user: !!r.user,
    };
  }

  /**
   * @param {string} text
   * @param {{mode?:string, variant?:string, lang?:string, alphabet?:string, gpu?:boolean, maxLen?:number, keys?:string[], cancel?:{stop:boolean}}} opts
   * @param {(info:{stage:string, rows:Array, progress:object|null, log:string[], gpu:boolean}) => void} onProgress
   */
  async function run(text, opts, onProgress) {
    const o = opts || {};
    const variant = o.variant || 'vigenere';
    const job = await G.API.vigStart({
      text, mode: o.mode || 'auto', variant, lang: o.lang || 'auto', alphabet: o.alphabet || 'auto',
      gpu: o.gpu !== false, max_len: o.maxLen || 20, keys: o.keys || (G.Profiles ? G.Profiles.keys() : []), ui: G.I18n ? G.I18n.lang : 'ru',
    });
    let status = job;
    let stopSent = false;
    while (status.status === 'идёт') { // i18n-ok: данные
      if (o.cancel && o.cancel.stop && !stopSent) { stopSent = true; await G.API.vigStop(job.id).catch(() => null); }
      await sleep(POLL_MS);
      status = await G.API.vigStatus(job.id);
      if (onProgress) onProgress({ stage: progressText(status), rows: status.rows.map((r) => toRow(r, variant)), progress: status.progress, log: status.log, gpu: status.gpu });
    }
    if (status.status === 'ошибка' && !status.rows.length) throw new Error(status.log.slice(-1)[0] || T('движок завершился с ошибкой', 'the engine finished with an error')); // i18n-ok: данные
    return { rows: status.rows.map((r) => toRow(r, variant)), log: status.log, gpu: status.gpu, status: status.status, seconds: status.seconds, truncated: status.truncated || null };
  }

  function progressText(s) {
    const p = s.progress;
    const where = (s.gpu ? 'GPU' : 'CPU') + ' · ' + s.alphabets.join(', ');
    if (!p || !p.total) return T('Python-движок, ', 'Python engine, ') + where + ' · ' + (s.log.slice(-1)[0] || T('подготовка', 'preparing'));
    const pct = Math.min(100, (100 * p.done) / p.total).toFixed(1);
    const rate = Math.round(p.rate || 0).toLocaleString(G.I18n && G.I18n.locale ? G.I18n.locale() : 'ru-RU');
    return T(`Python-движок, ${where} · ${pct}% · ${rate} ключей/с · осталось ~${Math.round(p.eta || 0)} с`, `Python engine, ${where} · ${pct}% · ${rate} keys/s · ~${Math.round(p.eta || 0)} s left`);
  }

  G.VigPython = { run };
})(typeof self !== 'undefined' ? self : this);
