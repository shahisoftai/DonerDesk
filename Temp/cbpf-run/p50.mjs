import { attach } from "./lib.mjs";
const { page, browser, shot } = await attach("peek2");
console.log(page.url());
const nav = page.getByRole("navigation", { name: "Create a project" });
await nav.getByRole("button",{name:/Start/}).click(); await page.waitForTimeout(800);
console.log((await page.locator("section[aria-roledescription='slide']").innerText()).replace(/\n+/g," | ").slice(0,900));
console.log("donor:", await page.getByLabel("Donor",{exact:true}).inputValue());
await shot("start-state"); await browser.close();
