import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("funding");
const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Add funding" }) }).first();
for (const [src, date, amount] of [["European Union", "2026-11-15", "250000"], ["USAID", "2026-12-01", "180000"]]) {
  await form.locator("select").first().selectOption({ label: src });
  await form.locator('input[type="date"]').fill(date);
  await form.getByLabel("Amount").fill(amount);
  await form.getByRole("button", { name: "Add funding" }).click();
  await page.waitForTimeout(3000);
}
const table = page.locator("table").first();
console.log(await table.innerText());
await browser.close(); process.exit(0);
