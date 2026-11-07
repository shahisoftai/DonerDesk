import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("team");
await page.reload(); await page.waitForSelector("h1");
const nav = page.getByRole("navigation", { name: "Create a project" });
console.log((await nav.innerText()).replace(/\n/g," | ").slice(0,200));
await nav.getByRole("button", { name: /Project and team/ }).click(); await page.waitForTimeout(600);
console.log("partners checked:", await page.getByRole("checkbox", { name: "There are no outside partners" }).isChecked());
console.log((await page.locator("section[aria-roledescription='slide']").innerText()).match(/Project details[\s\S]{0,40}/)?.[0]);
for (const l of ["Project name","Project code","Start date","End date","Currency (for example USD)"]) console.log(l, (await page.getByLabel(l,{exact:true}).inputValue()).slice(0,30));
// any hint text in slide with warning role
console.log(await page.locator("[role=alert],[role=status]").allInnerTexts());
await browser.close();
