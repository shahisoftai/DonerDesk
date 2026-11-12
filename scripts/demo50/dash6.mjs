import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("dash6");
await page.goto(BASE + "/visuals/fee3d075-90d6-4c46-b028-09e0d812852a", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(8000);
await page.getByRole("button", { name: "Filters" }).click(); await page.waitForTimeout(1500);
let t = (await page.locator("main").innerText()).replace(/\n+/g," / "); console.log("FILTERS:", t.slice(t.indexOf("Filters /"), t.indexOf("Filters /")+600));
await page.getByRole("button", { name: "Filters" }).click().catch(()=>{});
for (const s of ["Share and publish", "History", "Design check"]) {
  await page.locator("summary", { hasText: new RegExp("^"+s) }).first().click(); await page.waitForTimeout(1200);
  const d = page.locator("details[open]").last(); console.log("\n##", s, "=>", (await d.innerText()).replace(/\n+/g," / ").slice(0,700));
}
await browser.close(); process.exit(0);
