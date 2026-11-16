import { attach } from "./lib.mjs";
const { page, step, type, browser } = await attach("start2");
const slide = page.locator("section[aria-roledescription='slide']");
await step("facts", async () => {
  await type("Donor", "UNICEF"); await type("Country", "Pakistan");
  await slide.locator("select").first().selectOption({ label: "Nutrition" }); await page.waitForTimeout(1500);
  await page.getByLabel("Donor wording for the results framework").selectOption({ label: "United Nations (Results Framework)" }); await page.waitForTimeout(1000);
});
const D="/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/Temp/pakistan-cmam-2022/";
await step("upload", async () => { await page.locator("#pcw-file").setInputFiles(["01-project-details.docx","02-logframe.csv","03-indicators.csv","04-workplan.csv","05-places.csv"].map(f=>D+f)); await page.waitForTimeout(800); });
await step("read", async () => { await page.getByRole("button", { name: "Read my documents" }).click(); await page.waitForTimeout(5000); });
await browser.close();
