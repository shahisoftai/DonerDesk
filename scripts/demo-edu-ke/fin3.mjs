import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("fin3"); page.setDefaultTimeout(15000);
const b = page.getByRole("button", { name: /^Approve/ }); console.log("approve buttons", await b.count(), await b.allInnerTexts().then(a=>a.slice(0,3)));
let n = 0; while (await b.count() && n < 40) { await b.first().click(); await page.waitForTimeout(1800); n++; }
const t = await page.locator("main").innerText(); console.log(n, t.slice(t.indexOf("Where the money stands")).slice(0,520).replace(/\n+/g," | "));
await browser.close(); process.exit(0);
