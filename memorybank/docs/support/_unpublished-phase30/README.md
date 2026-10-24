# Support articles for the site maps — NOT PUBLISHED

These articles describe the maps feature (Phase 30 + batch 30.1, built 2026-10-24): the **Map** view on the plan, the **"Where we work"** section on the project Overview, **custom map boundaries** (Settings), and **pinning a place by hand** from the activity form. The feature is browser-verified on the local workspace with the demo tenant; nothing here is public.

## Publish checklist (do all of it at deploy, after the browser check on the live site)

1. Deploy per `../../imp/phase30-maps.md` §10 / `../../Features/43-Site-Maps.md` §5: migration `20261024090000_map_layers_and_pins` first, then `infra/postgres/rls.sql`, then api + web together.
2. Check these screens in a browser with a real login on the live site: the plan Map view, the Overview "Where we work" section, Settings → Custom map boundaries, the form's "Place it on the map".
3. Move each file below into `memorybank/docs/support/how-to/` (the folder already uses the `how-to-` prefix).
4. Register each article in **both** places: `FILE_MAP` in `apps/web/src/app/support/how-to/[article]/page.tsx` and the list in `apps/web/src/components/support/wikiCategories.tsx` (category: How-To › Projects for the form pin, How-To › Reporting for the map view, How-To › Organisation for boundaries).
5. Remove this folder and note the publication in `INDEX.md`.

## Articles

| File | Category | Goes with |
|---|---|---|
| `how-to-see-your-work-on-a-map.md` | How-To › Reporting | plan Map view, Overview "Where we work", colors, "not placed" list |
| `how-to-pin-a-place-on-the-map.md` | How-To › Projects | activity form, Location field, suggestions, pinning |
| `how-to-upload-your-own-map-boundaries.md` | How-To › Organisation | Settings, GeoJSON, districts and sub-districts |
