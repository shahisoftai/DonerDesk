import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("retire"); page.setDefaultTimeout(15000);
for (const n of ["Garissa Town","Mandera Town","Marsabit Town","Wajir Town"]) {
  const r = await page.evaluate((n) => { const li=[...document.querySelectorAll("main tr, main li")].find(e=>e.innerText.trim().startsWith(n)); if(!li) return "nf"; li.setAttribute("data-retire","1"); return "ok"; }, n);
  if (r==="ok") { await page.locator("[data-retire='1'] button", { hasText: "Retire" }).first().click(); await page.waitForTimeout(2500);
    const c = page.getByRole("button", { name: /^(Retire|Confirm|Yes)/ }); console.log(n, await c.count()); await page.evaluate(()=>document.querySelectorAll("[data-retire]").forEach(e=>e.removeAttribute("data-retire"))); } else console.log(n, r);
}
await browser.close(); process.exit(0);
