# Assessments and long surveys (Phase 62, Version 4.01)

**Status:** built and tested; see the plan `memorybank/imp/phase62-assessments-and-surveys.md` for the batches and `AGENTS.md` (Phase 62 invariants) for the rules.

## What it is for
Facility assessments, school or shelter checklists, needs assessments and monitoring visits: a long tool with sections, tables, repeating rows and tick grids, filled by an assessor at a facility (often offline, over several days), reviewed, scored, compared with the visit before and shown by place.

## What a person can do
- **Design** a form with sections, notes, tables, repeating groups, multi-select, calculated figures, signatures, rules across answers, "not applicable" and wording in other languages; start from a ready-made kit or from their own Word or Excel tool.
- **Give facilities to assessors** (a due day; they are told), and see how far each district has got.
- **Fill** one facility at a time: the facilities given to the person come first, facts that rarely change are offered from the last visit, a draft is saved while filling (on the server online, on the phone offline) and a long form is shown a section at a time with a contents list and a score that grows.
- **Review** the assessments: score by section, quality flags, comparison with the visit before, the items that scored lowest (one click makes a request or raises a problem), the file as PDF, Word or Excel.
- **Report**: totals feed indicators (count, count where, percent where, average score, one current record per facility); every form is also a dataset (and each repeat its own) for charts, maps by place and dashboards.

## Honest limits
- The health-facility kit is the Foundation's tool read by a program and not reviewed by a health reviewer; its weights and bands are illustrative.
- The document reader is rule-based (headings, tick options, blanks, header words); a complicated layout needs hand fixing. It is not an AI model.
- Urdu and Pashto cover the assessor's screens only; other screens show English. All translations are drafts.
- A PDF cannot show right-to-left scripts; Word and Excel can.
- No sampling frame, weighting or statistical tests (see the plan, "not in this phase").

## Where things are
Domain `packages/domain/src/contexts/collection/` (engine, scoring, compare, flags, kits); application `packages/application/src/use-cases/collection/`; routes `apps/api/src/routes/assessments.ts`; web `apps/web/src/features/collection/`; offline `apps/web/src/features/offline/`.
