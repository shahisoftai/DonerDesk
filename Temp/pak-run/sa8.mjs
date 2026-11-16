import { attach } from "./lib.mjs";
const { page, browser } = await attach("sa8");
const p = await page.context().newPage();
await p.goto("https://sa.donordesk.online"); await p.waitForTimeout(2500);
await p.getByText("AI & LLM").first().click().catch(()=>{}); await p.waitForTimeout(2500);
const t = await p.locator("main").innerText(); console.log(t.slice(t.indexOf("Openai")-30, t.indexOf("Openai")+300) || t.slice(0,300));
await p.close(); await browser.close();
