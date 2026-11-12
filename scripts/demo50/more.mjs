import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("more");
await page.goto(BASE + "/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/reports/b31e987c-08db-4c41-af79-8ac33d39945e", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4500);
console.log("PAGE:", (await page.locator("main").innerText()).replace(/\n+/g," / ").slice(0,1800));
await page.getByRole("button", { name: /More actions/ }).click(); await page.waitForTimeout(800);
console.log("MENU:", (await page.locator("[role=menu]").innerText()).replace(/\n+/g," | "));
await browser.close(); process.exit(0);
