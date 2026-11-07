import { attach, BASE } from "./lib.mjs";
const { page, browser } = await attach("look");
const ids = ["df700305-61c9-4009-963f-7494713fcc15","bd2064e8-6fde-4731-91b6-88554d8b428e","198d55ee-e6f0-4735-bb59-6e6287e8f292"];
const slides = ["Results framework","Indicators","Places","Work plan","Reporting","Budget and finance"];
for (const id of ids) {
  await page.goto(`${BASE}/projects/new/wizard?id=${id}`); await page.waitForSelector("h1"); await page.waitForTimeout(1500);
  console.log(`\n=== ${id.slice(0,8)}`);
  console.log("banner:", (await page.getByTestId("pcw-limitations").innerText().catch(() => "MISSING")).slice(0, 60));
  const nav = page.getByRole("navigation", { name: "Create a project" });
  for (const s of slides) {
    await nav.getByRole("button", { name: new RegExp(s) }).click(); await page.waitForTimeout(700);
    const main = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    const at = main.indexOf(s);
    console.log(`[${s}]`, main.slice(at, at + 1100));
  }
}
await browser.close().catch(() => {});
