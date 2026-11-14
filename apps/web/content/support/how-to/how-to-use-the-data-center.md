# How to Use the Data Center

The **Data Center** shows every indicator value of a project, across all its reporting periods, in one place. Use it to see all months at once, spot gaps, download the whole sheet, fill in many values in Excel and import them back, and build charts for your reports.

Open **Projects → your project → Data** (the **Data Center** page is the first in the row under the tabs). Anyone who can see the project can view and download. Importing needs the right to enter indicator values (Admin, Project Manager, M&E Officer).

The Data Center has these tabs: **Indicator data**, **By place**, **Quick chart**, **Finance** (when finance is on) and **Import / export**. Buttons above them open the project's sister tools: **Chart Studio**, **Map** and **Bring in data**. The other Data pages are in the row under the project tabs: **Enter data**, **Import**, **Forms** and **Datasets** (once the project has one), and under **More**: **Data tables** (the old *Report builder*), **Charts** and **Maps**.

## By place

The **By place** tab reads each result at the places you choose. Under **Show results for**, pick **Country**, **State or province**, **District or locality**, **Sub-district** or **Community or site**. A locality's figures count toward its state and its country, and a place that recorded nothing is never shown as zero.

Results appear here only when values were recorded **with a breakdown by location**. Otherwise the tab says *No result of this project has been recorded by place yet* and lists them under **Not recorded by place**: they appear only as project totals. To fill it, enter a breakdown by location when you record a value ([How to update indicator values](/support/how-to/update-indicator-values)). See also [How to analyse places on a map](/support/how-to/analyse-places-on-a-map).

## Indicator data

Two layouts, switched at the top:

- **By period** has indicators down the side and one column per reporting period. Choose what to show: **Period value**, **Cumulative value**, **% of target** or **Variance from scheduled target**.
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

The **Quick chart** tab turns the same data into a chart you can put straight into a report section or a dashboard. For every chart type and style, press **Chart Studio** above the tabs. See [Build and style a chart in the Chart Studio](/support/how-to/use-the-chart-studio) for the 50 chart types, themes and style options, and [How to add a chart to a report](/support/how-to/add-a-chart-to-a-report) for putting a chart into a report section.
