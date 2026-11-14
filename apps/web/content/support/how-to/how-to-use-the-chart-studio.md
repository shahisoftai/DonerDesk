# Build and style a chart in the Chart Studio

The Chart Studio turns a project's recorded figures into a chart you can restyle as much as you like. Open it from **Dashboards and infographics → Tools ▾ → Chart Studio**, or from a project's **Data** tab (the **Chart Studio** button above the Data Center tabs, or **More → Charts**). Maps of results by place are under **Tools ▾ → Maps** and work the same way.

A chart keeps only the choices you make, never the figures. Every time it is opened it is drawn again from the recorded values, so it cannot go out of date.

## 1. Choose the data

On the left, under **Data**:

1. **Data shown**: one indicator over time, several indicators over time, progress of several indicators, one indicator's baseline, target and achievement, verification status, budget and spending, the work plan, completed activities by day, the budget flow, or results by place.
2. Tick the **indicators** to draw (the list can be searched).
3. Choose a **Measure** (the period's value, cumulative, or percent of target), a **first and last period**, and whether values that are **not verified yet** are drawn. They are always flagged and counted in a note under the chart.

## 2. Choose the chart type

On the right, under **Chart type**, the types are grouped by what they are good at: compare, trend, parts of a whole, distribution, relationship, flow, progress, schedule, map and combination. A type is greyed out when the data you chose cannot honestly be drawn that way (point at it to see why). There are 50 types. They include:

- **Bars** (vertical, horizontal, grouped, stacked, 100% stacked), lollipop, bullet, dot plot, **range bars** and **radial bars**.
- **Lines and areas**, step lines, sparklines, slope charts, a calendar of activity days, a **range band** and a **stream**.
- **Pie, donut, rose, treemap, sunburst, waffle** and a **tree** of indicators by logframe level.
- **Pictorial bars**, where each icon stands for a stated number of people, houses or litres, and the exact figure is written at the end of the row.
- **Gauge, fill gauge, progress ring, progress bars** and **progress rings** for several indicators at once.
- Histogram, box plot, scatter, bubble, **parallel coordinates**, heatmap, funnel, waterfall, Sankey, a **network** of donors and categories, a Gantt of the work plan, tables, and maps (colour by country, symbols by place).

Some new types use two indicators you choose. A **range band** or **range bars** show the span between a lower and a higher indicator at each period; they never invent an interval.

### When a chart is refused

DonorDesk will not draw a chart that would mislead, and says why in plain words, often with a one-click fix. For example: two different units on one axis (offer to show them as percent of target), a rate (a percentage or ratio) stacked or sliced, a funnel that grows, a bar axis that does not start at zero, or a log axis with a zero. **A missing value is a gap, never a zero.**

## 3. Look and feel

Open **Look and feel** on the right. It has two parts.

**Theme.** Choose a theme to start from. There are 40: DonorDesk's own (**DonorDesk**, **DonorDesk Modern**, **DonorDesk Print**, which adds patterns so it reads in black and white, and **DonorDesk Quiet**) and the stock Apache ECharts themes. A theme sets the colours and some line settings. Colours that would be too pale or too dark to read are adjusted so every theme stays readable in light and in dark mode. Applying a theme is one edit: **Undo** takes it back, and **Reset all style** returns to DonorDesk's default look.

**Options.** Below the theme are the options, grouped by the part of the chart they change (text, background, title, plot area, horizontal and vertical axes, bars, lines, areas, pie and donut, icons, points, labels, legend, hover box, marked values, effects, gauge, heat colours, radar, funnel, flow, map, interaction and animation). Only the groups that suit the chart type you chose are shown. Examples:

- **Bars**: width, space between bars, rounded ends, a colour fade, a faint full-size bar behind, an outline.
- **Axes**: label size and angle, which labels to show, longest label, number of steps, gridlines (solid, dashed, dotted or none), alternating bands, and text **before and after each value** (for example a currency sign or a unit).
- **Marked values**: mark the highest, lowest and latest value and draw the average. These are not offered for stacked bars, waterfalls, histograms, bullets and slope charts, where they would mislead.
- **Effects**: a soft shadow, mark strength, what to highlight on hover, and **Patterns as well as colour**, which helps readers who cannot tell colours apart and black-and-white print.
- **Gauge**: dial thickness and angles, and up to five **colour bands** (each ends higher than the one before, up to 100).
- **Icons**: the icon of a pictorial bar or fill gauge (person, house, drop, circle or square).

Every box shows the default as its placeholder. **Leave a box empty to keep the default.** A group that has settings shows how many; **Reset this group** clears just that group. A value outside the allowed range is refused on the page and the chart cannot be saved until it is fixed. If you change the chart type, settings the new type cannot use are removed so the chart can still be saved.

**Click the chart.** Click a bar, a line, a pie slice, the title or an axis and its group of options opens.

**Screen only.** A **zoom bar**, a **save-as-picture button** and the **delay between marks** appear on screen. They are never in a downloaded picture, a report or a file.

The option names are shown in English, French, Spanish and Arabic (the translations are drafts).

## 4. Save, download and share

- **Save** a chart for yourself or share it with the project. Each save keeps the last 10 versions; you can restore one.
- **Undo** and **Redo** step back and forward through your edits (50 steps).
- **Download** the picture as **PNG** or **SVG**, or the plotted data as **CSV**. The picture is drawn from the same settings as the screen, without zoom bars.
- To show a chart on a dashboard, open **Use in a dashboard**, choose the dashboard and add it. It appears at the bottom of that dashboard. See [Make and share a dashboard](/support/how-to/make-a-dashboard).

## Good to know

- On a **dashboard or in a downloaded file**, the figures on an axis with text before or after each value are written plainly (without thousands separators).
- A file (an infographic or a printed dashboard) uses your organisation's brand colours for the default palette, and **keeps the colours of a theme or palette you chose**.
- In a canvas or infographic's **Design check**, a chart with five or more colours and no patterns gets a tip, and a chosen colour that is too pale to see on white gets a warning.
- Words and sentences the chart writes for itself (its description and notes) are in English.

For charts inside a donor report, see [How to add a chart to a report](/support/how-to/add-a-chart-to-a-report).
