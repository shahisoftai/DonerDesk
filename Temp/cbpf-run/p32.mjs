import { attach } from "./lib.mjs";
const { page, browser, shot, step } = await attach("launch");
const slide = page.locator("section[aria-roledescription='slide']");
const levels = { Insecurity: "HIGH", "Road inaccessibility": "MEDIUM", "Community tensions": "MEDIUM", "Financial and operational risks": "LOW", "AWD/cholera outbreaks": "HIGH" };
for (const [k, lv] of Object.entries(levels)) await step("rate " + k, async () => {
  const r = slide.locator("li, article").filter({ has: page.locator(`input[value^="${k}"]`) }).first();
  await r.getByLabel("How serious").selectOption(lv); await page.waitForTimeout(600);
});
await step("confirm all risks", async () => { const b = page.getByRole("button",{name:/Confirm all \d+ that are waiting/}); if (await b.count()) { await b.click(); await page.waitForTimeout(900); } });
await step("dashboard", async () => { await page.getByLabel("Dashboard", { exact: true }).selectOption({ label: "Water, sanitation and hygiene: access and results" }); await page.waitForTimeout(700); });
console.log((await slide.innerText()).replace(/\n+/g," | ").match(/What will be created[\s\S]{0,900}/)?.[0]);
console.log((await page.getByRole("navigation", { name: "Create a project" }).innerText()).replace(/\n/g," | ").slice(0,330));
await shot("launch-ready");
await browser.close();
