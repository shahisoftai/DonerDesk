# DonorDesk How-To Videos: Story Bible

Status: draft v2 (2026-10-18). Source of truth for roles: `packages/domain/src/policies/permissions.ts`. Source of truth for how-tos: `memorybank/docs/support/`. Update this file when a role, a feature or an article changes.

## 1. Principles

1. **Every episode is 1 to 2 minutes.** Longer topics are split into `a` and `b` parts. Nothing runs past 2 minutes.
2. **Every video teaches one task.** A story sets up the problem; the how-to solves it; the ending shows the result.
3. **Every story uses a real role.** A character only uses screens and buttons that role can see (section 3). If a role cannot do something, the story says who can.
4. **The plain how-to always stands alone.** Each episode maps to a support article, so the support centre can link to the plain version.
5. **Ada explains the why.** Ada opens and closes every episode and asks the question a new user would ask.
6. **One demo project for all stories.** Use the same fictional project so characters can refer to shared data. Name: *Riverside Health Programme* (fictional).
7. **Fictional people only.** Characters are invented. Do not model them on real staff or donors.
8. **No credentials on screen.** Recordings never show a password or a demo login (see section 8).

## 2. Cast

| Character | Story role | DonorDesk role (workspace) | What they do in the videos | Tone |
| --- | --- | --- | --- | --- |
| **Ada** | Guide, host of every video | none (not a user) | Introduces each episode, asks the viewer's questions, explains why, recaps | Calm, clear, friendly; never condescending |
| **Leila** | New joiner | Field Officer | Joins the organisation; the viewer's stand-in for "I am new here" | Curious, asks basic questions |
| **Marc** | Programme Manager, HQ | Project Manager | Sets up projects, plans the calendar, reviews and approves reports, closes the project | Organised, pragmatic |
| **Nancy** | Field Officer, village office | Field Officer | Logs daily activities, uploads photos and receipts, works offline | Busy, practical, on a phone |
| **Grace** | M&E Officer, HQ | M&E Officer | Builds the logframe, enters and verifies indicator values | Precise, careful with numbers |
| **Priya** | Grants Officer, donor reporting | Grants Officer | Uploads donor templates, generates and edits the draft, exports | Detail-focused, deadline-aware |
| **Hameed** | Finance Officer, HQ | Grants Officer in videos (see open decision 1) | Enters and checks period finance figures | Methodical, cautious about money |
| **Yadav** | Head of Programmes, leadership | Admin | Reviews progress through the Data Center and dashboard; looks at the big picture | Direct, asks "is it on track?" |
| **Tomas** | Compliance Officer | Compliance Officer | Runs the checklist, verifies evidence, reads the audit trail | Thorough, sceptical in a helpful way |
| **Lena** | Donor liaison (external viewer) | Viewer | Reads reports and exports them; cannot change anything | Neutral, looks for proof |

Voices: give each character a distinct TTS voice. Ada uses the same voice in every episode.

Recurring props: the demo project's logframe, the donor template (fictional donor "Global Health Fund"), and the team list.

## 3. Roles as the cast sees them

These come from the domain permission table (the source of truth). The web mirror of capabilities differs on approval; see open decision 3.

| Role | Can | Cannot |
| --- | --- | --- |
| Admin | everything, including team, billing, settings, approve reports and activities, delete evidence | |
| Project Manager | project edit, logframe, indicators, verify, approve activities, generate, edit, **approve reports**, export, checklist, audit log | manage team, delete evidence |
| M&E Officer | logframe, indicators (enter and verify), evidence verify, activities create, generate, edit reports, checklist | approve activities, approve reports, export |
| Grants Officer | templates, evidence upload, generate, edit, export, override confidentiality, checklist | approve reports, approve activities, indicators |
| Field Officer | activities create, evidence upload, comment, own work status | generate, approve, indicators, reports |
| Compliance Officer | evidence verify, checklist, audit log, comment | generate, edit reports, approve reports |
| Viewer | view project, export reports | change anything |

