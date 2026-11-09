import { attach } from "../demo-ui/lib.mjs";
const J="Jumla",K="Kalikot",Mu="Mugu",H="Humla",B="Bajura";
const PLAN = [
  [[J,K], ["OP1-1d"]], [[Mu,H,B], ["OP1-1d"]],
  [[J], ["OP1-1a","GI-1"]], [[K], ["OP1-1a"]], [[Mu,H], ["OP1-1a"]], [[B], ["OP1-1a","OP1-1c"]],
  [[J,K,Mu,H,B], ["OP1-1b","OP1-2a","OC1a","OC1b","OC1c"]], [[K], ["OP1-2b"]], [[H], ["OP1-1c","OP3-1b","OC3a"]], [[J], ["OP1-2c","OP1-2d"]],
  [[B], ["OP2-1a","OC2a","OC2c"]], [[K], ["OP2-1b","OP2-1c","OP2-1d","OC2b"]], [[Mu], ["OP2-2a","OP2-2b"]], [[J], ["OP3-1a"]],
  [[H], ["OP3-2a","OP3-2b"]], [[B], ["OP3-2b"]],
];
const { page, browser } = await attach("pf2");
const n = await page.evaluate(() => {
  const roots = []; const seen = new Set();
  for (const cb of document.querySelectorAll("main input[type=checkbox]")) { let r = cb; for (let k=0;k<10&&r.parentElement;k++){ r=r.parentElement; if (r.querySelectorAll("input[type=checkbox]").length>12 && r.querySelector("select")) break; } if(!seen.has(r)){seen.add(r);roots.push(r);} }
  roots.forEach((r,i)=>r.setAttribute("data-card", String(i))); return roots.length; });
console.log("cards", n);
for (let i = 0; i < Math.min(n, PLAN.length); i++) {
  const [where, feeds] = PLAN[i]; const card = page.locator(`[data-card="${i}"]`);
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
