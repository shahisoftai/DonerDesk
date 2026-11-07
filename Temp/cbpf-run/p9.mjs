import { attach } from "./lib.mjs";
const { page, browser, shot } = await attach("results2");
const nav = page.getByRole("navigation", { name: "Create a project" });
await nav.getByRole("button",{name:/Results framework/}).click(); await page.waitForTimeout(700);
console.log(await page.getByRole("button",{name:/Keep the/}).count(), await page.getByText(/Codes were made up/).count());
const sl = await page.locator("section[aria-roledescription='slide']").innerText();
console.log(sl.match(/Codes[\s\S]{0,200}/)?.[0]);
const k = page.getByRole("button",{name:/Keep the/}); if (await k.count()) { await k.click(); await page.waitForTimeout(800); }
console.log((await nav.innerText()).replace(/\n/g," | ").slice(0,260));
await browser.close();
