import Link from "next/link";

/** The one entry to every visual surface (Phase 48.5): designs, charts, maps and templates, each keeping the page it already had. */
export const SHELL_TABS = [
  { key: "designs", label: "Designs", href: "/visuals" },
  { key: "datasets", label: "Datasets", href: "/visuals/datasets" },
  { key: "charts", label: "Charts", href: "/visuals/charts" },
  { key: "maps", label: "Maps", href: "/visuals/maps" },
  { key: "templates", label: "Templates", href: "/visuals/templates" },
  { key: "assets", label: "Assets", href: "/visuals/assets" },
  { key: "alerts", label: "Alerts", href: "/visuals/alerts" },
  { key: "tv", label: "TV", href: "/visuals/tv" },
] as const;
export type ShellTabKey = (typeof SHELL_TABS)[number]["key"];

export function ShellTabs({ active }: { active: ShellTabKey }) {
  return (
    <nav aria-label="Visual Studio" className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700">
      {SHELL_TABS.map((t) => (
        <Link key={t.key} href={t.href} aria-current={t.key === active ? "page" : undefined}
          className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700 ${t.key === active ? "border-sky-700 font-medium" : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"}`}>{t.label}</Link>
      ))}
    </nav>
  );
}
