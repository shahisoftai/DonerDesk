import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid3.txt", "utf8").trim(); const { page, browser } = await attach();
console.log((await dump(page)).filter(l=>/button|textarea/.test(l)).join("\n"));
const b = page.getByRole("button", { name: /create|import/i }).last(); console.log("click", await b.innerText()); await b.click(); await page.waitForTimeout(6000);
console.log((await page.locator("main").innerText()).slice(300, 2600));
await browser.close(); process.exit(0);
