import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("periods");
await page.goto(BASE + process.argv[2], { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3000);
console.log((await page.evaluate(() => [...document.querySelectorAll("main a")].filter((a) => a.innerText.includes("Open workspace")).map((a) => { let c = a; for (let i = 0; i < 6; i++) { c = c.parentElement; if (/Period /.test(c.innerText)) break; } return a.getAttribute("href").split("/").pop() + " :: " + c.innerText.split("\n").filter((l) => /Period|Final|Deadline|report/i.test(l)).slice(0, 3).join(" | "); }))).join("\n"));
await browser.close(); process.exit(0);
