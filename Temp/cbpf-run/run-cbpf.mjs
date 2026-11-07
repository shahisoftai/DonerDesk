// End-to-end: a person creates the CBPF-SOM-25-S-NGO-37159 project on donordesk.online through the Project Creation Wizard,
// uploading the proposal. Attaches to the visible Chromium on CDP 9333 (see README below), logs every console error,
// failed request and failed step to issues.jsonl and screenshots each step.
//
//   DD_EMAIL=... DD_PASS=... node run-cbpf.mjs            (password only through the environment, never written anywhere)
//   STEPS=start,team node run-cbpf.mjs                      (run a subset; a phase can be re-run, it is idempotent where it can be)
//
// Lessons built in (from the first run):
//  * wait for UI state, never fixed times, and ignore stale text (an old "timed out" banner stays on screen).
//  * a checkbox/select updates after a server round trip: click, then wait until it reads the wanted state.
//  * a value read from the document is only a proposal until the person leaves/accepts it: touch every field.
//  * after each slide, read the rail ("N to answer") and the "Still to answer" list; a slide that is not Complete is an issue.
import { attach, BASE, issue } from "./lib.mjs";

const DOC = "/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/Temp/CBPF-SOM-25-S-NGO-37159.docx";
const ONLY = (process.env.STEPS ?? "").split(",").filter(Boolean);
const want = (k) => ONLY.length === 0 || ONLY.includes(k);

const { page, step, type, shot, browser } = await attach("cbpf");
const nav = page.getByRole("navigation", { name: "Create a project" });
const slide = page.locator("section[aria-roledescription='slide']");
const pause = (ms) => page.waitForTimeout(ms);
const railText = async () => (await nav.innerText()).replace(/\n/g, " | ");
const railOf = async (label) => (await nav.getByRole("button", { name: new RegExp(label) }).innerText()).replace(/\n/g, " ");
const goto = async (label) => { await nav.getByRole("button", { name: new RegExp(label) }).click(); await page.locator("h1").filter({ hasText: new RegExp(label.replace(/ and /, " and ")) }).first().waitFor(); await pause(500); };
const pickLike = async (sel, re) => { for (const o of await sel.locator("option").all()) { const t = (await o.innerText()).replace(/\s+/g, " "); if (re.test(t)) { await sel.selectOption(await o.getAttribute("value")); await pause(400); return; } } throw new Error("no option like " + re); };
/** Clicks a checkbox and waits for the server round trip to show the wanted state. */
const setChecked = async (box, on = true) => { if ((await box.isChecked()) === on) return; await box.click(); for (let i = 0; i < 20 && (await box.isChecked()) !== on; i++) await pause(250); if ((await box.isChecked()) !== on) throw new Error("checkbox did not reach " + on); await pause(300); };
const inbox = async () => (await page.getByRole("complementary", { name: /Still to answer/ }).innerText().catch(() => "(no Still-to-answer list on this page)")).replace(/\n+/g, " | ");
const mustComplete = async (label) => { const r = await railOf(label); if (!/Complete/.test(r)) issue("cbpf", "slide-not-complete", `${label}: "${r}" | ${(await inbox()).slice(0, 400)}`, page.url()); console.log("  rail:", r); };
const confirmAll = async () => { const b = page.getByRole("button", { name: /Confirm all \d+ that are waiting/ }); if (await b.count()) { await b.click(); await pause(900); } };
const removeRow = async (scope, inputPrefix) => { const r = scope.locator("li, article").filter({ has: page.locator(`input[value^="${inputPrefix}"]`) }).first(); await r.getByRole("button", { name: "Remove" }).click(); await pause(900); };

// ---------------------------------------------------------------- login
if (want("login")) await step("login", async () => {
  await page.goto(BASE + "/login");
  if (/login/.test(page.url())) {
    await page.getByLabel("Email").fill(process.env.DD_EMAIL);
    await page.getByLabel("Password").fill(process.env.DD_PASS);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((u) => !/login/.test(u.pathname), { timeout: 20000 });
  }
});

