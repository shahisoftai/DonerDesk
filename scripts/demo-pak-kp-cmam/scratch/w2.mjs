import { attach } from "../lib.mjs";
const { page, step, type, browser } = await attach("w2");
const D=new URL("../inputs/", import.meta.url).pathname;
await step("facts", async () => {
  await type("Donor", "UNICEF");
  await page.getByLabel("Main sector", { exact: true }).selectOption({ label: "Nutrition" });
  await type("Country", "Pakistan");
});
await step("upload", async () => {
  await page.locator("#pcw-file").setInputFiles(["PAK-KP-Proposal.docx"].concat(["logframe.csv","indicators.csv","workplan.csv","places.csv"]).map(f=>D+f));
  await page.waitForTimeout(800);
});
await step("read", async () => { await page.getByRole("button", { name: "Read my documents" }).click(); await page.waitForTimeout(5000); });
console.log((await page.locator("main").innerText()).slice(0,1500));
await browser.close();
