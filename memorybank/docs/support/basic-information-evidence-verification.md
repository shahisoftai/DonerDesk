# Evidence Verification

Verification records whether a person has checked an evidence file. Only checked evidence should support figures in a donor report.

## Statuses

| Status | Meaning |
|---|---|
| Uploaded | The file is in DonorDesk. |
| AI tagged | AI suggested tags; nothing is final yet. |
| Pending review | Waiting for a reviewer. |
| Verified | A reviewer confirmed it. |
| Needs correction | The reviewer asked for a fix (with a reason). |
| Rejected | Not accepted. |
| Archived | Kept for the record, no longer active. |
| Unverified | No verification has been recorded. |

## Who verifies

Admin, Project Manager, M&E Officer and Compliance Officer.

## What is checked

- The file is legible and complete.
- It matches the activity and indicator it is linked to.
- Dates fall in the reporting period.
- Confidentiality is set correctly.

## How verification affects reports

- The checklist and report readiness count verified evidence.
- The AI Reporter compares each statement with linked evidence and indicator data and marks it **Matches evidence** or **Needs a decision**.
- The export gate re-checks that evidence has not changed since it was verified (hash check) and flags **stale verifications**.

## Indicator verification is separate

Indicator values have their own pipeline: Draft → Submitted → Verified / Needs correction / Rejected. See [How to update indicator values](/support/how-to/update-indicator-values).
