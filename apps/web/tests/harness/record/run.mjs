// A real-browser check of the Record screens (the real sheet, number form, activity form, "What happened?", waiting list and rules;
// only the server actions and the outbox are stubbed), on a phone-sized touch screen, a desktop, offline and in Arabic.
//   pnpm --filter @donordesk/web test:record
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
const out = mkdtempSync(join(tmpdir(), "record-"));
await build(join(out, "bundle.js"));
execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.ts", "-i", "src/app/globals.css", "-o", join(out, "styles.css")], { cwd: web, stdio: "ignore" });
writeFileSync(join(out, "index.html"), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="styles.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');
const base = `file://${join(out, "index.html")}`;

const browser = await chromium.launch();
const errors = [];
const results = [];
const check = async (name, fn) => { try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name} :: ${String(e.message).split("\n").slice(0, 8).join(" ")}`); } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
async function open(hash = "", ctx = PHONE) {
  const context = await browser.newContext(ctx);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 600)); });
  await page.goto(base + (hash ? `#${hash}` : ""));
  await page.getByTestId("host").waitFor();
  return page;
}
const calls = (page, name) => page.evaluate((n) => window.__h.calls.filter((c) => c[0] === n).map((c) => c[1]), name);
const today = (page) => page.evaluate(() => { const d = new Date(); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; });
const pickNumber = async (page) => { await page.getByRole("button", { name: /A number/ }).click(); await page.getByLabel("How many?", { exact: false }).first().waitFor(); };

await check("the chooser offers only what the role may record, in plain words", async () => {
  const page = await open("");
  assert.deepEqual((await page.getByRole("button").allInnerTexts()).map((t) => t.split("\n")[0]), ["A number", "Something we did", "A photo or file", "An expense"]);
  const only = await open("caps=indicator.update");
  assert.deepEqual((await only.getByRole("button").allInnerTexts()).map((t) => t.split("\n")[0]), ["A number"]);
  const none = await open("caps=project.view");
  assert.ok(await none.getByText("You cannot record anything on this project").isVisible());
});

await check("a number: type it, the day is today and its period is named, Save sends exactly that and confirms", async () => {
  const page = await open("");
  await pickNumber(page);
  await page.getByLabel(/How many/).fill("320");
  assert.ok(await page.getByText(/Counts toward/).isVisible(), "the period is stated before saving");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("heading", { name: "Saved" }).waitFor();
  const [sent] = await calls(page, "quickEnterValueAction");
  assert.deepEqual(sent[0], { indicatorId: "i1", date: await today(page), periodAchievement: "320" });
  assert.ok(await page.getByText("A running total was suggested.").isVisible());
  await page.getByRole("button", { name: "Record another number" }).click();
  assert.equal(await page.getByLabel("Which number?").inputValue(), "i2", "carries on with the next number");
});

await check("with no signal the number is kept on the phone and the person is told, calmly", async () => {
  const page = await open("offline=1");
  await pickNumber(page);
  await page.getByLabel(/How many/).fill("45");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("heading", { name: "Kept on this phone" }).waitFor();
  const [entry] = await calls(page, "outbox.enqueue");
  assert.equal(entry[0].kind, "indicator-values");
  assert.equal(entry[0].payload.periodId, "per-now");
  assert.equal(entry[0].title, "A1: 45");
  assert.ok(await page.getByText("You do not need to do anything").isVisible());
});

await check("a day in no reporting period is explained, Save is off, and who can fix it is offered the right button", async () => {
  const page = await open("noPeriod=1");
  await pickNumber(page);
  await page.getByLabel(/How many/).fill("10");
  await page.getByRole("button", { name: "Pick a day" }).click();
  await page.getByLabel("Pick a day").nth(1).fill("2035-01-15").catch(() => page.locator('input[type="date"]').fill("2035-01-15"));
  const card = page.getByRole("region", { name: "That day is not in a reporting period yet" });
  await card.waitFor();
  assert.equal(await page.getByRole("button", { name: "Save", exact: true }).isDisabled(), true);
  assert.ok(await page.getByText("Save turns on once the problem above is solved.").isVisible());
  await card.getByRole("button", { name: "Ask the project manager to open it" }).click();
  await page.getByText(/Asked\./).waitFor();
  assert.equal((await calls(page, "period.ask")).length, 1);
  const manager = await open("noPeriod=1&caps=indicator.update,project.edit");
  await pickNumber(manager);
  await manager.getByRole("button", { name: "Pick a day" }).click();
  await manager.locator('input[type="date"]').fill("2035-01-15");
  await manager.getByRole("button", { name: "Open it and save" }).click();
  await manager.waitForFunction(() => window.__h.calls.some((c) => c[0] === "period.open"));
});