// ---------------------------------------------------------------- 1 start: documents first (a new draft is made when they are sent)
if (want("start")) {
  await step("open wizard (new draft)", async () => { await page.goto(BASE + "/projects/new/wizard?new=1"); await page.waitForURL(/wizard\?id=/, { timeout: 60000 }); await page.waitForSelector("h1", { timeout: 30000 }); });
  await step("start answers then upload proposal", async () => {
    await type("Donor", "Somalia Humanitarian Fund (CBPF)");
    await page.getByLabel("Sector", { exact: true }).selectOption({ label: "Water, sanitation and hygiene" }); await pause(500);
    await type("Country", "Somalia");
    await page.locator("#pcw-file").setInputFiles(DOC); await pause(500);
    await page.getByRole("button", { name: "Read my documents" }).click();
    await page.waitForURL(/wizard\?id=/, { timeout: 60000 });
  });
  await step("answers survived the new draft", async () => {
    await page.waitForSelector("h1");
    const [d, s, c] = [await page.getByLabel("Donor", { exact: true }).inputValue(), await page.getByLabel("Sector", { exact: true }).inputValue(), await page.getByLabel("Country", { exact: true }).inputValue()];
    if (!d || !s || !c) throw new Error(`start answers lost after sending documents: donor="${d}" sector="${s}" country="${c}"`);
  });
  await step("wait for reading", async () => {
    // The banner appears a moment after the redirect: wait for it, then for it to go (the read takes about a minute).
    await page.getByText(/Reading your documents/).first().waitFor({ timeout: 60000 }).catch(() => {});
    for (let i = 0; i < 48; i++) { if (!(await page.getByText(/Reading your documents/).count())) break; await pause(5000); }
    if (await page.getByText(/Reading your documents/).count()) throw new Error("reading did not finish in 240 s");
    await goto("Results framework");
    for (let i = 0; i < 12 && !(await slide.locator("li").count()); i++) await pause(5000);
    if (!(await slide.locator("li").count())) throw new Error("the document produced no results");
    await goto("Start");
  });
  await mustComplete("Start");
}

// ---------------------------------------------------------------- 2 project and team
if (want("team")) {
  await goto("Project and team");
  await step("project facts", async () => {
    await type("Project name", "Life-Saving Flagship WASH Response: Community-Driven Water, Sanitation, and Hygiene Services for Crisis-Affected Populations");
    await type("Project code", "CBPF-SOM-25-S-NGO-37159");
    await type("Start date", "2025-09-01"); await type("End date", "2026-02-28");
    await type("Currency (for example USD)", "USD");
    await type("Short summary", "Urgent, community-driven water, sanitation and hygiene services for IDP and host communities in Baidoa District, Somalia: water trucking, borehole rehabilitation, gender-segregated emergency latrines, hygiene kits and cholera-prevention hygiene promotion. Implemented by Youth In Action Baidoa under the SHF Standard Allocation 2 2025.");
  });
  const add = (name, email, role) => step("add " + name, async () => {
    if (await slide.getByText(name, { exact: false }).count()) return;
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Email (needed to invite)").fill(email);
    await page.getByLabel("Role", { exact: true }).selectOption(role);
    await page.getByLabel("Invitation").selectOption({ label: "Invite later" });
    await page.getByRole("button", { name: "Add to team" }).click(); await pause(800);
  });
  await add("Abdullahi Hudow Osman", "youthinactionbaidoa@gmail.com", "PROJECT_MANAGER");
  await add("M&E Officer (to be named)", "mnpiracha+yia-me@gmail.com", "ME_OFFICER");
  await step("no outside partners", async () => { await setChecked(page.getByRole("checkbox", { name: "There are no outside partners" })); });
  await mustComplete("Project and team");
}

// ---------------------------------------------------------------- 3 results framework
if (want("results")) {
  await goto("Results framework");
  await step("confirm what was read", confirmAll);
  await step("remove outcomes/outputs read from the document (they are donor objectives, not this project's results; ours are added below)", async () => {
    for (let guard = 0; guard < 12; guard++) {
      const rows = await slide.locator("li").filter({ hasText: /^(OUTCOME|OUTPUT)/ }).filter({ hasText: "From your document" }).all();
      if (!rows.length) break;
      await rows[0].getByRole("button", { name: /Remove/ }).click(); await pause(900);
    }
  });
  const f = slide.locator("fieldset", { hasText: "Add a result" });
  const addResult = (kind, title, parent) => step("add " + kind, async () => {
    if (await slide.locator(`input[value^="${title.slice(0, 25)}"]`).count()) return;
    await f.getByLabel("Kind", { exact: true }).selectOption(kind);
    await f.getByLabel("What will be achieved").fill(title);
    await pickLike(f.getByLabel("Belongs to"), parent);
    await f.getByRole("button", { name: "Add a result" }).click(); await pause(900);
  });
  await addResult("OUTCOME", "Crisis-affected people in Baidoa District have safe, equitable and dignified access to WASH services", /G\d/);
  await addResult("OUTPUT", "Emergency water, sanitation and hygiene services delivered to IDP and host community households", /OC|Crisis-affected/);
  await step("every activity under the output", async () => {
    for (const r of await slide.locator("li").filter({ hasText: "ACTIVITY" }).all()) {
      const s = r.locator("select").first();
      const cur = await s.evaluate((x) => x.value);
      if (!cur) await pickLike(s, /Emergency water, sanitation/);
    }
  });
  await step("keep generated codes", async () => { const b = page.getByRole("button", { name: /Keep the \d+ codes/ }); if (await b.count()) { await b.click(); await pause(900); } });
  await mustComplete("Results framework");
}

