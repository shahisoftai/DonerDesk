import { attach } from "./lib.mjs";
const { page, browser, step, shot } = await attach("launch-retry");
const slide = page.locator("section[aria-roledescription='slide']");
const t0 = Date.now();
await step("start again", async () => {
  await page.getByRole("button", { name: "Start the project" }).click();
  await page.getByText(/The project has been started|timed out|could not|went wrong/i).first().waitFor({ timeout: 240000 });
});
console.log("elapsed s:", (Date.now()-t0)/1000);
const t = await slide.innerText(); console.log(t.slice(t.indexOf("Sign off")).replace(/\n+/g," | ").slice(0,2500));
const link = page.getByRole("link", { name: "Open the project" }); console.log("open link:", await link.count() ? await link.getAttribute("href") : "none");
await shot("launched2");
await browser.close();
