import { attach } from "./lib.mjs";
const { page, browser, step, shot } = await attach("launch-final");
const nav = page.getByRole("navigation", { name: "Create a project" });
await nav.getByRole("button",{name:/Review and launch/}).click(); await page.waitForTimeout(900);
const slide = page.locator("section[aria-roledescription='slide']");
await step("sign off", async () => { await page.getByRole("button", { name: /^Sign off$/ }).click(); await page.getByText(/You signed this off on/).waitFor({ timeout: 15000 }); });
await shot("signed-off");
await step("start the project", async () => {
  const b = page.getByRole("button", { name: "Start the project" }); console.log("start disabled:", await b.isDisabled());
  await b.click();
  await page.getByText(/The project has been started|could not|Try again/).first().waitFor({ timeout: 120000 });
});
console.log((await slide.innerText()).replace(/\n+/g," | ").slice(0,2500));
const link = page.getByRole("link", { name: "Open the project" }); console.log("open link:", await link.count() ? await link.getAttribute("href") : "none");
await shot("launched");
await browser.close();
