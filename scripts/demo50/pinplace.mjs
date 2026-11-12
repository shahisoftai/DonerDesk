import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("pinplace");
for (const [name, lat, lon] of [["Jumla", "29.27", "82.18"], ["Humla", "29.97", "81.83"]]) {
  await page.goto(BASE + "/settings/places", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(5000);
  await page.getByPlaceholder("Search places").fill(name); await page.waitForTimeout(1500);
  const btn = page.getByRole("button", { name: /^(Pin|Change pin)$/ }).first(); const label = await btn.innerText(); console.log(name, "button:", label);
  await btn.click(); await page.waitForTimeout(4500);
  await page.getByLabel("Latitude").last().fill(lat); await page.getByLabel("Longitude").last().fill(lon);
  await page.getByRole("button", { name: "Set", exact: true }).click(); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Save", exact: true }).last().click(); await page.waitForTimeout(3000);
  await page.getByPlaceholder("Search places").fill(name); await page.waitForTimeout(1500);
  console.log(" ->", (await page.locator("main").innerText()).replace(/\n+/g," / ").match(/\d+ of \d+ places[^]{0,120}/)?.[0]);
}
await browser.close(); process.exit(0);
