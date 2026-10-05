# How to Update Indicator Values

Indicator values are entered **per reporting period** in a spreadsheet-style grid. This is step **1. Update Project** of the reporting workspace.

Who can enter values: Admin, Project Manager and M&E Officer. Who can verify: Admin, Project Manager and M&E Officer.

## Open the grid

1. Go to **Projects → project → Reporting** and open the reporting period.
2. Click **Update Project** (step 1) to open **Record indicator values for this reporting period**.

If there is no reporting period yet, create one first (see [Understanding reporting periods](/support/getting-started/understanding-reporting-periods)).

## Enter values

1. Each row is an indicator. Type the **Period achievement** and, where relevant, the **source of the figure** and a comment.
2. If the indicator has a **disaggregation**, enter values by category (for example Female / Male); for Number and Currency indicators each dimension must add up to the total.
3. Click **Save all**. Values are saved in one bulk operation. Each indicator has one value per period, so saving again updates it.
4. If you may verify values, click **Save & verify all** to save and verify everything in the period in one step. When nothing is unsaved the button reads **Verify all (n)**. Rows that cannot be verified are listed with the indicator code and the reason; the others are still verified.

Under each indicator the badge shows whether its **calculation is confirmed**. See [Understanding indicators and targets](/support/getting-started/indicators-and-targets).

If a note appears under a row such as *Linked activities record 412 participants; the indicator says 380*, it is only a prompt to check: people may attend more than one activity, so the figures can legitimately differ.

## Import instead of typing

- **Google Sheets:** click **Import from Google Sheets**, paste the sheet's URL. The sheet must be shared with the connected Google account and have a header row with the indicator code and period achievement (cumulative, comments and data source columns are optional). Values are applied to the grid; review them and press **Save all** to keep them. See [How to import from Google Sheets](/support/how-to/import-from-google-sheets).
- **Spreadsheet or pasted CSV:** on the report's **Data & story inputs** page you can paste CSV such as `Indicator code,Period achievement` or upload a file, and DonorDesk proposes inputs that you confirm before they are saved.

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
