import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("seedadd");
await page.getByRole("button", { name: /^Add \d+ places$/ }).click();
await page.waitForTimeout(8000);
const card = page.getByRole("region").filter({ hasText: "Add a country's places" }).first();
const t = await card.innerText(); console.log(t.slice(t.lastIndexOf("See what would be added")).slice(0, 500));
await browser.close(); process.exit(0);
