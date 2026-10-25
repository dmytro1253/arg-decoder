// Раскладка под ширину окна. Кнопки верхней панели, которые не помещаются, по одной уходят (с конца)
// в меню «⋯» — это те же элементы с теми же обработчиками, а не копии. Сначала сжимается всё остальное:
// подпись «by Dmytro» и текст статуса YouTube. На узком окне список нод слева открывается кнопкой «▤ Ноды»
// поверх холста, а не пропадает.
(function (G) {
  'use strict';
  const NARROW = 900;             // = @media (max-width: 900px) в style.css

  function init() {
    const header = document.querySelector('.topbar');
    const toolbar = document.querySelector('.toolbar');
    const wrap = document.querySelector('#more-wrap');
    const menu = document.querySelector('#more-menu');
    const more = document.querySelector('#btn-more');
    if (!header || !toolbar || !wrap || !menu || !more) return;
    // Порядок кнопок запоминается один раз: из меню они возвращаются на свои места.
    const items = [...toolbar.children].filter((el) => el !== wrap && el.id !== 'btn-palette' && !el.querySelector('#btn-presets'));
    const overflows = () => header.scrollWidth > header.clientWidth + 1;
    const close = () => { menu.classList.add('hidden'); more.setAttribute('aria-expanded', 'false'); };

    function fit() {
      close();
      for (const el of items) toolbar.insertBefore(el, wrap);
      header.classList.remove('compact');
      wrap.classList.add('hidden');
      if (!overflows()) return;
      header.classList.add('compact');
      wrap.classList.remove('hidden');
      for (let i = items.length - 1; i >= 0 && overflows(); i--) menu.prepend(items[i]);
      if (![...menu.children].some((el) => !el.classList.contains('hidden'))) wrap.classList.add('hidden');
    }

    more.onclick = (ev) => {
      ev.stopPropagation();
      const open = menu.classList.toggle('hidden') === false;
      more.setAttribute('aria-expanded', String(open));
    };
    menu.addEventListener('click', (ev) => { if (ev.target.closest('button')) close(); });
    document.addEventListener('click', (ev) => { if (!wrap.contains(ev.target)) close(); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); });

    // Кнопки появляются и прячутся («Прошлый проект»), меняется язык подписей — пересчитать.
    let pending = null;
    const refit = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(fit); };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(refit).observe(header);
    window.addEventListener('resize', refit);
    // Свои переключения (меню, кнопка «⋯») пропускаем — иначе пересчёт вызывал бы сам себя.
    const watch = new MutationObserver((list) => { if (list.some((m) => m.target !== wrap && m.target !== menu)) refit(); });
    for (const box of [toolbar, menu]) watch.observe(box, { subtree: true, attributes: true, attributeFilter: ['class'], characterData: true });
    fit();

    initPalette();
  }

  function initPalette() {
    const palette = document.querySelector('.palette');
    const button = document.querySelector('#btn-palette');
    if (!palette || !button) return;
    const set = (open) => { palette.classList.toggle('open', open); button.setAttribute('aria-pressed', String(open)); };
    button.onclick = (ev) => { ev.stopPropagation(); set(!palette.classList.contains('open')); };
    // Нода добавлена кликом или поиск закончен — на узком окне список закрывается и не мешает холсту.
    palette.addEventListener('click', (ev) => { if (window.innerWidth <= NARROW && ev.target.closest('.pal-item')) set(false); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') set(false); });
    window.addEventListener('resize', () => { if (window.innerWidth > NARROW) set(false); });
  }

  G.Layout = { init };
})(typeof self !== 'undefined' ? self : this);
