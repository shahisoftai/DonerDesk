import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("addtrain");
const T = [["2026-03-16","2026-03-27",45],["2026-05-11","2026-05-22",35],["2026-07-06","2026-07-17",20],["2026-08-03","2026-08-14",40]];
for (const [s, e, n] of T) {
  await page.goto(`${BASE}/projects/${P}/activities/plan/new`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
  await page.getByLabel("Title").fill("Train health workers and volunteers in CMAM");
  await page.getByLabel("Starts").fill(s); await page.getByLabel("Ends (leave empty for one day)").fill(e);
  const lead = page.getByLabel("Lead"); await lead.selectOption({ label: (await lead.locator("option").allInnerTexts()).find(o => o.includes("Anita")) });
  const lf = page.getByLabel("Logframe activity"); await lf.selectOption({ label: (await lf.locator("option").allInnerTexts()).find(o => o.startsWith("A1.4")) });
  await page.getByText("More details", { exact: true }).click(); await page.getByLabel("Location").fill("Kohalpur health training room, Banke");
  await page.getByLabel("Attendance sheet").check(); await page.getByLabel("Training record").check();
  await page.getByLabel("People expected").fill(String(n));
  await page.getByRole("button", { name: "Add planned activity" }).click(); await page.waitForTimeout(3500);
  console.log(s, page.url().replace(BASE, ""));
}
await browser.close(); process.exit(0);
