// Мелкие помощники для интерфейса медиа-нод: DOM, форматы времени/частоты, «красивые» деления осей.
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);

  const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  /** Кнопка с подсказкой; события не всплывают к холсту графа. */
  function button(label, title, onclick, cls) {
    const b = h('button', 'btn small ' + (cls || ''), label);
    if (title) b.title = title;
    b.type = 'button';
    b.addEventListener('mousedown', (e) => e.stopPropagation());
    b.onclick = (e) => { e.stopPropagation(); onclick(e); };
    return b;
  }

  /** 83.456 → «1:23.456». */
  function fmtTime(sec) {
    if (!Number.isFinite(sec)) return '–';
    const s = Math.max(0, sec), m = Math.floor(s / 60);
    return m + ':' + (s - m * 60).toFixed(3).padStart(6, '0');
  }

  function fmtHz(f) { return f >= 1000 ? (f / 1000).toFixed(f % 1000 ? 2 : 0).replace(/\.?0+$/, '') + ' ' + T('кГц', 'kHz') : Math.round(f) + ' ' + T('Гц', 'Hz'); }

  /** Шаг делений 1/2/5·10^k, чтобы на диапазоне вышло около target делений. */
  function niceStep(range, target) {
    const raw = range / Math.max(1, target);
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / pow;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * pow;
  }

  function ticks(a, b, target) {
    const step = niceStep(b - a, target), out = [];
    for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(Math.round(v / step * 1e6) / 1e6 * step);
    return out;
  }

  /** Делления логарифмической оси частот. */
  function logTicks(a, b) {
    const out = [];
    for (let dec = 10; dec <= 100000; dec *= 10) for (const m of [1, 2, 5]) { const v = dec * m; if (v >= a && v <= b) out.push(v); }
    return out;
  }

  function download(href, name) {
    const a = h('a');
    a.href = href; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /** Стандартное сообщение статуса: ожидание декодирования показываем спокойно, а не как ошибку. */
  function statusText(res) {
    if (!res) return '';
    if (res.empty) return T('Подключи артефакт с аудио или видео', 'Connect an audio or video artifact');
    return res.error || '';
  }

  const SELECT_CHANNEL = [['mono', T('Моно (L+R)', 'Mono (L+R)')], ['left', T('Левый', 'Left')], ['right', T('Правый', 'Right')], ['diff', T('Разность L−R', 'Difference L−R')]];

  G.MediaUI = { h, button, fmtTime, fmtHz, niceStep, ticks, logTicks, download, statusText, SELECT_CHANNEL };
})(typeof self !== 'undefined' ? self : this);
