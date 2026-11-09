import { attach } from "../demo-ui/lib.mjs";
import fs from "node:fs";
const rows = fs.readFileSync(process.env.IND, "utf8").trim().split("\n").slice(1).map((l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "")));
const { page, browser } = await attach("ind2");
const sel = page.locator("main select");
console.log("selects", await sel.count());
const o3 = await sel.nth(3).locator("option").allTextContents(); const o4 = await sel.nth(4).locator("option").allTextContents(); const o2 = await sel.nth(2).locator("option").allTextContents(); console.log(o2, o3, o4);
const lvl = (r) => r === "G" ? "Goal G" : /^OC/.test(r) ? "Outcome " + r : "Output " + r;
const LOWER = new Set(["GI-1"]);
for (const [i, r] of rows.entries()) {
  const [code, , , , , , , , res] = r;
  const opt = async (n, starts) => { const labels = await sel.nth(i * 5 + n).locator("option").allTextContents(); const l = labels.find((x) => x.startsWith(starts)); if (!l) throw new Error(code + " no option " + starts + " in " + labels); await sel.nth(i * 5 + n).selectOption({ label: l }); };
  await opt(0, lvl(res) + " ·");
  await opt(3, /^(G|OC|GI)/.test(code) ? "Dawit" : /^OP3/.test(code) ? "Tigist" : /^OP1-2/.test(code) ? "Selam" : "Abdi");
  await opt(4, LOWER.has(code) ? "Lower" : "Higher");
  console.log("filled", code);
}
await page.screenshot({ path: process.env.SHOT });
await browser.close(); process.exit(0);
