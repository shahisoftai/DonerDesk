# How to Record a Figure for Each Place (and Get a Map)

A map shows results **by place**, so each figure must be recorded for a place. You do this once per indicator by turning on **record by place**. After that the Record panel and the entry screens ask for one number per place, add the total up for you, and the map has something to draw.

## Turn it on for an indicator

1. Open **Projects → your project → Plan → Results framework** and edit the indicator (its **Edit** link).
2. Tick **Record one figure for each place. The total is added up for you, and the map shows each place.**
3. Save. DonorDesk suggests the level to record at (for example districts) from the places the project already uses; you can change it. Indicators that add up (counts) are the ones it suggests turning on. A **calculated** indicator cannot be recorded by place, because its value is worked out, not typed. A **rate** can be recorded by place, but rates are never added up (see below).

If your project was set up with the wizard and you ticked places, the wizard already records every count by place for you.

## Enter the figures

1. Click **+ Record**, choose **A number** and pick the indicator ([How to record data](/support/how-to/record-data)). Under it you see one box for each place the project uses (the places in its plan or figures it already has).
2. Type a figure in each place that has one. An **empty box is left out**; it is never counted as 0.
3. To add a place that is not listed, type its name; DonorDesk matches it to your places list and never guesses.
4. For a count, the **total** is the sum of what you typed. For a rate, type the overall figure yourself: DonorDesk never adds or averages rates across places. Save as usual.

The same rows are on the report's indicator screen (**Breakdown**, by location) and in the offline pack for the field app.

## Start from a place instead

When you have been to one place and have several things to enter, start from the place:

1. Click **+ Record** and choose **Everything at a place**.
2. Choose the place (the one you used last is at the top; type to search). Choose the day: **Today**, **Yesterday** or **Pick a day**. The period follows from the day.
3. You see **Planned here** (your planned activities at that place, or a place inside it, in that period: tap one and answer **What happened?**) and **Figures for this place** (every indicator measured there, with what is already recorded).
4. Type the figures and press **Save**. Only the boxes you changed are sent. Each figure is added to that place only: someone entering another place at the same time does not overwrite you, and the indicator's total is added up from all places. If someone changed the same box since you opened it, nothing is saved and you are told to reload.
5. **Split this figure** (under a box) lets you split the place's figure by sex, age group, disability or another group. The groups must add up to the place's figure. When every place has the same split, the project-wide split is added up for you.

**Change place** keeps the day, so you can go from place to place. It works offline too, for the periods that are open now, once you have downloaded the project in the field app again.

## Enter every place at once (By place)

On a report's **Inputs → Indicators** screen, switch **By indicator** to **By place**. Rows are places, columns are the indicators measured by place, and the bottom row is the total. Type or paste a block straight from Excel; grey cells are locked or not measured at that place (—). **Save changes** sends only the changed cells.

**Download Excel** gives the same layout as a workbook (one tab per level of places). Fill the shaded cells, then **Upload Excel**: the file is checked first. If any cell is wrong, nothing is imported and every problem is listed. If all is well you see how many figures will change; nothing is saved until you press **Apply the file**. An empty cell leaves the stored figure as it is.

## See the map

Next to an indicator that is recorded by place, the results framework shows a **Map** link. It opens the map for that indicator, in grey with place names, the figures and a legend. See [How to see your work on a map](/support/how-to/use-the-maps-explorer).

An **empty map says why** and offers one button: for example *no places yet* (**Where we work**), *no indicator is recorded by place* (**Record every count by place**, which turns it on for every counting indicator that can be recorded by place), *no figures yet*, or *places to confirm*. To keep a map, **Add to a dashboard** puts it on a one-map dashboard.

## What it does not do

- Recording by place does not change the indicator's value for the period: the total is what is recorded, as before.
- A rate is shown for the place that reported it, never combined into a total; an area above shows none when several places reported.
- A place nobody reported is shown as **not recorded**, never as zero.
- A verified figure, a calculated indicator and a closed period cannot be changed from a place either; the reason is shown beside the figure.

See also [How to choose the areas a project works in](/support/how-to/choose-where-you-work) and [How to set up your places list](/support/how-to/set-up-your-places-list).
