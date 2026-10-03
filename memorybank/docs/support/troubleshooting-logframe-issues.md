# Troubleshooting Logframe Issues

## The logframe import created nothing

- "No new items were created. Existing codes are skipped; check the file for parseable rows." – rows whose code already exists are skipped. Use the **Logframe** sheet of the downloaded template (XLSX, CSV or TXT).
- Check the header names and that every row has a code, a level (Goal, Outcome, Output or Activity) and a title.
- Parent codes must exist in the file or the project.

## The indicator import created nothing

- "No new indicators were created… check that each indicator code matches a logframe item code in this project." – import the logframe first, then indicators using the **Indicators** sheet.
- Existing indicator codes are skipped.

## I can't drag an item

Drag-and-drop needs edit permission (Admin, Project Manager or M&E Officer). Use the **Move to** menu (including **top level**) as an alternative.

## I can't add an indicator

You must choose the logframe item it measures first. Create the item, then add the indicator.

## "Not calculable" in reports

Percentage and ratio indicators need a calculation. Open the indicator, choose the **numerator** and **denominator** indicators and **Save calculation**.

## Values look wrong in reports

- Check the **Reporting basis**: summed, average, highest, lowest, cumulative or latest value.
- Check **Direction of progress** (Higher is better / Lower is better).
- Use the indicator's **History** to see what was entered.

## The project is not reporting-ready because of indicators

Every quantitative indicator needs **baseline, target, unit and frequency**. See [Troubleshooting project setup](/support/troubleshooting/project-setup).

## Disaggregation does not add up

For Number and Currency indicators each breakdown must equal the period total. Fix the categories or the total.
