import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("ovl");
await page.goto(BASE + "/visuals/maps/14d6f13d-34ee-47ef-9d64-d16595e3e690", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(11000);
const f = page.locator("main input[type=file]").first(); console.log("accept:", await f.getAttribute("accept"));
await f.setInputFiles(S + "/zz-bhutan.geojson"); await page.waitForTimeout(3500);
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); const i = t.indexOf("Overlays"); console.log("OVERLAY:", t.slice(i, i+700));
console.log("btns:", (await page.locator("main button:visible").allInnerTexts()).filter(s=>/Keep|Remove|Save|Clear/i.test(s)));
await browser.close(); process.exit(0);
