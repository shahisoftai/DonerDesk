import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("newvis");
await page.goto(BASE + "/visuals/new", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
await page.getByText("Show how a project is progressing").first().click(); await page.waitForTimeout(2500);
console.log("URL", new URL(page.url()).pathname + new URL(page.url()).search);
console.log((await page.locator("main").innerText()).replace(/\n+/g," / ").slice(0,1500));
await page.screenshot({ path: S + "/newvis.png" });
await browser.close(); process.exit(0);
