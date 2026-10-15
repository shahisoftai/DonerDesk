# How to Add a Chart to a Report

**DonorDesk Version 2.002**

Charts in a report normally appear by themselves, one beside each table. When you want a chart of your own, for example monthly achievements of one indicator or budget against spending, build it in the **Data Center** and add it to a report section.

Who can: anyone who can edit reports (Admin, Project Manager, M&E Officer, Grants Officer). Adding a chart to a report that is not a draft needs an approver to reopen it first (see [How to reopen an approved report](/support/how-to/reopen-an-approved-report)).

## Build the chart

1. Open **Projects → your project → Data → Charts**.
2. Start from a **Quick start** (monthly achievement of an indicator, cumulative vs target, achievement vs target, progress of all indicators, budget vs expenditure) or pick a **Chart** yourself:

| Chart | Shows |
|---|---|
| One indicator over time | One indicator period by period, optionally with its target line. |
| One indicator: baseline, target and achievement | The latest value beside the baseline and target. |
| Progress of several indicators | Each chosen indicator as a percentage of its own target. |
| Several indicators over time | Compare indicators period by period. |
| Verification status of values | How many values are verified, in review or draft. |
| Budget vs expenditure | Budget and expenditure to date for each period (finance on). |
| Burn rate over time | Share of the budget spent, per period (finance on). |

3. Choose the **indicator(s)**, the **measure** (period value, cumulative value or % of target), the **period range** and the **chart type** (bar, line, area, pie, radar or gauge, depending on the chart).
4. Choose the **colours**: a ready-made set (Standard, Colour-blind safe, Ocean, Forest, Warm, Greys that print well), or one colour per series with the colour boxes underneath. Colours are saved with the chart and used in the report and in Word and PDF exports.
5. Optionally type your own **title**. The preview updates as you go.

DonorDesk keeps charts honest:

- A missing value is a **gap**, never 0.
- Indicators with different units are not drawn on one axis: they are shown as % of target, and a note says so.
- Rates are left out of progress charts.
- **Draft values are plotted too**, with a warning such as *2 of 4 plotted values are not verified yet*. Verify the values to clear it.

## Add it to a report

Under the preview, **Add this chart to a report**:

1. Choose the **Report**. Each report shows its state (draft, approved…). Reports that are locked say so, with a button to reopen them if you are an approver.
2. Choose the **Section** and, if you like, a **Caption**.
3. Click **Add to section**.

The chart is stored in the section **with the data it shows now**. It does not change by itself, so an approved report never changes silently. Text edits and regenerating the section keep the chart.

You can also add one from the report: open the section, the **Chart** tab, **Charts from the Data Center → Add chart**.

## Manage the charts in a section

In the report editor, open a section and its **Chart** tab. Each chart shows:

- **Up to date**, or **Data has changed** with an **Update** button that redraws it from the latest data (and **Cannot be redrawn** if, say, its indicator was retired; edit or remove it).
- **n of m not verified**, when it plots draft values. The report shows the same note under the chart.

Buttons: **Update**, **Edit** (change indicators, range, type, colours, caption), **↑ ↓** to reorder, **Remove**. Adding or changing a chart in an approved section reopens that section, and it needs approving again.

## Before you export

The export check lists, as warnings, charts that no longer match the data and charts that plot unverified values. They do not block an export, but fix them before a donor submission. Charts appear in the standard Word and PDF exports. The donor-template Word export does not draw charts.
