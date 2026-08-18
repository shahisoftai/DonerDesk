# How to Use the Audit Trail

The audit trail is a complete record of all actions taken in your DonorDesk workspace. It helps with accountability, troubleshooting, and donor compliance.

## What the Audit Trail Records

Every significant action is logged:

| Action | Details recorded |
|--------|-----------------|
| Who did it | User name and email |
| What happened | Action type |
| When | Exact timestamp |
| What changed | Before/after values |
| Where | Which project, entity |

## Accessing the Audit Trail

### Who Can See It

Only these roles can access the audit log:
- Owner
- Admin
- Compliance Officer

### How to Access

1. Click your name → **Settings**
2. Click **Audit Log**
3. Use filters to find what you need

## Filtering the Audit Log

### By Date Range

Set a start and end date to narrow results.

### By User

See all actions by a specific team member.

### By Action Type

| Category | Examples |
|----------|---------|
| Project | Created, updated, archived |
| Evidence | Uploaded, verified, deleted |
| Report | Generated, approved, exported |
| User | Invited, role changed |

### By Entity

Filter by specific projects, reports, or evidence files.

## Common Uses for the Audit Trail

### Tracking Who Did What

**Problem:** "Who deleted that evidence file?"

**Solution:**
1. Filter by evidence deletion
2. Find the date/time
3. See who performed the action

### Compliance and Donors

Some donors require an audit trail as part of reporting:
1. Export the relevant date range
2. Include project and action details
3. Submit with your report

### Investigating Issues

**Problem:** A report has incorrect data and you need to trace the source.

**Solution:**
1. Find the incorrect value
2. Look at audit trail for changes to that indicator
3. See who made the change and when

### Security Monitoring

Check for suspicious activity:
1. Look for unusual login times
2. Check for bulk downloads
3. Verify permission changes are legitimate

## Understanding Audit Entries

Each audit entry shows:

```
2026-08-15 14:32:05 | jane@org.org | Report APPROVED | Q3 Progress Report
```

Or more detailed:

```
Timestamp:    2026-08-15 14:32:05 UTC
User:         jane@org.org
Action:       EVIDENCE.VERIFIED
Entity type:  EvidenceFile
Entity ID:   ev_abc123
Details:     File: attendance_sheet_q3.pdf
             Status: Verified
IP Address:  192.168.1.1
```

## Exporting Audit Logs

To export for donor or audit purposes:

1. Set your date filters
2. Apply any other filters
3. Click **Export**
4. Choose format: CSV or PDF
5. Download the file

## What Is NOT in the Audit Trail

The audit trail records significant actions, not:
- Page views or navigation
- Individual keystrokes
- Read-only access (viewing is not logged)
- Automatic system actions (scheduled tasks)

## Data Retention

Audit logs are retained:
- For the life of your organisation
- After you delete your account
- Per DonorDesk's data retention policy

## Immutability

Audit entries cannot be:
- Edited
- Deleted
- Modified by any user, including the Owner

This immutability is what makes the audit trail reliable for compliance.

## Integration with Compliance

The audit trail supports compliance by providing:
- Evidence of proper procedures
- Proof of approvals and reviews
- Record of who accessed or modified data
- Timestamps for all significant actions
