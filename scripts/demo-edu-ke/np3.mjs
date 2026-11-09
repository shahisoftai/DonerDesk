import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("np3");
console.log(await page.getByRole("button").allInnerTexts().then(a=>a.filter(x=>/creat|save|add/i.test(x))));
await page.getByRole("button", { name: /^Create/ }).last().click(); await page.waitForTimeout(6000); console.log(page.url());
console.log((await page.locator("main").innerText()).match(/Apr[^\n]*/g)?.slice(0,4));
await browser.close(); process.exit(0);
