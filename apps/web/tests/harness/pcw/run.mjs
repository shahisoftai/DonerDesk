// A real-browser check of the Project Creation Wizard: a person with no documents builds a whole project through all ten slides by
// clicking and typing, signs it off and starts it. The slides, the domain rules and the application's view of the draft are the real
// ones; only the server's storage and the final launch (proven on a real database elsewhere) are stubbed (see stubs/). Run it after
// changing the wizard:   pnpm --filter @donordesk/web test:pcw
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { build } from "./build.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../..");
const out = mkdtempSync(join(tmpdir(), "pcw-"));
await build(join(out, "bundle.js"));
execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.ts", "-i", "src/app/globals.css", "-o", join(out, "styles.css")], { cwd: web, stdio: "ignore" });
writeFileSync(join(out, "index.html"), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="styles.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');
const server = createServer((req, res) => {
  // The boundary files the Places slide reads are the real ones the app ships under /geo.
  if (req.url?.startsWith("/geo/")) {
    try { res.setHeader("content-type", "application/json"); res.end(readFileSync(join(web, "public", decodeURIComponent(req.url.split("?")[0])))); } catch { res.statusCode = 404; res.end(); }
    return;
  }
  const path = req.url?.startsWith("/styles.css") ? "styles.css" : req.url?.startsWith("/bundle.js") ? "bundle.js" : "index.html";
  res.setHeader("content-type", path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html");
  res.end(readFileSync(join(out, path)));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const errors = [];
const results = [];
const open_ = { page: null };
const diag = async () => (open_.page ? open_.page.evaluate(() => window.__h.view().inbox.map((r) => `${r.key}:${r.code}${r.params ? "(" + Object.values(r.params).join("/") + ")" : ""}`).join(", ") + " | facts " + JSON.stringify(window.__h.view().facts) + " | items " + JSON.stringify(window.__h.store.calls.filter((c) => c.name === "editItem").map((c) => c.input))).catch(() => "") : "");
const check = async (name, fn) => { try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name} :: ${String(e.message).split("\n").slice(0, 6).join(" ")}\n       still open: ${await diag()}`); } };
async function open(viewport = { width: 1400, height: 1100 }, lang = "") {
  const page = await (await browser.newContext({ viewport })).newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  page.setDefaultTimeout(4000);
  await page.goto(lang ? `${base}?lang=${lang}` : base, { timeout: 30000 });
  await page.waitForSelector("h1");
  return page;
}
const H = (page) => page.evaluate(() => ({ calls: window.__h.store.calls.map((c) => c.name), inbox: window.__h.view().inbox.length, progress: window.__h.view().progress, status: window.__h.store.status }));
const text = (loc) => loc.innerText().then((t) => t.replace(/\s+/g, " ").trim());
const railOf = (page) => page.getByRole("navigation", { name: "Create a project" });
const go = async (page, label) => { await railOf(page).getByRole("button", { name: new RegExp(label) }).click(); await page.locator("h1").filter({ hasText: new RegExp(label) }).waitFor(); };
const railText = (page, label) => text(railOf(page).getByRole("button", { name: new RegExp(label) }));
/** Types into a labelled box and leaves it, which is what saves. */
const type = async (page, label, value, scope = page) => { const box = scope.getByLabel(label, { exact: true }).first(); await box.fill(value); await box.press("Tab"); await page.waitForTimeout(60); };
const pick = async (page, label, option, scope = page) => { await scope.getByLabel(label, { exact: true }).first().selectOption(option); await page.waitForTimeout(60); };
const press = async (page, name, scope = page) => { await scope.getByRole("button", { name }).first().click(); await page.waitForTimeout(80); };
/** Chooses the option whose text matches a pattern (Playwright selects by exact text or value only). */
const pickLike = async (page, select, re) => {
  for (const o of await select.locator("option").all()) {
    const t = (await o.innerText()).replace(/\s+/g, " ");
    if (re.test(t)) { await select.selectOption(await o.getAttribute("value")); await page.waitForTimeout(60); return; }
  }
  throw new Error(`no option like ${re}`);
};
const box = (page, legend) => page.locator("fieldset", { hasText: legend });

const page = await open();
open_.page = page;

await check("it opens on the first slide with a question to answer, ten slides in the rail, each saying its progress in words", async () => {
  assert.match(await text(page.locator("h1")), /^Start$/);
  const items = await railOf(page).getByRole("button").all();
  assert.equal(items.length, 10);
  assert.match(await railText(page, "Start"), /3 to answer/);
  assert.match(await text(page.getByRole("complementary", { name: "Still to answer" })), /Still to answer \(\d+\)/);
});

await check("Start: donor, sector and country save as you leave each box, and the sector's starting answers fill only what is empty", async () => {
  await type(page, "Donor", "European Union");
  await pick(page, "Sector", "WASH");
  await type(page, "Country", "Uganda");
  assert.match(await railText(page, "Start"), /Complete/);
  await press(page, /use the starting answers/i);
  await page.getByText(/Water, sanitation and hygiene filled:/).waitFor();
  assert.match(await text(page.getByText(/filled:/)), /Report rules/);
});

await check("Project and team: facts save as you leave a box, a person is added with a role, and 'no outside partners' is an answer", async () => {
  await go(page, "Project and team");
  await type(page, "Project name", "Blue Water Gulu");
  await type(page, "Project code", "BWG-1");
  await type(page, "Start date", "2027-03-01");
  await type(page, "End date", "2028-02-29");
  await type(page, "Currency (for example USD)", "eur");
  await type(page, "Short summary", "Safe water for families in Gulu.");
  const add = async (name, email, role) => {
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Email (needed to invite)").fill(email);
    await page.getByLabel("Role", { exact: true }).selectOption(role);
    await press(page, "Add to team");
  };
  await add("Pat Manager", "pat@example.org", "PROJECT_MANAGER");
  await add("Mia Officer", "mia@example.org", "ME_OFFICER");
  await add("Fay Field", "fay@example.org", "FIELD_OFFICER");
  await page.getByRole("checkbox", { name: "There are no outside partners" }).check();
  await page.waitForTimeout(100);
  assert.match(await railText(page, "Project and team"), /Complete/);
  assert.equal(await page.getByLabel("Currency (for example USD)", { exact: true }).inputValue(), "EUR", "a currency is kept, and shown, in capitals");
  assert.match(await text(page.locator("section[aria-roledescription='slide']")), /Fay Field/);
});

await check("Results framework: a goal, an outcome, an output and an activity are added under the right parents, and the made-up codes wait to be kept", async () => {
  await go(page, "Results framework");
  const add = async (level, title, parent) => {
    const f = box(page, "Add a result");
    await f.getByLabel("Kind", { exact: true }).selectOption(level);
    await f.getByLabel("What will be achieved").fill(title);
    if (parent) await pickLike(page, f.getByLabel("Belongs to"), new RegExp(parent));
    await press(page, "Add a result", f);
  };
  await add("GOAL", "Healthy households");
  await add("OUTCOME", "Households use safe water", "Healthy households");
  await add("OUTPUT", "Boreholes rehabilitated", "Households use safe water");
  await add("ACTIVITY", "Rehabilitate boreholes", "Boreholes rehabilitated");
  assert.equal(await page.locator("li", { hasText: "Activity" }).count() >= 1, true);
  assert.match(await text(page.locator("section[aria-roledescription='slide']")), /Codes were made up/);
  await press(page, /Keep the 4 codes made up for you/);
  assert.match(await railText(page, "Results framework"), /Complete/);
  assert.equal(await page.getByRole("button", { name: "Add a result" }).count(), 1);
});

await check("Results framework refuses a wrong parent in plain words", async () => {
  const f = box(page, "Add a result");
  await f.getByLabel("Kind", { exact: true }).selectOption("OUTPUT");
  await f.getByLabel("What will be achieved").fill("Orphan output");
  await press(page, "Add a result", f);
  await page.getByText(/Choose what this output belongs to/).waitFor();
});

await check("Indicators: one is added under the output, completed, owned by a team member, and the way it reads is confirmed", async () => {
  await go(page, "Indicators");
  const f = box(page, "Add an indicator");
  await f.getByLabel("What will be measured").fill("Boreholes working");
  await pickLike(page, f.getByLabel("Measures"), /Output .* Boreholes rehabilitated/);
  await press(page, "Add an indicator", f);
  const card = page.locator("article").first();
  await card.getByLabel("Kind of number").selectOption("NUMBER");
  await type(page, "Unit", "boreholes", card);
  await type(page, "Starting value", "0", card);
  await type(page, "Target", "40", card);
  await card.getByLabel("How often").selectOption("Quarterly");
  await pickLike(page, card.getByLabel("Responsible"), /Mia Officer/);
  await card.getByLabel("Better when").selectOption("HIGHER");
  await page.waitForTimeout(100);
  assert.match(await railText(page, "Indicators"), /Complete/);
});

await check("Places: search finds a district, ticking it saves it with its parent, the map is there, and the project area is met without typing it", async () => {
  await go(page, "Places");
  await page.getByRole("tree", { name: "Areas" }).waitFor({ timeout: 15000 });
  assert.ok(await page.getByRole("group", { name: /Where the project works/ }).first().isVisible(), "the map (or its plain-shapes twin) is on the slide");
  await page.getByLabel("Search areas").fill("Gulu");
  const gulu = page.getByRole("tree", { name: "Areas" }).getByRole("checkbox", { name: "Gulu" }).first();
  await gulu.waitFor({ timeout: 15000 });
  await gulu.check();
  await page.getByText("1 area ticked").waitFor();
  const names = await page.evaluate(() => window.__h.view().places.map((p) => p.value.name));
  assert.ok(names.includes("Uganda") && names.includes("Gulu"), `the country and the area are in the draft: ${names}`);
  assert.match(await railText(page, "Places"), /Complete/);
  await page.getByRole("button", { name: /Untick this area: Gulu/ }).click();
  await page.getByText("Nothing ticked yet.").waitFor();
  await page.getByLabel("Search areas").fill("Gulu");
  await gulu.check();
  await page.getByText("1 area ticked").waitFor();
});

await check("Work plan: an activity is added under the project's activity, links are suggested with reasons and accepted, dates and a place are set, and the coverage reads in words", async () => {
  await go(page, "Work plan");
  const f = box(page, "Add an activity");
  await f.getByLabel("Activity", { exact: true }).fill("Rehabilitate boreholes");
  await pickLike(page, f.getByLabel("Part of"), /Rehabilitate boreholes/);
  await press(page, "Add an activity", f);
  const suggested = page.getByRole("region", { name: "Links we suggest" }).or(page.locator("section", { hasText: "Links we suggest" })).first();
  await suggested.waitFor();
  assert.match(await text(suggested), /It measures Boreholes rehabilitated, which this activity belongs to/);
  await press(page, /Accept all \d+/);
  const card = page.locator("article").first();
  await type(page, "Starts", "2027-04-01", card);
  await type(page, "Ends", "2027-09-30", card);
  await pickLike(page, card.getByLabel("Led by"), /Fay Field/);
  await card.getByRole("checkbox", { name: "Gulu" }).first().check();
  await page.waitForTimeout(100);
  assert.match(await text(page.locator("section[aria-label='How complete the plan is']")), /Activities with planned work: 1 of 1/);
  assert.match(await railText(page, "Work plan"), /Complete/);
});

await check("Data entry: a method is suggested for each indicator with a reason and accepted, and the review mode and entry window are set", async () => {
  await go(page, "Data entry");
  assert.match(await text(page.locator("section[aria-roledescription='slide']")), /We suggest: .*typed in|We suggest: A form in the field/i);
  await press(page, /^Use this$/);
  await page.getByLabel("How values are checked").selectOption("SIMPLE");
  await type(page, "Opens (days before the period ends)", "10");
  await type(page, "Closes (days after the period ends)", "15");
  assert.match(await railText(page, "Data entry"), /Complete/);
});

await check("Reporting: a frequency gives the calendar, a kind of report gets its layout and due date, and the calendar names its due dates", async () => {
  await go(page, "Reporting");
  await page.getByLabel("Reports are made").selectOption("QUARTERLY");
  await page.waitForTimeout(100);
  const calendar = page.locator("section[aria-labelledby='pcw-calendar']");
  assert.match(await text(calendar), /Final report/);
  const cards = page.locator("article");
  assert.ok(await cards.count() >= 3, "the starting answers listed the usual report kinds");
  const quarterly = cards.filter({ hasText: "Quarterly report" }).first();
  assert.equal(await quarterly.getByLabel("Layout").inputValue(), "BUILT_IN");
  await type(page, "Due (days after the period ends)", "45", quarterly);
  await page.waitForTimeout(100);
  assert.equal(await quarterly.getByLabel("Due (days after the period ends)").inputValue(), "45");
  assert.match(await text(calendar), /due /);
  assert.match(await railText(page, "Reporting"), /Complete/);
});

await check("Budget and finance: funding and a budget line that match, the line placed on the activity, and the totals agree in words", async () => {
  await go(page, "Budget and finance");
  const funding = box(page, "Add funding");
  await funding.getByLabel("From").fill("European Union");
  await funding.getByLabel("Amount").fill("400,000.50");
  await funding.getByLabel("Currency (three letters)").fill("EUR");
  await press(page, "Add funding", funding);
  const line = box(page, "Add a budget line");
  await line.getByLabel("Budget line", { exact: true }).fill("Borehole rehabilitation");
  await line.getByLabel("Amount").fill("400000.50");
  await line.getByLabel("Currency (three letters)").fill("EUR");
  await press(page, "Add a budget line", line);
  await pickLike(page, page.getByLabel("Pays for").first(), /Rehabilitate boreholes/);
  await page.waitForTimeout(100);
  assert.match(await text(page.locator("section[aria-labelledby='pcw-sum']")), /Funding and budget agree/);
  assert.match(await railText(page, "Budget and finance"), /1 to answer/, "the currency is offered, not filled in silently");
  await press(page, /Use EUR, the currency of the funding/);
  assert.match(await railText(page, "Budget and finance"), /Complete/);
});

await check("Review and launch: a risk and an assumption (each rated), a dashboard, sign-off, then the project starts and links to itself", async () => {
  await go(page, "Review and launch");
  const f = box(page, "Add a risk or assumption");
  const add = async (kind, title, level) => {
    await f.getByLabel("What it is", { exact: true }).selectOption(kind);
    await f.getByLabel("What it is about").fill(title);
    await f.getByLabel("How serious").selectOption(level);
    await press(page, "Add a risk or assumption", f);
  };
  assert.equal(await f.getByRole("button", { name: "Add a risk or assumption" }).isDisabled(), true, "a risk with no rating cannot be added");
  await add("RISK", "Flooding delays works", "HIGH");
  await add("ASSUMPTION", "Roads stay open", "LOW");
  assert.equal(await page.locator("input[value^='Seasonal floods or drought']").count(), 1, "the sector pack's suggested risks are listed");
  assert.equal(await page.getByRole("button", { name: /^Confirm$/ }).count(), 2, "and wait to be confirmed or removed");
  await page.getByRole("button", { name: /^Confirm$/ }).first().click();
  await page.waitForTimeout(80);
  await page.getByRole("button", { name: /^Confirm$/ }).first().click();
  await page.waitForTimeout(80);
  await pickLike(page, page.getByLabel("Dashboard", { exact: true }), /Water, sanitation and hygiene/);
  await page.waitForTimeout(100);
  assert.equal(await page.getByRole("button", { name: /^Sign off$/ }).isDisabled(), false, "nothing is left to answer");
  await press(page, /^Sign off$/);
  await page.getByText(/You signed this off on/).waitFor();
  // Something changes after the sign-off: it goes stale and starting waits for a new one.
  await go(page, "Start");
  await type(page, "Donor", "European Union (EU)");
  await go(page, "Review and launch");
  await page.getByText(/something changed since/i).waitFor();
  assert.equal(await page.getByRole("button", { name: "Start the project" }).isDisabled(), true);
  await press(page, /^Sign off again$/);
  await page.getByText(/You signed this off on/).waitFor();
  assert.equal(await page.getByRole("button", { name: "Start the project" }).isDisabled(), false);
  await press(page, "Start the project");
  await page.getByText("The project has been started.").waitFor();
  assert.equal(await page.getByRole("link", { name: "Open the project" }).getAttribute("href"), "/projects/proj-1");
  assert.match(await text(page.locator("section[aria-labelledby='pcw-start']")), /Project details: Done/);
  assert.match(await text(page.locator("section[aria-labelledby='pcw-start']")), /I2: a rate cannot have a form\./);
  const h = await H(page);
  assert.equal(h.inbox, 0, "nothing was left to answer");
  assert.equal(h.status, "APPLIED");
});

await check("documents: they are chosen (five at most), sent, a reading notice shows, and when it is ready what was found waits to be confirmed, all at once or one by one", async () => {
  const p = await open();
  open_.page = p;
  const file = (name) => ({ name, mimeType: "text/plain", buffer: Buffer.from(`content of ${name}`) });
  await p.locator("#pcw-file").setInputFiles(Array.from({ length: 6 }, (_, i) => file(`doc-${i}.txt`)));
  await p.getByText("5 of 5 files").waitFor();
  assert.equal(await p.getByRole("button", { name: "Choose files" }).isDisabled(), true, "no sixth file");
  await p.getByRole("button", { name: "Remove doc-4.txt" }).click();
  await p.getByText("4 of 5 files").waitFor();
  await p.getByRole("button", { name: "Read my documents" }).click();
  await p.getByRole("heading", { name: /Reading your documents/ }).waitFor();
  await p.getByRole("heading", { name: /Reading your documents/ }).waitFor({ state: "hidden", timeout: 9000 });
  await go(p, "Results framework");
  assert.equal(await p.locator("span", { hasText: "From your document" }).count(), 3, "three results were found, each marked as read from the document");
  await p.getByRole("button", { name: "Confirm all 3 that are waiting" }).click();
  await p.waitForTimeout(150);
  assert.equal(await p.getByRole("button", { name: /Confirm all/ }).count(), 0, "nothing is left waiting");
  assert.equal(await p.getByRole("button", { name: /^Confirm$/ }).count(), 0);
  assert.equal((await H(p)).calls.filter((c) => c === "editItem").length, 1, "one decision for all of them");
  await p.close();
});

await check("from documents: a result's passage opens with its words marked, the left-out list and documents list show, a result moves under another parent, and a part can be read again after a warning", async () => {
  const p = await open();
  open_.page = p;
  await p.locator("#pcw-file").setInputFiles([{ name: "water.txt", mimeType: "text/plain", buffer: Buffer.from("x") }]);
  await p.getByRole("button", { name: "Read my documents" }).click();
  await p.getByRole("heading", { name: /Reading your documents/ }).waitFor({ state: "hidden", timeout: 9000 });
  await p.locator("summary", { hasText: "Your documents" }).first().click();
  await p.getByText("Read as: Proposal or narrative").waitFor();
  await go(p, "Results framework");
  await p.getByRole("button", { name: "Show in the document" }).first().click();
  await p.getByText("Introduction").waitFor();
  assert.equal(await p.locator("mark").first().innerText(), "read from the document");
  await p.getByRole("button", { name: "Close" }).click();
  await p.getByText("Left out (2)").click();
  await p.getByText(/Clean taps everywhere/).waitFor();
  await p.getByRole("button", { name: "Read this part again" }).click();
  await p.getByText(/replaces the decisions you made in this step/).waitFor();
  await p.getByRole("button", { name: "Keep what I have" }).click();
  assert.equal((await H(p)).calls.filter((c) => c === "rerun").length, 0, "nothing is read again until it is confirmed");
  await p.getByRole("button", { name: "Read this part again" }).click();
  await p.getByRole("button", { name: "Read again", exact: true }).click();
  await p.waitForTimeout(200);
  assert.equal((await H(p)).calls.filter((c) => c === "rerun").length, 1);
  await p.getByRole("button", { name: "Confirm all 3 that are waiting" }).click();
  await p.waitForTimeout(150);
  await p.getByLabel(/Move OP1 under/).selectOption({ index: 0 });
  await p.close();
});

await check("in French, Spanish and Arabic the steps, sentences and buttons are in that language, and Arabic reads right to left", async () => {
  for (const [lang, rail, slide, dir, nextWord] of [["fr", "Projet et équipe", "Début", "ltr", "Suivant"], ["es", "Proyecto y equipo", "Inicio", "ltr", "Siguiente"], ["ar", "المشروع والفريق", "البداية", "rtl", "التالي"]]) {
    const p = await open(undefined, lang);
    open_.page = p;
    await p.getByRole("navigation").getByRole("button", { name: new RegExp(rail) }).waitFor();
    assert.equal(await p.locator("h1").innerText(), slide, `${lang}: the first step is named in its language`);
    assert.equal(await p.evaluate(() => document.documentElement.dir), dir, `${lang}: reading direction`);
    assert.equal(await p.getByRole("button", { name: nextWord, exact: true }).count(), 1, `${lang}: the next button is translated`);
    assert.equal(await p.getByText("Still to answer").count(), 0, `${lang}: no English left in the side list`);
    await p.close();
  }
});

await check("without the AI service the sentence says what is missing, and the slides can still be filled in by hand", async () => {
  const p = await open();
  open_.page = p;
  await p.evaluate(() => { window.__h.store.flags.noAi = true; });
  await p.locator("#pcw-file").setInputFiles([{ name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("x") }]);
  await p.getByRole("button", { name: "Read my documents" }).click();
  await p.getByRole("alert").filter({ hasText: /Setup assistance is switched off/ }).waitFor();
  await type(p, "Donor", "Someone");
  assert.equal((await H(p)).status, "READY");
  await p.close();
});

await check("typing straight after tabbing out of a box keeps the text and saves it (a box is never disabled while another saves)", async () => {
  const p = await open();
  open_.page = p;
  await p.evaluate(() => window.__h.reset());
  await p.reload();
  await p.waitForSelector("h1");
  await go(p, "Project and team");
  await p.getByLabel("Project name", { exact: true }).fill("Alpha");
  await p.keyboard.press("Tab");
  await p.keyboard.type("CODE-9");
  await p.keyboard.press("Tab");
  await p.waitForTimeout(200);
  const facts = await p.evaluate(() => window.__h.view().facts);
  assert.deepEqual([facts.name, facts.code], ["Alpha", "CODE-9"]);
  assert.equal(await p.getByLabel("Project code", { exact: true }).inputValue(), "CODE-9");
  await p.close();
});

await check("a project that does not track money says so once and the finance slide is done", async () => {
  const p = await open();
  open_.page = p;
  await go(p, "Budget and finance");
  await p.getByRole("checkbox", { name: "Not used for this project" }).check();
  await p.waitForTimeout(150);
  assert.match(await railText(p, "Budget and finance"), /Complete/);
  assert.match(await text(p.locator("section[aria-roledescription='slide']")), /tracks money in DonorDesk: no/);
  await p.close();
});

await check("on a phone-sized screen nothing runs off the side, on the first and the busiest slides", async () => {
  const p = await open({ width: 375, height: 800 });
  open_.page = p;
  for (const label of ["Start", "Project and team", "Indicators", "Work plan", "Budget and finance"]) {
    await p.getByRole("button", { name: new RegExp(label) }).first().click();
    await p.waitForTimeout(600); // the slide slides in; measure once it has settled
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const wide = overflow <= 1 ? "" : await p.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && ![...e.children].some((c) => c.getBoundingClientRect().right > window.innerWidth + 1)).slice(0, 4).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 60)} "${(e.textContent ?? "").slice(0, 24)}"`).join(" | "));
    assert.ok(overflow <= 1, `${label} is ${overflow}px wider than the screen: ${wide}`);
  }
  await p.close();
});

console.log(results.join("\n"));
console.log(errors.length ? `console errors (${errors.length}):\n${[...new Set(errors)].slice(0, 6).join("\n")}` : "no console errors");
await browser.close();
server.close();
process.exit(results.some((r) => r.startsWith("FAIL")) || errors.length ? 1 : 0);
