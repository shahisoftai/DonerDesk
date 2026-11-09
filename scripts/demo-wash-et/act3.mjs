// usage: node act3.mjs <index> [submit]   env EV=dir with month.json, P=project id
import { attach, BASE } from "../demo-ui/lib.mjs";
import fs from "node:fs";
const A = JSON.parse(fs.readFileSync(process.env.EV + "/month.json", "utf8")).records;
const i = Number(process.argv[2]); const a = A[i];
const { page, browser } = await attach("act3");
page.setDefaultTimeout(6000);
const T = (loc) => loc.evaluate((e) => [...e.options].map((o) => o.textContent.trim()));
await page.goto(`${BASE}/projects/${process.env.P}/activities/new`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500);
const fresh = page.getByRole("button", { name: "Start fresh" }); if (await fresh.count()) { await fresh.click(); await page.waitForTimeout(600); }
await page.locator("input[name=activityTitle]").fill(a.title);
await page.getByRole("button", { name: "Pick a day" }).click(); await page.waitForTimeout(400);
await page.locator("input[type=date][aria-label='Pick a day']").fill(a.date); await page.waitForTimeout(900);
await page.locator("input[name=location]").fill(a.loc);
await page.locator("textarea[name=summary]").fill(a.summary + " " + a.achievements);
if (a.ev.length) {
  await page.locator("input[type=file]").first().setInputFiles(a.ev.map((e) => e[0])); await page.waitForTimeout(1800);
  const fd = page.locator("summary", { hasText: "File details" }); const nfd = await fd.count(); for (let k = 0; k < nfd; k++) { await fd.nth(k).click(); await page.waitForTimeout(250); }
}
if (!(await page.locator("input[name=participantsTotal]").isVisible())) { await page.getByText("Add detail", { exact: false }).first().click(); await page.waitForTimeout(600); }
await page.locator("input[name=participantsTotal]").fill(String(a.total)); await page.locator("input[name=participantsMale]").fill(String(a.male)); await page.locator("input[name=participantsFemale]").fill(String(a.female));
const sel = page.getByLabel("Logframe activity (optional)"); const opts = await T(sel);
if (i === 0 && process.env.DBG) console.log(opts.join("\n"));
const code = a.node; const hit = opts.find((o) => o.includes(" " + code + " ") || o.startsWith(code + " ") || o.includes(code + " —") || o.includes(code + " ·"));
if (hit) await sel.selectOption({ label: hit }); else console.log("no logframe option for", code);
// planned activity radio: only the suggestions offered; pick by shared title words
const radios = page.locator("input[name=plannedActivity]"); const rn = await radios.count(); let picked = "none";
for (let k = 0; k < rn; k++) { const t = await radios.nth(k).evaluate((e) => e.closest("label")?.innerText ?? ""); const w = a.title.split(" - ")[0].toLowerCase().split(/\W+/).filter((x) => x.length > 4); if (w.filter((x) => t.toLowerCase().includes(x)).length >= 2) { await radios.nth(k).check(); picked = t.split("\n")[0]; break; } }
console.log("planned:", picked);
const more = page.getByText("More about it", { exact: false }).first(); if (await more.count()) { await more.click(); await page.waitForTimeout(500); }
await page.locator("textarea[name=achievements]").fill(a.achievements).catch(() => {});
await page.locator("textarea[name=challenges]").fill(a.challenges).catch(() => {}); await page.locator("textarea[name=lessonsLearned]").fill(a.lessons).catch(() => {}); await page.locator("textarea[name=nextSteps]").fill(a.next).catch(() => {});
for (const [f, type, ind] of a.ev) { const nm = f.split("/").pop();
  const tl = page.getByLabel(`Type of ${nm}`); if (!(await tl.count())) { console.log("  no type control", nm); continue; }
  const to = await T(tl); if (i === 0 && process.env.DBG) console.log("types", to.join(";")); const kw = type.split(" ")[0].toLowerCase(); const tm = to.find((t) => t.toLowerCase().includes(kw)) ?? "Other"; await tl.selectOption({ label: tm });
  await page.getByLabel(`Who may see ${nm}`).selectOption({ label: "Internal" }).catch(() => console.log("  conf?", nm));
  const sl = page.getByLabel(`Number ${nm} proves`); const o = (await T(sl)).find((t) => t.startsWith(ind + " ")); if (o) await sl.selectOption({ label: o }); else console.log("  ind?", nm, ind); }
await page.screenshot({ path: process.env.SHOT, fullPage: true }); console.log("selects:", await page.evaluate(() => [...document.querySelectorAll("main select")].map(s => (s.getAttribute("aria-label")||s.name||s.id))));
if (process.argv[3] === "submit") { await page.getByRole("button", { name: /^Submit activity/ }).last().click(); await page.waitForTimeout(7000); console.log("after:", page.url()); }
await browser.close(); process.exit(0);
