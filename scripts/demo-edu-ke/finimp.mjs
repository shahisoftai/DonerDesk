import { attach } from "../demo-ui/lib.mjs"; import fs from "node:fs";
const { page, browser } = await attach("finimp"); page.setDefaultTimeout(20000);
const csv = fs.readFileSync(process.env.S + "/fin-edu.csv", "utf8");
const ta = page.locator("textarea").last(); await ta.fill(csv); await page.waitForTimeout(800);
await page.getByRole("button", { name: "Check the sheet" }).click(); await page.waitForTimeout(6000);
const t = await page.locator("main").innerText(); const i = t.indexOf("Check the sheet"); console.log(t.slice(i, i+800).replace(/\n+/g," | "));
console.log(await page.evaluate(() => [...document.querySelectorAll("main button")].map(b=>b.innerText.trim()).filter(x=>/^(add|store|confirm|import|save)/i.test(x))));
await browser.close(); process.exit(0);
