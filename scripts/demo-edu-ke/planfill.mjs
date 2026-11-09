import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("planfill");
const J="Jumla",K="Kalikot",Mu="Mugu",H="Humla",B="Bajura";
const S_="Sunita",D="Dil",A="Anita",Bk="Bikash";
const PLAN = [
  [S_, [J,K], ["OP1-1d"]], [S_, [Mu,H,B], ["OP1-1d"]],
  [D, [J], ["OP1-1a","GI-1"]], [D, [K], ["OP1-1a"]], [D, [Mu,H], ["OP1-1a"]], [D, [B], ["OP1-1a","OP1-1c"]],
  [S_, [J,K,Mu,H,B], ["OP1-1b","OP1-2a","OC1a","OC1b","OC1c"]], [S_, [K], ["OP1-2b"]], [Bk, [H], ["OP1-1c","OP3-1b","OC3a"]], [A, [J], ["OP1-2c","OP1-2d"]],
  [D, [B], ["OP2-1a","OC2a","OC2c"]], [D, [K], ["OP2-1b","OP2-1c","OP2-1d","OC2b"]], [D, [Mu], ["OP2-2a","OP2-2b"]], [S_, [J], ["OP3-1a"]],
  [A, [H], ["OP3-2a","OP3-2b"]], [D, [B], ["OP3-2b"]],
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
