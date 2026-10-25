# Roadmap

[English](#english) | [Русский](#русский)

## English

The six items Dmytro asked for on 2026-10-19 (order is not priority), then what is still open. "Open" items below the line are taken from the known limitations in the README, not from the author's wish list.

### Requested items

| # | Item | Status |
|---|---|---|
| 1 | **Enchanting-table keyboard.** On-screen keyboard with all 26 SGA glyphs for the Input field and any text field, with optional Latin captions | Done: ⌨ SGA button, 26 glyphs with captions, search by Latin letter, inserts into the last active field |
| 2 | **Drawing and images on the canvas.** Annotation layer (pencil, arrows, frames, labels, colour/thickness, eraser), picture import (drop, clipboard, button), an image node with processing (brightness/contrast, invert, flip, rotate, grayscale, threshold, R/G/B channels, zoom, shadow lift), everything saved with the graph | Done: ✏ Draw layer saved in the project file; image nodes *tones and colour*, *crop and rotate*, *bit plane*, *LSB*, *metadata*, *OCR*, *QR*, *SGA* |
| 3 | **Several boards in one program.** Browser-like tabs with their own graph, name and autosave; create, rename, close, duplicate | Done: boards with per-board camera, selection and undo; close with restore (↶); drag to reorder |
| 4 | **Neutral name of the Vigenère engine** everywhere (interface, Debug tab, README, comments) | Done: "built-in Vigenère solver" |
| 5 | **README at full strength.** Header, badges, screenshots, contents, tables, collapsible sections; English, Russian and Ukrainian with a language switch | Partly done: `README.md` (English) and `README.ru.md` (Russian) are written with screenshots, worked examples and a language switch. Done: README in English, Russian and Ukrainian |
| 6 | **Explanations for functions.** "?" button on a node with a short description, a before/after example and a Wikipedia link; the same hints in the palette and quick search | Done: "?" cards, palette tooltips and the quick-search hint line |

### Also shipped since the original list

- Universal tool: the author profile is optional (`neutral` by default, `mslan` on demand), the key bank is part of the project.
- Auto search reports "no convincing result" instead of guessing, tags results ("as is", "from text", "project key") and extracts candidates from long logs.
- Images: OCR with bundled tesseract.js (eng/rus/ukr), Minecraft-font digit reader, QR, SGA reader, bit planes, LSB.
- Audio and video: spectrogram, Morse, DTMF, SSTV (synthetic-verified), video frame stepper.
- Files: inspector with hex, strings, ZIP/JAR with ZipCrypto and `.class` constants, log viewer; hashes with hash check.
- Project file (`.argproj.json`) with attachments, RU/EN interface switch, Debug tab.
- One-click setup: Windows works without an installed Python; dictionaries download once from the release and are checked by SHA-256; later starts take about 3 s.
- 60 examples (11 public ARGs, the mslan case, teaching sets) and 14 dossiers (13 ARG dossiers plus the standard profile one), custom dossiers; every example opens with a step-by-step guide card.
- Examples with pictures (`img-sga-poem`, `img-sga-key`, `img-vrfneo`): SGA photos and a dark frame read by OCR, loaded on demand from `web/samples/`.
- Documentation: [How it works](docs/HOW-IT-WORKS.md) and a generated [function reference](docs/FUNCTIONS.md), both in English and Russian.
- English text for the server's messages in the Debug tab and API errors.

### Still open

- A licence for the repository (the author has not chosen one; the README says "TBD").
- Check SSTV on real recordings; add Robot 72, PD and Scottie DX.
- Extraction of RAR, 7z, tar, xz and zstd; WinZip-AES; bzip2 and LZMA inside ZIP.
- Automatic finding of the text region for OCR on full screenshots.
- English versions of the Python solver's job log (server statuses and errors are already translated in the interface).
- Keep node runtime state (search progress, results) when switching boards.
- Hand-check tab drag-and-drop and file drop on the board in drawing mode.

## Русский

Шесть пунктов, о которых Dmytro попросил 19.10.2026 (порядок не приоритет), и что осталось открытым. Открытые пункты ниже черты взяты из известных ограничений в README, а не из списка пожеланий автора.

### Запрошенное

| № | Пункт | Статус |
|---|---|---|
| 1 | **Клавиатура стола зачарований.** Экранная клавиатура со всеми 26 знаками SGA для поля «Ввод» и любых текстовых полей, подписи латиницей по желанию | Готово: кнопка ⌨ SGA, 26 знаков с подписями, поиск по латинской букве, вставка в последнее активное поле |
| 2 | **Рисование и изображения на холсте.** Слой пометок (карандаш, стрелки, рамки, подписи, цвет и толщина, ластик), вставка картинок (перетаскивание, буфер, кнопка), нода изображения с обработкой (яркость/контраст, инверсия, отражение, поворот, оттенки серого, порог, каналы R/G/B, увеличение, подъём теней), всё сохраняется вместе с графом | Готово: слой ✏ Рисование в файле проекта; ноды «тона и цвет», «обрезка и поворот», «битовая плоскость», «LSB», «метаданные», «OCR», «QR», «SGA» |
| 3 | **Несколько досок в одной программе.** Вкладки как в браузере: свой граф, имя, автосохранение; создать, переименовать, закрыть, дублировать | Готово: доски со своей камерой, выделением и отменой; закрытие с возвратом (↶); порядок перетаскиванием |
| 4 | **Нейтральное название движка Виженера** везде (интерфейс, вкладка «Отладка», README, комментарии) | Готово: «встроенный подбор Виженера» |
| 5 | **README на максимум.** Шапка, значки, скриншоты, оглавление, таблицы, сворачиваемые разделы; английский, русский и украинский с переключателем | Готово частично: `README.md` (английский) и `README.ru.md` (русский) написаны, со скриншотами, разобранными примерами и переключателем языка. Готово: README на английском, русском и украинском |
| 6 | **Пояснения к функциям.** Кнопка «?» на ноде: кратко, пример «до → после», ссылка на Википедию; те же подсказки в списке слева и в быстром поиске | Готово: карточки «?», подсказки в палитре и строка подсказки быстрого поиска |

### Что добавилось сверх первого списка

- Универсальность: профиль автора необязателен (по умолчанию `neutral`, `mslan` по желанию), банк ключей входит в проект.
- Авто-поиск говорит «убедительного результата нет» вместо догадок, помечает результаты («как есть», «из текста», «ключ проекта») и достаёт кандидатов из длинных логов.
- Картинки: OCR со встроенным tesseract.js (eng/rus/ukr), читатель цифр «шрифт Minecraft», QR, читатель SGA, битовые плоскости, LSB.
- Звук и видео: спектрограмма, Морзе, DTMF, SSTV (проверен на синтетике), покадровый просмотр видео.
- Файлы: инспектор с hex, строки, ZIP/JAR с ZipCrypto и константами `.class`, просмотр лога; хеши и проверка хеша.
- Файл проекта (`.argproj.json`) с вложениями, переключатель RU/EN, вкладка «Отладка».
- Установка в один клик: на Windows не нужен установленный Python; словари скачиваются один раз из релиза и проверяются по SHA-256; следующие запуски — около 3 с.
- 60 примеров (11 публичных ARG, кейс mslan, учебные наборы) и 14 досье (13 по ARG и стандартное досье профиля), свои досье; каждый пример открывается с карточкой-гидом по шагам.
- Примеры с картинками (`img-sga-poem`, `img-sga-key`, `img-vrfneo`): SGA-фото и тёмный кадр с OCR, подгружаются по требованию из `web/samples/`.
- Документация: [как устроена программа](docs/HOW-IT-WORKS.ru.md) и генерируемый [справочник функций](docs/FUNCTIONS.ru.md), на английском и русском.
- Английский текст для сообщений сервера во вкладке «Отладка» и ошибках API.

### Ещё открыто

- Лицензия репозитория (автор её не выбрал; в README написано «решит автор»).
- Проверить SSTV на настоящих записях; добавить Robot 72, PD и Scottie DX.
- Распаковка RAR, 7z, tar, xz и zstd; WinZip-AES; bzip2 и LZMA внутри ZIP.
- Автоматический поиск области с текстом для OCR на полных скриншотах.
- Английская версия журнала задач Python-подбора (статусы и ошибки сервера интерфейс уже переводит).
- Сохранять состояние нод в памяти (ход перебора, результаты) при смене доски.
- Проверить руками перетаскивание вкладок и сброс файла на доску в режиме рисования.
