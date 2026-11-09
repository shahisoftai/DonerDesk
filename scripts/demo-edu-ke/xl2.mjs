import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("xl2"); page.setDefaultTimeout(20000);
await page.locator("input[type=file][aria-label='Import Excel']").setInputFiles(process.env.S + "/xl-2026-01.xlsx"); await page.waitForTimeout(3500);
await page.screenshot({ path: process.env.SHOT });
console.log((await page.locator("body").innerText()).match(/[^\n]*(Excel|Applied|applied|Could not|rows)[^\n]*/g));
console.log(await page.getByRole("button", { name: "Save all" }).isEnabled());
await browser.close(); process.exit(0);
