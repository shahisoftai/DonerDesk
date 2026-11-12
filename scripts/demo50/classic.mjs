import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("classic");
await page.goto(BASE + "/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/reports/b31e987c-08db-4c41-af79-8ac33d39945e", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
await page.getByRole("button", { name: /More actions/ }).click(); await page.waitForTimeout(500);
await page.getByText("Switch to classic view").click(); await page.waitForTimeout(4000);
console.log((await page.locator("main").innerText()).replace(/\n+/g," / ").slice(700,2800));
await page.screenshot({ path: S + "/classic.png" });
// restore default
await page.getByRole("button", { name: /More actions/ }).click().catch(()=>{}); await page.waitForTimeout(500);
console.log("MENU2:", await page.locator("[role=menu]").innerText().then(t=>t.replace(/\n+/g," | ")).catch(()=>"none"));
await browser.close(); process.exit(0);
