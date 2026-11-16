import { attach, BASE } from "./lib.mjs";
const { page, step, type, browser } = await attach("restart");
page.on("dialog", d => d.accept());
await step("new", async () => { await page.getByRole("button",{name:/Start a different project/}).click().catch(()=>page.getByText("Start a different project instead").click()); await page.waitForTimeout(3000); });
console.log(page.url());
console.log((await page.locator("main").innerText()).slice(0,500));
await browser.close();