// ---------------------------------------------------------------- 4 indicators
if (want("indicators")) {
  await goto("Indicators");
  const t = async (c, label, v) => { const b = c.getByLabel(label, { exact: true }); await b.fill(v); await b.press("Tab"); await pause(350); };
  const complete = async (c, o) => {
    await pickLike(c.getByLabel("Measures"), /^Output/);
    await c.getByLabel("Kind of number").selectOption(o.kind); await pause(350);
    await t(c, "Unit", o.unit); await t(c, "Starting value", "0"); await t(c, "Target", o.target);
    await c.getByLabel("How often").selectOption(o.freq); await pause(350);
    if (o.breakdown) await t(c, "Break down by (separate with commas)", o.breakdown);
    await pickLike(c.getByLabel("Responsible"), /M&E Officer/);
    await c.getByLabel("Better when").selectOption("HIGHER"); await pause(500);
  };
  await step("confirm indicators read from the document", confirmAll);
  const titleInputs = async () => slide.locator("article").evaluateAll((a) => a.map((x) => x.querySelector("input")?.value ?? ""));
  const cardWith = async (re) => { const t = await titleInputs(); const i = t.findIndex((v) => re.test(v)); return i < 0 ? null : slide.locator("article").nth(i); };
  await step("female participation as a percentage", async () => {
    let c = await cardWith(/female/i);
    if (!c) { const f = slide.locator("fieldset", { hasText: "Add an indicator" }); await f.getByLabel("What will be measured").fill("Female participation"); await pickLike(f.getByLabel("Measures"), /^Output/); await f.getByRole("button", { name: "Add an indicator" }).click(); await pause(1000); c = await cardWith(/female/i); }
    await complete(c, { kind: "PERCENTAGE", unit: "%", target: "53", freq: "Quarterly" });
  });
  await step("people reached (the proposal's Indicator 1.1.1)", async () => {
    let c = await cardWith(/people reached/i);
    if (!c) { const f = slide.locator("fieldset", { hasText: "Add an indicator" }); await f.getByLabel("What will be measured").fill("Number of people reached with emergency water services in vulnerable settlements and communities"); await pickLike(f.getByLabel("Measures"), /^Output/); await f.getByRole("button", { name: "Add an indicator" }).click(); await pause(1000); c = await cardWith(/people reached/i); }
    await complete(c, { kind: "NUMBER", unit: "people", target: "13500", freq: "Monthly", breakdown: "Women, Girls, Men, Boys" });
  });
  await mustComplete("Indicators");
}

// ---------------------------------------------------------------- 5 places
if (want("places")) {
  await goto("Places");
  await step("tidy the places read from the document", async () => {
    for (const name of ["Baydhaba", "Baydhaba", "Baidoa District"]) { try { await removeRow(slide, name); } catch { /* already gone */ } }
    await confirmAll();
    const have = (await slide.locator("input").evaluateAll((i) => i.map((x) => x.value))).join("|");
    const f = slide.locator("fieldset", { hasText: "Add a place" });
    const addPlace = async (name, kind, inside) => { if (have.includes(name)) return; await f.getByLabel("Place name").fill(name); await f.getByLabel("Kind of place").selectOption(kind); if (inside) await f.getByLabel("Inside").selectOption({ label: inside }); await f.getByRole("button", { name: "Add a place" }).click(); await pause(800); };
    await addPlace("Somalia", "0"); await addPlace("Bay", "1", "Somalia"); await addPlace("Baidoa", "2", "Bay");
  });
  await step("project area", async () => { await type("Project area", "Baidoa District, Bay Region, Somalia", slide); });
  await mustComplete("Places");
}

