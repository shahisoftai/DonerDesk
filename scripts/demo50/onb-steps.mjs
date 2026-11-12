import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("onb-steps");
page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 200)));
await page.goto(BASE + "/onboarding", { waitUntil: "networkidle" });
const items = await page.locator("ol > li").allInnerTexts();
console.log(items.map((t) => t.replace(/\s+/g, " ").slice(0, 140)).join("\n"));
for (const href of ["/onboarding/profile","/onboarding/storage","/onboarding/team","/onboarding/reporting-defaults"]) {
  await page.goto(BASE + href, { waitUntil: "networkidle" });
  const f = await page.evaluate(() => [...document.querySelectorAll("main input,main select,main textarea,main button")].map(e => `${e.tagName}:${e.getAttribute("name")||e.id||""}:${e.type||""}:${(e.innerText||e.value||"").slice(0,30)}`));
  console.log("\n##", href, new URL(page.url()).pathname, (await page.locator("h1").first().textContent()));
  console.log(f.join(" | "));
}
await browser.close(); process.exit(0);
