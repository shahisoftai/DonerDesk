# How to Update Indicator Values

Indicator values are entered **per reporting period**, in a spreadsheet-style screen called **Report inputs**, or one at a time with **Record**.

Who can enter values: Admin, Project Manager and M&E Officer. Who can verify: Admin, Project Manager and M&E Officer.

## Quick way: one number from anywhere

For a single figure, you do not need to open the report. Click **+ Record** in the top bar (or use the project's **Data → Enter data** page), choose **A number**, and follow [How to record a number, an activity, a file or an expense](/support/how-to/record-data). It works out the reporting period from the date you pick.

## Open the full entry screen

1. Go to **Projects → project → Reports** and open the reporting period. The bar at the top of the report shows four stages: **Inputs → Story → Draft → Review and export**, with one blue button for the next step. Click **Inputs**, or, in **Ready to write this report**, click **Review data** beside **Indicator values**.
2. The page is called **Report inputs**. It has three tabs: **Indicators** (with how many are verified), **Story** and **Files**. You are on **Indicators**.

If there is no reporting period yet, create one first ([How to create a reporting period](/support/how-to/create-a-reporting-period)).

The line **Entry closed on …** (or **Entry opens/closes …**) shows the entry window. **Change the entry window** adjusts it (project managers and admins). People who can verify values are not held to the window.

## Two views: Sheet and Form

Under **View**, choose how you want to work.

- **Sheet** is like a spreadsheet, best for many rows. Columns: **Code**, **Indicator**, earlier months, **Baseline**, **Target**, **Last period**, **This period**, **Cumulative**, **Notes**, **Data source**, **% of target**, **Status**. Click a cell and type. Arrow keys and Tab move between cells. You can paste a block of cells from Excel straight in, and use **Fill down**, **Clear**, **Undo** and **Redo**. **Find** and **Go to** jump to an indicator, **Show** filters rows (for example only figures still empty), and **Columns**, **Row height** and **Zoom** change how it looks. Tick **Save automatically** to have drafts saved a couple of seconds after your last change. Cells you cannot change (verified, calculated or closed) are locked.
- **Form** is one row per indicator with **Period achievement**, **Cumulative**, **Comments**, **Data source**, a **Breakdown (n)** button and **Not applicable this period**.

## By indicator or By place

Above the figures, **By indicator** shows one row per indicator (the Sheet and Form views above). **By place** shows one row per place and one column per indicator measured by place, with a **Total** row at the bottom. Type in a cell, or paste a block copied from Excel: it fills to the right and down and skips grey cells. Grey cells are locked or not measured at that place (—). Click **Save changes**; only the cells you changed are sent, and each indicator's total is added up from the places.

**Download Excel** gives the same layout as a workbook, one tab per level of places. Fill the shaded cells and use **Upload Excel**. The file is checked first: if any cell is wrong nothing is imported and every problem is listed. Otherwise you see how many figures will change, and nothing is saved until you click **Apply the file**. An empty cell leaves the stored figure as it is.

If someone else changed a figure since you opened the page, your save is refused and names it; click **Reload** to see their figure. DonorDesk remembers on this device which view you used last. More in [How to record a figure for each place](/support/how-to/record-figures-by-place).

## Enter values

1. Each row is an indicator. Type the value for **this period**, and, where relevant, the **data source** and a note.
2. If the indicator has a **breakdown** (the **Breakdown** button shows on its row), enter values by category (for example Female / Male); for Number and Currency indicators each dimension must add up to the total.
3. If an indicator does not apply this period, choose **Not applicable** and give a reason. It is not counted as a gap or as 0.
4. Leave a value **empty** if it was not measured. An empty value is never saved as 0.
5. Click **Save all**. Values are saved as drafts. Each indicator has one value per period, so saving again updates it.
   - **Same as last period (n)** appears under an empty value when the indicator had a value last period; click it to repeat that figure.
   - For indicators whose values **add up** (calculation *Sum of period values*), the **Cumulative** box fills in by itself: last period's running total plus what you typed. If you type your own cumulative figure it is never replaced.
   - The **data source** carries forward from the last period, so you only change it when it changes.
6. Click **Submit for review (n)** to hand in the values that have a figure. If your project uses **simple review**, hand-in and verification happen for you when you save and a file is attached.
7. If you may verify values, click **Verify all (n)** (or **Verify selected**). Rows that cannot be verified are listed with the indicator code and the reason; the others are still verified. If the reason is that a value needs a file behind it, the message has an **Attach the files** button: it opens a panel where you choose a file for each value; each file is uploaded for this period and indicator, verified (if you may verify files) and the value is verified in the same step. A verifier can also **send values back** with a reason, or use **Reopen verified (n)** to take verified values back to "needs correction" (the report must not be approved yet).

Under each indicator the badge shows whether its **calculation is confirmed**. See [Understanding indicators and targets](/support/getting-started/indicators-and-targets).

If a note appears under a row such as *Linked activities record 412 participants; the indicator says 380*, it is only a prompt to check: people may attend more than one activity, so the figures can legitimately differ.

## See every month at once

The **Data Center** (**Projects → project → Data**) shows all periods in one sheet, lets you download it as Excel or CSV, and can import values back from a file. See [How to use the Data Center](/support/how-to/use-the-data-center).

## Import instead of typing

- **Google Sheets:** click **Import from Google Sheet**, paste the sheet's URL. The sheet must be shared with the connected Google account and have a header row with the indicator code and period achievement (cumulative, comments and data source columns are optional). Values are applied to the grid; review them and press **Save all** to keep them. **Download Excel** and **Import Excel** do the same with a workbook: the workbook has dropdown checks, and an empty cell stays empty. See [How to import from Google Sheets](/support/how-to/import-from-google-sheets).
- **Excel or CSV of all periods:** download the data sheet from the **Data Center**, fill the shaded columns and import it; a preview shows every change first. Verified values are never overwritten.
- **Another file:** open **Projects → project → Data → Import**, choose **Indicator values**, and follow the screen. Every import checks each row before anything is saved. See [How to bring in data](/support/how-to/bring-in-data).

## Verify

Each update moves through a **verification pipeline**:

| Status | Meaning |
|---|---|
| Draft | Entered but not submitted. |
| Submitted | Ready for a reviewer. |
| Verified | Checked against evidence. Only verified values are treated as verified findings in reports. |
| Needs correction | The reviewer asked for a fix (with a reason). |
| Rejected | Not accepted. |

Verify one value, or use **Verify all**, from the grid; request a correction from the grid or the indicator page. The report uses verified data to build tables, charts and comparisons, and unverified figures are marked in the report.

## Link evidence

Attach evidence to the value so reviewers and the AI Reporter can cite it. See [How to upload evidence](/support/how-to/upload-evidence).

## History

Open an indicator to see the **history** of every update: value, who entered it, the verification decisions and comments.

## Tips

- Enter the value for **this period** only; the calculation setting handles cumulative or summed totals.
- Verified data that later changes becomes **stale**, and you are asked to re-verify.
