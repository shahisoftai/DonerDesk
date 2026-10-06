# How to Build a Logframe

The logframe (results framework) is the backbone of your reporting: goals, outcomes, outputs and activities, with indicators to measure them. Who can edit it: Admin, Project Manager and M&E Officer.

Open **Projects → your project → Logframe**.

## Option A: Import from Excel or CSV (fastest)

1. On the Logframe page click **Download template** and fill in the **Logframe** sheet (one row per item with its code, level, title and parent code).
2. Click **Import logframe from Excel** and upload the file (XLSX, CSV or TXT).
3. **Review the parsed content** shown on screen, then create the records.
4. Items are created with their parent links. Rows whose **code already exists are skipped**, so re-importing is safe.
5. Fill in the **Indicators** sheet and use **Import indicators from Excel**. By default an indicator's code must match a logframe item's code in this project. To put **several indicators under one item**, fill the optional **Logframe Code** column (the last column of the template) with the item's code; the indicator's own code can then be anything unique.

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
6. **Record a breakdown**: tick it to enter results split by sex, age group and disability. It is ticked for you when the unit counts people (people, households, children, participants…); untick it if you do not need it. The values grid then shows a **Breakdown** button. For Number and Currency indicators each breakdown must add up to the period total.

When you save, the page confirms where it went, for example *Indicator saved under Output 2.2*. Check that line: it is the quickest way to spot a wrong parent.

## Set how an indicator is calculated

Open an indicator and use **Calculation**:

- **Reporting basis:** *Reported directly (latest value)*, *Sum of period values* (counts that add up), *Average of values*, *Highest value*, *Lowest value*, or *Cumulative to date*.
- **Percentage / ratio:** choose the **numerator** and **denominator** indicators. Until this is set, these indicators show as "Not calculable" in reports.
- **Direction of progress:** Higher is better, Lower is better, or Neutral (descriptive only).

New drafts use the saved calculation.

## Fix a mistake without rebuilding

Wrong parent, typo in the target, breakdown missing, indicator no longer needed? Open the indicator and use **Edit indicator**: edit the fields, **Move indicator** to another logframe item, or **Remove indicator** (deleted if it has no values, archived if it has). See [How to fix, move or remove an indicator](/support/how-to/fix-or-remove-an-indicator).

## Indicator page

Each indicator page shows a **progress card** (share of the distance from baseline to target, and the latest period breakdown), a **history** of updates, and the **verification pipeline**.

## Tips

- Use short, stable codes (OUT-1, OC-2). They are used for imports.
- Fix baselines and targets before entering values.
- The project is not reporting-ready until it has at least one indicator and every quantitative one is complete. See [Understanding report readiness](/support/getting-started/report-readiness).
