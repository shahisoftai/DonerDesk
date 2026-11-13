import { attach, BASE } from "./lib.mjs";
const { page } = await attach("v52-classic3");
await page.selectOption("#reportingFrequency", "QUARTERLY");
await page.fill("#description", "Throwaway project made to check the Phase 52 framework screens. Archive after testing.");
await page.getByRole("button", { name: /create project/i }).click();
await page.waitForURL((u) => /\/projects\/[0-9a-f-]{20,}/.test(u.pathname), { timeout: 60000 });
console.log("created", page.url().replace(BASE, ""));
process.exit(0);
