import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("fin2"); page.setDefaultTimeout(20000);
await page.getByRole("button", { name: "Import the rows" }).click(); await page.waitForTimeout(8000);
const t = await page.locator("main").innerText(); console.log(t.match(/[^\n]*(imported|stored|Stored|rows)[^\n]*/g)?.slice(0,4));
console.log(t.slice(t.indexOf("Where the money stands")).slice(0,600).replace(/\n+/g," | "));
console.log(t.match(/waiting for approval[^\n]*|[^\n]*DRAFT[^\n]*/gi)?.slice(0,3));
await browser.close(); process.exit(0);
