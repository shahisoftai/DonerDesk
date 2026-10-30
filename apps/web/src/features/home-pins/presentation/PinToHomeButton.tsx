"use client";

import { useEffect, useState } from "react";
import { getDashboardFeaturedAction, pinDashboardAction, setDashboardFeaturedAction } from "@/lib/actions/home-pins";
import { Button } from "@/components/ui/Button";

/** "Pin to Home" on a dashboard: adds it to the person's own Home. Says what happened, including "already pinned". */
export function PinToHomeButton({ dashboardId, orgWide = false }: { dashboardId: string; /** An organisation-wide dashboard: an administrator may also show it on everyone's Home. */ orgWide?: boolean }) {
  const [featured, setFeatured] = useState<{ featured: boolean; canChange: boolean } | null>(null);
  useEffect(() => { if (orgWide) void getDashboardFeaturedAction(dashboardId).then((r) => setFeatured(r.ok ? r.value : null)); }, [dashboardId, orgWide]);
  const [state, setState] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="secondary" disabled={busy} onClick={async () => {
        setBusy(true);
        const r = await pinDashboardAction(dashboardId);
        setBusy(false);
        setState(r.ok ? { tone: "ok", text: "Pinned to your Home." } : { tone: "error", text: r.error.message });
      }}>Pin to Home</Button>
      {featured?.canChange && (
        <Button variant="secondary" disabled={busy} onClick={async () => {
          setBusy(true);
          const r = await setDashboardFeaturedAction(dashboardId, !featured.featured);
          setBusy(false);
          if (r.ok) { setFeatured({ ...featured, featured: !featured.featured }); setState({ tone: "ok", text: featured.featured ? "No longer shown on everyone's Home." : "Shown on everyone's Home." }); }
          else setState({ tone: "error", text: r.error.message });
        }}>{featured.featured ? "Stop showing on everyone's Home" : "Show on everyone's Home"}</Button>
      )}
      {state && <span role={state.tone === "error" ? "alert" : "status"} className={`text-sm ${state.tone === "error" ? "text-danger-600" : "text-emerald-700 dark:text-emerald-300"}`}>{state.text}</span>}
    </>
  );
}
