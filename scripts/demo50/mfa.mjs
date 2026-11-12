import crypto from "node:crypto";
import { chromium } from "../demo-ui/lib.mjs";
const b32 = (s) => { const A="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits=""; for (const c of s.replace(/[\s=]/g,"").toUpperCase()) bits+=A.indexOf(c).toString(2).padStart(5,"0"); const out=[]; for (let i=0;i+8<=bits.length;i+=8) out.push(parseInt(bits.slice(i,i+8),2)); return Buffer.from(out); };
const totp = (secret) => { const c=Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000))); const h=crypto.createHmac("sha1", b32(secret)).update(c).digest(); const o=h[19]&15; return String(((h.readUInt32BE(o)&0x7fffffff)%1e6)).padStart(6,"0"); };
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
await p.goto("https://donordesk.online/login"); await p.getByLabel(/email/i).fill("zz-partner@example.invalid"); await p.getByLabel(/password/i).first().fill("ZzTest-Prt-2026-ok"); await p.getByRole("button", { name: /^sign in$/i }).click();
await p.waitForURL((u) => !/login/.test(u.pathname), { timeout: 40000 }); await p.waitForTimeout(2500);
await p.goto("https://donordesk.online/settings/security", { waitUntil: "domcontentloaded" }); await p.waitForTimeout(3000);
await p.getByRole("button", { name: "Set up two-step sign-in" }).click(); await p.waitForTimeout(2500);
const txt = (await p.locator("main").innerText()).replace(/\n+/g," / "); console.log("SETUP:", txt.slice(txt.indexOf("Two-step"), txt.indexOf("Two-step")+900));
const secret = txt.match(/enter this key:\s*((?:[A-Z2-7]{4}\s?){6,16})/)?.[1]?.replace(/\s/g,""); console.log("secret found:", !!secret);
if (secret) {
  await p.locator("input[inputmode=numeric], input[name*=code], input[autocomplete=one-time-code]").first().fill(totp(secret));
  await p.getByRole("button", { name: "Turn on", exact: true }).first().click(); await p.waitForTimeout(3500);
  const t2 = (await p.locator("main").innerText()).replace(/\n+/g," / "); console.log("AFTER:", t2.slice(t2.indexOf("Two-step"), t2.indexOf("Two-step")+900));
}
await b.close();
