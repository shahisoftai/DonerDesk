import { attach } from "./lib.mjs";
const { page, browser, shot } = await attach("x");
console.log((await page.getByRole("complementary", { name: "Still to answer" }).innerText().catch(()=>"(no aside)")).slice(0,1500));
await page.getByRole("complementary").first().scrollIntoViewIfNeeded().catch(()=>{});
console.log((await page.locator("section[aria-roledescription='slide']").innerText()).match(/Codes were[\s\S]{0,200}/)?.[0]);
await shot("results-state");
await browser.close();
