import { attach, BASE } from "./lib.mjs";
const { browser, shot } = await attach("partial-inspect");
const w = await browser.contexts()[0].newPage();
await w.goto(BASE + "/projects/6654e54e-1075-46c3-a1e1-d3dfc3122376"); await w.waitForTimeout(3500);
console.log((await w.locator("main").innerText()).replace(/\n+/g," | ").slice(0,1800));
await shot("partial-project"); await w.close(); await browser.close();
