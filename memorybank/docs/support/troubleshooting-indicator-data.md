# Troubleshooting Indicator Data Issues

## Indicator Shows Wrong Value

### Check the Reporting Period

Indicators are updated **per reporting period**. Make sure you are looking at the correct period.

1. Go to the **Reports** tab
2. Confirm the reporting period name and dates
3. Go to **Indicators** for that specific period

### Check If Value Was Submitted

1. Find the indicator in the grid
2. Look at the status badge:
   - **Draft** — Value entered but not submitted
   - **Submitted** — Submitted for review
   - **Verified** — Reviewed and confirmed
   - **Needs Correction** — Reviewer found an error

### How to Fix

**If the value is in Draft:**
1. Click on the row
2. Check the value
3. Submit and verify

**If the value needs correction:**
1. Contact the person who verified it
2. Ask them to unlock the row
3. Make corrections
4. Re-submit and verify

## Cannot Enter a Value

### "This field only accepts numbers"

The indicator type requires a number. Do not add units or text:
- **Correct:** `450`
- **Incorrect:** `450 women`

The unit is stored separately in the indicator definition.

### "This field is locked"

The row is verified and locked. To edit:
1. Click **Unlock** (requires reviewer permission)
2. Make your changes
3. Re-submit

### "No indicator found"

The indicator code in your import file does not match DonorDesk codes. Check for:
- Typos
- Extra spaces
- Case differences (e.g., `OUT-1` vs `out-1`)

## Indicator Total Does Not Match Expected

### Cumulative vs Period Achievement

DonorDesk tracks two values:

| Value | What it means |
|-------|--------------|
| **Period achievement** | Just this reporting period |
| **Cumulative achievement** | Total from project start to now |

If your total is wrong, check which value is being displayed.

### How Values Are Calculated

The cumulative value is entered manually — DonorDesk does not auto-calculate it. If you entered period values and expected them to sum automatically, you need to update the cumulative field manually or use the import feature with cumulative data.

## Import from Google Sheets Not Working

### Codes Not Matching

The most common issue. Your spreadsheet codes must match DonorDesk exactly.

**To fix:**
1. Go to **Logframe** tab
2. Note the exact code for each indicator (e.g., `OUT-1`)
3. Make sure your spreadsheet has the same codes
4. Try importing again

### Empty Cells

If a cell is empty in your spreadsheet, DonorDesk may skip that row. Make sure all indicator rows have values.

### Wrong Column Mapping

When importing, make sure you map:
- Indicator code column → Indicator code
- Period value column → Period achievement
- Cumulative column → Cumulative achievement

## Indicator Shows 0 But Should Have a Value

1. Check if data was entered for this period
2. Check if the entry was saved (look for "Saved" confirmation)
3. Check if the entry was submitted and verified
4. Verify the indicator has a baseline and target set up

## Duplicate Indicator Entries

Each indicator should have **one entry per reporting period**. If you see duplicates:

This usually happens when:
- The indicator was updated twice
- An import was run twice

**To fix:**
1. Note which entry is correct
2. Delete the duplicate
3. Verify the correct entry

Duplicate entries may cause incorrect calculations in reports.

## Indicator Target Not Being Met

The indicator shows current achievement, but the target seems wrong:

1. Go to **Logframe** tab
2. Find the indicator
3. Click on it to see details
4. Check if **Target** is set correctly
5. If the target is wrong, an Admin can edit it

Note: Changing the target does not change past performance data.

## Who Can Update Indicators?

| Role | Can update | Can verify |
|------|-----------|-----------|
| Owner | ✓ | ✓ |
| Admin | ✓ | ✓ |
| Project Manager | ✓ | ✓ |
| M&E Officer | ✓ | ✓ |
| Field Officer | ✗ | ✗ |
| Grants Officer | ✗ | ✗ |
| Compliance Officer | ✗ | ✗ |
