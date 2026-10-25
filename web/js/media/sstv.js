// SSTV-декодер: Robot 36, Martin M1/M2, Scottie S1/S2.
// Конвейер: FM-демодуляция (смешивание с 1900 Гц + ФНЧ + разность фаз) → дорожка частоты →
// VIS (определение режима) → синхроимпульсы 1200 Гц → построчное чтение пикселей → RGBA.
// Реальные записи (MP3 с шумом, без VIS-заголовка): дорожка частоты сглаживается медианой перед поиском
// синхроимпульсов, режим без VIS выбирается по периоду строк, длина строки берётся измеренной (дрейф частоты
// дискретизации), пропущенные строки не скрываются — их доля и есть оценка качества.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);

  const F_BLACK = 1500, F_WHITE = 2300, F_CENTER = 1900, F_SYNC = 1200;
  const BIT_MS = 30;
  const SMOOTH_MS = 1.5;           // окно медианы дорожки частоты для поиска синхроимпульсов
  const PERIOD_TOL = 0.012;        // допуск совпадения интервала с длиной строки режима
  const PERIOD_MIN = 0.35;         // доля интервалов, совпавших с длиной строки, чтобы выбрать режим без VIS
  const PERIOD_MIN_HITS = 64;      // или столько совпавших интервалов (четверть картинки) при явном отрыве от других режимов
  const STABLE_RUN = 6;            // подряд идущих строк нужной длины — признак начала настоящей картинки
  const VIS_TOTAL_MS = 300;       // старт-бит + 8 бит + стоп-бит

  // Макеты строк: смещения каналов от начала синхроимпульса (мс); line — длина строки.
  const MODES = {
    robot36: { name: 'Robot 36', vis: 8, width: 320, height: 240, line: 150, sync: 9, kind: 'robot' },
    martin1: { name: 'Martin M1', vis: 44, width: 320, height: 256, line: 446.446, sync: 4.862, kind: 'rgb', scan: 146.432, at: { g: 5.434, b: 152.438, r: 299.442 } },
    martin2: { name: 'Martin M2', vis: 40, width: 320, height: 256, line: 226.798, sync: 4.862, kind: 'rgb', scan: 73.216, at: { g: 5.434, b: 79.222, r: 153.01 } },
    scottie1: { name: 'Scottie S1', vis: 60, width: 320, height: 256, line: 428.22, sync: 9, kind: 'rgb', scan: 138.24, at: { g: -277.98, b: -138.24, r: 10.5 }, midSync: true },
    scottie2: { name: 'Scottie S2', vis: 56, width: 320, height: 256, line: 277.692, sync: 9, kind: 'rgb', scan: 88.064, at: { g: -177.628, b: -88.064, r: 10.5 }, midSync: true },
  };
  const ROBOT = { y: 12, yLen: 88, sepAt: 100, chromaAt: 106, chromaLen: 44 };
  const modeByVis = (vis) => Object.keys(MODES).find((k) => MODES[k].vis === vis) || null;

  const clamp8 = (v) => (v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v));

  // ---------- FM-демодуляция ----------
  /** Дорожка мгновенной частоты. @returns {{f:Float32Array, rate:number, t0:number}} */
  function frequencyTrack(samples, sr) {
    const dec = Math.max(1, Math.floor(sr / 6000));
    const taps = (Math.round(3 * sr / 1600) | 1);
    const half = (taps - 1) / 2;
    const h = new Float64Array(taps);
    const fc = 1000 / sr;
    let hs = 0;
    for (let k = 0; k < taps; k++) {
      const x = k - half;
      const sinc = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
      h[k] = sinc * (0.54 - 0.46 * Math.cos(2 * Math.PI * k / (taps - 1)));
      hs += h[k];
    }
    for (let k = 0; k < taps; k++) h[k] /= hs;
    const n = samples.length;
    const mr = new Float32Array(n), mi = new Float32Array(n);
    const w = 2 * Math.PI * F_CENTER / sr;
    for (let i = 0; i < n; i++) { const ph = w * i; mr[i] = samples[i] * Math.cos(ph); mi[i] = -samples[i] * Math.sin(ph); }
    const m = Math.floor((n - taps) / dec);
    const f = new Float32Array(Math.max(0, m));
    const rate = sr / dec;
    let pr = 0, pi = 0;
    for (let j = 0; j < m; j++) {
      const base = j * dec;
      let yr = 0, yi = 0;
      for (let k = 0; k < taps; k++) { yr += mr[base + k] * h[k]; yi += mi[base + k] * h[k]; }
      const dre = yr * pr + yi * pi, dim = yi * pr - yr * pi;     // z[j] · conj(z[j-1])
      f[j] = j === 0 ? F_CENTER : F_CENTER + Math.atan2(dim, dre) * rate / (2 * Math.PI);
      pr = yr; pi = yi;
    }
    return { f, rate, t0: half / sr - 0.5 / rate };   // разность фаз описывает интервал между соседними отсчётами
  }

  function prefix(f) {
    const p = new Float64Array(f.length + 1);
    for (let i = 0; i < f.length; i++) p[i + 1] = p[i] + f[i];
    return p;
  }

  /** Средняя частота на отрезке [a, b) секунд. */
  function meanFreq(tr, a, b) {
    const i0 = Math.max(0, Math.min(tr.f.length - 1, Math.floor((a - tr.t0) * tr.rate)));
    const i1 = Math.max(i0 + 1, Math.min(tr.f.length, Math.ceil((b - tr.t0) * tr.rate)));
    return (tr.pre[i1] - tr.pre[i0]) / (i1 - i0);
  }

  const timeOf = (tr, i) => tr.t0 + i / tr.rate;

  // ---------- VIS ----------
  /** Ищет лидер 1900 Гц ≥150 мс, за ним старт-бит 1200 Гц ≥20 мс; читает 8 бит. */
  function findVis(tr, from) {
    const f = tr.f, minLead = Math.round(0.15 * tr.rate), minStart = Math.round(0.02 * tr.rate);
    let i = Math.max(0, Math.floor((from - tr.t0) * tr.rate));
    while (i < f.length) {
      if (Math.abs(f[i] - F_CENTER) > 100) { i++; continue; }
      let j = i;
      while (j < f.length && Math.abs(f[j] - F_CENTER) <= 100) j++;
      if (j - i >= minLead) {
        let e = j;
        const limit = Math.round(0.005 * tr.rate);   // ФНЧ растягивает переход на несколько миллисекунд
        while (e < f.length && f[e] > 1550 && e - j < limit) e++;
        let s = e;
        while (s < f.length && f[s] >= 1450 && s - e < limit) s++;
        while (s < f.length && f[s] < 1450 && f[s] > 1000) s++;
        if (e < f.length && f[e] <= 1550 && s - e >= minStart) return readVis(tr, timeOf(tr, e), timeOf(tr, i), timeOf(tr, j));
      }
      i = Math.max(i + 1, j);
    }
    return null;
  }

  function readVis(tr, tStart, leadA, leadB) {
    const bits = [];
    for (let k = 0; k < 8; k++) {
      const c = tStart + (BIT_MS * (1.5 + k)) / 1000;
      bits.push(meanFreq(tr, c - 0.008, c + 0.008) < 1200 ? 1 : 0);
    }
    let code = 0, ones = 0;
    for (let k = 0; k < 7; k++) { code |= bits[k] << k; ones += bits[k]; }
    ones += bits[7];
    const lead = meanFreq(tr, leadA + 0.05, Math.max(leadA + 0.06, leadB - 0.03));
    return { code, parityOk: ones % 2 === 0, tStart, tImage: tStart + VIS_TOTAL_MS / 1000, leaderOffset: lead - F_CENTER };
  }

  /** Медиана по окну ~1.5 мс: убирает выбросы шума, не размывая границы синхроимпульса. */
  function smoothTrack(tr) {
    if (tr.fs) return tr.fs;
    const w = Math.max(3, Math.round(SMOOTH_MS / 1000 * tr.rate) | 1), h = w >> 1, f = tr.f, out = new Float32Array(f.length);
    const win = new Float32Array(w);
    for (let i = 0; i < f.length; i++) {
      const a = Math.max(0, i - h), b = Math.min(f.length, i + h + 1);
      const n = b - a;
      for (let k = 0; k < n; k++) win[k] = f[a + k];
      const part = win.subarray(0, n).sort();
      out[i] = part[n >> 1];
    }
    tr.fs = out;
    return out;
  }

  /** Режим по периоду строк (когда VIS нет): самый частый интервал между синхроимпульсами против длин строк режимов. */
  function modeByPeriod(syncs) {
    if (syncs.length < 8) return null;
    let best = null;
    const scores = [];
    for (const key of Object.keys(MODES)) {
      const L = MODES[key].line / 1000;
      let hits = 0;
      for (let k = 1; k < syncs.length; k++) {
        const d = syncs[k] - syncs[k - 1];
        const n = Math.round(d / L);
        // Интервал в одну строку весит больше, чем в 2–3: иначе Robot 36 (150 мс) «совпадает» с Martin M1 (446 мс ≈ 3 × 150).
        if (n >= 1 && n <= 3 && Math.abs(d - n * L) < PERIOD_TOL * L * n) hits += n === 1 ? 1 : 0.25;
      }
      const score = hits / (syncs.length - 1);
      scores.push(hits);
      if (!best || hits > best.hits) best = { key, score, hits };
    }
    if (!best) return null;
    // Длинная запись с шумом: доля мала, но совпавших интервалов много и намного больше, чем у других режимов.
    const second = scores.sort((x, y) => y - x)[1] || 0;
    return best.score >= PERIOD_MIN || (best.hits >= PERIOD_MIN_HITS && best.hits >= 5 * Math.max(1, second)) ? best : null;
  }

  /** Измеренная длина строки: наклон времени синхроимпульсов против номера строки (учитывает дрейф часов записи). */
  function measuredLine(syncs, nominal) {
    const L = nominal / 1000;
    const pts = [];
    let base = null;
    for (const t of syncs) {
      if (base === null) { base = t; pts.push([0, t]); continue; }
      const n = Math.round((t - base) / L);
      if (Math.abs(t - base - n * L) < 0.02 * L * Math.max(1, n / 20)) pts.push([n, t]);
    }
    if (pts.length < 10) return nominal;
    let sn = 0, st = 0, snn = 0, snt = 0;
    for (const [n, t] of pts) { sn += n; st += t; snn += n * n; snt += n * t; }
    const slope = (pts.length * snt - sn * st) / (pts.length * snn - sn * sn);
    return Math.abs(slope - L) < 0.01 * L ? slope * 1000 : nominal;
  }

  /** Без VIS шум до начала передачи даёт ложные синхроимпульсы: картинка начинается с первой устойчивой серии строк. */
  function stableFrom(syncs, L) {
    for (let i = 0; i + STABLE_RUN < syncs.length; i++) {
      let ok = true;
      for (let k = i + 1; k <= i + STABLE_RUN && ok; k++) ok = Math.abs(syncs[k] - syncs[k - 1] - L) < PERIOD_TOL * L;
      if (ok) return syncs.slice(i);
    }
    return syncs;
  }

  // ---------- Синхроимпульсы ----------
  function findSyncs(tr, from, syncMs) {
    const f = smoothTrack(tr), minLen = Math.max(2, Math.round(0.55 * syncMs / 1000 * tr.rate)), maxLen = Math.round(2.6 * syncMs / 1000 * tr.rate);
    const out = [];
    let i = Math.max(0, Math.floor((from - tr.t0) * tr.rate));
    while (i < f.length) {
      if (!(f[i] < 1350 && f[i] > 1000)) { i++; continue; }
      let j = i;
      while (j < f.length && f[j] < 1350 && f[j] > 1000) j++;
      if (j - i >= minLen && j - i <= maxLen) out.push(timeOf(tr, i));
      i = j;
    }
    return out;
  }

  /**
   * Первый синхроимпульс сливается со стоп-битом VIS (оба 1200 Гц), поэтому отдельным отрезком он не виден:
   * берём конец общего отрезка 1200 Гц и отнимаем длительность синхроимпульса.
   */
  function firstSync(tr, tImage, syncMs) {
    let i = Math.max(0, Math.floor((tImage - 0.01 - tr.t0) * tr.rate));
    while (i < tr.f.length && tr.f[i] < 1350) i++;
    const est = timeOf(tr, i) - syncMs / 1000;
    return Math.abs(est - tImage) < 0.01 ? est : tImage;
  }

  /** Строит список начал строк по синхроимпульсам; пропущенные достраиваются по времени строки. */
  function lineStarts(syncs, mode, endTime) {
    const L = mode.line / 1000;
    let list = syncs.slice();
    if (mode.midSync && list.length > 1 && list[1] - list[0] < 0.9 * L) list = list.slice(1);   // стартовый синхроимпульс Scottie
    if (!list.length) return { starts: [], missed: 0 };
    const starts = [list[0]];
    let missed = 0, k = 1;
    while (starts.length < mode.height) {
      const prev = starts[starts.length - 1];
      while (k < list.length && list[k] < prev + 0.7 * L) k++;
      if (k < list.length && list[k] <= prev + 1.3 * L) { starts.push(list[k]); k++; continue; }
      const guess = prev + L;
      // Пропуск достраиваем только если дальше ещё есть синхроимпульсы; иначе это конец передачи.
      if (k >= list.length || guess + L * 0.5 > endTime) break;
      starts.push(guess); missed++;
    }
    return { starts, missed };
  }

  // ---------- Чтение пикселей ----------
  function scan(tr, t0, lenMs, width, offsetHz) {
    const out = new Uint8Array(width), len = lenMs / 1000;
    for (let x = 0; x < width; x++) {
      const a = t0 + len * x / width, b = t0 + len * (x + 1) / width;
      out[x] = clamp8(((meanFreq(tr, a, b) - offsetHz - F_BLACK) / (F_WHITE - F_BLACK)) * 255);
    }
    return out;
  }

  function ycc(y, cr, cb) {   // BT.601, ограниченный диапазон
    const yy = 1.164 * (y - 16);
    return [clamp8(yy + 1.596 * (cr - 128)), clamp8(yy - 0.813 * (cr - 128) - 0.392 * (cb - 128)), clamp8(yy + 2.017 * (cb - 128))];
  }

  function decodeRobot(tr, starts, mode, off) {
    const W = mode.width, lines = starts.map((s) => {
      const t = s;
      const sep = meanFreq(tr, t + (ROBOT.sepAt + 0.5) / 1000, t + (ROBOT.sepAt + 4) / 1000) - off;
      return { y: scan(tr, t + ROBOT.y / 1000, ROBOT.yLen, W, off), c: scan(tr, t + ROBOT.chromaAt / 1000, ROBOT.chromaLen, W, off), isBy: sep > F_CENTER };
    });
    const img = new Uint8ClampedArray(W * mode.height * 4);
    for (let i = 0; i < lines.length; i++) {
      const own = lines[i];
      const pair = lines[own.isBy ? i - 1 : i + 1] || null;
      const ry = own.isBy ? (pair && !pair.isBy ? pair.c : null) : own.c;
      const by = own.isBy ? own.c : (pair && pair.isBy ? pair.c : null);
      for (let x = 0; x < W; x++) {
        const [r, g, b] = ycc(own.y[x], ry ? ry[x] : 128, by ? by[x] : 128);
        const o = (i * W + x) * 4;
        img[o] = r; img[o + 1] = g; img[o + 2] = b; img[o + 3] = 255;
      }
    }
    return img;
  }

  function decodeRgb(tr, starts, mode, off) {
    const W = mode.width, img = new Uint8ClampedArray(W * mode.height * 4);
    for (let i = 0; i < starts.length; i++) {
      const ch = {};
      for (const c of ['r', 'g', 'b']) ch[c] = scan(tr, starts[i] + mode.at[c] / 1000, mode.scan, W, off);
      for (let x = 0; x < W; x++) {
        const o = (i * W + x) * 4;
        img[o] = ch.r[x]; img[o + 1] = ch.g[x]; img[o + 2] = ch.b[x]; img[o + 3] = 255;
      }
    }
    return img;
  }

  /**
   * @param samples Float32Array моно, sr частота дискретизации
   * @param o {mode:'auto'|ключ режима, start: секунда начала поиска}
   * @returns {{ok, mode, vis, parityOk, image:{width,height,data}, lines, missed, freqOffset, warnings}}
   */
  function decode(samples, sr, o) {
    const opt = Object.assign({ mode: 'auto', start: 0 }, o || {});
    if (sr < 8000) throw new Error(T('Для SSTV нужна частота дискретизации не ниже 8 кГц', 'SSTV needs a sample rate of at least 8 kHz'));
    const tr = frequencyTrack(samples, sr);
    tr.pre = prefix(tr.f);
    const warnings = [];
    const vis = findVis(tr, opt.start);
    let key = opt.mode !== 'auto' ? opt.mode : null, tImage = null, off = 0, detectedBy = opt.mode !== 'auto' ? 'manual' : 'vis';
    if (vis) {
      off = Math.abs(vis.leaderOffset) < 150 ? vis.leaderOffset : 0;
      tImage = vis.tImage;
      if (!vis.parityOk) warnings.push(T('Чётность VIS не совпала: код режима мог быть прочитан неверно', 'VIS parity mismatch: the mode code may be misread'));
      if (!key) {
        key = modeByVis(vis.code);
        if (!key) throw new Error(T('VIS-код ' + vis.code + ' не поддерживается; выбери режим вручную', 'VIS code ' + vis.code + ' is not supported; pick the mode manually'));
      } else if (modeByVis(vis.code) !== key) warnings.push(T('VIS указывает на другой режим, используется выбранный вручную', 'VIS points to another mode; using the manually chosen one'));
    } else {
      if (!key) {
        // Без VIS: режим по периоду строк. Это отличается от «режим не поддерживается»: тогда периода нет ни у одного режима.
        const all = findSyncs(tr, opt.start, 7);
        const guess = modeByPeriod(all);
        if (!guess) throw new Error(T('VIS-заголовок не найден, и период строк не совпал ни с одним поддерживаемым режимом (Robot 36, Martin M1/M2, Scottie S1/S2): выбери режим вручную или это другой режим', 'VIS header not found and the line period matches no supported mode (Robot 36, Martin M1/M2, Scottie S1/S2): choose the mode manually, or this is another mode'));
        key = guess.key;
        detectedBy = 'period';
        warnings.push(T('VIS не найден: режим ' + MODES[key].name + ' выбран по периоду строк (' + Math.round(guess.score * 100) + '% интервалов совпали)', 'VIS not found: ' + MODES[key].name + ' chosen by the line period (' + Math.round(guess.score * 100) + '% of intervals match)'));
      } else warnings.push(T('VIS не найден, начало картинки определено по первому синхроимпульсу', 'VIS not found; image start taken from the first sync pulse'));
    }
    const nominal = MODES[key];
    if (!nominal) throw new Error(T('Неизвестный режим SSTV: ' + key, 'Unknown SSTV mode: ' + key));
    let syncs = findSyncs(tr, tImage === null ? opt.start : tImage - 0.02, nominal.sync);
    // Длина строки по самой записи: MP3 и звуковые карты слегка «плывут», и за 256 строк это сотни миллисекунд.
    const lineMs = measuredLine(syncs, nominal.line);
    const mode = Object.assign({}, nominal, { line: lineMs });
    if (tImage !== null) {
      const first = firstSync(tr, tImage, mode.sync);
      syncs = [first, ...syncs.filter((t) => t > first + 0.3 * mode.line / 1000)];
    }
    if (tImage === null) syncs = stableFrom(syncs, mode.line / 1000);
    const endTime = tr.t0 + tr.f.length / tr.rate;
    const { starts, missed } = lineStarts(syncs, mode, endTime);
    if (starts.length < 2) throw new Error(T('Не найдено достаточно синхроимпульсов строк', 'Not enough line sync pulses found'));
    if (missed > starts.length * 0.25) warnings.push(T('Много пропущенных синхроимпульсов — картинка может быть сдвинута', 'Many missed sync pulses — the picture may be skewed'));
    if (starts.length < mode.height) warnings.push(T('Принято строк ' + starts.length + ' из ' + mode.height + ': передача оборвана или начало не найдено', 'Received ' + starts.length + ' of ' + mode.height + ' lines: the transmission is cut or its start was not found'));
    // Качество: доля строк с настоящим синхроимпульсом. Пиксели построены всегда — это не значит, что картинка верна.
    const quality = starts.length ? Math.round(100 * (starts.length - missed) / mode.height) / 100 : 0;
    const data = mode.kind === 'robot' ? decodeRobot(tr, starts, mode, off) : decodeRgb(tr, starts, mode, off);
    return {
      ok: true, modeKey: key, mode: mode.name, vis: vis ? vis.code : null, parityOk: vis ? vis.parityOk : null, detectedBy, quality,
      lineMs: Math.round(lineMs * 1000) / 1000, nominalLineMs: nominal.line,
      image: { width: mode.width, height: mode.height, data }, lines: starts.length, missed, freqOffset: off, warnings,
    };
  }

  G.SSTV = { MODES, ROBOT, modeByVis, modeByPeriod, measuredLine, frequencyTrack, decode, F_BLACK, F_WHITE, F_CENTER, F_SYNC, BIT_MS, ycc };
})(typeof self !== 'undefined' ? self : this);
