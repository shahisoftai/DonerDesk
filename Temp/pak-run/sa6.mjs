import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("sa6");
const card = page.locator("text=Openai · All tenants").locator("xpath=ancestor::*[.//button[contains(.,'Edit / rotate keys')]][1]");
await card.getByRole("button",{name:"Edit / rotate keys"}).click(); await page.waitForTimeout(2000);
const f = await page.locator("input, select, textarea").evaluateAll(e=>e.map(x=>(x.getAttribute("aria-label")||x.name||x.placeholder)+"="+(x.type==="password"?"(secret)":x.value)));
console.log(f.join("\n")); await shot("sa6");
await browser.close();
