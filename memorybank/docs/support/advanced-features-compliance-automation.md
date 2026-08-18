# Advanced: Using Compliance Automation

The compliance checklist in DonorDesk can be automated to run on a schedule and notify team members automatically.

## Automated Compliance Checking

By default, the compliance checklist runs when you create a reporting period. But you can also trigger it manually or on a schedule.

## Manual Checklist Generation

To regenerate the compliance checklist at any time:

1. Go to your reporting period
2. Click **Compliance** tab
3. Click **Regenerate Checklist**
4. Wait for the process to complete

This will re-scan your evidence, activities, and indicators and update the checklist items.

## Setting Up Automated Notifications

You can set up notifications for compliance items:

### Step 1: Go to Notifications

1. Click your name → **Settings**
2. Click **Notifications** or **Compliance Notifications**

### Step 2: Configure Alerts

Set up alerts for:

| Trigger | Action |
|---------|--------|
| New critical compliance item | Email to assigned person |
| Item approaching due date | Email 3 days before due date |
| Item overdue | Email immediately |
| High-severity item opened | Email to project manager |

### Step 3: Assign Default Owners

For each type of compliance item, set a default assignee:
- Missing evidence → M&E Officer
- Unverified indicator → Grants Officer
- Unreviewed AI section → Report author

## Acceptance Criteria

You can configure what DonorDesk considers "acceptable" to auto-resolve items:

| Criterion | Auto-resolve when... |
|-----------|---------------------|
| Evidence linked | At least 1 verified evidence file is linked to the activity |
| Indicator updated | Indicator has a submitted or verified value for this period |
| Section reviewed | Human has marked the AI section as reviewed |

## Severity Rules

Configure how severity is determined:

| Factor | How it affects severity |
|--------|------------------------|
| Evidence missing > 30 days | Escalate to Critical |
| Multiple activities without evidence | High |
| Single activity without evidence | Medium |
| AI section unreviewed > 7 days | High |

## Integration with Project Deadlines

Connect compliance items to your project calendar:

1. Go to **Settings → Compliance**
2. Enable **Auto-link to deadlines**
3. Compliance items are automatically linked to reporting period deadlines
4. Items are prioritised by how close the deadline is

## Compliance Reports

To see a summary of compliance across all projects:

1. Go to **Settings → Compliance**
2. Click **Compliance Report**
3. Select date range
4. See a summary of:
   - Open items by severity
   - Average resolution time
   - Most common gap types
   - Per-project breakdown

## Bulk Resolutions

When resolving many similar items:

1. Filter the checklist by type (e.g., all "Missing evidence")
2. Check the boxes next to each item
3. Click **Bulk Actions**
4. Choose **Resolve** or **Accept Risk**
5. Add a note (applies to all)

## Compliance History

Every change to a compliance item is logged:

1. Click on any compliance item
2. Look at the **History** tab
3. See who resolved it, when, and with what note

This creates an audit trail for donor compliance reviews.
