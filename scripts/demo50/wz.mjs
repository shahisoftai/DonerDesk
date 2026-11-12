import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
export const open = async (name) => { const c = await attach(name); await c.page.goto(BASE + "/projects/new/wizard?id=b0128b13-567c-446f-b0ef-1d6a0303aa98", { waitUntil: "domcontentloaded" }); await c.page.waitForTimeout(4500); return c; };
export const todo = async (page) => (await page.locator("main").innerText()).match(/Still to answer \((\d+)\)[\s\S]{0,900}/)?.[0].replace(/\n+/g," / ").slice(0,900);
export const tabs = async (page) => (await page.getByRole("button", { name: /^\d+\. / }).allInnerTexts()).map(s=>s.replace(/\n/g," ")).join(" | ");
export const shot = (page, n) => page.screenshot({ path: `${S}/${n}.png` });
if (process.argv[1].endsWith("wz.mjs")) {
  const { page, browser } = await open("wz1");
  const sel = page.locator("main select").first();
  console.log("selects:", await page.locator("main select").evaluateAll(s=>s.map(x=>[x.name||x.id||x.getAttribute("aria-label"), [...x.options].slice(0,6).map(o=>o.text)])));
  console.log("inputs:", await page.locator("main input[type=text], main input:not([type])").evaluateAll(s=>s.map(x=>[x.name||x.id, x.placeholder, x.getAttribute("aria-label"), x.value])));
  console.log(await tabs(page));
  await shot(page, "wz1");
  await browser.close(); process.exit(0);
}
