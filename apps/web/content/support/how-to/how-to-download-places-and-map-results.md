# Download places and map results

You can take your places and your results by place into a spreadsheet or a GIS tool (QGIS, ArcGIS, Google Earth).

## The places list

On **Settings → Places**, next to **Your places**, choose:

- **CSV (spreadsheet)**: every place with its level, the place it sits inside, its code, its pin and its other spellings. The columns are the ones the places import reads, so you can edit the file and bring it back in through **Import places**. Importing adds new places; it does not change places that already exist.
- **GeoJSON (for GIS tools)**: the places that have a pin. The file says how many were left out for having none.

## Results by place

Under a project's map, **Download these results** gives the indicator you are looking at, at the level shown and for the period chosen:

- **GeoJSON** for GIS tools (places with a pin),
- **CSV** for a spreadsheet.

A place nobody reported is left empty, never written as 0, and each figure says whether it is verified.

## For other systems

The same files are available through the public API with a key that may read **Results by place**: `/api/v1/places` (add `?format=csv` for CSV) and `/api/v1/projects/<project>/place-results?format=geojson&indicatorId=<indicator>`. See the integrations article for how to create a key.
