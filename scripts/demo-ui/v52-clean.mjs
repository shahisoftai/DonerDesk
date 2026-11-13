import { attach, BASE } from "./lib.mjs";
const { page } = await attach("v52-clean");
page.on("dialog", (d) => d.accept());
// Archive the throwaway project.
await page.goto(`${BASE}/projects/71029820-042e-41e7-83c0-d91b9f451c1d/settings`, { waitUntil: "networkidle" });
const btns = await page.$$eval("main button", (b) => b.filter((e) => e.offsetParent).map((e) => e.textContent.trim()).filter(Boolean));
console.log("settings buttons:", btns.join(" | "));
const arch = page.getByRole("button", { name: /^archive/i }).first();
if (await arch.count()) {
  await arch.click(); await page.waitForTimeout(1200);
  const confirm = page.getByRole("button", { name: /archive|confirm|yes/i }).last();
  if (await confirm.count()) await confirm.click();
  await page.waitForTimeout(3000);
  console.log("after archive:", page.url().replace(BASE, ""), /archived/i.test(await page.evaluate(() => document.body.innerText)) ? "(archived shown)" : "");
}
// Discard the wizard draft.
await page.goto(`${BASE}/projects/new/wizard?id=cff39ad8-7b12-4231-894b-901649837870`, { waitUntil: "networkidle" });
const other = page.getByText(/start a different project instead/i).first();
if (await other.count()) {
  await other.click(); await page.waitForTimeout(1500);
  const b2 = await page.$$eval("button", (b) => b.filter((e) => e.offsetParent).map((e) => e.textContent.trim()).filter((t) => /discard|delete|start/i.test(t)));
  console.log("draft buttons:", b2.join(" | "));
  const discard = page.getByRole("button", { name: /discard|delete this|remove/i }).first();
  if (await discard.count()) { await discard.click(); await page.waitForTimeout(2500); console.log("draft discarded:", page.url().replace(BASE, "")); }
}
process.exit(0);
