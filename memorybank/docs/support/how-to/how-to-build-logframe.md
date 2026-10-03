# How to Build a Logframe

The logframe (results framework) is the backbone of your reporting: goals, outcomes, outputs and activities, with indicators to measure them. Who can edit it: Admin, Project Manager and M&E Officer.

Open **Projects → your project → Logframe**.

## Option A: Import from Excel or CSV (fastest)

1. On the Logframe page click **Download template** and fill in the **Logframe** sheet (one row per item with its code, level, title and parent code).
2. Click **Import logframe from Excel** and upload the file (XLSX, CSV or TXT).
3. **Review the parsed content** shown on screen, then create the records.
4. Items are created with their parent links. Rows whose **code already exists are skipped**, so re-importing is safe.
5. Fill in the **Indicators** sheet and use **Import indicators from Excel**. Each indicator's code must match a logframe item's code in this project.

## Option B: Build by hand

1. Click to add a logframe item. Choose its **level** (Goal, Outcome, Output or Activity), give it a **code** and title, and pick its **parent** with the item picker.
2. Add child items under each parent.
3. Add indicators (see below).

## Rearranging the hierarchy

The **Logframe hierarchy** is a tree. Drag an item to reorder it or drop it under another item to change its parent. There is also a **Move to** menu (including "top level") for keyboard and touch use. The order you set is kept.

## Add an indicator

1. Click **New indicator** and pick the **logframe item** it measures.
2. Enter the **indicator name** and type: Number, Percentage, Yes/No, Text, Ratio, Currency or Custom.
3. Set **baseline**, **target**, **unit** and **frequency**. All four are required for a quantitative indicator before the project can be reporting-ready.
4. Optionally add **data source** and **means of verification**.
5. For percentage and ratio indicators you are taken to **set the calculation** (see below).
6. **Disaggregation** (Sex, Age group, Disability, Location or Other): add a dimension with categories (for example Female/Male). Values can then be entered per category. For Number and Currency indicators each breakdown must add up to the period total.

## Set how an indicator is calculated

Open an indicator and use **Calculation**:

- **Reporting basis:** *Reported directly (latest value)*, *Sum of period values* (counts that add up), *Average of values*, *Highest value*, *Lowest value*, or *Cumulative to date*.
- **Percentage / ratio:** choose the **numerator** and **denominator** indicators. Until this is set, these indicators show as "Not calculable" in reports.
- **Direction of progress:** Higher is better, Lower is better, or Neutral (descriptive only).

New drafts use the saved calculation.

## Indicator page

Each indicator page shows a **progress card** (share of the distance from baseline to target, and the latest period breakdown), a **history** of updates, and the **verification pipeline**.

## Tips

- Use short, stable codes (OUT-1, OC-2). They are used for imports.
- Fix baselines and targets before entering values.
- The project is not reporting-ready until it has at least one indicator and every quantitative one is complete. See [Understanding report readiness](/support/getting-started/report-readiness).
