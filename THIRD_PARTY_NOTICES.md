# Third-party notices / Сторонние компоненты

## Bundled in the repository / В репозитории

| Component | Version | License | Location |
|---|---|---|---|
| tesseract.js | 5.1.1 | Apache-2.0 | `web/vendor/tesseract/` |
| tesseract.js-core (WASM) | bundled with tesseract.js | Apache-2.0 | `web/vendor/tesseract/core/` |
| tessdata_fast (eng, rus, ukr) | Tesseract 4 LSTM models | Apache-2.0 | `web/vendor/tesseract/lang/` |
| jsQR | 1.4.0 | Apache-2.0 | `web/vendor/jsqr/` |
| Built-in Vigenère solver (`vigenere/`) | 1.0 | MIT, © 2026 Dmytro | `vigenere/LICENSE` |
| 7-Zip WebAssembly (7z-wasm, 7-Zip 24.09) | 1.2.0 | GNU LGPL 2.1+ with the unRAR restriction (the RAR decoder may not be used to recreate the RAR compression algorithm) | `web/vendor/7z-wasm/` (License.txt, unRarLicense.txt) |
| RAR test samples | libarchive test suite | BSD-2-Clause | `tests/fixtures/archives/` (see SOURCE.md) |

The licence texts are next to each component.

## Project licence / Лицензия проекта

The application is released under the MIT licence (`LICENSE`, © 2026 Dmytro); `vigenere/` carries the same MIT licence. The components and data below keep their own licences.

## Installed only on request (`python setup_ocr.py`) / Только по запросу

| Component | Version | License | Location |
|---|---|---|---|
| RapidOCR | 3.10.0 | Apache-2.0 | `runtime/ocr-python/` (pip, isolated from your Python) |
| ONNX Runtime | 1.20.1 | MIT | `runtime/ocr-python/` |
| PP-OCRv6 small detector, PP-OCRv5 mobile EN and Cyrillic recognisers | RapidOCR v3.10.0 model set | Apache-2.0 (PaddleOCR models) | `data/ocr/`, SHA-256 in `config/ocr-models.json` |

## Downloaded on first run (release asset `arg-decoder-data-v1.zip`) / Скачивается при первом запуске

The dictionary archive is built from these public sources (`vigenere/download_data.py` downloads them directly when the release asset is unavailable). The word lists and sentence corpora keep their original licences:

| Data | Source | License |
|---|---|---|
| Sentence corpora EN / RU / UK (`corpus_*.txt`) | Tatoeba, tatoeba.org | CC BY 2.0 FR |
| English word list (`words_en.txt`) | github.com/dwyl/english-words | Unlicense |
| English frequent words (`words_en_frequent.txt`) | github.com/first20hours/google-10000-english | No SPDX licence. Its LICENSE.md says the list is derived from the Google Web Trillion Word Corpus (LDC2006T13, Norvig's subsets under MIT) and permits educational, personal and research use; it advises against commercial use without an LDC licence |
| Russian word list (`words_ru.txt`) | github.com/danakt/russian-words | MIT |
| Russian frequent words (`words_ru_frequent.txt`) | github.com/hingston/russian | CC BY 2.5 per its LICENSE.md (derived from the University of Leeds internet corpus) |
| Ukrainian dictionary (`words_uk.txt`) | LibreOffice dictionaries `uk_UA` and github.com/brown-uk/dict_uk | MPL / LGPL / GPL (LibreOffice uk_UA); GPL-3.0 (dict_uk) |
| Ukrainian frequent words (`words_uk_frequent.txt`) | counted from the Tatoeba Ukrainian corpus above (no separate list) | same as the corpus |
| Language models (`model_*.npz`) | n-gram counts computed from the corpora above | same as the corpora |

The browser language tables in `web/js/lang-data.js` are n-gram statistics and frequent-word lists computed from the same corpora. The Spanish table (browser scoring only, not in the data archive) is computed from the Tatoeba Spanish sentence export (`spa_sentences.tsv.bz2`, CC BY 2.0 FR, downloaded 2026-10-24).

Licences were read from each source repository's LICENSE file on 2026-10-24. This table is a record of provenance, not legal advice. Check the terms again before redistributing the data archive, especially the English frequent-word list for commercial use.

## ARG material / Материалы ARG

Example strings and dossiers quote short ciphertexts from public alternate reality games for analysis and teaching (OldRoot, HERMatrix, AlphaVer, Endermite, Archive11, Portal, Cicada 3301, Year Zero, Oxenfree, Inscryption, Sombra, Searching For a World That Doesn’t Exist, I Love Bees, Killing Floor 2, Dr. Langeskov, 76543, Steam Winter 2015, mslan). The test screenshots in `tests/fixtures/` are the author's own in-game captures. All game names belong to their owners.
