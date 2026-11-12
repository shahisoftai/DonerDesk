import { chromium } from "../demo-ui/lib.mjs";
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
for (const u of ["/login", "/signup", "/forgot-password", "/register"]) {
  const r = await p.goto("https://donordesk.online" + u, { waitUntil: "domcontentloaded" }).catch(()=>null); await p.waitForTimeout(2500);
  console.log("\n## " + u + " -> " + new URL(p.url()).pathname + " " + (r?.status()));
  console.log((await p.locator("body").innerText()).replace(/\n+/g," / ").slice(0, 700));
}
await b.close();
