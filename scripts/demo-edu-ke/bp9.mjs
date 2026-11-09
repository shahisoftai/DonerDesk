import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("bp9"); page.setDefaultTimeout(12000);
const det = page.locator("summary", { hasText: "By place" }).first().locator("xpath=ancestor::details[1]");
const add = det.getByLabel("Add a place", { exact: true }); console.log("add inputs", await add.count());
await add.fill("Wajir County"); await page.waitForTimeout(600); console.log("val", await add.inputValue());
await add.press("Enter"); await page.waitForTimeout(1200);
console.log(await det.locator("input").evaluateAll(a=>a.filter(i=>/Wajir/.test(i.getAttribute("aria-label")||"")).map(i=>i.getAttribute("aria-label"))));
console.log(await det.locator("button").allInnerTexts());
await browser.close(); process.exit(0);
