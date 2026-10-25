// Встроенный подбор ключа Виженера (браузерная версия Python-движка из папки vigenere/):
// все варианты алфавита сразу, стратегия по длине текста (короткий — перебор + словарь,
// длинный — частотный анализ с итерированным локальным поиском), поиск по триграммам,
// финальный ранг: квадграммы + покрытие словом (L^1.4) − ln M за каждую букву ключа.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);
  const C = G.Codec;
  const AUTO_SHORT = 60;          // букв: меньше — ведёт перебор, больше — частотный анализ
  const TOPK = 60;                // лучших ключей на одну длину/задачу
  const COV_LIMIT = 600;          // сколько лидеров получают словарную оценку
  const W_WORD = 6.0;             // вес покрытия словарём
  const MIN_WORD = 3;
  const SLICE_MS = 30;
  const LN10 = Math.LN10;
  const tick = () => new Promise((r) => setTimeout(r, 0));

  const ALPHAS = {
    en26: { letters: C.ALPHABETS.en, lang: 'en', label: 'en-26' },
    ru32: { letters: C.ALPHABETS.ru32, lang: 'ru', label: 'ru-32' },
    ru33: { letters: C.ALPHABETS.ru33, lang: 'ru', label: 'ru-33' },
    uk33: { letters: C.ALPHABETS.uk33, lang: 'uk', label: 'uk-33' },
    uk32: { letters: C.ALPHABETS.uk32, lang: 'uk', label: 'uk-32' },
  };
  const MODELS = {};

  // Модель языка в индексах конкретного алфавита: триграммы для поиска, квадграммы для итога.
  function model(name) {
    if (MODELS[name]) return MODELS[name];
    G.Scorer.init();
    const a = ALPHAS[name];
    const base = G.Scorer.MODELS[a.lang];
    const n = base.n;
    // fold: индекс буквы алфавита → индекс в модели (ё считается как е).
    const fold = Array.from(a.letters, (ch) => base.index.get(ch === 'ё' ? 'е' : ch)); // i18n-ok: данные
    const tri = new Float32Array(n * n * n);
    for (let i = 0; i < n * n * n; i++) {
      let s = 0;
      for (let d = 0; d < n; d++) s += Math.pow(10, base.table[i * n + d]);
      tri[i] = Math.log10(s);
    }
    const mono = G.LANG_DATA[a.lang].mono;
    const freq = fold.map((j, i) => (a.letters[i] === 'ё' ? 0.001 : mono[j])); // i18n-ok: данные
    const words = [...base.words].filter((w) => w.length >= MIN_WORD);
    MODELS[name] = { M: a.letters.length, n, fold, tri, quad: base.table, freq, words: base.words, keyWords: words, letters: a.letters, label: a.label };
    return MODELS[name];
  }

  // Буквы шифра → индексы; шаблон, чтобы вернуть знаки и регистр на место.
  function layout(text, letters) {
    const idx = [];
    const tmpl = [];
    for (const ch of text) {
      const low = ch.toLowerCase();
      const i = letters.indexOf(low);
      if (i >= 0) { idx.push(i); tmpl.push(ch === low ? 1 : 2); } else tmpl.push(ch);
    }
    return { idx: Int16Array.from(idx), tmpl };
  }

  function render(p, tmpl, letters) {
    let out = '', k = 0;
    for (const t of tmpl) {
      if (t === 1) out += letters[p[k++]];
      else if (t === 2) out += letters[p[k++]].toUpperCase();
      else out += t;
    }
    return out;
  }

  const DEC = {
    vigenere: (c, k, M) => (c - k + M) % M,
    beaufort: (c, k, M) => (k - c + M) % M,
    variant: (c, k, M) => (c + k) % M,
  };

  function decrypt(idx, key, M, variant, buf) {
    const f = DEC[variant];
    const out = buf || new Int16Array(idx.length);
    for (let i = 0; i < idx.length; i++) out[i] = f(idx[i], key[i % key.length], M);
    return out;
  }

  function triScore(p, m) {
    const n = m.n, fold = m.fold, tri = m.tri;
    let s = 0;
    for (let i = 0; i + 2 < p.length; i++) s += tri[(fold[p[i]] * n + fold[p[i + 1]]) * n + fold[p[i + 2]]];
    return s;
  }

  function quadScore(p, m) {
    const n = m.n, fold = m.fold, q = m.quad;
    let s = 0;
    for (let i = 0; i + 3 < p.length; i++) s += q[((fold[p[i]] * n + fold[p[i + 1]]) * n + fold[p[i + 2]]) * n + fold[p[i + 3]]];
    return s * LN10;
  }

  function coverage(text, m) {
    const t = text.replace(/ё/g, 'е'); // i18n-ok: данные
    const len = t.length;
    if (!len) return { cov: 0, words: 0 };
    const best = new Float64Array(len + 1);
    const cnt = new Int32Array(len + 1);
    for (let i = 1; i <= len; i++) {
      best[i] = best[i - 1];
      cnt[i] = cnt[i - 1];
      for (let L = MIN_WORD; L <= Math.min(18, i); L++) {
        if (!m.words.has(t.slice(i - L, i))) continue;
        const v = best[i - L] + Math.pow(L, 1.4);
        if (v > best[i]) { best[i] = v; cnt[i] = cnt[i - L] + 1; }
      }
    }
    return { cov: best[len] / Math.max(1, Math.pow(len, 1.4)), words: cnt[len] };
  }

  function minimalPeriod(key) {
    const L = key.length;
    for (let p = 1; p < L; p++) if (L % p === 0 && key.every((v, i) => v === key[i % p])) return key.slice(0, p);
    return key;
  }

  // Набор лучших ключей без повторов.
  class Pool {
    constructor(limit) { this.limit = limit; this.items = []; this.seen = new Set(); this.min = -Infinity; }
    add(score, key) {
      if (this.items.length >= this.limit && score <= this.min) return;
      const k = minimalPeriod(Array.from(key));
      const sig = k.join(',');
      if (this.seen.has(sig)) return;
      this.seen.add(sig);
      this.items.push({ score, key: k });
      if (this.items.length > this.limit * 2) this.trim();
    }
    trim() {
      this.items.sort((a, b) => b.score - a.score);
      this.items.length = Math.min(this.items.length, this.limit);
      this.min = this.items.length >= this.limit ? this.items[this.items.length - 1].score : -Infinity;
    }
    list() { this.trim(); return this.items; }
  }

  // ---------- стадии ----------
  async function brute(ctx, L) {
    const { idx, m, variant, pool, slice } = ctx;
    const M = m.M, total = Math.pow(M, L);
    const key = new Array(L).fill(0);
    const buf = new Int16Array(idx.length);
    for (let n = 0; n < total; n++) {
      let x = n;
      for (let j = L - 1; j >= 0; j--) { key[j] = x % M; x = Math.floor(x / M); }
      pool.add(triScore(decrypt(idx, key, M, variant, buf), m), key);
      if ((n & 4095) === 0 && await slice()) return;
    }
  }

  async function dictionary(ctx) {
    const { idx, m, variant, pool, slice } = ctx;
    const extra = ctx.keys || [];
    const list = extra.concat(m.keyWords);
    let n = 0;
    for (const w of list) {
      for (const word of [w, Array.from(w).reverse().join('')]) {
        const key = Array.from(word.toLowerCase()).map((ch) => m.letters.indexOf(ch === 'ё' && m.M === 32 ? 'е' : ch)); // i18n-ok: данные
        if (!key.length || key.some((k) => k < 0) || key.length > idx.length / 2) continue;
        pool.add(triScore(decrypt(idx, key, m.M, variant), m), key);
      }
      if ((++n & 1023) === 0 && await slice()) return;
    }
  }

  async function frequency(ctx, L, seeds) {
    const { idx, m, variant, pool, slice, rng } = ctx;
    const M = m.M, n = idx.length;
    if (n < L * 2) return;
    const f = DEC[variant];
    const ranked = [];
    for (let col = 0; col < L; col++) {
      const corr = [];
      for (let k = 0; k < M; k++) {
        let s = 0, cnt = 0;
        for (let i = col; i < n; i += L) { s += m.freq[f(idx[i], k, M)]; cnt++; }
        corr.push([k, s / Math.max(1, cnt)]);
      }
      ranked.push(corr.sort((a, b) => b[1] - a[1]).map((x) => x[0]));
    }
    const buf = new Int16Array(n);
    const score = (key) => triScore(decrypt(idx, key, M, variant, buf), m);
    const climb = (key) => {
      let best = score(key);
      let improved = true;
      while (improved) {
        improved = false;
        for (let p = 0; p < L; p++) {
          const keep = key[p];
          let bestK = keep;
          for (let k = 0; k < M; k++) {
            if (k === keep) continue;
            key[p] = k;
            const s = score(key);
            if (s > best + 1e-9) { best = s; bestK = k; improved = true; }
          }
          key[p] = bestK;
        }
      }
      return best;
    };
    let incumbent = ranked.map((r) => r[0]);
    let incumbentScore = climb(incumbent);
    pool.add(incumbentScore, incumbent);
    for (let s = 1; s < seeds; s++) {
      let cand;
      if (rng() < 0.65) {
        cand = incumbent.slice();
        const shakes = 1 + Math.floor(rng() * Math.max(1, Math.floor(L / 3)));
        for (let j = 0; j < shakes; j++) { const p = Math.floor(rng() * L); cand[p] = ranked[p][Math.floor(rng() * Math.min(5, M))]; }
      } else {
        cand = ranked.map((r) => r[Math.floor(rng() * Math.min(3, M))]);
      }
      const sc = climb(cand);
      pool.add(sc, cand);
      if (sc > incumbentScore) { incumbentScore = sc; incumbent = cand.slice(); }
      if (await slice()) return;
    }
  }

  // penalty — штраф за каждую букву ключа; для ключей, которые дал пользователь, он равен 0:
  // подсказку нельзя хоронить штрафом за длину (аудит 2026-10-19).
  function finalRank(cands, text, m, variant, alphaName, penaltyPerLetter, user) {
    const { idx, tmpl } = layout(text, m.letters);
    const n = Math.max(1, idx.length);
    const penalty = penaltyPerLetter === undefined ? Math.log(m.M) : penaltyPerLetter;
    const prelim = cands.map(({ key }) => {
      const p = decrypt(idx, key, m.M, variant);
      const raw4 = quadScore(p, m);
      return { key, p, raw4, base: raw4 - penalty * key.length };
    }).sort((a, b) => b.base - a.base);
    return prelim.map((r, i) => {
      const plainLetters = Array.from(r.p, (j) => m.letters[j]).join('');
      const cv = i < COV_LIMIT ? coverage(plainLetters, m) : { cov: 0, words: 0 };
      return {
        key: r.key.map((j) => m.letters[j]).join(''),
        alpha: alphaName, alphaLabel: m.label, variant, keylen: r.key.length, user: !!user,
        cov: cv.cov, words: cv.words, final: r.base + W_WORD * cv.cov * n,
        plain: render(r.p, tmpl, m.letters),
      };
    });
  }

  // Ключи проекта проверяются напрямую (в обе стороны не нужно: вариант шифра задаёт пользователь).
  function userKeyRows(keys, text, m, variant, alphaName) {
    const cands = [];
    for (const word of keys || []) {
      const key = Array.from(String(word).toLowerCase()).map((ch) => m.letters.indexOf(ch === 'ё' && m.M === 32 ? 'е' : ch)); // i18n-ok: данные
      if (key.length && key.every((k) => k >= 0)) cands.push({ key });
    }
    return cands.length ? finalRank(cands, text, m, variant, alphaName, 0, true) : [];
  }

  // Подсказки длины ключа: средний индекс совпадений по столбцам и метод Касиски.
  function hints(idx, M) {
    const ic = [];
    for (let L = 1; L <= 12 && idx.length >= 2 * L; L++) {
      let sum = 0, cols = 0;
      for (let c = 0; c < L; c++) {
        const counts = new Array(M).fill(0);
        let len = 0;
        for (let i = c; i < idx.length; i += L) { counts[idx[i]]++; len++; }
        if (len < 2) continue;
        sum += counts.reduce((s, v) => s + v * (v - 1), 0) / (len * (len - 1));
        cols++;
      }
      if (cols) ic.push([L, sum / cols]);
    }
    const votes = new Array(31).fill(0);
    const seen = new Map();
    for (let i = 0; i + 3 <= idx.length; i++) {
      const g = idx[i] + ',' + idx[i + 1] + ',' + idx[i + 2];
      if (seen.has(g)) {
        const d = i - seen.get(g);
        for (let L = 2; L <= Math.min(30, d); L++) if (d % L === 0) votes[L]++;
      }
      seen.set(g, i);
    }
    const kasiski = votes.map((v, L) => [L, v]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { ic, kasiski };
  }

  function chooseAlphabets(text, mode) {
    if (mode && mode !== 'auto') return [mode];
    const cyr = (text.match(/[а-яёіїєґ]/gi) || []).length;
    const lat = (text.match(/[a-z]/gi) || []).length;
    if (cyr <= lat) return ['en26'];
    // Украинские буквы без ы/э/ъ/ё — украинский алфавит; иначе русский (украинский как запасной).
    return C.autoCyrillic(text) === 'uk33' ? ['uk33', 'uk32'] : ['ru33', 'ru32'];
  }

  function mulberry(seed) {
    return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /**
   * @param {string} text
   * @param {{alpha?:string, variants?:string[], maxLen?:number, bruteMax?:number, seeds?:number, cancel?:{stop:boolean}}} opts
   * @param {(info:{stage:string, rows:Array}) => void} onProgress
   */
  async function run(text, opts, onProgress) {
    const o = opts || {};
    const variants = o.variants || ['vigenere'];
    // Ключи: переданные явно или ключи проекта и активного профиля.
    const keys = o.keys || (G.Profiles ? G.Profiles.keys() : []);
    const rows = [];
    const log = [];
    let sliceStart = Date.now();
    const slice = async () => {
      if (Date.now() - sliceStart < SLICE_MS) return false;
      await tick();
      sliceStart = Date.now();
      return !!(o.cancel && o.cancel.stop);
    };
    let hintInfo = null;
    for (const alphaName of chooseAlphabets(text, o.alpha)) {
      const m = model(alphaName);
      const { idx } = layout(text, m.letters);
      const n = idx.length;
      if (n < 4) { log.push(T('Мало букв для подбора (' + n + ')', 'Too few letters to solve (' + n + ')')); continue; }
      if (!hintInfo) hintInfo = hints(idx, m.M);
      const short = n < AUTO_SHORT;
      const bruteMax = Math.min(o.bruteMax || (m.M <= 26 ? 5 : 4), short ? 9 : 3);
      const freqMax = Math.max(1, Math.min(o.maxLen || Math.max(8, Math.min(28, Math.floor(n / 4))), Math.floor(n / 2)));
      for (const variant of variants) {
        const pool = new Pool(TOPK * 20);
        const ctx = { idx, m, variant, pool, slice, rng: mulberry(12345), keys };
        const phases = short ? ['brute', 'dict', 'freq'] : ['freq', 'dict', 'brute'];
        for (const phase of phases) {
          if (phase === 'brute') for (let L = 1; L <= bruteMax && Math.pow(m.M, L) <= 4e7; L++) { await brute(ctx, L); if (o.cancel && o.cancel.stop) break; }
          if (phase === 'dict') await dictionary(ctx);
          if (phase === 'freq') for (let L = 1; L <= freqMax; L++) { await frequency(ctx, L, o.seeds || (short ? 24 : 60)); if (o.cancel && o.cancel.stop) break; }
          log.push(`${m.label} · ${variant} · ${phase === 'brute' ? T('перебор', 'brute force') : phase === 'dict' ? T('словарь', 'dictionary') : T('частотный анализ', 'frequency analysis')} ${T('готов', 'done')}`);
          if (onProgress) onProgress({ stage: log[log.length - 1], rows: merge(rows.concat(finalRank(pool.list(), text, m, variant, alphaName), userKeyRows(keys, text, m, variant, alphaName))) });
          if (o.cancel && o.cancel.stop) break;
        }
        rows.push(...finalRank(pool.list(), text, m, variant, alphaName));
        rows.push(...userKeyRows(keys, text, m, variant, alphaName));
        if (o.cancel && o.cancel.stop) break;
      }
    }
    return { rows: merge(rows), hints: hintInfo, log };
  }

  function merge(rows) {
    const seen = new Set();
    return rows.sort((a, b) => b.final - a.final).filter((r) => {
      const sig = r.plain + '|' + r.variant;
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    }).slice(0, 200);
  }

  // Найденный ключ как шаг цепочки операций (для «В граф»).
  function toChainStep(r) {
    const alpha = r.alpha === 'en26' ? 'en' : r.alpha;
    if (r.variant === 'beaufort') return { op: 'beaufort', params: { key: r.key, alpha, skip: true } };
    return { op: 'vigenere', params: { key: r.key, dir: r.variant === 'variant' ? 'enc' : 'dec', alpha, skip: true } };
  }

  G.VigenereAuto = { run, toChainStep, hints, ALPHAS };
})(typeof self !== 'undefined' ? self : this);
