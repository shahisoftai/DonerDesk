import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("dmap"); page.setDefaultTimeout(15000);
if (!/dashboards\/7453/.test(page.url())) await page.goto(BASE + "/dashboards/7453e12b-f79b-439c-9f65-2f6ef791f207", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
if (!(await page.getByRole("button",{name:/^Done editing/}).count())) { await page.getByRole("button", { name: /^Edit/ }).first().click(); await page.waitForTimeout(2000); }
for (const n of (process.argv[2]||"Map").split(",")) { await page.getByRole("button", { name: n, exact: true }).first().click(); await page.waitForTimeout(3000); console.log("added", n); }
console.log((await page.locator("main").innerText()).slice(-1200));
await browser.close(); process.exit(0);
