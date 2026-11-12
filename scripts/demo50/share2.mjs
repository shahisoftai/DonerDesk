import { chromium } from "../demo-ui/lib.mjs";
const tok = "5wPNUEhrGca-0e2i-ni_WHnaSBp_q3rC";
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
const errs=[]; p.on("pageerror", e=>errs.push(String(e).slice(0,100))); 
for (const path of ["/shared/canvas/"+tok, "/embed/canvas/"+tok, "/shared/canvas/bad-token-xyz"]) {
  const r = await p.goto("https://donordesk.online"+path, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(7000);
  console.log("\n##", path.slice(0,28), r?.status(), new URL(p.url()).pathname.slice(0,24), "\n", (await p.locator("body").innerText()).replace(/\n+/g," / ").slice(0,520));
}
console.log("page errors:", errs);
await p.screenshot({ path: "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad/share2.png" });
await b.close();
