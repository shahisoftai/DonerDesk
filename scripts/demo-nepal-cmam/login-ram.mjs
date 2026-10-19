import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const SP = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/479a3df2-4263-43ed-8747-92569ea883a4/scratchpad";
const email = "ram.chaudhary.demo@example.org"; const pw = readFileSync(`${SP}/dd9-users.txt`, "utf8").split("\n").find((l) => l.startsWith(email)).split(" ")[1];
const { page, browser } = await attach("login-ram");
await page.goto(BASE + "/login"); await page.waitForLoadState("networkidle");
await page.getByLabel(/email/i).fill(email); await page.getByLabel(/password/i).first().fill(pw); await page.getByRole("button", { name: /^sign in$/i }).click();
await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 30000 }); console.log("Ram signed in:", page.url());
await browser.close(); process.exit(0);
