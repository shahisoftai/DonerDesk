import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("evrow");
console.log(await page.evaluate(() => { const r=document.querySelector("main table tbody tr"); return r? r.outerHTML.replace(/class="[^"]*"/g,"").replace(/<option[^>]*>/g,"<o>").replace(/<\/option>/g,"").slice(0,2500):"no row"; }));
await browser.close(); process.exit(0);
