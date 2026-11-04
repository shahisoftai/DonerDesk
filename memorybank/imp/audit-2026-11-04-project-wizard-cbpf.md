# Audit: creating a real project through the wizard (CBPF-SOM-25-S-NGO-37159)

**Date:** 2026-11-04. **Environment:** production, donordesk.online, test tenant. **Final release:** `20261104194823`.
**Source document:** CBPF Somalia proposal, "Life-Saving Flagship WASH Response" (Youth In Action Baidoa).

## 1. Summary

A browser script acted as a real user creating this project from the proposal. The first run could not finish: the launch hung, and several wizard bugs blocked sign-off with no explanation. After fixes, one project launched and went ACTIVE, but only after a manual clean-up of the draft partway through.

Document reading then improved substantially, and the checks in section 5 pass in most reads, but it is **not yet consistent**. A person must still review the results structure and several other items.

The audit also found a production-wide reliability bug unrelated to the wizard (F1), and my own fixes caused one short production regression (section 6).

**Not yet proven:**
- A clean, unattended run from upload through launch. No launch has been run on the final release.
- Anything beyond this one proposal. It is a single document with a blank logframe.

**Nothing is committed to git.** All changes are in the working tree and deployed.

## 2. Method

- Script: `Temp/cbpf-run/run-cbpf.mjs` (full flow) and `read3.mjs` (upload only, nothing typed), driving a visible Chromium. Console errors, failed requests and failed steps are logged to `issues*.jsonl`.
- Evidence: Contabo API and web logs, `ProjectSetupRun` and `ProjectSetupProposal` rows, the production parser re-run locally, prompts and code.
- Scoring: three uploads of the proposal, stored proposals read from the database and compared with the document by hand.

## 3. Findings and fixes

### Fixed and deployed

| # | Severity | Finding | Root cause | Fix |
|---|---|---|---|---|
| F1 | Critical, all users | Requests failed with "Transaction not found" (P2028) or never answered | `routes/auth.ts`, `internal.ts` and `webhooks.ts` called `$disconnect()` on the pooled, shared Prisma client. `/v1/auth/mfa` runs on every page load, so it could kill other requests in the same organisation | Disconnects removed; test `apps/api/test/no-pooled-disconnect.test.mjs` |
| F2 | Critical | Launch timed out and left a partial DRAFT project | `project.workspace.provision` has no Kestra flow, so Drive folders were never made and the periods step waited about 87 s then failed. The web call also gave up at 15 s | Dispatcher runs an in-process handler when the remote queue has no flow; launch call timeout 180 s |
| F3 | High | Slide stuck on "1 to answer", sign-off blocked | The parent select showed a removed parent as the first option, so it looked chosen; picking it fired no change | Placeholder shown when the stored parent is not a valid choice; rejecting a result clears its children's parent |
| F4 | High | Nobody could tell what was left to answer | `GapInbox` existed but was never rendered | Rendered below the slide |
| F5 | High | Answers typed on Start were lost on upload | Sending documents creates a new draft | Typed answers carried over |
| F6 | High | "1 to answer" with every field filled | A value read from a document stayed a proposal if left unchanged | Leaving a filled box confirms it |
| F7 | High | Word tables were shredded for the model: labels apart from values, headers apart from figures | `mammoth.extractRawText` | New `parsers/docx-text.ts` keeps rows as `a | b | c`; 211 fragments became about 54 coherent blocks; test added |
| F8 | High | HRP objectives SO1/SO2 read as project outcomes | The prompt said every named objective is an outcome | Results prompt v6 excludes plan, cluster and fund objectives |
| F9 | Medium | Dates such as "01-Sep-2025" failed the quote check | Date pattern accepted spaces only | Hyphens accepted |
| F10 | Medium | "$500,000.30" could not be counted; budget lines had no currency | Amount parser refused currency marks | `splitAmountCurrency`; lines offered the project's or the funding's currency, MEDIUM confidence, for a person to confirm |
| F11 | Medium | Unfilled template text accepted as real ("To be completed…", "[insert…]", "Activity 1.1.1") | It passes the quote check because the words are in the document | `template-placeholders.ts`: whole placeholder is left out with a stated reason; partial is removed and marked LOW confidence |
| F12 | Medium | Start and the report schedule were never filled from the document | Design: answers were offered, not filled | `prefillFromDocuments`: empty answers only, once, never overwriting a person's. **Behaviour change** from "nothing is filled until you choose" |
| F13 | Medium | Non-budget rows counted as budget, doubling the total; duplicate funding and places; a placeholder 0 read as a target | Prompt gaps | Funding, places, indicators and facts prompts tightened |
| F14 | Medium | Structure quality on a low-cost model | Haiku was used for all areas | Results, indicators and work plan use `SETUP_HEAVY_MODEL=claude-sonnet-5-5`; logs show 33 Sonnet and 28 Haiku calls |
| F15 | Low | Second indicator coded `IND1-2` | Counter ignored codes in use | Now `IND2`. An existing test pinned the old value and was changed |
| F16 | Low | Field form suggested for a percentage indicator | No rule for rates | Typed in, with the reason |
| F17 | Low | "Could not be read" shown for a missing currency | Misleading wording | Reworded in four languages |
| F18 | Low | `setup:eval` crashed on recorded replies | Refine pass not handled | Fixed; recorded corpus passes |

