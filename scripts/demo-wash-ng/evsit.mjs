import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs"; import { resolve } from "node:path";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("evsit");
for (const [f, type, sens, notes] of [["ev/sit-flood-rapid-assessment.pdf","Field visit report","Internal","Flood rapid assessment of 14 August 2026: 1,850 households affected in Jere and Konduga; needs listed."],["ev/sit-flood-photo.jpg","Photo","Public","Flooded access path at Dalori ward, 12 August 2026. Synthetic demo image."]]) {
  await page.goto(`${BASE}/projects/${P}/evidence/new`); await page.waitForLoadState("networkidle");
  const sels = page.locator("main select"); await sels.nth(0).selectOption({ label: type }); await sels.nth(1).selectOption({ label: sens });
  await page.locator("main input:not([type=file]):not([type=checkbox]):not([type=radio])").first().fill("Dalori ward and Mashimari, Jere LGA");
  await page.locator("main textarea").first().fill(notes);
  await page.locator("input[type=file]").first().setInputFiles(resolve(f)); await page.waitForTimeout(700);
  await page.getByRole("button", { name: /^(Upload|Save|Submit)/ }).last().click();
  await page.waitForFunction(() => !location.pathname.endsWith("/new"), null, { timeout: 60000 }).catch(() => console.log("  (no redirect)")); await page.waitForTimeout(800); console.log("uploaded", f, page.url().split("/").pop());
}
await browser.close(); process.exit(0);
