import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("wizwalk");
await page.goto(BASE + "/projects/new/wizard?id=b0128b13-567c-446f-b0ef-1d6a0303aa98", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
for (let i = 2; i <= 10; i++) {
  await page.getByRole("button", { name: new RegExp("^" + i + "\\. ") }).first().click();
  await page.waitForTimeout(1800);
  const d = await page.evaluate(() => {
    const sec = document.querySelector("main") ?? document.body;
    const vis = (e) => e.offsetParent !== null;
    const t = (e) => (e.innerText || e.getAttribute("aria-label") || e.placeholder || "").trim().replace(/\s+/g, " ");
    const card = [...sec.querySelectorAll("h1")].find((h) => /\/ ?10/.test(h.previousElementSibling?.innerText ?? "")) ?? sec.querySelectorAll("h1")[0];
    const root = card?.closest("section,div[class*=rounded]") ?? sec;
    const q = (s) => [...root.querySelectorAll(s)].filter(vis).map(t).filter((x) => x && x.length < 160);
    return { lead: root.innerText.split("\n").slice(0, 6).join(" / "), h: q("h2,h3,h4"), btn: q("button"), lab: q("label") };
  });
  console.log(`\n## SLIDE ${i}\nLEAD: ${d.lead}\nH: ${[...new Set(d.h)].join(" | ")}\nBTN: ${[...new Set(d.btn)].filter((b)=>!/^\d+\. /.test(b)).join(" | ")}\nLAB: ${[...new Set(d.lab)].join(" | ")}`);
  await page.screenshot({ path: `${S}/wiz${i}.png`, fullPage: false });
}
await browser.close(); process.exit(0);
