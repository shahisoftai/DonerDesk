import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("seedlist");
const card = page.getByRole("region").filter({ hasText: "Add a country's places" }).first();
for (const d of await card.locator("details summary").all()) await d.click().catch(() => {});
const t = await card.innerText();
const lines = t.split("\n").filter((l) => /sudur|karnali|bajura|achham|doti|humla|jumla|kalikot|mugu|province|already/i.test(l));
console.log(lines.slice(0, 40).join("\n"));
await browser.close(); process.exit(0);
