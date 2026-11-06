"use client";

import { useEffect, useState } from "react";
import { getDashboardFeaturedAction, listPeopleForSharingAction, pinDashboardAction, setDashboardFeaturedAction } from "@/lib/actions/home-pins";
import { Button } from "@/components/ui/Button";

/** "Pin to Home" on a dashboard: adds it to the person's own Home. Says what happened, including "already pinned". */
export function PinToHomeButton({ dashboardId, orgWide = false }: { dashboardId: string; /** An organisation-wide dashboard: an administrator may also show it on everyone's Home. */ orgWide?: boolean }) {
  const [featured, setFeatured] = useState<{ featured: boolean; audiences: string[]; canChange: boolean } | null>(null);
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
      {featured?.canChange && <ShowOnHome dashboardId={dashboardId} initial={featured} />}
      {state && <span role={state.tone === "error" ? "alert" : "status"} className={`text-sm ${state.tone === "error" ? "text-danger-600" : "text-emerald-700 dark:text-emerald-300"}`}>{state.text}</span>}
    </>
  );
}

/**
 * For an administrator: show an organisation dashboard on Home to everyone or to chosen people (after DevResults' "push" and "default" dashboards). The choice replaces
 * the earlier one; "Nobody" stops it. Each person still sees only what they may open.
 */
function ShowOnHome({ dashboardId, initial }: { dashboardId: string; initial: { featured: boolean; audiences: string[] } }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"NOBODY" | "EVERYONE" | "CHOSEN">(initial.audiences.includes("*") ? "EVERYONE" : initial.audiences.length > 0 ? "CHOSEN" : "NOBODY");
  const [chosen, setChosen] = useState<Set<string>>(new Set(initial.audiences.filter((a) => a !== "*")));
  const [people, setPeople] = useState<Array<{ id: string; name: string; email: string }> | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open && people === null) void listPeopleForSharingAction().then((r) => setPeople(r.ok ? r.value : [])); }, [open, people]);
  async function save() {
    setBusy(true);
    const audiences = mode === "EVERYONE" ? ["*"] : mode === "CHOSEN" ? [...chosen] : [];
    const r = await setDashboardFeaturedAction(dashboardId, audiences);
    setBusy(false);
    setMsg(r.ok ? { tone: "ok", text: mode === "NOBODY" ? "No longer shown on other people's Home." : mode === "EVERYONE" ? "Shown on everyone's Home." : `Shown on the Home of ${chosen.size} ${chosen.size === 1 ? "person" : "people"}.` } : { tone: "error", text: r.error.message });
  }
  return (
    <div className="w-full">
      <Button variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>Show on Home…</Button>
      {open && (
        <fieldset className="mt-2 space-y-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
          <legend className="px-1 font-medium">Who sees this dashboard on their Home</legend>
          {(["NOBODY", "EVERYONE", "CHOSEN"] as const).map((m) => (
            <label key={m} className="flex items-center gap-2"><input type="radio" name={`home-${dashboardId}`} checked={mode === m} onChange={() => setMode(m)} />{m === "NOBODY" ? "Nobody but those who pin it" : m === "EVERYONE" ? "Everyone in the organisation" : "Chosen people"}</label>
          ))}
          {mode === "CHOSEN" && (
            <ul className="max-h-48 space-y-1 overflow-auto pl-6" aria-label="People">
              {people === null ? <li className="text-slate-500">Loading people…</li> : people.map((p) => (
                <li key={p.id}><label className="flex items-center gap-2"><input type="checkbox" checked={chosen.has(p.id)} onChange={(e) => setChosen((c) => { const n = new Set(c); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })} />{p.name} <span className="text-xs text-slate-500">{p.email}</span></label></li>
              ))}
            </ul>
          )}
          <Button disabled={busy || (mode === "CHOSEN" && chosen.size === 0)} onClick={() => void save()}>Save</Button>
          {msg && <p role={msg.tone === "error" ? "alert" : "status"} className={msg.tone === "error" ? "text-danger-600" : "text-emerald-700 dark:text-emerald-300"}>{msg.text}</p>}
        </fieldset>
      )}
    </div>
  );
}
