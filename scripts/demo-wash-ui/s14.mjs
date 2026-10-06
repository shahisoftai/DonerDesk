import { attach, BASE } from "./lib.mjs"; import { readFileSync, appendFileSync } from "node:fs"; import { activities } from "./acts.mjs";
const P = readFileSync("pid.txt", "utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach();
const m = Number(process.argv[2]); const only = process.argv[3] ? process.argv[3].split(",") : null;
const periodId = process.argv[4] ?? per[m];
for (const a of activities(m)) {
  if (process.env.REVISED) { a.title += " (revised)"; a.achievements = "Five schools selected after head teacher consultations on 12-14 March and designs approved by the site engineer; no blocks completed yet."; a.summary += " Consultation meetings with head teachers and school management committees took place on 12-14 March and the design drawings are attached."; a.total = 25; a.male = 15; a.female = 10; }
  if (only && !only.includes(a.node)) continue;
  await page.goto(`${BASE}/projects/${P}/activities/new`); await page.waitForLoadState("networkidle");
  await page.locator("select[name=reportingPeriodId]").selectOption(periodId);
  await page.locator("input[name=activityTitle]").fill(a.title);
  const opts = await page.getByLabel("Logframe activity (optional)").locator("option").allInnerTexts();
  const hit = opts.find(o => new RegExp(`^Activity\\s+${a.node.replace(".", "\\.")}\\s+—`).test(o.trim())); if (!hit) throw new Error("no node " + a.node);
  await page.getByLabel("Logframe activity (optional)").selectOption({ label: hit });
  await page.locator("input[name=activityDate]").fill(a.date); await page.locator("input[name=location]").fill(a.loc);
  if (a.total != null) await page.locator("input[name=participantsTotal]").fill(String(a.total));
  if (a.male != null) await page.locator("input[name=participantsMale]").fill(String(a.male));
  if (a.female != null) await page.locator("input[name=participantsFemale]").fill(String(a.female));
  if (a.children != null) await page.locator("input[name=participantsChildren]").fill(String(a.children));
  await page.locator("textarea[name=summary]").fill(a.summary); await page.locator("textarea[name=achievements]").fill(a.achievements);
  await page.locator("textarea[name=challenges]").fill(a.challenges); await page.locator("textarea[name=lessonsLearned]").fill(a.lessons); await page.locator("textarea[name=nextSteps]").fill(a.next);
  await page.getByRole("button", { name: "Submit activity" }).click();
  await page.waitForFunction(() => !location.pathname.endsWith("/new"), null, { timeout: 15000 }).catch(() => console.log("  (no redirect)"));
  await page.waitForTimeout(800);
  const url = page.url(); appendFileSync("acts.log", `${m}\t${a.node}\t${url.split("/").pop()}\t${a.title}\n`);
  console.log("month", m + 1, a.node, url.replace(BASE, "").slice(-45), (await page.locator("main").innerText()).split("\n").filter(l => /hint|participants|record/i.test(l)).slice(0, 2).join(" | "));
}
await browser.close(); process.exit(0);
