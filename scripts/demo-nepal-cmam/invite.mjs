import { attach, BASE, dump } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("invite");
await page.goto(`${BASE}/team`); await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: "Invite member" }).click(); await page.waitForTimeout(800);
console.log((await dump(page)).filter(l=>/input|select|textarea/.test(l) && !/Search/.test(l)).join("\n"));
const [email, name, role] = process.argv.slice(2);
if (email) {
  const dlg = page.locator("[role=dialog], form").last();
  await page.getByLabel(/email/i).last().fill(email);
  
  await page.getByLabel("Role", { exact: true }).first().selectOption({ label: role });
  await page.getByRole("button", { name: /Send invitation|Invite|Send/ }).last().click(); await page.waitForTimeout(3000);
  console.log((await page.locator("body").innerText()).replace(/\n+/g," | ").slice(0,1500));
}
await browser.close(); process.exit(0);
