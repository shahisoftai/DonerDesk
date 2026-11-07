import { attach } from "./lib.mjs";
const { page, browser } = await attach("x");
console.log((await page.getByRole("navigation", { name: "Create a project" }).innerText()).replace(/\n/g, " | "));
const sels = await page.locator("section[aria-roledescription='slide'] select").all();
for (const s of sels) console.log(await s.evaluate(e => e.selectedOptions[0]?.textContent));
await browser.close();
