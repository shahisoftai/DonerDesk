import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("delzz2");
page.on("dialog", d => d.accept());
for (const id of ["f4184abd-b672-46ad-9063-4b3180606a48", "f77b562d-3379-4c5c-ae30-8b512fb0d7aa"]) {
  await page.goto(BASE + "/visuals/" + id, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(8000);
  await page.locator("summary", { hasText: /^More/ }).first().click(); await page.waitForTimeout(800);
  const m = await page.locator("summary:has-text('More')").first().locator("xpath=..").innerText(); console.log(id.slice(0,8), "MENU:", m.replace(/\n+/g," | ").slice(0,400));
  const del = page.locator("summary:has-text('More')").first().locator("xpath=..").getByText("Delete", { exact: true });
  if (await del.count()) { await del.click(); await page.waitForTimeout(1500); const c = page.getByRole("button", { name: /^(Delete|Yes|Confirm)/ }); if (await c.count()) await c.last().click().catch(()=>{}); await page.waitForTimeout(3500); }
  console.log(" ->", new URL(page.url()).pathname);
}
await browser.close(); process.exit(0);
