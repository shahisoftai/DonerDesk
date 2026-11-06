import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync, appendFileSync } from "node:fs"; import { activities, FULL } from "./plan9.mjs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("actcreate");
const manifest = JSON.parse(readFileSync("evidence-manifest.json","utf8")); const withFiles = !!process.env.WITHFILES;
const m = Number(process.argv[2]); const only = process.argv[3] && process.argv[3] !== "all" ? process.argv[3].split(",") : null;
for (const a of activities(m)) {
  if (only && !only.includes(a.node)) continue;
  await page.goto(`${BASE}/projects/${P}/activities/new`); await page.waitForLoadState("networkidle");
  const fresh = page.getByRole("button", { name: "Start fresh" }); if (await fresh.count()) { await fresh.click(); await page.waitForTimeout(600); }
  await page.locator("input[name=activityTitle]").fill(a.title);
  await page.locator("input[name=activityDate]").fill(a.date); await page.waitForTimeout(900);
  // pick the logframe activity first: the form then offers the planned activity of the same logframe activity first
  const sel = page.getByLabel("Logframe activity (optional)"); const opts = await sel.locator("option").allInnerTexts();
  const hit = opts.find(o => new RegExp(`^\\s*Activity\\s+${a.node.replace(".", "\\.")}\\s+—`).test(o)); if (hit) await sel.selectOption({ label: hit });
  await page.waitForTimeout(900);
  const label = page.locator("label").filter({ hasText: FULL[a.node] }).filter({ has: page.locator("input[name=plannedActivity]") }).first();
  let linked = "none";
  if (await label.count()) { await label.locator("input").check(); linked = "planned"; } else { await page.locator("label").filter({ hasText: "None of these" }).locator("input").check().catch(() => {}); }
  await page.locator("input[name=activityEndDate]").fill(a.through);
  await page.locator("input[name=location]").fill(a.loc);
  if (a.total != null) await page.locator("input[name=participantsTotal]").fill(String(a.total));
  if (a.male != null) await page.locator("input[name=participantsMale]").fill(String(a.male));
  if (a.female != null) await page.locator("input[name=participantsFemale]").fill(String(a.female));
  await page.locator("textarea[name=summary]").fill(a.summary); await page.locator("textarea[name=achievements]").fill(a.achievements);
  await page.locator("textarea[name=challenges]").fill(a.challenges + " " + a.adapt); await page.locator("textarea[name=lessonsLearned]").fill(a.lessons); await page.locator("textarea[name=nextSteps]").fill(a.next);
  const mf = withFiles ? manifest.filter(x => x.m === m && x.node === a.node) : [];
  if (mf.length) {
    await page.locator("input[type=file]").first().setInputFiles(mf.map(x => x.file)); await page.waitForTimeout(900);
    for (const x of mf) {
      const nmf = x.file.split("/").pop();
      await page.getByLabel(`Type of ${nmf}`).selectOption({ label: x.type }).catch(() => console.log("  type?", nmf));
      await page.getByLabel(`Confidentiality of ${nmf}`).selectOption({ label: x.sens }).catch(() => console.log("  conf?", nmf));
      if (x.ind) { const sl = page.getByLabel(`Indicator proved by ${nmf}`); const o = (await sl.locator("option").allInnerTexts()).find(t => t.startsWith(x.ind + " ")); if (o) await sl.selectOption({ label: o }); }
    }
  }
  await page.getByRole("button", { name: "Submit activity" }).click();
  await page.waitForFunction(() => !location.pathname.endsWith("/new"), null, { timeout: 90000 }).catch(() => console.log("  (no redirect)"));
  await page.waitForTimeout(1500);
  appendFileSync("acts.log", `${m}\t${a.node}\t${linked}\t${page.url().split("/").pop()}\t${a.title}\n`);
  console.log("  ", a.node, linked, page.url().split("/").pop().slice(0, 8));
}
await browser.close(); process.exit(0);
