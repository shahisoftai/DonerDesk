import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("planfill");
const M = "Maiduguri", B = "Bama", Mo = "Monguno", MN = "Mubi North", MS = "Mubi South", P = "Potiskum", PW = "Project-wide";
const I = "Ibrahim", A = "Aisha", F = "Fatima";
const PLAN = [
  [I, [M], ["OP1-1a"]], [I, [B, Mo], ["OP1-1a"]], [I, [MN, MS, P], ["OP1-1a"]],
  [I, [M], ["OP1-1b", "OP1-1c"]], [I, [B], ["OP1-1b", "OP1-1c"]], [I, [Mo], ["OP1-1b", "OP1-1c"]], [I, [PW], ["OP1-1d"]],
  [I, [Mo, B], ["OP1-2a", "OP1-2b"]], [I, [MN, MS, P], ["OP1-2a", "OP1-2b"]], [I, [P], ["OP1-2c"]],
  [I, [MN, MS], ["OP2-1a"]], [I, [MN, MS], ["OP2-1b"]], [I, [P], ["OP2-2a"]], [F, [M], ["OP2-2b"]],
  [I, [B], ["OP3-1a", "OP3-1b"]], [A, [M], ["OP3-2a"]], [A, [M], ["OP3-2a"]],
];
const one = (i, PLAN) => page.evaluate(([i, PLAN]) => {
  const accepts = [...document.querySelectorAll("main button")].filter((b) => b.innerText === "Accept");
  const btn = accepts[i]; if (!btn) return "no accept " + i;
  let r = btn; for (let k = 0; k < 8 && r.parentElement; k++) { r = r.parentElement; if (r.querySelectorAll("select").length >= 2 && r.querySelectorAll("input[type=checkbox]").length > 5) break; }
  const [lead, where, feeds] = PLAN[i];
  const sels = [...r.querySelectorAll("select")]; const ledBy = sels[sels.length - 1];
  const opt = [...ledBy.options].find((o) => o.text.includes(lead));
  if (!opt) return "no opt " + i + " " + [...ledBy.options].map((o) => o.text).join(";") + " sels=" + sels.length + " cbs=" + r.querySelectorAll("input[type=checkbox]").length;
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; set.call(ledBy, opt.value); ledBy.dispatchEvent(new Event("change", { bubbles: true }));
  for (const cb of r.querySelectorAll("input[type=checkbox]")) {
    const text = cb.closest("label")?.innerText.trim() ?? "";
    const want = where.includes(text) || feeds.some((c) => text.startsWith(c + " "));
    if (want !== cb.checked) cb.click();
  }
  return "ok";
}, [i, PLAN]);
let out = [];
for (let i = 0; i < PLAN.length; i++) { out.push(i + ":" + (await one(i, PLAN))); await page.waitForTimeout(1200); }
console.log(out.join("\n"));
await browser.close(); process.exit(0);
