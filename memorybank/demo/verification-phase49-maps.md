# Phase 49 maps hardening — production verification (2026-11-10)

Tenant: Global Care Initiative (mnpiracha@ account). Project: DEMO-16 Kenya Education (`8e20556a-115e-48a7-be9b-bb1bfe14bf70`).
Releases: `20261110133250` (Phase 49, both), then web/both fixes `20261110140258`, `20261110141750`, `20261110143648`, `20261110145630` and the drill fix.

## Deployed and data on the host
- Backup before migration; `20261114090000_tenant_map_settings` applied; RLS on `TenantMapSettings` (rowsecurity and force true, policy tenant_isolation).
- nginx: `donordesk-api-limit.conf` (`$dd_map_cache`), `conf_geo`, `conf_tiles`; `nginx -t` passed, reloaded. Old copies in `/root/nginx-backups/`.
- `pmtiles` at `/opt/donordesk/shared/bin/pmtiles`, `PMTILES_BIN` in `api.env`.
- Basemaps: world (z0-6, 44 MB) + MENA, Eastern Europe, Caribbean, Andes, Southeast Asia (build 20261110), Africa and South Asia kept.
- Boundaries: OCHA levels 2-4 refreshed (IDN, THA, PHL, CHL skipped: HDX stalls their large zips); level 1 from OCHA for KEN, NGA, ETH, SDN, NPL, GHA, SSD, SOM, UGA (Kenya had Natural Earth's 8 pre-2013 provinces); 88 levels tiled.
- Context: population (WorldPop 1 km) + grids for KEN NGA ETH SDN NPL GHA; health facilities 21,592 points; settlements (HOT, ODbL).
- Host disk after sync: ~75%.

## Checked in the browser (visible Chromium, signed in)
| Check | Result |
|---|---|
| Settings → Places: imagery `http://` refused with a sentence; three context layers saved | ok |
| Places CSV / GeoJSON download (import's columns; unpinned counted) | ok |
| World view has a street basemap | ok |
| Population raster and facility/settlement points over Kenya, credits in attribution | ok (points fixed: were under the fill) |
| Drill Kenya → Turkana → districts (OCHA, credited) | ok after two fixes (OCHA level 1; name fallback for ISO codes) |
| Pin editor on existing places; 5 counties pinned; 4 facilities added | ok (new feature: there was no way to pin an existing place) |
| Analyse 25 km: rings, 6 places inside, nearest facility, ~1,062,437 people with border note | ok (border fix) |
| Field app: offline map 3.7 MB size first, kept, service worker serves byte ranges | ok |
| Public API: /api/v1/places (GeoJSON/CSV), place-results GeoJSON, scope refusal 403, MCP GeoJSON | ok; test key switched off |
| Project Overview "Where we work" on MapLibre | ok |
| Arabic: right to left, side panels translated | ok |

## Findings fixed during the check
1. No way to pin an existing place (only new ones): `PlacePinEditor` on the Places list.
2. Context points hidden under the results shading: points now above the fill.
3. Kenya level 1 was Natural Earth's old provinces: OCHA level 1 written to `/geo/ADM1/<key>.json`.
4. Province files unversioned, a browser kept the old one: stamped with the catalogue build; country preload removed.
5. Places with ISO codes (KE-TUR) never matched OCHA P-codes in the drill: `unitForCrumb` falls back to a unique name.
6. Population "not available" when a ring crossed a border: best-overlap grid, part inside counted, `partial` sentence.
7. Context switches appeared ~20 s late (server actions queue): settings read with the page.

## Not checked / left
- Share-link maps, boundary upload, drawing outlines, no-WebGL table path, browser harnesses (`test:maps*`).
- Plan page address used in the check answered 404 (wrong URL on my side; not investigated).
- IDN, THA, PHL, CHL boundaries; native review of fr/es/ar.
