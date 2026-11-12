import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("map3");
await page.goto(BASE + "/settings/places", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(6000);
const t = (await page.locator("main").innerText()).replace(/\n+/g," / ");
for (const k of ["Map context layers","Your places","Pin","Change pin","This place is a facility","Save map settings","Imagery","Facility types","Download","Import"]) console.log(k, "=>", t.includes(k));
const i = t.indexOf("Map context layers"); console.log("CTX:", i>=0 ? t.slice(i, i+900) : "none");
const j = t.indexOf("Your places"); console.log("PLACES:", j>=0 ? t.slice(j, j+600) : t.slice(t.indexOf("Places to confirm"), t.indexOf("Places to confirm")+100));
console.log("BTNS:", (await page.locator("main button:visible, main a:visible").allInnerTexts()).map(s=>s.replace(/\n/g," ")).filter(s=>s.length<40).join(" | ").slice(0,700));
await browser.close(); process.exit(0);
