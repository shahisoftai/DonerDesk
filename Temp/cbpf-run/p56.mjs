import { attach } from "./lib.mjs";
const { page, browser, shot } = await attach("peek5");
const t = await page.locator("section[aria-roledescription='slide']").innerText();
console.log(t.slice(t.indexOf("Sign off")).replace(/\n+/g," | ").slice(0,1800));
console.log(await page.getByRole("link",{name:"Open the project"}).count());
await shot("after-launch"); await browser.close();
