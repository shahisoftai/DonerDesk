import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("addextra");
const X = [
 ["Refresher meeting of mother support group leaders", "2026-06-22", "2026-06-26", "Sunita", "A2.2", ["Attendance sheet", "Meeting minutes"], "Bardiya meeting hall"],
 ["Joint review with the district health office", "2026-07-13", "2026-07-17", "Sunita", "A2.1", ["Meeting minutes"], "Banke District Public Health Office"],
 ["Handover of registers to the health posts", "2026-08-28", "", "Anita", "A1.1", ["Approval document"], "Kohalpur and Gulariya health posts"],
];
for (const [title, s, e, who, node, files, loc] of X) {
  await page.goto(`${BASE}/projects/${P}/activities/plan/new`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
  await page.getByLabel("Title").fill(title); await page.getByLabel("Starts").fill(s); if (e) await page.getByLabel("Ends (leave empty for one day)").fill(e);
  const lead = page.getByLabel("Lead"); await lead.selectOption({ label: (await lead.locator("option").allInnerTexts()).find(o => o.includes(who)) });
  const lf = page.getByLabel("Logframe activity"); await lf.selectOption({ label: (await lf.locator("option").allInnerTexts()).find(o => o.startsWith(node)) });
  await page.getByText("More details", { exact: true }).click(); await page.getByLabel("Location").fill(loc);
  for (const f of files) await page.getByLabel(f, { exact: true }).check();
  await page.getByRole("button", { name: "Add planned activity" }).click(); await page.waitForTimeout(3500);
  console.log(title.slice(0, 40), page.url().replace(BASE, "").slice(-30));
}
await browser.close(); process.exit(0);
