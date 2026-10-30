// A real-browser check of a management dashboard of number tiles and a status donut (the real dashboard screen and chart builder; only the server actions and the router are stubbed).
//   pnpm --filter @donordesk/web test:tiles
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { build } from "./build.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../..");
const out = mkdtempSync(join(tmpdir(), "tiles-"));
await build(join(out, "bundle.js"));
execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.ts", "-i", "src/app/globals.css", "-o", join(out, "styles.css")], { cwd: web, stdio: "ignore" });
writeFileSync(join(out, "index.html"), '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');
const url = `file://${join(out, "index.html")}`;

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1300, height: 1000 }, acceptDownloads: true })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
// The picture-making library reads the page's stylesheet over http; from a file:// page it says so. That is the harness, not the app.
page.on("console", (m) => { if (m.type() === "error" && !/file:\/\/|Error inlining remote css/.test(m.text())) errors.push(m.text().slice(0, 200)); });
const results = [];
const check = async (name, fn) => { try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name} :: ${String(e.message).split("\n").slice(0, 8).join(" ")}`); } };
const tiles = () => page.getByTestId("metric-widget");
const text = (loc) => loc.innerText().then((t) => t.replace(/\s+/g, " ").trim());

await page.goto(url);
await tiles().first().waitFor();
await page.waitForTimeout(600);
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: false });

await check("the money and activity tiles show a big figure, a name and a unit, each in its own colour", async () => {
  const all = await tiles().allInnerTexts();
  assert.deepEqual(all.map((t) => t.replace(/\s+/g, " ").trim()), ["91.1 thousand USD", "11.8 thousand USD", "47.7 thousand USD", "14 activities"]);
  for (const name of ["Awarded", "Obligated", "Disbursed", "Activities"]) assert.ok(await page.getByRole("region", { name }).count() > 0 || (await page.locator(`section[aria-label="${name}"]`).count()) > 0, `${name} names its card`);
  const colours = await tiles().evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
  assert.equal(new Set(colours).size, 4, "four different colours");
});

await check("white text on every tile is readable (contrast at least 4.5 to 1)", async () => {
  const ratios = await tiles().evaluateAll((els) => els.map((e) => {
    const [r, g, b] = getComputedStyle(e).backgroundColor.match(/\d+/g).map(Number);
    const ch = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 1.05 / (0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b) + 0.05);
  }));
  assert.ok(ratios.every((x) => x >= 4.5), ratios.map((x) => x.toFixed(2)).join(" "));
});

await check("the status donut draws the plan's activities and says what is late", async () => {
  const chart = page.getByRole("img", { name: /Activities by Status/i }).first();
  await chart.waitFor();
  assert.ok((await chart.locator("canvas, svg").count()) > 0, "a chart is drawn");
  assert.match(await text(page.locator("section[aria-label='# of Activities by Status']")), /1 of the 14 is running late/);
});

await check("the results map opens on the project's country, says how many places have a figure, and lets the viewer change the period", async () => {
  const card = page.locator("section[aria-label='Children vaccinated by place']");
  await card.getByText(/places have a figure/).waitFor({ timeout: 15000 });
  assert.match(await text(card), /3 of 3 places have a figure/);
  assert.equal(await card.getByLabel("Indicator").inputValue(), "i1");
  assert.equal(await card.getByLabel("Layers").count(), 0, "the card is compact: no layer panel");
  const slider = card.getByLabel("Reporting period");
  await slider.fill("1");
  await card.getByText("Jan 2026").first().waitFor();
  await card.getByText(/1 of 3 places have a figure/).waitFor();
  await slider.fill("2");
  await card.getByText(/3 of 3 places have a figure/).waitFor();
  const reads = (await page.evaluate(() => window.__h.reads)).filter((r) => r.name === "results").map((r) => r.args[2]);
  assert.ok(reads.includes("p1") && reads.includes("p2"), `the map re-read each period: ${JSON.stringify(reads)}`);
});

await check("a place nobody reported is grey and counted as such, never drawn as zero", async () => {
  const card = page.locator("section[aria-label='Children vaccinated by place']");
  await card.getByLabel("Reporting period").fill("1");
  await card.getByText(/1 of 3 places have a figure/).waitFor();
  assert.match(await text(card), /Not measured/);
  assert.doesNotMatch(await text(card), /120–120/, "one value is one legend entry, not a range from itself to itself");
  assert.match(await text(card), /\b120\b/);
});

await check("the activities map plots the plan, says what could not be placed, and is coloured by delivery", async () => {
  const card = page.locator("section[aria-label='Where activities are']");
  await card.getByText(/Late|On time|Done/).first().waitFor({ timeout: 15000 });
  const t = await text(card);
  assert.match(t, /Atlantis/, "an activity at an unknown place is listed, never invented");
  assert.ok(await card.locator("canvas").count() > 0, "the map is drawn");
});

if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT.replace(".png", "-maps.png"), fullPage: true });

await check("editing offers a map for a project; adding it is full width and awaits save, and saving sends only what it shows", async () => {
  await page.getByRole("button", { name: "Edit" }).click();
  const form = page.getByRole("form", { name: "Add a map" });
  await form.getByLabel("Map").selectOption("ACTIVITIES");
  await form.getByLabel("Name (optional)").fill("Field sites");
  await form.getByRole("button", { name: "Add the map" }).click();
  await page.getByText("Save the dashboard to draw this.").waitFor();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForFunction(() => window.__h.saves.length === 1);
  const sent = (await page.evaluate(() => window.__h.saves[0])).input;
  const added = sent.widgets.find((w) => w.map?.title === "Field sites");
  assert.deepEqual(added.map, { view: "ACTIVITIES", title: "Field sites" });
  assert.equal(added.kind, "MAP");
  assert.equal(added.w, 12);
  assert.equal(sent.widgets.filter((w) => w.kind === "MAP").length, 3);
  await page.getByRole("button", { name: "Edit" }).waitFor();
});

await check("editing offers a number tile with a choice of figure, colour and name; adding it puts a tile on the canvas awaiting save", async () => {
  await page.getByRole("button", { name: "Edit" }).click();
  const form = page.getByRole("form", { name: "Add a number tile" });
  await form.getByLabel("Figure").selectOption("ACTIVITIES_LATE");
  assert.equal(await form.getByLabel("Colour").inputValue(), "RED", "the figure's own colour is suggested");
  assert.equal(await form.getByLabel("Currency (optional)").count(), 0, "only a money figure has a currency");
  await form.getByLabel("Name (optional)").fill("Behind schedule");
  await form.getByRole("button", { name: "Add the tile" }).click();
  await page.getByText("Save the dashboard to draw this.").last().waitFor();
});

await check("saving sends the new tile as a number tile with exactly the chosen figure, colour and name", async () => {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForFunction(() => window.__h.saves.length === 2);
  const sent = (await page.evaluate(() => window.__h.saves[1])).input;
  const added = sent.widgets.find((w) => w.metric?.title === "Behind schedule");
  assert.deepEqual(added.metric, { metric: "ACTIVITIES_LATE", color: "RED", title: "Behind schedule" });
  assert.equal(added.kind, "METRIC");
  assert.equal(added.projectId, "p1");
  assert.equal(sent.widgets.length, 12, "the original ten plus the map added earlier and the new tile");
});

await check("a money tile can read another currency", async () => {
  await page.getByRole("button", { name: "Edit" }).click();
  const form = page.getByRole("form", { name: "Add a number tile" });
  await form.getByLabel("Figure").selectOption("FIN_SPENT");
  await form.getByLabel("Currency (optional)").fill("kes");
  assert.equal(await form.getByLabel("Currency (optional)").inputValue(), "KES");
  await form.getByRole("button", { name: "Add the tile" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForFunction(() => window.__h.saves.length === 3);
  const sent = (await page.evaluate(() => window.__h.saves[2])).input;
  assert.ok(sent.widgets.some((w) => w.metric?.currency === "KES" && w.metric.metric === "FIN_SPENT"));
});

const savesNow = () => page.evaluate(() => window.__h.saves.length);
const lastSave = async () => (await page.evaluate(() => window.__h.saves.at(-1))).input;
const edit = async (name) => { await page.getByRole("button", { name: "Edit", exact: true }).click(); await page.getByRole("button", { name: `Edit ${name}` }).click(); };
const saveAndWait = async () => { const n = await savesNow(); await page.getByRole("button", { name: "Save", exact: true }).click(); await page.waitForFunction((k) => window.__h.saves.length === k + 1, n); return lastSave(); };

await check("a number tile is changed in place: the form starts from its settings, and it keeps its spot and size and is not duplicated", async () => {
  await page.reload(); await tiles().first().waitFor();
  await edit("Awarded");
  const form = page.getByRole("form", { name: "Change this number tile" });
  assert.equal(await form.getByLabel("Figure").inputValue(), "FIN_OBLIGATED");
  assert.equal(await form.getByLabel("Colour").inputValue(), "ORANGE");
  assert.equal(await form.getByLabel("Name (optional)").inputValue(), "Awarded");
  assert.equal(await form.getByLabel("Project").count(), 0, "its project does not change");
  await form.getByLabel("Colour").selectOption("BLUE");
  await form.getByLabel("Name (optional)").fill("Funds committed");
  await form.getByRole("button", { name: "Apply" }).click();
  const sent = await saveAndWait();
  const w = sent.widgets.find((x) => x.id === "t1");
  assert.deepEqual(w.metric, { metric: "FIN_OBLIGATED", color: "BLUE", title: "Funds committed" });
  assert.deepEqual([w.x, w.y, w.w, w.h, w.projectId], [0, 0, 3, 3, "p1"]);
  assert.equal(sent.widgets.length, 10, "changed, not added");
});

await check("a map, a note and a chart's title are changed in place", async () => {
  await edit("Children vaccinated by place");
  await page.getByRole("form", { name: "Change this map" }).getByLabel("Map").selectOption("ACTIVITIES");
  await page.getByRole("form", { name: "Change this map" }).getByRole("button", { name: "Apply" }).click();
  await page.getByRole("button", { name: "Edit Note" }).click();
  const note = page.getByRole("form", { name: "Change this note" });
  assert.equal(await note.getByLabel("Text").inputValue(), "Management dashboard for the whole project.");
  await note.getByLabel("Text").fill("Updated for the board.");
  await note.getByRole("button", { name: "Apply" }).click();
  await page.getByRole("button", { name: "Edit # of Activities by Status" }).click();
  const rename = page.getByRole("form", { name: "Rename this chart" });
  assert.equal(await rename.getByLabel("Title").inputValue(), "# of Activities by Status");
  await rename.getByLabel("Title").fill("Activities by status");
  await rename.getByRole("button", { name: "Apply" }).click();
  const sent = await saveAndWait();
  assert.equal(sent.widgets.find((x) => x.id === "m1").map.view, "ACTIVITIES");
  assert.equal(sent.widgets.find((x) => x.id === "x1").text, "Updated for the board.");
  const c = sent.widgets.find((x) => x.id === "c1");
  assert.equal(c.spec.title, "Activities by status");
  assert.equal(c.spec.dataset.template, "PLAN_TIMELINE", "the chart's data is untouched");
  assert.equal(c.spec.kind, "DONUT");
});

await check("an indicator tile can be coloured and named, and an empty note is refused", async () => {
  await edit("OC1 Children vaccinated");
  const form = page.getByRole("form", { name: "Change this indicator tile" });
  await form.getByLabel("Colour").selectOption("GREEN");
  await form.getByLabel("Name (optional)").fill("Children reached");
  await form.getByRole("button", { name: "Apply" }).click();
  await page.getByRole("button", { name: "Edit Note" }).click();
  const note = page.getByRole("form", { name: "Change this note" });
  await note.getByLabel("Text").fill("   ");
  assert.equal(await note.getByRole("button", { name: "Apply" }).isDisabled(), true);
  await note.getByRole("button", { name: "Cancel" }).click();
  const sent = await saveAndWait();
  assert.deepEqual(sent.widgets.find((x) => x.id === "k1").kpi, { indicatorId: "i1", includeDraft: true, color: "GREEN", title: "Children reached" });
  assert.equal(sent.widgets.find((x) => x.id === "x1").text, "Updated for the board.", "cancel keeps what was there");
});

await check("an indicator tile with a colour is drawn in it, in white text; without one it is a plain card", async () => {
  await page.reload(); await tiles().first().waitFor();
  const kpis = page.getByTestId("kpi-widget");
  assert.equal(await kpis.count(), 2);
  const styles = await kpis.evaluateAll((els) => els.map((e) => ({ bg: getComputedStyle(e).backgroundColor, fg: getComputedStyle(e).color })));
  const plain = styles.find((s) => s.bg === "rgba(0, 0, 0, 0)");
  const green = styles.find((s) => s.bg === "rgb(21, 128, 61)");
  assert.ok(plain, "an indicator tile with no colour stays a plain card");
  assert.ok(green, `a green one is drawn in #15803d: ${JSON.stringify(styles)}`);
  assert.equal(green.fg, "rgb(255, 255, 255)");
  assert.match(await text(kpis.nth(styles.indexOf(green))), /420\s*children/);
});