Also changed: the audit append has a longer transaction window and one retry on P2028. This was added before F1 was found. It is probably no longer needed, and it lengthens the wait if a lock is ever really held. Consider removing it.

### Closed as not a bug

- **"Links we suggest" did not appear.** Most likely a consequence of F3, because activities had no valid parent. Not separately confirmed.
- **Sector not read.** The design was changed by F12 instead.
- **The 13,500 target not on the indicator.** The proposal's own logframe target is 0. The figure appears only in section 7, People Targeted. See S6.

## 4. Still not right

| # | Severity | Issue | Evidence or note |
|---|---|---|---|
| S1 | High | **Results structure varies between reads.** The same file gave goal → activities, goal → outcome → activities, and goal → outcome → outputs | Last three reads, one of each. The logframe is blank, so the model infers it |
| S2 | High | **No clean end-to-end run on the final release** | The successful launch needed manual clean-up, on an earlier release |
| S3 | Medium | PSC budget line dropped in 1 of 3 reads, so the budget does not add up | Read `bdb5c1c1` |
| S4 | Medium | "Baidoa" and "Baidoa District" both appear as places | 3 of 3 |
| S5 | Medium | Launch report says "Baidoa is not in your places list" for every plan row | Places are written after the plan. Reordering breaks a pinned dependency test, so it was reverted. The place link itself was not verified |
| S6 | Medium | Indicator targets not filled: 13,500 is not linked; female participation appears as text ("at least 50%") or is missed | The people-reached target is null in 3 of 3 |
| S7 | Medium | Plan rows have no dates | The workplan grid has dates only for a placeholder row |
| S8 | Medium | Only the final report is read; "mid-point and closure" gives no cadence | 3 of 3 |
| S9 | Medium | React error #310 on server redirects into the wizard, which takes about 5 s to open | Component not located |
| S10 | Medium | Live `setup:eval` on real documents cannot run: the API key is not in the environment | The one attempt was invalid and discarded. Scoring here was by hand |
| S11 | Low | Donor varies: SHF, CBPF - Somalia | Now prefilled, so check it |
| S12 | Low | Summary keeps a dangling "in." where a placeholder was removed | Marked LOW confidence. Observed in unit test output; not re-checked in stored reads |
| S13 | Low | Risk count and wording vary; risk seriousness is never read | Seriousness is not stated in the document, so this is expected |
| S14 | Low | Checkboxes update only after the server round trip | Not changed |
| S15 | Low | Removing a result clears indicator links with no warning at that moment | Now visible in the Still to answer list |
| S16 | Low | Web log repeats `ENOENT mkdir …/.next/cache` for image cache | Seen in logs; not investigated |
| S17 | Info | Team members cannot be read: names are redacted before the model | Deliberate |
| S18 | Info | AI cost shows as unpriced for both Claude models: no rate in `LLM_PRICES_JSON` | Sonnet adds cost that is not yet visible |

