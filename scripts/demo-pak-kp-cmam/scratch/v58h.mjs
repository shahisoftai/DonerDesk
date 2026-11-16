import { attach } from "../lib.mjs";
const { page, browser } = await attach("v58h");
const r = await page.evaluate(async () => { const srcs = [...document.querySelectorAll("script[src]")].map(s => s.src); const hits = []; for (const s of srcs) { const t = await (await fetch(s)).text(); if (t.includes("Repeats every month")) hits.push(s.split("/").pop()); } return [srcs.length, hits]; });
console.log(r);
await browser.close();
