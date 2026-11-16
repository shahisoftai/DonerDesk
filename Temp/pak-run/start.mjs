import { attach } from "./lib.mjs";
const { page, step, type, browser } = await attach("start");
console.log("accept:", await page.locator("#pcw-file").getAttribute("accept"));
await step("facts", async () => {
  await type("Donor", "UNICEF");
  await page.getByLabel("Main sector", { exact: true }).selectOption({ label: "Nutrition" }).catch(async()=>{ await page.getByLabel(/sector/i).first().selectOption({ label: "Nutrition" }); });
  await type("Country", "Pakistan");
});
const D="/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/Temp/pakistan-cmam-2022/";
await step("upload", async () => {
  await page.locator("#pcw-file").setInputFiles(["01-project-details.docx","02-logframe.csv","03-indicators.csv","04-workplan.csv","05-places.csv"].map(f=>D+f));
  await page.waitForTimeout(800);
});
await step("read", async () => { await page.getByRole("button", { name: "Read my documents" }).click(); await page.waitForTimeout(4000); });
console.log((await page.locator("main").innerText()).slice(0, 2500));
await browser.close();
