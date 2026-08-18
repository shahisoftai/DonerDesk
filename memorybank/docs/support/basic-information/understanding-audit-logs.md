# Understanding Audit Logs in DonorDesk

The audit log is a complete, immutable record of every significant action taken in your DonorDesk workspace. It helps you track who did what, when, and what changed.

## What the Audit Log Records

The audit log records:

| What was done | Who did it | When | Details |
|--------------|-----------|------|---------|
| Project created | jane@org.org | 2026-08-15 14:32 | Project: "Health Programme" |
| Evidence uploaded | field@org.org | 2026-08-16 09:15 | File: "Attendance_Q3.pdf" |
| Indicator updated | meo@org.org | 2026-08-16 10:45 | OUT-1: 450 → 485 |
| Report approved | manager@org.org | 2026-08-17 16:00 | Period: Q3 2026 |
| User invited | admin@org.org | 2026-08-18 08:00 | Invited: newuser@org.org |
| User role changed | admin@org.org | 2026-08-18 08:05 | newuser@org.org: Field Officer → M&E Officer |

## How to Access the Audit Log

1. Go to **Settings → Audit Log** (Admin or Compliance Officer only)
2. You will see a chronological list of all actions
3. Use filters to narrow down what you are looking for

## Filtering the Audit Log

You can filter by:

- **Date range** — Find actions within a specific period
- **User** — See what one person has done
- **Action type** — Filter by type of action (created, updated, deleted, uploaded, etc.)
- **Entity type** — Filter by what was affected (project, evidence, indicator, report, etc.)
- **Project** — See all actions within a specific project

## Who Can See the Audit Log

Access to the audit log requires one of these roles:
- **Owner**
- **Admin**
- **Compliance Officer**

These roles can view the full organisation-wide audit log.

## What the Audit Log Looks Like

Each entry shows:

```
[Timestamp]        [User]           [Action]              [Entity]         [Details]
2026-08-17 14:32  jane@org.org    REPORT_GENERATED     Q3 Progress      AI draft generated
                                   AI                    Report            12 sections created
2026-08-17 15:10  jane@org.org    SECTION_REVIEWED     Achievements      Section approved
                                                     section
2026-08-17 16:45  manager@org.org APPROVED             Q3 Progress      Full report approved
                                                     Report
```

## Why Audit Logs Matter

### For Donors
Some donors require an audit trail as part of their compliance requirements. The audit log proves that your M&E system is robust and that changes to data are tracked.

### For Internal Accountability
Track who uploaded what evidence, when indicator values were updated, and who approved reports. This distributes responsibility across the team.

### For Problem Investigation
If something goes wrong — data is missing, a report is incorrect, or someone cannot access what they need — the audit log helps you investigate what happened.

### For External Audits
When your organisation is audited by a donor or external auditor, the audit log provides evidence of your reporting process.

## Exporting Audit Logs

You can export audit logs for a specific period:

1. Set your date filters
2. Apply entity type or user filters if needed
3. Click **Export**
4. Choose format: CSV or PDF
5. Download the file

## What is NOT in the Audit Log

The audit log records **significant actions** — not every single keystroke or page view. Specifically:

- ❌ Page views and navigation are not logged
- ❌ Individual edits within a report section are not logged (only the review/approval is)
- ❌ Login/logout events (separate from action events)
- ❌ Automated system actions (AI tagging, checklist generation) are not logged separately

## Data Retention

Audit logs are retained for the life of your organisation in DonorDesk. After you delete your DonorDesk workspace, audit logs are retained according to DonorDesk's data retention policy.

## Immutability

Audit log entries cannot be edited or deleted by any user, including the Owner. This immutability is what makes the audit log a reliable source of truth for compliance purposes.

If you have a data integrity concern, contact **support@donordesk.online**.
