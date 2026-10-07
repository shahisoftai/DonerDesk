import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = per[Number(process.argv[2])]; const { page, browser } = await attach("conf");
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: /Report checks/ }).click(); await page.waitForTimeout(1500);
await page.getByText("Review confidentiality").first().click(); await page.waitForTimeout(3000);
console.log(page.url()); const t = await page.locator("body").innerText(); console.log(t.slice(t.indexOf("OUTLINE")+0).split("Statements").slice(-1)[0].replace(/\n+/g," | ").slice(0,1800));
console.log((await dump(page)).filter(l=>/button/.test(l)&&!/^a /.test(l)&&/(Leave out|Keep|Authori|Exclude|confiden|Sensitive)/i.test(l)).slice(0,8).join("\n"));
await browser.close(); process.exit(0);
