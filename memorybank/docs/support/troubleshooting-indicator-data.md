# Troubleshooting Indicator Data

## I can't enter values

- You need permission: Admin, Project Manager or M&E Officer.
- The period must exist. Open the reporting period, then **Update Project**.
- If the report is already approved, values are locked for that version.

## "Could not save indicator data"

Check every row for the required fields and valid numbers (a percentage should be a number, a Yes/No indicator a yes or no). Fix the marked rows and press **Save all** again.

## Disaggregation errors

For **Number** and **Currency** indicators, each dimension (for example Female + Male) must add up to the period value. Correct the categories or the total. Percentage indicators do not need to add up.

## Google Sheets import failed

- "Could not read the spreadsheet" – share the sheet with the connected Google account and check the URL.
- The sheet needs a header row with an **indicator code** and **period achievement** column; codes must match DonorDesk exactly.
- Imported values are only applied to the grid. Press **Save all** to keep them.

## The report only "describes" an indicator and never says if it is on track

Its calculation is not confirmed. Look for **Calculation needs review** on the logframe page and click **Confirm calculation** (or **Confirm all**). A calculated rate with no numerator and denominator cannot be confirmed as suggested: either choose both indicators, or choose **latest reported value** if your team reports the rate directly.

## "Not calculable" for a percentage or ratio

Set the numerator and denominator indicators on the indicator page and **Save calculation**.

## A verified value went back to unverified or "stale"

Verification is tied to the value and evidence at the time. If either changed, DonorDesk asks you to verify again. Verify from the grid or the indicator's **Verification pipeline**.

## My value was sent back ("Needs correction")

The reviewer left a reason. Fix the value or attach better evidence and resubmit.

## Progress looks wrong

- Check baseline and target are numbers (progress cannot be drawn otherwise).
- Check **Reporting basis** and **Direction of progress**.
- Check the **History** for earlier entries.

## Reports show different numbers from the grid

Reports use **verified** data. Verify the latest values, then re-check the report ("Inputs changed" banner).
