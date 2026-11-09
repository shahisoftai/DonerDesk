import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("flg2"); page.setDefaultTimeout(15000);
const b = page.getByRole("button", { name: "This matches a verified indicator" });
let n = 0; while (await b.count() && n < 30) { await b.first().click(); await page.waitForTimeout(3000); n++; }
console.log("clicked", n);
const t = await page.locator("body").innerText(); console.log(t.match(/\d+ of \d+ statements need your decision|\d+ flagged statements?|Review \d+ flagged[^\n]*/g));
await browser.close(); process.exit(0);
