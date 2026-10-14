import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync, appendFileSync } from "node:fs"; import { activities, PERIOD_OF } from "./plan8.mjs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser, ctx } = await attach("actcreate");
const manifest = JSON.parse(readFileSync("evidence-manifest.json","utf8"));
const m = Number(process.argv[2]); const only = process.argv[3] && process.argv[3] !== "all" ? process.argv[3].split(",") : null; const withFiles = !!process.env.WITHFILES;
for (const a of activities(m)) {
  if (only && !only.includes(a.node)) continue;
  await page.goto(`${BASE}/projects/${P}/activities/new`); await page.waitForLoadState("networkidle");
  const fresh = page.getByRole("button", { name: "Start fresh" }); if (await fresh.count()) { await fresh.click(); await page.waitForTimeout(600); }
  await page.locator("input[name=activityTitle]").fill(a.title);
  await page.locator("input[name=activityDate]").fill(a.date);
  await page.waitForTimeout(600);
  const periodShown = (await page.locator("main").innerText()).match(/Reporting period: ([^\n(]*)/)?.[1]?.trim();
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
  if (files.length) {
    await page.locator("input[type=file]").first().setInputFiles(files); await page.waitForTimeout(800);
    for (const x of manifest.filter(x => x.m === m && x.node === a.node)) {
      const nm = x.file.split("/").pop();
      await page.getByLabel(`Type of ${nm}`).selectOption({ label: x.type }).catch(e => console.log("  type?", nm));
      await page.getByLabel(`Confidentiality of ${nm}`).selectOption({ label: x.sens }).catch(e => console.log("  conf?", nm));
      if (x.ind) { const sl = page.getByLabel(`Indicator proved by ${nm}`); const o = (await sl.locator("option").allInnerTexts()).find(t => t.startsWith(x.ind + " ")); if (o) await sl.selectOption({ label: o }); }
    }
  }
  if (process.env.SHOWFORM) { const {dump}=await import("../demo-ui/lib.mjs"); console.log((await page.locator("form").innerText()).replace(/\n+/g," | ").slice(-900)); console.log((await dump(page)).filter(l=>/checkbox|select|radio/.test(l)).slice(0,12).join("\n")); await page.screenshot({path:"shot-actfiles.png"}); }
  const derived = periodShown;
  const offline = process.env.OFFLINE && process.env.OFFLINE.split(",").includes(a.node);
  if (offline) await ctx.setOffline(true);
  await page.getByRole("button", { name: "Submit activity" }).click();
  if (offline) { await page.waitForTimeout(4000); console.log("  OFFLINE submit ->", page.url().replace(BASE, "").slice(-30), "|", (await page.locator("body").innerText()).replace(/\n+/g," | ").match(/[^|]*(offline|queued|saved on this device|waiting|sync)[^|]*/gi)?.slice(0,4)); await page.screenshot({ path: "shot-offline.png" }); await ctx.setOffline(false); await page.waitForTimeout(20000); console.log("  back online ->", page.url().replace(BASE, "").slice(-30), "|", (await page.locator("body").innerText()).replace(/\n+/g," | ").match(/[^|]*(synced|sent|queued|waiting|attention)[^|]*/gi)?.slice(0,4)); }
  await page.waitForFunction(() => !location.pathname.endsWith("/new"), null, { timeout: 90000 }).catch(() => console.log("  (no redirect)"));
  await page.waitForTimeout(1500);
  appendFileSync("acts.log", `${m}\t${a.node}\t${page.url().split("/").pop()}\t${a.title}\n`);
  console.log("month", m + 1, a.node, files.length, "files", "period-derived-ok:", derived, page.url().replace(BASE, "").slice(-40));
}
await browser.close(); process.exit(0);
