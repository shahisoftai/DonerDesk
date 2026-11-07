# CBPF-SOM-25-S-NGO-37159 wizard run — issue list (2026-11-04)

## Fixed and deployed
1. Launch hang: `project.workspace.provision` had no Kestra flow, so the project's Drive folders were never made and PERIODS waited ~87 s then failed. Dispatcher now runs an in-process handler when the remote queue has no flow (`jobs/dispatcher.ts`, `KestraJobQueue.canHandle`). Web launch call timeout 15 s -> 180 s.
2. Result "Belongs to" select showed a removed/dangling parent as the first option (looked chosen, never saved) -> placeholder shown; rejecting a result now clears its children's parent.
3. "Still to answer" list (GapInbox) was never rendered -> rendered under the slide.
4. Start answers lost when documents were sent (a new draft is created) -> answers carried over.
5. Document-read project facts stayed unconfirmed when left unchanged ("1 to answer" with everything filled) -> leaving a filled box confirms it.
6. "01-Sep-2025" style dates were not read (grounding) -> fixed.
7. Second indicator code `IND1-2` -> `IND2`.
8. A form was suggested for a percentage indicator -> typed in, with the reason.
9. Finance sentence said "could not be read" for a missing currency -> "could not be counted (no readable amount, or no currency)" (4 languages).

## Fixed, deploying (api-only release in progress)
10. Prisma P2028 on audit append right after a restart (first draft creation returned 500 "Internal Server Error") -> longer transaction window + one retry.

## Open (not fixed)
- React error #310 on every server-redirect landing (/projects/new -> /wizard -> ?id=); wizard takes ~5 s to open. Component not located.
- Extraction variance: HRP strategic objectives (SO1/SO2) read as outcomes; placeholder rows ("Activity 1.1.1"); places duplicates; budget lines without currency; the real "people reached" indicator (13,500) and Women/Girls/Men/Boys targets not read; summary read with "[insert target districts/regions]". Items sometimes arrive as real plan items/funding and sometimes not.
- Launch report: plan rows say "Baidoa is not in your places list, so it was not linked" (places are applied after the plan; reordering breaks the pinned dependency invariant).
- Dashboard: three starting-dashboard charts left out (no indicator answers them) — by design, but the user must choose on the dashboard.
- Checkbox updates lag by a server round trip.
- Removing a result silently clears indicator "Measures" links (now visible in the list, no warning at removal time).
