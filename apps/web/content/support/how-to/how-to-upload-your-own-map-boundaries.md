# Upload your own map boundaries

By default, DonerDesk maps draw the built-in world: country outlines and province borders. If your programme works with its own geography — districts, sub-districts, chiefdoms, project zones — you can upload your boundaries once, and every map in the workspace draws them instead.

## What you need

- **Administrator** access to the workspace (Settings is where the upload lives).
- **One GeoJSON file** with your boundaries — a `FeatureCollection` whose features each carry a shape (polygon). Most GIS tools, and free converters for Shapefile or KML, export GeoJSON. The file can be up to 12 MB.

## Upload the boundaries

1. Go to **Settings**.
2. Find the **Custom map boundaries** card.
3. Choose your `.geojson` (or `.json`) file.
4. Click **Upload boundaries**.

The card then shows the layer's name, how many boundaries it contains and its size. From that moment, every map in the workspace — the plan's **Map** view and the **Where we work** section on each project Overview — draws your boundaries instead of the built-in outlines.

## Replace or remove

- **Replace**: upload a new file the same way. The new layer takes over at once; there is exactly one layer per workspace, so there is never a mix.
- **Remove**: click *Remove the uploaded boundaries*. Maps go back to the built-in country and province outlines. Activities you pinned by hand keep their positions.

## Good to know

- **Nothing leaves your workspace.** The file is stored inside DonerDesk and drawn from there — no map provider sees your locations.
- **Every feature needs a shape.** The upload is checked before it is accepted; if a boundary in the file has no polygon, the upload tells you which one and nothing changes.
- **Pin places still work.** Activities whose location text matches a known town stay where they were; activities pinned by hand stay exactly where they were pinned. Your boundaries change the picture, not the data.
