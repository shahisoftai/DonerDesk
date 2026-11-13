import { attach, BASE } from "./lib.mjs";
const { page } = await attach("v52-wiz3");
const S = process.env.OUT;
const errors = []; page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
await page.goto(`${BASE}/projects/new/wizard?id=${process.env.D}`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^3\. Results framework/ }).click();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /choose from the library/i }).click();
await page.waitForTimeout(2500);
const wash = page.getByLabel(/water, sanitation/i).first();
if (await wash.count()) await wash.check(); else console.log("no WASH sector checkbox");
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /add the suggested results/i }).click();
await page.waitForTimeout(4000);
const t = await page.evaluate(() => document.body.innerText);
console.log("message:", (t.match(/Suggested results added: \d+/) ?? ["none"])[0]);
// Close the picker if it is a dialog.
await page.keyboard.press("Escape");
await page.waitForTimeout(800);
const n = await page.getByText("Logic (optional)").count();
let found = "";
for (let i = 0; i < n && !found; i += 1) {
  await page.getByText("Logic (optional)").nth(i).click();
  const v = await page.getByLabel(/^Assumptions/).nth(i).inputValue().catch(() => "");
  if (/must|stay|available|not contaminated|accepted|maintained/i.test(v)) found = v;
}
console.log("logic rows:", n, "| a library assumption reached a row:", found ? `yes: "${found.slice(0, 90)}"` : "NO");
await page.screenshot({ path: `${S}/24-wiz-library.png`, fullPage: true });
console.log("errors:", errors.length ? errors : "none");
process.exit(0);
