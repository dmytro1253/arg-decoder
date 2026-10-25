# Changelog

## 1.3.2 — narrow windows, rollback of 1.3.0 updates

- Narrow windows: top-bar buttons that do not fit move, one by one from the end, into a "⋯" menu (the same buttons, not copies), so the language switch, the server status and the side-panel button never go off-screen. The "by Dmytro" label and the status text shrink first; the status becomes a coloured dot with the text in its tooltip.
- Below 900 px the node list no longer disappears: the "▤ Nodes" button opens it over the canvas, and it closes after a node is added. Between 900 and 1200 px both side panels are narrower.
- Rollback of an update installed by the 1.3.0 updater (its journal has no recorded hashes): the backup is checked against the signed `build.json` of the previous version stored in the same backup (signature, version and every file's SHA-256). If that list is missing or does not verify, the rollback refuses and changes nothing, instead of restoring unchecked files.

## 1.3.1 — backup and rollback fixes

- Previous project: cancelling New, Open or Previous project no longer overwrites the existing backup. The snapshot is prepared in a free slot and becomes the backup only after the replacement is confirmed; cancelling deletes it.
- The backup pointer records the slot and the storage (IndexedDB or browser storage), so when IndexedDB refuses a write and the copy goes to browser storage, that copy is the one restored, also after a reload. Backups from 1.2.1–1.3.0 still open (the newer of the two storages is chosen).
- Update rollback checks the backup before touching anything (every file present, SHA-256 as recorded at install) and checks the restored files afterwards. A missing or damaged backup, or a file that did not restore, is reported as `rollback-failed` with the files (in the launcher output and the Debug tab) instead of success.
- HOW-IT-WORKS: the privacy section lists the automatic update check, the OCR model download and how updates are verified.

## 1.3.0 — signed updates

- Exact build: a release carries `build.json` (version, commit, size and SHA-256 of every program file) and `build.sig`, an Ed25519 signature made with the author's key; the public key is built into `updater.py`. The Debug tab shows the version, the kind of copy (signed release, Git clone, plain sources), commit, build id and signature, and checks every program file on request.
- Update check: at start the page asks the local server, which asks GitHub at most once per 6 hours (can be turned off in Debug; `--offline` disables it). A bar offers the newer version with its release notes.
- Safe install: the archive is trusted only through the signature, unpacked into `runtime/update/staging` and every file is compared with the signed list (extra files, `../` paths and the `data/`, `runtime/`, `.venv/` folders are refused, downgrades too). The launcher installs it before the server starts, after copying every replaced or deleted file into `runtime/update/backup` and writing a journal; any error rolls everything back, an interrupted install is rolled back at the next start, `--rollback` restores the previous version. Only files of the previous signed build are deleted; dictionaries and projects are never touched. Git clones are told to use `git pull`.
- Launcher: `--update`, `--check-update`, `--verify`, `--rollback`; the interface's **Restart and install** asks the launcher to install and start the new version, and the page reloads itself. The start scripts are safe to replace while running.
- Release builder `tools/release.py`: files from the HEAD commit (`git archive`, line endings by `.gitattributes`), version checks against `package.json` and this changelog, signature, and a self-check through the same verification users run.
- The version lives in one place, `version.py`.

## 1.2.1 — fixes from the 2026-10-25 audit

- Key bank: keys are saved in the project file and in autosave with their source and time, and come back after a reload (they used to be dropped); old projects with plain string keys open. Keys are shown as chips with × to delete; Enter adds a key. Fixed a CSS class clash with the on-screen keyboards.
- New project and Open: the confirmation says what really happens, a backup of the current project (boards, drawings, keys, dossiers, attachments) is kept separately from autosave, and the new "Previous project" button restores it. A project with only keys or own dossiers is no longer treated as empty.
- Engine statuses: server codes are mapped to running / done / error / cancelled in one place; an engine error (also with partial candidates) or an unknown status is never reported as done, and the reason is shown, in Auto and in the Vigenère panel.
- Auto: whitespace preparation alone cannot produce a confident answer; "likely" needs word coverage of the whole output; letters with diacritics foreign to Spanish count against the Spanish model; texts in decomposed Unicode (NFD) are scored as NFC.
- RapidOCR is installed by the first start together with the program (`--no-ocr` skips it, `--ocr` retries).
- Debug tab rebuilt: summary cards, all current modules and self-tests (Enigma, RC4, zlib), RapidOCR, tesseract.js and 7-Zip status, data source (release or original sources), first-setup marker, project and browser storage.
- CI: a separate job installs the data-v1 dictionaries and runs the full Python engine tests with skips treated as failures. Docs synced with the registries (75 examples, 17 dossiers, 133 operations of which 58 have Auto probes); the Dossier tab is no longer labelled "Profile" in English.

## 1.2.0 — after the 2026-10-24 review

- Packaging: `.gitignore` excluded `web/data/` by accident (a clean checkout lost two OCR data files); now only the root `data/`, `dist/` and `runtime/` are ignored. The release URL points to `dmytro1253/arg-decoder` (the `data-v1` asset still has to be uploaded; until then setup falls back to the original sources and stops retrying on HTTP 404). Third-party notices record the licences of every dictionary source.
- Auto search: repeated format layers (Base64×N, hex(hex), %25XX) are peeled with depth limits and cycle protection; a reversed link or a link inside an unreadable message confirms only itself; the new status *format decoded, answer not confirmed* separates a correct decode from a confirmed answer; short Base32/Base64/Ascii85 are tried; Atbash per alphabet in mixed text; equal word orders after a reverse are marked ambiguous; sentence shape picks the word order.
- The Python Vigenère engine runs as a queue over the input and intermediate letter layers (Base64 → Vigenère), with deduplication, a shared budget and cancellation.
- Columnar transposition uses the language of the text (EN/RU/UK) and, for scrambled links, a format-constrained search with incomplete rows. Vigenère over a link derives the key from the known start of the address and the host shape of known services, with redundancy checks.
- YouTube link parsing requires a host boundary (`notyoutube.com`, `fakeyoutu.be` are rejected).
- OCR: short lines (42, 007, 0001) are no longer dropped; refinement works line by line and never loses lines; voting counts preprocessing families and confidence; stray fragments are dropped only without positional support and are reported; raw text, boxes and alternatives are kept; no character substitutions. Optional local RapidOCR (ONNX, experimental, `setup_ocr.py`) runs first in the auto order: Minecraft font → RapidOCR raw → RapidOCR contrast → tesseract.
- New: Archive RAR/7z node (7-Zip 24.09 WebAssembly: RAR 4/5 with encrypted headers, 7z with AES, wrong passwords named), Enigma I/M3/M4, raw RC4, bit groups → grid rows (reproduces the Sombra QR), a Spanish language model for scoring.
- New node *Decompress zlib / gzip / deflate*: format by the header or by hand, Adler-32 and CRC-32 checks, a result size limit, byte strings and files; in Auto it peels checksum-verified streams, and XOR keys of 1–3 bytes are derived from the zlib/gzip header as known plaintext. XOR, RC4 and the new node read a file artifact's bytes (XOR used to XOR the handle text).
- New examples: Sombra binary dump → QR, Base64 → XOR → zlib → text, text in an audio spectrogram. README screenshots retaken without the example guide card.
- Ukrainian: the EN/RU buttons work when the address has `?lang=uk`; accessible names and placeholders with line breaks are translated.

## 1.1.0 — after the 2026-10-23 audits

- Auto search: statuses (confident / likely / format / fragment / hypothesis) and a verdict, including an honest "answer not determined"; strict format checks; no confidence for unjustified steps; expressions, hash digests and opaque tokens recognised before the search.
- The local Python Vigenère solver runs inside Auto with a time budget, cancellation, provenance and a continued chain; without the server the panel says so.
- Compound messages are solved line by line (`segment_map`), unknown columnar transpositions are searched, fragments never pose as the answer to the whole input.
- XOR in Auto uses the graph defaults; shared XOR key parser; new nodes: bytes → file, file → bytes, binary file join, bits → image, two-image combine, raw PCM; video frames persist with the project; exact book-cipher layout.
- SSTV on real recordings: median-smoothed sync search, mode from the line period without VIS, measured line length, quality figure. QR repair redraws erased finder patterns (labelled). RAR4 diagnostics show encrypted headers.
- Ukrainian: full interface localisation (generated dictionary of 3398 strings, checked by tests), a Ukrainian language model for the auto search, uk-32/33 alphabets in the browser Vigenère solvers, EN ↔ UK keyboard layout, Ukrainian docs; README rewritten in English, Russian and Ukrainian with installation first.
- 12 new examples and 4 dossiers (Killing Floor 2, Dr. Langeskov, 76543, Steam Winter 2015), each marked as blind auto, auto with the server, manual with a key, or context.

## 1.0.0 — first public release

- Node-graph workspace: boards (tabs), annotations, project files (`.argproj.json`) with attachments, undo/redo, RU/EN interface.
- 128 text operations: classical ciphers, encodings, ARG/Minecraft systems (SGA, Braille, runes, Pigpen, tap code, Bacon, T9), hidden text tools, hashes with candidate check.
- Auto chain search with confidence, key bank, candidate extraction from logs; built-in Vigenère solver (Python, CPU/CUDA) with a browser fallback.
- Images: tone sliders, shadow lift, channels, bit planes, LSB, metadata, OCR (eng/rus/ukr), QR, SGA reader, Minecraft-font digit reader.
- Audio/video: spectrogram, waveform, Morse and DTMF from audio, SSTV (synthetic-verified modes), video frames.
- Files: inspector with hex view, strings, ZIP/JAR (ZipCrypto), `.class` constants, log viewer.
- 60 examples from 11 public ARGs, the mslan case and teaching sets (3 of them with pictures: SGA photos and a dark frame read by OCR), each with a step-by-step guide card; 13 ARG dossiers plus the standard profile dossier; custom dossiers.
- On-screen keyboards: SGA, Braille (dot builder), Morse, runes, Greek, Pigpen, special characters, look-alikes.
- Documentation: `docs/HOW-IT-WORKS.md` (algorithms) and a generated function reference `docs/FUNCTIONS.md`, both also in Russian.
- One-click setup: Windows works without an installed Python (embedded Python is downloaded once); dictionaries are downloaded once from the release and verified by SHA-256.
