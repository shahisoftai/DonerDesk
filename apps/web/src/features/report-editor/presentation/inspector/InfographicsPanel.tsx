"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog } from "@/components/feedback/Dialog";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { studio } from "@/features/infographics/domain/studio-api";

interface Placed {
  id: string;
  caption: string;
  title: string;
  exportId: string;
  infographicId: string;
  pageCount: number;
  publishedAt: string;
  designChangedSince: boolean;
}

interface Candidate {
  exportId: string;
  infographicId: string;
  title: string;
  pageCount: number;
  approved: boolean;
  publishedAt: string;
}

const base = (sectionId: string): string => `report-sections/${encodeURIComponent(sectionId)}/infographics`;
const date = (iso: string): string => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const fileUrl = (infographicId: string, exportId: string): string => `/api/infographics/${encodeURIComponent(infographicId)}/exports/${encodeURIComponent(exportId)}/file`;

/**
 * Infographics placed in this section: the project's published pictures, shown as figures in the exported report. A placed picture is the
 * exact file that was published, so it never changes under an approved report; place a newer one to update it.
 */
export function InfographicsPanel({ sectionId, readOnly, sectionApproved = false, onChanged }: { sectionId: string; readOnly: boolean; sectionApproved?: boolean; onChanged: () => void }) {
  const [placed, setPlaced] = useState<Placed[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState<Placed | null>(null);

  const load = useCallback(async () => {
    const r = await studio<{ items: Placed[] }>(base(sectionId));
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setError(null);
    setPlaced(r.data.items);
    setCaptions(Object.fromEntries(r.data.items.map((p) => [p.id, p.caption])));
  }, [sectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (id: string, action: () => Promise<{ ok: boolean; message?: string }>): Promise<void> => {
    setBusy(id);
    setError(null);
    const r = await action();
    setBusy(null);
    if (!r.ok) {
      setError(r.message ?? "That did not work.");
      return;
    }
    await load();
    onChanged();
  };

  const openPicker = async (): Promise<void> => {
    setPicking(true);
    if (candidates) return;
    const r = await studio<{ items: Candidate[] }>(`${base(sectionId)}/candidates`);
    if (r.ok) setCandidates(r.data.items);
    else setError(r.message);
  };

  const place = (c: Candidate): Promise<void> =>
    run(c.exportId, async () => {
      const r = await studio(base(sectionId), { method: "POST", body: { exportId: c.exportId } });
      if (r.ok) setPicking(false);
      return r.ok ? { ok: true } : { ok: false, message: r.message };
    });

  return (
    <section aria-label="Infographics in this section" className="mt-6 space-y-3 border-t border-slate-200 pt-4 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Infographics</h3>
        {!readOnly && (
          <Button size="sm" variant="secondary" onClick={() => void openPicker()}>
            Add an infographic
          </Button>
        )}
      </div>
      <p className="text-xs text-slate-500">A published picture of this project, shown as a figure in the exported report. It stays exactly as it was published.{sectionApproved && !readOnly ? " Changing it reopens this approved section." : ""}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {placed === null && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {placed?.length === 0 && <p className="text-sm text-slate-500">None placed yet.</p>}
      <ul className="space-y-3">
        {placed?.map((p, index) => (
          <li key={p.id} className="rounded-lg border border-slate-200 p-2 dark:border-white/10">
            <div className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl(p.infographicId, p.exportId)} alt={p.caption} className="h-24 w-20 shrink-0 rounded border border-slate-200 bg-white object-contain" loading="lazy" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Input aria-label={`Caption for ${p.title}`} value={captions[p.id] ?? p.caption} maxLength={200} disabled={readOnly} onChange={(event) => setCaptions({ ...captions, [p.id]: event.target.value })} onBlur={() => (captions[p.id] ?? p.caption) !== p.caption && void run(p.id, async () => { const r = await studio(`${base(sectionId)}/${p.id}`, { method: "PUT", body: { caption: captions[p.id] ?? p.caption } }); return r.ok ? { ok: true } : { ok: false, message: r.message }; })} />
                <p className="text-xs text-slate-500">
                  {p.title} · published {date(p.publishedAt)}
                  {p.pageCount > 1 ? ` · first of ${p.pageCount} pages` : ""}
                </p>
                {p.designChangedSince && <Badge tone="warning">The design has changed since. Add the newer picture to update it.</Badge>}
              </div>
            </div>
            {!readOnly && (
              <div className="mt-2 flex flex-wrap justify-end gap-1">
                <Button size="sm" variant="ghost" disabled={index === 0 || busy !== null} aria-label={`Move ${p.title} up`} onClick={() => void run(p.id, async () => { const r = await studio(`${base(sectionId)}/${p.id}/move`, { method: "POST", body: { direction: "UP" } }); return r.ok ? { ok: true } : { ok: false, message: r.message }; })}>
                  ↑
                </Button>
                <Button size="sm" variant="ghost" disabled={index === (placed?.length ?? 1) - 1 || busy !== null} aria-label={`Move ${p.title} down`} onClick={() => void run(p.id, async () => { const r = await studio(`${base(sectionId)}/${p.id}/move`, { method: "POST", body: { direction: "DOWN" } }); return r.ok ? { ok: true } : { ok: false, message: r.message }; })}>
                  ↓
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRemoving(p)} aria-label={`Remove ${p.title}`}>
                  Remove
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={picking} onClose={() => setPicking(false)} title="Add an infographic" size="lg">
        <div className="space-y-3 text-sm">
          {candidates === null && <p className="text-slate-500">Loading…</p>}
          {candidates?.length === 0 && <p className="text-slate-500">This project has no published picture yet. Publish an infographic as an image (PNG) first.</p>}
          <ul className="grid gap-3 sm:grid-cols-2">
            {candidates?.map((c) => (
              <li key={c.exportId} className="flex gap-3 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fileUrl(c.infographicId, c.exportId)} alt="" className="h-24 w-20 shrink-0 rounded border border-slate-200 bg-white object-contain" loading="lazy" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.title}</p>
                  <p className="text-xs text-slate-500">Published {date(c.publishedAt)}</p>
                  {c.approved && <Badge tone="success">Approved</Badge>}
                  <div className="mt-1.5">
                    <Button size="sm" pending={busy === c.exportId} onClick={() => void place(c)}>
                      Place in this section
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Dialog>
      <ConfirmDialog
        open={removing !== null}
        title="Remove this infographic?"
        message={removing ? `“${removing.caption}” will no longer be shown in this section. The published file is not deleted.` : ""}
        confirmLabel="Remove"
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target) void run(target.id, async () => { const r = await studio(`${base(sectionId)}/${target.id}`, { method: "DELETE" }); return r.ok ? { ok: true } : { ok: false, message: r.message }; });
        }}
      />
    </section>
  );
}
