// Clean replay driver: builds the Pakistan KP CMAM + IYCF demo project step by step in a VISIBLE browser.
//
//   1. python3 mk_inputs.py inputs                       (writes the sheets and the Word proposal)
//   2. Start Chromium with remote debugging and open it (see README.md), sign-in is done by phase 0
//   3. DD_EMAIL=... DD_PASS=... node run-demo.mjs 0 1 2 ...   (any phases, in order; "all" runs every phase)
//
// Phases are small and re-runnable on their own. PAUSE=1500 (ms) slows every step down for screen recording.
// Credentials come from the environment only. State (draft id, project id) is kept in state.json.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const require = createRequire(new URL("../../apps/web/package.json", import.meta.url).pathname);
const { chromium } = require("@playwright/test");
const HERE = new URL(".", import.meta.url).pathname;
const BASE = process.env.DD_BASE || "https://donordesk.online";
const PAUSE = Number(process.env.PAUSE || 400);
const DEMO_PASS = process.env.DEMO_PASS || "Demo#Pak2026kp";
const IN = HERE + "inputs/";
const state = existsSync(HERE + "state.json") ? JSON.parse(readFileSync(HERE + "state.json", "utf8")) : {};
const save = () => writeFileSync(HERE + "state.json", JSON.stringify(state, null, 1));
const csv = (f) => readFileSync(IN + f, "utf8").trim().split("\n").slice(1).map((l) => (l.match(/("([^"]*)"|[^,]*)(,|$)/g) || []).map((x) => x.replace(/,$/, "").replace(/^"|"$/g, "")));
const meta = JSON.parse(readFileSync(IN + "meta.json", "utf8"));
const forms = JSON.parse(readFileSync(HERE + "forms.json", "utf8"));

const CFG = {
  donor: "UNICEF", country: "Pakistan", sector: "Nutrition",
  name: process.env.DD_NAME || "[DEMO-17] CMAM and IYCF in Upper Dir and Mardan, Khyber Pakhtunkhwa, Pakistan", code: process.env.DD_CODE || "PAK-KP-CMAM-2026",
  start: "2026-11-01", end: "2027-04-30", currency: "USD",
  summary: "Six-month UNICEF-funded programme delivering community-based management of acute malnutrition (OTP, SFP, stabilisation centres), PLW screening, IYCF counselling and micronutrient supplementation in Upper Dir and Mardan districts, with monthly reporting by place and sex.",
  districts: ["Upper Dir", "Mardan"], boundaryProvince: "K.P.",
  owners: { OC: "Imran Yousafzai", "1.1": "Gul Rehman", "1.2": "Gul Rehman", "1.3": "Nasreen Akhtar", "1.4": "Nasreen Akhtar", "2.1": "Farah Naz", "2.2": "Farah Naz", "2.3": "Farah Naz", "3.1": "Zahid Ali", "3.2": "Zahid Ali" },
  leads: { "gul.rehman": "Gul Rehman", "nasreen.akhtar": "Nasreen Akhtar", "zahid.ali": "Zahid Ali", "farah.naz": "Farah Naz", "ayesha.khan": "Dr. Ayesha Khan", "imran.yousafzai": "Imran Yousafzai" },
  rateExtras: (t) => /OTP treatment/.test(t) ? ["OC1-1", "OC1-2", "OC1-3", "OC1-4"] : /SFP treatment of MAM/.test(t) ? ["OC1-5", "OC1-6", "OC1-7", "OC1-8"] : /Stabilisation centre/.test(t) ? ["OC1-9", "OC1-10", "OC1-11"] : [],
  budgetTies: ["Nutrition supply receipt, storage and stock check - Upper Dir", "MNP, IFA and MMN distribution - Upper Dir", "Community MUAC screening and referral - Upper Dir", "OTP treatment of SAM with RUTF - Mardan", "IYCF counselling in communities - Mardan", "Training of health staff in CMAM and IYCF - Upper Dir", "Monthly district data review and report", "A cost of the whole project"],
  risks: [
    ["It might happen", "Winter snow and landslides cut roads in Upper Dir, delaying RUTF delivery and caregiver attendance", "High"],
    ["It might happen", "Flooding or displacement in Mardan raises admissions beyond site capacity", "Medium"],
    ["It might happen", "Turnover of lady health workers reduces MUAC screening coverage", "Medium"],
    ["It might happen", "RUTF sharing within households slows recovery of children with SAM", "Low"],
    ["It might happen", "Stock-out of RUTF or RUSF at tehsil stores during winter", "High"],
    ["It has happened", "Late monthly reports from remote Upper Dir sites in the previous cycle", "Low"],
    ["We are assuming", "The Nutrition Directorate keeps OTP, SFP and SC sites open and staffed", ""],
    ["We are assuming", "The UNICEF supply pipeline delivers RUTF, RUSF and MNP on schedule", ""],
  ],
  dashboardTemplate: "Nutrition: screening and treatment",
  dashboardRoles: ["OP1.1-1 ", "OP1.2-1 ", "OP2.2-3 ", "OP1.2-7 ", "OC1-1 "],
};

const browser = await chromium.connectOverCDP(process.env.DD_CDP || "http://localhost:9333");
const ctx = browser.contexts()[0];
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.setDefaultTimeout(30000);
const nap = (ms = PAUSE) => page.waitForTimeout(ms);
const say = (m) => console.log("\n== " + m);
const fill = async (label, v, scope = page, i = 0) => { const b = scope.getByLabel(label, { exact: true }).nth(i); await b.fill(v); await b.press("Tab"); await nap(150); };
const tab = async (n) => { await page.getByRole("button", { name: new RegExp("^" + n + "\\. ") }).first().click(); await nap(1200); };
const remaining = async () => { const t = await page.locator("main").innerText(); return t.slice(t.indexOf("Still to answer")).slice(0, 700); };
const optStart = async (loc, start) => (await loc.locator("option").allInnerTexts()).find((o) => o.startsWith(start));

const PHASES = {
  // ---------- 0. sign in ----------
  0: ["Sign in", async () => {
    await page.goto(BASE + "/login"); await nap();
    await page.getByLabel(/email/i).first().fill(process.env.DD_EMAIL); await page.getByLabel(/password/i).first().fill(process.env.DD_PASS);
    await page.getByRole("button", { name: /sign in|log in/i }).first().click();
    await page.waitForURL((u) => !/login/.test(u.toString()), { timeout: 30000 });
  }],
  // ---------- 1. wizard: start (donor, country, sector) and read the three sheets ----------
  1: ["Wizard slide 1: start and read the sheets", async () => {
    await page.goto(BASE + "/projects/new/wizard"); await page.waitForSelector("h1"); await nap(2500);
    await page.getByText("Start a different project instead").click().catch(() => {}); await nap(2500);
    await page.waitForSelector("#pcw-file");
    await page.locator("main select").first().selectOption({ label: CFG.sector });
    await fill("Donor", CFG.donor); await fill("Country", CFG.country);
    // Three sheets read well in one batch; five files in one request time out (about 20 s), so places and budget are done on the slides.
    await page.locator("#pcw-file").setInputFiles(["logframe.csv", "indicators.csv", "workplan.csv"].map((f) => IN + f));
    await page.getByRole("button", { name: "Read my documents" }).click();
    for (let i = 0; i < 80; i++) { await page.waitForTimeout(4000); const t = await page.locator("main").innerText(); if (/timed out|expired|could not be read/i.test(t)) throw new Error("read failed: " + t.match(/.*(timed out|expired|could not be read).*/i)[0]); if (!/Sending|Reading|being read|in progress/i.test(t) && i > 1) break; }
    state.draft = new URL(page.url()).searchParams.get("id"); save(); console.log(await remaining());
  }],
  // ---------- 2. confirm what was read ----------
  2: ["Confirm results, indicators and plan", async () => {
    for (const n of [3, 4, 6]) { await tab(n); const b = page.getByRole("button", { name: /Confirm all \d+/ }).first(); if (await b.count()) { await b.click(); await nap(6000); } }
  }],
  // ---------- 3. project and team ----------
  3: ["Wizard slide 2: project and team", async () => {
    await tab(2);
    await fill("Project name", CFG.name); await fill("Project code", CFG.code); await fill("Start date", CFG.start); await fill("End date", CFG.end); await fill("Currency (for example USD)", CFG.currency); await fill("Short summary", CFG.summary);
    for (const [name, email, role] of meta.team) {
      await fill("Name", name, page.locator("main")); await fill("Email (needed to invite)", email);
      await page.getByLabel("Role", { exact: true }).selectOption({ label: role }); await page.getByLabel("Invitation", { exact: true }).selectOption({ label: "Invite later" });
      await page.getByRole("button", { name: "Add to team" }).click(); await nap(1200);
    }
    await page.getByLabel("There are no outside partners").check();
  }],
  // ---------- 4. indicators: owner, direction, starting value, kind ----------
  4: ["Wizard slide 4: indicators", async () => {
    await tab(4);
    const rows = csv("indicators.csv");
    const resp = page.getByLabel("Responsible", { exact: true }), better = page.getByLabel("Better when", { exact: true }), nostart = page.getByLabel("No starting value", { exact: true }), sv = page.getByLabel("Starting value", { exact: true }), kind = page.getByLabel("Kind of number", { exact: true });
    for (let i = 0; i < rows.length; i++) {
      const [, , type, , , , , , lf, , bet] = rows[i];
      await resp.nth(i).selectOption({ label: await optStart(resp.nth(i), CFG.owners[lf.startsWith("OC") ? "OC" : lf]) }); await nap(150);
      await better.nth(i).selectOption({ label: bet }); await nap(150);
      if (type === "PERCENTAGE") { if (!(await nostart.nth(i).isChecked())) { await nostart.nth(i).click(); await nap(500); } }
      else { await sv.nth(i).fill("1"); await sv.nth(i).fill("0"); await sv.nth(i).press("Tab"); await kind.nth(i).selectOption({ label: "Number" }); await nap(200); }
    }
    console.log(await remaining());
  }],
  // ---------- 5. places ----------
  5: ["Wizard slide 5: places", async () => {
    await tab(5);
    const c = page.getByRole("button", { name: /Confirm all \d+/ }).first(); if (await c.count()) { await c.click(); await nap(3000); }
    await page.getByLabel("Country", { exact: true }).selectOption({ label: CFG.country }); await nap(4000);
    for (const nm of CFG.districts) {
      await page.getByLabel("Search areas").fill(nm); await nap(1200);
      await page.getByRole("button", { name: new RegExp("^" + nm + "\\s*" + CFG.boundaryProvince.replace(/\./g, "\\.") + "$") }).first().click(); await nap(800);
      await page.getByRole("button", { name: "Tick this area", exact: true }).click().catch(() => {}); await nap(2500);
    }
  }],
  // ---------- 6. work plan ----------
  6: ["Wizard slide 6: work plan", async () => {
    await tab(6);
    const a = page.getByRole("button", { name: /^Accept all/ }).first(); if (await a.count()) { await a.click(); await nap(8000); }
    const rows = csv("workplan.csv");
    const lead = page.getByLabel("Led by", { exact: true });
    const where = page.locator("fieldset").filter({ has: page.locator("legend", { hasText: /^Where$/ }) });
    const feeds = page.locator("fieldset").filter({ has: page.locator("legend", { hasText: /^Feeds indicators$/ }) });
    for (let i = 0; i < rows.length; i++) {
      const [, title, , , email, loc] = rows[i];
      await lead.nth(i).selectOption({ label: await optStart(lead.nth(i), CFG.leads[email.split("@")[0]]) }); await nap(200);
      const cb = where.nth(i).locator("label").filter({ hasText: new RegExp("^\\s*" + loc + "\\s*$") }).locator("input");
      if (!(await cb.isChecked())) { await cb.click(); await nap(300); }
      for (const code of CFG.rateExtras(title)) { const c = feeds.nth(i).locator("label").filter({ hasText: new RegExp("^\\s*" + code + " ·") }).locator("input"); if (!(await c.isChecked())) { await c.click(); await nap(250); } }
    }
  }],
  // ---------- 7. data entry ----------
  7: ["Wizard slide 7: data entry", async () => {
    await tab(7);
    const rows = csv("indicators.csv");
    const sels = page.locator("main select").filter({ has: page.locator("option", { hasText: "A form in the field" }) });
    for (let i = 0; i < rows.length; i++) { await sels.nth(i).selectOption({ label: rows[i][2] === "PERCENTAGE" ? "Typed in" : "A form in the field" }); await nap(250); }
    const s = page.locator("main select").filter({ has: page.locator("option", { hasText: /^Full:/ }) }).first();
    await s.selectOption({ label: await optStart(s, "Full") }); await nap(500);
    await fill("Opens (days before the period ends)", "5"); await fill("Closes (days after the period ends)", "10");
  }],
  // ---------- 8. reporting ----------
  8: ["Wizard slide 8: reporting", async () => {
    await tab(8);
    const freq = page.getByLabel("Reports are made", { exact: true }); if (!(await freq.inputValue())) await freq.selectOption({ label: "Every month" });
    await page.getByLabel("Layout", { exact: true }).first().selectOption({ label: "The standard layout" });
    await fill("Due (days after the period ends)", "15", page, 0);
    await page.locator("main select").filter({ has: page.locator("option", { hasText: "Quarterly report" }) }).last().selectOption({ label: "Final report" }); await nap(800);
    await page.getByLabel("Layout", { exact: true }).last().selectOption({ label: "The standard layout" });
    await page.getByLabel("Due (days after the period ends)", { exact: true }).last().fill("30"); await page.getByLabel("Due (days after the period ends)", { exact: true }).last().press("Tab"); await nap(800);
  }],
  // ---------- 9. budget and finance ----------
  9: ["Wizard slide 9: budget and finance", async () => {
    await tab(9);
    const fund = page.locator("fieldset").filter({ has: page.locator("legend", { hasText: "Add funding" }) });
    await fill("From", CFG.donor, fund); await fill("Amount", String(meta.total), fund); await fill("Currency (three letters)", "USD", fund);
    await fund.getByRole("button", { name: "Add funding" }).click(); await nap(2000);
    const bud = page.locator("fieldset").filter({ has: page.locator("legend", { hasText: "Add a budget line" }) });
    for (const [n, a] of meta.budget) { await fill("Budget line", n, bud); await fill("Amount", String(a), bud); await fill("Currency (three letters)", "USD", bud); await bud.getByRole("button", { name: "Add a budget line" }).click(); await nap(2000); }
    const u = page.getByRole("button", { name: /Use USD/ }); if (await u.count()) await u.click(); await nap(1500);
    const sels = page.locator("main select").filter({ has: page.locator("option", { hasText: "A cost of the whole project" }) });
    for (let i = 0; i < CFG.budgetTies.length; i++) { await sels.nth(i).selectOption({ label: CFG.budgetTies[i] }); await nap(500); }
  }],
  // ---------- 10. risks, starting dashboard, sign off, start ----------
  10: ["Wizard slide 10: risks, sign off and start", async () => {
    await tab(10);
    const fs = page.locator("fieldset").filter({ has: page.locator("legend", { hasText: "Add a risk or assumption" }) });
    for (const [k, w, s] of CFG.risks) {
      await fs.getByLabel("What it is", { exact: true }).selectOption({ label: k }); await nap(200);
      await fill("What it is about", w, fs); if (s) await fs.getByLabel("How serious", { exact: true }).selectOption({ label: s });
      await page.getByRole("button", { name: "Add a risk or assumption" }).last().click(); await nap(1800);
    }
    await page.getByLabel("Dashboard", { exact: true }).selectOption({ label: CFG.dashboardTemplate }); await nap(1000);
    console.log(await remaining());
    await page.getByRole("button", { name: "Sign off", exact: true }).click(); await nap(3000);
    await page.getByRole("button", { name: "Start the project", exact: true }).click();
    for (let i = 0; i < 60; i++) { await page.waitForTimeout(5000); const t = await page.locator("main").innerText(); if (/The project has been started|could not|failed|stopped/i.test(t)) break; }
    const href = await page.getByRole("link").evaluateAll((a) => a.filter((x) => /open the project/i.test(x.innerText)).map((x) => x.href));
    state.pid = href[0]?.split("/").pop(); save(); console.log("project", state.pid);
  }],
  // ---------- 11. the organisation's places list (tehsils and facilities with pins) ----------
  11: ["Places list: import districts, tehsils and facilities", async () => {
    await page.goto(BASE + "/where-we-work/manage"); await nap(3000);
    await page.locator("input[type=file]").first().setInputFiles(IN + "places.csv"); await nap(1500);
    await page.getByRole("button", { name: "Check the sheet" }).click(); await nap(5000);
    await page.getByRole("button", { name: /^Add these places/ }).click(); await nap(6000);
  }],
  // ---------- 12. the project's own areas ----------
  12: ["Project areas: tick the districts", async () => {
    await page.goto(`${BASE}/projects/${state.pid}/places`); await nap(3000);
    const c = page.getByLabel("Country", { exact: true }); if (!(await c.inputValue())) { await c.selectOption({ label: CFG.country }); await nap(3000); }
    await page.getByRole("button", { name: `Show the areas inside: ${CFG.boundaryProvince}` }).click(); await nap(1500);
    for (const nm of CFG.districts) { const cb = page.getByRole("checkbox", { name: nm, exact: true }); await cb.scrollIntoViewIfNeeded(); await cb.click(); await nap(2500); }
  }],
  // ---------- 13. monthly plan rows for the remaining months ----------
  13: ["Work plan: monthly repeats for December to April", async () => {
    await page.goto(`${BASE}/projects/${state.pid}/activities/plan/import`); await nap(3000);
    await page.locator("input[type=file]").first().setInputFiles(IN + "workplan-dec.csv"); await nap(2500);
    await page.getByRole("button", { name: "Create planned activities" }).click(); await nap(12000);
    console.log((await page.locator("main").innerText()).match(/Created \d+ planned activities/)?.[0]);
  }],
  // ---------- 14. field forms ----------
  14: ["Field forms: build and publish seven forms", async () => {
    for (const f of forms) {
      await page.goto(`${BASE}/projects/${state.pid}/forms/new`); await nap(2500);
      await page.getByLabel("Form name", { exact: true }).fill(f.name); await page.getByLabel("What it is for (optional)", { exact: true }).fill(f.about);
      for (let i = 0; i < f.q.length; i++) {
        await page.getByRole("button", { name: "Add a question" }).first().click(); await nap(250);
        await page.getByLabel("Question " + (i + 1), { exact: true }).fill(f.q[i][0]); await page.getByLabel("Answer type").nth(i).selectOption({ label: f.q[i][1] });
        if (i < 2) await page.getByLabel("Always required").nth(i).check().catch(() => {});
      }
      for (let j = 0; j < f.m.length; j++) {
        await page.getByRole("button", { name: "Add an indicator" }).click(); await nap(300);
        const ind = page.getByLabel("Indicator", { exact: true }).nth(j); await ind.selectOption({ label: await optStart(ind, f.m[j][0] + " ") });
        await page.getByLabel("How", { exact: true }).nth(j).selectOption({ label: "Add up a number" }); await nap(300);
        await page.locator("main select").filter({ has: page.locator("option", { hasText: f.m[j][1] }) }).last().selectOption({ label: f.m[j][1] });
        await page.getByLabel("The date that decides the period", { exact: true }).nth(j).selectOption({ label: f.q[0][0] });
      }
      await page.getByRole("button", { name: "Save the draft" }).click(); await nap(4000);
      await page.getByRole("button", { name: "Publish", exact: true }).click(); await nap(3000); console.log("published:", f.name);
    }
  }],
  // ---------- 15. invite the team and accept the invitations ----------
  15: ["Team: invite nine people", async () => {
    const roleMap = { "Project manager": "Project Manager", "Monitoring and evaluation officer": "M&E Officer", "Grants officer": "Grants Officer", "Field officer": "Field Officer", "Compliance officer": "Compliance Officer", Viewer: "Viewer" };
    const out = [];
    for (const [name, email, role] of meta.team) {
      await page.goto(BASE + "/team"); await nap(2500); await page.getByRole("button", { name: "Invite member" }).click(); await nap(800);
      await page.locator("input[type=email]").fill(email); await page.getByLabel("Role", { exact: true }).first().selectOption({ label: roleMap[role] });
      await page.getByLabel(new RegExp(CFG.name.slice(0, 9).replace(/[[\]]/g, "\\$&"))).check(); await page.getByRole("button", { name: "Send invite" }).click(); await nap(3500);
      const m = (await page.locator("main").innerText()).match(/\/invite\S*/i); out.push([name, email, m ? m[0] : ""]); console.log(name, m?.[0]);
    }
    state.invites = out; save();
  }],
  16: ["Team: each person accepts their invitation (separate browser context)", async () => {
    for (const [name, , url] of state.invites) {
      const c = await browser.newContext(); const p = await c.newPage(); p.setDefaultTimeout(20000);
      await p.goto(BASE + url); await p.waitForTimeout(2500);
      await p.locator("input[name=name]").fill(name); await p.locator("input[name=password]").fill(DEMO_PASS);
      await p.locator("input[name=acceptTerms]").check(); await p.getByRole("button", { name: "Accept invitation" }).click(); await p.waitForTimeout(6000); console.log(name, "joined"); await c.close();
    }
  }],
  // ---------- 17. setup page ----------
  17: ["Project setup: confirm how indicators are read, mark setup complete", async () => {
    await page.goto(`${BASE}/projects/${state.pid}/setup`); await nap(3000);
    await page.getByRole("link", { name: "Review", exact: true }).first().click(); await nap(3500);
    await page.getByRole("button", { name: /^Confirm all/ }).click(); await nap(8000);
    await page.goto(`${BASE}/projects/${state.pid}/setup`); await nap(3000);
    await page.getByRole("button", { name: "Mark setup complete" }).click(); await nap(3000);
  }],
  // ---------- 18. starting dashboard ----------
  18: ["Dashboard from the Nutrition template", async () => {
    await page.goto(BASE + "/visuals/templates"); await nap(3000);
    await page.getByText(CFG.dashboardTemplate, { exact: true }).first().locator("xpath=ancestor::*[.//button[normalize-space()='Use this template']][1]").getByRole("button", { name: "Use this template" }).click(); await nap(2500);
    const S = page.locator("select"); const pick = async (i, sw) => { await S.nth(i).selectOption({ label: await optStart(S.nth(i), sw) }); await nap(700); };
    await pick(1, CFG.name.slice(0, 9)); await pick(2, "Everyone"); for (let r = 0; r < CFG.dashboardRoles.length; r++) await pick(3 + r, CFG.dashboardRoles[r]);
    await page.getByRole("button", { name: "Create the dashboard" }).click(); await nap(7000);
    await page.getByRole("link", { name: "Open it" }).first().click(); await nap(6000); console.log(page.url());
  }],
};

const args = process.argv.slice(2); const run = args[0] === "all" ? Object.keys(PHASES) : args;
for (const k of run) { const [title, fn] = PHASES[k] ?? []; if (!fn) { console.log("no phase", k); continue; } say(`Phase ${k}: ${title}`); await fn(); }
await browser.close();
