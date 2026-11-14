# How to Import Indicator Data from Google Sheets

If you track indicator data in Google Sheets you can import it into a reporting period instead of retyping it.

## Before you start

- Your workspace's **Google account is connected** (see [How to connect Google Drive](/support/how-to/connect-google-drive)).
- The indicators already exist in DonorDesk with codes such as OUT-1.
- The reporting period exists.
- The sheet is **shared with the connected Google account**.
- The sheet has a **header row** with an **indicator code** column and a **period achievement** column. Optional columns: cumulative, comments, data source.

You need permission to enter indicator data (Admin, Project Manager or M&E Officer).

## Steps

1. Go to **Projects → project → Reports** and open the reporting period.
2. Click **Enter data** (or **Review data**) beside **Indicator values** to open the **Report inputs** page.
3. Click **Import from Google Sheets**.
4. Paste the sheet's URL (`https://docs.google.com/spreadsheets/d/...`) and read it.
5. The values are applied to the grid ("Spreadsheet applied to the grid"). **Review the values**, correct anything, and press **Save all**.

Nothing is stored until you press Save all.

## If the import fails

- **"Could not read the spreadsheet"** – share the sheet with the connected Google account and check the URL.
- **Rows do not appear** – check that the header row exists and that the indicator codes match the codes in DonorDesk exactly.

You can also import from Excel: for indicators use **Import indicators from Excel** on **Plan → Results framework**, and for period values use **Import Excel** on the report's **Report inputs** page (the **Indicators** tab), or the Data Center's **Import / export**. See [Data import and export](/support/advanced-features/data-import-export).
