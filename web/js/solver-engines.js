// Внешние движки общего авто-поиска: полный Python-подбор Виженера (CPU/CUDA) на локальном сервере.
// Запускается параллельно с браузерным лучевым поиском, когда вход похож на буквенный шифртекст;
// живёт в пределах бюджета времени, останавливается по отмене и честно сообщает, если сервера нет.
// Ключ, найденный движком, не попадает в банк ключей проекта: это гипотеза с происхождением.
(function (G) {
  'use strict';
  const POLL_MS = 400;
  const READY_TTL = 60000;
  const MIN_LETTERS = 6;
  const MAX_ROWS = 8;
  const MAX_JOBS = 3;               // вход и до двух промежуточных состояний на один поиск
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let ready = { at: 0, ok: false };

  async function engineReady() {
    if (!G.API || !G.API.online) return false;
    if (Date.now() - ready.at < READY_TTL) return ready.ok;
    ready = { at: Date.now(), ok: await G.API.pythonEngine().catch(() => false) };
    return ready.ok;
  }

  /** Вход похож на буквенный шифртекст, который имеет смысл отдать полному подбору Виженера. */
  function wantsVigenere(input, analysis) {
    const s = input.trim();
    const letters = (s.match(/[a-zа-яёієїґ]/gi) || []).length;
    const nonSpace = s.replace(/\s/g, '').length || 1;
    if (letters < MIN_LETTERS || letters / nonSpace < 0.7) return false;
    // Ссылка внутри нечитаемого текста не делает его ответом: такой текст тоже подбираем.
    if (analysis.readable || analysis.linkConfirmed) return false;
    return !(G.Scorer && G.Scorer.intermediateKind(s));
  }

  // «en-26» → алфавит операции графа «Виженер».
  const opAlpha = (a) => ({ 'en-26': 'en', 'ru-33': 'ru33', 'ru-32': 'ru32', 'uk-33': 'uk33', 'uk-32': 'uk32' }[a] || 'auto');

  /**
   * Очередь заданий Python-подбора на один поиск: сам вход и промежуточные буквенные состояния (после Base64, hex…).
   * Сервер выполняет одно задание за раз, поэтому задания идут по очереди; одинаковые тексты не повторяются,
   * общий бюджет и отмена действуют на всю очередь.
   * add(text, analysis, meta) → true, если задание поставлено; wait(budgetMs) → { rows, reports }.
   * rows: [{ text, key, alpha, variant, keylen, engine, ms, meta }]; reports: [{ engine, status, ms, rows, note, input }].
   */
  function queue(opts) {
    const o = opts || {};
    const t0 = Date.now();
    const jobs = [];
    const seen = new Set();
    let deadline = t0 + (o.budgetMs || 20000);
    let loop = null;

    function add(text, analysis, meta) {
      if (o.engines === false || seen.has(text) || jobs.length >= MAX_JOBS || !wantsVigenere(text, analysis)) return false;
      seen.add(text);
      jobs.push({ text, meta: meta || {}, rows: [], report: { engine: 'python-vigenere', status: 'queued', ms: 0, rows: 0, note: '', input: text.slice(0, 40) } });
      if (!loop) loop = run();
      return true;
    }

    async function runJob(job) {
      const started = Date.now();
      try {
        const id = (await G.API.vigStart({ text: job.text, mode: 'auto', variant: 'vigenere', lang: 'auto', alphabet: 'auto', gpu: true, max_len: 20, keys: o.keys || [], ui: G.I18n ? G.I18n.lang : 'ru' })).id;
        job.report.status = 'running';
        let stopSent = false;
        for (;;) {
          const status = await G.API.vigStatus(id).catch((e) => ({ status: 'error', rows: job.rows, log: [e.message] }));
          job.rows = status.rows || job.rows;
          const state = G.API.engineStatus(status.status);
          if (state !== 'running') {
            // Отмена/бюджет уже записаны при остановке; иначе — честный итог движка (неизвестный статус = ошибка).
            if (!stopSent) job.report.status = state === 'done' ? 'done' : state === 'cancelled' ? 'cancelled' : 'error';
            if (state === 'error' || state === 'unknown') job.report.note = G.API.engineFailure(status) || job.report.note;
            break;
          }
          const cancelled = o.cancel && o.cancel.stop;
          if ((cancelled || Date.now() > deadline) && !stopSent) {
            stopSent = true;
            job.report.status = cancelled ? 'cancelled' : 'timeout';
            await G.API.vigStop(id).catch(() => null);
          }
          if (stopSent && Date.now() > deadline + 3000) break;   // остановка подтверждается не сразу — не ждём бесконечно
          await sleep(POLL_MS);
        }
      } catch (e) {
        job.report.status = /Уже идёт|already running/i.test(e.message) ? 'busy' : 'error'; // i18n-ok: ответ сервера
        job.report.note = e.message;
      }
      job.report.ms = Date.now() - started;
    }

    async function run() {
      if (!(await engineReady())) { for (const j of jobs) if (j.report.status === 'queued') j.report.status = 'unavailable'; return; }
      for (const job of jobs) {
        if (job.report.status !== 'queued') continue;
        if ((o.cancel && o.cancel.stop) || Date.now() > deadline) { job.report.status = o.cancel && o.cancel.stop ? 'cancelled' : 'skipped-budget'; continue; }
        await runJob(job);
      }
    }

    async function wait(budgetMs) {
      deadline = t0 + Math.max(0, budgetMs);
      // Задания, добавленные во время или после прохода очереди, обрабатываются следующим проходом.
      while (loop) {
        await loop;
        if (jobs.some((j) => j.report.status === 'queued')) loop = run(); else break;
      }
      const rows = [];
      for (const job of jobs) {
        const out = job.rows.filter((r) => !r.user).slice(0, MAX_ROWS).map((r) => ({
          text: r.plain, key: r.key, alpha: opAlpha(r.alpha), alphaLabel: r.alpha, variant: 'vigenere', keylen: r.keylen || String(r.key).length,
          engine: 'python-vigenere', ms: job.report.ms, meta: job.meta,
        }));
        job.report.rows = out.length;
        rows.push(...out);
      }
      const reports = jobs.length ? jobs.map((j) => j.report) : [{ engine: 'python-vigenere', status: 'skipped', ms: 0, rows: 0, note: o.engines === false ? 'off' : 'not a letter ciphertext' }];
      return { rows, reports };
    }
    return { add, wait, size: () => jobs.length };
  }

  const T = G.T || ((ru) => ru);
  /** Строка о работе движков для строки состояния: «Python-Виженер: 2.2 с, 8 вариантов» или почему не запускался. */
  function describe(reports) {
    return (reports || []).filter((r) => r.status !== 'skipped').map((r) => {
      const what = { done: T('готово', 'done'), timeout: T('остановлен по бюджету времени', 'stopped by the time budget'), cancelled: T('остановлен', 'stopped'),
        unavailable: T('недоступен: нет локального сервера или numpy — запусти программу через Start', 'unavailable: no local server or numpy; start the app with Start'),
        busy: T('занят другой задачей', 'busy with another job'), error: T('ошибка: ', 'error: ') + r.note,
        'skipped-budget': T('не запущен: бюджет времени исчерпан', 'not started: the time budget ran out'), queued: T('в очереди', 'queued') }[r.status] || r.status;
      return T('Python-Виженер: ', 'Python Vigenère: ') + what + (r.ms ? ' · ' + (r.ms / 1000).toFixed(1) + T(' с', ' s') : '') + (r.rows ? T(' · вариантов ', ' · candidates ') + r.rows : '');
    }).join(' · ');
  }

  G.SolverEngines = { queue, describe, wantsVigenere, engineReady, resetCache: () => { ready = { at: 0, ok: false }; } };
})(typeof self !== 'undefined' ? self : this);
