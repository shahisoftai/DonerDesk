# Donor Templates

A donor template describes the structure and rules of the report a donor expects. DonorDesk uses it to build the report outline and to guide the AI Reporter.

## What a template contains

- **Sections** in a hierarchy (numbered, with sub-sections down to several levels).
- Per section: the donor's **instructions**, **mandatory questions**, **evidence needed**, **required tables**, **page limit**, and your own **author instructions**.
- **Include in report** – guidance-only sections are excluded from the report.
- **Report requirements** for the whole report.
- The **original file**, kept for reference and (optionally) donor-native Word rendering.

## Lifecycle

| Status | Meaning |
|---|---|
| Extracting | DonorDesk is analysing the document. |
| Needs review | Extraction finished. A person must check it. |
| Reviewed | Approved and usable for reporting. |
| Extraction failed | Analysis failed; retry, paste the text, or build the sections by hand. |

Every edit is saved as a new version.

## How it is used

- A **full draft needs a Reviewed template**. It is pinned to the reporting period.
- One template can be the project **default**.
- Templates can be saved to a **library** and copied into other projects.
- Section guidance feeds the AI Reporter for that section.

Extraction is grounded in your document. Titles and details that cannot be found in the source are dropped.

See [How to upload a donor template](/support/how-to/upload-donor-template).
