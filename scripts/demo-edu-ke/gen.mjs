import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("gen");
await page.goto(`${BASE}/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/reports/${process.argv[2]}`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500);
await page.getByRole("button", { name: /^Generate report/ }).first().click(); await page.waitForTimeout(4000);
const conf = page.getByRole("button", { name: /Generate anyway|Continue|Yes|Confirm/ }); if (await conf.count()) { console.log("confirm:", await conf.first().innerText()); await conf.first().click(); }
await page.waitForTimeout(5000); console.log(page.url()); console.log((await page.locator("main").innerText()).slice(-800));
await browser.close(); process.exit(0);
