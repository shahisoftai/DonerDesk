# How to Import Indicator Data from Google Sheets

If your organisation tracks indicator data in Google Sheets, you can import it directly into DonorDesk instead of entering it manually.

## Before You Start

- You need a Google Sheets file with indicator data
- The file must have an **indicator code column** that matches your DonorDesk indicator codes
- You need to have created your reporting period and indicators in DonorDesk first

## Step-by-Step

### Step 1: Open the Indicator Grid

1. Go to your project → **Reports** tab
2. Open your reporting period
3. Click **Indicators** tab
4. Click **Import from Google Sheets**

### Step 2: Connect Google Drive (First Time Only)

If this is your first import:
1. Click **Connect Google Drive**
2. Authorise DonorDesk to access your Google Sheets
3. Grant the required permissions

### Step 3: Select Your Spreadsheet

1. Browse your Google Drive
2. Find and select your Google Sheets file
3. Click **Select**

### Step 4: Map the Columns

DonorDesk will show a preview of your spreadsheet. Map the columns:

| DonorDesk field | What to select from your spreadsheet |
|-----------------|-------------------------------------|
| **Indicator code** | Column with codes like "OUT-1", "IND-3" |
| **Period achievement** | Column with the value for this period |
| **Cumulative achievement** | (Optional) Column with running total |
| **Comments** | (Optional) Column with notes |

Make sure the indicator codes in your spreadsheet **exactly match** the codes in DonorDesk (same format, no extra spaces).

### Step 5: Preview the Data

Review the preview table:
- Green rows = matched and ready to import
- Yellow rows = partial match (review carefully)
- Red rows = not found (indicator code not in DonorDesk)

### Step 6: Apply to Grid

Click **Apply to Grid**.

The values are imported as **drafts** (not yet submitted).

### Step 7: Review and Submit

1. Check the imported values in the grid
2. Make any corrections needed
3. Submit each row (or use bulk submit)
4. Verify (if you have verification permissions)

## Tips for a Smooth Import

### Prepare Your Spreadsheet

Before importing:
- Remove any header rows that are not data
- Make sure indicator codes match DonorDesk codes exactly
- Remove any rows that do not have indicator codes
- Check for extra spaces or special characters in codes

### Good spreadsheet format:

| indicator_code | period_value | cumulative | comments |
|---------------|-------------|------------|----------|
| OUT-1 | 450 | 1200 | Q3 data from DHIS2 |
| OUT-2 | 120 | 350 | Survey results |
| ACT-1 | 15 | 45 | |

### Codes Must Match Exactly

| DonorDesk code | Your spreadsheet code | Will it import? |
|---------------|---------------------|----------------|
| OUT-1 | OUT-1 | ✓ Yes |
| OUT-1 | OUT-1 (extra space) | ✗ No |
| OUT-1 | out-1 | ✗ No |
| OUT-1 | "OUT-1" | ✗ No |

## Updating Previously Imported Data

If you have already imported data and want to update it:

1. Make your changes in Google Sheets
2. Go back to the import function
3. Select the updated file
4. Map columns again
5. Apply

The new values will overwrite the old drafts. Already-verified rows will need to be unlocked first.

## Troubleshooting

### "No matching indicators found"

Your spreadsheet codes do not match DonorDesk codes. Check for:
- Typos or extra spaces
- Different formatting (e.g., "OUT 1" vs "OUT-1")
- Rows without codes in the header

### "Some rows could not be imported"

Some indicators were not found. Check the red rows in the preview. You can still import the matched rows.

### Import overwrites my verified data

Verified rows are locked. You must first unlock them (click Unlock, then verify again after importing).
