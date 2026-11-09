import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("lst"); page.setDefaultTimeout(10000);
await page.getByRole("button", { name: "List", exact: true }).first().click().catch(()=>page.getByText("List",{exact:true}).first().click()); await page.waitForTimeout(2500);
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Mine")).slice(0,2600));
await browser.close(); process.exit(0);