Scenes must follow this table. A Field Officer never clicks "Approve". A Viewer never sees an edit button.

## 4. Seasons (groups of episodes)

Each season is one story arc, ordered the way a new team learns the app. A viewer can jump into any season.

| Season | Title | Lead character(s) | Audience | Status |
| --- | --- | --- | --- | --- |
| S0 | Start Here | Ada, Leila | Everyone, first | Test render done (0.2) |
| S1 | Setting Up | Marc, Grace | Admins, Project Managers | Ready to script |
| S2 | In the Field | Nancy | Field Officers | Ready to script |
| S3 | A Reporting Month | Grace, Priya, Marc | M&E, Grants, Project Managers | Ready to script |
| S4 | Money Matters | Hameed, Priya | Finance, Grants | Provisional (see gap 1) |
| S5 | Is It On Track? | Yadav, Lena | Leadership, donors, Viewers | Ready to script |
| S6 | Trust and Compliance | Tomas | Compliance, Admins | Ready to script |
| S7 | Closing the Project | Marc, Priya | Project Managers | Ready to script |
| S8 | Ask Ada | Ada with any character | Everyone | Ready to script |
| S9 | Plan With Me | Marc, Nancy | Planners, Field Officers | **Held** until Phase 28 deploys |

### S0 Start Here (Ada and Leila)

| Ep | Title | Support source | Length |
| --- | --- | --- | --- |
| 0.1 | Welcome to DonorDesk | `what-is-donordesk`, `getting-started-overview` | 2 min |
| 0.2 | Your account and signing in | `how-to-create-an-account`, `how-to-log-in`, `how-to-change-your-password` | 2 min |
| 0.3a | Home: what needs attention | `how-to-use-the-dashboard` | 2 min |
| 0.3b | Search and notifications | `how-to-search-projects-and-evidence`, `how-to-use-the-notification-system` | 2 min |
| 0.4 | Take the Academy tour | `how-to-use-the-academy-tour` | 2 min |

### S1 Setting Up (Marc, with Grace)

| Ep | Title | Support source | Length |
| --- | --- | --- | --- |
| 1.1a | Set up your organisation | `how-to-set-up-new-organisation` | 2 min |
| 1.1b | Organisation profile and defaults | `how-to-change-organisation-profile` | 2 min |
| 1.2a | Invite your team | `how-to-invite-team-members` | 2 min |
| 1.2b | Choose roles | `how-to-manage-team-roles-permissions`, `how-to-onboard-team-member` | 2 min |
| 1.3a | Create a project | `how-to-create-a-project` | 2 min |
| 1.3b | Projects: draft and active | `understanding-projects` | 2 min |
| 1.4a | Build the logframe | `how-to-build-logframe` | 2 min |
| 1.4b | Logframe levels | `understanding-logframes`, `basic-information-logframe-hierarchy` | 2 min |
| 1.5a | Indicators: type, baseline, target | `basic-information-indicators-and-targets` | 2 min |
| 1.5b | Confirm the calculation | `basic-information-indicators-and-targets`, `how-to-build-logframe` | 2 min |
| 1.6 | Import from Google Sheets | `how-to-import-from-google-sheets` | 2 min |
| 1.7a | Upload a donor template | `how-to-upload-donor-template` | 2 min |
| 1.7b | Change a report's template | `how-to-change-a-reports-template`, `basic-information-donor-templates` | 2 min |
| 1.8 | Create the reporting calendar | `how-to-create-a-reporting-period`, `understanding-reporting-periods` | 2 min |
| 1.9 | Connect Google Drive for evidence | `how-to-connect-google-drive`, `basic-information-storage-file-management` | 2 min |

### S2 In the Field (Nancy)

