"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { INFOGRAPHIC_TEMPLATE_ORDER, INFOGRAPHIC_TEMPLATES } from "@donordesk/domain/contexts/infographics/index.js";

interface SavedDesign {
  id: string;
  title: string;
  templateId: string;
  templateVersion: number;
  updatedAt: string;
  exportCount: number;
}

/** The project's saved designs (mock 8): open, duplicate-by-template, delete with confirm when published. */
export function InfographicsList({ projectId, canEdit, canExport }: { projectId: string; canEdit: boolean; canExport: boolean }) {
  const [designs, setDesigns] = useState<SavedDesign[] | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState<string | undefined>();
  const [confirming, setConfirming] = useState<SavedDesign | undefined>();

  const load = async (): Promise<void> => {
    const response = await fetch(`/api/projects/${projectId}/infographics`, { cache: "no-store" });
    const body = (await response.json()) as { items?: SavedDesign[] };
    if (response.ok && body.items) setDesigns(body.items);
    else setError("The saved designs could not be loaded.");
  };

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async (templateId: string): Promise<void> => {
    setCreating(templateId);
    setError(undefined);
    const response = await fetch(`/api/projects/${projectId}/infographics`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    const body = (await response.json()) as { id?: string };
    setCreating(undefined);
    if (response.ok && body.id) window.location.href = `/projects/${projectId}/infographics/${body.id}`;
    else setError("The design could not be created.");
  };

  const remove = async (design: SavedDesign): Promise<void> => {
    const response = await fetch(`/api/infographics/${design.id}?confirm=true`, { method: "DELETE" });
    if (response.ok) {
      setConfirming(undefined);
      void load();
    } else setError("The design could not be deleted.");
  };

  return (
    <div className="animate-fade-in">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Infographics</h2>
          <p className="mt-1 text-sm text-slate-500">Ready-made designs from your project&apos;s own records — overview, progress, results, budget, sector, closure. Regenerate any time; published exports stay frozen.</p>
        </div>
        {canEdit && (
          <div className="relative">
            <button type="button" className="btn-primary" onClick={() => setMenuOpen((open) => !open)}>
              New from template
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-10 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-slate-900">
                {INFOGRAPHIC_TEMPLATE_ORDER.map((id) => (
                  <button key={id} type="button" disabled={creating !== undefined} onClick={() => void create(id)} className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-white/5">
                    <span className="block text-sm font-medium">{INFOGRAPHIC_TEMPLATES[id].label}</span>
                    <span className="block text-xs text-slate-500">{INFOGRAPHIC_TEMPLATES[id].description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      {designs === null && <p className="mt-6 text-sm text-slate-500">Loading saved designs…</p>}
      {designs !== null && designs.length === 0 && (
        <div className="card mt-6">
          <p className="text-sm text-slate-500">No saved designs yet. Start from a template above{canEdit ? "" : " — ask an editor to create one"}: every figure comes from your project&apos;s records, and missing data shows as “Not yet reported”.</p>
        </div>
      )}
      <div className="mt-5 space-y-3">
        {designs?.map((design) => (
          <div key={design.id} className={`card flex flex-wrap items-center gap-4 ${confirming === design ? "border-brand-600 ring-2 ring-brand-100" : ""}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{design.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {INFOGRAPHIC_TEMPLATES[design.templateId as keyof typeof INFOGRAPHIC_TEMPLATES]?.label ?? design.templateId} · updated {new Date(design.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                {design.exportCount > 0 ? ` · ${design.exportCount} published export${design.exportCount === 1 ? "" : "s"}` : " · no exports yet"}
              </p>
            </div>
            <Link className="btn-secondary" href={`/projects/${projectId}/infographics/${design.id}`}>
              Open
            </Link>
            {canEdit && (
              <button type="button" className="text-sm text-slate-400 hover:text-red-600" onClick={() => setConfirming(design)}>
                Delete
              </button>
            )}
            {confirming === design && (
              <div className="w-full rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {design.exportCount > 0 ? (
                  <>
                    This design has {design.exportCount} published export{design.exportCount === 1 ? "" : "s"}. Deleting the design keeps the published files. Delete anyway?
                  </>
                ) : (
                  "Delete this draft?"
                )}{" "}
                <button type="button" className="font-semibold text-red-700 underline" onClick={() => void remove(design)}>
                  Delete
                </button>{" "}
                ·{" "}
                <button type="button" className="underline" onClick={() => setConfirming(undefined)}>
                  Keep
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {!canExport && designs !== null && designs.length > 0 && <p className="mt-4 text-xs text-slate-400">Exporting needs the reporting-export permission; ask your administrator.</p>}
    </div>
  );
}
