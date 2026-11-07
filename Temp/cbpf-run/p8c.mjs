import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("team");
const c = page.getByRole("checkbox", { name: "There are no outside partners" });
await c.click(); const t0=Date.now();
for (let i=0;i<10;i++){ await page.waitForTimeout(300); console.log(Date.now()-t0, await c.isChecked()); }
console.log((await page.getByRole("navigation", { name: "Create a project" }).innerText()).replace(/\n/g," | ").slice(0,160));
await shot("team-final");
await browser.close();
