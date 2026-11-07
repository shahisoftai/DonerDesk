import { attach } from "./lib.mjs";
const { page, browser, shot, step, type } = await attach("reporting");
const slide = page.locator("section[aria-roledescription='slide']");
for (const [k, d] of [["Quarterly report", "15"], ["Final report", "30"]]) await step("configure " + k, async () => {
  const c = slide.locator("article").filter({ hasText: k }).first();
  await c.getByLabel("Layout").selectOption({ label: "The standard layout" }); await page.waitForTimeout(400);
  await type("Due (days after the period ends)", d, c);
});
console.log((await slide.innerText()).replace(/\n+/g," | ").match(/The reporting calendar[\s\S]{0,400}/)?.[0]);
console.log((await page.getByRole("navigation", { name: "Create a project" }).innerText()).replace(/\n/g," | ").slice(0,330));
await browser.close();
