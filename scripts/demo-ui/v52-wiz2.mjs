import { attach, BASE } from "./lib.mjs";
const { page } = await attach("v52-wiz2");
const S = process.env.OUT;
const errors = []; page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const open = async () => {
  await page.goto(`${BASE}/projects/new/wizard?id=${process.env.D}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^3\. Results framework/ }).click();
  await page.waitForTimeout(1500);
};
await open();
const fill = async (n) => {
  await page.getByText("Logic (optional)").nth(n).click();
  const why = page.getByLabel(/Why this leads/).nth(n);
  await why.fill(`Reaching aim ${n + 1} moves the overall aim forward`);
  await why.blur();
  await page.waitForTimeout(2500);
};
await fill(0); await fill(1);
await open();
await page.getByText("Logic (optional)").first().click();
console.log("rationale saved after reload:", await page.getByLabel(/Why this leads/).first().inputValue());
const t = await page.evaluate(() => document.body.innerText);
console.log("advice after both reasoned:", /Optional: say why these lead/.test(t) ? "still shown" : "gone");
await page.screenshot({ path: `${S}/23-wiz-logic.png`, fullPage: true });
console.log("errors:", errors.length ? errors : "none");
process.exit(0);
