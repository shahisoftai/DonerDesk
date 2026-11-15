# How to Bring In Your Own Table and Chart It (Datasets)

A **dataset** is a table you bring in, for example a monthly sheet of screening figures by district from the ministry or from DHIS2. DonorDesk reads it, checks it, matches its places and lets you chart, map and slice it on a dashboard, next to your own indicators. It is separate from indicator values: a dataset never changes an indicator unless you link a column to one yourself.

## Open Datasets

Click **Dashboards and infographics** in the left menu, then the **Datasets** tab. You see the datasets you can read and a **Bring in a table** button. A project can also have its own datasets: they appear on the project's **Data** tab once it has one (until then, under **Data → More → Datasets**).

## Bring in a table

1. Click **Bring in a table**. Drag an Excel or CSV file onto the box, or click **Choose a file** (.xlsx or .csv, up to 20 MB and 200,000 rows). Without a file, download a **kit template** (Nutrition or WASH) to see the columns.
2. The steps are shown across the top: **Add data → Choose the table → Confirm columns → Fix places → Tidy → Check → Done**.
3. **Choose the table**: if the workbook has several sheets, pick one.
4. **Confirm columns**: DonorDesk guesses what each column is (a place, a month, a number, a rate, a category) and what it means. Change anything that is wrong. A rate is never added up.
5. **Fix places**: place names are matched to your places list by code, then alias, then a name that is unique. A name that matches nothing, or several places, is shown for you to choose; nothing is guessed. Fix them under **Where we work → Manage places** later if you prefer.
6. **Tidy**: the cleaning steps applied to your table are listed in plain words. They are done again every time the dataset is refreshed with new data.
7. **Check**: problems that stop the save are listed (for example two rows with the same key). Warnings do not stop it.
8. **Done**: the dataset is saved. If its columns fit a sector kit, the **kit** is offered: it relabels the columns, adds its figures and checks, and can build a set of dashboard pages for you.

**People are never stored.** Columns that look like names, phone numbers or ID numbers are found and left out. If a dataset must hold personal data, an administrator has to mark it as **restricted** (with a lawful basis, a purpose, a day it is deleted and the people who may see it); a restricted dataset never goes on a share link, an embed or to Ask DonorDesk.

## The dataset page

Open a dataset to see its tabs: **Overview** (columns and figures, the data notes), **Versions** (the last ten; each new file adds one), **Indicators** (link a column to an indicator), **Sharing** and **Connector** (pull from DHIS2 on a schedule). Buttons at the top: **Build a chart**, **Add new data** (a new month or a corrected file), **Make dashboards from the … kit** and **Delete**.

Linking a column to an indicator writes **drafts** only. A value that is already verified is never overwritten; you are told instead.

## Use it on a dashboard

In a dashboard's editor, open **Add** and choose the data blocks: **Data visual** (a chart, a table, a card or a map), **Slicer** (a filter that narrows every dataset block on the page, but never its own column), **Data completeness** and **What differs**. A **map** visual is the Maps explorer: click an area to go down to its districts, and **View as a table** lists the same figures.

Rules that keep the numbers honest:

- Counts add up the place tree; a rate is worked out as the sum of the parts over the sum of the wholes for each area, never summed or averaged.
- A missing value is a gap, never zero. Rows whose place matched nothing are counted in a note, not spread over other places.
- On a share link, charts and maps are shown; partner, donor, money, hidden and restricted columns never are.

See also [How to make a dashboard](/support/how-to/make-a-dashboard), [How to use the Visual Studio](/support/how-to/use-the-visual-studio) and [How to set up your places list](/support/how-to/set-up-your-places-list).
