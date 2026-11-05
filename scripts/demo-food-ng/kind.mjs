import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("kind");
const [idx, label] = process.argv.slice(2);
await page.getByRole("combobox", { name: "Read as" }).nth(Number(idx)).selectOption({ label });
await page.waitForTimeout(60000);
await page.screenshot({ path: process.env.SHOT });
console.log((await page.locator("main").innerText()).slice(0, 1500));
await browser.close(); process.exit(0);
