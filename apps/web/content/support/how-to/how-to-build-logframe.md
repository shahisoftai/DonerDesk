# How to Build a Logframe

The logframe (results framework) is the backbone of your reporting: goals, outcomes, outputs and activities, with indicators to measure them. Who can edit it: Admin, Project Manager and M&E Officer.

Open **Projects → your project → Plan → Results framework**.

## Option A: Import from Excel or CSV (fastest)

1. On the **Results framework** page click **Download template** and fill in the **Logframe** sheet (one row per item with its code, level, title and parent code).
2. Click **Import logframe**, then **Upload Excel/CSV** and choose the file (XLSX, CSV or TXT).
3. **Review the parsed content** shown on screen, then create the records.
4. Items are created with their parent links. Rows whose **code already exists are skipped**, so re-importing is safe.
5. Fill in the **Indicators** sheet and import it from the indicators import screen (**Import indicators** on the Logframe page, then **Upload Excel/CSV**). By default an indicator's code must match a logframe item's code in this project. To put **several indicators under one item**, fill the optional **Logframe Code** column (the last column of the template) with the item's code; the indicator's own code can then be anything unique.

## Option B: Paste or dictate your results list

On the same import screen you do not need a file. Type, paste or dictate your results list into the box: one line per result, starting with its level (**Goal**, **Outcome**, **Output**, **Activity**) or a code such as *1.1.2*, indented to show what sits under what:

```
Goal: Improved child health in Kisumu County
  Outcome 1: Fewer children under five with diarrhoea
    Output 1.1: 40 water points rehabilitated
      Activity 1.1.1: Train water committees
```

Edit the text if needed, then click **Create logframe items**. The same screen (file, paste or dictate) is used to import indicators, evidence records and activities.

## Option C: Reuse another project's logframe

When a project's logframe is empty and your workspace has other projects, the Logframe page offers **Reuse another project's logframe**. Choose the project and click **Copy logframe and indicators**. The results hierarchy and the indicator definitions (codes, targets, units, frequency, calculation) are copied. **Recorded values, evidence, activities, retired indicators and who is responsible are not copied.** Copying is only offered into an empty logframe, so nothing is duplicated. You can also do this while [creating a project](/support/how-to/create-a-project).

## Option D: Choose from the sector library

Click **Choose from the library** on the Logframe page for ready-made results and indicators for your sector, each with its definition and how it is usually collected. Nothing is added until you press **Add**; each indicator arrives with no baseline or target, and starts as **not yet reviewed**. See [The sector library](/support/getting-started/sector-library).

## Option E: Build by hand

1. Click to add a logframe item. Choose its **level** (Goal, Outcome, Output or Activity), give it a **code** and title, and pick its **parent** with the item picker.
2. Add child items under each parent.
3. Add indicators (see below).

## Add the reasoning and the assumptions

Select **Edit** on any result to correct its title or description, and to write **why it leads to the result above it** and **what must hold** for it to do so (its assumptions). When you add a result, open **Logic (optional)** to write them straight away. Both are optional, and they are kept with each version of the framework. An Excel or CSV import also reads optional **Assumptions** and **Rationale** columns when your sheet has them.

## Read it as a Results Framework or a Logframe

Above the hierarchy, choose **Results framework** or **Logframe**. It is the same set of results and indicators, shown two ways:

- **Results framework**: Goal, Outcome and Output with the reasoning behind each, and the indicator names. Activities are left out.
- **Logframe**: every level with each indicator's baseline, target, unit, means of verification, data source and frequency, and the assumptions.

A value nobody has set shows as a dash, never as zero. **Download Word** and **Download PDF** (for people who can export) give you the same table as a file.

## Use your donor's words

In **Settings → Setup → Reporting profile → Results framework wording**, choose your donor's terms (for example USAID, FCDO, European Union, United Nations) or type your own. The levels, the page headings and the downloaded files then use those words. Your results and indicators are not changed; only the words on screen are.

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

Wrong parent, typo in the target, breakdown missing, indicator no longer needed? Open the indicator and use **Edit indicator**: edit the fields, **Move indicator** to another logframe item, or **Remove indicator** (deleted if it has no values, archived if it has; archived ones can be restored from the Logframe page). See [How to fix, move or remove an indicator](/support/how-to/fix-or-remove-an-indicator).

## Indicator page

Each indicator page shows a **progress card** (share of the distance from baseline to target, and the latest period breakdown), a **history** of updates, and the **verification pipeline**.

## Tips

- Use short, stable codes (OUT-1, OC-2). They are used for imports.
- Fix baselines and targets before entering values.
- The project is not reporting-ready until it has at least one indicator and every quantitative one is complete. See [Understanding report readiness](/support/getting-started/report-readiness).