await check("a section heading and a note can be added; a heading is drawn as a heading and is saved as '# text'", async () => {
  await page.reload(); await tiles().first().waitFor();
  await page.getByRole("button", { name: "Edit" }).click();
  const form = page.getByRole("form", { name: "Add a note or heading" });
  await form.getByLabel("Heading", { exact: true }).fill("Water and sanitation");
  await form.getByRole("button", { name: "Add the heading" }).click();
  await page.getByRole("heading", { name: "Water and sanitation" }).waitFor();
  await form.getByLabel("Make it a section heading").uncheck();
  await form.getByLabel("Note", { exact: true }).fill("Figures are to the end of the month.");
  await form.getByRole("button", { name: "Add the note" }).click();
  await page.getByTestId("text-widget").filter({ hasText: "Figures are to the end of the month." }).waitFor();
  const before = await page.evaluate(() => window.__h.saves.length);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForFunction((n) => window.__h.saves.length === n + 1, before);
  const sent = (await page.evaluate((n) => window.__h.saves[n], before)).input;
  const texts = sent.widgets.filter((w) => w.kind === "TEXT").map((w) => w.text);
  assert.ok(texts.includes("# Water and sanitation") && texts.includes("Figures are to the end of the month."), JSON.stringify(texts));
  const heading = sent.widgets.find((w) => w.text === "# Water and sanitation");
  assert.deepEqual([heading.w, heading.h], [12, 2], "a heading is a thin full-width strip");
});

