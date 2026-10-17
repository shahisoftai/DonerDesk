# Troubleshooting AI Report Generation

DonorDesk always tries to give you a report. If the AI cannot write a section properly, it uses a **basic (deterministic) version** for that section and tells you why. The rest of the report continues.

## Messages you may see and what to do

| Message | Meaning | What to do |
|---|---|---|
| AI writing is switched off for this workspace, so a basic version was used. | AI is disabled. | An Admin can enable **AI enabled** in **Settings → Settings**. |
| AI writing is not set up for your organisation, so a basic version was used. | No AI provider is configured for your workspace. | Contact support@donordesk.online. |
| **Written without AI** banner on a section **with a reason** (for example "figures not in your data: 33.3") | The reason is stored with the section when it is written, so you can read it any time. The banner offers the action that fits: **Try again** for a timeout or a service error, **Try again, quote recorded figures only** when the text used a figure that is not in your data, **Open AI settings** when AI is switched off or not set up. | Press the button in the banner. Before a basic version is used, the system already retried once by itself (naming the figure it must not state, or with a shorter brief after a timeout); the banner appears only if that retry failed too. |
| **Written without AI** banner on a section (no reason shown) | The AI writer timed out, failed, or used a figure that is not in your verified data, so a basic version was used. | Open **Try AI again** and add a short instruction such as "quote only recorded figures; do not calculate totals or percentages", or write the section by hand. A section that fails every month is usually a validation failure on a derived figure. |
| The AI service took too long for this section… Try again. | The provider timed out. | Regenerate that section. |
| The AI service returned no text / text we could not use… | Provider returned an empty or unusable answer. | Regenerate the section. |
| The AI service could not be reached… Try again later. | Provider or network problem. | Wait and retry. |
| The AI service refused this request because of personal data… | The content included personal data the provider rejects. | Remove personal details from the story or evidence text, then retry. |
| The AI text did not pass our fact checks, so a basic version was used. | The draft contained numbers or claims not supported by your data. | Check that indicator values are entered and verified, then regenerate. |

Fallback sections are not billed as AI drafts.

## What the AI did for each section

An administrator can see the last 50 sections the AI worked on under **Settings → AI usage**: written, written after one retry, or a basic version (with the reason), how many tries it took and how long. You never need a server log to find out why a section was written without AI.

## Text with an id or a file name

A report never names an evidence id, a record id or a file name: the system rejects such a draft and asks the writer again. If a section still contains one after that, the basic version is used and the banner says "the text named an internal id or file name".

## "Generate report" is missing or disabled

- You need a role that can generate reports: Admin, Project Manager, M&E Officer or Grants Officer.
- A **Reviewed** donor template must be pinned to the period. Approve the template first.
- You may have reached your monthly AI drafts. Check **Settings → Billing**, buy a top-up pack (Team/Growth) or wait for the reset. You can still write manually.
- If a generation is already running, wait for it to finish.

## The draft is generic or thin

- Enter and **verify indicator values** for the period.
- Upload evidence and **link** it to indicators and activities.
- Fill in **Tell the Story**.
- Make sure the donor template's sections have instructions and mandatory questions.

## Numbers look different from what I expected

Tables, charts and comparisons come from **verified** data, not from the AI. Fix or verify the indicator value and regenerate or re-check. Use **Use the evidence value** in the Statements tab for statements that disagree.

## Regenerate a section is blocked

| Message | Fix |
|---|---|
| Sections can only be regenerated while the report is a draft. | Reopen or use the current draft. |
| This is an older version of the report. | Open the current version. |
| The report is still being written. | Wait for generation to finish. |
| This section is already being rewritten. | Wait a moment. |
| You can regenerate up to N sections per hour for one report. | Try again later, or edit manually. |

## Generation seems stuck

Generation runs in the background; a full report can take several minutes. Reload the period page. If nothing changes after about ten minutes, email support@donordesk.online with the project and period.

## Style suggestions do not appear

**AI Writing Style** must be enabled for your workspace and switched on in Settings, and learns only after your team edits AI-drafted sections. See [AI Settings](/support/advanced-features/ai-settings).
