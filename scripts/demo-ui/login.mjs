// Signs in the attached browser with DD_EMAIL / DD_PASSWORD from the environment (never stored).
import { attach, BASE } from "./lib.mjs";
const { browser, page } = await attach("login");
await page.goto(`${BASE}/login`);
if (!page.url().includes("/login")) { console.log("already signed in:", page.url()); process.exit(0); }
await page.getByLabel(/email/i).fill(process.env.DD_EMAIL);
await page.getByLabel(/password/i).first().fill(process.env.DD_PASSWORD);
await page.getByRole("button", { name: /sign in|log in/i }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
console.log("url:", page.url());
console.log((await page.locator("body").innerText()).slice(0, 600));
process.exit(0);
