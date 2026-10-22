# Publishing the programme-management features (C-8)

**Status: prepared, not published.** AGENTS.md holds the public site to "Set it up", not "Plan it", until the features are checked in a browser with a real account. This pack is what to check and what to publish afterwards. Nothing here has been put on the site.

## 1. Browser check (about 30 minutes, with your own account)

Create a throwaway project, then confirm each line works as described, in a desktop browser and at phone width. Note any that do not; do not publish those lines.

| # | Feature | Check |
|---|---|---|
| 1 | Plan | Start from the logframe: the wizard proposes dates; saving creates planned activities; the list shows "On time / Late / Done" |
| 2 | Timeline | Drag an activity; nothing saves until Save in the confirm bar; ←/→ move by a day |
| 3 | My week | A field officer lands on My week; marking an activity done works; it works offline and syncs |
| 4 | Requests and reminders | Ask a person to do something; it appears in their queue; the morning summary email (or the in-app note) arrives |
| 5 | Risks | Raise a problem with four fields; it shows on the project Overview; closing it records how it ended |
| 6 | Milestones and dependencies | A milestone appears on the timeline; "comes after" blocks nothing but flags a late predecessor |
| 7 | Reports read the plan | In *Tell the story*, "Suggested from your plan" fills empty fields only |
| 8 | Programmes and grants | /programmes: add a programme and a grant, place a project under it; totals keep currencies apart |
| 9 | Framework history | /projects/:id/logframe/history lists a version per change and reads "target changed from X to Y"; Sign off works |
| 10 | Outside partners | Invite a partner (Team → Invite → Outside partner) to one project; the invitee sees that project only |

## 2. What to publish once the check passes

Add to `/features` (and the landing page "what you get" list), in the product's plain voice:

- **Plan the work, not just the report.** Planned activities with owners, dates, milestones and dependencies; late work is flagged on the same list the whole team sees.
- **One week at a time.** A "My week" screen for field staff, usable offline.
- **Nobody has to chase.** Requests with a due day, one short morning summary per person, one escalation when something is a week late.
- **Problems on the record.** A short risk list on each project, reviewed on a 30-day rhythm, never sent to the AI writer.
- **Programmes, grants and projects.** Group awards and projects; totals by currency; the donor is a record, not free text.
- **A framework with a memory.** Every change to targets and indicators is kept; sign off the version the donor approved; each approved report notes the version it was approved against.
- **Partners, in their own lane.** Outside partners see only the projects you give them.

Do not claim: offline app opening (only capture is offline), budget as a finance system (budget lines exist per activity; there is no ledger), partner self-service portals beyond the allow-listed screens, multi-factor sign-in for outside partners, or any certification. Two-step sign-in for tenant users is built and may be described once checked on the live site.

## 3. Support articles

The work-plan drafts are in `memorybank/docs/support/_unpublished-phase28/` (including `how-to-add-fields-and-automatic-reminders.md`, added 2026-10-22). The batch-3 drafts (programmes and grants, framework history, outside partners, organisation export, donor requirements, locks, sign-in lockout, AI usage, unreadable files) are in `apps/web/content/support/_unpublished-batch3/`, with their own publish checklist. Register each (`FILE_MAP` and `wikiCategories.tsx`) only after its section above has passed.

## 4. Then

Flip the AGENTS.md line about "Set it up, not Plan it", update `memorybank/pending.md:11`, and mark C-8 closed in the audit.

## 5. Browser check on production, 2026-10-21 (demo tenant mnpiracha@gmail.com, WASH project)

Passed: **1** Plan wizard (dates proposed, 6 activities created, list shows "Late", "No lead yet"); **2** Timeline renders with no page errors (drag not exercised); **3** Mark done records a completed activity (needs a reporting period covering the finished date, and says so otherwise) and moves the plan item to Done; the Overview shows "Behind 1 of 6, 5 activities late"; **5** a problem raised with four fields shows on the Overview and closes with "how it ended"; **9** "Sign off the framework" saves Version 1 with plain-language entries; **8 (part)** a programme and a grant can be added (project placement was not run).

Not yet checked: drag on the Timeline, My week and offline, requests and reminders (needs a team member), milestones and dependencies, "Suggested from your plan", placing a project under a grant, outside-partner invite, "target changed from X to Y". **Do not publish those lines yet.** Note: "This week" in the List also holds late and under-way items, by design.
