"use client";

import { useState } from "react";
import { LocateFixed } from "lucide-react";

/**
 * "Here": fills a location from the phone's own position (Version 4.000, plan F34). The position never leaves the device
 * except in what is saved; no map or address service is called, so the text is the coordinates, which a person may replace.
 */
export function HereButton({ onPlace }: { onPlace: (text: string) => void }) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setNote("This device cannot tell where it is."); return; }
    setBusy(true);
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setBusy(false); onPlace(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`); setNote(`Within about ${Math.round(pos.coords.accuracy)} m. You can type a place name instead.`); },
      () => { setBusy(false); setNote("The position could not be read. Check that location is allowed for this site."); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };
  return (
    <div className="-mt-2 flex flex-wrap items-center gap-2">
      <button type="button" className="btn-secondary btn-sm min-h-10" onClick={locate} disabled={busy} aria-busy={busy || undefined}>
        <LocateFixed aria-hidden="true" />{busy ? "Finding you…" : "Here"}
      </button>
      {note && <span role="status" className="text-xs text-slate-500 dark:text-slate-400">{note}</span>}
    </div>
  );
}
