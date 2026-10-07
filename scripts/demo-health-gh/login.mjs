import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("login");
await page.goto(BASE + "/login");
await page.getByLabel(/email/i).fill(process.env.DEMO_EMAIL);
await page.getByLabel(/password/i).first().fill(process.env.DEMO_PASSWORD);
await page.getByRole("button", { name: /sign in/i }).click();
await page.waitForURL(/dashboard|projects|\/$/, { timeout: 30000 }); console.log("logged in", page.url());
await browser.close(); process.exit(0);
