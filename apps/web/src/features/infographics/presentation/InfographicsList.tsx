"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { INFOGRAPHIC_FORMATS, INFOGRAPHIC_TEMPLATES, resolveFormat, type InfographicTemplateFamily } from "@donordesk/domain/contexts/infographics/index.js";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/feedback/Dialog";
import { Input } from "@/components/ui/Input";
import { PROFILE_INFO, STATUS_INFO } from "../domain/studio-copy";
import { studio, type Suggestions, type TemplateListing } from "../domain/studio-api";
import { BrandKitDialog } from "./studio/BrandKitDialog";
import { AssetLibrary } from "./studio/AssetLibrary";

interface SavedDesign {
  id: string;
  title: string;
  templateId: string;
  templateVersion: number;
  updatedAt: string;
  exportCount: number;
  status?: "DRAFT" | "IN_REVIEW" | "APPROVED";
  parentId?: string;
  configJson?: string;
}

const FAMILY_LABEL: Readonly<Record<InfographicTemplateFamily, string>> = {
  SNAPSHOT: "Snapshots and updates",
  RESULTS: "Results and progress",
  OVERVIEW: "Project overviews",
  FUNDING: "Funding",
  PEOPLE: "People we reached",
  COMMS: "Posters, social and slides",
  REFERENCE: "Reference pages",
  PORTFOLIO: "Portfolio pages",
};
const FAMILY_ORDER: readonly InfographicTemplateFamily[] = ["PORTFOLIO", "SNAPSHOT", "RESULTS", "OVERVIEW", "PEOPLE", "FUNDING", "COMMS", "REFERENCE"];

/** The page shape of a template as a small outline, so the gallery shows portrait, landscape and square at a glance. */
function ShapeGlyph({ format }: { format: string | undefined }) {
  const f = resolveFormat(format);
  const ratio = f.width / f.height;
  const h = 34;
  const w = Math.max(18, Math.min(60, Math.round(h * ratio)));
  return (
    <span aria-hidden="true" className="inline-flex h-10 w-16 items-center justify-center">
      <span className="rounded-[3px] border-2 border-brand-500/70 bg-brand-50 dark:bg-brand-950/30" style={{ width: w, height: h }} />
    </span>
  );
}

