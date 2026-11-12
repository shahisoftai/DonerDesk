import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("onb-signup");
const log = (...a) => console.log(new Date().toISOString().slice(11,19), ...a);
page.on("pageerror", (e) => log("PAGEERROR", String(e).slice(0, 200)));
await page.goto(BASE + "/signup", { waitUntil: "domcontentloaded" });
await page.locator("#name").fill("ZZ Test Onboarding");
await page.locator("#email").fill(process.env.EMAIL);
await page.locator("#password").fill(process.env.PW);
await page.locator("#orgName").fill("ZZ TEST Onboarding Demo");
await page.locator("#country").fill("Kenya");
await page.screenshot({ path: process.env.S + "/01-signup.png" });
await page.locator("form button[type=submit]").click();
await page.waitForURL((u) => !/signup/.test(u.pathname), { timeout: 60000 });
log("landed", page.url());
for (const t of [1000, 3000, 6000, 10000]) {
  await page.waitForTimeout(t === 1000 ? 1000 : 2500);
  const h = await page.locator("h1").first().textContent().catch(() => null);
  const len = (await page.locator("main").innerText().catch(() => "")).length;
  log(`+${t}ms url=${new URL(page.url()).pathname} h1=${h} mainText=${len}`);
}
await page.screenshot({ path: process.env.S + "/02-after-signup.png" });
await browser.close(); process.exit(0);
