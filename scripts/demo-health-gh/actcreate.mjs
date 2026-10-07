import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync, appendFileSync } from "node:fs"; import { activities } from "./plan7.mjs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("actcreate");
const manifest = JSON.parse(readFileSync("evidence-manifest.json","utf8"));
const m = Number(process.argv[2]); const only = process.argv[3] && process.argv[3] !== "all" ? process.argv[3].split(",") : null; const withFiles = !!process.env.WITHFILES;
for (const a of activities(m)) {
  if (only && !only.includes(a.node)) continue;
  await page.goto(`${BASE}/projects/${P}/activities/new`); await page.waitForLoadState("networkidle");
  await page.locator("select[name=reportingPeriodId]").selectOption(per[m]);
  await page.locator("input[name=activityTitle]").fill(a.title);
  await page.locator("input[name=activityDate]").fill(a.date);
  const sel = page.getByLabel("Logframe activity (optional)"); const opts = await sel.locator("option").allInnerTexts();
  const hit = opts.find(o => new RegExp(`^Activity\\s+${a.node.replace(".", "\\.")}\\s+—`).test(o.trim())); if (!hit) throw new Error("no node " + a.node);
  await sel.selectOption({ label: hit });
  await page.locator("input[name=location]").fill(a.loc);
  if (a.total != null) await page.locator("input[name=participantsTotal]").fill(String(a.total));
  if (a.male != null) await page.locator("input[name=participantsMale]").fill(String(a.male));
  if (a.female != null) await page.locator("input[name=participantsFemale]").fill(String(a.female));
  await page.locator("textarea[name=summary]").fill(a.summary); await page.locator("textarea[name=achievements]").fill(a.achievements);
  await page.locator("textarea[name=challenges]").fill(a.challenges + " " + a.adapt); await page.locator("textarea[name=lessonsLearned]").fill(a.lessons); await page.locator("textarea[name=nextSteps]").fill(a.next);
  const files = withFiles ? manifest.filter(x => x.m === m && x.node === a.node).map(x => x.file) : [];
  if (files.length) await page.locator("input[type=file]").setInputFiles(files);
  await page.getByRole("button", { name: "Submit activity" }).click();
  await page.waitForFunction(() => !location.pathname.endsWith("/new"), null, { timeout: 90000 }).catch(() => console.log("  (no redirect)"));
  await page.waitForTimeout(1500);
  appendFileSync("acts.log", `${m}\t${a.node}\t${page.url().split("/").pop()}\t${a.title}\n`);
  console.log("month", m + 1, a.node, files.length, "files", page.url().replace(BASE, "").slice(-40), (await page.locator("main").innerText()).split("\n").filter(l => /Uploaded|failed|Retry|hint|participants/i.test(l)).slice(0, 3).join(" | "));
}
await browser.close(); process.exit(0);