await check("opened on a kind, Back reaches the chooser and stays there", async () => {
  const page = await open("kind=NUMBER");
  await page.getByLabel(/How many/).waitFor();
  await page.getByRole("button", { name: /Back/ }).click();
  await page.getByRole("heading", { name: "What are you recording?" }).waitFor();
  await page.waitForTimeout(600);
  assert.equal(await page.getByLabel(/How many/).count(), 0, "it did not jump back into the number form");
});

await check("opening a missing period keeps what was typed and saves it into the new period", async () => {
  const page = await open("noPeriod=1&caps=indicator.update,project.edit");
  await pickNumber(page);
  await page.getByLabel(/How many/).fill("77");
  await page.getByText("Add detail", { exact: true }).click();
  await page.getByLabel("A note (optional)").fill("typed before the period existed");
  await page.getByRole("button", { name: "Pick a day" }).click();
  await page.locator('input[type="date"]').fill("2035-01-15");
  await page.getByRole("button", { name: "Open it and save" }).click();
  await page.getByRole("heading", { name: "Saved" }).waitFor();
  const [[sent]] = await calls(page, "quickEnterValueAction");
  assert.equal(sent.periodAchievement, "77");
  assert.equal(sent.date, "2035-01-15");
  assert.equal(sent.comments, "typed before the period existed");
});

await check("an activity on a day with no period: a manager opens it, the form follows and then saves into it", async () => {
  const page = await open("kind=ACTIVITY&noPeriod=1&caps=activity.create,project.edit");
  await page.getByLabel("Activity title").fill("Late record");
  await page.getByLabel("What happened?").fill("Recorded for a later month.");
  await page.getByRole("button", { name: "Pick a day" }).click();
  await page.locator('input[type="date"]').first().fill("2035-01-15");
  await page.getByRole("button", { name: "Open it", exact: true }).click();
  await page.getByText(/Counts toward/).waitFor();
  await page.getByRole("button", { name: /^Save$/ }).click();
  await page.getByRole("heading", { name: "Saved" }).waitFor();
  const [[input]] = await calls(page, "createActivityAction");
  assert.equal(input.reportingPeriodId, "per-new");
  assert.equal(input.activityTitle, "Late record");
});

await check("a number that needs a split says so, and the split travels with it", async () => {
  const page = await open("breakdown=1");
  await pickNumber(page);
  await page.getByLabel(/How many/).fill("320");
  assert.ok(await page.getByText(/also needs a split/).isVisible());
  await page.getByText("Add detail", { exact: true }).click();
  await page.getByRole("button", { name: "+ Sex" }).click();
  const fields = page.getByLabel(/^Value for/);
  assert.ok((await fields.count()) >= 2);
  await fields.nth(0).fill("180");
  await fields.nth(1).fill("140");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("heading", { name: "Saved" }).waitFor();
  const [sent] = await calls(page, "quickEnterValueAction");
  assert.equal(sent[0].disaggregation.length, 2);
  assert.equal(sent[0].disaggregation[0].dimension, "SEX");
});

await check("a pack from before numbers were carried says so instead of showing an empty form", async () => {
  const page = await open("v1=1");
  await page.getByRole("button", { name: /A number/ }).click();
  await page.getByText("not on this phone yet").waitFor();
});

