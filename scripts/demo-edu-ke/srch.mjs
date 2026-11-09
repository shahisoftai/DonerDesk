import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("srch");
const q = page.getByPlaceholder(/search/i).first().or(page.getByLabel("Search areas")).first();
for (const n of ["Turk","Gari","Lodwar","Dadaab","Kakuma","Ijara","Lagdera","Fafi","Moyale","Saku"]) { await q.fill(n); await page.waitForTimeout(1500); console.log(n, (await page.locator("main").innerText()).split("Search areas")[1]?.slice(0,200).replace(/\n+/g," | ")); }
await page.screenshot({path:process.env.SHOT});
await browser.close(); process.exit(0);
