import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("state");
console.log(JSON.stringify(await page.evaluate(() => ({ url: location.href, vis: document.visibilityState, focus: document.hasFocus(), h1: document.querySelector("h1")?.textContent, sections: [...document.querySelectorAll("section[aria-label]")].map((s) => s.getAttribute("aria-label")), text: document.body.innerText.slice(0, 300) }))));
await browser.close(); process.exit(0);
