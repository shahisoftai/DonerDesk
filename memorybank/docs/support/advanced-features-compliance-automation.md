# Compliance Automation

DonorDesk keeps the compliance checklist current automatically, so you spend time fixing problems rather than hunting for them.

## What is automated

- **Checklist generation** – items are derived from the donor template (required sections, tables and annexes), the logframe's means of verification, activities and evidence.
- **Coverage-gap projection** – if a report section makes a claim that nothing in your data supports, a checklist item is created for it. Regenerating is idempotent: existing items and your decisions are kept, and no duplicates appear.
- **Report checks** – the editor recomputes readiness whenever data changes: flagged statements, unapproved sections, unverified indicators, stale summaries and confidential files to confirm.
- **Assurance pass** – every save re-checks the report's statements against evidence and verified indicator data. Numbers, dates, units, periods and entities are compared, and evidence integrity (hash) is checked.
- **Export gate** – approval, submission and export share one gate, so a report cannot leave with unresolved blocking issues unless someone with the right authority accepts the limitation and gives a reason.

## What stays with people

- Deciding whether a statement is acceptable.
- Verifying indicators and evidence.
- Accepting risk (high-severity items need authority).
- Confirming that confidential files may be shared (Admin or Grants Officer).

## Tips

- Use **Scan for missing items** in the report editor's ⋯ menu after uploading evidence.
- Resolve blocking items early; they gate approval and export.

See [How to use the compliance checklist](/support/how-to/use-compliance-checklist).
