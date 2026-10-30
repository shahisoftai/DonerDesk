// A real-browser check of the finance screens (the real sections and the real sheet rules; only the server actions and the router are stubbed).
//   pnpm --filter @donordesk/web test:finance
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { build } from "./build.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../..");
const out = mkdtempSync(join(tmpdir(), "finance-"));
await build(join(out, "bundle.js"));
execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.ts", "-i", "src/app/globals.css", "-o", join(out, "styles.css")], { cwd: web, stdio: "ignore" });
writeFileSync(join(out, "index.html"), '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');
const url = `file://${join(out, "index.html")}`;

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1300, height: 1000 }, acceptDownloads: true })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
const results = [];
const check = async (name, fn) => { try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name} :: ${String(e.message).split("\n").slice(0, 8).join(" ")}`); } };
const H = () => page.evaluate(() => window.__h);
const calls = async (name) => (await H()).calls.filter((c) => c.name === name);
const text = (loc) => loc.innerText().then((t) => t.replace(/\s+/g, " ").trim());

await page.goto(url);
await page.waitForSelector("#fin-summary");

await check("each currency stays on its own line, nothing is added across currencies, and an unconverted total says 'Rate needed' with what is missing", async () => {
  const summary = await text(page.locator("section[aria-labelledby='fin-summary']"));
  assert.match(summary, /obligated USD 10,000.00 · EUR 500.00/i);
  assert.match(summary, /In USD: Rate needed/);
  assert.match(summary, /1 amount could not be converted to USD: add the EUR rate for its day/);
  assert.match(summary, /received USD 3,000.00/i, "an all-USD figure needs no conversion line");
  assert.doesNotMatch(summary, /received USD 3,000.00 In USD/i);
  assert.match(summary, /still to receive USD 7,000.00 · EUR 500.00/i, "remaining is per currency, never netted across them");
  assert.match(summary, /Other funding \(not counted above\): USD 99.00/);
});

await check("funding sources say which count in totals", async () => {
  const t = await text(page.locator("section[aria-labelledby='fin-funding']").locator("table"));
  assert.match(t, /Donor A.*Counts in totals/);
  assert.match(t, /Partner cost-share.*Listed only/);
});

await check("an over-budget line is flagged, other-currency spend is named, and burn is a sentence with no projection", async () => {
  const b = await text(page.locator("section[aria-labelledby='fin-budget']"));
  assert.match(b, /Over budget/);
  assert.match(b, /1 expense in another currency is not counted against this line/);
  assert.match(b, /Spending is 20 points ahead of the clock/);
  assert.match(b, /Spent of budget 60%/);
});

await check("the register shows a balance per currency, drafts wait for approval and files missing are said", async () => {
  const r = page.locator("section[aria-labelledby='fin-register']");
  const t = await text(r.locator("table"));
  assert.match(t, /Received Tranche 1.*\+ USD 3,000.00.*USD 3,000.00/);
  assert.match(t, /Fuel.*- EUR 120.00.*EUR -120.00/);
  assert.match(t, /Training venue.*Waiting for approval/);
  assert.match(await text(r), /1 approved expense has no funding source/);
  assert.match(await text(r), /no file behind it/);
});

await check("approving a draft sends the decision for that entry", async () => {
  await page.getByRole("button", { name: "Approve", exact: true }).first().click();
  await page.waitForFunction(() => window.__h.calls.some((c) => c.name === "decide"));
  const [c] = await calls("decide");
  assert.deepEqual(c.args, ["p1", "EXPENSE", "e2", { decision: "APPROVED" }]);
  assert.ok((await H()).refreshes >= 1, "the page refreshes after a change");
});

await check("rejecting needs a reason first", async () => {
  await page.getByRole("button", { name: "Reject", exact: true }).first().click();
  const send = page.getByRole("button", { name: "Reject", exact: true }).last();
  assert.equal(await send.isDisabled(), true);
  await page.getByLabel("Why is it rejected?").fill("No receipt");
  await send.click();
  await page.waitForFunction(() => window.__h.calls.filter((c) => c.name === "decide").length === 2);
  const decisions = await calls("decide");
  assert.deepEqual(decisions[1].args[3], { decision: "REJECTED", note: "No receipt" });
});

await check("a bad amount is explained before sending and blocks the button; a good one is sent as typed", async () => {
  const form = page.getByRole("form", { name: "Add an expense" });
  await form.getByLabel("Paid to").fill("Acme");
  await form.getByLabel("Amount").fill("12.345");
  assert.match(await text(form), /Enter an amount such as 1200 or 12.50/);
  assert.equal(await form.getByRole("button", { name: "Add an expense" }).isDisabled(), true);
  await form.getByLabel("Amount").fill("12.50");
  await form.getByRole("button", { name: "Add an expense" }).click();
  await page.waitForFunction(() => window.__h.calls.some((c) => c.name === "addExpense"));
  const [c] = await calls("addExpense");
  assert.equal(c.args[1], "L1");
  assert.equal(c.args[2].amount, "12.50");
  assert.equal(c.args[2].vendor, "Acme");
});

await check("any three-letter currency can be typed, not only the reporting currency", async () => {
  const form = page.getByRole("form", { name: "Add funding" });
  await form.getByLabel("Source").selectOption("s1");
  await form.getByLabel("Amount").fill("2500");
  await form.getByLabel("Currency").fill("kes");
  assert.equal(await form.getByLabel("Currency").inputValue(), "KES");
  await form.getByRole("button", { name: "Add funding" }).click();
  await page.waitForFunction(() => window.__h.calls.some((c) => c.name === "addFunding"));
  const [c] = await calls("addFunding");
  assert.equal(c.args[1].currency, "KES");
});

await check("an overdue advance says so, and accounting for part of it opens a form in its own currency", async () => {
  const a = page.locator("section[aria-labelledby='fin-advances']");
  assert.match(await text(a), /Overdue: 50 days/);
  assert.match(await text(a), /Still to account for: USD 600.00/);
  await a.getByRole("button", { name: "Account for part of it" }).click();
  const form = a.getByRole("form", { name: "Account for part of it" });
  assert.equal(await form.getByLabel("Currency").inputValue(), "USD");
});

await check("milestones: approve while waiting, mark as paid once approved", async () => {
  const d = page.locator("section[aria-labelledby='fin-deliverables']");
  await d.getByRole("button", { name: "Approve" }).click();
  await page.waitForFunction(() => window.__h.calls.some((c) => c.name === "approveDeliverable"));
  assert.deepEqual((await calls("approveDeliverable"))[0].args, ["p1", "dl1"]);
  await d.getByRole("button", { name: "Mark as paid" }).click();
  await page.waitForFunction(() => window.__h.calls.some((c) => c.name === "payDeliverable"));
  assert.deepEqual((await calls("payDeliverable"))[0].args, ["p1", "dl2", { on: "2026-03-01" }]);
});

const SHEET_BAD = "Type,Date,Amount,Currency,Paid to,What for,Budget line,Funding source\nExpense,2026-02-01,10,,Acme,Fuel,1.1,\nGift,2026-02-02,5,,,,,\nExpense,2026-02-03,5,,Acme,,9.9,\n";
await check("a sheet with a bad row is refused whole: each problem is named by row and the person's own sheet comes back", async () => {
  const s = page.locator("section[aria-labelledby='fin-import']");
  await s.getByRole("textbox").fill(SHEET_BAD);
  await s.getByRole("button", { name: "Check the sheet" }).click();
  await s.getByText("2 rows have a problem, so nothing was added.").waitFor();
  const t = await text(s);
  assert.match(t, /Row 3: Type must be "Expense" or "Money received"/);
  assert.match(t, /Row 4: No budget line has the code "9.9" in this project/);
  assert.equal(await s.getByRole("button", { name: "Import the rows" }).count(), 0, "no import button while anything is wrong");
  const [dl] = await Promise.all([page.waitForEvent("download"), s.getByRole("link", { name: "Download your sheet with the problems" }).click()]);
  const csv = readFileSync(await dl.path(), "utf8");
  assert.match(csv, /^Type,Date,Amount,Currency,Paid to,What for,Budget line,Funding source,Problems/);
  assert.equal(csv.trim().split("\n").length, 3, "header and only the two rows to fix");
});

await check("a good sheet is checked, then imported on confirmation", async () => {
  const s = page.locator("section[aria-labelledby='fin-import']");
  await s.getByRole("textbox").fill("Type,Date,Amount,Currency,Paid to,What for,Budget line,Funding source\nExpense,2026-02-01,10,,Acme,Fuel,1.1,\nMoney received,2026-02-02,500,USD,,Tranche,,Donor A\n");
  await s.getByRole("button", { name: "Check the sheet" }).click();
  await s.getByText("2 rows are ready to import.").waitFor();
  await s.getByRole("button", { name: "Import the rows" }).click();
  await s.getByText("2 entries added and waiting for approval.").waitFor();
  const imports = await calls("import");
  assert.deepEqual(imports.map((c) => c.args[1].apply), [false, false, true]);
});

await check("a person without permission sees the figures but no form, no approve and no import", async () => {
  await page.goto(`${url}?role=viewer`);
  await page.waitForSelector("#fin-summary");
  assert.match(await text(page.locator("section[aria-labelledby='fin-summary']")), /obligated USD 10,000.00/i);
  assert.equal(await page.getByRole("form").count(), 0);
  assert.equal(await page.getByRole("button", { name: /Approve|Reject|Mark as paid|Import|Remove/ }).count(), 0);
  assert.equal(await page.locator("section[aria-labelledby='fin-import']").count(), 0);
});

await browser.close();
console.log(results.join("\n"));
console.log(`page errors: ${errors.length === 0 ? "none" : "\n" + errors.join("\n")}`);
if (results.some((r) => r.startsWith("FAIL")) || errors.length > 0) process.exit(1);
