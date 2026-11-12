import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("map13");
const errs = []; page.on("console", m => { if (m.type()==="error") errs.push(m.text().slice(0,120)); }); page.on("requestfailed", r => errs.push("REQFAIL " + r.url().slice(0,100)));
await page.goto(BASE + "/visuals/maps/14d6f13d-34ee-47ef-9d64-d16595e3e690", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(11000);
for (const n of ["Where people live (population)", "Health facilities", "Settlements and towns"]) { await page.getByRole("checkbox", { name: n, exact: true }).check(); await page.waitForTimeout(3500); }
console.log("context text:", (await page.locator("main").innerText()).replace(/\n+/g," / ").match(/Context[^]{0,200}/)?.[0]);
console.log("legend/credit:", (await page.locator("main").innerText()).replace(/\n+/g," / ").match(/(WorldPop|HOT|OpenStreetMap|GRID3)[^/]*/g)?.slice(0,4));
console.log("errors:", errs.slice(0,6));
await page.screenshot({ path: S + "/map13.png" });
await page.getByRole("link", { name: "Map sources and licences" }).or(page.getByText("Map sources and licences")).first().click(); await page.waitForTimeout(3000);
console.log("SOURCES:", new URL(page.url()).pathname, (await page.locator("main").innerText()).replace(/\n+/g," / ").slice(0,500));
await browser.close(); process.exit(0);
