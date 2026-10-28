# Feature 50: Interface languages

**DonorDesk Version 3.007 (Phase 33.10)**
**Status:** framework built and tested; deployed 2026-10-28 (web). **The French, Spanish and Arabic text is an unreviewed draft.** Only part of the app is translated.
**Rules:** `AGENTS.md` → "Phase 33.10 invariants — interface languages".

## What a person gets

- English, French, Spanish and Arabic. Arabic is right to left.
- A language switcher in the top bar, and on the field and collection pages. The choice is kept on the device.
- Order of choice: the person's own choice → the organisation's default language (when offered) → the browser's language → English.

## What is translated

- The left navigation, including the new Dashboards and Security entries.
- The field app (`/field`), the form filler (every answer message), and the public collection page.

## What is not

Most of the signed-in app (reports, logframe, settings and the rest), the marketing and legal pages, e-mails, exports, donor-facing report text and the AI's answers.

## Rules for the text

- All messages are in one typed catalogue. A missing key in French, Spanish or Arabic is a compile error; a test checks every key, the same `{placeholders}` and plural forms, and that no message shows a raw code or id.
- Plurals follow each language (Arabic has six forms).
- A message the server builds in English is used only where no translation is needed; screens translate by code and values.

## Before the languages are offered

A native speaker of the sector reviews French, Spanish and Arabic, especially the sector terms (logframe, evidence, compliance). Right-to-left layout is checked on every screen, not only the new ones.