// ---------------------------------------------------------------- 6 work plan
if (want("plan")) {
  await goto("Work plan");
  const items = [
    ["Emergency water trucking to IDP sites and rural villages", /trucking/, "2025-09-01", "2026-02-28", [/people reached/], /trucking|water truck/i],
    ["Rehabilitation of strategic boreholes, shallow wells and distribution systems", /Rehabilitation/, "2025-09-15", "2025-12-15", [/people reached/], /rehabilit/i],
    ["Installation of gender-segregated emergency latrines in IDP settlements", /Gender-segregated|sanitation/, "2025-10-01", "2026-01-15", [/people reached/], /latrine|sanitation facilit|gender-segregated/i],
    ["Distribution of hygiene kits with hygiene promotion sessions", /Hygiene kit/, "2025-10-15", "2026-02-15", [/people reached/, /Female participation/], /hygiene kit/i],
    ["Community-led hygiene promotion campaigns (cholera prevention)", /Community-led/, "2025-09-15", "2026-02-28", [/Female participation/], /community-led|promotion campaign/i],
  ];
  await step("remove placeholder plan item", async () => { try { await removeRow(slide, "Activity 1.1.1"); } catch { /* none */ } });
  await step("confirm plan items read from the document", confirmAll);
  const f = slide.locator("fieldset", { hasText: "Add an activity" });
  const planTitles = async () => slide.locator("article").evaluateAll((a) => a.map((x) => x.querySelector("input")?.value ?? ""));
  for (const [title, part, s, e, feeds, key] of items) {
    await step("plan: " + title.slice(0, 34), async () => {
      let idx = (await planTitles()).findIndex((v) => key.test(v));
      if (idx < 0) {
        await f.getByLabel("Activity", { exact: true }).fill(title);
        await pickLike(f.getByLabel("Part of"), part);
        await f.getByRole("button", { name: "Add an activity" }).click(); await pause(1000);
        idx = (await planTitles()).findIndex((v) => key.test(v));
      }
      const acc = page.getByRole("button", { name: /Accept all \d+/ }); if (await acc.count()) { await acc.first().click(); await pause(700); } // the suggested links, with their reasons
      const card = slide.locator("article").nth(idx);
      for (const [lab, v] of [["Starts", s], ["Ends", e]]) { const b = card.getByLabel(lab, { exact: true }); await b.fill(v); await b.press("Tab"); await pause(350); }
      await pickLike(card.getByLabel("Led by"), /Abdullahi/);
      await setChecked(card.getByRole("checkbox", { name: "Baidoa" }));
      for (const re of feeds) await setChecked(card.getByRole("checkbox", { name: re }));
      await setChecked(card.getByRole("checkbox", { name: "Records who took part" }));
    });
  }
  await mustComplete("Work plan");
}

// ---------------------------------------------------------------- 7 data entry
if (want("entry")) {
  await goto("Data entry");
  await step("accept suggested methods", async () => { const b = page.getByRole("button", { name: /Use all \d+ suggestions/ }); if (await b.count()) { await b.click(); await pause(900); } });
  await step("review mode and entry window", async () => {
    await page.getByLabel("How values are checked").selectOption({ label: "Full: every value is handed in, then a reviewer verifies it" }); await pause(500);
    await type("Opens (days before the period ends)", "5", slide); await type("Closes (days after the period ends)", "10", slide);
  });
  await mustComplete("Data entry");
}

// ---------------------------------------------------------------- 8 reporting
if (want("reporting")) {
  await goto("Reporting");
  await step("quarterly + final reports", async () => {
    await page.getByLabel("Reports are made").selectOption("QUARTERLY"); await pause(600);
    for (const [label, days] of [["Quarterly report", "15"], ["Final report", "30"]]) {
      if (!(await slide.locator("article").filter({ hasText: label }).count())) {
        const sel = slide.locator("select").filter({ has: page.locator("option", { hasText: "Situation report" }) }).first();
        await sel.selectOption({ label }); await pause(400);
        const btn = slide.getByRole("button", { name: /Add a kind of report|^Add$/ }); if (await btn.count()) await btn.first().click(); await pause(900);
      }
      const c = slide.locator("article").filter({ hasText: label }).first();
      await c.getByLabel("Layout").selectOption({ label: "The standard layout" }); await pause(400);
      await type("Due (days after the period ends)", days, c);
    }
  });
  await mustComplete("Reporting");
}