| Ep | Title | Support source | Length |
| --- | --- | --- | --- |
| 2.1 | Log an activity | `how-to-log-activities`, `basic-information-understanding-activities` | 2 min |
| 2.2 | Upload evidence | `how-to-upload-evidence`, `basic-information-understanding-evidence` | 2 min |
| 2.3 | Work offline and take photos | `how-to-work-offline-and-take-photos` | 2 min |
| 2.4 | Dictate instead of typing | `how-to-dictate-instead-of-typing` | 1 min |

Note for the scripts: Nancy's episodes must end on the "waiting for review" state, so episode 3.3 can pick up where Nancy leaves off.

### S3 A Reporting Month (Grace, Priya, Marc)

| Ep | Title | Support source | Length |
| --- | --- | --- | --- |
| 3.1 | The reporting month at a glance | `how-to-run-a-reporting-month` | 2 min |
| 3.2 | Enter and verify indicator values (Grace) | `how-to-update-indicator-values`, `basic-information-evidence-verification` | 2 min |
| 3.3 | Accept Nancy's activities (Marc) | `how-to-review-and-accept-activities` | 2 min |
| 3.4 | Tell the story (Marc) | `how-to-tell-the-story-and-add-inputs` | 2 min |
| 3.5 | Generate an AI draft (Priya) | `how-to-generate-ai-report-draft`, `basic-information-report-sections` | 2 min |
| 3.6 | Edit in the report editor (Priya) | `how-to-use-the-report-editor` | 2 min |
| 3.7 | Add a chart to a report (Priya) | `how-to-add-a-chart-to-a-report` | 2 min |
| 3.8a | Approve a report (Marc) | `how-to-review-and-approve-reports`, `basic-information-report-statuses` | 2 min |
| 3.8b | Export (Marc) | `how-to-export-reports` | 2 min |
| 3.9 | Reopen an approved report | `how-to-reopen-an-approved-report` | 2 min |
| 3.10 | Fix or remove an indicator | `how-to-fix-or-remove-an-indicator` | 2 min |

### S4 Money Matters (Hameed, with Priya)

Provisional. The support docs cover finance only in the Data Center and the closing report. Build these after the gap in section 6 is closed.

| Ep | Title | Support source | Length |
| --- | --- | --- | --- |
| 4.1 | Turn finance on for a project | `how-to-project-walkthrough` (reporting profile step); needs an article | 2 min |
| 4.2 | Enter finance figures for a period (Hameed) | **No article yet** | 2 min |
| 4.3 | Budget against spending in the Data Center | `how-to-use-the-data-center` (Finance tab) | 2 min |
| 4.4 | The finance step of the closing report | `how-to-create-the-closing-report` | 2 min |

### S5 Is It On Track? (Yadav, with Lena)

Lena is a Viewer, so every one of her scenes is read-only.

| Ep | Title | Support source | Length |
| --- | --- | --- | --- |
| 5.1a | The Data Center: all periods in one sheet (Yadav) | `how-to-use-the-data-center` | 2 min |
| 5.1b | Download and import (Yadav) | `how-to-use-the-data-center`, `advanced-features-data-import-export` | 2 min |
| 5.2 | The dashboard: what needs attention (Yadav) | `how-to-use-the-dashboard` | 2 min |
| 5.3 | Charts for the board (Yadav) | `how-to-add-a-chart-to-a-report` | 2 min |
| 5.4 | Reading and exporting as a Viewer (Lena) | `how-to-export-reports`, `how-to-manage-team-roles-permissions` | 2 min |

### S6 Trust and Compliance (Tomas)

| Ep | Title | Support source | Length |
| --- | --- | --- | --- |
| 6.1a | The compliance checklist | `how-to-use-compliance-checklist` | 2 min |
| 6.1b | Items that close themselves | `how-to-use-compliance-checklist`, `understanding-compliance-checklist` | 2 min |
| 6.2 | Verifying evidence | `basic-information-evidence-verification`, `understanding-evidence` | 2 min |
| 6.3 | Reading the audit trail | `how-to-use-the-audit-trail`, `understanding-audit-logs` | 2 min |
| 6.4 | Confidential files and export | `security-privacy-data-handling`, `how-to-export-reports` | 2 min |
| 6.5 | Comments and feedback | `how-to-use-comments-feedback` | 2 min |

