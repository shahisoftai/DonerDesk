import { attach } from "./lib.mjs";
const { page, step, shot, browser } = await attach("s1b");
const slide = page.locator("section[aria-roledescription='slide']");
await step("sector", async () => { await slide.locator("select").first().selectOption({ label: "Nutrition" }); await page.waitForTimeout(1500); });
await step("wording", async () => { await page.locator("#_r_o_").selectOption({ index: 5 }).catch(()=>{}); await page.waitForTimeout(1000); });
const t = await slide.innerText();
const i = t.indexOf("Your documents"); console.log(t.slice(i, i+1500));
await shot("s1b");
await browser.close();
