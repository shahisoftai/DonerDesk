import { attach } from "../demo-ui/lib.mjs";
const G="Gode",M="Mustahil",K="Kebri Dahar",W="Warder",D="Dolo Ado";
const L=["Abdi","Dawit","Tigist","Selam"];
const PLAN = [
  [L[0],[G,M],["OP1-1a","OP1-1b"]], [L[0],[K,W],["OP1-1a","OP1-1b"]], [L[2],[D],["OP1-1c","OP1-1b"]],
  [L[1],[G,M],["OP1-2a","OP1-2b"]], [L[1],[K,W,D],["OP1-2a","OP1-2b","OC1b"]], [L[2],[M],["OP1-2c","OC1a"]],
  [L[0],[G,D],["OP2-1a","OP2-1c"]], [L[0],[K,W,M],["OP2-1a","OC2a"]], [L[2],[G,M,K,W,D],["OP2-1b","OC2b"]], [L[2],[K],["OP2-2a"]],
  [L[0],[G,M],["OP3-1a","OP3-1b","OP3-1c","OC3a"]], [L[0],[K,W,D],["OP3-1a","OP3-1c"]], [L[3],[D],["OP3-1d","OP3-1e"]], [L[1],[K],["OP3-2a","OP3-2b","GI-1"]],
];
const { page, browser } = await attach("pf2");
const n = await page.evaluate(() => {
  const roots = []; const seen = new Set();
  for (const cb of document.querySelectorAll("main input[type=checkbox]")) { let r = cb; for (let k=0;k<10&&r.parentElement;k++){ r=r.parentElement; if (r.querySelectorAll("input[type=checkbox]").length>12 && r.querySelector("select")) break; } if(!seen.has(r)){seen.add(r);roots.push(r);} }
  roots.forEach((r,i)=>r.setAttribute("data-card", String(i))); return roots.length; });
console.log("cards", n);
for (let i = 0; i < Math.min(n, PLAN.length); i++) {
  const [lead, where, feeds] = PLAN[i]; const card = page.locator(`[data-card="${i}"]`);
  const ls = card.locator("select").last(); const lo = await ls.evaluate((e)=>[...e.options].map(o=>o.textContent.trim())); const lm = lo.find(o=>o.includes(lead)); if (lm) { await ls.selectOption({ label: lm }); await page.waitForTimeout(500); }
  const labels = card.locator("label"); const cnt = await labels.count();
  for (let k = 0; k < cnt; k++) {
    const l = labels.nth(k); const t = (await l.innerText()).trim(); const cb = l.locator("input[type=checkbox]"); if (!(await cb.count())) continue;
    const want = where.includes(t) || feeds.some((c) => t.startsWith(c + " "));
    if (want !== (await cb.isChecked())) { await cb.click(); await page.waitForTimeout(700); }
  }
  console.log(i, "done");
}
console.log((await page.locator("main").innerText()).match(/Indicators fed or collected: \d+ of \d+/)?.[0]);
await browser.close(); process.exit(0);
