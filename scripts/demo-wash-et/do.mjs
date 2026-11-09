// usage: node do.mjs out.png "click:Button text" "fill:Label=value" "wait:ms" ...  then dumps the slide text
import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("do");
const [out, ...acts] = process.argv.slice(2);
for (const a of acts) {
  const i = a.indexOf(":"); const k = a.slice(0, i), v = a.slice(i + 1);
  try {
    if (k === "click") await page.getByRole("button", { name: v, exact: true }).first().click({ timeout: 8000 });
    else if (k === "clicktext") await page.getByText(v, { exact: true }).first().click({ timeout: 8000 });
    else if (k === "fill") { const [l, val] = v.split("=="); await page.getByLabel(l, { exact: true }).first().fill(val); await page.keyboard.press("Tab"); }
    else if (k === "select") { const [l, val] = v.split("=="); await page.getByLabel(l, { exact: true }).first().selectOption({ label: val }); }
    else if (k === "check") await page.getByLabel(v).first().check({ timeout: 8000 });
    else if (k === "nav") await page.getByRole("button", { name: new RegExp("^" + v + "\\. ") }).first().click({ timeout: 8000 });
    else if (k === "wait") await page.waitForTimeout(Number(v));
  } catch (e) { console.log("FAILED", a, String(e).split("\n")[0]); }
  await page.waitForTimeout(700);
}
await page.screenshot({ path: out, fullPage: false });
const t = await page.locator("main").innerText();
console.log(t.split(/Start a different project instead/)[1]?.slice(0, 3500) ?? t.slice(0, 3000));
await browser.close(); process.exit(0);
