import { open, shot } from "./wz.mjs";
const { page, browser } = await open("wz37");
await page.getByRole("button", { name: /^10\. / }).click(); await page.waitForTimeout(2000);
await page.getByRole("button", { name: "Start the project", exact: true }).click();
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(5000);
  const t = (await page.locator("main").innerText()).replace(/\n+/g," / ");
  const j = t.search(/Starting|Creating|created|Done|Launch|project is ready|Open the project/i);
  console.log(i, new URL(page.url()).pathname.slice(0,40), "|", t.slice(Math.max(0,t.indexOf("Start the project")), t.indexOf("Start the project")+260).slice(0,260));
  if (!/projects\/new\/wizard/.test(page.url())) break;
}
await shot(page, "wz37");
await browser.close(); process.exit(0);
