import { attach, BASE } from "./lib.mjs";
const { page } = await attach("v52-signoff");
const T = process.env.T, S = process.env.OUT;
const errors = []; page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const text = () => page.evaluate(() => document.body.innerText);
// Move output 1.1 under OC1 with the product's own control.
await page.goto(`${BASE}/projects/${T}/logframe`, { waitUntil: "networkidle" });
const outRow = page.locator("li[role=treeitem]").filter({ hasText: "Water points rehabilitated" }).first();
const moveSel = outRow.locator("select").first();
const target = await moveSel.evaluate((s) => [...s.options].find((o) => /OC1/.test(o.textContent))?.value);
await moveSel.selectOption(target);
await page.waitForTimeout(3000);
await page.reload({ waitUntil: "networkidle" });
console.log("moved under OC1:", /Move to: Intermediate Result OC1/.test(await text()) ? "yes" : "NO");
// Sign off.
await page.goto(`${BASE}/projects/${T}/logframe/history`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /sign off the framework/i }).click();
await page.waitForTimeout(3000);
await page.reload({ waitUntil: "networkidle" });
console.log("signed off:", /Signed off/.test(await text()) ? "yes" : "NO");
// Indicator page: find it.
await page.goto(`${BASE}/projects/${T}/logframe`, { waitUntil: "networkidle" });
await page.getByRole("link", { name: "Water points functioning" }).click();
await page.waitForURL(/indicators\//);
const indUrl = page.url();
// a) Code change after sign-off is refused.
await page.fill("#manage-code", "IND-9");
await page.getByRole("button", { name: /save changes/i }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${S}/17-code-locked.png`, fullPage: true });
const t1 = await text();
console.log("code change refused:", /code of an indicator in an approved framework does not change/i.test(t1) ? "yes" : "NO", "| reason box shown:", /Why are you changing this/.test(t1) ? "yes" : "NO");
// b) Target change on an indicator no approved report used: allowed without a reason.
await page.goto(indUrl, { waitUntil: "networkidle" });
await page.fill("#manage-target", "25");
await page.getByRole("button", { name: /save changes/i }).click();
await page.waitForTimeout(2500);
console.log("target change allowed:", /Saved\./.test(await text()) ? "yes" : "NO");
await page.goto(`${BASE}/projects/${T}/logframe/history`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${S}/18-history-after.png`, fullPage: true });
const t2 = await text();
console.log("history after:", /target changed from 20 to 25/.test(t2) ? "target change recorded" : "NO target change", "|", /Since the last sign-off/.test(t2) ? "pending summary shown" : "no pending summary");
console.log("errors:", errors.length ? errors : "none");
process.exit(0);