### S7 Closing the Project (Marc, with Priya)

| Ep | Title | Support source | Length |
| --- | --- | --- | --- |
| 7.1a | The whole project: stages 1 to 6 | `how-to-project-walkthrough` | 2 min |
| 7.1b | The whole project: stages 7 to 12 | `how-to-project-walkthrough` | 2 min |
| 7.2 | The closing report | `how-to-create-the-closing-report` | 2 min |
| 7.3 | Archive the project | `how-to-archive-a-project` | 2 min |

### S8 Ask Ada (help desk)

Short question-and-answer episodes, 60 to 90 seconds each. Ada asks the question a user is likely to type into search.

| Ep | Question | Support source |
| --- | --- | --- |
| 8.1 | I cannot sign in | `troubleshooting-login-issues`, `troubleshooting-account-access` |
| 8.2 | My indicator numbers look wrong | `troubleshooting-indicator-data` |
| 8.3 | My evidence will not upload | `troubleshooting-evidence-upload` |
| 8.4 | My report did not generate | `troubleshooting-report-generation`, `troubleshooting-ai-report-generation` |
| 8.5 | My export failed | `troubleshooting-export-issues` |
| 8.6 | I lost some data | `troubleshooting-data-recovery` |
| 8.7 | The app is slow | `troubleshooting-browser-performance` |
| 8.8 | Common questions | `reference-faq`, `reference-keyboard-shortcuts` |

### S9 Plan With Me (held)

Do not script or publish until Phase 28 is deployed. The drafts are in `memorybank/docs/support/_unpublished-phase28/`.

| Ep | Title | Draft source |
| --- | --- | --- |
| 9.1 | Plan your activities (Marc) | `how-to-plan-your-activities.md` |
| 9.2 | The timeline (Marc) | `how-to-use-the-timeline.md` |
| 9.3 | My week (Nancy) | `how-to-use-my-week.md` |
| 9.4 | Import your plan (Marc) | `how-to-import-your-plan.md` |

## 5. Episode template

Each script has:

