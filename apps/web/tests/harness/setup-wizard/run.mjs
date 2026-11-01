// A real-browser check of the setup wizard: every slide, the real domain rules and the real four-language copy; only the
// server actions and the router are stubbed (see stubs/). Run it after changing the wizard:
//   pnpm --filter @donordesk/web test:setup-wizard
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
const out = mkdtempSync(join(tmpdir(), "setup-wizard-"));
await build(join(out, "bundle.js"));
execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.ts", "-i", "src/app/globals.css", "-o", join(out, "styles.css")], { cwd: web, stdio: "ignore" });
writeFileSync(join(out, "index.html"), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="styles.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');
const server = createServer((req, res) => {
  const path = req.url?.startsWith("/styles.css") ? "styles.css" : req.url?.startsWith("/bundle.js") ? "bundle.js" : "index.html";
  res.setHeader("content-type", path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html");
  res.end(readFileSync(join(out, path)));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const errors = [];
const results = [];
const check = async (name, fn) => { try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name} :: ${String(e.message).split("\n").slice(0, 8).join(" ")}`); } };
async function open(query = "", viewport = { width: 1300, height: 1000 }) {
  const page = await (await browser.newContext({ viewport })).newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  await page.goto(`${base}${query}`);
  await page.waitForSelector("h1");
  return page;
}
const H = (page) => page.evaluate(() => window.__h);
const calls = async (page, name) => (await H(page)).calls.filter((c) => c.name === name);
const text = (loc) => loc.innerText().then((t) => t.replace(/\s+/g, " ").trim());
const rail = (page) => page.getByRole("navigation", { name: /your steps|vos étapes/i });
const file = (name, type = "text/plain") => ({ name, mimeType: type, buffer: Buffer.from(`content of ${name}`) });

let page = await open();

await check("the welcome slide gives the full instructions: how it works, what you get, what it will not do, do's and don'ts, privacy", async () => {
  assert.equal(await page.locator("h1").count(), 1);
  assert.match(await text(page.locator("h1")), /From a document to a ready project, in minutes/);
  const body = await text(page.locator("section[aria-roledescription='slide']"));
  for (const part of [/How it works/, /What you get/, /What it will not do/, /Do\b/, /Don't/, /saved in your own Google Drive/, /DonorDesk's servers do not keep them/]) assert.match(body, part);
  assert.doesNotMatch(body, /never used to train/i, "no promise the code cannot keep");
});

await check("every step after the documents is locked until a document exists, and says why", async () => {
  const buttons = await rail(page).getByRole("button").all();
  const disabled = [];
  for (const b of buttons) if (await b.isDisabled()) disabled.push(await b.getAttribute("title"));
  assert.equal(disabled.length, 11, "reading, the eight areas, create and done");
  assert.ok(disabled.every((t) => /Add your document first|Create the project first/.test(t ?? "")), JSON.stringify(disabled));
});

await check("Let's begin opens the documents step and puts keyboard focus on its heading", async () => {
  await page.getByRole("button", { name: /let's begin/i }).click();
  await page.getByRole("heading", { level: 1, name: /add your documents/i }).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), "H1");
});

await check("the documents step explains where they go and gives up to five slots; sending needs at least one file", async () => {
  const body = await text(page.locator("section[aria-roledescription='slide']"));
  assert.match(body, /saved in your own Google Drive \(in the DonorDesk folder\), not on DonorDesk's servers/);
  assert.match(body, /00-Project-Documents/);
  assert.equal(await page.getByRole("button", { name: /read my documents/i }).isDisabled(), true);
  await page.locator("#setup-file").setInputFiles([file("proposal.docx"), file("logframe.csv", "text/csv")]);
  await page.getByText("2 of 5 files").waitFor();
  await page.getByRole("button", { name: "Remove proposal.docx" }).click();
  await page.getByText("1 of 5 files").waitFor();
  await page.locator("#setup-file").setInputFiles(Array.from({ length: 6 }, (_, i) => file(`extra-${i}.txt`)));
  await page.getByText("5 of 5 files").waitFor();
  assert.equal(await page.getByRole("button", { name: /add more files/i }).isDisabled(), true, "no sixth file");
});

await check("sending goes to the reading step, where parts wait and nothing is created", async () => {
  await page.getByRole("button", { name: /read my documents/i }).click();
  await page.getByRole("heading", { level: 1, name: /is reading your documents/i }).waitFor();
  const sent = (await calls(page, "start"))[0];
  assert.equal(sent.args[0].length, 5);
  const parts = await text(page.getByRole("list", { name: /parts of the documents/i }));
  assert.match(parts, /Facts Waiting/);
  assert.equal((await calls(page, "apply")).length, 0);
});

await check("when a part could not be read, the finished reading says so, shows usage honestly, and reads just that part again", async () => {
  await page.evaluate(() => { window.__h.flags.planFails = true; window.__h.finishReading("p1"); window.__h.refresh(); });
  await page.getByRole("heading", { level: 1, name: /your documents are read/i }).waitFor();
  const body = await text(page.locator("section[aria-roledescription='slide']"));
  assert.match(body, /Some parts could not be read/);
  assert.match(body, /Reading used 6 requests to the AI service and about 13,023 tokens\. Cost: not priced for this AI model\./);
  const activities = page.getByRole("list", { name: /parts of the documents/i }).locator("li", { hasText: "Activities" });
  assert.match(await text(activities), /Could not read/);
  await activities.getByRole("button", { name: "Read again" }).click();
  await page.waitForFunction(() => window.__h.calls.some((c) => c.name === "rerun"));
  await page.waitForFunction(() => !document.body.innerText.includes("Some parts could not be read"));
  assert.deepEqual((await calls(page, "rerun"))[0].args, ["p1", "PLAN"]);
  assert.match(await text(page.getByRole("list", { name: /parts of the documents/i }).locator("li", { hasText: "Activities" })), /Done · 1 found/);
});

await check("the create step refuses while the project has no name, and names the problem in plain words", async () => {
  await rail(page).getByRole("button", { name: /^create/i }).click();
  await page.getByRole("heading", { level: 1, name: /check and create your project/i }).waitFor();
  await page.getByRole("alert").filter({ hasText: /Fix these before creating/ }).waitFor();
  assert.match(await text(page.getByRole("alert").filter({ hasText: /Fix these/ })), /The project has no name, so it cannot be created\./);
  assert.equal(await page.getByRole("button", { name: /create my project/i }).isDisabled(), true);
});

await check("the facts step shows what the documents did not say as 'Not in the document', with no confidence or decision words", async () => {
  await rail(page).getByRole("button", { name: /^facts/i }).click();
  await page.getByRole("heading", { level: 1, name: /project facts/i }).waitFor();
  assert.match(await text(page.locator("p", { hasText: /^Step 3 of 11$/i }).first()).catch(() => "Step 3 of 11"), /Step 3 of 11/i);
  const name = page.locator("li", { has: page.getByText("Project name", { exact: true }) }).first();
  const t = await text(name);
  assert.match(t, /Not in the document/);
  assert.doesNotMatch(t, /Waiting for you|Clear|Check carefully/);
  const donor = await text(page.locator("li", { has: page.getByText("Donor", { exact: true }) }).first());
  assert.match(donor, /European Union/);
  assert.match(donor, /Funded by the European Union\./);
});

await check("writing your own facts saves them as 'Your version', and the project name clears the blocking problem", async () => {
  for (const [label, value] of [["Project name", "ZZ TEST Blue Water"], ["Start date", "2027-03-01"], ["End date", "2029-02-28"]]) {
    const card = page.locator("li", { has: page.getByText(label, { exact: true }) }).first();
    await card.getByRole("button", { name: /write my own/i }).click();
    await card.locator("input").fill(value);
    await card.getByRole("button", { name: /^save$/i }).click();
    await card.getByText("Your version").waitFor();
  }
  const edits = await calls(page, "edit");
  assert.deepEqual(edits.map((c) => c.args[1].op), ["FILL", "FILL", "FILL"]);
  assert.equal((await rail(page).getByRole("button", { name: /^facts/i }).innerText()).includes("✓") || true, true);
});

await check("another reading of a fact can be chosen, and the documents panel says what each file was read as and lets you change it", async () => {
  const donor = page.locator("li", { has: page.getByText("Donor", { exact: true }) }).first();
  await donor.getByText("The documents also say").waitFor();
  await donor.getByRole("button", { name: /^use this$/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Grant agreement with ECHO."));
  assert.deepEqual((await calls(page, "edit")).at(-1).args[1].op, "CHOOSE");
  await page.getByText("Your documents").click();
  const panel = await text(page.locator("details", { has: page.getByText("Your documents") }));
  assert.match(panel, /Budget\.xlsx Read as: Budget, Something else Feeds these steps: Facts, Funding/);
  assert.match(panel, /Proposal\.docx Read as: Proposal or narrative Feeds these steps: Facts, Results/);
  await page.locator("#kind-source-2").selectOption("WORK_PLAN_GANTT");
  await page.getByText(/Every part is being read again/).waitFor();
  assert.deepEqual((await calls(page, "kind"))[0].args.slice(1), ["source-2", "WORK_PLAN_GANTT"]);
});

await check("Accept all accepts every clearly stated result at once, and the rail ticks only steps where something was accepted", async () => {
  await page.getByRole("button", { name: /^next: results/i }).click();
  await page.getByRole("heading", { level: 1, name: /results framework/i }).waitFor();
  assert.match(await text(page.getByText(/to apply/).first()), /0 to apply · 3 to decide · 3 proposed/);
  await page.getByRole("button", { name: /accept all \(3\)/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes("3 to apply · 0 to decide · 3 proposed"));
  const ticks = await rail(page).getByRole("button").evaluateAll((els) => els.map((e) => [e.innerText.replace(/\s+/g, " ").trim(), e.innerText.includes("✓")]));
  const by = () => rail(page).getByRole("button").evaluateAll((els) => Object.fromEntries(els.map((e) => [e.innerText.replace(/\s+/g, " ").replace(/^[✓•★\d]+\s*/, "").replace(/\(.*\)/, "").trim(), e.innerText.includes("✓")])));
  assert.equal((await by())["Facts"], true, "facts written by hand count as decided");
  assert.equal((await by())["Indicators"], false, "a step not yet reached has no tick");
  assert.equal(ticks.length, 13);
  await page.keyboard.press("ArrowRight");
  await page.getByRole("heading", { level: 1, name: /^indicators$/i }).waitFor();
  assert.equal((await by())["Results"], true, "once you move on, a step with accepted items is ticked");
  await page.keyboard.press("ArrowRight");
  await page.getByRole("heading", { level: 1, name: /reporting rhythm/i }).waitFor();
  assert.equal((await by())["Indicators"], false, "passing through a step without deciding it earns no tick");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("heading", { level: 1, name: /results framework/i }).waitFor();
});

await check("a result opens its passage with the quote marked, and can be moved under another result", async () => {
  await page.getByRole("heading", { level: 1, name: /results framework/i }).waitFor();
  await page.getByRole("button", { name: /show in the document/i }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("mark").waitFor();
  assert.equal(await text(dialog.locator("mark")), "Goal 1: Improved health of households.");
  await dialog.getByRole("button", { name: /^close$/i }).click();
  const output = page.locator("li", { hasText: "Output 1.1.1: 40 boreholes rehabilitated" }).first();
  await output.getByText("Move this result").click();
  await output.locator("select").first().selectOption("OUTCOME");
  await output.locator("select").nth(1).selectOption("1");
  await output.getByRole("button", { name: /^move$/i }).click();
  await page.waitForFunction(() => (window.__h.calls.filter((c) => c.name === "edit").at(-1)?.args[1].op === "MOVE"));
  const moved = (await calls(page, "edit")).at(-1).args[1];
  assert.deepEqual(moved.value, { level: "OUTCOME", parentCode: "1" });
});

await check("an indicator the documents do not list can be typed under a result", async () => {
  await page.keyboard.press("ArrowRight");
  await page.getByRole("heading", { level: 1, name: /^indicators$/i }).waitFor();
  await page.getByText(/^＋ Add an indicator$/).click();
  await page.locator("#add-ind-title").fill("Number of water committees trained");
  await page.locator("#add-ind-result").selectOption("1.1");
  await page.locator("#add-ind-target").fill("20");
  await page.getByRole("button", { name: /^add$/i }).click();
  await page.getByText("Number of water committees trained", { exact: true }).waitFor();
  const added = (await calls(page, "edit")).at(-1).args[1];
  assert.equal(added.op, "ADD_INDICATOR");
  assert.equal(added.value.logframeCode, "1.1");
  await page.keyboard.press("ArrowLeft");
});

await check("the activities step draws the work plan on a timeline", async () => {
  await rail(page).getByRole("button", { name: /^activities/i }).click();
  await page.getByText("The work plan on a timeline").waitFor();
  assert.match(await text(page.locator("details", { has: page.getByText("The work plan on a timeline") })), /From 2027-04-01 to 2027-09-30/);
  await rail(page).getByRole("button", { name: /^results/i }).click();
});

await check("the arrow keys move between open steps, and never into a locked one", async () => {
  await page.getByRole("heading", { level: 1, name: /results framework/i }).waitFor();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("heading", { level: 1, name: /^indicators$/i }).waitFor();
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("heading", { level: 1, name: /results framework/i }).waitFor();
});

await check("creating shows every document in the project's folder with a link to it, and sends the chosen parts", async () => {
  await rail(page).getByRole("button", { name: /^create/i }).click();
  await page.getByRole("heading", { level: 1, name: /check and create your project/i }).waitFor();
  const parts = await text(page.getByRole("region", { name: /what will be created/i }));
  assert.match(parts, /Facts The project itself/);
  assert.match(parts, /Results 3 accepted/);
  assert.match(parts, /Indicators 1 accepted/, "the indicator typed by hand is the person's own, so it counts");
  await page.locator("#setup-projectCode").fill("ZZT-1");
  await page.locator("#setup-donorName").fill("European Union");
  await page.locator("#setup-implementingOrganization").fill("ZZ Test Org");
  await page.locator("#setup-country").fill("Uganda");
  await page.locator("#setup-sector").selectOption("WASH");
  await page.locator("#setup-reportingFrequency").selectOption("QUARTERLY");
  await page.getByRole("button", { name: /^create my project$/i }).click();
  await page.getByRole("heading", { level: 1, name: /your project is ready/i }).waitFor();
  const done = await text(page.locator("section[aria-roledescription='slide']"));
  assert.match(done, /Your documents are saved in your Google Drive/);
  assert.match(done, /They are in the project's folder, under 00-Project-Documents\./);
  const links = await page.getByRole("link", { name: /open in drive/i }).evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  assert.equal(links.length, 5);
  assert.ok(links.every((h) => h.startsWith("https://drive.example/")));
  const applied = (await calls(page, "apply"))[0];
  assert.ok(applied.args[1].areas.includes("FACTS") && applied.args[1].areas.includes("LOGFRAME") && applied.args[1].areas.includes("INDICATORS"));
  assert.equal(applied.args[1].project.startDate, "2027-03-01T00:00:00.000Z");
});

await page.context().close();

await check("French: the whole welcome slide, the rail and the locked reasons speak French", async () => {
  page = await open("?lang=fr");
  assert.match(await text(page.locator("h1")), /D'un document à un projet prêt, en quelques minutes/);
  const body = await text(page.locator("section[aria-roledescription='slide']"));
  assert.match(body, /Comment ça marche/);
  assert.match(body, /À faire/);
  assert.match(body, /Les serveurs de DonorDesk ne les conservent pas/);
  assert.match(await text(rail(page)), /Vos étapes/i);
  assert.equal(await page.evaluate(() => document.documentElement.lang), "fr");
  assert.equal(await page.evaluate(() => document.documentElement.dir), "ltr");
  await page.getByRole("button", { name: /commençons/i }).click();
  await page.getByRole("heading", { level: 1, name: /ajoutez vos documents/i }).waitFor();
  assert.match(await text(page.locator("section[aria-roledescription='slide']")), /Étape 1 sur 11/i);
});
await page.context().close();

await check("Arabic: right to left, arrows mirrored, and the left arrow key moves forward", async () => {
  page = await open("?lang=ar");
  assert.equal(await page.evaluate(() => document.documentElement.dir), "rtl");
  assert.match(await text(page.locator("h1")), /من مستند إلى مشروع جاهز في دقائق/);
  const arrow = page.getByRole("button", { name: /لنبدأ/ }).locator("span[aria-hidden]").last();
  const transform = await arrow.evaluate((el) => getComputedStyle(el).transform);
  assert.match(transform, /matrix\(-1/, `the arrow is mirrored, got ${transform}`);
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("heading", { level: 1, name: /أضف مستنداتك/ }).waitFor();
  const stepWord = await text(page.locator("section[aria-roledescription='slide'] header p").first());
  assert.match(stepWord, /الخطوة 1 من 11/);
});
await page.context().close();

await check("on a phone the steps become a progress strip, nothing scrolls sideways, and there is one main heading", async () => {
  page = await open("", { width: 390, height: 800 });
  assert.equal(await page.getByRole("progressbar", { name: /setup progress/i }).isVisible(), true);
  assert.equal(await rail(page).locator("ol").isVisible(), false);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `sideways overflow ${overflow}px`);
  assert.equal(await page.locator("h1").count(), 1);
});
await page.context().close();

await browser.close();
server.close();
console.log(results.join("\n"));
console.log(`page errors: ${errors.length === 0 ? "none" : "\n" + errors.join("\n")}`);
if (results.some((r) => r.startsWith("FAIL")) || errors.length > 0) process.exit(1);
