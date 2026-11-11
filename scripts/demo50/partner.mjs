import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("partner");
await page.getByLabel("Partner organization", { exact: true }).fill("Karnali Nutrition Alliance");
await page.getByRole("button", { name: "Save changes" }).click();
await page.waitForTimeout(3500);
console.log(await page.getByLabel("Partner organization", { exact: true }).inputValue(), "|", await page.getByLabel("Implementing organization", { exact: true }).inputValue());
const msg = await page.locator('[role="status"],[role="alert"]').allTextContents(); console.log(msg.join(" / ").slice(0, 300));
await browser.close(); process.exit(0);
