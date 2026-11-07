import Link from "next/link";

/** Shown on the older dashboard and infographic screens: the work continues in Visuals, where the two are one editor. Nothing here is removed. */
export function MovedToVisuals({ what }: { what: "dashboards" | "infographics" }) {
  return (
    <aside role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 print:hidden dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100" data-testid="moved-to-visuals">
      <p>{what === "dashboards" ? "Dashboards" : "Infographics"} are now made in <strong>Visuals</strong>, one editor for both. Open any {what === "dashboards" ? "dashboard" : "infographic"} there to edit it with every block, undo, history and sharing. This older screen still works.</p>
      <Link className="rounded bg-sky-700 px-3 py-1.5 font-medium text-white hover:bg-sky-800" href="/visuals">Go to Visuals</Link>
    </aside>
  );
}
