import { protectedFileDownloadHref } from "@/lib/shared/downloads";
import type { ReportDownload } from "./presentation/ReportsList";

export function downloadsFor(exports: Array<{ exportType: string; fileUrl: string; fileName?: string; createdAt: string }>): ReportDownload[] {
  const latest = (t: string) => exports.filter((e) => e.exportType === t).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return ([["PDF", "PDF"], ["WORD", "Word"]] as const).flatMap(([t, label]) => {
    const e = latest(t);
    return e ? [{ label, href: protectedFileDownloadHref(e.fileUrl, e.fileName) }] : [];
  });
}