/** The project's saved designs, and the gallery of starting points: ready-made templates, the organization's own layouts and suggestions from the records. */
export function InfographicsList({ projectId, canEdit, canExport, canManageBrand, scope = "PROJECT" }: { projectId: string; canEdit: boolean; canExport: boolean; canManageBrand: boolean; scope?: "PROJECT" | "PORTFOLIO" }) {
  const base = scope === "PORTFOLIO" ? "/portfolio/infographics" : `/projects/${projectId}/infographics`;
  const [designs, setDesigns] = useState<SavedDesign[] | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateListing | undefined>();
  const [suggestions, setSuggestions] = useState<Suggestions | undefined>();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState<string | undefined>();
  const [confirming, setConfirming] = useState<SavedDesign | undefined>();
  const [brandOpen, setBrandOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    const response = await fetch(`/api/projects/${projectId}/infographics`, { cache: "no-store" });
    const body = (await response.json()) as { items?: SavedDesign[] };
    if (response.ok && body.items) setDesigns(body.items);
    else setError("The saved designs could not be loaded.");
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openGallery = async (): Promise<void> => {
    setGalleryOpen(true);
    if (!templates) {
      const [t, s] = await Promise.all([studio<TemplateListing>("infographic-templates"), scope === "PORTFOLIO" ? Promise.resolve(undefined) : studio<Suggestions>(`projects/${projectId}/infographic-suggestions`)]);
      if (t.ok) setTemplates(t.data);
      else setError(t.message);
      if (s && s.ok) setSuggestions(s.data);
    }
  };

  const create = async (body: { templateId: string; userTemplateId?: string; title?: string }): Promise<void> => {
    setCreating(body.userTemplateId ?? body.templateId);
    setError(undefined);
    const response = await fetch(`/api/projects/${projectId}/infographics`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = (await response.json()) as { id?: string; title?: string };
    setCreating(undefined);
    if (response.ok && result.id) window.location.href = `${base}/${result.id}`;
    else setError(result.title ?? "The design could not be created.");
  };

  const remove = async (design: SavedDesign): Promise<void> => {
    const response = await fetch(`/api/infographics/${design.id}?confirm=true`, { method: "DELETE" });
    if (response.ok) {
      setConfirming(undefined);
      void load();
    } else setError("The design could not be deleted.");
  };

  const removeTemplate = async (id: string): Promise<void> => {
    const r = await studio(`infographic-templates/${id}`, { method: "DELETE" });
    if (r.ok) setTemplates((t) => (t ? { ...t, mine: t.mine.filter((x) => x.id !== id) } : t));
    else setError(r.message);
  };

  const builtIn = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = (templates?.builtIn ?? []).filter((t) => (t.scope ?? "PROJECT") === scope).filter((t) => !needle || `${t.label} ${t.description}`.toLowerCase().includes(needle));
    return FAMILY_ORDER.map((family) => ({ family, items: list.filter((t) => t.family === family) })).filter((g) => g.items.length > 0);
  }, [templates, query]);

  const parentTitle = (id: string | undefined): string | undefined => (id ? designs?.find((d) => d.id === id)?.title : undefined);

  return (
    <div className="animate-fade-in">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Infographics</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{scope === "PORTFOLIO" ? "Pages that cover every project you can see: how many, where, how delivery is going and which reports are due. Nothing is added up into a score." : "Designed pages built from your project's own records: snapshots, results, funding, posters and social cards. Every figure is checked against the records; published files stay frozen."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="secondary" onClick={() => setLibraryOpen(true)}>
              Pictures
            </Button>
          )}
          <Button variant="secondary" onClick={() => setBrandOpen(true)}>
            Brand kit
          </Button>
          {canEdit && <Button onClick={() => void openGallery()}>New infographic</Button>}
        </div>
      </header>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {designs === null && <p className="mt-6 text-sm text-slate-500">Loading saved designs…</p>}
      {designs !== null && designs.length === 0 && (
        <div className="card mt-6">
          <p className="text-sm text-slate-500">No saved designs yet. Start from a template{canEdit ? "" : " (ask an editor to create one)"}: missing data shows as “Not yet reported”, never as zero.</p>
        </div>
      )}
      <div className="mt-5 space-y-3">
        {designs?.map((design) => {
          const template = INFOGRAPHIC_TEMPLATES[design.templateId as keyof typeof INFOGRAPHIC_TEMPLATES];
          let format: string | undefined;
          let profile: string | undefined;
          try {
            const c = design.configJson ? (JSON.parse(design.configJson) as { format?: string; profile?: keyof typeof PROFILE_INFO }) : undefined;
            format = c?.format;
            profile = c?.profile ? PROFILE_INFO[c.profile]?.label : undefined;
          } catch {
            format = undefined;
          }
          const status = STATUS_INFO[design.status ?? "DRAFT"];
          const from = parentTitle(design.parentId);
          return (
            <div key={design.id} className={`card flex flex-wrap items-center gap-4 ${confirming === design ? "border-brand-600 ring-2 ring-brand-100" : ""}`}>
              <ShapeGlyph format={format} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{design.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {template?.label ?? "Infographic"} · {INFOGRAPHIC_FORMATS[resolveFormat(format).id].label}
                  {profile ? ` · ${profile}` : ""} · updated {new Date(design.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  {design.exportCount > 0 ? ` · ${design.exportCount} published` : " · nothing published yet"}
                  {from ? ` · made from “${from}”` : ""}
                </p>
              </div>
              <Badge tone={status.tone}>{status.label}</Badge>
              <Link className="btn-secondary" href={`${base}/${design.id}`}>
                Open
              </Link>
              {canEdit && (
                <button type="button" className="text-sm text-slate-400 hover:text-red-600" onClick={() => setConfirming(design)}>
                  Delete
                </button>
              )}
              {confirming === design && (
                <div className="w-full rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  {design.exportCount > 0 ? <>This design has {design.exportCount} published file{design.exportCount === 1 ? "" : "s"}. Deleting the design keeps the published files. Delete anyway?</> : "Delete this draft?"}{" "}
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
          );
        })}
      </div>
      {!canExport && designs !== null && designs.length > 0 && <p className="mt-4 text-xs text-slate-400">Publishing needs the export permission; ask your administrator.</p>}

      <Dialog open={galleryOpen} onClose={() => setGalleryOpen(false)} title="Start a new infographic" size="lg">
        <div className="space-y-5">
          {suggestions && suggestions.templates.length > 0 && (
            <section aria-label="Suggested for this project">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested for this project</h3>
              <ul className="space-y-1.5">
                {suggestions.templates.map((s) => (
                  <li key={s.templateId} className="flex items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50/50 p-2.5 dark:border-brand-900/40">
                    <span className="text-sm">
                      <span className="font-medium">{s.label}</span> <span className="text-slate-600 dark:text-slate-300">{s.reason}</span>
                    </span>
                    <Button size="sm" pending={creating === s.templateId} disabled={creating !== undefined} onClick={() => void create({ templateId: s.templateId })}>
                      Use
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {templates && templates.mine.length > 0 && (
            <section aria-label="My layouts">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">My layouts</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {templates.mine.map((t) => (
                  <li key={t.id} className="rounded-lg border border-slate-200 p-2.5 dark:border-white/10">
                    <p className="text-sm font-medium">{t.name}</p>
                    {t.description && <p className="text-xs text-slate-500">{t.description}</p>}
                    <div className="mt-1.5 flex gap-2">
                      <Button size="sm" pending={creating === t.id} disabled={creating !== undefined} onClick={() => void create({ templateId: t.baseTemplateId, userTemplateId: t.id, title: t.name })}>
                        Use
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void removeTemplate(t.id)} aria-label={`Delete the layout ${t.name}`}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div>
            <Input aria-label="Search the templates" placeholder="Search the templates" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          {!templates && <p className="text-sm text-slate-500">Loading the templates…</p>}
          {builtIn.map(({ family, items }) => (
            <section key={family} aria-label={FAMILY_LABEL[family]}>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{FAMILY_LABEL[family]}</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {items.map((t) => (
                  <li key={t.id}>
                    <button type="button" disabled={creating !== undefined} onClick={() => void create({ templateId: t.id })} className="flex w-full items-start gap-3 rounded-lg border border-slate-200 p-2.5 text-left hover:border-brand-500 hover:bg-brand-50/40 disabled:opacity-50 dark:border-white/10">
                      <ShapeGlyph format={t.format} />
                      <span>
                        <span className="block text-sm font-medium">{t.label}</span>
                        <span className="block text-xs text-slate-500">{t.description}</span>
                        <span className="mt-1 block text-[11px] text-slate-400">
                          {INFOGRAPHIC_FORMATS[resolveFormat(t.format).id].label}
                          {t.profile ? ` · ${PROFILE_INFO[t.profile as keyof typeof PROFILE_INFO]?.label ?? ""}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {templates && builtIn.length === 0 && <p className="text-sm text-slate-500">No template matches that search.</p>}
        </div>
      </Dialog>
      <BrandKitDialog open={brandOpen} onClose={() => setBrandOpen(false)} canManage={canManageBrand} onSaved={() => undefined} />
      <AssetLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)} kind="IMAGE" canEdit={canEdit} />
    </div>
  );
}