- **Title card** (season name, episode number, title): 3 to 4 seconds
- **Ada opening** (1 line: the problem)
- **Character beat** (the character asks the question; 1 line)
- **Screen steps** (one per click or decision; callouts on each control)
- **Explanation card** (why it matters; one sentence)
- **Recap** (Ada, 1 line; the next episode's pointer)
- **Role card** (who can do this in DonorDesk, shown on screen)

The role card is required in every episode. It stops viewers thinking they will see a button they do not have.

Timing budget for a 2-minute episode: title 4 s, opening 8 s, screen steps about 80 s, explanation 10 s, role card 8 s, recap 10 s.

## 6. Gaps found in the support docs

1. **No finance how-to.** Finance figures are described only inside the Data Center and the closing report. Episode 4.2 needs an article first.
2. **No "finance on" how-to.** The walkthrough mentions the reporting profile's finance choice, but no article shows how to switch it on.
3. **No Finance Officer role.** Finance figures are not limited to a finance role in the code (the save action checks project access and report status, not a finance permission). Videos use a Grants Officer account for Hameed. See open decision 1.
4. **Phase 28 articles are held** until the work plan ships (S9).

## 7. Open decisions

1. **Finance role.** Keep Hameed as a Grants Officer in the videos, or add a Finance Officer role to the product?
2. **Yadav's role.** Yadav is shown as Admin ("Head of programmes" in the roles article). Alternative: Project Manager, which can approve reports but not manage the team.
3. **Approval mismatch (check before filming).** The domain permission table gives `report.approve` only to Admin and Project Manager. The web capability mirror (`apps/web/src/lib/shared/capabilities.ts`) also gives it to Grants Officer and Compliance Officer. If the UI shows Approve to those roles, the server should refuse it. Approval scenes use Marc or Yadav only until this is checked.
4. **Languages.** The app supports English, Arabic, Urdu, French and Pashto. Start with English.

## 8. Production notes and findings

- **Demo credentials on the login page.** `apps/web/src/app/login/page.tsx` prefills `admin@example.org` / `password123` and prints the demo line under the form. The owner confirmed these are demo-only. Recordings still blank the fields and hide the demo line, so the video never shows them.
- **Recording setup (done for the test render).** Playwright 1.62 with its ffmpeg (`npx playwright install ffmpeg`), driving the Chrome 138 binary from the Puppeteer cache. Recording script: the scratchpad `record-0-2.mjs`. It overlays the title card, captions, callouts and role card on the live page; it does not add audio.
- **Local database not reachable.** `pnpm db:migrate` and `pnpm db:seed` fail on authentication for the `donordesk_app` role in `apps/api/.env`. The migrate script also runs `prisma db push --accept-data-loss`, so it should not be run against an unknown database. Login screens can be recorded; signed-in screens need a working local database.
- **Next.js dev badge.** The development error badge appears in the bottom left of dev recordings. It is hidden in the recording script. It does not appear in production.

## 9. Test render: episode 0.2

- Output: `ep-0-2-test-render.webm`, 1280×720, 36.6 seconds, in the scratchpad folder `ep-0-2/`. Sequence: title card, Ada captions, callouts on the email field, the password field and the forgot-password line, role card, recap card.
- **Version 2 (2026-10-18):** `ep-0-2-v2.mp4`, 1280×720, 58 seconds, in the scratchpad folder `ep-0-2-v2/`. Adds the DonorDesk logo (`Public/newlogo.png`) on the opening card, an end card with the logo, `donordesk.online` and `support@donordesk.online` (Ada reads the address with spoken forms), and redrawn characters: glasses and hair for Ada, a hair clip and earrings for Leila, staff lanyard badges, brand colours (green for Ada, orange for Leila), blinking and breathing animation.
- **Voiced version 1 (2026-10-18):** `ep-0-2-voiced.mp4`, 1280×720, 52 seconds, H.264 video with AAC narration, in the scratchpad folder `ep-0-2/`. Two 2D characters, Ada (guide) and Leila (new joiner), speak nine lines. Their mouths follow each voice's audio envelope, the active speaker is lifted, and captions show the same text as the voice.
- **Narration:** Piper (offline) with two English voices: `en_US-lessac-medium` for Ada, `en_US-amy-medium` for Leila. Script: `tts.py`. Mixing and recording: `record-0-2-voiced.mjs`. Bundled ffmpeg (from `imageio-ffmpeg`) does the encoding and audio mix.
- **Still missing:** a signed-in segment (needs the local database, see section 8). The characters are simple placeholder art; a final illustrator set is still to be decided.
- Scope: this is a pipeline check, not a final episode.

## 10. Production order

1. Restore the local database, then re-record 0.2 with the signed-in flow.
2. Decide on final character art (placeholder art is in use) and whether to keep Piper voices or pick others per character.
3. Script and film **S1 Setting Up**, then **S2 In the Field** and **S3 A Reporting Month** (they share demo data).
5. Film S5, S6, S7 and S8 in any order.
6. Hold S4 until the finance gap is closed; hold S9 until Phase 28 ships.

## 11. Change log

- 2026-10-18: Draft v2. All episodes capped at 1 to 2 minutes (3-minute topics split into a and b). Test render 0.2 recorded (login screen, silent). Added production notes.
- 2026-10-18: Draft v1, built from `memorybank/docs/support/`, `packages/domain/src/policies/permissions.ts` and `apps/web/src/lib/shared/capabilities.ts`.
