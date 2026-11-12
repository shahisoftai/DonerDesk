import { chromium } from "../demo-ui/lib.mjs";
const [email, pw, ...urls] = process.argv.slice(2);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } }); const p = await ctx.newPage();
await p.goto("https://donordesk.online/login", { waitUntil: "domcontentloaded" });
await p.getByLabel(/email/i).fill(email); await p.getByLabel(/password/i).first().fill(pw); await p.getByRole("button", { name: /^sign in$/i }).click();
await p.waitForURL((u) => !/login/.test(u.pathname), { timeout: 40000 }); await p.waitForTimeout(3000);
for (const u of urls.length ? urls : ["/"]) {
  if (u !== "/") { await p.goto("https://donordesk.online" + u, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(3500); }
  const nav = await p.locator("nav a, aside a").evaluateAll(a=>[...new Set(a.map(x=>x.innerText.trim().replace(/\s+/g," ")+"→"+x.getAttribute("href")))].filter(s=>s.length>3));
  console.log("\n## " + new URL(p.url()).pathname + "\nNAV: " + nav.join(" | ").slice(0,700));
  console.log("TEXT: " + (await p.locator("main").innerText().catch(()=>"")).replace(/\n+/g," / ").slice(0,900));
}
await b.close();
