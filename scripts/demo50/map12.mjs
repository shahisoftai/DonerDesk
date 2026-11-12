import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("map12");
await page.goto(BASE + "/visuals/maps/14d6f13d-34ee-47ef-9d64-d16595e3e690", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(12000);
await page.getByText("Karnali", { exact: true }).first().click(); await page.waitForTimeout(4000);
await page.getByRole("button", { name: "Open its districts" }).click(); await page.waitForTimeout(8000);
let t = (await page.locator("main").innerText()).replace(/\n+/g," / ");
console.log("Analyse present:", t.includes("Analyse"), "| breadcrumb:", t.match(/World ›[^/]*/)?.[0]);
const a = page.locator("section", { has: page.getByText("Analyse", { exact: true }) }).first();
if (await a.count()) {
  await a.scrollIntoViewIfNeeded(); console.log("PANEL:", (await a.innerText()).replace(/\n+/g," / "));
  await a.getByRole("button", { name: /Draw rings/ }).click(); await page.waitForTimeout(6000);
  console.log("AFTER RINGS:", (await a.innerText()).replace(/\n+/g," / ").slice(0,900));
}
await page.screenshot({ path: S + "/map12.png" });
await browser.close(); process.exit(0);
