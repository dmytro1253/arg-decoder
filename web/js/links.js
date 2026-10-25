// Детектор ссылок: явные адреса (в том числе «обезвреженные» hxxp и [.] и перевёрнутые),
// а также «голые» ID, похожие на ID известных сервисов (YouTube, Drive, Catbox, Pastebin…).
(function (G) {
  'use strict';
  const T = G.T || ((ru) => ru);

  // confidence: 3 — явная ссылка, 2 — характерный формат ID, 1 — формат подходит, но слабо.
  const SERVICES = [
    { id: 'youtube', name: 'YouTube', hosts: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'], check: 'youtube',
      bare: (t) => /^[A-Za-z0-9_-]{11}$/.test(t) && /[A-Z]/.test(t) && /[a-z]/.test(t) && /[0-9_-]|[A-Z].*[A-Z]/.test(t) ? 2 : 0,
      make: (t) => ['https://www.youtube.com/watch?v=' + t] },
    { id: 'yt_channel', name: T('YouTube-канал', 'YouTube channel'), hosts: [], bare: (t) => (/^UC[A-Za-z0-9_-]{22}$/.test(t) ? 2 : 0), make: (t) => ['https://www.youtube.com/channel/' + t] },
    { id: 'yt_playlist', name: T('YouTube-плейлист', 'YouTube playlist'), hosts: [], bare: (t) => (/^(PL|OL|UU|FL)[A-Za-z0-9_-]{16,40}$/.test(t) ? 2 : 0), make: (t) => ['https://www.youtube.com/playlist?list=' + t] },
    { id: 'drive', name: 'Google Drive', hosts: ['drive.google.com', 'drive.usercontent.google.com'], check: 'http',
      bare: (t) => (/^1[A-Za-z0-9_-]{32}$/.test(t) || /^0B[A-Za-z0-9_-]{26}$/.test(t) ? 2 : 0),
      make: (t) => ['https://drive.google.com/drive/folders/' + t, 'https://drive.google.com/file/d/' + t + '/view'] },
    { id: 'gdocs', name: T('Google Docs / Таблицы / Слайды', 'Google Docs / Sheets / Slides'), hosts: ['docs.google.com', 'forms.gle', 'sites.google.com'], check: 'http',
      bare: (t) => (/^1[A-Za-z0-9_-]{43}$/.test(t) ? 2 : 0),
      make: (t) => ['https://docs.google.com/document/d/' + t, 'https://docs.google.com/spreadsheets/d/' + t, 'https://docs.google.com/presentation/d/' + t] },
    { id: 'catbox', name: 'Catbox', hosts: ['catbox.moe', 'files.catbox.moe'], check: 'http',
      bare: (t) => (/^[a-z0-9]{6}\.(png|jpe?g|gif|webp|mp4|webm|mov|mp3|wav|ogg|flac|txt|zip|rar|7z|pdf|html?|exe|jar|mcworld|mcpack)$/i.test(t) ? 2 : 0),
      make: (t) => ['https://files.catbox.moe/' + t] },
    { id: 'litterbox', name: T('Litterbox (временный Catbox)', 'Litterbox (temporary Catbox)'), hosts: ['litter.catbox.moe'], check: 'http',
      bare: (t) => (/^[a-z0-9]{6,8}\.[a-z0-9]{2,5}$/i.test(t) ? 1 : 0), make: (t) => ['https://litter.catbox.moe/' + t] },
    { id: 'pastebin', name: 'Pastebin', hosts: ['pastebin.com'], check: 'http',
      bare: (t) => (/^[A-Za-z0-9]{8}$/.test(t) && /[A-Z]/.test(t) && /[a-z0-9]/.test(t) ? 1 : 0), make: (t) => ['https://pastebin.com/' + t] },
    { id: 'imgur', name: 'Imgur', hosts: ['imgur.com', 'i.imgur.com'], check: 'http',
      bare: (t) => (/^[A-Za-z0-9]{7}$/.test(t) && /[A-Z]/.test(t) && /[a-z]/.test(t) ? 1 : 0), make: (t) => ['https://i.imgur.com/' + t + '.png', 'https://imgur.com/' + t] },
    { id: 'rentry', name: 'Rentry', hosts: ['rentry.co', 'rentry.org'], check: 'http', bare: () => 0, make: (t) => ['https://rentry.co/' + t] },
    { id: 'discord', name: 'Discord', hosts: ['discord.gg', 'discord.com', 'discordapp.com'], bare: () => 0, make: (t) => ['https://discord.gg/' + t] },
    { id: 'shortener', name: T('Сокращатель ссылок', 'Link shortener'), hosts: ['bit.ly', 'tinyurl.com', 'goo.gl', 'is.gd', 'cutt.ly', 'clck.ru', 't.co', 'rb.gy', 'aka.ms'], check: 'http', bare: () => 0, make: (t) => ['https://bit.ly/' + t] },
    { id: 'yadisk', name: T('Яндекс Диск', 'Yandex Disk'), hosts: ['disk.yandex.ru', 'disk.yandex.com', 'yadi.sk', 'disk.360.yandex.ru'], check: 'http', bare: () => 0, make: (t) => ['https://disk.yandex.ru/d/' + t] },
    { id: 'mailru', name: T('Облако Mail.ru', 'Mail.ru Cloud'), hosts: ['cloud.mail.ru'], bare: () => 0, make: (t) => [t] },
    { id: 'mega', name: 'MEGA', hosts: ['mega.nz', 'mega.co.nz'], bare: () => 0, make: (t) => [t] },
    { id: 'mediafire', name: 'MediaFire', hosts: ['mediafire.com'], bare: () => 0, make: (t) => [t] },
    { id: 'dropbox', name: 'Dropbox', hosts: ['dropbox.com', 'dl.dropboxusercontent.com'], bare: () => 0, make: (t) => [t] },
    { id: 'github', name: 'GitHub', hosts: ['github.com', 'gist.github.com', 'raw.githubusercontent.com', 'github.io'],
      bare: (t) => (/^[0-9a-f]{32}$/.test(t) ? 1 : 0), make: (t) => ['https://gist.github.com/' + t] },
    { id: 'telegram', name: 'Telegram', hosts: ['t.me', 'telegram.me', 'telegra.ph'], bare: () => 0, make: (t) => ['https://t.me/' + t] },
    { id: 'vk', name: T('ВКонтакте', 'VK'), hosts: ['vk.com', 'vk.ru', 'vk.cc'], bare: () => 0, make: (t) => [t] },
    { id: 'social', name: T('Соцсеть', 'Social network'), hosts: ['x.com', 'twitter.com', 'reddit.com', 'redd.it', 'tiktok.com', 'instagram.com', 'twitch.tv', 'tumblr.com', 'soundcloud.com', 'bandcamp.com', 'boosty.to'], bare: () => 0, make: (t) => [t] },
    { id: 'archive', name: T('Архив интернета', 'Web archive'), hosts: ['archive.org', 'web.archive.org', 'archive.ph', 'archive.today'], bare: () => 0, make: (t) => [t] },
    { id: 'paste', name: T('Другой пастбин', 'Another paste site'), hosts: ['hastebin.com', 'justpaste.it', 'privatebin.net', 'paste.ee', 'controlc.com', 'ghostbin.site', 'pastes.dev'], check: 'http', bare: () => 0, make: (t) => [t] },
    { id: 'minecraft', name: T('Minecraft-ресурс', 'Minecraft resource'), hosts: ['namemc.com', 'planetminecraft.com', 'curseforge.com', 'modrinth.com', 'minecraft.net', 'mineskin.org'], bare: () => 0, make: (t) => [t] },
    { id: 'sites', name: T('Сайт', 'Website'), hosts: ['neocities.org', 'itch.io', 'carrd.co', 'wixsite.com', 'blogspot.com', 'notion.site', 'tilda.ws'], bare: () => 0, make: (t) => [t] },
  ];

  const TLD = 'com|net|org|ru|su|ua|by|kz|moe|io|me|gg|be|ly|co|uk|de|tv|xyz|app|dev|link|cc|to|nz|sk|ph|gl|gd|site|online|info|biz|us|eu|fm|so|ms|ws|page|club|space|top|pro|art|cloud|store|lol|sh';
  const SCHEME_URL = /\b(?:https?|ftp):\/\/[^\s"'<>«»]+/gi;
  // Адрес без http должен стоять отдельным словом — иначе «t.me» находится внутри любого мусора.
  const BARE_DOMAIN = new RegExp('(?:^|[\\s(«"\'])((?:[a-z0-9-]+\\.)+(?:' + TLD + '))(\\/[^\\s"\'<>«»]*)?(?=$|[\\s)»"\',;!?.])', 'gi');

  // «Обезвреженные» ссылки: hxxp, [.] (dot) и т. п.
  function refang(text) {
    return text
      .replace(/h[xX]{2}p(s?):\/\//g, 'http$1://')
      .replace(/\s*[[({]\s*(?:\.|dot|точка)\s*[\])}]\s*/gi, '.')
      .replace(/\s*[[({]\s*:\s*[\])}]\s*/g, ':')
      .replace(/\s+(?:dot|точка)\s+/gi, '.');
  }

  function serviceForHost(host, strict) {
    const h = host.toLowerCase().replace(/^www\.|^m\./, '');
    return SERVICES.find((s) => s.hosts.some((x) => h === x || (!strict && h.endsWith('.' + x)))) || null;
  }

  function trimUrl(u) {
    let s = u.replace(/[.,;:!?\]}>'"]+$/, '');
    // Закрывающую скобку убираем, только если она без пары: …/X_(y) остаётся целым.
    while (s.endsWith(')') && (s.match(/\(/g) || []).length < (s.match(/\)/g) || []).length) s = s.slice(0, -1).replace(/[.,;:!?]+$/, '');
    return s;
  }

  function explicitUrls(text, note) {
    const out = [];
    const seen = new Set();
    const push = (url, bare) => {
      url = trimUrl(url);
      if (seen.has(url)) return;
      seen.add(url);
      let host = '';
      try { host = new URL(url).hostname; } catch (e) { return; }
      const svc = serviceForHost(host, bare);
      // Голый домен засчитываем, только если это известный сервис или «нормальное» имя сайта.
      if (bare && !svc && !/^(?:[a-z0-9-]+\.)?[a-z][a-z0-9-]{2,}\.[a-z]{2,}$/i.test(host)) return;
      out.push({ url, service: svc ? svc.name : T('Ссылка', 'Link'), serviceId: svc ? svc.id : 'web', check: svc ? svc.check : null, confidence: 3, note });
    };
    for (const m of text.matchAll(SCHEME_URL)) push(m[0]);
    for (const m of text.matchAll(BARE_DOMAIN)) {
      const domain = m[1];
      if (/^\d+(\.\d+)+$/.test(domain) || domain.length < 4) continue;
      if ([...seen].some((u) => u.includes(domain))) continue;
      push('https://' + domain + (m[2] || ''), true);
    }
    return out;
  }

  function bareCandidates(text) {
    const out = [];
    const tokens = new Set(text.split(/[\s,;|"'«»()<>[\]{}]+/).map((t) => t.replace(/^[.:/]+|[.:/]+$/g, '')).filter((t) => t.length >= 5 && t.length <= 64));
    for (const tok of tokens) {
      if (/[:/]/.test(tok) && /\./.test(tok)) continue;
      for (const svc of SERVICES) {
        const conf = svc.bare(tok);
        if (!conf) continue;
        for (const url of svc.make(tok)) out.push({ url, service: svc.name, serviceId: svc.id, check: svc.check, confidence: conf, id: tok, note: T('похоже на ID', 'looks like an ID'), bare: true });
      }
    }
    return out;
  }

  /**
   * @param {string} text
   * @returns {Array<{url:string, service:string, serviceId:string, check:string|null, confidence:number, note?:string, id?:string}>}
   */
  function detect(text) {
    if (!text) return [];
    const src = String(text).slice(0, 5000);
    const fixed = refang(src);
    const direct = explicitUrls(fixed, fixed !== src ? T('восстановлена из hxxp/[.]', 'restored from hxxp/[.]') : undefined);
    // Перевёрнутые ссылки ищем всегда (а не только когда прямых нет): в одном тексте бывают обе.
    // Если прямая ссылка уже есть, берём из перевёрнутого текста только ссылки известных сервисов —
    // иначе обычный адрес дал бы случайных «двойников».
    const rev = Array.from(src).reverse().join('');
    let reversed = explicitUrls(refang(rev), T('текст перевёрнут', 'the text was reversed')).map((x) => ({ ...x, confidence: 2, reversed: true }));
    if (direct.length) reversed = reversed.filter((x) => x.serviceId !== 'web');
    const found = direct.concat(reversed);
    const all = found.concat(bareCandidates(src));
    const seen = new Set();
    return all.filter((x) => (seen.has(x.url) ? false : seen.add(x.url))).sort((a, b) => b.confidence - a.confidence);
  }

  // Единый разбор YouTube ID: сам ID или ссылка (watch?v=, youtu.be/, shorts/, embed/, live/, v/), в том числе
  // внутри длинного текста и в «обезвреженном» виде.
  // Хост должен начинаться с границы: notyoutube.com, fakeyoutu.be и evil.com/youtu.be/… — не YouTube.
  const YT_URL = /(?<![\w.\/@-])(?:(?:https?:)?\/\/)?(?:(?:www|m|music)\.)?(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|live\/|v\/))([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/i;
  function youtubeIdFrom(text) {
    if (!text) return null;
    const t = refang(String(text).trim());
    if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
    const m = t.match(YT_URL);
    return m ? m[1] : null;
  }

  G.Links = { detect, refang, youtubeIdFrom, SERVICES };
})(typeof self !== 'undefined' ? self : this);
