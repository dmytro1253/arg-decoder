# Archive fixtures

RAR samples from the libarchive test suite (BSD-2-Clause), decoded from the `.uu` files in
https://github.com/libarchive/libarchive/tree/master/libarchive/test on 2026-10-24:

| File | Original | Password |
|---|---|---|
| libarchive-rar4.rar | test_read_format_rar.rar.uu | none |
| libarchive-rar5-stored.rar | test_read_format_rar5_stored.rar.uu | none |
| libarchive-rar4-encrypted-headers.rar | test_read_format_rar4_encrypted_filenames.rar.uu | `password` (d.txt: `password2`) |
| libarchive-rar5-encrypted-headers.rar | test_read_format_rar5_encrypted_filenames.rar.uu | `password` (d.txt: `password2`) |

The passwords are documented in libarchive's `test_read_format_rar_encryption.c`.

# Other fixtures

- `../sombra-binary.txt` — the binary dump published during the Sombra ARG (Overwatch, 2016), as transcribed on the
  Game Detectives wiki (https://wiki.gamedetectives.net/w/Sombra_ARG); copied from the 2026-10-23 audit material.
- `../ocr-lines.png` — synthetic image from the 2026-10-24 OCR review (a 20-digit number with the short lines 42 and 007).
