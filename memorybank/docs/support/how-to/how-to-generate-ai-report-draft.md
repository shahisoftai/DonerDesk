# How to Generate an AI Report Draft

DonorDesk's **AI Reporter** writes the narrative of a donor report from the data already in your project. Numbers, tables, charts and comparisons are built from your **verified** indicator data. The AI writes only the prose around them, and every figure it uses is checked against that data before you see it.

## Before you generate

Open the reporting period and check the four steps in the **Reporting workspace**:

1. **Update Project** – indicator values entered (and verified), activities logged, evidence uploaded and linked for the period.
2. **Tell the Story** – answers to the four story questions: challenges, why targets were over- or under-achieved, what changed or was adapted, and (optionally) a lesson or story.
3. **Generate Draft**
4. **Review & Submit**

You also need:
- a **reviewed donor template** pinned to the period (see [How to upload a donor template](/support/how-to/upload-donor-template)), otherwise a standard outline is used and flagged;
- a role that can generate reports (Admin, Project Manager, M&E Officer or Grants Officer);
- AI drafts left on your plan (see [Plans and limits](/support/account-billing/plans-and-limits)), unless you use your own AI provider.

## Generate the first draft

1. Go to **Projects → your project → Reporting** and open the reporting period.
2. In the report editor click **Generate report** (the single primary button at the top right). A launch card lists what will be used.
3. Watch the progress. A short animated panel shows the AI working, and sections appear as they finish. Several sections are written in parallel, and the executive summary and conclusion are written last, from the other sections.
4. If you leave the page, generation continues; come back and reopen the period.

If a section takes too long or fails our fact checks, DonorDesk shows a plain-language reason and uses a **basic, deterministic version** for that section. The rest of the report carries on, and the fallback is never billed as an AI draft.

## What you get

- A **hierarchical outline** that mirrors the donor template (numbered sections and sub-sections).
- **Tables, charts and comparisons** built from verified findings: period values, targets, percent of target and change from the previous period.
- **Statement checks:** each factual statement is compared with evidence and indicator data.
- **Sources** for each section: evidence files, activities and indicator updates.
- If **AI Writing Style** is turned on, approved style preferences are applied (see [AI Writing Style](/support/advanced-features/ai-settings)).

## Regenerate one section

1. Select the section in the outline.
2. Click the **↻ Regenerate** button on the section.
3. Optionally type an instruction ("shorter", "focus on the women's groups").
4. Wait for the new text. If the writer falls back or times out, your previous text is kept.

Section regeneration does not use an AI draft credit but is limited to a set number per report per hour. Sections you have already approved are reopened when you regenerate them.

## Ask AI on a selection

Select text in the editor and use the **Ask AI** (✦) button to rewrite, shorten or change tone. You always choose whether to accept the result.

## Review what the AI wrote

Work through the **flagged statements** (see [How to review and approve reports](/support/how-to/review-and-approve-reports)):

- **Matches evidence** – no action needed.
- **Needs a decision** – the wording does not match the evidence. Correct it, use the evidence value, keep it with a note, or leave it out.
- **Kept with a note / Left out** – your decision. Left-out statements are removed from exports.

The AI cannot invent numbers: any figure that is not in your verified inputs is rejected before you see it.

## Credits

| Action | Uses an AI draft credit? |
|---|---|
| Successful full draft | Yes, 1 |
| Fallback (basic) draft | No |
| Failed generation | No (credit released) |
| Regenerate one section | No (rate-limited) |
| Using your own AI provider (Growth/Enterprise, set up by the DonorDesk team) | No |
| AI evidence tagging | No |

Check usage in **Settings → Billing**.

## If generation does not work

See [Troubleshooting AI report generation](/support/troubleshooting/ai-report-generation).
