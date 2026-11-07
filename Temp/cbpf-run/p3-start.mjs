import { attach, BASE } from "./lib.mjs";
const { page, step, type, browser, text } = await attach("start");
await step("fill start facts", async () => {
  await type("Donor", "CBPF - Somalia Humanitarian Fund (SHF)");
  await page.getByLabel("Sector", { exact: true }).selectOption({ label: "Water, sanitation and hygiene" });
  await page.waitForTimeout(200);
  await type("Country", "Somalia");
});
await step("upload proposal", async () => {
  await page.locator("#pcw-file").setInputFiles("/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/Temp/CBPF-SOM-25-S-NGO-37159.docx");
  await page.waitForTimeout(500);
});
await step("read documents", async () => { await page.getByRole("button", { name: "Read my documents" }).click(); await page.waitForTimeout(3000); });
console.log((await page.locator("section[aria-roledescription='slide']").innerText()).slice(0, 1500));
await browser.close();
