import { attach } from "./lib.mjs";
const { page, browser, shot } = await attach("launch-wait");
for (let i=0;i<10;i++){ const t = await page.locator("section[aria-roledescription='slide']").innerText(); if (/The project has been started/.test(t)||!/Starting…/.test(t)) { console.log("settled", i); break; } await page.waitForTimeout(10000); }
const t = await page.locator("section[aria-roledescription='slide']").innerText(); console.log(t.slice(t.indexOf("Sign off")).replace(/\n+/g," | ").slice(0,2500));
const link = page.getByRole("link", { name: "Open the project" }); console.log("open link:", await link.count() ? await link.getAttribute("href") : "none");
await shot("launched3"); await browser.close();
