import { attach, dump } from "./lib.mjs";
const { page, browser } = await attach();
const d = page.locator('[role=dialog]'); console.log(await d.count()); console.log((await d.first().innerText()).slice(0, 2500));
console.log((await dump(page)).filter(l=>/button|radio|checkbox/.test(l) && /(Next|Back|Export|Re-check|Close|Download|Internal|donor|Create)/i.test(l)).join("\n"));
await browser.close(); process.exit(0);
