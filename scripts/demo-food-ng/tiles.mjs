import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("tiles");
await page.getByRole("button", { name: "Edit", exact: true }).first().click(); await page.waitForTimeout(2500);
const fig = page.getByLabel("Figure", { exact: true }); const col = page.getByLabel("Colour", { exact: true });
for (const [w, c] of [["Activities", "Blue"], ["In progress", "Blue"], ["Done", "Green"], ["Late", "Red"]]) {
  await fig.selectOption({ label: w }); await col.selectOption({ label: c }).catch(() => console.log("colour?", c));
  await page.getByRole("button", { name: "Add the tile" }).click(); await page.waitForTimeout(2500);
}
await page.getByRole("button", { name: "Save", exact: true }).first().click(); await page.waitForTimeout(6000);
await page.screenshot({ path: process.argv[2], fullPage: true });
await browser.close(); process.exit(0);
