// usage: node act.mjs <index> [submit]   (env EV=dir with month1.json, P=project id)
import { attach, BASE } from "../demo-ui/lib.mjs";
import fs from "node:fs";
const A = JSON.parse(fs.readFileSync(process.env.EV + "/month.json", "utf8")).records;
const PLAN = ["Community-based targeting and registration of households","Monthly cash and food distribution - Maiduguri","Monthly cash and food distribution - Bama","Monthly cash and food distribution - Monguno","Post-distribution monitoring round","Community MUAC screening - Monguno and Bama","Community MUAC screening - Mubi and Potiskum","Nutrition education and cooking demonstrations","Distribute dry-season seed and tool kits","Farmer field school sessions","Form and train VSLA groups","Cash-for-work: rehabilitate farm roads and irrigation channels"];
const i = Number(process.argv[2]); const a = A[i];
const { page, browser } = await attach("act");
await page.goto(`${BASE}/projects/${process.env.P}/activities/new`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2500);
const fresh = page.getByRole("button", { name: "Start fresh" }); if (await fresh.count()) { await fresh.click(); await page.waitForTimeout(600); }
await page.locator("input[name=activityTitle]").fill(a.title);
await page.locator("input[name=activityDate]").fill(a.date); await page.waitForTimeout(1200);
const per = await page.evaluate(() => (document.body.innerText.match(/Reporting period: ([^\n(]*)/) || [])[1]); console.log("period shown:", per);
const sel = page.getByLabel("Logframe activity (optional)"); const opts = await sel.locator("option").allInnerTexts();
const hit = opts.find((o) => new RegExp(`^\\s*Activity\\s+${a.node.replace(/\./g, "\\.")}\\s+—`).test(o)); if (hit) await sel.selectOption({ label: hit });
await page.locator("input[name=location]").fill(a.loc);
await page.locator("input[name=participantsTotal]").fill(String(a.total)); await page.locator("input[name=participantsMale]").fill(String(a.male)); await page.locator("input[name=participantsFemale]").fill(String(a.female));
await page.locator("textarea[name=summary]").fill(a.summary); await page.locator("textarea[name=achievements]").fill(a.achievements);
await page.locator("textarea[name=challenges]").fill(a.challenges); await page.locator("textarea[name=lessonsLearned]").fill(a.lessons); await page.locator("textarea[name=nextSteps]").fill(a.next);
if (a.ev.length) {
  await page.locator("input[type=file]").first().setInputFiles(a.ev.map((e) => e[0])); await page.waitForTimeout(1200);
  for (const [f, type, ind] of a.ev) { const nm = f.split("/").pop();
    const tl = page.getByLabel(`Type of ${nm}`); const to = await tl.locator("option").allInnerTexts(); if (i === 0) console.log("types", to.join(";")); const kw = type.split(" ")[0].toLowerCase(); const tm = to.find((t) => t.toLowerCase().includes(kw)) ?? "Other"; await tl.selectOption({ label: tm });
    await page.getByLabel(`Confidentiality of ${nm}`).selectOption({ label: "Internal" }).catch(() => console.log("  conf?", nm));
    const sl = page.getByLabel(`Indicator proved by ${nm}`); const o = (await sl.locator("option").allInnerTexts()).find((t) => t.startsWith(ind + " ")); if (o) await sl.selectOption({ label: o }); else console.log("  ind?", nm, ind); }
}
await page.screenshot({ path: process.env.SHOT, fullPage: true });
if (process.argv[3] === "submit") { await page.getByRole("button", { name: /^(Submit|Save)/ }).last().click(); await page.waitForTimeout(6000); console.log("after:", page.url()); }
await browser.close(); process.exit(0);
