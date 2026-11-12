# Analyse places on a map

The **Analyse** panel on a project's map answers three questions about the places that have a figure: what lies near them, how far the nearest health facility is, and how many people live around them.

## Before you start

- The places need a **pin**. Open **Settings → Places**, find the place and choose **Pin** (see [Pin a place on the map](./how-to-pin-a-place-on-the-map.md)).
- To see the nearest facility, mark the clinics, hospitals or schools you work with as facilities: in the same **Pin** box tick **This place is a facility**.

## Run an analysis

1. Open **Dashboards and infographics → Maps** and choose the project.
2. Open the country and go down to the level where your figures are (click a place in **Places in this project**, then **Open its provinces** or **Open its districts**). The **Analyse** panel appears only when places that **have a figure** are also **pinned**; until then you will not see it.
3. In the **Analyse** panel, type the distance under **Within … km** (0.1 to 100 km) and choose **Draw rings around N places with a figure**.

The map draws a ring around each place, and the panel lists:

- **People living within the rings**, from WorldPop population figures, with the source and year. A person inside two rings is counted once. When a ring crosses a border, only the people on the side whose figures are held are counted, and the panel says so.
- **Other places inside the rings**, nearest first.
- **The nearest health facility** for each place, as a straight-line distance.

**Clear** removes the rings.

## Good to know

- Distances are **straight lines**, not travel time: there is no road network behind them.
- Only places with a pin take part. A place without one is left out, never placed at a guess.
- Nothing in the panel is saved, and nothing is sent to a report.
- Population figures exist for the countries the organisation works in. Elsewhere the panel says they are not available yet.
