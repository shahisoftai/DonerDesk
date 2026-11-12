import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("rec5");
for (const kind of ["A photo or file", "An expense"]) {
  await page.goto(BASE + "/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3000);
  await page.getByRole("button", { name: /^\+?\s*Record/ }).first().click(); await page.waitForTimeout(1000);
  await page.getByText("‹ Back").first().click().catch(()=>{}); await page.waitForTimeout(700);
  const dlg = page.locator("[role=dialog], aside").last();
  await dlg.getByRole("button", { name: new RegExp("^" + kind) }).click(); await page.waitForTimeout(1200);
  await dlg.getByText(kind, { exact: true }).last().click(); await page.waitForTimeout(3500);
  console.log(kind, "=>", new URL(page.url()).pathname.replace(/[0-9a-f-]{36}/g,":id"));
}
await browser.close(); process.exit(0);
