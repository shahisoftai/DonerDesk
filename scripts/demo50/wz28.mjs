import { open } from "./wz.mjs";
const { page, browser } = await open("wz28");
await page.getByRole("button", { name: /^6\. / }).click(); await page.waitForTimeout(2500);
const st = page.getByLabel("Starts", { exact: true }); const out=[];
for (let i=0;i<await st.count();i++) out.push([await st.nth(i).inputValue(), await page.getByLabel("Ends",{exact:true}).nth(i).inputValue(), await page.getByLabel("Led by",{exact:true}).nth(i).inputValue()].join("/"));
console.log(out.join(" | "));
const pw = page.locator("main label").filter({ hasText: "Project-wide" }); console.log("pw labels", await pw.count());
const checked = await pw.evaluateAll(l=>l.map(x=>x.querySelector("input")?.checked)); console.log(checked.join(","));
await browser.close(); process.exit(0);
