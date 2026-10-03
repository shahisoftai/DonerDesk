# Understanding Audit Logs

The audit log is a tamper-resistant record of what happened in your workspace: who did what, when, and to which record. It supports donor audits and internal accountability.

## What is recorded

- Project creation, edits, status changes, archiving
- Template uploads, extraction, approval and version changes
- Logframe, indicator and indicator-value changes, verification decisions
- Activities, evidence uploads, tags and verification
- Reporting periods, draft generation, section regeneration, edits, statement decisions, approvals and exports
- Team invitations and role changes
- Billing and plan changes, AI Writing Style decisions

Each record has the actor, event, entity, time and details. Sensitive values are redacted in the view.

## Who can see it

Admin, Project Manager and Compliance Officer, in **Settings → Audit log**. Filter by actor, event or entity.

## AI records

Every AI generation records the model and prompt version used, and the run's outcome, so you can show a donor how a draft was produced.

## Retention

Records are kept for as long as your workspace exists and cannot be edited or deleted from the app.

See [How to use the audit trail](/support/how-to/use-the-audit-trail).
