# How to Use the Data Center

The **Data Center** shows every indicator value of a project, across all its reporting periods, in one place. Use it to see all months at once, spot gaps, download the whole sheet, fill in many values in Excel and import them back, and build charts for your reports.

Open **Projects → your project → Data**. Anyone who can see the project can view and download. Importing needs the right to enter indicator values (Admin, Project Manager, M&E Officer).

## Indicator data

Two layouts, switched at the top:

- **By period** has indicators down the side and one column per reporting period. Choose what to show: **Period value**, **Cumulative value** or **% of target**.
- **List** has one row per indicator per period, with the period value, cumulative value, % of target, verification status and data source.

Narrow what you see with **Find indicator** (code or name), **Level** (goal, outcome, output, activity) and, in the list, **Period**.

Things worth knowing:

- An empty cell shows **—**. It means nothing is recorded. It is never counted as 0.
- Percentage and ratio indicators (rates) have no **% of target**: a rate is a level, not progress toward a count.
- To **change** a value, click the period's column heading (or **Edit** in the list). That opens the period's grid, where values are entered, reviewed and verified. The Data Center itself does not edit cell by cell.
- Click an indicator code to open the indicator's page and history.

## Finance

The **Finance** tab appears when the project's finance mode is on. It lists budget, expenditure to date, committed amounts, balance and burn rate for each period that has figures, and whether they are verified. Finance is reported on quarterly and longer reports, so monthly periods usually have none. Click **Edit** to open the period's finance inputs.

## Download

- **Download CSV** saves the layout and filters you are looking at.
- **Download Excel** (also under **Import / export**) saves the whole project: an **Indicators** sheet (one row per indicator per period, including empty ones), a grid each for period value, cumulative value and % of target, and a **Finance** sheet when there are figures.

## Fill in or correct many values at once (import)

1. Open **Import / export** and download the Excel file.
2. In the **Indicators** sheet, change the shaded columns: **Period value**, **Cumulative value**, **Data source**, **Comments**. Leave the others as they are; they identify the row.
3. Back on the page, choose the file (.xlsx or .csv, up to 10 MB and 20,000 rows) and click **Check file**.
4. Read the preview. It shows each change as *old → new*. Then click **Save n changes**.

How the import behaves:

- Rows are matched on the **indicator code** plus the **period** (the period dates, or its name).
- An **empty cell leaves the stored value as it is**. It never clears a value.
- A value that is not a number, an unknown indicator code, an unknown period or a closed period is refused with the reason next to the row. **While any row has a problem nothing is saved**; fix or delete those rows and check the file again.
- A **verified** value is never overwritten. Such rows show *Verified: left as it is* and do not stop the rest. To change one, ask a reviewer to send it back for correction first.
- New and changed values arrive as **drafts**. Verify them afterwards in the period grid.
- Finance figures are not imported here; enter them on the period's finance inputs.

Every saved value is recorded in the audit trail like any other entry.

## Build a chart

The **Charts** tab turns the same data into charts. See [How to add a chart to a report](/support/how-to/add-a-chart-to-a-report) for the options and for putting a chart into a report section.
