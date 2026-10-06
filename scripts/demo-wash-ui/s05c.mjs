import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid3.txt", "utf8").trim(); const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/logframe`); await page.waitForLoadState("networkidle");
const ca = page.getByRole("button", { name: /Confirm all/ }); if (await ca.count()) { console.log("click", await ca.innerText()); await ca.click(); await page.waitForTimeout(3000); }
const links = await page.locator('table a[href*="/indicators/"]').evaluateAll(a => a.map(x => [x.textContent.trim(), x.getAttribute("href")]));
const hrefs = JSON.stringify(links); console.log(links.length, "indicators");
for (const [i, [name, href]] of links.entries()) {
  await page.goto(BASE + href); await page.waitForLoadState("networkidle");
  const rate = /Percentage/.test(name);
  await page.getByLabel("Calculation").selectOption({ label: rate ? "Reported directly (latest value)" : "Sum of period values" });
  await page.getByLabel("Direction of progress").selectOption({ label: "Higher is better" });
  await page.getByLabel("Reporting basis").selectOption({ label: "This period’s value" });
  await page.getByRole("button", { name: "Save calculation" }).click(); await page.waitForTimeout(1800);
  console.log(`#${i + 1}`, (await page.locator("main").innerText()).split("\n").filter(l => /^(Counts|Rate|Calculation (confirmed|needs)|.*(on track|evaluated))/i.test(l)).slice(0,3).join(" | "));
}
await page.goto(`${BASE}/projects/${P}/logframe`); await page.waitForLoadState("networkidle");
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Project indicators")).split("\n").filter(l=>/^IND/.test(l)).map(l=>l.slice(0,3)+" "+l.split("\t").pop()).join("\n"));
await page.screenshot({ path: "indicators.png" });
await browser.close(); process.exit(0);
