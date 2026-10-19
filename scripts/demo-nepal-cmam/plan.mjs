import { BASE } from "../demo-ui/lib.mjs";
/** Planned activities of the project from the List view: [{href, title, dates, lead, signal}] */
export async function loadItems(page, P) {
  await page.goto(`${BASE}/projects/${P}/activities?view=planned`); await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Whole project" }).click(); await page.waitForTimeout(700);
  await page.getByRole("button", { name: "List" }).click(); await page.waitForTimeout(1800);
  return page.locator("a[href*='/activities/plan/'][href*='-']").evaluateAll((as) => as.filter((a) => /plan\/[0-9a-f-]{36}$/.test(a.getAttribute("href"))).map((a) => {
    let n = a; for (let i = 0; i < 6 && n && !/ · /.test(n.innerText); i++) n = n.parentElement;
    const t = (n ?? a).innerText.split("\n").map((s) => s.trim()).filter(Boolean);
    return { href: a.getAttribute("href"), title: a.innerText.split("\n")[0].trim(), line: t.find((x) => / · /.test(x)) ?? "", all: t.join(" | ") };
  }));
}
export const find = (items, titleStart, monthAbbr) => items.find((i) => i.title.startsWith(titleStart) && new RegExp(`\\b\\d{1,2} ${monthAbbr}\\b`).test(i.line));
