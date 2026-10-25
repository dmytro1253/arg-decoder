# Changelog

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
