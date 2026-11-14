"use client";

import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { useCallback, useEffect, useState } from "react";
import { createCanvasShareAction, listCanvasExportsAction, listCanvasSharesAction, publishCanvasAction, reviewCanvasAction, revokeCanvasShareAction, setCanvasSnapshotsAction } from "@/lib/actions/canvas-publishing";
import type { CanvasExportView, CanvasShareLinkView } from "@/lib/server/schemas-canvas";

interface Props {
  canvasId: string;
  canEdit: boolean;
  /** The canvas has changes that are not saved: a copy or a link is made from the saved canvas. */
  dirty: boolean;
  reviewStatus: string;
  reviewNote: string | undefined;
  snapshotEvery: string;
  /** Tells the page the new review state, so its heading agrees. */
  onStatus: (status: string) => void;
}

const BTN = "rounded border border-slate-300 px-2.5 py-1 text-sm hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800";
const FORMATS = [["PDF", "PDF"], ["PNG", "PNG"], ["PPTX", "PowerPoint"], ["SVG", "SVG"]] as const;
const EVERY = ["NONE", "WEEKLY", "MONTHLY"] as const;
const size = (bytes: number): string => (bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`);

/** Review, published copies, share links and scheduled snapshots of one saved canvas. Every refusal is shown in the server's own words. */
export function PublishPanel({ canvasId, canEdit, dirty, reviewStatus, reviewNote, snapshotEvery, onStatus }: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState(reviewStatus);
  const [note, setNote] = useState(reviewNote);
  const [reason, setReason] = useState("");
  const [copies, setCopies] = useState<CanvasExportView[]>([]);
  const [links, setLinks] = useState<CanvasShareLinkView[]>([]);
  const [every, setEvery] = useState(snapshotEvery);
  const [linkKind, setLinkKind] = useState<"LIVE" | "FROZEN">("LIVE");
  const [copyId, setCopyId] = useState("");
  const [days, setDays] = useState(30);
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const reload = useCallback(async () => {
    const [c, l] = await Promise.all([listCanvasExportsAction(canvasId), listCanvasSharesAction(canvasId)]);
    if (c.ok) { setCopies(c.value); setCopyId((cur) => cur || c.value[0]?.id || ""); }
    if (l.ok) setLinks(l.value);
  }, [canvasId]);
  useEffect(() => { void reload(); }, [reload]);

  async function run(name: string, work: () => Promise<{ ok: boolean; error?: { message: string } }>, done: string): Promise<void> {
    setBusy(name); setMessage(null);
    const r = await work();
    setBusy(null);
    setMessage(r.ok ? { tone: "ok", text: done } : { tone: "error", text: r.error?.message ?? "That did not work." });
    if (r.ok) await reload();
  }
  const review = (action: "SUBMIT" | "APPROVE" | "REQUEST_CHANGES" | "REOPEN") => run(`review-${action}`, async () => {
    const r = await reviewCanvasAction(canvasId, { action, ...(reason.trim() ? { note: reason.trim() } : {}) });
    if (r.ok) { setStatus(r.value.status); onStatus(r.value.status); setNote(r.value.note); setReason(""); }
    return r;
  }, "Done.");

  return (
    <div className="space-y-5 text-sm" data-testid="publish-panel">
      {dirty && <p role="status" className="rounded bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950 dark:text-amber-100">{t("canvas.ui.saveFirst")}</p>}
      {message && <p role={message.tone === "error" ? "alert" : "status"} className={`rounded px-3 py-2 ${message.tone === "error" ? "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"}`}>{message.text}</p>}

      <section aria-label="Review" className="space-y-2">
        <h3 className="font-semibold">{t("canvas.ui.review")}: <span data-testid="review-status">{t(`canvas.ui.status.${status}` as never)}</span></h3>
        {status === "CHANGES_REQUESTED" && note && <p className="text-slate-600 dark:text-slate-300">Asked to change: {note}</p>}
        <label className="block"><span className="block text-xs text-slate-600 dark:text-slate-300">{t("canvas.ui.reviewNote")}</span><input className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          {(status === "DRAFT" || status === "CHANGES_REQUESTED") && <button type="button" className={BTN} disabled={dirty || busy !== null} onClick={() => void review("SUBMIT")}>{t("canvas.ui.sendForReview")}</button>}
          {status === "IN_REVIEW" && <><button type="button" className={BTN} disabled={busy !== null} onClick={() => void review("APPROVE")}>{t("canvas.ui.approve")}</button><button type="button" className={BTN} disabled={busy !== null} onClick={() => void review("REQUEST_CHANGES")}>{t("canvas.ui.sendBack")}</button></>}
          {(status === "IN_REVIEW" || status === "APPROVED") && <button type="button" className={BTN} disabled={busy !== null} onClick={() => void review("REOPEN")}>{t("canvas.ui.backToDraft")}</button>}
        </div>
        <p className="text-xs text-slate-500">A canvas for a donor must be approved before a copy or a link can be made. Saving a change takes it back to a draft.</p>
      </section>

      <section aria-label="Published copies" className="space-y-2">
        <h3 className="font-semibold">{t("canvas.ui.copies")}</h3>
        {canEdit && <div className="flex flex-wrap gap-2">{FORMATS.map(([format, name]) => <button key={format} type="button" className={BTN} data-publish={format} disabled={dirty || busy !== null} onClick={() => void run(`publish-${format}`, () => publishCanvasAction(canvasId, { format }), `A ${name} copy was kept.`)}>{busy === `publish-${format}` ? t("canvas.ui.saving") : t("canvas.ui.keepCopy", { format: name })}</button>)}</div>}
        {copies.length === 0 ? <p className="text-slate-500">{t("canvas.ui.noCopies")}</p> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {copies.map((c) => <li key={c.id} className="flex items-center justify-between gap-2 py-1.5"><span>{c.format} · {new Date(c.createdAt).toLocaleString()} · {size(c.sizeBytes)}</span><a className="text-brand-700 underline" href={`/api/canvases/${encodeURIComponent(canvasId)}/exports/${encodeURIComponent(c.id)}/file`}>{t("canvas.ui.download")}</a></li>)}
          </ul>
        )}
      </section>

      <section aria-label="Share links" className="space-y-2">
        <h3 className="font-semibold">{t("canvas.ui.shareLinks")}</h3>
        {canEdit && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1"><span className="block text-xs text-slate-600 dark:text-slate-300">{t("canvas.ui.linkShows")}</span>
              <select className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={linkKind} onChange={(e) => setLinkKind(e.target.value as "LIVE" | "FROZEN")}><option value="LIVE">{t("canvas.ui.linkLive")}</option><option value="FROZEN">{t("canvas.ui.linkFrozen")}</option></select></label>
            {linkKind === "FROZEN" && <label className="space-y-1"><span className="block text-xs text-slate-600 dark:text-slate-300">Copy</span>
              <select className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={copyId} onChange={(e) => setCopyId(e.target.value)}>{copies.length === 0 && <option value="">Keep a copy first</option>}{copies.map((c) => <option key={c.id} value={c.id}>{c.format} · {new Date(c.createdAt).toLocaleDateString()}</option>)}</select></label>}
            <label className="space-y-1"><span className="block text-xs text-slate-600 dark:text-slate-300">{t("canvas.ui.linkDays")}</span><input type="number" min={1} max={180} className="w-20 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={days} onChange={(e) => setDays(Number(e.target.value) || 30)} /></label>
            <button type="button" className={BTN} data-testid="make-link" disabled={dirty || busy !== null} onClick={() => void run("link", async () => {
              const r = await createCanvasShareAction(canvasId, { kind: linkKind, label: linkKind === "LIVE" ? "Live link" : "Copy link", expiresInDays: days, ...(linkKind === "FROZEN" ? { exportId: copyId } : {}) });
              if (r.ok) setFresh(`${window.location.origin}/shared/canvas/${r.value.token}`);
              return r;
            }, "The link is made. Copy it now: it is not shown again.")}>{t("canvas.ui.makeLink")}</button>
          </div>
        )}
        {fresh && <p className="break-all rounded bg-slate-100 p-2 font-mono text-xs dark:bg-slate-800" data-testid="fresh-link">{fresh}</p>}
        {fresh && <div className="space-y-1"><p className="text-xs text-slate-500">To place it inside another page, use this embed code (the page it is placed on must allow frames):</p>
          <p className="break-all rounded bg-slate-100 p-2 font-mono text-xs dark:bg-slate-800" data-testid="embed-code">{`<iframe src="${fresh.replace("/shared/canvas/", "/embed/canvas/")}" title="Visual" width="100%" height="640" style="border:0" loading="lazy"></iframe>`}</p></div>}
        <p className="text-xs text-slate-500">Anyone with a link can open it without signing in. A live link shows the planned work, results by place and indicator figures; money, budgets and people are never shown.</p>
        {links.length > 0 && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {links.map((l) => <li key={l.id} className="flex items-center justify-between gap-2 py-1.5"><span>{l.kind === "LIVE" ? "Live" : "Kept copy"} · {l.label} · until {new Date(l.expiresAt).toLocaleDateString()}{l.revoked ? " · withdrawn" : l.expired ? " · expired" : ""}</span>{canEdit && !l.revoked && !l.expired && <button type="button" className={BTN} disabled={busy !== null} onClick={() => void run(`revoke-${l.id}`, () => revokeCanvasShareAction(canvasId, l.id), "The link is withdrawn.")}>{t("canvas.ui.withdraw")}</button>}</li>)}
          </ul>
        )}
      </section>

      {canEdit && (
        <section aria-label="Snapshots" className="space-y-2">
          <h3 className="font-semibold">{t("canvas.ui.scheduled")}</h3>
          <label className="flex items-center gap-2"><span>{t("canvas.ui.scheduledKeep")}</span>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900" value={every} onChange={(e) => { const next = e.target.value; void run("snapshots", async () => { const r = await setCanvasSnapshotsAction(canvasId, { every: next }); if (r.ok) setEvery(next); return r; }, "Saved."); }}>{EVERY.map((v) => <option key={v} value={v}>{t(`canvas.ui.every.${v}` as never)}</option>)}</select></label>
          <p className="text-xs text-slate-500">Made in the morning, as you, when it is due. A canvas that may not be published at that time is skipped.</p>
        </section>
      )}
    </div>
  );
}
