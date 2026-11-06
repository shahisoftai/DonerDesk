# Setup reading corpus

`pnpm --filter @donordesk/infrastructure setup:eval`. Recorded replies by default; with `LLM_PROVIDER` and its key the same cases run live, and `SETUP_EVAL_DOCS_DIR` adds real documents (`SETUP_EVAL_RUNS`, default 3).

**Add a real document:** keep the file outside the repository. Add a `.mjs` with `FILE`, `CHECKS` and `GOLDEN` (see `score.mjs`), written by a person who has not seen the model's answer, then add it to `REAL` in `eval.mjs`.

**Keep at least 4 documents as a held-out set, never used when changing prompts.** Target mix: CBPF, ECHO, EU, USAID, UN agency, a foundation; DOCX, digital PDF, PDF with a scanned annex, XLSX pack; French; 100+ pages; logframes filled and blank.

The headline number is `wrongShown`.
