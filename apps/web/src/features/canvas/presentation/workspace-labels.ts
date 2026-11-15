/** The canvas workspace's fixed labels and the one browser download helper (Phase 45), kept apart from the component. */
import type { CANVAS_PROFILES } from "@donordesk/domain/contexts/canvas/index.js";

export const PROFILE_LABEL: Record<(typeof CANVAS_PROFILES)[number], string> = { LIVE_INTERNAL: "Live, for the team", SNAPSHOT: "A snapshot to share", DONOR_REPORT: "For a donor", SOCIAL: "For social media", INTERNAL: "Internal document" };
export const SCOPE_LABEL = { ORG: "Whole organisation", PROJECT: "One project", MINE: "Only me", PORTFOLIO: "Portfolio" } as const;
export const SEVERITY = { BLOCKER: "Must fix", WARN: "Should fix", TIP: "Tip" } as const;
export const FILE_FORMATS = [["PDF", "makePdf"], ["PNG", "makePng"], ["PPTX", "makePptx"], ["PACK", "makePack"]] as const;
export const BTN = "rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800";

export function download(name: string, mime: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

