// Ноды-детекторы сигнала в звуке: Морзе, DTMF, SSTV. Все принимают артефакт (аудио или видео),
// считают по PCM и отдают строку (точки/тире, цифры) или картинку-артефакт (SSTV).
(function (G) {
  'use strict';
  const T = G.T;
  const IO = G.AudioIO, UI = G.MediaUI;
  const num = (v, d) => { const x = Number(v); return Number.isFinite(x) ? x : d; };

  const RANGE_PARAMS = [
    { key: 'chan', label: T('Канал', 'Channel'), type: 'select', options: UI.SELECT_CHANNEL, default: 'mono' },
    { key: 'from', label: T('С секунды (0 = с начала)', 'From second (0 = start)'), type: 'number', default: 0 },
    { key: 'to', label: T('По секунду (0 = до конца)', 'To second (0 = end)'), type: 'number', default: 0 },
  ];

  const prepared = (handle, p, node) => {
    const pcm = IO.need(handle, node);
    return IO.prepare(pcm, { channel: p.chan, from: num(p.from, 0), to: num(p.to, 0) });
  };

  /** Результат пересчитывается только при смене входа или параметров. */
  function memo(node, key, fn) {
    if (node.state.key !== key) { node.state.key = key; node.state.result = fn(); }
    return node.state.result;
  }

  function ensureBox(node, body, ui) {
    const box = body.querySelector('.special');
    if (!node.state.ui || !box.contains(node.state.ui.root)) {
      box.innerHTML = '';
      const u = { root: UI.h('div', 'media-signal'), status: UI.h('div', 'muted small'), info: UI.h('div', 'small'), canvas: null };
      u.root.append(u.status, u.info);
      box.appendChild(u.root);
      node.state.ui = u;
    }
    IO.hookPending(node, ui);
    return node.state.ui;
  }

  const statusOf = (res) => {
    if (res && res.empty) return T('Подключи артефакт с аудио или видео', 'Connect an audio or video artifact');
    return res && res.error ? res.error : '';
  };

  // ---------- Морзе ----------
  function drawEnvelope(u, r) {
    if (!u.canvas) { u.canvas = UI.h('canvas', 'media-canvas'); u.canvas.width = 640; u.canvas.height = 90; u.root.appendChild(u.canvas); }
    const c = u.canvas, ctx = c.getContext('2d'), { env, hopSec, t0 } = r.envelope;
    ctx.clearRect(0, 0, c.width, c.height);
    const total = env.length * hopSec, max = r.thresholds.peak || Math.max.apply(null, env) || 1;
    const xOf = (t) => ((t - t0) / total) * c.width, yOf = (v) => c.height - 4 - (v / max) * (c.height - 8);
    ctx.strokeStyle = '#5ee08c'; ctx.lineWidth = 1; ctx.beginPath();
    const step = Math.max(1, Math.floor(env.length / c.width));
    for (let i = 0; i < env.length; i += step) { const x = (i / env.length) * c.width; if (i) ctx.lineTo(x, yOf(env[i])); else ctx.moveTo(x, yOf(env[i])); }
    ctx.stroke();
    ctx.strokeStyle = '#f5b84a'; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(0, yOf(r.thresholds.rise)); ctx.lineTo(c.width, yOf(r.thresholds.rise)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(245,184,74,0.35)';
    for (const e of r.elements || []) if (e.unsure) ctx.fillRect(xOf(e.start), 0, Math.max(2, (e.dur / total) * c.width), c.height);
  }

  G.NodeTypes.morse_audio = {
    name: T('Морзе из звука', 'Morse from audio'), cat: 'Звук и видео', wide: true, inputs: [T('аудио/видео', 'audio/video')],
    desc: T('Находит тон (сам или на заданной частоте), порог, длину точки и выдаёт точки/тире (для ноды «Морзе → текст») либо готовый текст. Сомнительные элементы подсвечены на графике; в тексте их можно пометить {X} и ¦.',
      'Finds the tone (automatically or at a set frequency), threshold and dot length, and outputs dots/dashes (for the "Morse → text" node) or decoded text. Uncertain elements are highlighted on the plot; in text they can be marked {X} and ¦.'),
    params: [...RANGE_PARAMS,
      { key: 'freq', label: T('Частота тона, Гц (0 = найти сам)', 'Tone frequency, Hz (0 = auto)'), type: 'number', default: 0 },
      { key: 'threshold', label: T('Порог от максимума, 0–1 (0 = автоматически)', 'Threshold of peak, 0–1 (0 = auto)'), type: 'range', min: 0, max: 1, step: 0.01, default: 0 },
      { key: 'unit', label: T('Длина точки (0 = оценить)', 'Dot length (0 = estimate)'), type: 'range', min: 0, max: 2000, step: 5, unit: T('мс', 'ms'), default: 0 },
      { key: 'lang', label: T('Алфавит', 'Alphabet'), type: 'select', options: [['en', T('Латиница', 'Latin')], ['ru', T('Кириллица', 'Cyrillic')]], default: 'en' },
      { key: 'out', label: T('Выход', 'Output'), type: 'select', options: [['morse', T('Точки и тире', 'Dots and dashes')], ['text', T('Текст', 'Text')], ['report', T('Отчёт', 'Report')]], default: 'morse' },
      { key: 'mark', label: T('Помечать неуверенные места (? в Морзе, {X} и ¦ в тексте)', 'Mark uncertain spots (? in Morse, {X} and ¦ in text)'), type: 'bool', default: false },
    ],
    compute([handle], p, node) {
      const sig = prepared(handle, p, node);
      const key = [handle, p.chan, p.from, p.to, p.freq, p.threshold, p.unit, p.lang].join('|');
      const r = memo(node, key, () => G.MorseAudio.detect(sig.samples, sig.sampleRate, { freq: num(p.freq, 0), threshold: num(p.threshold, 0), unit: num(p.unit, 0), lang: p.lang }));
      if (!r.ok) throw new Error(r.error);
      if (p.out === 'text') return p.mark ? r.textMarked : r.text;
      if (p.out === 'report') {
        return [T('Частота', 'Frequency') + ': ' + r.freq.toFixed(1) + ' Hz', T('Точка', 'Dot') + ': ' + r.unitMs.toFixed(1) + ' ms (~' + r.wpm.toFixed(1) + ' WPM)',
          T('Неуверенных элементов', 'Uncertain elements') + ': ' + r.unsureCount, '', r.morseMarked, '', r.textMarked].join('\n');
      }
      return p.mark ? r.morseMarked : r.morse;
    },
    update(node, res, body, ui) {
      const u = ensureBox(node, body, ui), r = node.state.result;
      u.status.textContent = statusOf(res);
      if (!r || (res && res.empty)) { u.info.textContent = ''; return; }
      if (r.envelope) drawEnvelope(u, r);
      u.info.textContent = r.ok
        ? T('Тон ', 'Tone ') + r.freq.toFixed(1) + ' Hz · ' + T('точка ', 'dot ') + r.unitMs.toFixed(0) + ' ms (~' + r.wpm.toFixed(1) + ' WPM) · ' + T('букв ', 'letters ') + r.letters + ' · ' + T('сомнительных ', 'uncertain ') + r.unsureCount
        : r.error;
    },
  };

  // ---------- DTMF ----------
  G.NodeTypes.dtmf_audio = {
    name: T('DTMF из звука', 'DTMF from audio'), cat: 'Звук и видео', wide: true, inputs: [T('аудио/видео', 'audio/video')],
    desc: T('Телефонные тоны (Гёрцель на 8 частотах) → цифры 0–9, *, #, A–D. Выход можно подать на «Телефон: нажатия → буквы». Паузы длиннее заданной превращаются в пробелы (удобно для мультитапа).',
      'Phone tones (Goertzel on 8 frequencies) → digits 0–9, *, #, A–D. Feed the output to "Phone: presses → letters". Pauses longer than the set value become spaces (handy for multitap).'),
    params: [...RANGE_PARAMS,
      { key: 'winMs', label: T('Окно анализа', 'Analysis window'), type: 'range', min: 5, max: 200, step: 1, unit: T('мс', 'ms'), default: 30 },
      { key: 'minToneMs', label: T('Мин. длительность тона', 'Min tone length'), type: 'range', min: 5, max: 500, step: 5, unit: T('мс', 'ms'), default: 40 },
      { key: 'minLevel', label: T('Мин. амплитуда, 0–1', 'Min amplitude, 0–1'), type: 'range', min: 0, max: 1, step: 0.005, default: 0.01 },
      { key: 'groupGap', label: T('Пауза → пробел, мс (0 = не делить)', 'Pause → space, ms (0 = no spaces)'), type: 'number', default: 0 },
      { key: 'out', label: T('Выход', 'Output'), type: 'select', options: [['digits', T('Цифры', 'Digits')], ['report', T('Отчёт по тонам', 'Tone report')]], default: 'digits' },
    ],
    compute([handle], p, node) {
      const sig = prepared(handle, p, node);
      const key = [handle, p.chan, p.from, p.to, p.winMs, p.minToneMs, p.minLevel, p.groupGap].join('|');
      const r = memo(node, key, () => G.DTMF.detect(sig.samples, sig.sampleRate, { winMs: num(p.winMs, 30), minToneMs: num(p.minToneMs, 40), minLevel: num(p.minLevel, 0.01), groupGapMs: num(p.groupGap, 0) }));
      if (!r.ok) throw new Error(T('DTMF-тонов не найдено', 'No DTMF tones found'));
      if (p.out === 'report') return r.tones.map((t) => t.digit + '  ' + (t.start + sig.offset).toFixed(2) + 's  ' + (t.dur * 1000).toFixed(0) + 'ms  ' + t.low + '+' + t.high + (t.unsure ? '  ?' : '')).join('\n');
      return r.digits;
    },
    update(node, res, body, ui) {
      const u = ensureBox(node, body, ui), r = node.state.result;
      u.status.textContent = statusOf(res);
      u.info.textContent = r && !(res && res.empty) ? T('Тонов: ', 'Tones: ') + r.count + T(', сомнительных: ', ', uncertain: ') + r.unsureCount : '';
    },
  };

  // ---------- SSTV ----------
  const SSTV_OPTIONS = [['auto', T('Авто (по VIS)', 'Auto (from VIS)')]].concat(Object.keys(G.SSTV.MODES).map((k) => [k, G.SSTV.MODES[k].name]));

  G.NodeTypes.sstv_audio = {
    name: T('SSTV из звука', 'SSTV from audio'), cat: 'Звук и видео', wide: true, inputs: [T('аудио/видео', 'audio/video')],
    desc: T('Декодирует SSTV: Robot 36, Martin M1/M2, Scottie S1/S2 (режим по VIS или вручную). Выход — картинка-артефакт. Другие режимы (Robot 72, PD, Scottie DX…) не реализованы. Проверено на синтетических сигналах; на реальных записях результат нужно сверять глазами.',
      'Decodes SSTV: Robot 36, Martin M1/M2, Scottie S1/S2 (mode from VIS or manual). Output is an image artifact. Other modes (Robot 72, PD, Scottie DX…) are not implemented. Verified on synthetic signals; check real recordings by eye.'),
    params: [...RANGE_PARAMS, { key: 'mode', label: T('Режим', 'Mode'), type: 'select', options: SSTV_OPTIONS, default: 'auto' }],
    compute([handle], p, node) {
      const sig = prepared(handle, p, node);
      const key = [handle, p.chan, p.from, p.to, p.mode].join('|');
      const r = memo(node, key, () => {
        const d = G.SSTV.decode(sig.samples, sig.sampleRate, { mode: p.mode });
        const A = G.Artifacts, art = A.get(A.idOf(handle)) || {};
        d.handle = IO.putImage('sstv_' + node.id + '_' + Math.abs(hash(key)).toString(36), d.image, (art.name || 'audio') + ' (SSTV ' + d.mode + ').png');
        return d;
      });
      return r.handle;
    },
    update(node, res, body, ui) {
      const u = ensureBox(node, body, ui), r = node.state.result;
      u.status.textContent = statusOf(res);
      if (!r || (res && res.empty) || (res && res.error)) { if (res && res.error) node.state.key = null; u.info.textContent = ''; return; }
      u.info.textContent = r.mode + ' · VIS ' + (r.vis === null ? '—' : r.vis + (r.parityOk ? '' : ' (' + T('чётность не сошлась', 'parity mismatch') + ')')) + ' · ' + T('строк ', 'lines ') + r.lines + T(', пропущено синхро ', ', missed syncs ') + r.missed
        + (r.warnings.length ? '\n' + r.warnings.join('; ') : '');
      if (!u.canvas) { u.canvas = UI.h('canvas', 'media-canvas'); u.root.appendChild(u.canvas); }
      if (u.canvas.dataset.key !== node.state.key) {
        u.canvas.dataset.key = node.state.key;
        u.canvas.width = r.image.width; u.canvas.height = r.image.height;
        u.canvas.getContext('2d').putImageData(new ImageData(r.image.data, r.image.width, r.image.height), 0, 0);
      }
    },
  };

  function hash(s) { let x = 0; for (let i = 0; i < s.length; i++) x = (Math.imul(x, 31) + s.charCodeAt(i)) | 0; return x; }
})(typeof self !== 'undefined' ? self : this);