await check("something we did: five things on the first screen, the rest under Add detail, and Save sends the activity", async () => {
  const page = await open("kind=ACTIVITY");
  await page.getByLabel("Activity title").waitFor();
  assert.ok(await page.getByLabel("Location").isVisible());
  assert.ok(await page.getByLabel("What happened?").isVisible());
  assert.ok(await page.getByText("Photos and files (optional)").isVisible());
  assert.equal(await page.getByLabel("Total participants").isVisible(), false, "people counts wait under Add detail");
  await page.getByLabel("Activity title").fill("Hygiene session");
  await page.getByLabel("What happened?").fill("We showed handwashing to 42 people.");
  await page.getByText("Add detail", { exact: true }).first().click();
  assert.ok(await page.getByLabel("Total participants").isVisible());
  await page.getByLabel("Total participants").fill("42");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("heading", { name: "Saved" }).waitFor();
  const [[input]] = await calls(page, "createActivityAction");
  assert.equal(input.activityTitle, "Hygiene session");
  assert.equal(input.summary, "We showed handwashing to 42 people.");
  assert.equal(input.participantsTotal, 42);
  assert.equal(input.reportingPeriodId, "per-now", "the period follows the day");
});

await check("from a planned item: what happened? offers three answers; 'did not happen' needs a reason and cancels with it", async () => {
  const page = await open("kind=ACTIVITY&plan=pa1&caps=indicator.update,activity.create,evidence.upload,workplan.update-own,workplan.manage");
  await page.getByRole("heading", { name: "What happened?" }).waitFor();
  assert.ok(await page.getByText("Hygiene session").first().isVisible());
  await page.getByRole("button", { name: /It did not happen/ }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  assert.ok(await page.getByText("Say why it did not happen.").isVisible());
  await page.getByLabel("Why did it not happen?").fill("Heavy rain");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("heading", { name: "Marked as not held" }).waitFor();
  const [[id, body]] = await calls(page, "changePlanStatusAction");
  assert.equal(id, "pa1");
  assert.deepEqual(body, { action: "CANCEL", reason: "Heavy rain" });
});

await check("'it is finished' online with nothing extra is one call that marks it done", async () => {
  const page = await open("kind=ACTIVITY&plan=pa1");
  await page.getByRole("button", { name: /It is finished/ }).click();
  await page.getByRole("button", { name: "Mark done" }).click();
  await page.getByRole("heading", { name: "Marked done" }).waitFor();
  const [[id, body]] = await calls(page, "completePlannedActivityAction");
  assert.equal(id, "pa1");
  assert.equal(body.finishedOn, await today(page));
});

await check("a planned item that is already done cannot be changed again, and says so", async () => {
  const page = await open("kind=ACTIVITY&plan=pa2");
  await page.getByText("already finished or cancelled").waitFor();
});

await check("the waiting list puts what needs the person first, shows photos and the reason, and offers one action each", async () => {
  const page = await open("waiting=1");
  const titles = await page.locator("ul > li p.text-base").allInnerTexts();
  assert.equal(titles[0], "Water point survey", "needs-you first");
  assert.ok(await page.getByText("The village name is missing.").isVisible());
  assert.ok(await page.getByText("Photos: 3").isVisible());
  await page.getByRole("button", { name: "Try again" }).click();
  assert.deepEqual((await calls(page, "outbox.retry"))[0], ["e3"]);
  await page.getByRole("button", { name: "Delete" }).click();
  assert.deepEqual((await calls(page, "outbox.discard"))[0], ["e3"]);
});

await check("having no signal is a calm note, never an error colour", async () => {
  const page = await open("waiting=1&offline=1");
  const note = page.getByText("No signal. You can keep working.");
  await note.waitFor();
  const box = note.locator("xpath=ancestor::div[@role='status'][1]");
  const color = await box.evaluate((e) => getComputedStyle(e).backgroundColor);
  assert.doesNotMatch(color, /^rgb\((2[0-5]\d), ?(\d{1,2}), ?(\d{1,2})\)/, `not a red background: ${color}`);
});

async function audit(page) {
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
    const controls = [...document.querySelectorAll("button, a[href], input:not([type=hidden]):not([type=file]), select, textarea, summary")].filter(vis);
    const target = (e) => { const label = e.type === "radio" || e.type === "checkbox" ? e.closest("label") : null; return (label ?? e).getBoundingClientRect().height; };
    const small = controls.filter((e) => target(e) < 43.5).map((e) => `${e.tagName}:${(e.getAttribute("aria-label") || e.textContent || e.id || "").trim().slice(0, 30)} ${Math.round(target(e))}px`);
    const unnamed = [...document.querySelectorAll("input:not([type=hidden]), select, textarea")].filter(vis).filter((e) => !(e.labels?.length || e.getAttribute("aria-label") || e.getAttribute("aria-labelledby"))).map((e) => `${e.tagName}#${e.id}`);
    return { overflow: document.documentElement.scrollWidth - window.innerWidth, small, unnamed };
  });
}
const expectClean = (report) => {
  assert.ok(report.overflow <= 1, `sideways scroll ${report.overflow}px`);
  assert.deepEqual(report.small, [], "controls under 44 px");
  assert.deepEqual(report.unnamed, [], "fields with no name");
};

