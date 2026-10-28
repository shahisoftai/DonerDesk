# Feature 49: Ask DonorDesk

**DonorDesk Version 3.007 (Phase 33.9)**
**Status:** built and tested; deployed 2026-10-28 (`releaseId=20261028062717`) **with Ask switched off in every organisation**. **Never run against a real model in production.** Answer quality is unknown.
**Rules:** `AGENTS.md` → "Phase 33.9 invariants — Ask DonorDesk".

## What it does

A person asks a question about one project. The answer is built only from the project's own records, and every sentence names the records it rests on.

- **Records read:** indicator values (with whether each is verified), accepted and current activity records, and the text of evidence the asker is allowed to open. Finance is not read. The project must be visible to the asker.
- **Sources** are numbered (S1, S2 …). The most relevant go to the model, within a size budget; a named indicator code ranks first.
- **The model must cite a source after every sentence** and quote figures exactly.
- **A deterministic check** keeps a sentence only if it names at least one real source and each figure in it appears in the source it names. Nothing is rewritten. Sentences that fail are dropped and counted.
- If nothing survives, the answer is "The project's records do not answer this question." The model's own list of what is missing is shown, checked the same way.
- Each answer says how many indicators, activities and evidence pieces were looked at, and warns that unverified values are drafts.

## Controls

- **Off by default.** An administrator turns it on in Settings → Ask DonorDesk. The change is audited. The organisation must also have AI switched on and a real provider configured.
- Personal details (names, e-mail addresses, phone numbers) are redacted from the question and every source before they leave the server. The check reads the same redacted sources.
- The audit trail records the question's **length**, the status, the cited sources and the dropped counts. It never records the question text.
- Limits: 60 questions an hour and 400 a day per organisation.
- Outside partners cannot use it.

## Not built

Follow-up questions; questions across projects; saved answers; finance questions; partner access; a golden question set run on the real model (required before any public claim).
