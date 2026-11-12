import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("findDraft");
await page.goto(BASE + "/reports", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(5000);
const rows = await page.evaluate(() => [...document.querySelectorAll("a[href*='/reports/']")].map((a) => { let n = a; for (let i=0;i<6 && n && !/Draft generated|Not started|Approved|Submitted/.test(n.innerText||""); i++) n = n.parentElement; return { href: a.getAttribute("href"), s: ((n?.innerText||"").match(/Draft generated|Not started|Approved|Submitted|In review/)||[""])[0] }; }));
console.log(rows.filter((r)=>r.s && r.s!=="Not started").slice(0,6));
await browser.close(); process.exit(0);
