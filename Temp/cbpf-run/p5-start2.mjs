import { attach } from "./lib.mjs";
const { page, step, type, shot, browser } = await attach("start2");
await step("re-enter start facts", async () => {
  await type("Donor", "Somalia Humanitarian Fund (CBPF)");
  await page.getByLabel("Sector", { exact: true }).selectOption({ label: "Water, sanitation and hygiene" });
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Use Somalia as the country/ }).click();
  await page.waitForTimeout(500);
});
await page.reload(); await page.waitForSelector("h1");
console.log("after reload:", await page.getByLabel("Donor", { exact: true }).inputValue(), "|", await page.getByLabel("Sector", { exact: true }).inputValue(), "|", await page.getByLabel("Country", { exact: true }).inputValue());
await shot("start-after-reload");
await page.getByText("Your documents").first().click(); await page.waitForTimeout(500);
console.log((await page.locator("section[aria-roledescription='slide']").innerText()).split("Your documents")[1]?.slice(0,800));
await browser.close();
