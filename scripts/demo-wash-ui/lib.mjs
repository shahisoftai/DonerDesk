import { createRequire } from "node:module";
const require = createRequire("/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/");
export const { chromium } = require("./index.js");
export const BASE = "https://donordesk.online";
export async function attach() {
  const browser = await chromium.connectOverCDP("http://localhost:9333");
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const _goto = page.goto.bind(page);
  page.goto = async (u, o) => { for (let i = 0; i < 6; i++) { try { return await _goto(u, o); } catch (e) { console.log("  retry goto", String(e).slice(0, 60)); await new Promise(r => setTimeout(r, 3000)); } } throw new Error("goto failed " + u); };
  return { browser, ctx, page };
}
export async function dump(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll("main input,main select,main textarea,main button,main a[href]").forEach((e) => {
      const r = e.getBoundingClientRect(); if (!r.width && !r.height) return;
      const id = e.id; const lab = id ? document.querySelector(`label[for="${id}"]`)?.textContent?.trim() : e.closest("label")?.textContent?.trim();
      out.push([e.tagName.toLowerCase(), e.type ?? "", e.name ?? "", lab ?? e.getAttribute("aria-label") ?? "", (e.textContent ?? "").trim().slice(0, 60), e.getAttribute("href") ?? "", e.value?.slice?.(0,30) ?? ""].join(" | "));
    });
    return out;
  });
}
