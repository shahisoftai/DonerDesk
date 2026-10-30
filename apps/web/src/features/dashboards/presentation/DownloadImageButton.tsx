"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

const fileSafe = (s: string): string => s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "dashboard";

/**
 * "Download image" (after DevResults' "Download Dashboard": a picture of the dashboard as it looks now). The picture is made in the browser from what is on the
 * screen, so it shows exactly what this person may see and nothing is sent anywhere; the date is in the file name so a picture is never mistaken for a live view.
 */
export function DownloadImageButton({ name }: { name: string }) {
  const [state, setState] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="secondary" disabled={busy} onClick={async () => {
        const node = document.getElementById("dashboard-canvas");
        if (!node) { setState({ tone: "error", text: "There is nothing on the page to take a picture of." }); return; }
        setBusy(true); setState(null);
        try {
          const { toPng } = await import("html-to-image");
          const dark = document.documentElement.classList.contains("dark") || document.documentElement.getAttribute("data-theme") === "dark";
          const url = await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: dark ? "#0f172a" : "#ffffff", filter: (n) => !(n instanceof HTMLElement && n.hasAttribute("data-no-print")) });
          const a = document.createElement("a");
          a.href = url; a.download = `${fileSafe(name)}-${new Date().toISOString().slice(0, 10)}.png`;
          document.body.appendChild(a); a.click(); a.remove();
          setState({ tone: "ok", text: "Picture saved to your downloads." });
        } catch { setState({ tone: "error", text: "The picture could not be made. Use Print and choose Save as PDF instead." }); }
        finally { setBusy(false); }
      }}>Download image</Button>
      {state && <span role={state.tone === "error" ? "alert" : "status"} className={`text-sm ${state.tone === "error" ? "text-danger-600" : "text-emerald-700 dark:text-emerald-300"}`}>{state.text}</span>}
    </>
  );
}