await check("a project list can be added with the three kinds of project, and is saved as its filters only", async () => {
  await page.reload(); await tiles().first().waitFor();
  await page.getByRole("button", { name: "Edit" }).click();
  const form = page.getByRole("form", { name: "Add a project list" });
  assert.deepEqual(await form.getByLabel("Which projects").locator("option").allTextContents(), ["All projects I can see", "Projects I am assigned to", "Projects I have bookmarked"]);
  await form.getByLabel("Which projects").selectOption("BOOKMARKED");
  await form.getByLabel("Status").selectOption("ACTIVE");
  await form.getByRole("button", { name: "Add the list" }).click();
  const before = await page.evaluate(() => window.__h.saves.length);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForFunction((n) => window.__h.saves.length === n + 1, before);
  const sent = (await page.evaluate((n) => window.__h.saves[n], before)).input;
  const list = sent.widgets.find((w) => w.kind === "PROJECT_LIST");
  assert.deepEqual(list.projectList, { affiliation: "BOOKMARKED", status: "ACTIVE" });
  assert.equal(list.spec, undefined);
});

await check("Download image makes a PNG of the dashboard with the date in its name", async () => {
  await page.reload(); await tiles().first().waitFor();
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.getByRole("button", { name: "Download image" }).click()]);
  assert.match(download.suggestedFilename(), /^.+-\d{4}-\d{2}-\d{2}\.png$/);
  const path = await download.path();
  const { statSync } = await import("node:fs");
  assert.ok(statSync(path).size > 2000, "the picture is not empty");
});

await check("an administrator chooses who sees an organisation dashboard on Home: nobody, everyone or chosen people", async () => {
  await page.reload(); await tiles().first().waitFor();
  await page.getByRole("button", { name: "Show on Home…" }).click();
  await page.getByLabel("Chosen people").check();
  assert.equal(await page.getByRole("button", { name: "Save", exact: true }).last().isDisabled(), true, "choosing people needs at least one person");
  await page.getByLabel(/Amina/).check();
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  await page.getByText("Shown on the Home of 1 person.").waitFor();
});

await browser.close();
console.log(results.join("\n"));
console.log(`page errors: ${errors.length === 0 ? "none" : "\n" + errors.join("\n")}`);
if (results.some((r) => r.startsWith("FAIL")) || errors.length > 0) process.exit(1);
