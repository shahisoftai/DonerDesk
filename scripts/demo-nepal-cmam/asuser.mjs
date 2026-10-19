import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const SP = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/479a3df2-4263-43ed-8747-92569ea883a4/scratchpad";
/** A second visible window logged in as one of the demo users (password read from the scratchpad, never stored in the repo). */
export async function asUser(browser, email) {
  const pw = readFileSync(`${SP}/dd9-users.txt`, "utf8").split("\n").find((l) => l.startsWith(email))?.split(" ")[1];
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.goto(BASE + "/login"); await page.waitForLoadState("networkidle"); await page.getByLabel(/email/i).fill(email); await page.getByLabel(/password/i).first().fill(pw);
  await page.getByRole("button", { name: /^sign in$/i }).click(); await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500); return { ctx, page };
}
