import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("bp8"); page.setDefaultTimeout(12000);
const add = page.locator("table[aria-label^='By place']").locator("xpath=ancestor::details[1]").locator("input").last();
console.log(await add.getAttribute("aria-label"), await add.getAttribute("placeholder"));
await add.fill("Turkana County"); await add.press("Enter"); await page.waitForTimeout(1200);
console.log(await page.evaluate(() => [...document.querySelectorAll("table[aria-label^='By place'] input")].filter(i=>i.value).map(i=>i.getAttribute("aria-label")+"="+i.value)), await page.locator("table[aria-label^='By place'] tr").filter({ hasText: "Turkana County" }).count());
await browser.close(); process.exit(0);
