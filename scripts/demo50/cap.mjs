import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("cap");
const url = process.argv[2], tag = process.argv[3] ?? "cap";
await page.goto(url.startsWith("http") ? url : BASE + url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(Number(process.argv[4] ?? 4500));
console.log("URL", page.url());
const d = await page.evaluate(() => {
  const t = (e) => (e.innerText || e.getAttribute("aria-label") || e.placeholder || "").trim().replace(/\s+/g, " ");
  const q = (s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent !== null).map(t).filter((x) => x && x.length < 140);
  return { h: q("h1,h2,h3"), btn: q("button,[role=tab],a[role=button]"), labels: q("label"), inputs: [...document.querySelectorAll("input,textarea,select")].filter((e)=>e.offsetParent!==null).map((e)=>(e.getAttribute("aria-label")||e.placeholder||e.name||e.type)) };
});
for (const [k, v] of Object.entries(d)) console.log(k.toUpperCase() + ": " + [...new Set(v)].slice(0, 60).join(" | "));
await page.screenshot({ path: `${S}/${tag}.png` });
await browser.close(); process.exit(0);
