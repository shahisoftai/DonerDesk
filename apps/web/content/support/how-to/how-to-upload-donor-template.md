# How to Upload a Donor Template

A **donor template** tells DonorDesk how the donor wants the report structured. DonorDesk reads the donor's document, extracts the report outline and instructions, and lets you review them before anything is written.

Who can manage templates: Admin, Project Manager and Grants Officer.

## Step 1: Add the template

1. Open your project and go to **Templates** (in the project's secondary tabs), then click to create a new template.
2. Choose **how do you want to add it**:
   - **Upload the template file** – Word (.docx), PDF, text, Markdown, Excel or CSV, up to 20 MB. Word keeps headings and tables best. Scanned PDFs cannot be read; paste the text instead.
   - **Paste the template text** – useful when the donor sent instructions in an email or a scanned document. Extraction works from this text and you can correct it first.
   - **Build the sections myself** – start empty and add sections on the next screen.
3. Give the template a **name** and set the **template language**.
4. Click **Extract and review**. The original file is kept with the template.

## Step 2: Wait for the analysis

An animated panel shows progress ("Reading the document's headings and structure…", "Working out the report's outline…", "Finding required tables, questions and word limits…"). A full donor template usually takes one to three minutes. You can leave the page open; it updates on its own.

How it works: DonorDesk first reads the whole document to build the **table of contents** (up to four levels), grounds every title in the source text, then extracts guidance for each section. Anything it cannot find in the source is dropped rather than invented. If the AI step fails, a heading-based extractor is used, and the result is flagged for careful review.

If the status becomes **Extraction failed**, you can retry, paste the text, or build the sections yourself.

## Step 3: Review (required)

The template is marked **Needs review**. Check each part:

- **Template sections** – the outline. Rename, reorder, nest or delete sections. Each section can hold the donor's **instructions**, **mandatory questions**, **evidence needed**, **required tables**, **page limit** and your own **author instructions**. Turn **Include in report** off for guidance-only sections.
- **Report requirements** – rules for the whole report (language, length, formatting, annexes and similar).
- **Source panel** – compare with the original text.
- **AI brief preview** – shows what the AI Reporter will be told for a section.

Then click **Approve template**. The status becomes **Reviewed**.

## Step 4: Use it

- New reporting periods use the right template for their type automatically: an approved template written for exactly that type first, then your project's **default template** (set or clear it with **Use this template as the project default**), then the built-in structure. So an approved *Final report* template is used for the Final report without any extra step. To change it later, see [How to change a report's template](/support/how-to/change-a-reports-template).
- A full draft requires a **Reviewed** template. It is pinned to the reporting period, so later edits do not change reports already written.
- **Save to template library** lets you copy a template into other projects.

## Which template a report starts from

Each report type has its own default. On a template card, **Make default for Monthly** (or Final, Quarterly...) sets it for that type only, and the **Used for** label shows where the template applies. Uploading or approving a template never changes any default. Editing a template's instructions keeps its approval; adding a section reopens review.

## Versions

Every edit creates a new version. Open **Version history** to see and compare earlier versions. Deleting a template removes it and its history, but reporting periods keep the copy they were generated with.

## Donor-native Word output (optional)

If the donor gave a Word template that must be filled in, open the template's **mapping** page, upload the original .docx, assign document regions to sections, review every mapped region and approve. Mapping approval can be locked to a reporting period so exports attempt donor-native rendering.

## Tips

- Start with the donor's original Word file when you have one.
- Check the required sections and word limits: they drive the AI Reporter.
- A template must have at least one **reviewed required section** before the project counts as reporting-ready.

See also [Understanding donor templates](/support/getting-started/donor-templates).
