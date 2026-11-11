import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("viewdata");
const tile = page.locator("section", { hasText: "Meetings by province" }).first();
await tile.getByRole("button", { name: "View data" }).click();
await page.waitForTimeout(1500);
console.log((await tile.innerText()).slice(0, 600));
await browser.close(); process.exit(0);
