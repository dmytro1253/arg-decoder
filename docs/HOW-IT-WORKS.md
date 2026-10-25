# How ARG Decoder works

[Русская версия](HOW-IT-WORKS.ru.md) · [Function reference](FUNCTIONS.md) · [README](../README.md)

This document explains what happens inside the program: how it starts, how the node graph computes, how the auto search picks an answer, and how the Vigenère solver, OCR, the SGA reader, audio decoders and file tools work. Every number quoted here is the constant used in the code; the file that holds it is named next to it.

## Contents

1. [The big picture](#1-the-big-picture)
2. [Start-up and one-click install](#2-start-up-and-one-click-install)
3. [The node graph](#3-the-node-graph)
4. [Text scoring: "does this look like an answer?"](#4-text-scoring-does-this-look-like-an-answer)
5. [The auto search](#5-the-auto-search)
6. [Vigenère: three solvers](#6-vigenère-three-solvers)
7. [Links, IDs and candidates in long text](#7-links-ids-and-candidates-in-long-text)
8. [Images: processing, OCR, Minecraft font, SGA, QR](#8-images-processing-ocr-minecraft-font-sga-qr)
9. [Audio and video](#9-audio-and-video)
10. [Files, archives and hashes](#10-files-archives-and-hashes)
11. [Projects, boards, examples and dossiers](#11-projects-boards-examples-and-dossiers)
12. [Keyboards, drawing, debug](#12-keyboards-drawing-debug)
13. [Security and privacy](#13-security-and-privacy)
14. [Tests](#14-tests)
15. [Evidence, engines and media after the 2026-10-23 audit](#15-evidence-engines-and-media-after-the-2026-10-23-audit)

---

## 1. The big picture

```
 Start-Windows.bat / Start-Mac.command / start.sh
        │  finds or downloads Python, checks the data once
        ▼
 launcher.py ──► server.py  (http://127.0.0.1:8765, local only)
                   │  serves web/  ─────────────►  browser: the whole interface (web/js/*.js)
                   │  /api/youtube, /api/link        node graph, auto search, OCR, SGA, audio,
                   │  /api/vigenere, /api/diagnostics  files, dossiers, keyboards
                   ▼
                 backend.py ──► vigenere/  (Python engine: numpy on CPU cores, torch on CUDA)
                                   └── data/  (dictionaries, corpora, cached language models)
```

* **The interface is plain JavaScript** with no build step. Every module is an IIFE that registers itself on a global object (`G.CipherOps`, `G.NodeTypes`, `G.Solver`…). Because of that `web/index.html` also opens straight from disk (`file://`); then only the features that need the server are off (the Python Vigenère engine, YouTube and link checks, tesseract OCR).
* **The server** is the Python standard library only (`http.server`). It listens on 127.0.0.1, serves `web/` and a handful of JSON endpoints.
* **The heavy Vigenère engine** lives in `vigenere/` and runs inside the server process as jobs (`backend.py`): numpy on all CPU cores through `multiprocessing`, and optionally torch on an NVIDIA GPU.
* **Data** (word lists, text corpora, cached language models; about 300 MB unpacked) is not in the repository. It is downloaded once as a release archive and checked by SHA-256.

## 2. Start-up and one-click install

The user double-clicks one file. What happens next (`Start-Windows.bat`, `launcher.py`, `setup_data.py`, `tools/bootstrap-python.ps1`):

1. **Find Python.** The launcher script tries, in order: the private copy `runtime/python`, then `py -3`, `python`, `python3`. Each candidate is checked by `tools/pycheck.py` (Python ≥ 3.9 and 64-bit). On Windows with no suitable Python, `bootstrap-python.ps1` downloads the official *embeddable* Python 3.12 from python.org into `runtime/python` (≈ 10 MB), enables `site` in its `._pth` file, installs pip with `get-pip.py` and checks that it runs. Nothing is installed system-wide.
2. **Fast path.** If `runtime/setup-done.json` exists, its version matches and a quick check finds the data files, the launcher starts the server immediately (about 3 s).
3. **First run.** Otherwise the launcher:
   * installs `numpy` (and `torch` only with `--gpu`) into the private Python or a `.venv`;
   * runs `setup_data.py`: reads `data.manifest.json` (file names, sizes, SHA-256), downloads `arg-decoder-data-v1.zip` from the release URL in `config/release.json` with resume (`.part` file + HTTP `Range`), progress and four retries, checks the archive hash, extracts only flat `data/<name>` entries (anything with `..` or sub-folders is ignored), and checks every extracted file against the manifest. If the release is unreachable it falls back to building the data from the original public sources (`vigenere/download_data.py`);
   * runs a self-test: the engine must decrypt `LMVCCIKB` with the key `LUCY` to `ASTEROID`;
   * writes `runtime/setup-done.json` and starts the server.
4. **Flags.** `--repair` redoes everything, `--offline` never touches the network, `--gpu` adds PyTorch with CUDA, `--check` only verifies. Updates: `--update`, `--check-update`, `--verify` (program files against the signed build list) and `--rollback` (see the README, "Updates").
5. **Warm-up.** When the server starts, `backend.py` loads the language models in the background (from the `.npz` cache, about 1–1.5 s each), hashes the dictionaries and probes CUDA. The **Debug** tab shows all of it.

The model cache file name contains a *content signature*: SHA-256 of the first and last megabyte of each source file plus its size (`vigenere/core.py: data_signature`). A changed dictionary therefore rebuilds the model, while copying the folder to another computer keeps the cache valid.

## 3. The node graph

**Model** (`web/js/graph.js`). A graph is a set of nodes `{id, type, x, y, params}` and links `{from, to, port}`. A node type is either an *operation* from `G.CipherOps` (pure function: strings in → string out) or a *special node* from `G.NodeTypes` (own interface: input, result, auto search, image, audio, file…).

**Evaluation** is a memoised depth-first walk:

* each node's inputs are evaluated first; a node visited twice on the current path is a cycle and gets the error "a cycle in the graph";
* if an input has an error, the node does not run; it gets `inputError` pointing at the first broken node upstream. The canvas marks that node as the *culprit* (red outline), so a long broken chain points at its real cause;
* an operation's parameters come from its fields, but an operation with a second input (a key, a second text) takes that input from the wire when one is connected;
* results are stored per node (`graph.results`) and drawn into the node's output panel with length, HEX view, copy button and detected links.

The view re-evaluates 120 ms after an edit (`requestEval`), or once per animation frame while a slider is dragged (`requestEvalFrame`), so image sliders give live previews. After every evaluation the view fires a `graph-evaluated` event; the example guide uses it to refresh its step list, including after a slow OCR finishes.

**Loading a file is defensive.** Parameters are checked against each type's schema, unknown types and broken ports are dropped, links that would form a cycle are skipped, and everything is listed in `graph.loadReport` instead of failing silently.

**Artifacts** (`web/js/artifacts.js`). Files (images, audio, video, archives, logs) are stored once in the project as data URLs and passed along wires as handles `artifact:<id>`. Image and audio processing creates *derived* artifacts that live only in memory and are cached by the recipe (`imgproc.recipeKey`): the same chain of adjustments is never recomputed.

**Undo and layout.** Every change is a snapshot in the undo stack (Ctrl+Z / Ctrl+Y). *Arrange* lays nodes out in columns by data-flow depth; *Show all* fits nodes and drawings into the view, leaving room for the example guide when it is open.

## 4. Text scoring: "does this look like an answer?"

`web/js/scorer.js` gives every string a score. It is a measure of how much the string looks like plain text or a usable link, not a probability that it is the solution.

**Language.** For English and Russian (in the browser Ukrainian text is scored with the Russian model) the scorer computes two things:

* **Quadgram fit.** Log-probabilities of every 4-letter sequence (tables in `web/js/lang-data.js`, 8-bit quantised). The average is normalised so that random letters give ≈ 0 and normal text ≈ 1.
* **Word coverage.** Dynamic programming over each run of letters finds the split into dictionary words that covers the most letters (words of 5+ letters weigh 1, 4 letters 0.85, 3 letters 0.55, 1–2 letter function words 0.35). The result is the covered share of letters plus the list of found words.

The two are mixed with a weight that depends on length: quadgrams count for 55 % at 20+ letters, 45 % at 12+, 30 % at 7+, 20 % below, and only about half of that again if fewer than 15 letters are present and no words were found. Short strings are too easy to fake with quadgrams alone.

**Checks applied on top:**

* if one letter makes up more than about 15 % of a long text (the limit is higher for short phrases), the language score is halved: that is the trace of a repeating cipher, not language;
* mixed Latin and Cyrillic letters reduce the score; strings shorter than 4–5 letters are trusted less;
* non-printable bytes cost 140 points per unit of share;
* a URL gives at least 60 points, +30 for a known host (YouTube, Drive, Catbox, Pastebin…); a URL still in `%HH` form loses 20 because the full decode is worth more;
* a string that looks like an 11-character YouTube ID or a Drive ID is tagged as an ID; random "words" inside an ID mean nothing, so its language score is mostly ignored;
* a string that looks like another encoding layer (`%HH`, hex, binary, digits, Morse, Base64) is tagged `layer:` and gets high *potential*: it is not an answer but is worth decoding further.

A string is **readable** when its language score is at least 0.5, it has at least three letters, found words, and less than 5 % junk.

## 5. The auto search

`web/js/solver.js` runs a **beam search over chains of operations**.

**Roots.** The search starts from the input itself, plus up to 12 candidates cut out of it when the input is long (hex, Base64, binary groups, number rows found by `candidates.js`; see [section 7](#7-links-ids-and-candidates-in-long-text)). If the input already reads as text, a link or an ID, it is added as an *as is* result with a small bonus. If the input has at least 30 letters and does not look like an encoding layer, the keyless Vigenère cracker adds its top three guesses straight away.

**Expansion.** For each state in the beam and each operation that has a `probes` function, the operation proposes parameter sets for this particular text (Caesar proposes the shifts, Vigenère proposes keys from the project key bank and the active profile, `dec_codes` proposes widths and shifts, and so on). Each output is scored and kept if it is new or explains the same text more simply. Rules prune nonsense before it is computed:

* an operation is never followed by itself or by its inverse (hex encode → hex decode);
* letter ciphers are not tried on hex, digits, binary, Base64, `%HH` or Morse, nor on strings that are mostly not letters;
* two substitutions in a row are skipped (Caesar after Vigenère almost never helps and produces a lot of noise);
* a string that is already readable is not encrypted further;
* bytes that are not ASCII after a decoder are read as UTF-8 and CP1251 in the same step.

**Ranking** (`chainRank`). The rank of a result is its text score plus:

* the average *prior* of the operations used (how often each appears in real puzzles);
* +30 for a *clean decode*: a layer (numbers, `%HH`, hex, Base64) removed with no substitution, giving letters of one alphabet;
* +25 for something cut out of a log and decoded to a readable word;
* a bonus for keys the user put into the project, or the active profile's favourite parameters (for example `+23` in the mslan profile);
* minus 5 points per unit of *explanation cost* (the sum of step costs; exotic steps like affine, rail fence, Playfair cost 2);
* minus 25 (or 50) points for an **unjustified encryption step**: a transform that raised readability by less than 0.12 over its parent;
* minus 2 points per bit of **parameter freedom**: an operation that tried N parameter sets pays 2·log₂N, because more attempts make it easier to hit a word by chance.

**Beam.** After each level the next beam keeps the 150–160 states with the highest potential, with at most a quarter of the beam from one operation, so 25 Caesar shifts cannot crowd out everything else. Depth is 1–4 levels (the *Fast*, *Normal*, *Deep* settings).

**Confidence.** A result is marked convincing only if it is a link, a clean decode, an *as is* text, or a readable text that did not need cipher parameters to be guessed (or needed them but has at least 8 letters or used a project key). When nothing is convincing the panel says so instead of showing noise as an answer.

**Responsiveness.** The search runs in the page's main thread in slices of 25 ms and yields between them, so the window never freezes and no Web Worker is needed (workers do not start from `file://`). It stops at a time limit (25 s by default) or when cancelled. The final list holds up to 300 results plus the best result for every project key, so a key the user typed is never lost in the noise.

**Profiles and the key bank** (`web/js/profile.js`). The default profile is *neutral*: no one's keys or habits. A profile (for example *mslan*) can add keywords, favourite parameters and habits (operations the author likes, which are then not penalised as unjustified). The key bank holds keys found or entered in this project, with where each came from; the solver tries them first.

## 6. Vigenère: three solvers

### 6.1 Keyless crack in the browser (`vigenere-crack.js`)

Used inside the auto search. For each key length up to 8–10 (but no more than half the letters), it splits the text into columns, picks the shift of each column by letter frequencies, then refines the key letter by letter with the quadgram score. On short texts (fewer than ~5 letters per key position) the result is only a guess.

### 6.2 Built-in key finder in the browser (`vigenere-auto.js`)

The *Vigenère solver* node and the *Find the Vigenère key* button use a JavaScript port of the Python engine:

* it tests all alphabet variants at once: Latin 26, Cyrillic 32 (without Ё) and 33;
* **short text (< 60 letters):** brute force over short keys plus a dictionary attack (each dictionary word as a key);
* **long text:** frequency analysis per column, then iterated local search (change one key letter, keep the change if the score improves, restart from perturbed keys);
* the search uses trigram scores (cheap); the final ranking of the top 60 keys per length uses quadgrams plus dictionary coverage, with a bonus that grows as coverage^1.4 and a penalty of ln M per key letter (M is the alphabet size), so a long key has to earn its length.

### 6.3 The Python engine (`vigenere/`, `backend.py`)

The full engine is the author's own solver. The browser sends `POST /api/vigenere`, then polls `/api/vigenere/status`.

* **Alphabets:** `en-26`, `ru-32`, `ru-33`, `uk-32`, `uk-33`; **variants:** classic Vigenère (P = C − K), Beaufort (P = K − C) and variant Beaufort (P = C + K). The same plaintext gives different ciphertext under each, so the engine tests them all.
* **Analysis first:** index of coincidence for key lengths up to 20 and the Kasiski test (distances between repeated trigrams) are written to the job log as key length hints.
* **Strategy** by text length: below 60 letters `brute → dict → freq`; otherwise `freq → dict → brute`.
* **Brute force:** all keys of each length are split into ranges and scored on every CPU core (`multiprocessing`, numpy vectorised trigram sums), or on the GPU (`gpu_scan`: torch tensors, batch size chosen from free GPU memory, automatic retry with a smaller batch on out-of-memory).
* **Dictionary attack:** dictionaries of up to millions of words (and their reverses) are turned into index matrices per key length and scored in bulk.
* **Frequency attack + hill climbing:** 320 random seeds per key length, each climbed letter by letter.
* **Final ranking** (`final_rank`): every candidate gets the quadgram score; the 600 leaders also get dictionary coverage (weight 6 nats per letter) and a penalty of ln M per key letter.
* **Language models** are built from the corpora (n-gram tables + word sets) and cached as `.npz` files named by the content signature (see [section 2](#2-start-up-and-one-click-install)).
* Jobs that nobody polls for 60 s stop by themselves; input is capped and the cap is reported in the log.

## 7. Links, IDs and candidates in long text

**Link detector** (`web/js/links.js`): finds explicit URLs, including defanged forms (`hxxp`, `[.]`, `(dot)`) and reversed ones, and bare IDs shaped like IDs of known services (YouTube video and channel, Drive, Catbox, Pastebin, Imgur, Discord invites, Telegram…). Each hit has a confidence level: 3 is an explicit link, 2 a strong pattern, 1 a shape only.

**Online checks** (only when the user asks, only through the local server):

* **YouTube:** the public oEmbed endpoint returns the title and channel if the video exists. 400/404 mean "no such video"; 401/403 mean "access denied, the video may exist" and are not cached.
* **Links:** only `https://` addresses on an allow-list of file and paste hosts (Catbox, Pastebin, Imgur, Drive, Rentry, bit.ly, Yandex Disk, gist…), port 443, no credentials. The request asks for the first kilobyte only (`Range: bytes=0-1023`) and **never follows redirects**: a redirect is reported with its target instead.

**Candidates** (`web/js/candidates.js`): finds hex, Base64, binary groups, number rows, coordinates, URLs and service IDs inside a long text or a game log. Each candidate keeps its position (offset, line, column), so the *Find candidates* node lists them, cuts one out by number, and the auto search can decode it and show where in the log it came from.

## 8. Images: processing, OCR, Minecraft font, SGA, QR

### 8.1 Processing (`web/js/image/imgproc.js`)

All image functions are pure: they take `{width, height, data}` (RGBA) and return a new object, so they run the same in the browser and in Node tests. The *tones and colour* node chains channel selection, grayscale, black and white points, **shadow lift**, gamma, brightness, contrast, auto-levels (global or per channel), histogram equalisation, inversion and thresholding (fixed or Otsu). *Geometry* does rotation, flips, scaling and cropping by a selected region. *Bit planes* shows one bit of one channel; *LSB* extracts the low bits of chosen channels in a chosen order as bytes and text; *Metadata* reads EXIF/PNG chunks and finds data after the end of the image.

**Shadow lift** brightens dark tones much more than light ones. That is how the barely visible digit line in the sky of the dark-frame example (brightness 13–17 on a background of 9) becomes readable.

### 8.2 OCR (`web/js/image/ocr.js`)

Text recognition uses **tesseract.js 5 bundled in `web/vendor/tesseract`** with English, Russian and Ukrainian data: nothing is sent anywhere. It needs the local server, because browsers do not start its worker from `file://`. Before recognition the image goes through one of the preprocessing presets: *plain*, *contrast* (auto-levels), *denoise* (auto-levels + blur), *dark* / *dark70* (strong shadow lift + blur + invert), *binary* (Otsu), *invert*; small images are upscaled. The *auto* preset runs several of them, refines each by re-reading line by line, and keeps the result with the best confidence. A region can be selected so that only part of a screenshot is read; *digits only* restricts the alphabet.

### 8.3 Minecraft font (`web/js/image/pixelfont.js`)

Book pages, item tooltips and chat use a bitmap font where each digit is a 6-pixel cell (5 for the glyph + 1 gap). The reader finds the scale (screen pixels per font pixel), cuts the line into cells on that grid instead of looking for empty columns, and matches each cell against templates. Italic tooltips shift the upper rows to the right, which glues neighbours together, so the shear is estimated for the whole line and undone before matching.

### 8.4 SGA, the enchanting table alphabet (`web/js/image/sga.js`)

1. **Binarise:** Otsu threshold on brightness; whichever class covers less area is the "ink" (works for light-on-dark and dark-on-light).
2. **Lines:** horizontal projection splits the image into text lines.
3. **Font grid:** the glyph height is 7 font pixels; from it the reader estimates the scale and resamples each line into a grid of font pixels (each cell is ink if enough of it is ink).
4. **Atoms:** columns are grouped into atoms separated by empty columns. Some SGA letters are made of several separate parts (`ʖ ꖌ ∷ ∴ !¡`), so atoms are not yet letters.
5. **Dynamic programming over templates:** the best split of the atom sequence into letters is chosen by comparing merged atom groups with the 26 letter templates (Hamming distance; tolerance one pixel or 12 % of the ink). Multi-part letters are thus matched whole.
6. **Output:** Latin key letters. SGA maps Latin one to one, so a Russian author typing on an English layout produces text like `gjl[jlbn`; the *Cyrillic (ЙЦУКЕН)* output converts it to `подходит`.

Each glyph gets a confidence and a box on the image: green for confident, yellow for templates not yet verified on real screenshots, red for unknown. On the two real SGA photos from the mslan case every glyph is read (94 on the first one, all with ≥ 90 % confidence); a test checks both.

### 8.5 QR and barcodes (`web/js/image/qr.js`)

QR codes are read with **jsQR** (bundled); other barcodes with the browser's `BarcodeDetector` where available. Real QR codes in screenshots are often dark, small or pale, so several preprocessings (invert, upscale, contrast) are tried.

## 9. Audio and video

* **WAV** (`media/wav.js`) is parsed exactly (PCM 8/16/24/32-bit, float 32/64) with its own sample rate; other formats are decoded by the browser's WebAudio.
* **Spectrogram** (`media/dsp.js`, `spectro-render.js`): short-time Fourier transform with a window; the picture has time and frequency axes, zoom, selection and playback. The output is an image artifact that OCR can read: messages drawn into the spectrum are common in ARGs.
* **Morse from audio** (`media/morse-audio.js`): find the tone, build its envelope, threshold it with Otsu, estimate the time unit from the lengths of tones and pauses, classify dots/dashes and gaps between letters and words, and mark uncertain places.
* **DTMF** (`media/dtmf.js`): the Goertzel algorithm measures the 8 DTMF frequencies frame by frame; a row tone plus a column tone give 0–9, `*`, `#`, A–D. The digit string can feed the *phone multitap* operation.
* **SSTV** (`media/sstv.js`): Robot 36, Martin M1/M2, Scottie S1/S2. FM demodulation (mix with 1900 Hz, low-pass, phase difference) gives an instantaneous frequency track; the VIS header picks the mode, 1200 Hz sync pulses align the lines, and pixel values are read along each line into an image. Tested on synthetic signals; real recordings need a manual look.
* **Video by frames** (`media/video-node.js`): exact ±1 frame stepping, frame number ↔ time, frame extraction, contact sheets and audio track extraction, all as derived artifacts.

## 10. Files, archives and hashes

* **Signatures** (`files/signatures.js`): the format is detected by magic bytes, not by the file name. For PNG, JPEG, GIF, ZIP and others the end of the structure is known (after `IEND`, `EOI`, the end of central directory), so **data appended after the end** is found and can be cut out. The tool also scans the whole file for embedded files of known types.
* **Strings** (`files/strings.js`): like the `strings` utility, for ASCII, UTF-8 with non-ASCII letters and UTF-16 LE/BE, with offsets.
* **Archives** (`files/archive.js`, `zip.js`, `inflate.js`): ZIP/JAR listing and extraction with a pure JavaScript inflate, ZipCrypto passwords, nested archives addressed as `a.zip!inner.jar!X.class`, search across all entries, single gzip; RAR, 7z, tar, xz and other 7-Zip formats are extracted by the separate 7-Zip node (section 16).
* **Java class files** (`files/classfile.js`): the constant pool is parsed and its strings listed: hidden messages in Minecraft mods often live there.
* **Logs** (`files/logview.js`): a large log is shown with line numbers, search and the candidate finder.
* **Hashes** (`files/hash.js`): MD5, SHA-1, SHA-256, SHA-512 and CRC32 in pure synchronous JavaScript (no `crypto.subtle`, so it also works from `file://`); constants for SHA-2 are computed from primes. Hash operations compare a text or a file with a known hash.

## 11. Projects, boards, examples and dossiers

* **Project** (`project.js`): several boards (tabs), a shared evidence store (artifacts), the key bank and custom dossiers. It is autosaved in the browser (localStorage for the structure, IndexedDB for large artifacts; heavy artifacts are only rewritten when their set changes) and can be saved to and opened from one `.argproj.json` file. Old single-graph `.json` files open too. The format is versioned and validated on load.
* **Examples** (`presets*.js`, `presets-kit.js`): 173 boards: documented solutions plus one example per node on real data (`presets-tour.js`; `tests/tour.test.js` fails if an operation has no example). Each has its source and reliability in a note, either an `auto` block (the input, any keys the ARG itself revealed, and the expected answer that the auto search must rank first or in the top three) or a `manual` reason (an outside key, an image or sound, an in-game action). Image examples carry their picture as a lazily loaded file in `web/samples/` (`samples.js`), so it does not slow the start and works from `file://`.
* **Guide card** (`preset-guide.js`): an example opens with a card that lists the chain in data-flow order with the result of every step, the expected answer, why it is manual, source discrepancies, and a button that runs the auto search on the original string. It updates after each re-evaluation.
* **Dossiers** (`dossiers*.js`): 17 built-in dossiers, one per ARG: period, platform, creators, status, summary, sources, stages (artifact → technique → result → status), techniques, open questions, and linked examples. Custom dossiers have the same structure; source links are validated (only `http(s)`).

## 12. Keyboards, drawing, debug

* **On-screen keyboards** (`keyboards.js`, `kb-*.js`, `sga-keyboard.js`): SGA, Braille (with a dot-by-dot cell builder), Morse, runes (Younger Futhark), Greek, pigpen, special characters, and look-alike letters (Latin/Cyrillic homoglyphs). Glyphs go into the focused field or into the panel's scratchpad; *Reads as* shows the decoded text live.
* **Drawing** (`annotations*.js`): pencil, arrows, frames, ellipses, labels and pictures on the board, stored in world coordinates (they move and zoom with the graph), included in undo and in the project file. An annotation arrow never connects ports: it is a note, not data.
* **Debug tab** (`debug.js`): checks that all interface modules, language data and operations loaded, runs a few known decodings end to end, and asks the server for Python, numpy, PyTorch, CUDA, the engine, model loading times and data file hashes. *Copy report* puts all of it on the clipboard for a bug report. The server's own messages are in Russian; the English interface translates them (`server-text.js`).

## 13. Security and privacy

* The server listens on **127.0.0.1 only**. API requests must come with a `Host` of `127.0.0.1` or `localhost` (protection from DNS rebinding), and `POST` requests must carry the header `X-ARG-Decoder: 1`, which a foreign web page cannot send to it without a CORS preflight.
* **No telemetry, no accounts.** The program goes online only:
  * on first setup: python.org for Python on Windows, PyPI for numpy/torch and RapidOCR, modelscope.cn for the OCR models, the GitHub release for data;
  * for the **update check**: at start, at most once per 6 hours, the local server reads the release list from `api.github.com` (no data about the user or the project is sent; the check can be turned off in Debug and `--offline` disables it), and downloads the release files from `github.com` only when the user presses Update;
  * when the user explicitly asks for a YouTube or link check. Link checks are limited to an allow-list of hosts and never follow redirects.
* **Updates are trusted only through the signature.** The release file list (`build.json`) is signed with Ed25519 by the author's key, whose public half is built into `updater.py`. Every file of the archive is compared with that list before installing. Replaced files are backed up with their hashes. A rollback checks the backup before touching anything and checks the result after; if either check fails, it reports `rollback-failed` with the files instead of success.
* The downloaded data archive and every file in it are checked against SHA-256 hashes in `data.manifest.json`; extraction accepts only flat file names inside `data/`.
* Projects and files stay in the browser storage of this computer or in the project file the user saves.

## 14. Tests

* `node --test` runs the JavaScript suite (more than 400 tests): every operation, the graph, the solver, every example (it must compute without errors and give its documented answer, in both languages), the auto search on every `auto` example, image processing, SGA and the Minecraft font on real screenshots, audio decoders on synthetic signals, file tools, project format, dossiers, keyboards, translations.
* `python -m unittest discover -s tests -p "test_*.py"` checks the backend and the data installer (missing files, corrupt archives, unsafe paths).
* `node tools/check_i18n.js` fails if any Cyrillic interface string is not wrapped in `T('ru', 'en')`; `node tools/gen_functions_doc.js --check` fails if the function reference is out of date.
* GitHub Actions runs all of it on Windows, macOS and Linux.

## 15. Evidence, engines and media after the 2026-10-23 audit

**Statuses instead of one "confident" flag** (`solver-evidence.js`). Every result gets one of: *confident* (a deterministic decode of a format the input really is in, giving readable text, a link, coordinates, a file path or a number; or a guessed-parameter result whose dictionary-covered letters clearly outweigh the number of tried variants), *likely* (it reads, but the evidence is thin: short text, guessed parameters), *format* (a hash digest, an OpenSSL `Salted__` container or an opaque identifier: no plaintext), *fragment* (only part of the input was decoded) and *hypothesis*. The search ends with a verdict: solved, candidates, format recognised, or **answer not determined**. Format checks are strict: Base64 must have a valid alphabet and length, Base32 one letter case, hex an even number of digits. Printable ASCII counts as evidence only after a byte decoder (Base64, hex, binary…), never after letter mappings. Steps that did not raise readability never give confidence. The multiple-comparisons penalty fades with the number of letters covered by dictionary words, so a correct long decryption is not buried, while a 5-letter word reached through three guessed steps stays a hypothesis.

**Input recognisers.** Before searching, an arithmetic expression is evaluated exactly (`2*3*76543` → 459258), a hex string of a standard digest length containing a–f is reported as a hash, and a single letter-and-digit token (`1v7531`, `794e2cea991`) is kept as is.

**Python engine inside Auto** (`solver-engines.js`). When the input looks like a letter ciphertext and the local server runs, the full Python Vigenère solver starts in parallel with the browser search, within a time budget (20 s by default) and with cancellation. Its keys are re-applied by the graph's own Vigenère operation (exact spaces and case) and scored like any other candidate, with a correction for the key length (about 3 bits per key letter plus 10). A key with fewer than three text letters per key letter is marked "key underdetermined". Each candidate carries its provenance (engine, key, alphabet, time) and gets one more level of chain search. Without the server the panel says so. Found keys never enter the project key bank.

**Compound messages and transpositions** (`solver-crackers.js`). If the lines of the input need different schemes, each line is solved separately and the parts are joined with the original line breaks by the graph operation *Parts by line* (`segment_map`), whose JSON plan reproduces the result. If the letter frequencies look like the language but the quadgrams do not, the column order of a columnar transposition is searched by hill climbing with a seeded generator (the same input always gives the same search), cyclic shifts of the key are compared, and the answer is reproduced by the ordinary *Columnar transposition by key* node. When a confident answer to the whole input exists, fragments are listed below it.

**Bytes, files and images.** XOR in Auto runs with the same defaults as in the graph; *XOR keeping spaces/punctuation* uses the same key parser and has a byte rule (keep spaces, dots and commas). New nodes: *Bytes → file*, *File → bytes*, *Join files (bytes)* (with part boundaries and the declared PDF length), *Bits → image* (feeds QR and OCR), *Image: combine two images* (difference, XOR, add, multiply, screen, average, opacity, offset) and *Bytes → audio (raw PCM)*. Frames, contact sheets and audio extracted from a video are kept with the project. The book cipher has an exact layout mode (characters as is, words split on a single space, first number 0 or 1).

**SSTV on real recordings.** The frequency track is median-smoothed (1.5 ms) before the sync search. Without a VIS header the mode is chosen from the line period (single-line intervals weigh more, so Robot 36 is not mistaken for Martin M1). The line length is measured from the recording, and the picture starts at the first stable run of syncs. The result reports how the mode was found and a quality figure (the share of lines with a real sync). A built picture is not proof that the puzzle is solved.

**QR repair.** If the usual variants fail, the image is sampled on an N×N grid, the three finder patterns and the timing lines are redrawn to the standard, and jsQR runs again. Such a result is labelled "repaired: finder patterns redrawn". Data modules are never changed.

**RAR.** The ZIP node still only reports RAR4 headers (encrypted or not); extraction moved to the RAR/7z node in section 16.

## 16. After the 2026-10-24 review (1.2.0)

**Format layers first.** Before the beam search, layers in a strictly checked format (percent, hex, binary, Base64, Base32, Ascii85) are peeled one after another, up to six, with UTF-8 read as part of the decoder step. The beam search may repeat a decoder up to four times in a row, and any state already seen higher in the same chain is dropped (cycle protection). So `Base64(Base64(Base64(text)))` costs no search depth.

**Decoded is not confirmed.** A deterministic decode is *confident* only when the output confirms itself: readable text with at least 6 letters and 60 % dictionary cover, a link covering the whole output, coordinates, a path or an evaluated expression. Otherwise it is *format decoded, answer not confirmed* (`decoded`): `UE9UUw==` → `POTS` is a correct decode, but `STOP` stays in the list. A reversed link (`gnp.…//:sptth`) is a hint for a reverse step, not a link; a scheme distorted by a cipher (`frrnq://`) is the next layer. A link inside a longer text confirms only itself: the text around it must read, otherwise the as-is result is *part of the input* and transforms and the Python engine still run on it. Language is judged on the text without the link, so a Latin URL does not drown a Ukrainian sentence.

**Permutations and word order.** Reverse by words costs more than reverse of the whole string; a capital first letter and a final full stop add a small bonus. If two orders of the same letters read equally well (within 3 points), the leader is marked *likely* with "ambiguous".

**Engine queue.** The Python Vigenère engine is a queue for one search: the input, then up to two intermediate letter layers found by exact decoding (Base64 → `JSH ALWE PROIR…`). Identical texts are not repeated, the time budget and cancellation are shared, and the found key is applied to that layer, so the chain `Base64 → bytes → Vigenère(key)` is reproducible in the graph.

**Format-constrained searches.** Columnar transposition is scored with the model of the text's alphabet (EN, RU or UK). A scrambled link (all characters of `https://` present, no space) is searched over column orders whose decryption starts with `https://` or `http://`, with incomplete last rows, and only full links are kept. Vigenère over a link takes key letters from the known start (`https`, `www`, or the host of a known service with the same label lengths, since dots survive); every key letter must be checked at least once and at least two extra checks must agree.

**OCR.** Each line is refined separately and the raw line is kept if the refinement lost characters; lines of any length count. Voting needs agreement from different preprocessing families (dark/dark70 are one family) and does not let a zero-confidence group replace a meaningful result. In digits mode a short line next to a long one is dropped only if no other family saw the same text in the same place; dropped lines are returned with a warning. Raw text, boxes, alternatives and all candidates are returned. No character is substituted. The auto order is Minecraft font → RapidOCR as is → RapidOCR with auto contrast → tesseract; a branch is accepted only if it is non-empty and, for digits, only digits and spaces (rejected answers are kept, not cleaned).

**RapidOCR backend.** `setup_ocr.py` installs RapidOCR 3.10.0 and ONNX Runtime 1.20.1 into `runtime/ocr-python` (appended to the end of `sys.path`, so the main Python's numpy stays in charge) and the three models from `config/ocr-models.json` into `data/ocr` with SHA-256 checks. `POST /api/ocr` takes a PNG and `en` or `cyrillic`, groups blocks into lines by vertical overlap and returns raw text, boxes and scores; `GET /api/ocr/status` explains what is missing.

**Archives.** The *Archive RAR/7z (7-Zip)* node runs 7-Zip 24.09 compiled to WebAssembly, loaded on demand. Each operation uses a fresh in-memory file system, the password is always passed explicitly (`-p`) so 7-Zip never prompts, and the output is limited to 256 MB and 5000 files. A wrong password, a damaged archive and an unsupported format get their own messages.

**Machines and encodings.** Enigma I/M3/M4 implements rotors I–VIII, Beta/Gamma, reflectors A/B/C and thin B/C, rings, start positions, plugboard and the middle-rotor double step; it is checked against the published 1941 (M3) and 1942 (M4) messages. Raw RC4 is separate from the OpenSSL container. *Bit groups → grid rows* reflows a dump printed in groups and text columns; with 12,12,13 bits, 3 groups per row and 3 columns it turns the Sombra dump into a 37×37 QR that reads «¿Estuvo eso facilito? …».

**Spanish.** A Spanish quadgram and word model (Tatoeba) is used for Latin text in scoring. It needs stronger evidence than English (60 % cover and two words, or ñ/á/¿), so random Latin strings do not become "Spanish".

**Compressed layers.** *Decompress zlib / gzip / deflate* reuses the pure-JS inflater of the ZIP reader. Auto picks gzip (`1F 8B 08`) or zlib (CMF method 8, window ≤ 32 KB, CMF·256+FLG divisible by 31) by the header; raw deflate is accepted only if the stream ends within one byte of the input. Adler-32 or CRC-32 with the length is verified; a mismatch is an error in strict mode and a warning otherwise. In Auto a checksum-verified stream counts as a format layer and is peeled at once; the result may grow up to 1 MB (the usual 5× length limit does not apply after decompression). XOR over compressed data gets extra key candidates from the header as known plaintext: one byte from any valid CMF/FLG, two bytes from `78 01/5E/9C/DA`, one to three bytes from `1F 8B 08`; the decompression checksum then confirms or rejects each key. Raw deflate has no header or checksum, so after XOR it stays *likely*.