// ---------------------------------------------------------------- 9 budget and finance
if (want("finance")) {
  await goto("Budget and finance");
  await step("funding (confirm what was read; add only when missing)", async () => {
    await confirmAll();
    const vals = await slide.locator("input").evaluateAll((i) => i.map((x) => x.value));
    if (vals.some((v) => /^500,?000(\.30)?$/.test(v))) return;
    const f = slide.locator("fieldset", { hasText: "Add funding" });
    await f.getByLabel("From").fill("Somalia Humanitarian Fund (CBPF)"); await f.getByLabel("Amount").fill("500,000.30"); await f.getByLabel("Currency (three letters)").fill("USD");
    await f.getByRole("button", { name: "Add funding" }).click(); await pause(1000);
  });
  await step("budget lines (whole-project costs, with amount and currency)", async () => {
    for (const s of await slide.locator("select").all()) { const o = await s.locator("option").allInnerTexts(); if (o.includes("A cost of the whole project") && !(await s.inputValue())) { await s.selectOption({ label: "A cost of the whole project" }); await pause(600); } }
    for (const [prefix, amt] of [["G. General Operating", "467290.00"], ["PSC Amount", "32710.30"]]) {
      const row = slide.locator("li, article").filter({ has: page.locator(`input[value^="${prefix}"]`) }).first();
      if (!(await row.count())) continue;
      const ins = row.locator("input");
      await ins.nth(1).fill(amt); await ins.nth(1).press("Tab"); await pause(500);
      await ins.nth(2).fill("USD"); await ins.nth(2).press("Tab"); await pause(700);
    }
    await confirmAll();
  });
  await step("reporting currency", async () => { const b = page.getByRole("button", { name: /Use USD, the currency of the funding/ }); if (await b.count()) { await b.click(); await pause(800); } });
  const sum = (await slide.innerText()).match(/Does it add up[\s\S]{0,200}/)?.[0].replace(/\n+/g, " | "); console.log("  ", sum);
  if (!/agree/.test(sum ?? "")) issue("cbpf", "finance-mismatch", "Funding and budget do not agree: " + sum, page.url());
  await mustComplete("Budget and finance");
}

// ---------------------------------------------------------------- 10 review and launch
if (want("launch")) {
  await goto("Review and launch");
  await step("rate risks from the document, add an assumption, pick the dashboard", async () => {
    const levels = { Insecurity: "HIGH", "Road inaccessibility": "MEDIUM", "Community tensions": "MEDIUM", "Financial and operational risks": "LOW", "AWD/cholera outbreaks": "HIGH" };
    for (const [k, lv] of Object.entries(levels)) { const r = slide.locator("li, article").filter({ has: page.locator(`input[value^="${k}"]`) }).first(); if (await r.count()) { await r.getByLabel("How serious").selectOption(lv); await pause(600); } }
    // any other risk read from the document gets a rating too (nothing is added without one)
    for (const r of await slide.locator("li, article").filter({ has: page.locator("select") }).all()) { const sev = r.getByLabel("How serious"); if (await sev.count() && !(await sev.inputValue())) { await sev.selectOption("MEDIUM"); await pause(600); } }
    await confirmAll();
    if (!(await slide.locator('input[value^="Community leaders"]').count())) {
      const f = slide.locator("fieldset", { hasText: "Add a risk or assumption" });
      await f.getByLabel("What it is", { exact: true }).selectOption("ASSUMPTION");
      await f.getByLabel("What it is about").fill("Community leaders, ABC members and local authorities keep supporting safe access to target villages");
      await f.getByLabel("How serious").selectOption("MEDIUM");
      await f.getByRole("button", { name: "Add a risk or assumption" }).click(); await pause(900);
    }
    await page.getByLabel("Dashboard", { exact: true }).selectOption({ label: "Water, sanitation and hygiene: access and results" }); await pause(700);
  });
  console.log("  rail:", await railText());
  await step("sign off", async () => { await page.getByRole("button", { name: /^Sign off$/ }).click(); await page.getByText(/You signed this off on/).waitFor({ timeout: 20000 }); });
  await step("start the project (waits up to 4 min; stale banners ignored)", async () => {
    await page.evaluate(() => { for (const el of document.querySelectorAll("[role=alert]")) el.setAttribute("data-stale", "1"); });
    await page.getByRole("button", { name: "Start the project" }).click();
    const t0 = Date.now();
    for (;;) {
      if (await page.getByText("The project has been started.").count()) break;
      const fresh = await page.locator("[role=alert]:not([data-stale])").allInnerTexts();
      if (fresh.length) throw new Error("launch refused: " + fresh.join(" / ").slice(0, 300));
      if (Date.now() - t0 > 240000) throw new Error("launch still running after 4 minutes");
      await pause(2000);
    }
    console.log("  launched in", Math.round((Date.now() - t0) / 1000), "s");
  });
  const link = page.getByRole("link", { name: "Open the project" });
  if (await link.count()) console.log("  project:", await link.getAttribute("href")); else issue("cbpf", "launch", "no 'Open the project' link after launch", page.url());
  console.log((await slide.innerText()).replace(/\n+/g, " | ").match(/Project details[\s\S]{0,1200}/)?.[0]);
}

await shot("end");
console.log("DONE; issues so far:", (await import("node:fs")).readFileSync(new URL("./issues.jsonl", import.meta.url), "utf8").trim().split("\n").length);
await browser.close();
