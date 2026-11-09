import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("pid");
const l = await page.getByRole("link", { name: /Open the project/ }).first().getAttribute("href"); console.log("HREF", l);
await browser.close(); process.exit(0);
