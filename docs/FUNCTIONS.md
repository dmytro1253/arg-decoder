# ARG Decoder: function reference

[Русская версия](FUNCTIONS.ru.md) · [Українська версія](FUNCTIONS.uk.md)

Every node, example, dossier and keyboard in the app, generated from the live registries by `tools/gen_functions_doc.js` (do not edit by hand). How the pieces work inside is described in [HOW-IT-WORKS.md](HOW-IT-WORKS.md).

**133** operations (function nodes), **34** special nodes, **75** examples, **17** built-in dossiers.

## Contents

- [Special nodes](#special-nodes)
  - [Input & output](#special-nodes--input--output) (4)
  - [Auto](#special-nodes--auto) (2)
  - [Checks](#special-nodes--checks) (4)
  - [Images](#special-nodes--images) (10)
  - [Audio & video](#special-nodes--audio--video) (6)
  - [Files](#special-nodes--files) (8)
- [Operations (function nodes)](#operations-function-nodes)
  - [Checks](#operations-function-nodes--checks) (2)
  - [Encodings](#operations-function-nodes--encodings) (48)
  - [Shifts](#operations-function-nodes--shifts) (10)
  - [Keyed ciphers](#operations-function-nodes--keyed-ciphers) (21)
  - [ARG & Minecraft](#operations-function-nodes--arg--minecraft) (10)
  - [Hidden](#operations-function-nodes--hidden) (6)
  - [Permutations](#operations-function-nodes--permutations) (9)
  - [Text](#operations-function-nodes--text) (13)
  - [Join](#operations-function-nodes--join) (6)
  - [Hashes](#operations-function-nodes--hashes) (8)
- [Examples](#examples)
- [Built-in dossiers](#built-in-dossiers)
- [On-screen keyboards](#on-screen-keyboards)

## Special nodes

Nodes with their own interface: input, results, the auto search, images, audio, files.

### Special nodes · Input & output

#### Input `input`

Paste a cipher here. You can make several inputs for parts and keys.

- Inputs: none
- Parameters:
  - Text

#### Result `view`

Shows the value large and recognises links and YouTube IDs.

- Inputs: input

#### Note `note`

Free text for hypotheses and hints.

- Inputs: none

#### Artifact (file) `artifact`

Evidence file: image, audio, video, archive, log. Drop a file on the canvas, paste with Ctrl+V or pick it with the button. The original is kept unchanged.

- Inputs: none

### Special nodes · Auto

#### Auto-decrypt `auto`

Tries chains of known techniques and shows the best results (the investigation profile and project keys are taken into account). Click a result to pick it, “To graph” expands the chain into nodes. If nothing is convincing, the node says so.

- Inputs: input
- Parameters:
  - Depth — options: Fast (2 steps), **Normal (3 steps)**, Deep (4 steps)

#### Vigenère solver `vigcrack`

The built-in Vigenère solver, no hints needed: a short text gets full short-key brute force + a dictionary, a long one gets frequency analysis with iterated local search. Your project keys are tried directly and always stay in the list. All alphabet variants at once.

- Inputs: input
- Parameters:
  - Engine — options: **Auto: Python if available**, Python (full dictionaries, CUDA), Browser (no install)
  - Strategy (Python) — options: **Auto by text length**, Full brute force, Frequency analysis, Dictionary (all words), Hill climbing
  - Cipher — options: **Vigenère**, Beaufort, Variant Beaufort, All three (browser)
  - Language (Python) — options: **Auto**, Russian, Ukrainian, English
  - Alphabet (browser) — options: **Auto (from the text)**, en-26, ru-33 (with Ё), ru-32 (without Ё)
  - Max key length (0 = auto) — default: `0`
  - Use the graphics card (CUDA) — default: on
  - Deep browser brute force (up to 5 letters) — default: off

### Special nodes · Checks

#### String analysis `analyze`

Length, alphabet, index of coincidence, what it looks like. Passes the value on.

- Inputs: input

#### YouTube check `youtube`

Checks the ID through YouTube oEmbed: whether the video exists, its title and channel. Requires starting through the launcher (Запуск.bat / start.sh).

- Inputs: input
- Parameters:
  - Check automatically — default: on

#### ID mask brute force `mask`

Gaps “_” or “?” are filled with characters from the set; every variant is checked through YouTube. Example: _y_xPVyp_H_.

- Inputs: mask
- Parameters:
  - Mask (if no input is connected) — default: `?y?xPVyp8H0`
  - Gap characters — default: `_?`
  - Set — options: **All ID characters (64)**, Letters and digits (62), a–z, A–Z, 0–9, Custom
  - Custom set
  - Stop at the first hit — default: on

#### Link finder `links`

Finds links (including defanged hxxp, [.] and reversed ones) and IDs that look like YouTube, Drive, Catbox, Pastebin, Imgur… The output is the first link found.

- Inputs: input
- Parameters:
  - Show weak matches — default: off

### Special nodes · Images

#### Bits → image `bits_to_image`

Rows of 0 and 1 (or your own characters) become an image artifact: width, order (by rows or columns), flips, inversion, scale and a white margin. Then connect “QR and barcodes”, OCR or processing.

- Inputs: bits
- Parameters:
  - Width in cells (0 = by lines or square) — default: `0`
  - Character of a “black” cell — default: `1`
  - Character of a “white” cell — default: `0`
  - Order — options: **by rows**, by columns (transpose)
  - Flip horizontally — default: off
  - Flip vertically — default: off
  - Invert — default: off
  - Pixels per cell — default: `8`
  - White margin, cells (QR needs 4) — default: `4`

#### Image: tones and colour `img_adjust`

Brightness, contrast, gamma, levels, shadow lift, auto-levels, invert, grayscale, threshold, R/G/B/A channel. Order: channel → gray → levels → shadows → gamma → brightness/contrast → auto → invert → threshold. Before/after compares with the original. The original is never modified.

- Inputs: image
- Parameters:
  - Channel — options: **all**, R, G, B, Alpha, luma
  - Grayscale — default: off
  - Black point, 0–254 — 0…254, default 0
  - White point, 1–255 — 1…255, default 255
  - Shadow lift, % — 0…100 %, default 0
  - Gamma, 0.1–5 — 0.1…5, default 1
  - Brightness, −255…255 — -255…255, default 0
  - Contrast, −100…100 — -100…100, default 0
  - Auto — options: **none**, auto-levels, auto-levels per channel, histogram equalize
  - Invert — default: off
  - Threshold — options: **none**, fixed, Otsu (auto)
  - Threshold level, 0–255 — 0…255, default 128

#### Image: crop and rotate `img_geom`

Crop by region (the Region button, then drag), rotate by 90/180/270°, flips, nearest-neighbour scaling. Order: crop → rotate → flip → scale. The Result button shows the output.

- Inputs: image
- Parameters:
  - Rotate — options: **0°**, 90° →, 180°, 270° (90° ←)
  - Flip horizontally — default: off
  - Flip vertically — default: off
  - Scale by … — 0.1…16 ×, default 1

#### Image: bit plane `img_bits`

Shows one bit of the chosen channel as a black-and-white image (bit 0 is the least significant). Used to spot patterns hidden in low bits (LSB steganography). JPEG re-saving destroys such data, so use the original file.

- Inputs: image
- Parameters:
  - Channel — options: **R**, G, B, Alpha
  - Bit (0 = lowest … 7) — 0…7, default 0

#### Image: LSB extraction `img_lsb`

Collects the low bits of pixels into bytes. Channels (traversal order), number of bits, bit order within a byte, row or column scan, skip. Output is a latin1 string (one char per byte), ready for Base64/hex/ASCII chains.

- Inputs: image
- Parameters:
  - Channels (r g b a in order) — default: `rgb`
  - Low bits per channel, 1–8 — 1…8, default 1
  - Bit order in a byte — options: **MSB first**, LSB first
  - Scan — options: **by rows**, by columns
  - Skip bits at start — default: `0`
  - Invert bits — default: off
  - Max output bytes (0 = all) — default: `0`

#### Image: metadata `img_meta`

Size, format, PNG text chunks (tEXt/zTXt/iTXt), JPEG/GIF comments, EXIF text and data appended after the end of the image (with ZIP/PNG/etc. signature scan). Output is a text report.

- Inputs: image

#### Image: OCR (text) `img_ocr`

Recognises text locally, with no internet, when running through the local server. The auto order: Minecraft font (digits from the pixel grid) → RapidOCR (ONNX, experimental; install with python setup_ocr.py) as is, then with auto contrast → tesseract.js trying several preprocessing variants. Raw answers of every branch, line boxes and removed fragments are kept; characters are not corrected (O does not become 0, Ґ does not become Г). For large screenshots select a region with the Region button.

- Inputs: image
- Parameters:
  - Engine — options: **auto (Minecraft → RapidOCR → tesseract)**, RapidOCR (experimental), tesseract.js, Minecraft font (digits)
  - Language — options: **English**, Русский, Українська, English + Русский, Русский + English, Українська + English, EN + RU + UK
  - Digits only — default: off
  - Preprocessing — options: **auto (try several)**, as is + upscale, auto contrast, auto contrast + denoise, lift shadows (dark frames), black & white, invert

#### Image: QR / barcode `img_qr`

Reads QR codes (jsQR, local); other barcodes only if the browser has BarcodeDetector (the Other codes button). Tries invert, auto-levels and scaling; the found code is outlined. For a QR in a large frame select a region.

- Inputs: image

#### Image: SGA (enchanting table) `img_sga`

Reads the Minecraft "Standard Galactic" font: colour binarisation → lines → font pixel grid → template matching (multi-part glyphs too). Outputs the Latin letters of the keys; glyphs without a template give "?". If the author typed Russian on a Latin layout (gjl[jlbn = подходит), enable "Output: Cyrillic". Overlay: green confident glyphs, yellow from unverified templates, red unknown.

- Inputs: image
- Parameters:
  - Brightness threshold, 0–255 (0 = auto) — 0…255, default 0
  - Image pixels per font pixel (0 = auto) — 0…64 px, default 0
  - Output — options: **Latin (key letters)**, Cyrillic (ЙЦУКЕН layout)

#### Image: combine two images `img_combine`

Overlays image B onto A: difference, XOR, add, multiply, screen, average or opacity. The B offset (dx, dy) aligns the images; “stretch” fits B to the size of A. Difference and XOR reveal how two nearly identical images differ.

- Inputs: image A, image B
- Parameters:
  - Blend — options: **difference \|A − B\|**, byte XOR, add, A − B, multiply, screen, average, B over A with opacity
  - B opacity, % (for “over”) — 0…100 %, default 50
  - B offset X, px — default: `0`
  - B offset Y, px — default: `0`
  - Stretch B to the size of A — default: off

### Special nodes · Audio & video

#### Spectrogram (audio/video) `spectrogram`

Spectrogram and waveform of the sound: FFT size, window, overlap, frequency and dB range, linear/log scale, colour maps, contrast. Drag to select, wheel to zoom in time. Output is an image artifact (OCR can read words drawn in the spectrogram) or a WAV segment.

- Inputs: audio/video
- Parameters:
  - FFT size — options: 256, 512, 1024, **2048**, 4096, 8192
  - Window — options: **Hann**, Hamming, Blackman
  - Frame overlap, % — options: 0, 50, **75**, 87.5, 93.75
  - Channel — options: **Mono (L+R)**, Left, Right, Difference L−R
  - Reverse the audio — default: off
  - Speed (1 = as is; 0.5 = half speed, lower pitch) — 0.1…4 ×, default 1
  - Min frequency, Hz — default: `0`
  - Max frequency, Hz (0 = Nyquist) — default: `0`
  - Frequency scale — options: **Linear**, Logarithmic
  - Colour map — options: **Inferno**, Magma, Viridis, Hot, Ice, Gray, Gray inverted (dark on light, for OCR)
  - Auto levels from the data — default: on
  - Dynamic range with auto levels — 10…160 dB, default 80
  - Bottom of scale (auto levels off) — -200…0 dB, default -100
  - Top of scale (auto levels off) — -120…20 dB, default -10
  - Contrast (gamma): >1 darkens weak parts, <1 lifts them — 0.1…4, default 1
  - Show waveform — default: on
  - Output — options: **Image artifact (spectrogram of the selection)**, Audio artifact (WAV of the selection)
  - Exported image height, px — options: 256, **512**, 1024, 2048

#### Morse from audio `morse_audio`

Finds the tone (automatically or at a set frequency), threshold and dot length, and outputs dots/dashes (for the "Morse → text" node) or decoded text. Uncertain elements are highlighted on the plot; in text they can be marked {X} and ¦.

- Inputs: audio/video
- Parameters:
  - Channel — options: **Mono (L+R)**, Left, Right, Difference L−R
  - From second (0 = start) — default: `0`
  - To second (0 = end) — default: `0`
  - Tone frequency, Hz (0 = auto) — default: `0`
  - Threshold of peak, 0–1 (0 = auto) — 0…1, default 0
  - Dot length (0 = estimate) — 0…2000 ms, default 0
  - Alphabet — options: **Latin**, Cyrillic
  - Output — options: **Dots and dashes**, Text, Report
  - Mark uncertain spots (? in Morse, {X} and ¦ in text) — default: off

#### DTMF from audio `dtmf_audio`

Phone tones (Goertzel on 8 frequencies) → digits 0–9, *, #, A–D. Feed the output to "Phone: presses → letters". Pauses longer than the set value become spaces (handy for multitap).

- Inputs: audio/video
- Parameters:
  - Channel — options: **Mono (L+R)**, Left, Right, Difference L−R
  - From second (0 = start) — default: `0`
  - To second (0 = end) — default: `0`
  - Analysis window — 5…200 ms, default 30
  - Min tone length — 5…500 ms, default 40
  - Min amplitude, 0–1 — 0…1, default 0.01
  - Pause → space, ms (0 = no spaces) — default: `0`
  - Output — options: **Digits**, Tone report

#### SSTV from audio `sstv_audio`

Decodes SSTV: Robot 36, Martin M1/M2, Scottie S1/S2 (mode from VIS or manual). Output is an image artifact. Other modes (Robot 72, PD, Scottie DX…) are not implemented. Verified on synthetic signals; check real recordings by eye.

- Inputs: audio/video
- Parameters:
  - Channel — options: **Mono (L+R)**, Left, Right, Difference L−R
  - From second (0 = start) — default: `0`
  - To second (0 = end) — default: `0`
  - Mode — options: **Auto (from VIS)**, Robot 36, Martin M1, Martin M2, Scottie S1, Scottie S2

#### Video frame stepper `video_frames`

Local video: ±1 frame stepping, time and frame number, "frame → image", contact sheet (every N-th frame with labels), "audio → artifact" for the spectrogram. The browser does not report the frame rate, so set fps. Output is the last artifact created.

- Inputs: video
- Parameters:
  - Frames per second (23.976, 24, 25, 29.97, 30, 50, 59.94, 60) — default: `30`
  - Sheet: every N-th frame — default: `30`
  - Sheet: from frame — default: `0`
  - Sheet: to frame (0 = end) — default: `0`
  - Sheet: max frames (up to 120) — default: `48`
  - Sheet: columns — default: `6`
  - Sheet: tile width, px — default: `160`

#### Bytes → audio (raw PCM) `raw_pcm`

Reads any file or byte string as raw audio samples: the sample format, channels, rate and header offset are set explicitly. Use it when sound hides in an “image” or a headerless file. The output is an audio artifact for the spectrogram, Morse, DTMF and SSTV.

- Inputs: file/bytes
- Parameters:
  - Sample format — options: **8-bit unsigned**, 8-bit signed, 16-bit LE, 16-bit BE, 24-bit LE, 32-bit LE, float 32 LE
  - Channels — default: `1`
  - Sample rate, Hz — default: `8000`
  - Skip bytes at the start (header) — default: `0`

### Special nodes · Files

#### File inspector `file_inspect`

Detects the format by signature, computes SHA-256/MD5 and entropy, shows hex with search, finds data after the end of the file (after IEND/EOI/EOCD) and embedded files. Output: report, SHA-256, the “tail” or a carved fragment as a new artifact.

- Inputs: file
- Parameters:
  - Output — options: **Report (text)**, SHA-256, Tail after the end (artifact), Carve at offset (artifact)
  - Carve offset — default: `0`

#### Strings from file `file_strings`

Extracts ASCII, UTF-8 and UTF-16 strings with a minimum length and a regex filter. Accepts an artifact or any bytes (HEX/Base64 output). Output is text, one string per line.

- Inputs: file/data
- Parameters:
  - Encodings — options: **ASCII + UTF-8 + UTF-16LE**, ASCII, UTF-8 (with non-ASCII), UTF-16LE, UTF-16BE
  - Min length — default: `4`
  - Filter (regular expression)
  - Ignore case — default: on
  - Show offsets — default: off
  - Line limit — default: `5000`

#### Archive (ZIP/JAR) `file_archive`

Lists ZIP/JAR/APK/DOCX entries (name, size, method, password), extracts an entry as a new artifact, ZipCrypto passwords, nested archives (“a.zip!b.zip!c.txt”), .class constants and search across all entries. RAR, 7z and WinZip-AES are extracted by the Archive RAR/7z (7-Zip) node.

- Inputs: file
- Parameters:
  - Output — options: **Entry list (text)**, Entry (artifact), .class constants (text), Search contents
  - Entry (name, #index or path with !)
  - Password (ZipCrypto)
  - Search (regular expression)
  - .class: string literals only — default: off

#### Archive RAR/7z (7-Zip) `file_archive7z`

Extracts RAR 4/5 (including password-encrypted headers), 7z (including AES), and tar, xz, bzip2, cab, iso and other 7-Zip formats. Runs locally: 7-Zip 24.09 in WebAssembly, the files stay in browser memory. A wrong password and a damaged archive are named plainly. Needs the local server (from file:// the browser will not load wasm).

- Inputs: file
- Parameters:
  - Output — options: **Entry list (text)**, Entry (artifact)
  - Entry (name or #index)
  - Password

#### Log viewer `log_view`

A large text or log artifact: line numbers, search, highlighting of hex/Base64/URLs/coordinates/§ codes. A selection can be sent to a new Input. Output: the whole text, matching lines (with context) or a list of detected candidates.

- Inputs: text/log
- Parameters:
  - Output — options: **Whole text**, Matching lines, Detected candidates
  - Line filter
  - Filter is a regular expression — default: off
  - Ignore case — default: on
  - Invert — default: off
  - Context lines — default: `0`
  - What to extract — options: **All types**, HEX, Base64, URL, Coordinates, UUID
  - With type and line number — default: off

#### Bytes → file `bytes_to_file`

Turns a byte string (the output of HEX, Base64, XOR…) or text into a file artifact. The type comes from the signature, so the file inspector, images, audio and archives can follow.

- Inputs: bytes/text
- Parameters:
  - Read the input as — options: **byte string as is (UTF-8 if any character > 255)**, text → UTF-8, HEX, Base64
  - File name (empty = from the signature)

#### File → bytes `file_to_bytes`

Turns a file artifact into a byte string (for XOR, hashes, shifts), hex or Base64. The bytes are unchanged.

- Inputs: file
- Parameters:
  - Output — options: **byte string**, HEX, Base64, UTF-8 text
  - Max bytes — default: `4194304`

#### Join files (bytes) `file_concat`

Joins the parts as bytes in input order: artifacts (for example “.pdfaa” + a “.wav” that is really the rest of the PDF) or byte strings. The output is a new file typed by its signature; part sizes and boundaries are shown.

- Inputs: part 1, part 2, part 3, part 4
- Parameters:
  - Result name (empty = from the signature)

## Operations (function nodes)

Pure text functions. Each takes a string on its inputs and returns a string; the parameters are the fields in the node. Marked **auto** if the auto search tries the operation by itself.

### Operations (function nodes) · Checks

#### Anagram check: two texts `anagram_check`

Compares the letter/digit multisets of two strings ignoring case and spaces and shows the extra and missing ones. “D I E L N I A I W R M R S” vs “MILNER IS WARD”: A has one extra I.

- Inputs: text A, text B
- Parameters:
  - Text B (if not connected)

#### Find candidates in text `extract_candidates`

Finds hex, Base64, binary groups, links, service IDs, coordinates and number runs inside a long text or log. “Number” picks one candidate (for further decoding); 0 lists them all with positions in the source.

- Inputs: input
- Parameters:
  - Kind — options: **Any**, URL, HEX, hash?, binary groups, ID, Base64, number run, long number, coordinates
  - Number (0 = list) — default: `1`

### Operations (function nodes) · Encodings

#### HEX → bytes `hex_decode` · _auto_

Pairs of hexadecimal digits to bytes: 54 30 39 → T09. Spaces, 0x and commas are ignored.

- Inputs: input

#### Text → HEX `hex_encode` · _auto_

The reverse of hex: every character is written as a byte code. The encoding is explicit (UTF-8 by default).

- Inputs: input
- Parameters:
  - Encoding — options: **UTF-8**, CP1251 (Windows), KOI8-R, Bytes as is (0–255)
  - Separator — default: ``

#### Base64 → bytes `base64_decode` · _auto_

Standard and URL-safe Base64. Missing “=” are added; non-canonical trailing bits give a warning (an error in strict mode).

- Inputs: input
- Parameters:
  - Strict (error instead of a warning) — default: off

#### Text → Base64 `base64_encode`

- Inputs: input
- Parameters:
  - Encoding — options: **UTF-8**, CP1251 (Windows), KOI8-R, Bytes as is (0–255)

#### Base32 → bytes `base32_decode` · _auto_

RFC 4648: A–Z and 2–7. An impossible length, “=” inside the string and non-zero trailing bits give a warning (an error in strict mode).

- Inputs: input
- Parameters:
  - Strict (error instead of a warning) — default: off

#### Text → Base32 `base32_encode`

- Inputs: input
- Parameters:
  - Encoding — options: **UTF-8**, CP1251 (Windows), KOI8-R, Bytes as is (0–255)

#### Base58 → bytes `base58_decode` · _auto_

The Bitcoin alphabet (no 0, O, I, l).

- Inputs: input

#### Binary → bytes `binary_decode` · _auto_

01001000 01101001 → Hi. Without spaces it splits into 8 (or 7) bits; an incomplete tail is dropped with a warning (an error in strict mode).

- Inputs: input
- Parameters:
  - Bits per group — options: **8 bits (when unspaced)**, 7 bits (ASCII)
  - Strict (error instead of a warning) — default: off

#### Text → binary `binary_encode`

- Inputs: input
- Parameters:
  - Encoding — options: **UTF-8**, CP1251 (Windows), KOI8-R, Bytes as is (0–255)

#### Numbers → characters `dec_codes` · _auto_

Decimal codes to characters with a shift added: digit pairs +23 → %CA%D2… .

- Inputs: input
- Parameters:
  - Split — options: **Auto**, By separators, 2 digits, 3 digits
  - Add — default: `0`

#### Characters → numbers `text_to_codes`

- Inputs: input
- Parameters:
  - Subtract — default: `0`
  - Separator — default: ``

#### Numbers → letters (A1Z26) `a1z26` · _auto_

Letter numbers in the alphabet. Russian counts Ё (33 letters). Numbers outside the alphabet are an error; for wrap-around mapping use “Numbers → letters (modulo)”.

- Inputs: input
- Parameters:
  - Alphabet — options: **Latin**, Cyrillic 33, Cyrillic 32, Ukrainian 33
  - First letter = — default: `1`
  - Split — options: **By separators**, 2 digits

#### Letters → numbers `letters_to_numbers`

- Inputs: input
- Parameters:
  - Alphabet — options: **Latin**, Cyrillic 33, Cyrillic 32, Ukrainian 33
  - First letter = — default: `1`

#### URL decoding (%HH) `url_decode` · _auto_

%CA%D2%CE → КТО (CP1251) or UTF-8. A plus sign can be treated as a space.

- Inputs: input
- Parameters:
  - Encoding — options: **UTF-8**, CP1251 (Windows), KOI8-R
  - “+” = space — default: on

#### URL encoding `url_encode`

- Inputs: input
- Parameters:
  - Encoding — options: **UTF-8**, CP1251 (Windows), KOI8-R, Bytes as is (0–255)

#### Bytes → text `bytes_decode` · _auto_

Read bytes as UTF-8 / CP1251 / KOI8-R (for example after Base64 or HEX).

- Inputs: input
- Parameters:
  - Encoding — options: **UTF-8**, CP1251 (Windows), KOI8-R

#### Text → bytes `text_encode`

- Inputs: input
- Parameters:
  - Encoding — options: **UTF-8**, CP1251 (Windows), KOI8-R, Bytes as is (0–255)

#### Morse → text `morse_decode` · _auto_

Letters separated by spaces, words by “/” or three spaces. Understands · and −.

- Inputs: input
- Parameters:
  - Language — options: **Latin**, Cyrillic

#### Text → Morse `morse_encode`

- Inputs: input
- Parameters:
  - Language — options: **Latin**, Cyrillic

#### Number: base → base `base_convert`

Convert an integer, for example decimal 836 → hex 344.

- Inputs: input
- Parameters:
  - From base — default: `10`
  - To base — default: `16`

#### Base85 / Z85 → bytes `base85_decode` · _auto_

Ascii85 (<~…~>, “z” = 4 zeros) or Z85 (seen in the Minecraft Dungeons II ARG). Z85 must be a multiple of 5 characters: an incomplete group gives a warning (an error in strict mode).

- Inputs: input
- Parameters:
  - Variant — options: **Ascii85 (Adobe)**, Z85 (ZeroMQ)
  - Strict (error instead of a warning) — default: off

#### Bit groups → grid rows `bit_rows`

Takes the low bits of each 0/1 group by a list (“12,12,13”, cycling), joins N groups into a grid row and, if a text line holds several grid rows side by side (columns), lays them back out: text line L holds rows L, B+L, 2B+L…, where B is the number of full text lines; the remainder goes last. Output: one grid row per line, for the Bits → image node.

- Inputs: input
- Parameters:
  - Kept low bits per group (cycling) — default: `12,12,13`
  - Groups per grid row — default: `3`
  - Grid rows per text line — default: `1`

#### Escapes → characters `unescape` · _auto_

\u0041, \x41, &#65;, &#x41;, &amp;, U+0041 → A.

- Inputs: input

#### Numbers → letters (modulo) `num_letters` · _auto_

A universal number-to-letter mapping: numbering from 0 or 1, an offset, reduction modulo the alphabet length (27 → A with 26 letters), a custom alphabet. Punctuation and line breaks can become spaces.

- Inputs: input
- Parameters:
  - Alphabet — options: **Latin (26)**, Cyrillic with Ё (33), Cyrillic without Ё (32), Ukrainian (33), Custom alphabet
  - Custom alphabet (letters in order)
  - First letter = — default: `1`
  - Offset (added to each number) — default: `0`
  - Numbers outside the alphabet — options: **Modulo (wrap around)**, Error, Skip with a warning
  - Breaks — options: **Run together**, Space at punctuation, Keep line breaks, Punctuation → space, lines → newline
  - Output case — options: **UPPERCASE**, lowercase

#### Pigpen → letters `pigpen_decode` · _auto_

The Freemason cipher from a token notation: rb lrb lb (A B C), a trailing dot gives the J–R shapes; cross: v < > ^ = S T U V, with a dot W X Y Z. Also accepts Unicode approximations ┘ ⊔ └ ⊐ □ ⊏ ┐ ⊓ ┌ ∨ ∧ with “·”. “/” is a word gap.

- Inputs: input

#### Letters → pigpen `pigpen_encode`

Letters A–Z into pigpen tokens (rb, lrb. …) or Unicode approximations. Words are separated by “/”.

- Inputs: input
- Parameters:
  - Notation — options: **Unicode glyphs**, Tokens (rb, v.)

#### Runes (Elder Futhark) → Latin `runes_decode` · _auto_

ᚠᚢᚦᚨᚱᚲ → futhark. ᚦ = th, ᛜ = ng, ᛇ = ï; the separator dots ᛫ become spaces. Also reads some Younger Futhark runes.

- Inputs: input
- Parameters:
  - Case — options: **abc**, ABC

#### Latin → runes (Elder Futhark) `runes_encode`

th → ᚦ, ng → ᛜ, c/q → ᚲ, v → ᚢ, y → ᛃ, x → ᚲᛊ. Other characters are kept.

- Inputs: input

#### Braille (⠁⠃⠉) → Latin `braille_decode` · _auto_

Unicode U+2800… cells into English or Russian Braille letters (the “Table” parameter). The number sign ⠼ turns following a–j into digits 1–0, ⠠ makes a capital. ⠓⠑⠇⠇⠕ → hello.

- Inputs: input
- Parameters:
  - Braille table — options: **English**, Russian

#### Latin → Braille `braille_encode`

Letters (English or Russian, by table), digits (with the number sign ⠼), capitals (⠠) and simple punctuation into Braille cells.

- Inputs: input
- Parameters:
  - Braille table — options: **English**, Russian

#### Greek letters ↔ Latin `greek_translit` · _auto_

Letter-by-letter transliteration: α → a, β → b, θ → th, φ → ph, χ → ch, ψ → ps, ω → o. Accents and capitals are handled, other characters stay.

- Inputs: input
- Parameters:
  - Direction — options: **Greek → Latin**, Latin → Greek

#### Phonetic alphabet → letters `phonetic_decode` · _auto_

Alfa Bravo Charlie… (NATO) and Able Baker Charlie… (US, 1940s) → letters; digit words (zero…niner) → digits; “/” is a space.

- Inputs: input
- Parameters:
  - Case — options: **ABC**, abc
  - Unknown word — options: **Error**, Skip, First letter

#### Letters → phonetic alphabet `phonetic_encode`

A→Alfa/Able, B→Bravo/Baker … A space becomes “/”. Digits are written as words.

- Inputs: input
- Parameters:
  - Alphabet — options: **NATO / ICAO**, Able Baker (US 1941–56)

#### EBCDIC (cp037) → text `ebcdic_decode` · _auto_

IBM EBCDIC (cp037) bytes to text: C8 85 93 93 96 → Hello. The input is bytes (e.g. after “HEX → bytes”).

- Inputs: input

#### Text → EBCDIC (cp037) `ebcdic_encode`

- Inputs: input

#### Octal codes → bytes `octal_decode` · _auto_

101 102 103 or \101\102\103 → ABC. Without separators it splits into groups of 3 digits.

- Inputs: input

#### Text → octal codes `octal_encode`

- Inputs: input
- Parameters:
  - Separator — default: ``

#### Base91 → bytes `base91_decode`

basE91 (Joachim Henke): 91 printable characters, denser than Base64. fPNKd → test.

- Inputs: input

#### Text → Base91 `base91_encode`

- Inputs: input

#### uudecode → bytes `uudecode` · _auto_

Unix-to-Unix format: lines start with a length character; begin/end lines are ignored. #0V%T → Cat.

- Inputs: input

#### Text → uuencode `uuencode`

- Inputs: input
- Parameters:
  - begin / end lines — default: on

#### Quoted-printable → text `qp_decode` · _auto_

Mail encoding: =D0=9F → bytes; a trailing “=” is a soft line break.

- Inputs: input
- Parameters:
  - Encoding — options: **UTF-8**, CP1251 (Windows), KOI8-R, Raw bytes

#### Text → quoted-printable `qp_encode`

- Inputs: input
- Parameters:
  - Encoding — options: **UTF-8**, CP1251 (Windows)

#### Punycode → Unicode `punycode_decode` · _auto_

xn--mnchen-3ya → münchen. If the string has no “xn--”, it is read whole as raw Punycode (bcher-kva → bücher).

- Inputs: input

#### Unicode → Punycode `punycode_encode`

- Inputs: input
- Parameters:
  - xn-- prefix (domain) — default: on

#### Binary → pixel grid `binary_pixels`

Rows of 0 and 1 are drawn with characters: 1 = █, 0 = space. Width 0 uses the input lines or the square root (QR-like grids). Reading a QR from an image is done in the images tools.

- Inputs: input
- Parameters:
  - Row width (0 = auto) — default: `0`
  - Character for 1 — default: `█`
  - Character for 0 — default: ``
  - Horizontal repeat — default: `2`
  - Invert — default: off

#### OpenSSL “Salted__”: inspect envelope `openssl_inspect`

Detects whether the input is an “openssl enc” result (U2FsdGVkX1… in Base64): size, salt, ciphertext length and which ciphers are possible. It decrypts nothing and does not guess the password.

- Inputs: input

#### Decompress zlib / gzip / deflate `decompress` · _auto_

Decompresses compressed bytes: gzip (1F 8B), zlib (78 9C, 78 DA…) and raw deflate. “Auto” picks the format by the header; raw deflate only if the stream fills the whole input. Adler-32 (zlib) and CRC-32 with the length (gzip) are checked. The input is a byte string (after Base64, HEX, XOR) or a file; the output is bytes (then Bytes → text or Bytes → file). The result size is limited.

- Inputs: input
- Parameters:
  - Format — options: **Auto (by the header)**, zlib, gzip, raw deflate
  - Result limit, MB — default: `16`
  - Strict (error instead of a warning) — default: off

### Operations (function nodes) · Shifts

#### Character code shift `char_shift` · _auto_

Add N to the code of every character (T09XS<<cK1! with N=23 → kGPojSSzbH8).

- Inputs: input
- Parameters:
  - Shift N — default: `1`
  - Overflow — options: **No wrap**, Modulo 256, Printable ASCII (95)

#### Caesar `caesar` · _auto_

Shifts letters along the alphabet. For Cyrillic you can pick 33 letters with Ё, 32 without it, or Ukrainian.

- Inputs: input
- Parameters:
  - Alphabet — options: **Auto (Latin + Cyrillic)**, Latin (26), Cyrillic with Ё (33), Cyrillic without Ё (32), Ukrainian (33), Ukrainian without Ґ (32)
  - Shift — default: `3`

#### ROT47 `rot47` · _auto_

- Inputs: input

#### Atbash `atbash` · _auto_

Mirrored alphabet: A↔Z, А↔Я.

- Inputs: input
- Parameters:
  - Alphabet — options: **Auto (Latin + Cyrillic)**, Latin (26), Cyrillic with Ё (33), Cyrillic without Ё (32), Ukrainian (33), Ukrainian without Ґ (32)

#### Affine (decryption) `affine` · _auto_

x = a⁻¹·(y − b) mod m. a must be coprime with the alphabet length.

- Inputs: input
- Parameters:
  - Alphabet — options: **Auto (Latin + Cyrillic)**, Latin (26), Cyrillic with Ё (33), Cyrillic without Ё (32), Ukrainian (33), Ukrainian without Ґ (32)
  - a — default: `5`
  - b — default: `8`

#### Simple substitution `substitute`

Every character of “From” is replaced by the character at the same position in “To”.

- Inputs: input
- Parameters:
  - From — default: `abcdefghijklmnopqrstuvwxyz`
  - To — default: `zyxwvutsrqponmlkjihgfedcba`
  - Respect case — default: on

#### Keyed Caesar `keyed_caesar`

Cipher alphabet = keyword + the remaining letters, then shifted by N. ZEBRAS, N=0: HELLO → DAIIL (decrypt is the reverse).

- Inputs: input, keyword
- Parameters:
  - Keyword — default: `ZEBRAS`
  - Shift N — default: `0`
  - Alphabet — options: **Latin (26)**, Cyrillic with Ё (33), Cyrillic without Ё (32)
  - Mode — options: **Decrypt**, Encrypt

#### ROT5 `rot5`

Digits are shifted by 5 (0↔5, 1↔6 …), everything else is unchanged. It is its own inverse.

- Inputs: input

#### ROT18 `rot18`

ROT13 for Latin letters and ROT5 for digits at once.

- Inputs: input

#### ROT8000 `rot8000` · _auto_

“ROT13 for Unicode”: BMP characters rotate by half of the valid list (A → 籊). Whitespace, controls and non-BMP emoji are unchanged. It is its own inverse.

- Inputs: input

### Operations (function nodes) · Keyed ciphers

#### Vigenère `vigenere` · _auto_

A polyalphabetic cipher with a key word. The key can be fed to the second input. Example: h2njbrLB5kj + yfqlbvtyz → j2itqqQI5mk.

- Inputs: input, key
- Parameters:
  - Key — default: `key`
  - Mode — options: **Decrypt**, Encrypt
  - Alphabet — options: **Auto (Latin + Cyrillic)**, Latin (26), Cyrillic with Ё (33), Cyrillic without Ё (32), Ukrainian (33), Ukrainian without Ґ (32)
  - Digits and punctuation do not use up the key — default: on

#### Beaufort `beaufort` · _auto_

P = K − C (symmetric: encryption equals decryption).

- Inputs: input, key
- Parameters:
  - Key — default: `key`
  - Alphabet — options: **Auto (Latin + Cyrillic)**, Latin (26), Cyrillic with Ё (33), Cyrillic without Ё (32), Ukrainian (33), Ukrainian without Ґ (32)
  - Digits and punctuation do not use up the key — default: on

#### Autokey (Vigenère) `autokey` · _auto_

After the key it continues with the already decrypted text.

- Inputs: input, key
- Parameters:
  - Key — default: `key`
  - Alphabet — options: **Auto (Latin + Cyrillic)**, Latin (26), Cyrillic with Ё (33), Cyrillic without Ё (32), Ukrainian (33), Ukrainian without Ґ (32)

#### XOR with a key `xor` · _auto_

Byte-wise XOR. The key is a number, hex (“1f 2a”) or text. “Auto” reads a byte string as is (after HEX/Base64), otherwise UTF-8.

- Inputs: input, key
- Parameters:
  - Key — default: `1`
  - Key format — options: **Number**, Text, HEX
  - Read input as — options: **Auto (bytes if all ≤ 255, otherwise UTF-8)**, UTF-8, Bytes as is
  - Strict (error instead of a warning) — default: off

#### RC4 (raw stream) `rc4`

Plain RC4: the key is text (UTF-8) or HEX, with no salt and no EVP_BytesToKey; encryption equals decryption. “Drop” is RC4-drop[N] (the first N stream bytes). Files from “openssl enc -rc4” with Salted__ need the OpenSSL node. The output is bytes (then Bytes → text or HEX).

- Inputs: input, key
- Parameters:
  - Key
  - Key format — options: **Text**, HEX
  - Drop stream bytes — default: `0`
  - Read input as — options: **Auto (bytes if all ≤ 255, otherwise UTF-8)**, UTF-8, Bytes as is
  - Strict (error instead of a warning) — default: off

#### Enigma `enigma`

An Enigma I/M3 and M4 model: rotors I–VIII (Beta/Gamma on M4), reflectors A/B/C and thin B/C, rings, start positions, plugboard (“AB CD EF”) and the middle rotor double step. Encryption = decryption. Non-letters pass through without stepping (the machine has no such keys). Settings come from the puzzle context; Auto does not search Enigma.

- Inputs: input
- Parameters:
  - Model — options: **Enigma I / M3**, Enigma M4
  - Rotors (left to right) — default: `I II III`
  - Reflector — options: **B**, C, A, B thin (M4), C thin (M4)
  - Rings (AAA or 1 1 1) — default: `AAA`
  - Start positions — default: `AAA`
  - Plugboard (pairs)

#### Bifid `bifid`

Polybius square + coordinate fractionation (Delastelle). Wikipedia: key BGWKZQPNDSIOAXEFCLUMTHYVR, FLEEATONCE → UAEOLWRINS. Key is a word or the full square; J=I.

- Inputs: input, key
- Parameters:
  - Square key
  - Square — options: **5×5 (J=I)**, 6×6 (A–Z, 0–9)
  - Period (0 = whole message) — default: `0`
  - Mode — options: **Decrypt**, Encrypt
  - Group size (0 = none) — default: `0`

#### Trifid `trifid`

A 3×3×3 cube (26 letters and “+”), coordinates fractionated per period. Wikipedia: key FELIXMARDSTBCGHJKNOPQUVWYZ+, period 5, AIDETOILECIELTAIDERA → FMJFVOISSUFTFPUFEQQC.

- Inputs: input, key
- Parameters:
  - Key (27 symbols or a word)
  - Period (0 = whole message) — default: `5`
  - Mode — options: **Decrypt**, Encrypt
  - Group size (0 = none) — default: `0`

#### ADFGX `adfgx`

Square substitution into the letters ADFGX, then columnar transposition by a keyword. 5×5 square, J=I.

- Inputs: input, transposition key
- Parameters:
  - Square (word or full)
  - Transposition key — default: `KEY`
  - Mode — options: **Decrypt**, Encrypt
  - Group size (0 = none) — default: `0`

#### ADFGVX `adfgvx`

Square substitution into the letters ADFGVX, then columnar transposition by a keyword. Wikipedia: square NA1C3H8TB2OME5WRPD4F6G7I9J0KLQSUVXYZ, key PRIVACY, ATTACKAT1200AM → DGDDDAGDDGAFADDFDADVDVFAADVX.

- Inputs: input, transposition key
- Parameters:
  - Square (word or full)
  - Transposition key — default: `KEY`
  - Mode — options: **Decrypt**, Encrypt
  - Group size (0 = none) — default: `0`

#### Four-square `four_square`

Digraphs through two keyed squares (top-right and bottom-left); the other two are the plain alphabet. Wikipedia: keys EXAMPLE/KEYWORD, HE → FY.

- Inputs: input
- Parameters:
  - Key 1 (top-right) — default: `EXAMPLE`
  - Key 2 (bottom-left) — default: `KEYWORD`
  - Mode — options: **Decrypt**, Encrypt
  - Group size (0 = none) — default: `0`

#### Two-square `two_square`

Double Playfair: the first letter of a digraph is looked up in square 1, the second in square 2; the ciphertext is taken from the other rectangle corners.

- Inputs: input
- Parameters:
  - Key 1 (left/top) — default: `EXAMPLE`
  - Key 2 (right/bottom) — default: `KEYWORD`
  - Layout — options: **Horizontal**, Vertical
  - Mode — options: **Decrypt**, Encrypt
  - Group size (0 = none) — default: `0`

#### Nihilist `nihilist`

A Polybius square gives two-digit numbers (row·10+column) and the key numbers are added. Wikipedia: square ZEBRAS, key RUSSIAN: D→23 + R→14 = 37.

- Inputs: input, key
- Parameters:
  - Square (word) — default: `ZEBRAS`
  - Key — default: `RUSSIAN`
  - Mode — options: **Decrypt**, Encrypt

#### Variant Beaufort `beaufort_variant`

Decrypt: P = C + K (mod 26); encrypt: C = P − K. I.e. Vigenère with a negated key. Example: PRW QV RZXI + ENDERMITE → TEZ UM DHQM. Classic Beaufort (P = K − C) is a separate operation.

- Inputs: input, key
- Parameters:
  - Key — default: `KEY`
  - Mode — options: **Decrypt**, Encrypt
  - Alphabet — options: **Auto (Latin + Cyrillic)**, Latin (26), Cyrillic with Ё (33), Cyrillic without Ё (32), Ukrainian (33), Ukrainian without Ґ (32)
  - Digits and symbols do not use the key — default: on

#### Vigenère / Beaufort / Variant `vigenere_family`

The same text and key in three ways at once: Vigenère (P = C − K), Beaufort (P = K − C), Variant Beaufort (P = C + K). Handy when you do not know which one is needed.

- Inputs: input, key
- Parameters:
  - Key — default: `KEY`
  - Mode — options: **Decrypt**, Encrypt
  - Alphabet — options: **Auto (Latin + Cyrillic)**, Latin (26), Cyrillic with Ё (33), Cyrillic without Ё (32), Ukrainian (33), Ukrainian without Ґ (32)
  - Digits and symbols do not use the key — default: on

#### Porta `porta`

A reciprocal cipher: the key letter selects one of 13 tableaux (pairs AB, CD, …). Encryption equals decryption. HELLO + KEY → PPZTD.

- Inputs: input, key
- Parameters:
  - Key — default: `KEY`
  - Alphabet — options: **Latin (26)**, Cyrillic without Ё (32)
  - Digits and symbols do not use the key — default: on

#### Running-key Vigenère `running_key`

The key is a long text (second input, e.g. a book page) at least as long as the message. Key letters are used in order; spaces and symbols are skipped.

- Inputs: input, key text
- Parameters:
  - Key text
  - Family — options: **Vigenère**, Beaufort, Variant Beaufort
  - Key start offset (letters) — default: `0`
  - Mode — options: **Decrypt**, Encrypt
  - Alphabet — options: **Auto (Latin + Cyrillic)**, Latin (26), Cyrillic with Ё (33), Cyrillic without Ё (32), Ukrainian (33), Ukrainian without Ґ (32)

#### Hill 2×2 / 3×3 `hill`

Blocks of 2 or 3 letters are multiplied by the key matrix mod 26. Key: 4/9 letters or numbers. Wikipedia: GYBNQKURP, ACT → POH; numbers 3 3 2 5, HELP → HIAT. Latin A–Z only.

- Inputs: input, key
- Parameters:
  - Key (letters or numbers) — default: `GYBNQKURP`
  - Mode — options: **Decrypt**, Encrypt

#### Chaocipher `chaocipher`

A dynamic cipher with two disks (left/right). Wikipedia: left HXUCZVAMDSLKPEFJRIGTWOBNYQ, right PTLNBQDEOYSFAVZKGJRIHWXUMC, WELLDONEISBETTERTHANWELLSAID → OAHQHCNYNXTSZJRRHJBYHQKSOUJY.

- Inputs: input
- Parameters:
  - Left disk (26 letters) — default: `HXUCZVAMDSLKPEFJRIGTWOBNYQ`
  - Right disk (26 letters) — default: `PTLNBQDEOYSFAVZKGJRIHWXUMC`
  - Mode — options: **Decrypt**, Encrypt
  - Group size (0 = none) — default: `0`

#### XOR keeping spaces/punctuation `xor_keep` · _auto_

XORs only the characters that are not covered by the “keep as is” rule (spaces, punctuation, non-letters). You can choose whether kept characters consume a key position.

- Inputs: input, key
- Parameters:
  - Key — default: `23`
  - Key format — options: **Number**, Text, HEX
  - Keep as is — options: Whitespace, **Spaces and punctuation**, Spaces, dots and commas (for bytes), Everything except letters, Nothing
  - Kept characters advance the key — default: off
  - Strict (error instead of a warning) — default: off

#### OpenSSL enc: decrypt with password `openssl_decrypt`

For “openssl enc -md md5” (default in openssl ≤ 1.0.x): key and IV = EVP_BytesToKey(MD5, salt, password). AES-CBC/ECB/CTR and RC4. Without a password, or with a wrong one, it raises an error instead of garbage. PBKDF2 (-pbkdf2) is not supported.

- Inputs: input, password
- Parameters:
  - Password
  - Cipher — options: **AES-256-CBC**, AES-192-CBC, AES-128-CBC, AES-256-ECB, AES-128-ECB, AES-256-CTR, AES-128-CTR, RC4 (128 bit)

### Operations (function nodes) · ARG & Minecraft

#### Enchanting table → text `sga_decode` · _auto_

Standard Galactic Alphabet from Minecraft: ᔑʖᓵ↸ᒷ → abcde. A simple letter-to-glyph substitution; the alphabet does not encode case.

- Inputs: input

#### Text → enchanting table `sga_encode`

- Inputs: input

#### Polybius square `polybius` · _auto_

Digit pairs “row-column” → letters. 5×5 (I=J), 6×6 for Cyrillic. A key word is optional.

- Inputs: input
- Parameters:
  - Square — options: **Latin 5×5 (I=J)**, Tap code 5×5 (K=C), Cyrillic 6×6
  - Key word (optional)
  - Column first — default: off

#### Tap code (knocks) `tap_code` · _auto_

Knock groups: “.. ...  . ....”. Each pair of groups is a row and a column of the 5×5 square (K=C). An unpaired last group gives a warning (an error in strict mode).

- Inputs: input
- Parameters:
  - Square — options: **Latin (K=C)**, Cyrillic 6×6
  - Strict (error instead of a warning) — default: off

#### Bacon cipher `bacon` · _auto_

Groups of 5 symbols A/B (or 0/1, or letter case: lower=A, upper=B) → letters. An incomplete tail is dropped with a warning (an error in strict mode).

- Inputs: input
- Parameters:
  - Alphabet — options: **26 letters**, 24 letters (I=J, U=V)
  - What counts as A/B — options: **Auto**, Letters A/B, 0 and 1, Letter case
  - Strict (error instead of a warning) — default: off

#### Phone: key presses → letters `t9` · _auto_

Multitap “44 33 555 555 666” → hello or “key-position” pairs “4-2”. DTMF tones often lead here.

- Inputs: input
- Parameters:
  - Layout — options: **Latin**, Cyrillic
  - Notation — options: **Repeats (44 33 555)**, Key and position (42 = h)

#### Playfair (decryption) `playfair` · _auto_

A digraph cipher on a 5×5 square with a key word (I=J).

- Inputs: input, key
- Parameters:
  - Key — default: `playfair`

#### Leet → letters `leet` · _auto_

1NF3C7ED → INFECTED. Digits and symbols inside words are replaced by look-alike letters.

- Inputs: input

#### Keyboard shift `keyboard_shift` · _auto_

Every key is replaced by its neighbour in the same row: shift −1 turns “jr;;p” into “hello”.

- Inputs: input
- Parameters:
  - Shift (− left, + right) — default: `-1`

#### Strip Minecraft colour codes `mc_format` · _auto_

§a, §l, &c etc. are formatting codes in books, signs and chat. Remove them or keep only the codes.

- Inputs: input
- Parameters:
  - Mode — options: **Remove codes**, Keep only the codes
  - Treat “&” as a code (like plugins do) — default: off

### Operations (function nodes) · Hidden

#### Look-alike letters (Cyr ↔ Lat) `homoglyph` · _auto_

Cyrillic А, Е, О, Р, С… may hide in “Latin” text. Replace them or extract bits: Latin = 0, Cyrillic = 1.

- Inputs: input
- Parameters:
  - Mode — options: **Cyrillic look-alikes → Latin**, Latin look-alikes → Cyrillic, Bits: Lat = 0, Cyr = 1, Highlight: Cyrillic in [brackets]

#### Zero-width characters `zero_width` · _auto_

Invisible U+200B/200C/200D/FEFF in descriptions. Show them, remove them or turn them into bits.

- Inputs: input
- Parameters:
  - Mode — options: **Bits: 200B = 0, 200C = 1**, Bits: 200C = 0, 200D = 1, Show as marks, Remove

#### Letters from words (acrostic) `acrostic` · _auto_

The N-th letter of each word or line: first letters, last letters, only capitals.

- Inputs: input
- Parameters:
  - Which letter (1 = first, −1 = last) — default: `1`
  - Take from — options: **Each word**, Each line, Capital letters of the text only

#### Book cipher (numbers → words) `book_cipher`

Numbers point to words (or letters, lines) in the second input. “3:5” means line 3, word 5.

- Inputs: numbers, book text
- Parameters:
  - A number points to — options: **A word**, The first letter of a word, A letter of the text, A line
  - Exact layout — options: **off: whitespace collapses**, characters as is (spaces and line breaks count), words split on a single space (empty fields count)
  - First number — options: **1**, 0
  - Book text (if no input is connected)

#### Russian in Latin letters and digits → Cyrillic `ru_leet` · _auto_

Latin letters and digits used to write Russian: by sound (N3 → не, S → с) or by look (N → И, 3 → З).

- Inputs: input
- Parameters:
  - How to replace — options: **By sound (t → т, 3 → е)**, By look (N → И, R → Я)

#### Letter case → bits `case_bits` · _auto_

Letter case as a bit stream (upper = 1, lower = 0 or the inverse), without requiring the Bacon cipher. The result is bits, bytes of 8 or 7 bits, or letters of 5 bits.

- Inputs: input
- Parameters:
  - Uppercase = — options: **1**, 0
  - Output — options: **Bits (a 0/1 string)**, Text from 8 bits, Text from 7 bits, Letters A–Z from 5 bits (Bacon)
  - Strict (error instead of a warning) — default: off

### Operations (function nodes) · Permutations

#### Rail fence `rail_fence` · _auto_

- Inputs: input
- Parameters:
  - Rails — default: `3`
  - Mode — options: **Decrypt**, Encrypt

#### Grid: rows ↔ columns `transpose` · _auto_

Write the text in rows of W characters and read it by columns (and back).

- Inputs: input
- Parameters:
  - Width W — default: `7`
  - Read — options: **By columns**, Back (from columns)

#### Swap adjacent characters `swap_pairs`

abcd → badc. Useful for hex with swapped nibbles.

- Inputs: input

#### Columnar transposition by key `columnar` · _auto_

The text is written in rows under the key; columns are read in the alphabetical order of the key letters.

- Inputs: input, key
- Parameters:
  - Key — default: `zebras`
  - Mode — options: **Decrypt**, Encrypt

#### Grid: rotate and flip `grid_rotate` · _auto_

The text is laid out in a grid of width W and rotated (as in the Dungeons II ARG: a 15×6 grid, a 90° turn). Line breaks (LF, CRLF, CR) do not enter the grid.

- Inputs: input
- Parameters:
  - Width W — default: `15`
  - Action — options: **Rotate 90° counter-clockwise**, Rotate 90° clockwise, Rotate 180°, Flip left–right, Flip top–bottom
  - Output as lines — default: off

#### Fragment permutations `permute_fragments`

Tries the orders of a small number of fragments (up to 8) and keeps only those matching the constraints: start, end, substring, length, a regular expression or “looks like a service ID/link”. One result per line.

- Inputs: input
- Parameters:
  - Fragment separator (empty = spaces/newlines/commas)
  - Join with
  - Must start with
  - Must end with
  - Must contain
  - Result length (0 = any) — default: `0`
  - Regular expression (optional)
  - Only service-ID-like results — default: off
  - Maximum results — default: `200`

#### Scytale `scytale`

A strip wound on a rod: the text is written in rows around the rod and read by columns. “IAMHURTVERYBADLYHELP”, 4 letters around → IRYYATBHMVAEHEDLURLP.

- Inputs: input
- Parameters:
  - Letters around the rod — default: `4`
  - Remove whitespace — default: on
  - Mode — options: **Decrypt**, Encrypt

#### Route cipher `route_cipher`

The text is written into a grid by rows and read along a route: spiral, snake, columns. ABCDEFGHI (3 columns), clockwise spiral from the top-left → ABCFIHGDE. Decryption applies the route backwards.

- Inputs: input
- Parameters:
  - Grid columns — default: `3`
  - Route — options: **Spiral clockwise**, Spiral counter-clockwise, Snake by rows, Snake by columns, By columns, By rows
  - Start corner — options: **Top-left**, Top-right, Bottom-left, Bottom-right
  - Reversed (inside-out) — default: off
  - Padding for a short last row — default: `X`
  - Remove whitespace — default: on
  - Mode — options: **Decrypt**, Encrypt

#### Myszkowski transposition `myszkowski`

Columnar transposition where repeated key letters form one group of columns. Wikipedia: key TOMATO, WEAREDISCOVEREDFLEEATONCE → ROFOACDTEDSEEEACWEIVRLENE.

- Inputs: input, key
- Parameters:
  - Keyword — default: `TOMATO`
  - Remove whitespace — default: on
  - Mode — options: **Decrypt**, Encrypt
  - Group size (0 = none) — default: `0`

### Operations (function nodes) · Text

#### Reverse `reverse` · _auto_

Reverse the whole string, each word or groups of N characters.

- Inputs: input
- Parameters:
  - What to reverse — options: **The whole string**, Each word, Each line, Groups of N
  - N (for groups) — default: `2`

#### Keyboard layout `layout` · _auto_

The same keys in another layout: yfqlbvtyz ↔ найдименя.

- Inputs: input
- Parameters:
  - Direction — options: **EN → RU (ghbdtn → привет)**, RU → EN, EN → UK (ghbdsn → привіт), UK → EN

#### Transliteration `translit` · _auto_

- Inputs: input
- Parameters:
  - Direction — options: **Cyrillic → Latin**, Latin → Cyrillic

#### Letter case `case`

- Inputs: input
- Parameters:
  - Mode — options: ALL CAPITALS, **all lowercase**, iNVERT

#### Keep / remove characters `filter`

Letters of any alphabet (including Ukrainian ґ є і ї), digits, spaces or removal by regex.

- Inputs: input
- Parameters:
  - Mode — options: Letters only, Letters and digits, Digits only, **Remove whitespace**, Remove by regex
  - Regex — default: `[^A-Za-z]`

#### Whitespace preparation `ws_prep` · _auto_

Explicit text-preparation variants: trim the edges, normalise line breaks to LF, collapse repeats, remove all spaces or only line breaks. Zero-width characters are left alone (they have their own node).

- Inputs: input
- Parameters:
  - Variant — options: Trim the edges, Line breaks → LF (CRLF/CR), Collapse repeated spaces, **Remove all whitespace**, Remove line breaks only

#### Find and replace `replace`

- Inputs: input
- Parameters:
  - Find
  - Replace with
  - Is a regex — default: off

#### Part of the string `slice`

Characters from “From” to “To” (1-based), with a step. Step 2 means every second character.

- Inputs: input
- Parameters:
  - From — default: `1`
  - To (0 = end) — default: `0`
  - Step — default: `1`

#### Split into groups `chunk`

- Inputs: input
- Parameters:
  - N characters each — default: `2`
  - Separator — default: ``

#### Anagram solver `anagram_solve`

Looks for words (and pairs/triples of words) that use all input letters, from the built-in frequent-word list. Short strings only (up to 16 letters).

- Inputs: input
- Parameters:
  - Word list — options: **Auto**, English, Русский
  - Max words — default: `2`
  - Min word length — default: `2`
  - Results to show — default: `30`

#### Pick letters (positions, UPPERCASE, mark) `pick_letters`

Extracts characters by a position list (1,3,5-8,-1) in the whole text / each word / each line; only UPPERCASE letters or digits; those enclosed in a mark (*x*, [x]); those right after or before a mark.

- Inputs: input
- Parameters:
  - What to pick — options: **By positions**, Only UPPERCASE, Only digits, Inside a mark, After a mark, Before a mark
  - Positions — default: `1`
  - First position = — default: `1`
  - Scope — options: **Whole text**, Each word, Each line
  - Count — options: **Letters and digits**, All non-space characters
  - Mark (e.g. “[\|]” or “*”) — default: `*`
  - Join with

#### Callsigns by alphabet (Able…Jig / NATO) `callsign_order`

Lines like “Charlie 3”, “Able 7”, “Baker-2” are sorted by phonetic word order (Able, Baker, Charlie… or Alfa, Bravo, Charlie…) and the trailing numbers are concatenated.

- Inputs: input
- Parameters:
  - Output — options: **Concatenated numbers**, Sorted lines, Lines and numbers

#### Calculator (exact arithmetic) `calc`

Whole numbers with no rounding: + − × ÷ % ^ and parentheses. The “prime factors” mode shows the factorisation, for example that 509, 503 and 3301 are prime and their product is 845145127.

- Inputs: input
- Parameters:
  - Show — options: **value**, prime factors

### Operations (function nodes) · Join

#### Join `join`

Join two inputs: gluing fragments such as AgL + L2GD + LrgQ.

- Inputs: A, B
- Parameters:
  - Separator

#### Join 3 `join3`

- Inputs: A, B, C
- Parameters:
  - Separator

#### Interleave `interleave`

A1 B1 A2 B2 …

- Inputs: A, B

#### Split and take a part `split_take`

With no separator it splits on line breaks (LF, CRLF and CR are treated alike).

- Inputs: input
- Parameters:
  - Separator (empty = line break)
  - Part number (from 1) — default: `1`

#### Overlay: fill # from the second text `overlay_fill`

Placeholders in A (default #) are replaced with characters from B: in turn or at the same position. “H#LL#” + “EO” → HELLO.

- Inputs: template A, text B
- Parameters:
  - Placeholder — default: `#`
  - Take from B — options: **In turn**, Same position
  - Text B (if not connected)

#### Parts by line: own transformations `segment_map`

Each input line goes through its own chain of operations (the plan is JSON: one item per line, null keeps the line); line breaks are kept. This is how the auto search records compound messages.

- Inputs: input
- Parameters:
  - Plan (JSON) — default: `[]`

### Operations (function nodes) · Hashes

#### Hash MD5 `hash_md5`

MD5 (128 bits). Not secure, yet common for “hidden” answers in ARGs. For an artifact input its bytes are hashed. Choose the byte encoding explicitly.

- Inputs: input
- Parameters:
  - Text encoding — options: **UTF-8**, CP1251 (Windows), Raw bytes (latin1)
  - Trim surrounding whitespace — default: off
  - Uppercase hex — default: off

#### Hash SHA-1 `hash_sha1`

SHA-1 (160 bits) of text or a file. Choose the byte encoding explicitly.

- Inputs: input
- Parameters:
  - Text encoding — options: **UTF-8**, CP1251 (Windows), Raw bytes (latin1)
  - Trim surrounding whitespace — default: off
  - Uppercase hex — default: off

#### Hash SHA-256 `hash_sha256`

SHA-256 (256 bits) of text or a file. Choose the byte encoding explicitly.

- Inputs: input
- Parameters:
  - Text encoding — options: **UTF-8**, CP1251 (Windows), Raw bytes (latin1)
  - Trim surrounding whitespace — default: off
  - Uppercase hex — default: off

#### Hash SHA-512 `hash_sha512`

SHA-512 (512 bits) of text or a file. Choose the byte encoding explicitly.

- Inputs: input
- Parameters:
  - Text encoding — options: **UTF-8**, CP1251 (Windows), Raw bytes (latin1)
  - Trim surrounding whitespace — default: off
  - Uppercase hex — default: off

#### Hash CRC32 `hash_crc32`

CRC32 (32-bit checksum of zip/png) of text or a file. Choose the byte encoding explicitly.

- Inputs: input
- Parameters:
  - Text encoding — options: **UTF-8**, CP1251 (Windows), Raw bytes (latin1)
  - Trim surrounding whitespace — default: off
  - Uppercase hex — default: off

#### All hashes `hash_all`

MD5, SHA-1, SHA-256, SHA-512 and CRC32 in one table.

- Inputs: input
- Parameters:
  - Text encoding — options: **UTF-8**, CP1251 (Windows), Raw bytes (latin1)
  - Trim surrounding whitespace — default: off
  - Uppercase hex — default: off

#### Hash check `hash_check`

Does the hash of the candidate(s) (one per line) equal the given digest? The algorithm is detected by length: 8=CRC32, 32=MD5, 40=SHA-1, 64=SHA-256, 128=SHA-512. The digest comes from the second input or the parameter.

- Inputs: candidates, digest
- Parameters:
  - Digest (when the second input is unused)
  - Algorithm — options: **By length**, MD5, SHA-1, SHA-256, SHA-512, CRC32
  - Text encoding — options: **UTF-8**, CP1251 (Windows), Raw bytes (latin1)
  - Each line is a separate candidate — default: on
  - Also try without surrounding whitespace — default: on
  - Output — options: **Report**, Matching candidate (or an error)

#### What kind of hash? `hash_identify`

Explains what a hex/Base64 string could be by its length: MD5, NTLM, SHA-1… or just a token. Hashes are verified with a candidate, not decrypted.

- Inputs: input

## Examples

Open any example from the **Examples** menu or with a link such as `http://127.0.0.1:8765/?preset=ID`. Each opens on its own board with a step-by-step guide.

### 

- **Start: paste a cipher** · `welcome` — Input → auto-decrypt → result<br>answer: `Hello world`

### mslan case: solved stages

- **Samsara: Vigenère** · `vigenere` — h2njbrLB5kj + a key from the keyboard layout “найдименя”<br>answer: `j2itqqQI5mk`
- **839: HEX → +23** · `hex23` — 54303958533C3C634B3121 → kGPojSSzbH8<br>answer: `kGPojSSzbH8`
- **КТО ТЫ?: numbers → URL → CP1251** · `ktoty` — Digit pairs +23, then %-decoding<br>answer: `КТО ТЫ?`
- **A link from numbers** · `catbox` — 8193… → https://files.catbox.moe/1gukbv.png<br>answer: `https://files.catbox.moe/1gukbv.png`
- **A Google Drive link from HEX** · `drive` — 31 6E 7A 47 … → folder ID<br>answer: `1nzGhNHVEQHbi6APzUU6BeGpz427SMubm`
- **ПомогиНам: Base64 → reverse → Caesar** · `pomogi` — A technique from another (solved) video<br>answer: `ПомогиНам`
- **Forever: mask brute force** · `mask` — ?y?xPVyp8H0 — 4096 variants through YouTube<br>manual: A mask with two gaps is solved with riddle answers and a YouTube check: an external service is needed.
- **The book (unsolved)** · `book` — PSRLVMBHALDPRNG / CRBLQYCURKUZD<br>manual: Unsolved: there is no confirmed answer and auto must not invent one.
- **VOID: HEX → +23** · `void` — 3F38322D → ?82- → VOID<br>answer: `VOID`
- **Reverse: КтоНибудь…** · `kto-reverse` — саНетисапС… → КтоНибудьПожалуйстаСпаситеНас<br>answer: `КтоНибудьПожалуйстаСпаситеНас`
- **Find me: joining fragments** · `fragments` — AgL + L2GD + LrgQ from the descriptions of three parts<br>manual: The three fragments come from the descriptions of different videos: joining them is a human decision, not a cipher.
- **A key from three parts** · `key-parts` — yfq + lbv + tyz → a Vigenère key (the order of parts can change)<br>manual: The key is assembled from three parts of different sources; a human picks the order.
- **Pairs +23 → CP1251 → Russian in Latin** · `ru-leet` — 9314454320… → “ты не спасешь нх”<br>answer: `тЫ Не СпАсешЬ НХ`
- **Pairs +23 → CP1251 → reverse** · `kira` — 1446251447… → %елТыъКира (with the author’s typos)<br>answer: `%елТыъКира`
- **goodbye.: a direct ID** · `direct` — sQjZoZ5abcw — check it without any transformation<br>answer: `sQjZoZ5abcw`

### Foreign ARGs

- **Dungeons II: hex in an address** · `dng-hex` — A link slug 0x7370696365776f6f64 → spicewood<br>answer: `spicewood`
- **Dungeons II: leet** · `dng-leet` — 1NF3C7ED → INFECTED (a note-block hint)<br>answer: `INFECTED`
- **Dungeons II: Z85 → hex → text** · `dng-z85` — A technique from Discord moderator profiles (a teaching string)<br>answer: `the silence echoes`
- **Dungeons II: grid rotation + Vigenère** · `dng-grid` — Grid, 90° counter-clockwise turn, then Vigenère EVERYSOUL (a teaching string)<br>answer: `FOLLOWTHESCULKTOTHEANCIENTCITY`
- **Dungeons II: hex + Vigenère** · `dng-hexvig` — Hex → text → Vigenère with a key from a previous puzzle (a teaching string)<br>answer: `the warden hears you`
- **Game Detectives: Base64** · `gd-b64` — Y3J5c3RhbGxpbmUgdHJ1dGhzIA== → crystalline truths<br>answer: `crystalline truths`

### Practice ciphers

- **Enchanting table (SGA)** · `sga` — A simple glyph substitution seen in Minecraft puzzles<br>answer: `the end is never the end`
- **Tap code (knocks)** · `tap` — Knocks in audio or flashing lamps → a 5×5 square<br>answer: `HEROBRINE`
- **DTMF / phone** · `t9` — Tones → digits → multitap<br>answer: `notch`
- **Bacon cipher** · `bacon` — A/B in groups of 5 (sometimes hidden in letter case)<br>answer: `NOTCH`
- **Polybius square** · `polybius` — “row-column” pairs<br>answer: `ENDERMAN`
- **Atbash** · `atbash` — A mirrored alphabet<br>answer: `wake up herobrine`
- **Cyrillic among Latin** · `homoglyph` — Look-alike letters as hidden bits<br>answer: `The quick brown fox jumps over the lazy dog`

### Universal examples

- **Numbers → letters modulo 26** · `numbers-mod` — 27 12 12 15 … → ALLOFTHEDOTS… (27 → A, 30 → D)<br>answer: `ALLOFTHEDOTSAREFINALLYSTARTINGTOCONNECT WHOKNEWDOLPHINSWEREHIDINGSOMUCH`
- **HEX → text** · `hex-plain` — 41414141 → AAAA<br>answer: `AAAA`
- **HEX inside a log** · `log-hex` — jimmyy1[local:E:73746f70] … → candidate 73746f70 → stop<br>answer: `stop`
- **Letter case as bits** · `case-bits` — Uppercase = 1, lowercase = 0 → binary → text<br>manual: The text is readable as is; the hidden channel (letter case) is invisible to a decoder: you have to suspect it.

### OldRoot

- **OldRoot: Caesar −3 (WE ARE WAITING)** · `or-caesar-waiting` — ZH DUH ZDLWLQJ → WE ARE WAITING<br>answer: `WE ARE WAITING`
- **OldRoot: Caesar −3 (whitelist application)** · `or-caesar-prison` — WUDSSHG LQ D SULVRQ RI ZRRG → TRAPPED IN A PRISON OF WOOD<br>answer: `TRAPPED IN A PRISON OF WOOD`
- **OldRoot: Vigenère LENORE (BEUORE/BEFORE discrepancy)** · `or-lenore` — The result differs from the write-up by one letter<br>answer: `YOU MUST LEARN THE PAST BEUORE THE FUTURE` · source discrepancy: BEUORE (computed) vs BEFORE (write-up)
- **OldRoot: the final code (A1Z26 modulo 26)** · `or-modular` — 27→A, 30→D; strict A1Z26 errors<br>answer: `ALLOFTHEDOTSAREFINALLYSTARTINGTOCONNECT WHOKNEWDOLPHINSWEREHIDINGSOMUCH`

### HERMatrix

- **HERMatrix: Vigenère LMVCCIKB + LUCY** · `hm-vigenere` — LMVCCIKB + LUCY → ASTEROID<br>answer: `ASTEROID`

### AlphaVer

- **AlphaVer: a hex-like token is NOT hex** · `av-token-not-hex` — 9b4c383a911ec: a hex→bytes error, and that is correct<br>manual: The token is typed into the in-game Input Block ID 120: a game action is required, there is nothing to decode.
- **AlphaVer: a variable name → Imgur ID** · `av-imgur` — imgur9F0A3un → 9F0A3un<br>answer: `9F0A3un` · manual: Splitting the imgur prefix from the ID is a human observation while reading decompiled code, not an operation on a ciphertext.

### Endermite / Jimmy

- **Endermite: ROT13 raqrezvgr** · `em-rot13` — raqrezvgr → endermite<br>answer: `endermite`
- **Endermite: hex → stop / AAAA** · `em-hex` — 73746f70 → stop; 41414141 → AAAA<br>answer: `stop`
- **Endermite: shift +8 = −18** · `em-shift-direction` — wfvwjealw → endermite<br>answer: `endermite`
- **Endermite: Vigenère ENDERMITE (not Variant Beaufort)** · `em-vigenere` — lrot dq xeiefh → help me please; PRW QV RZXI → LET ME FREE<br>answer: `help me please` · source discrepancy: source: Variant Beaufort; actual: Vigenère
- **Endermite: latest.log lines → candidates → hex** · `em-log` — 73746f70 and 41414141 are cut out of a longer log<br>answer: `stop`
- **Endermite: 14 video strings (unsolved)** · `em-frames-unsolved` — An honest open question: data without a known function<br>manual: Unsolved: the function of the strings and of PG56 is not established in the sources.

### Archive11

- **Archive11: hex → Gone / all** · `a11-hex` — 476F6E65 → Gone; 616C6C → all<br>answer: `Gone`

### Portal ARG

- **Portal: MD5 of the phone (425) 822-5251** · `pt-md5-phone` — Not decoding but verifying a candidate by hash<br>answer: `9459C6CAC8C203B8128B7CC63068D4FD` · manual: A hash cannot be reversed: the phone number is a hypothesis from another artifact and can only be verified by computing.
- **Portal: the “fox” MD5 does not match** · `pt-fox-md5` — 9E107D9D…BB6821BD91D… vs the MD5 of the standard pangram<br>answer: `9e107d9d372bb6826bd81d3542a419d6` · manual: A hash check, not a decryption. · source discrepancy: the claimed MD5 ≠ the computed one for the classic pangram

### Cicada 3301

- **Cicada 3301: character-code shift −4 (not Caesar)** · `cic-shift` — lxxt>33m2mqkyv2gsq3q=w]O2ntk → http://i.imgur.com/m9sYK.jpg<br>answer: `http://i.imgur.com/m9sYK.jpg`
- **Cicada 3301: 509 × 503 × 3301 = 845145127** · `cic-math` — Arithmetic and prime factors<br>answer: `845145127` · manual: The numbers come from the image dimensions and the phone clue, not from a ciphertext.

### Year Zero

- **Year Zero: a stage map (no ciphertext)** · `yz-plan` — Spectrogram → number → site; no ciphertext in the sources<br>manual: The sources give no exact ciphertext: the stages go through audio, video and physical media.

### Oxenfree

- **Oxenfree: Morse from the SMS** · `ox-morse` — GOOD WORK DL BB LISTEN CLOSE<br>answer: `good work dl bb listen close`
- **Oxenfree: decimal bytes from HTML** · `ox-decimal` — 108 101 97 … → leave possible<br>answer: `leave possible`
- **Oxenfree: anagram MILNER IS WARD (an extra I)** · `ox-anagram` — The anagram check shows an extra letter<br>manual: An anagram is checked against a known answer from the context; a search without a target gives many words. · source discrepancy: the letter set has an extra I

### Inscryption

- **Inscryption: a key from three parts joined with “\|”** · `in-meta-key` — MYCOLOG1ST12\|P3RHAPS??\|BLOOD$L3TT3R8OX → 918234489010\|8339344??\|8043!$702D!!$666<br>answer: `MYCOLOG1ST12` · manual: Each part is obtained by a separate game action; the clue cannot be decrypted by a formula.

### Sombra (Overwatch)

- **Sombra: Base64 → Salted__ (unsolved)** · `so-base64-salted` — Stop at the OpenSSL container, not a “magic decrypt”<br>manual: A binary OpenSSL container: it needs a password that the sources do not give. Auto must not claim an “answer”.
- **Sombra: binary dump → QR** · `sombra-qr` — Bit groups → grid rows → image → QR → a Spanish message<br>answer: `¿Estuvo eso facilito? Ahora que tengo su atención, déjenme se las pongo más difícil.` · manual: The geometry parameters are set by hand; the QR node reads the code

### Dr. Langeskov

- **Dr. Langeskov: bits → a document name** · `dl-binary` — 144 bits from page 4.html → elgar-INVOICE.html<br>answer: `elgar-INVOICE.html`
- **Dr. Langeskov: hex → a sound path** · `dl-hex` — 736f756e64… → sounds/boot.mp3<br>answer: `sounds/boot.mp3`
- **Dr. Langeskov: a short Base64** · `dl-base64` — b2ggbm8gOig= → oh no :(<br>answer: `oh no :(`
- **Dr. Langeskov: Base32 from two pieces** · `dl-base32` — Two interrupted Base32 runs from message 5346044, joined by hand<br>answer: `d I'm so happy with how it's turned out. Luckily we only lost a couple of violinists and b`
- **Dr. Langeskov: ASCII85 → coordinates** · `dl-ascii85` — 1c6mG1,UpL2BXt32)RBQ1GA → 45.925596 8.559730<br>answer: `45.925596 8.559730`
- **Dr. Langeskov: a file name → hex → Caesar −1** · `dl-scottie` — 74647075756a66 → tdpuujf → scottie (an SSTV mode hint)<br>answer: `scottie`

### Killing Floor 2: From a Friend

- **Killing Floor 2: a compound message** · `kf2-compound` — The text is Caesar −3, the path Caesar −6: the lines are solved separately<br>answer: `I hope this message makes it out! Horzine is up to no good and the world needs to know! Wi`
- **Killing Floor 2: columnar transposition (a significant double space)** · `kf2-columnar` — 55 characters, 12 columns; the column order is found without a key<br>answer: `Is there anyone out there looking? Check the mods page!`
- **Killing Floor 2: Vigenère with a key from an earlier stage** · `kf2-vigenere` — The key ANTONWOULDBEPROUND with an extra N<br>answer: `You missed the package. It is in the usual place, all rared up.` · manual: The key comes from an earlier stage; a blind search of 48 letters with a 17-letter key is not possible

### 76543

- **76543: Vigenère without a key (Python engine)** · `ar-vigenere` — A long ciphertext → the 24-letter key is found by itself<br>manual: Needs the local Python engine (start with Start): Node tests have no server; with the server running the general auto search ranks the answer first
- **76543: exact arithmetic** · `ar-calc` — 2*3*76543 → 459258<br>answer: `459258`

### Steam Winter 2015

- **Steam Winter 2015: an anagram after extracting letters** · `sw-anagram` — LLLLHTBEEU → hell bullet<br>answer: `hell bullet` · manual: A person extracts the letters from speech; the auto search does not try anagrams by itself

### Images: SGA and OCR

- **SGA photo: “the play nears its final act”** · `img-sga-poem` — gmtcf gjl[jlbn r abyfkmyjve frne → пьеса подходит к финальному акту<br>answer: `пьеса подходит к финальному акту скоро я уравновешу чаши весов сердце тьмы зовёт тебя след` · manual: Needs an image: recognition works on pixels, the auto search only works on text
- **SGA photo: “the key is split into three parts”** · `img-sga-key` — nt,t ye;ty kbim rk.x → тебе нужен лишь ключ<br>answer: `тебе нужен лишь ключ он разбит на три части удачи` · manual: Needs an image: recognition works on pixels, the auto search only works on text
- **Dark frame: brighten → OCR → pairs +23** · `img-vrfneo` — Barely visible digits in the sky → “тЫ Не СпАсешЬ НХ”<br>answer: `тЫ Не СпАсешЬ НХ` · manual: Needs the image and an OCR run with the Recognise button; the digits themselves are solved by the auto search (the ru-leet example)

### Audio and compressed data

- **Base64 → XOR → zlib → text** · `xor-zlib` — The XOR key comes from the zlib header, Adler-32 confirms it<br>answer: `The second fragment is hidden behind the clock tower; bring the brass key at dawn.`
- **Text in an audio spectrogram** · `audio-spectrogram` — WAV → spectrogram → the text PG56<br>manual: A person or OCR on the saved picture reads the text

## Built-in dossiers

The **Profile** tab shows these dossiers; you can also write your own and keep them in the project file.

- **OldRoot Mystery** (2014–2016, Minecraft + Reddit / Imgur / SoundCloud / Tumblr / web) — 8 stages, 4 sources, 4 examples. The first publication was on 11 July 2014. The creator later wrote that the goal was a “code based ARG” with custom codes that no single decoder site solves. The chain runs through image brightness, an audio spectrogram,…
- **HERMatrix** (2021, Hermitcraft Season 8 / Minecraft + web (hermatrix.net)) — 4 stages, 2 sources, 1 examples. Early phase: a QR code in a video leads to hermatrix.net, entering #FFFFFF8 stops the changing symbols and shows the coordinates 1534 21 -266. Later the names of rescued axolotls gave LMVCCIKB; the key LUCY and the hint …
- **AlphaVer / Minecraft Alpha 1.0.16 Versions** (2021–2022, A Minecraft-like fictional build + JAR / RAR / YouTube) — 5 stages, 3 sources, 2 examples. A fictional web series/ARG about a closed branch of Alpha 1.0.16. The first posts are from August 2021. The key rule: strings like 9b4c383a911ec look like hex but are tokens for a special block, Input Block ID 120. Enter…
- **Endermite / Jimmy** (2026, Minecraft + latest.log / video / Google Drive / r/MinecraftARGs) — 8 stages, 1 sources, 6 examples. Clouds of different heights read as the letter case of a Drive link; latest.log holds a mod raqrezvgr (ROT13 = endermite), hex 73746f70 (stop) and 41414141 (AAAA), and wfvwjealw (shift +8 = endermite). The key ENDERMITE …
- **Archive11** (≈2025 (the launch date is not established), Minecraft YouTube) — 3 stages, 1 sources, 1 examples. A channel with about 40 subscribers: videos Archive_# and Archive.Recover#, disabled comments, a hidden playlist archive.missing1. Only 476F6E65 → Gone and 616C6C → all are reproducible.
- **Portal ARG** (2010, Portal + game files + a telephone BBS) — 6 stages, 2 sources, 2 examples. On 1 March 2010 Valve released a Portal update with one changelog line about a radio frequency change. The game gained 26 radios (dinosaur1…26.wav): Morse and SSTV. Eight SSTV files give 32 hex characters, the MD5 of the…
- **Cicada 3301** (2012, JPEG / web / phone / OutGuess / PGP / physical QR posters) — 6 stages, 4 sources, 2 examples. The first image is 509×503 pixels. The raw content of the JPEG contains CLAVDIVS CAESAR says "lxxt>33m2mqkyv2gsq3q=w]O2ntk": subtracting 4 from the code of EVERY character gives a decoy URL. The real layer is extracted w…
- **Year Zero** (2007, USB / MP3 / video / web / physical media) — 7 stages, 1 sources, 1 examples. 14 Feb 2007: a USB at a concert, static at the end of a track forms an image in the spectrogram. 19 Feb: 2432.mp3, the spectrogram shows 1-216-333-1810. 22 Feb: a fast teaser frame → yearzero.nin.com/0024/. Then timecode…
- **Oxenfree ARG** (2016, game / radio / phone / Twitter / web / audio / physical media) — 6 stages, 1 sources, 3 examples. Ten radio anomalies give callsigns and digits; sorting Able…Jig gives the phone (916)-936-3733. Then Morse by phone and in an SMS, stereo channels, reversed playback, an HTML alt with decimal bytes, and finally the anagr…
- **Inscryption ARG** (2021, game / save files / web / floppies / physical media) — 4 stages, 1 sources, 1 examples. The string MYCOLOG1ST12\|P3RHAPS??\|BLOOD$L3TT3R8OX is not one cipher but three instructions to different sources. The key, joined with “\|”, is typed into the game console (Ctrl+C while Act 2 loads): decode log.txt, the…
- **Sombra ARG (Overwatch)** (2016, Overwatch video / web / image) — 4 stages, 1 sources, 2 examples. A hex block in the Ana video at 1:16 + XOR 23 gives a repeating Spanish phrase and the piece “somb”; the second block gives “ra”. Vertical barcodes → hex → binary → pixels → QR. The Summer Games string is valid Base64 of…
- **Searching For a World That Doesn’t Exist** (2025–2026, Minecraft / video / Google Drive / PDF) — 1 stages, 1 sources, 0 examples. In a very brief flash of the inventory, the first character of each item name is taken and the item count controls the case: one light block gives “1”, three zombie heads give an uppercase “Z”, vine gives “v”. The charac…
- **I Love Bees** (2004, web / GPS / payphones / audio / physical media) — 1 stages, 1 sources, 0 examples. In August 2004 the site published first 220, then 210 GPS positions, then times. At the appointed moment the matching payphone rang; the right codeword marked success and released a new sound file.
- **Killing Floor 2: From a Friend** (2017, Steam announcements / PNG / video / WAV / RAR) — 6 stages, 2 sources, 3 examples. An announcement with Caesar shifts (text −3, path −6) led to thestart.png; then a columnar transposition with a significant double space, a hidden part of an image, a spectrogram with Enigma, a Vigenère with an unusual k…
- **Dr. Langeskov** (2015, the crowscrowscrows.com site / MP3 with SSTV / PNG / a PDF in parts) — 8 stages, 2 sources, 6 examples. Messages on the site hid binary, hex, Base64, Base32 and ASCII85 strings; the MP3s carried SSTV pictures (Scottie S1 without a VIS header), the file name 74647075756a66 was the hint scottie, and a PDF was cut into a “.pd…
- **76543** (2017–2018, Discord bot / web / a physical cache / QR) — 6 stages, 1 sources, 2 examples. A long Vigenère with the key argsevensixfivefourthree (found by the Python engine without hints), a phonetic alphabet in prose (BE2DA394), primes and arithmetic, a dark QR with erased finder patterns and the QR of a phys…
- **Steam Winter 2015** (2015, Steam: a comic, cards, WAV, search) — 5 stages, 1 sources, 1 examples. A cover barcode, faint symbols on the cards (a Dungeon Master system), three WAVs with a spectral password and Japanese speech, a phonetic alphabet in the narration and the anagram BULLET HELL.

## On-screen keyboards

The **⌨ Keyboards** button opens a floating panel that types into the focused field or into its own scratchpad.

- **Enchanting table (SGA)** — SGA has no letter case: "A" and "a" give the same glyph, decoding back yields lowercase.
- **Braille** — A cell is 6 dots (1–3 left, 4–6 right). Caption: English/Russian letter. Build a cell from a photo with the dot builder below.
- **Morse code** — Letters are separated by a space, words by " / ". A letter key inserts its code and a space.
- **Runes** — ᚦ = th, ᛜ = ng, ᛇ = ï; ᛫ separates words (read as a space). Shared runes are the same characters in both futharks.
- **Greek alphabet** — The caption is the Latin transliteration used by the "Greek letters ↔ Latin" operation.
- **Pigpen (Freemason cipher)** — Unicode approximations of the shapes; a trailing · marks the dotted variant (J–R, W–Z). Token mode inserts rb, lrb. …
- **Special characters and codes** — Invisible characters are labelled here but stay invisible in the field: check the text length or the HEX view. Backspace erases "§a" as one unit.
- **Look-alike letters: Cyrillic ↔ Latin** — A key inserts the look-alike (on the button), the caption is the original. Used to hide and find "Latin" words with Cyrillic inside.
