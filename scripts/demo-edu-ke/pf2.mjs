import { attach } from "../demo-ui/lib.mjs";
const T="Turkana",R="Garissa",M="Marsabit",W="Wajir",D="Mandera"; const ALL=[T,R,M,W,D];
const L=["Lokiru","Otieno","Wanjiru","Amina"];
const PLAN = [
  [L[0],[T,M],["OP1-1a","OP1-1b"]], [L[0],[R,W,D],["OP1-1a","OP1-1b"]], [L[0],[T,R],["OP1-1c","OP1-1a"]], [L[0],[M,W,D],["OP1-1c","OP1-1a"]],
  [L[2],[T,M],["OP1-2a","OP1-2b","OC1b"]], [L[2],[R,W,D],["OP1-2a","OP1-2b","OC1a"]], [L[3],ALL,["OP1-2c","OC1a"]],
  [L[1],[R,D,M],["OP2-1a","OC2a"]], [L[1],ALL,["OP2-1b","OC2b"]], [L[0],[T,R],["OP2-2a","OP2-2b","OC2a","OC2b"]], [L[1],[W,D],["OP2-2c"]],
  [L[2],[M,W],["OP3-1a","OC3a"]], [L[0],[D,W],["OP3-1b","OP3-1c"]], [L[3],[R],["OP3-2a","OP3-2b","GI-1"]], [L[2],[T],["OP3-2c","OP3-2d"]],
];
const { page, browser } = await attach("pf2");
const n = await page.evaluate(() => {
  const roots = []; const seen = new Set();
  for (const cb of document.querySelectorAll("main input[type=checkbox]")) { let r = cb; for (let k=0;k<10&&r.parentElement;k++){ r=r.parentElement; if (r.querySelectorAll("input[type=checkbox]").length>12 && r.querySelector("select")) break; } if(!seen.has(r)){seen.add(r);roots.push(r);} }
  roots.forEach((r,i)=>r.setAttribute("data-card", String(i))); return roots.length; });
console.log("cards", n);
for (let i = 0; i < Math.min(n, PLAN.length); i++) { if (process.env.ONLY && Number(process.env.ONLY) !== i) continue;
  const [lead, where, feeds] = PLAN[i]; const card = page.locator(`[data-card="${i}"]`);
  const ls = card.locator("select").last(); const lo = await ls.evaluate((e)=>[...e.options].map(o=>o.textContent.trim())); const lm = lo.find(o=>o.includes(lead)); if (lm) { await ls.selectOption({ label: lm }); await page.waitForTimeout(500); }
  const labels = card.locator("label"); const cnt = await labels.count();
  for (let k = 0; k < cnt; k++) {
    const l = labels.nth(k); const t = (await l.innerText()).trim(); const cb = l.locator("input[type=checkbox]"); if (!(await cb.count())) continue;
    const want = where.includes(t) || feeds.some((c) => t.startsWith(c + " "));
    if (want !== (await cb.isChecked())) { await cb.click(); await page.waitForTimeout(700); }
  }
  console.log(i, "done", (await card.innerText()).split("\n").slice(0,4).join(" / ").slice(0,120));
}
console.log((await page.locator("main").innerText()).match(/Indicators fed or collected: \d+ of \d+/)?.[0]);
await browser.close(); process.exit(0);
