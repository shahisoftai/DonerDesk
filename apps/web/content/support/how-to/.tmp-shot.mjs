import { chromium } from "@playwright/test";
const b = await chromium.connectOverCDP("http://127.0.0.1:9340");
const pages = b.contexts()[0].pages();
console.log("pages:", pages.map(p => p.url()).join(" | "));
const p = pages[0];
await p.keyboard.press("Escape");
await p.goto("https://donordesk.online/team", { waitUntil: "networkidle" });
await p.screenshot({ path: "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/fa709ab4-793f-43c1-8641-66486cff3cfc/scratchpad/team-now.png" });
await b.close();
