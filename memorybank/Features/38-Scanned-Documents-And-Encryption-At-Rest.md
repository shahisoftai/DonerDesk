# Feature 38: Scanned documents (OCR) and encryption at rest

**DonorDesk Version 2.007** · **Shipped:** 2026-10-21: OCR in release `20261021054800`, OCR import fix in `20261021061014`; OCR packages installed on the worker by hand; encryption code shipped but **off** in production · **Audit:** AI-03 (OCR), SE-03 (encryption) (§16)

## 1. Scanned documents

| What the person sees | When |
|---|---|
| A scanned PDF or a photographed page is read; the text lands in the import box with a note: "Read from the scanned page by text recognition: check names and numbers against the original." | A PDF has no text layer, or an image is uploaded to an import screen |
| "No readable text was found…" as before | Recognition found nothing, or OCR is not installed or switched off |

- **Fallback only.** A PDF that already has words is never sent to OCR. The ordinary parsers run first.
- **Engine:** `pypdfium2` renders pages, `rapidocr-onnxruntime` reads them (pip only). Limits: 20 pages per file (`OCR_MAX_PAGES`), 150 dpi (`OCR_RENDER_DPI`), one scan at a time (`OCR_CONCURRENCY`).
- **Off switch:** `OCR_ENABLED=0`.
- **Confidence:** lines under 0.6 are counted as "could not be read clearly" in the note.
- **Off the event loop:** the worker's parse endpoint runs parsing in a thread pool so drafting is not held up.

Code: `apps/workers/app/ocr.py`, `apps/workers/app/parsers.py`; API fallback `packages/infrastructure/src/parsers/ocr-fallback-parser.ts`; rule `assessTextExtraction({ readByOcr })` in `packages/domain/src/contexts/evidence/text-extraction.ts`. Tests: `apps/workers/tests/test_ocr.py`, `packages/infrastructure/test/ocr-fallback-parser.test.mjs`.

Host note: the deploy script ships code but not Python packages. The worker venv on the host needs `pypdfium2`, `rapidocr-onnxruntime==1.4.4` and `pillow` installed by hand; see `../CONTABO-DEPLOY.md`.

## 2. Encryption at rest

Stored files (evidence, exports, templates) can be encrypted before they reach the disk.

- **Cipher:** AES-256-GCM. A key per organisation is derived from a master key with HKDF.
- **Binding:** the storage key is the authenticated data, so a file moved to another key does not open.
- **Compatibility:** files without the `DDENC1` header are plain and still readable; `storage:encrypt` brings them over (idempotent, interruptible, `--dry-run`).
- **Rotation:** add a key with a higher id and make it active; run the tool; remove the old key only after a clean run and a restore test.
- **Status:** built and tested; a dry run on production found 622 files and no failures. **Not switched on.** It needs a key, and a copy of the key kept off the host.

Code: `packages/infrastructure/src/storage/at-rest-encryption.ts`, `encrypt-existing.ts`, `encrypt-cli.ts`. Runbook: `../docs/runbooks/evidence-encryption.md`. Tests: `packages/infrastructure/test/at-rest-encryption.test.mjs`.

## 3. Left over

- Turn encryption on (decision: where the key copy is kept).
- OCR of spreadsheets and of handwriting is not attempted; tables in scans come out as text lines.
- The database (including extracted text) is not encrypted by this feature.
