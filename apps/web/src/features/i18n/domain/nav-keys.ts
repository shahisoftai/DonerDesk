import type { Translator } from "./translate.ts";

/** The message for each left-navigation entry (by its address) and each group. Anything not listed keeps its English label. */
const ENTRY: Readonly<Record<string, string>> = {
  "/dashboard": "nav.home", "/my-work": "nav.myWork", "/portfolio": "nav.portfolio", "/dashboards": "nav.dashboards", "/projects": "nav.projects",
  "/reports": "nav.reports", "/evidence": "nav.evidence", "/compliance": "nav.compliance", "/programmes": "nav.programmes",
  "/downloads": "nav.downloads", "/team": "nav.team", "/settings": "nav.settings",
};
const GROUP: Readonly<Record<string, string>> = { Overview: "nav.group.overview", Deliver: "nav.group.deliver", Report: "nav.group.report", Fund: "nav.group.fund", Admin: "nav.group.admin" };

export function translateNav<T extends { href: string; label: string; group?: string }>(items: ReadonlyArray<T>, t: Translator["t"]): T[] {
  return items.map((item) => {
    const key = item.href === "/projects" && item.label === "My projects" ? "nav.myProjects" : ENTRY[item.href];
    const groupKey = item.group ? GROUP[item.group] : undefined;
    return { ...item, label: key ? t(key) : item.label, ...(item.group ? { group: groupKey ? t(groupKey) : item.group } : {}) };
  });
}
