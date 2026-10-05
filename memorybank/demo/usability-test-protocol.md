# Usability test protocol — DonorDesk forms and flows (Phase 23, R10)

**Why.** The review in [`verification-demo-3.md`](verification-demo-3.md) scored ease of use for a non-technical officer at 3.0 but could not test the UI forms with real staff. Phase 23 (see [`../imp/PHSE23-userfriendliness.md`](../imp/PHSE23-userfriendliness.md)) changed the rules, defaults and guidance; this protocol checks that they work for people. Run it **after** Phase 23.1–23.5 are deployed. It is a research task: it needs real participants and cannot be run by an engineer or an agent.

## Participants
- Three project officers who have **not** used DonorDesk: one M&E, one programme, one finance. No engineers.
- A clean demo-free tenant seeded with one project (logframe, 6 indicators, a donor template, 3 monthly periods with verified data, 5 activities, 8 evidence files). The seed is the same for every participant, reset between sessions.
- 60 minutes each, one facilitator, one note-taker, screen + audio recorded with consent. The facilitator never explains the screen; if a participant is stuck for 3 minutes the facilitator records "blocked" and moves them on with a hint.

## Tasks (one scenario each, read aloud; no UI words in the wording)
| # | Task (as told to the participant) | Phase 23 feature under test | Success = |
|---|---|---|---|
| 1 | "You have just been given this project. Get it ready so that you can report on it." | Lifecycle banner, activate | Project active without help text outside the banner |
| 2 | "Add a new indicator for the share of children who attend regularly. Make sure the report treats it correctly." | Semantics summary, one-click confirm | Indicator saved **and** calculation confirmed (or deliberately changed) |
| 3 | "Enter this month's numbers (sheet provided) and get them checked off." | Bulk save, Save & verify all | All values verified in one pass |
| 4 | "You have a photo from the training on 12 March. Make sure the report can use it as proof." | Upload with "use as proof for", support panel | File attached to the activity / indicator value; participant can say which statements cite it |
| 5 | "Create the next monthly report." then "Now you want a one-off report on last month's flood response." | "What you can create" panel | Correct type chosen without a refusal |
| 6 | "Generate the report and tell me what is left before you could send it." | Readiness stage + top-3 list | Names the top blockers from the list and follows one button |
| 7 | "Some statements are flagged. Decide what to do with the Results section." | "Needs fixing" vs "could not confirm", one explained decision | Fixes the figure error; accepts the unconfirmed ones with one note; does not approve around a figure error |
| 8 | "The project is ending. Produce the final report." | Closing-report flow | Starts the closing report from the stepper without hitting an overlap/finance refusal |
| 9 | "Download the report to send to the donor for a first look." | Export (already fixed) | A correctly named file; understands it is an internal-review copy |

## Measures
- **Completion** per task: unaided / with a hint / blocked.
- **Time to complete** and **wrong turns** (screens visited that were not on the path).
- **Errors shown** (refusals, red text) and whether the participant understood the message (ask: "what does this tell you to do?").
- **Understanding probes** after tasks 2, 4, 6, 7: "In your own words, what does *Calculation confirmed* / *Used in reports* / *Drafting · 82 %* / *We could not confirm* mean?" Scored right / partly / wrong against the wording in `apps/web/src/features/tour/domain/workflow-rules.ts`.
- **SUS** questionnaire at the end; plus one free-text line: "What surprised you?"

## Success bar (decides whether Phase 23 is "done" for usability)
- At least **5 of 9** tasks completed **unaided** by **each** participant, and **no task blocked for two or more** participants.
- Median **SUS ≥ 75**.
- Every understanding probe **right** for at least two of three participants.
- Any failure that repeats for two participants is a P1 fix; log it in `memorybank/pending.md` and re-test that task with two new participants.

## Privacy and conduct
Participants use the seeded demo data only. Recordings are stored in the research folder, shared only with the team, and deleted after the findings are written. Participation is voluntary and can stop at any time.

## Output
Findings go to `memorybank/demo/verification-demo-4.md`, scored on the same 1–5 rubric as demo 3 (area scores, then overall ease of use for a non-technical officer), with a table of task × participant outcomes and the list of fixes raised.
