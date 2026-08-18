# Troubleshooting Compliance Checklist Issues

## Compliance Items Not Appearing

### No Reporting Period Created

The compliance checklist generates when you create a reporting period. If you see no items:
1. Create a reporting period first
2. Go to the **Compliance** tab
3. Click **Regenerate Checklist**

### Items Still Missing After Regeneration

1. Wait a moment — generation takes a few seconds
2. Make sure evidence and activities are linked
3. Check if the donor template is uploaded (some items depend on it)

## Items Show Wrong Severity

### Severity Is Auto-Calculated

Severity (Low, Medium, High, Critical) is determined by:
- How critical the missing item is to donor reporting
- How close the deadline is
- How much evidence is missing

### How to Change Severity

1. Click on the compliance item
2. Look for **Severity** field
3. Manually adjust if needed

Note: Changing severity manually may be overwritten when the checklist regenerates.

## Cannot Resolve an Item

### Item Is Locked

Some items require specific actions to resolve:
- **Missing evidence** — Upload and verify the evidence
- **Unverified indicator** — Submit and verify the indicator
- **Unreviewed AI section** — Review and approve the section

Resolve the underlying issue, and the item will auto-resolve.

### "Accept Risk" Not Working

To accept risk on an item:
1. Click on the item
2. Click **Accept Risk**
3. Enter a justification (required)
4. Save

Without a justification, the risk acceptance will not save.

## Items Keep Reappearing

### Checklist Regenerates

The compliance checklist is regenerated when:
- New evidence is uploaded
- New activities are logged
- New indicator updates are submitted
- You manually click **Regenerate Checklist**

If an item keeps appearing:
1. The underlying issue may not be fully resolved
2. For example, if evidence is uploaded but not verified, it will still flag as missing

## Cannot Assign Items

### Who Can Assign

Only these roles can assign compliance items:
- Owner
- Admin
- Project Manager

### How to Assign

1. Click on the compliance item
2. Click **Assign to**
3. Select the team member
4. Save

## False Positives

### Evidence Is Linked but Still Flags as Missing

1. Check that the evidence is linked to the **correct activity**
2. Check that the activity is linked to the **correct output**
3. Check that the evidence **verification status** is "Verified"

Only verified evidence counts as resolved.

### Indicator Shows as Unverified

1. Check the indicator status in the **Indicators** tab
2. Make sure it has been submitted and verified
3. Check the reporting period — the indicator update must be for the correct period

## Compliance Score Seems Wrong

### How the Score Is Calculated

The readiness score includes compliance at 20% weight:
- Open Critical items: -10%
- Open High items: -5%
- Open Medium items: -2%
- Open Low items: -1%
- Items resolved or accepted: 0%

### Why the Score Is Not 100%

Even with all items resolved, you may not see 100% if:
- Not all sections are reviewed
- Not all indicators are verified
- Approval has not been given

The compliance score is only one component of the overall readiness.

## Export Still Blocked Despite Resolving Items

### Critical Items Still Open

Even if you have resolved items, make sure:
1. No items have status **Open** and severity **Critical**
2. All **Critical** items are either **Resolved**, **Accepted Risk**, or **Not Applicable**

### Refresh the Page

After resolving critical items:
1. Refresh the Compliance tab
2. Try exporting again

If it still blocks:
1. Check each Critical item individually
2. Look for any with status **Open**
