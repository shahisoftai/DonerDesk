import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("rec4");
await page.goto(BASE + "/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3000);
const dlg = () => page.locator("[role=dialog], aside").last();
for (const kind of ["A photo or file", "An expense"]) {
  await page.getByRole("button", { name: /^\+?\s*Record/ }).first().click(); await page.waitForTimeout(1000);
  await page.getByText("‹ Back").first().click().catch(()=>{}); await page.waitForTimeout(700);
  await dlg().getByRole("button", { name: new RegExp("^" + kind) }).click(); await page.waitForTimeout(5000);
  const t = (await dlg().innerText()).replace(/\n+/g, " / ");
  console.log("\n### " + kind + "\n" + t.slice(t.indexOf("‹ Back")).slice(0, 900));
  await page.screenshot({ path: `${S}/rec4_${kind.replace(/\W+/g,"_")}.png` });
  await page.keyboard.press("Escape"); await page.waitForTimeout(600);
}
await browser.close(); process.exit(0);
