import { attach } from "./lib.mjs";
const { page, browser, shot } = await attach("x");
await page.evaluate(()=>scrollTo(0,0));
const nav = page.getByRole("navigation", { name: "Create a project" });
console.log((await nav.innerText()).replace(/\n/g," | "));
console.log(await nav.getByRole("button",{name:/Results/}).getAttribute("title"), await nav.getByRole("button",{name:/Results/}).getAttribute("aria-label"));
// find any element mentioning 'to answer' outside rail
console.log(await page.evaluate(()=>[...document.querySelectorAll("*")].filter(e=>e.children.length===0 && /answer/i.test(e.textContent||"")).map(e=>e.textContent.trim().slice(0,80)).slice(0,30)));
await browser.close();
