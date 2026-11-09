import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("asg3");
console.log(await page.evaluate(() => { const r=document.querySelector("#assign-role").closest("div[class*=grid], form, section") ; let e=document.querySelector("#assign-role"); for(let k=0;k<4;k++) e=e.parentElement; return [...e.querySelectorAll("button")].map(b=>b.innerText.trim()+":"+b.disabled); }));
await browser.close(); process.exit(0);