for (const [name, hash] of [["the number form", "kind=NUMBER"], ["the activity form", "kind=ACTIVITY"], ["the chooser", ""], ["the 'What happened?' choices", "kind=ACTIVITY&plan=pa1"]]) {
  await check(`on a phone ${name} has no sideways scroll, every control is at least 44 px tall and every field has a name`, async () => expectClean(await audit(await open(hash))));
}

await check("with Add detail open the number form (split included) and the activity form still meet the same rules", async () => {
  const number = await open("kind=NUMBER&breakdown=1");
  await number.getByLabel(/How many/).fill("320");
  await number.getByText("Add detail", { exact: true }).click();
  await number.getByRole("button", { name: "+ Sex" }).click();
  expectClean(await audit(number));
  const activity = await open("kind=ACTIVITY");
  await activity.getByText("Add detail", { exact: true }).first().click();
  await activity.getByText("More about it (optional)").click();
  expectClean(await audit(activity));
});

await check("a field officer (no workplan.manage) is not offered 'It did not happen'", async () => {
  const page = await open("kind=ACTIVITY&plan=pa1");
  await page.getByRole("heading", { name: "What happened?" }).waitFor();
  assert.equal(await page.getByRole("button", { name: /It did not happen/ }).count(), 0);
  assert.ok(await page.getByRole("button", { name: /It is finished/ }).first().isVisible());
});

await check("the 'not held' form and the quick 'mark done' form meet the same rules", async () => {
  const held = await open("kind=ACTIVITY&plan=pa1&caps=indicator.update,activity.create,evidence.upload,workplan.update-own,workplan.manage");
  await held.getByRole("button", { name: /It did not happen/ }).click();
  expectClean(await audit(held));
  const quick = await open("kind=ACTIVITY&plan=pa1");
  await quick.getByRole("button", { name: /It is finished/ }).click();
  expectClean(await audit(quick));
});

await check("on a desktop the same sheet works and its main button is a button (it has a background)", async () => {
  const page = await open("wide=1", { viewport: { width: 1300, height: 900 } });
  await pickNumber(page);
  await page.getByLabel(/How many/).fill("5");
  const bg = await page.getByRole("button", { name: "Save", exact: true }).evaluate((e) => getComputedStyle(e).backgroundColor);
  assert.notEqual(bg, "rgba(0, 0, 0, 0)", "the primary button is drawn");
});

await check("in Arabic the page turns right to left and the words are Arabic", async () => {
  const page = await open("lang=ar");
  await page.getByRole("button", { name: /رقم/ }).first().waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dir), "rtl");
  assert.ok(await page.getByText("ماذا تريد أن تسجّل؟").isVisible());
});

await browser.close();
console.log(results.join("\n"));
if (errors.length) console.log(`\npage errors (${errors.length}):\n${[...new Set(errors)].slice(0, 6).join("\n---\n")}`);
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} checks passed${errors.length ? `, ${errors.length} page error(s)` : ""}`);
process.exit(failed || errors.length ? 1 : 0);
