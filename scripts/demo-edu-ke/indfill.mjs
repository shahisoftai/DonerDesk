import { attach } from "../demo-ui/lib.mjs";
import fs from "node:fs";
const rows = fs.readFileSync(process.env.IND, "utf8").trim().split("\n").slice(1).map((l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "")));
const { page, browser } = await attach("indfill");
const sel = page.locator("main select"), brk = page.getByLabel("Break down by (separate with commas)");
const lvl = (r) => r === "G" ? "Goal G" : /^OC/.test(r) ? "Outcome " + r : "Output " + r;
for (const [i, r] of rows.entries()) {
  const [code, , type, , , , freq, dis, res] = r;
  const pick = async (n, label) => sel.nth(i * 5 + n).selectOption({ label });
  const opt = async (n, starts) => { const labels = await sel.nth(i * 5 + n).locator("option").allTextContents(); const l = labels.find((x) => x.startsWith(starts)); if (!l) throw new Error(code + " no option " + starts); await sel.nth(i * 5 + n).selectOption({ label: l }); };
  await opt(0, lvl(res) + " ·");
  await opt(1, type === "CURRENCY" ? "Money" : type[0] + type.slice(1).toLowerCase());
  await opt(2, freq === "Final" ? "Annual" : freq);
  await opt(3, code === "OP1-1c" ? "Fatima" : /^(G|OC|GI)/.test(code) ? "Emeka" : "Ibrahim");
  await opt(4, "Higher");
  await brk.nth(i).fill(dis); await brk.nth(i).blur();
  console.log("filled", code);
}
await page.screenshot({ path: process.env.SHOT });
await browser.close(); process.exit(0);
