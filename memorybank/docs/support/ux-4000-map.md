# Version 4.000 navigation map (for support articles)

**DonorDesk Version 4.01** · written 2026-11-14 · source of truth: `apps/web/src/features/navigation/domain/role-navigation.ts`, `features/projects/domain/project-tabs.ts`, `components/layout/AppShell.tsx`, `features/command/domain/commands.ts`, settings layout. Every support article must use these names. Checked on the live site (admin account) on 2026-11-14.

## 1. The screen

- **Left side (navy rail):** organisation name at the top, then the entries below. A **«** button at the top of the page collapses the rail. On a phone, **☰** (Open navigation menu) opens it.
- **Top bar, left to right:** **Search or jump to… (Ctrl K)** field, **☆ Bookmark**, **Academy**, **Language**, light/dark switch, the **bell**, the blue **+ Record** button, and your **initial** (account menu: your name, email, **Sign out**). **On a phone** the top bar shows only search, the bell, **+ Record** and your initial; **Language** is on **More**, light/dark is in the search (command palette → *Switch light or dark mode*); Bookmark and Academy are on a computer only.
- The brand colour is **cobalt blue** (buttons, links, the active tab). Never describe a button as brown, amber or yellow.
- Slide-over panels (Record, details of a planned activity, evidence peek, attach-files) open from the **right**; on a phone they rise from the bottom. **Esc** or **×** closes; **Back** (←) appears when one panel is opened on top of another.

## 2. Left navigation (by role)

| Group | Entry | What is inside | Who sees it |
|---|---|---|---|
| Work | **Home** | Tabs **Home**, **Portfolio** and **Where we work** (Phase 56: who does what where; **Manage places** for administrators, formerly Settings → Places) | everyone except outside partners (they get **Your projects**) |
| Work | **Inbox** | Tabs **To do**, **Team** (managers), **Updates**; button **Waiting to send** | everyone |
| Work | **Projects** | the project list | everyone |
| Work | **Dashboards and infographics** | Designs, Templates, Datasets, **Tools ▾** | Admin, Project Manager, M&E, Grants, Viewer |
| Report | **Reports** | Tabs **Reports**, **Evidence**, **Compliance**, **Download Center** (a tab shows only if your role may use it) | Admin, PM, M&E, Grants, Compliance, Viewer |
| Report | **Programmes and grants** | funding | Admin, Grants Officer |
| Admin | **Team** | members, invitations | Admin, PM (invite or manage) |
| Admin | **Settings** | grouped list (section 4) | Admin, PM, Grants |

- A **Field Officer** sees **Home**, **Inbox**, **Projects** and **Evidence** only (and the phone bar **Today · Record · Waiting · More**).
- An **outside partner** sees **Home** (their **Your projects** page), **My projects** and **Security**.
- **My Work** and **Notifications** no longer exist: they are the **Inbox** (**To do**, **Team**, **Updates**). The old addresses were removed on 2026-11-15 (no hits since the release).
- **Portfolio**, **Evidence**, **Compliance** and **Download Center** are tabs on top of **Home** and **Reports**, not separate sidebar entries (except Evidence for a field officer).

## 3. A project (Projects → open a project)

Header: title, status, code, donor, country, sector, dates, **Record** button. Below it **seven tabs**, then a row of the pages inside the current tab. Pages marked ▾ are under **More**.

| Tab | Pages inside | Old name |
|---|---|---|
| **Overview** | Overview · ▾ Management report · ▾ Changes of plan · ▾ People reached · ▾ Ask DonorDesk | Overview |
| **Plan** | **Results framework** (the logframe; history, import, indicators) · **Work plan** (planned activities and completed activities, Timeline/List/Calendar/Map) · **Where we work** | Logframe, Activities tabs |
| **Data** | **Data Center** · **Enter data** · **Import** (Bring in data) · **Forms** (collection forms; under More until the project has one) · **Datasets** (under More until it has one) · ▾ **Data tables** (was Report builder) · ▾ Charts (opens the Chart Studio) · ▾ Maps | Data, Datasets tabs |
| **Evidence** | Evidence library of the project | Evidence |
| **Reports** | **Reports** (periods) · **Donor templates** · **Compliance** (project checklist) · ▾ Infographics | Reporting, Templates |
| **Finance** | Finance register | Finance |
| **Settings** | **Project settings** · **Team** (project members, workload, reminder rules) · **Setup** (checklist and reporting profile) | Settings, Team, Setup |

