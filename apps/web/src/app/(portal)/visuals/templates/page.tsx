import { ShellTabs } from "@/features/visual-studio/presentation/ShellTabs";

export const dynamic = "force-dynamic";

/** Where to start: a blank design, or a starter made for a sector. */
export default function VisualTemplatesPage() {
  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Visual Studio</h1>
      <ShellTabs active="templates" />
      <ul className="grid gap-3 sm:grid-cols-2">
        <li className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"><a className="font-medium hover:underline" href="/visuals/new">A new design</a><p className="mt-1 text-sm text-slate-500">Start from a blank page or one of the starters (flash update, results at a glance, funding and burn and others).</p></li>
        <li className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"><a className="font-medium hover:underline" href="/dashboards/templates">Sector templates</a><p className="mt-1 text-sm text-slate-500">Dashboards for education, health, water and other sectors, with your own copies.</p></li>
      </ul>
    </div>
  );
}
