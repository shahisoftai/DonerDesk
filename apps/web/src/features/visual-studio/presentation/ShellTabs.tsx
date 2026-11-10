import Link from "next/link";

/** The one entry to every visual surface (Phase 48.5): designs, charts, maps and templates, each keeping the page it already had. */
export const SHELL_TABS = [
  { key: "designs", label: "Designs", href: "/visuals" },
  { key: "charts", label: "Charts", href: "/visuals/charts" },
  { key: "maps", label: "Maps", href: "/visuals/maps" },
  { key: "templates", label: "Templates", href: "/visuals/templates" },
  { key: "alerts", label: "Alerts", href: "/visuals/alerts" },
] as const;
export type ShellTabKey = (typeof SHELL_TABS)[number]["key"];

export function ShellTabs({ active }: { active: ShellTabKey }) {
  return (
    <nav aria-label="Visual Studio" className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
      {SHELL_TABS.map((t) => (
        <Link key={t.key} href={t.href} aria-current={t.key === active ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${t.key === active ? "border-sky-700 font-medium" : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"}`}>{t.label}</Link>
      ))}
    </nav>
  );
}
