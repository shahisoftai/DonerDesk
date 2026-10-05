# Understanding Report Readiness

DonorDesk shows several readiness signals. They answer different questions.

## 1. Project setup readiness

On the project's **Setup** page: *Not started, In progress, Ready, Action required*. It is computed from live project data (nothing is stored), so it can change back to **Action required** if you later remove something required.

To be **Ready**, a project needs:

- its workspace folder provisioned (Google Drive tenants) or not required (other storage);
- a donor template with at least one reviewed required section;
- at least one indicator, and every quantitative indicator with a baseline, target, unit and frequency;
- a reporting profile.

Team assignment is recommended but not blocking. Until the project is ready you cannot create a reporting period, but you can still work on evidence, activities, logframe, templates and team. The **readiness breakdown** lists each blocker with a **Fix** link. Click **Mark setup complete** once it is ready.

## 2. Report readiness (in the editor)

The top bar shows a percent-ready pill, for example **72% ready · 3 to do**, with previous/next arrows to jump between remaining items. It combines:

- flagged statements that need a decision;
- sections not yet approved;
- blocking checks (checklist items, unverified indicator data, stale summaries, confidentiality confirmations).

Click it to open the **Report checks** panel. Warnings never block; blocking items mirror the server-side approval gate, which stays authoritative.

## The readiness score on the project page

The **Overview** page shows one readiness percentage for the active period, with a stage in front of it, for example **Drafting · 82%**:

| Stage | When | What is counted |
|---|---|---|
| **Drafting** | No draft yet, or a draft not yet sent to review | Verified indicator data, evidence, the checklist, and sections that are drafted with no open issue. Approval is **not** counted yet. |
| **In review** | The report is under review | Everything, including approved sections and approval. |
| **Ready to submit** | The report is approved | Everything; this is the full score. |

So a correct first draft is not shown as 0%. If there is no draft yet the card says **Generate a draft to start**. A contradiction between the report text and your verified data still caps the score at any stage.

Above the breakdown, **Top things to do** lists the (up to three) biggest gaps, largest first, each with how many points it would add and a button that goes straight to the place to fix it, for example *Verify indicator values*, *Attach supporting evidence* or *Clear the checklist*.

## 3. Compliance readiness

The [compliance checklist](/support/getting-started/understanding-compliance-checklist) tracks required documents and annexes per project and period, with severity levels (Low to Critical).

## Improving readiness

1. Follow the primary button: it always points to the next most useful action.
2. Verify indicator data and evidence.
3. Resolve missing-evidence items (in bulk if needed).
4. Approve each section.
