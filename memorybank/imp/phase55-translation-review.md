# Phase 55 translation review sheet (Version 4.000)

**DonorDesk Version 4.01** · written 2026-11-15 · for a native reader of French, Spanish and Arabic

A native review cannot be done by the build team; this sheet gives a reviewer exactly what to read. Fill the **Reviewer** column (OK, or the wording you would use) and send it back; the strings live in `apps/web/src/features/i18n/messages/{en,fr,es,ar}.ts`.

## 1. Strings added or changed in Version 4.000 (translated, still drafts)

| Key | English | French | Spanish | Arabic | Reviewer |
|---|---|---|---|---|---|
| `nav.inbox` | Inbox | Boîte de réception | Bandeja de entrada | صندوق الوارد | |
| `nav.group.work` | Work | Travail | Trabajo | العمل | |
| `site.nav.product` | Product | Produit | Producto | المنتج | |
| `rb.title` | Data tables | Tableaux de données | Tablas de datos | جداول البيانات | |
| `nav.home` (unchanged, now the first entry) | Home | Accueil | Inicio | الرئيسية | |
| `nav.visuals` (unchanged) | Dashboards and infographics | Tableaux de bord et infographies | Paneles e infografías | لوحات ومعلومات مرئية | |
| Wizard: `quickPath`, `quickPathHint` | Only what is still needed | Seulement ce qui manque encore | Solo lo que aún falta | ما زال ناقصاً فقط | |

Plain-language check for the Inbox words: it replaces *My Work* ("Mon travail", "عملي") and *Notifications*; the reviewer should confirm that "Boîte de réception", "Bandeja de entrada" and "صندوق الوارد" read as a work queue and not only as email.

## 2. New screens that are still English only

These were built in Version 4.000 and follow the app's existing rule (navigation, the field app, forms and the wizard are translated; most other screens are English). They are listed so the owner can decide whether to translate them next:

- The **command palette** (Ctrl K) and its shortcut list.
- The **Inbox** page (tabs **To do / Team / Updates**, **Waiting to send**), the partner **Your projects** Home, **Get started** progress.
- The **project tabs** and their second row (Overview, Plan, Data, Evidence, Reports, Finance, Settings; Results framework, Work plan, Where we work…), breadcrumbs, **More**.
- The **Settings** list and the **AI features** page; the **Team** page buttons (Deactivate, Reactivate, Delete, Cancel invite) and their confirmation sentences.
- The report **stage bar** (Inputs, Story, Draft, Review and export and the next-step button), **Attach the files**, the selection bar, "You have unsaved typing… Restore it", **Here**, "Edit the rows and import again".
- Sign-in frame (brand panel), legal pages' contents list, the marketing home sections.

## 3. Arabic right-to-left

Arabic right to left was checked in a browser on 2026-11-15 on eleven main screens: the page is right to left, the side rail is on the right, nothing scrolls sideways. The Version 4 navigation labels are now translated (`ui-labels-*.ts`, add them to this review). Many older screens still show English text inside the Arabic page. A native reader should check wording, the side rail, panels and tables. The wording of the English-only screens above is not translated, so an Arabic user sees English on them.
