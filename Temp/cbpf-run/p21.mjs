import { attach } from "./lib.mjs";
const { page, browser, step } = await attach("workplan");
const slide = page.locator("section[aria-roledescription='slide']");
for (const key of ["Distribution", "Community-led"]) await step("feeds female participation for " + key, async () => {
  const c = slide.locator("article").filter({ has: page.locator(`input[value^="${key}"]`) }).first();
  const cb = c.getByRole("checkbox", { name: /Female participation/ }); if (!(await cb.isChecked())) { await cb.click(); await page.waitForTimeout(800); }
});
await step("participants for hygiene kits", async () => {
  for (const key of ["Distribution", "Community-led", "Emergency water", "Installation"]) {
    const c = slide.locator("article").filter({ has: page.locator(`input[value^="${key}"]`) }).first();
    const cb = c.getByRole("checkbox", { name: "Records who took part" }); if (!(await cb.isChecked())) { await cb.click(); await page.waitForTimeout(600); }
  }
});
console.log((await slide.innerText()).match(/Activities with planned work[\s\S]{0,160}/)?.[0].replace(/\n+/g," | "));
console.log((await page.getByRole("navigation", { name: "Create a project" }).innerText()).replace(/\n/g," | ").slice(0,330));
await browser.close();
