# KP health facility assessment (Nov 2025 tool) — how the project was built

Built on production on 2026-11-23 for the tenant AGRC through the API (no wizard), so it can be rebuilt or copied for another assessment. Record of the project: `memorybank/imp/kp-hf-assessment-2026.md`.

Run from this folder (Python 3, no packages needed). Output goes to `out/` (ignored by git).

1. `python3 ext.py` — reads the Word tool (`KPHF_TOOL=path/to/tool.docx`, default the tool's place on the owner's machine) and writes `out/doc.txt`: every table row as `R: a | b | c`.
2. `python3 gen_form.py` — turns it into `out/fields.json`, the form's questions: 24 sections, one checklist grid and one counts grid per department, one equipment grid per department (843 equipment rows), standalone selects for the tool's option lists, a REPEAT for blocks and for staff, grids for the EPHS checklist, interventions, service delivery and posts, and a department gate (`has_*`) that skips a department the facility does not have. A new tool of the same shape needs only the gates and section list changed.
3. `python3 hosp.py` — writes `out/places.csv`, `logframe.csv`, `indicators.csv` and `workplan.csv` from the facility table at its top (district, name, category, visit days).
4. `python3 geo.py` — optional: looks each facility up in OpenStreetMap (Nominatim, one request a second) and writes `geo.json` with how precise each match is (`FACILITY`, `VILLAGE:<type>` or `NOT FOUND`). Village matches are rough positions.

Then, with an SSH tunnel to the API (`ssh -N -L 14001:127.0.0.1:4001 contabo`) and a bearer token from `POST /v1/auth/login` (credentials from the environment, never in these files):
`POST /v1/projects`, `POST /v1/places/import` (`apply: true`), `POST /v1/logframe/import`, `POST /v1/logframe/indicators/import`, `POST /v1/projects/:id/work-plan/import`, `POST /v1/collection-forms` (body: `projectId`, `name`, `fields`, `subject: "FACILITY"`, one `COUNT` mapping with `latestPerFacility`), `POST /v1/collection-forms/:id/publish`, `PUT /v1/projects/:id {"status":"ACTIVE"}`, and `PUT /v1/places/:id {latitude, longitude}` for pins.

Row keys in a grid must start with a letter (a key from a title that starts with a digit is prefixed `r_`); the form check names any problem.