- "Open **Reporting**" becomes "open the **Reports** tab". "The **Team** tab" becomes "**Settings → Team**". "The **Activities** tab" becomes "**Plan → Work plan**". "The **Logframe** tab" becomes "**Plan → Results framework**". "**Collection forms**" becomes "**Data → Forms**".
- A report's own page (open a period from **Reports**): a four-stage bar **Inputs → Story → Draft → Review and export** with one blue **next-step** button (for example **Answer the story questions**). Report inputs (indicators, story, import, scope, finance) are the **Inputs** and **Story** stages; **Export center** is the last stage. There is **no "classic view"** any more.
- Breadcrumbs show where you are (Projects › project › tab › page).

## 4. Settings (left list inside Settings)

| Group | Pages |
|---|---|
| **Organisation** | **General** (name, country, language, sectors, export your data) · **Workspace setup** (the **Get started** checklist) · **Finance** |
| **Data defaults** | **Starting answers** (default packs by sector) · **Sector library** · **Donor requirements** |
| **AI** | **AI features** (Ask DonorDesk and the setup assistant switches) · **AI usage** · **Writing style** (only when enabled) |
| **Security** | **Sign-in and two-step** · **Audit log** |
| **Billing** | **Plan and billing** |
| **Integrations** | **API keys and webhooks** |

Old names: "Setup" tab → **Workspace setup**; "AI Writing Style" tab → **Writing style**; "AI usage" tab → **AI usage**; "Security" → **Sign-in and two-step**; "Requirement packs" → **Donor requirements**; "Setup packs" → **Starting answers**.

## 5. Visuals (Dashboards and infographics)

Tabs: **Designs** (cards), **Templates**, **Datasets**, and **Tools ▾** = **Chart Studio**, **Maps**, **Images and brand**, **Data alerts**, **TV display**. Buttons: **Start from a template**, **New design**. "Add to a dashboard" is one control everywhere: pick the dashboard, then **Add the chart**, **Add as a KPI tile** or **Add the map** (or make a new one).

## 6. Command palette and shortcuts

- **Ctrl K** (Mac **⌘K**), or click **Search or jump to…**: type to find a project, a file or a page, or run an action (for example **Create a project**, **Record a value, activity, file or expense**, **Invite a person**, **Go to Inbox**, **Switch light or dark mode**, **Show keyboard shortcuts**). Only what your role may do is listed. **↑ ↓** move, **Enter** runs, **Esc** closes.
- **?** lists the shortcuts. **G then H** Home · **G I** Inbox · **G P** Projects · **G D** Dashboards · **G R** Reports · **G E** Evidence · **G S** Settings · **R** opens Record. (Shortcuts are ignored while you type in a box.)
- In the planned-activity panel, **J** and **K** (or the ▲▼ buttons) go to the next and previous activity.

## 7. Other changes to describe correctly

- **Create a project:** **New project** opens the **wizard** only (the one-page classic form is retired). Ten slides; tick **Only what is still needed** (under the slide tabs) so **Next** skips slides that are already complete. **Start from a document** is on the first slide.
- **Get started** is the checklist (was "Set up your workspace") with a progress bar: **Settings → Workspace setup** or **/onboarding**.
- **Record** is unchanged in steps (A number, An activity, A photo or file, An expense, A form answer); the button is blue.
- **Team page:** each member row has **Change role**, **Deactivate** (or **Reactivate** when deactivated) and **Delete**. Deactivate stops sign-in and keeps the seat; delete is final, frees the seat and the address, and keeps their records as "Removed user". You cannot act on yourself, and one active administrator must remain. **Invite member** can add the person to projects (required for outside partners). A pending invitation has **Cancel invite**.
- **Evidence:** tick files (or **Select all … awaiting verification**); a bar at the bottom shows **n files selected → Verify**.
- **Verify all** (report inputs): a value that needs a file shows **Attach the files**: choose a file for each value; it is uploaded, verified and the value verified in one step.
- **Forms** you type in (new report, planned activity) keep your typing on this device; **Restore it** appears if you come back.
- **Activity form:** **Here** fills the location from the phone's GPS.
- **Imports:** after an import that skipped rows, **Edit the rows and import again** keeps your text.
- **Projects list:** a **⋯** menu on each row; pointing at a title shows a small card.
- **Data Center:** tabs **Indicator data · By place · Quick chart · Finance · Import / export**; buttons **Chart Studio**, **Map**, **Bring in data** above them. **Quick chart** is the one that goes into a report section.
- **Version label:** DonorDesk Version 4.01.
