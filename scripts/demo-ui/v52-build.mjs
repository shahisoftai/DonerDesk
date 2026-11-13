import { attach, BASE } from "./lib.mjs";
const { page } = await attach("v52-build");
const T = process.env.T, S = process.env.OUT;
const errors = []; page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const addItem = async ({ level, code, title, parent, rationale, assumptions }) => {
  await page.goto(`${BASE}/projects/${T}/logframe/new`, { waitUntil: "networkidle" });
  await page.selectOption("#level", level);
  await page.fill("#code", code);
  if (parent) await page.selectOption("#parentId", { label: new RegExp(parent).source ? undefined : parent }).catch(async () => {
    const value = await page.$eval("#parentId", (s, p) => [...s.options].find((o) => o.textContent.includes(p))?.value, parent);
    await page.selectOption("#parentId", value);
  });
  await page.fill("#title", title);
  if (rationale || assumptions) {
    await page.getByText("Logic (optional)").click();
    if (rationale) await page.fill("#rationale", rationale);
    if (assumptions) await page.fill("#assumptions", assumptions);
  }
  await page.screenshot({ path: `${S}/10-new-${code}.png`, fullPage: true });
  await page.getByRole("button", { name: /save item/i }).click();
  await page.waitForURL((u) => /\/logframe$/.test(u.pathname), { timeout: 30000 });
  console.log("added", level, code);
};
await addItem({ level: "OUTCOME", code: "OC1", title: "Households use safe drinking water", rationale: "Safe water lowers diarrhoeal disease in children", assumptions: "Water sources are not contaminated by flooding" });
await addItem({ level: "OUTPUT", code: "1.1", title: "Water points rehabilitated", parent: "OC1" });
await page.goto(`${BASE}/projects/${T}/logframe/new-indicator`, { waitUntil: "networkidle" });
const opt = await page.$eval("#logframeItemId", (s) => [...s.options].find((o) => o.textContent.includes("1.1"))?.value);
await page.selectOption("#logframeItemId", opt);
await page.fill("#code", "IND-1"); await page.fill("#name", "Water points functioning");
await page.fill("#baseline", "0"); await page.fill("#target", "20"); await page.fill("#unit", "points");
await page.getByRole("button", { name: /save|add indicator|create/i }).last().click();
await page.waitForTimeout(3000);
console.log("after indicator:", page.url().replace(BASE, ""));
await page.goto(`${BASE}/projects/${T}/logframe`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${S}/11-tree.png`, fullPage: true });
const text = await page.evaluate(() => document.body.innerText);
for (const p of ["Why: Safe water lowers", "Assumes: Water sources", "IND-1|1 indicator"]) console.log(" ", p, new RegExp(p).test(text) ? "yes" : "NO");
console.log("errors:", errors.length ? errors : "none");
process.exit(0);
