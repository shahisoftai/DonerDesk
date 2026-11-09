import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("repro27");
await page.goto(BASE + "/dashboards/77d17d77-86f1-4eb5-a515-71cd3edc9ed4", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
for (const t of ["TMP-A", "TMP-B"]) {
  await page.getByRole("button", { name: "Edit", exact: true }).first().click(); await page.waitForTimeout(1500);
  await page.locator("main textarea").first().fill(t); await page.getByRole("button", { name: "Add the heading" }).click(); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Save", exact: true }).first().click(); await page.waitForTimeout(6000);
  const txt = await page.locator("main").innerText(); console.log(t, /changed this dashboard|Someone else/i.test(txt) ? "CONFLICT" : "ok");
}
await browser.close(); process.exit(0);
