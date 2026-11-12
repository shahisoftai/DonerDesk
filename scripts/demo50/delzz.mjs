import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("delzz");
page.on("dialog", d => d.accept());
for (const id of ["fee3d075-90d6-4c46-b028-09e0d812852a", "f4184abd-b672-46ad-9063-4b3180606a48", "f77b562d-3379-4c5c-ae30-8b512fb0d7aa"]) {
  await page.goto(BASE + "/visuals/" + id, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(7000);
  await page.locator("summary", { hasText: /^More/ }).first().click(); await page.waitForTimeout(500);
  await page.locator("details[open]").last().getByText("Delete", { exact: true }).click(); await page.waitForTimeout(1500);
  const c = page.getByRole("button", { name: /^(Delete|Yes|Confirm)/ }); if (await c.count()) await c.last().click().catch(()=>{});
  await page.waitForTimeout(3500); console.log(id.slice(0,8), "->", new URL(page.url()).pathname);
}
await browser.close(); process.exit(0);
