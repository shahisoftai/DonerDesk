import { createRequire } from "node:module";
const require = createRequire("/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/apps/web/package.json");
const { chromium } = require("@playwright/test");
const PID = "f2a96a79-148d-4ec6-86d8-8bc58aeb90cb";
const F = [["otp-register-upper-dir-nov.jpg", "Photo", "OC1-1"], ["muac-screening-sheet-mardan-nov.jpg", "Photo", "OP1.1-1"], ["supply-receipt-rutf-nov.jpg", "Procurement document", "OP1.2-1"]];
const b = await chromium.connectOverCDP("http://localhost:9333"); const page = b.contexts()[0].pages()[0]; page.setDefaultTimeout(30000);
for (const [f, type, code] of F) {
  await page.goto(`https://donordesk.online/projects/${PID}/evidence/new`); await page.waitForTimeout(3500);
  await page.getByLabel("Evidence type", { exact: true }).selectOption({ label: type }).catch(() => {});
  await page.getByLabel("Confidentiality", { exact: true }).selectOption({ label: "Internal" }).catch(() => {});
  const ind = page.getByLabel("Indicator", { exact: true }).first(); await ind.selectOption({ label: (await ind.locator("option").allInnerTexts()).find((o) => o.startsWith(code + " ")) });
  await page.locator("input[type=file]").first().setInputFiles("/tmp/claude-1000/tour-files/" + f); await page.waitForTimeout(1500);
  const btn = page.getByRole("button", { name: /^Save \d+ file/ }).first(); console.log(f, await btn.innerText()); await btn.click(); await page.waitForTimeout(9000);
  console.log((await page.locator("main").innerText()).match(/uploaded|saved|error|failed|Drive[^\n]*/i)?.[0]);
}
await b.close();
