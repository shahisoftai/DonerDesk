import { attach } from "./lib.mjs";
const { page, browser, shot, step } = await attach("finance");
const slide = page.locator("section[aria-roledescription='slide']");
for (const [name, amt, newName] of [["G. General Operating", "467290.00", "G.1 General Operating and Other Direct Costs (lump sum)"], ["PSC Amount", "32710.30", "Programme Support Cost (PSC) 7%"]]) await step("fix " + name, async () => {
  const row = slide.locator("li, article").filter({ has: page.locator(`input[value^="${name}"]`) }).first();
  const ins = row.locator("input");
  await ins.nth(1).fill(amt); await ins.nth(1).press("Tab"); await page.waitForTimeout(500);
  await ins.nth(2).fill("USD"); await ins.nth(2).press("Tab"); await page.waitForTimeout(700);
});
console.log((await slide.innerText()).replace(/\n+/g," | ").match(/Does it add up[\s\S]{0,400}/)?.[0]);
console.log((await page.getByRole("navigation", { name: "Create a project" }).innerText()).replace(/\n/g," | ").slice(0,330));
await browser.close();
