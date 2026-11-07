import { attach, BASE } from "./lib.mjs";
const { page, browser, shot } = await attach("check-partial");
const w = await browser.contexts()[0].newPage();
await w.goto(BASE + "/projects?q=CBPF-SOM-25"); await w.waitForTimeout(2500);
console.log((await w.locator("main").innerText()).replace(/\n+/g," | ").slice(0,900));
await shot("projects-search"); await w.close();
await browser.close();