## 5. Latest scoring

Three uploads on release `20261104194823`, nothing typed, about 49 s each, no page errors other than S9.

| Check | Result |
|---|---|
| Start slide filled and Complete | 3/3 |
| Name, code, start and end dates, currency | 3/3 |
| No HRP objectives as outcomes | 3/3 |
| No placeholder items listed | 3/3 |
| People-reached indicator found | 3/3 |
| Funding single and readable, 500,000.30 USD | 3/3 |
| Budget adds up to 500,000.30 | 2/3 |
| Consistent results structure | **0/3** (three shapes) |
| Single Baidoa place | **0/3** |
| API error-level log lines, about 20 minutes after this release | 0 |

Three reads of one document are a small sample. They show direction, not a measured accuracy rate. The prompts were also tuned on this same document, so these scores may be better than other proposals would get.

## 6. Incidents during this work

- **Regression I caused.** Document drafts whose read dropped a placeholder would not open ("Received an unexpected response shape"). The web schema had its own list of reasons and I had not added the new one. Live from about 14:51 to 15:14 CET (releases `20261104184932` to `20261104190049`), about 23 minutes by service restart times; I earlier said about 30 minutes. Test `pcw-left-out-reasons.test.mts` now guards it.
- **Other users could have been affected** by that regression, and by the restarts from 7 production releases in one day (3 further deploy attempts shipped no restart). The tenant usage in that window was not checked.
- **Failed build.** One deploy stopped at the local build because I had edited the wrong resolver. My earlier build check had also hidden the compile error. Nothing shipped.
- **Interrupted deploys.** One stopped mid-ship on an SSH drop, leaving new package files on the host with the old API process until the retry. Two further attempts failed at the SSH canary, possibly throttling from heavy connections.

## 7. Production state

- **Config:** `SETUP_HEAVY_MODEL=claude-sonnet-5-5` added to `/opt/donordesk/shared/api.env`; a dated backup sits beside it.
- **Deleted, by direct database purge, as requested:** the launched project `52a4e905-8fa1-4303-b4dd-5921c0e3dcda` with draft `13d23122` (its status was ARCHIVED at deletion; I did not archive it), and two earlier partial projects with their drafts. Audit rows are kept, by design (6 remain for this project). There is no product feature for deleting a real project.
- **Possible Drive leftovers:** those projects' Drive folders and uploaded proposal copies were not removed and may remain in the tenant's Drive.
- **Left on the test tenant:** open setup drafts: 32 created in the last day, nearly all from these runs, not deleted. The proposal holds a real person's name and email; the two team entries were set to "invite later", so no invitation was sent. The proposal was also sent repeatedly to the AI provider, with personal details redacted by the existing filter.

## 8. Recommended next steps

1. Review and commit the working tree.
2. Update the script for the new reads and run one full unattended launch (S2).
3. Decide how to handle a blank logframe (S1): for example, always propose the one chain shape, clearly marked as inferred.
4. Fix place de-duplication and write places before the plan (S4, S5).
5. Make live `setup:eval` read the managed key (S10) and add 3–5 other donors' proposals before relying on these scores.
6. Link people-targeted totals to indicators as a marked proposal (S6).
7. Locate React #310 (S9). Set `LLM_PRICES_JSON` (S18). Consider removing the audit retry.
8. Add the invariants from F1, F7, F11 and F12 to `AGENTS.md`.
