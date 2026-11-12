import { chromium } from "../demo-ui/lib.mjs";
const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
await p.goto("https://donordesk.online/login"); await p.getByLabel(/email/i).fill("zz-partner@example.invalid"); await p.getByLabel(/password/i).first().fill("ZzTest-Prt-2026-ok"); await p.getByRole("button", { name: /^sign in$/i }).click(); await p.waitForTimeout(3500);
console.log("PROMPT:", new URL(p.url()).pathname, (await p.locator("body").innerText()).replace(/\n+/g," / ").slice(0,500));
console.log("buttons:", (await p.locator("button:visible, a:visible").allInnerTexts()).join(" | ").slice(0,300));
const useRec = p.getByText(/recovery code/i).first(); if (await useRec.count()) { await useRec.click().catch(()=>{}); await p.waitForTimeout(800); }
await p.locator("input:visible").last().fill("fgtyo-xnsow"); await p.getByRole("button", { name: /Verify|Sign in|Continue|Confirm/ }).first().click(); await p.waitForTimeout(4000);
console.log("AFTER:", new URL(p.url()).pathname);
await b.close();
