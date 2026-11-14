import Link from "next/link";
import { ChevronDown } from "lucide-react";

/**
 * The one entry to every visual surface (Phase 48.5). Version 4.000 (plan F22): designs, templates and datasets are the tabs;
 * the specialist tools (charts, maps, assets, alerts, TV) sit in one "Tools" menu so the first view is not seven choices.
 */
export const SHELL_TABS = [
  { key: "designs", label: "Designs", href: "/visuals", tool: false },
  { key: "templates", label: "Templates", href: "/visuals/templates", tool: false },
  { key: "datasets", label: "Datasets", href: "/visuals/datasets", tool: false },
  { key: "charts", label: "Chart Studio", href: "/visuals/charts", tool: true },
  { key: "maps", label: "Maps", href: "/visuals/maps", tool: true },
  { key: "assets", label: "Images and brand", href: "/visuals/assets", tool: true },
  { key: "alerts", label: "Data alerts", href: "/visuals/alerts", tool: true },
  { key: "tv", label: "TV display", href: "/visuals/tv", tool: true },
] as const;
export type ShellTabKey = (typeof SHELL_TABS)[number]["key"];

const tabClass = (on: boolean) =>
  `relative inline-flex min-h-10 shrink-0 items-center px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
    on
      ? "text-brand-700 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand-700 dark:text-brand-300 dark:after:bg-brand-300"
      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
  }`;

export function ShellTabs({ active }: { active: ShellTabKey }) {
  const tools = SHELL_TABS.filter((t) => t.tool);
  const activeTool = tools.find((t) => t.key === active);
  return (
    <nav aria-label="Visual Studio" className="flex items-center gap-1 border-b border-slate-200 dark:border-white/10">
      {SHELL_TABS.filter((t) => !t.tool).map((t) => (
        <Link key={t.key} href={t.href} aria-current={t.key === active ? "page" : undefined} className={tabClass(t.key === active)}>{t.label}</Link>
      ))}
      <details className="group relative">
        <summary className={`${tabClass(Boolean(activeTool))} cursor-pointer list-none gap-1 [&::-webkit-details-marker]:hidden`}>
          {activeTool ? activeTool.label : "Tools"} <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div role="menu" className="absolute start-0 top-full z-30 mt-1 min-w-[13rem] animate-pop-in rounded-xl border border-slate-200 bg-white p-1 shadow-raised dark:border-white/10 dark:bg-[#16203a]">
          {tools.map((t) => (
            <Link key={t.key} role="menuitem" href={t.href} aria-current={t.key === active ? "page" : undefined} className="flex min-h-10 items-center rounded-lg px-3 text-sm hover:bg-slate-100 aria-[current=page]:font-semibold dark:hover:bg-white/5">{t.label}</Link>
          ))}
        </div>
      </details>
    </nav>
  );
}
