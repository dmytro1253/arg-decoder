// Сервер (backend.py, server.py) отвечает по-русски: статусы — это коды протокола, их сравнивают как есть.
// Здесь только перевод для показа в английском интерфейсе; неизвестная строка возвращается без изменений.
(function (G) {
  'use strict';
  /* eslint-disable quote-props */
  const EXACT = {
    'Не установлен RapidOCR: запусти «python setup_ocr.py» (или Start с ключом --ocr)': 'RapidOCR is not installed: run “python setup_ocr.py” (or Start with --ocr)', // i18n-ok: ответ сервера
    'Изображение не в Base64': 'The image is not Base64', // i18n-ok: ответ сервера
    'Не удалось прочитать изображение': 'Could not read the image', // i18n-ok: ответ сервера
    'Слишком большое изображение для OCR': 'The image is too large for OCR', // i18n-ok: ответ сервера
    'ожидает': 'waiting', // i18n-ok: ответ сервера
    'идёт': 'running', // i18n-ok: ответ сервера
    'готово': 'done', // i18n-ok: ответ сервера
    'готова': 'ready', // i18n-ok: ответ сервера
    'ошибка': 'error', // i18n-ok: ответ сервера
    'загружен': 'loaded', // i18n-ok: ответ сервера
    'не загружен': 'not loaded', // i18n-ok: ответ сервера
    'загружается': 'loading', // i18n-ok: ответ сервера
    'нет движка': 'no engine', // i18n-ok: ответ сервера
    'остановлено': 'stopped', // i18n-ok: ответ сервера
    'кэш': 'cache', // i18n-ok: ответ сервера
    'построена из корпуса': 'built from the corpus', // i18n-ok: ответ сервера
    'собран под NumPy 1.x — мост numpy↔torch выключен, движку это не мешает': 'built for NumPy 1.x: the numpy↔torch bridge is off, the engine does not need it', // i18n-ok: ответ сервера
    'PyTorch не установлен — перебор идёт на CPU. Для видеокарты NVIDIA запусти «Включить GPU».': 'PyTorch is not installed: the search runs on the CPU. For an NVIDIA card run Enable-GPU.', // i18n-ok: ответ сервера
    'PyTorch есть, но CUDA недоступна (сборка без CUDA, нет NVIDIA или драйвера).': 'PyTorch is present, but CUDA is unavailable (a CPU-only build, no NVIDIA card or no driver).', // i18n-ok: ответ сервера
    'CUDA недоступна — считаю на CPU': 'CUDA is unavailable: computing on the CPU', // i18n-ok: ответ сервера
    'Уже идёт подбор ключа — дождись его или останови': 'A key search is already running: wait for it or stop it', // i18n-ok: ответ сервера
    'Пустой шифр': 'Empty ciphertext', // i18n-ok: ответ сервера
    'Нет такой задачи': 'No such job', // i18n-ok: ответ сервера
    'Ожидался JSON-объект': 'A JSON object was expected', // i18n-ok: ответ сервера
    'Неверный JSON': 'Invalid JSON', // i18n-ok: ответ сервера
    'Слишком большой запрос': 'The request is too large', // i18n-ok: ответ сервера
    'Неверная длина запроса': 'Invalid request length', // i18n-ok: ответ сервера
    'Запрос не от интерфейса программы': 'The request did not come from the app interface', // i18n-ok: ответ сервера
    'Неверный адрес сервера': 'Wrong server address', // i18n-ok: ответ сервера
    'Нет такого адреса': 'No such address', // i18n-ok: ответ сервера
    'Неверный YouTube ID': 'Invalid YouTube ID', // i18n-ok: ответ сервера
    'Этот сайт нельзя проверить автоматически — открой ссылку сам': 'This site cannot be checked automatically: open the link yourself', // i18n-ok: ответ сервера
    'это клон git — обнови командой git pull': 'this is a git clone: update it with git pull', // i18n-ok: ответ сервера
    'нет прав на запись в папку программы — скачай новую версию со страницы релиза': 'no write access to the program folder: download the new version from the release page', // i18n-ok: ответ сервера
    'в релизе нет подписанного архива обновления — скачай его со страницы релиза': 'the release has no signed update archive: download it from the release page', // i18n-ok: ответ сервера
    'обновление ещё не скачано и не проверено': 'the update is not downloaded and verified yet', // i18n-ok: ответ сервера
    'нет обновления, которое можно установить': 'there is no update that can be installed', // i18n-ok: ответ сервера
    'Программа запущена не через Start — закрой её окно и запусти снова: обновление установится при запуске': 'The program was not started with Start: close its window and start it again; the update is installed at start', // i18n-ok: ответ сервера
    'подпись не сходится — файл изменён или подделан': 'the signature does not match: the file was changed or forged', // i18n-ok: ответ сервера
    'подпись повреждена': 'the signature is damaged', // i18n-ok: ответ сервера
    'у этой копии нет подписанного списка файлов (клон git или исходники)': 'this copy has no signed file list (a git clone or source files)', // i18n-ok: ответ сервера
    'это не сборка ARG Decoder или формат новее, чем понимает эта версия': 'this is not an ARG Decoder build, or its format is newer than this version understands', // i18n-ok: ответ сервера
    'нет адресов файлов обновления': 'no addresses of the update files', // i18n-ok: ответ сервера
  };
  EXACT['копия прошлой версии неполная или повреждена, файлы не тронуты'] = 'the backup of the previous version is incomplete or damaged; no files were changed'; // i18n-ok: ответ сервера
  EXACT['после отката файлы не совпали с копией прошлой версии'] = 'after the rollback, files do not match the backup of the previous version'; // i18n-ok: ответ сервера
  const PATTERNS = [
    [/^откат прерван ошибкой записи \((.*)\)$/, 'the rollback was interrupted by a write error ($1)'], // i18n-ok: ответ сервера
    [/^Нет моделей OCR: (.*) — запусти «python setup_ocr.py»$/, 'OCR models are missing: $1; run “python setup_ocr.py”'], // i18n-ok: ответ сервера
    [/^Неизвестный язык OCR: (.*)$/, 'Unknown OCR language: $1'], // i18n-ok: ответ сервера
    [/^Движок Виженера не загрузился: (.*)$/, 'The Vigenère engine failed to load: $1'], // i18n-ok: ответ сервера
    [/^Параметр (\S+) должен быть числом$/, 'Parameter $1 must be a number'], // i18n-ok: ответ сервера
    [/^Параметр (\S+) должен быть от (\d+) до (\d+)$/, 'Parameter $1 must be from $2 to $3'], // i18n-ok: ответ сервера
    [/^Ввод обрезан до (\d+) символов \(было (\d+)\)$/, 'Input truncated to $1 characters (was $2)'], // i18n-ok: ответ сервера
    [/^Сайт закрыл доступ \(HTTP (\d+)\): страница может существовать$/, 'The site denied access (HTTP $1): the page may exist'], // i18n-ok: ответ сервера
    [/^Сайт ответил HTTP (\d+)$/, 'The site answered HTTP $1'], // i18n-ok: ответ сервера
    [/^YouTube закрыл доступ \(HTTP (\d+)\): видео может существовать$/, 'YouTube denied access (HTTP $1): the video may exist'], // i18n-ok: ответ сервера
    [/^YouTube ответил HTTP (\d+)$/, 'YouTube answered HTTP $1'], // i18n-ok: ответ сервера
    [/^Нет связи с YouTube: (.*)$/, 'No connection to YouTube: $1'], // i18n-ok: ответ сервера
    [/^Нет связи: (.*)$/, 'No connection: $1'], // i18n-ok: ответ сервера
    [/^не удалось связаться с GitHub: (.*)$/, 'could not reach GitHub: $1'], // i18n-ok: ответ сервера
    [/^подпись сделана неизвестным ключом «(.*)»$/, 'signed with an unknown key “$1”'], // i18n-ok: ответ сервера
    [/^хеш файла (.*) не совпал$/, 'the hash of $1 does not match'], // i18n-ok: ответ сервера
    [/^лишний файл в архиве: (.*)$/, 'an extra file in the archive: $1'], // i18n-ok: ответ сервера
    [/^в архиве нет файлов: (.*)$/, 'files missing from the archive: $1'], // i18n-ok: ответ сервера
    [/^архив повреждён: (.*)$/, 'the archive is damaged: $1'], // i18n-ok: ответ сервера
    [/^архив обновления больше допустимого \((\d+) МБ\)$/, 'the update archive is larger than allowed ($1 MB)'], // i18n-ok: ответ сервера
    [/^подписанная сборка (\S+) не новее установленной (\S+)$/, 'the signed build $1 is not newer than the installed $2'], // i18n-ok: ответ сервера
  ];

  /** Строка сервера на языке интерфейса. */
  function server(text) {
    if (typeof text !== 'string' || !G.I18n) return text;
    if (G.I18n.lang === 'uk') return G.I18n.uk(text);
    if (G.I18n.lang !== 'en') return text;
    if (EXACT[text]) return EXACT[text];
    for (const [re, en] of PATTERNS) if (re.test(text)) return text.replace(re, en);
    return text;
  }

  if (G.I18n) G.I18n.server = server;
})(typeof self !== 'undefined' ? self : this);
