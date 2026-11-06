import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("dl");
const [d] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download Excel" }).click()]);
await d.saveAs(process.argv[2]); console.log("saved", d.suggestedFilename());
await browser.close(); process.exit(0);
