// Actions on one planned activity page, by key "A2.3:1" (node:month index). Every action prints what the page said.
import { BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const S = JSON.parse(readFileSync("plan-state.json", "utf8"));
export async function open(page, key) { await page.goto(BASE + S[key]); await page.waitForLoadState("networkidle"); await page.waitForTimeout(700); }
const word = (t) => t.replace(/\n+/g, " | ");
export async function move(page, key, start, end, reason, later = false) {
  await open(page, key); await page.getByRole("button", { name: "Move dates" }).click(); await page.waitForTimeout(500);
  await page.getByLabel("Starts").fill(start); await page.getByLabel("Ends").fill(end);
  if (later) await page.getByLabel("This and later ones").check();
  await page.getByLabel("Why?").fill(reason); await page.getByRole("button", { name: "Save", exact: true }).click(); await page.waitForTimeout(2500);
  console.log("moved", key, "->", start, end, "|", word(await page.locator("main").innerText()).match(/\d+ \w+ to \d+ \w+ · [^|]*/)?.[0]);
}
export async function cancel(page, key, reason) {
  await open(page, key); await page.getByRole("button", { name: "Cancel activity" }).first().click(); await page.waitForTimeout(500);
  await page.getByLabel("Why?").fill(reason); await page.getByRole("button", { name: "Cancel activity" }).last().click(); await page.waitForTimeout(2500);
  console.log("cancelled", key, "|", word(await page.locator("main").innerText()).match(/Cancelled[^|]*/)?.[0]);
}
export async function done(page, key) {
  await open(page, key); await page.getByRole("button", { name: "Done", exact: true }).click(); await page.waitForTimeout(2200);
  console.log("done", key);
}
export async function ask(page, key, label, who, note, urgent = false) {
  await open(page, key); await page.getByRole("button", { name: label }).click(); await page.waitForTimeout(500);
  const sel = page.getByLabel("Who"); const o = (await sel.locator("option").allInnerTexts()).find((x) => x.includes(who)); await sel.selectOption({ label: o });
  await page.getByLabel(/Note/).fill(note); if (urgent) await page.getByLabel("Urgent").check();
  await page.getByRole("button", { name: "Send" }).click(); await page.waitForTimeout(2500);
  console.log("asked", who, "|", word(await page.locator("main").innerText()).match(/(Asked|Requested|Sent)[^|]*/)?.[0] ?? "(no confirmation text)");
}
export async function files(page, key, labels) {
  await open(page, key); await page.getByRole("button", { name: "Change", exact: true }).click(); await page.waitForTimeout(500);
  for (const l of labels) await page.getByLabel(l, { exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click(); await page.waitForTimeout(2500);
  console.log("files", key, "|", word(await page.locator("main").innerText()).match(/Files we will need[^|]*\|[^|]*/)?.[0]);
}
export async function comment(page, key, text) {
  await open(page, key); await page.getByRole("button", { name: "Add a comment" }).click(); await page.waitForTimeout(1200);
  await page.getByLabel("Add a comment").fill(text); await page.getByRole("button", { name: "Add comment" }).click(); await page.waitForTimeout(2500);
  console.log("comment", key, "|", text.slice(0, 40));
}
