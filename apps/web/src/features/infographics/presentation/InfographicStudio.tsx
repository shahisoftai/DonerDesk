"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  INFOGRAPHIC_TEMPLATES,
  knownTemplates,
  validateConfig,
  reseedSectionCaptions,
  type InfographicConfig,
  type InfographicLanguage,
  type InfographicSectionConfig,
} from "@donordesk/domain/contexts/infographics/index.js";
import type { DataSheet } from "@donordesk/domain/contexts/reporting/data-sheet.js";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { loadMapAssets } from "@/lib/client/map-assets";
import { siteMapData, normalizePlace, countryView } from "@/features/workplan/domain/site-map";
import { BLOCK_CATALOG, duplicateSection, newSection } from "../domain/block-catalog";
import { buildMapShapes, shapePointCount, type MapShape } from "../domain/geo-shapes";
import { STATUS_INFO } from "../domain/studio-copy";
import { canRedo, canUndo, createHistory, isDirty, pushState, redo, undo, type History } from "../domain/studio-history";
import { studio, type CheckResult, type PreviewPage, type PreviewResponse } from "../domain/studio-api";
import { mapPoints as planMapPoints, type InfographicData } from "../domain/studio-view";
import { BlockEditor } from "./studio/BlockEditor";
import { BrandKitDialog } from "./studio/BrandKitDialog";
import { CheckPanel } from "./studio/CheckPanel";
import { DesignPanel } from "./studio/DesignPanel";
import { PublishPanel } from "./studio/PublishPanel";
import { SaveTemplateDialog } from "./studio/SaveTemplateDialog";
import { SectionList } from "./studio/SectionList";
import { StudioPreview } from "./studio/StudioPreview";
import { SuggestionsPanel } from "./studio/SuggestionsPanel";
import { PanelHeading } from "./studio/primitives";

interface DesignRecord {
  id: string;
  title: string;
  templateId: string;
  templateVersion: number;
  configJson: string;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED";
}

type Tab = "block" | "design" | "ideas" | "check" | "publish";
const ALL_TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: "block", label: "Block" },
  { id: "design", label: "Design" },
  { id: "ideas", label: "Ideas" },
  { id: "check", label: "Check" },
  { id: "publish", label: "Publish" },
];

const parseConfig = (design: DesignRecord): InfographicConfig => {
  try {
    return JSON.parse(design.configJson) as InfographicConfig;
  } catch {
    return { templateId: design.templateId, templateVersion: design.templateVersion, sections: [] };
  }
};

type MapInputs = { points: Array<{ name: string; lat: number; lng: number; worst: string; count?: number }>; shapes: MapShape[]; ready: boolean };

/**
 * The Infographic Studio: blocks on the left, the page as it will be published in the middle, the settings of the
 * chosen block (or of the whole design, its check, its review) on the right. The picture is drawn by the server with the
 * same composer that makes the published file, so what is seen is what is published.
 */
/** A stable default: a fresh `[]` each render re-runs the map effect forever (the Studio stayed on "Drawing the page"). */
const NO_COUNTRIES: Array<{ country: string; projects: number; offTrack: number; atRisk: number; onTrack: number }> = [];

export function InfographicStudio({
  projectId,
  design,
  data,
  sheet,
  canEdit,
  canExport,
  canApprove,
  canManageBrand,
  hasBrandKit: hasBrandKitInitially,
  scope = "PROJECT",
  portfolioCountries = NO_COUNTRIES,
}: {
  projectId: string;
  design: DesignRecord;
  data: InfographicData;
  sheet: DataSheet;
  canEdit: boolean;
  canExport: boolean;
  canApprove: boolean;
  canManageBrand: boolean;
  hasBrandKit: boolean;
  /** A portfolio page covers every project the person can see; it has no single project's records. */
  scope?: "PROJECT" | "PORTFOLIO";
  /** Portfolio only: each country with how delivery stands there, for the map. */
  portfolioCountries?: Array<{ country: string; projects: number; offTrack: number; atRisk: number; onTrack: number }>;
}) {
  const initial = useMemo(() => parseConfig(design), [design]);
  const TABS = scope === "PORTFOLIO" ? ALL_TABS.filter((t) => t.id !== "ideas") : ALL_TABS;
  const [history, setHistory] = useState<History<InfographicConfig>>(() => createHistory(initial));
  const savedRef = useRef<InfographicConfig>(initial);
  const [savedTick, setSavedTick] = useState(0);
  const config = history.present;
  const dirty = isDirty(history, savedRef.current) && savedTick >= 0;
  const [status, setStatus] = useState(design.status);
  const [selected, setSelected] = useState<number | undefined>(initial.sections.length > 0 ? 0 : undefined);
  const [tab, setTab] = useState<Tab>("block");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | undefined>();
  const [pages, setPages] = useState<PreviewPage[] | undefined>();
  const [check, setCheck] = useState<CheckResult | undefined>();
  const [altText, setAltText] = useState<string | undefined>();
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | undefined>();
  const [brandOpen, setBrandOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [hasBrandKit, setHasBrandKit] = useState(hasBrandKitInitially);
  const [mapInputs, setMapInputs] = useState<MapInputs>({ points: [], shapes: [], ready: false });

  const commit = useCallback((next: InfographicConfig, key?: string): void => setHistory((h) => pushState(h, next, Date.now(), key)), []);
  const patchConfig = useCallback((changes: Partial<InfographicConfig>, key?: string): void => setHistory((h) => pushState(h, { ...h.present, ...changes }, Date.now(), key)), []);
  // Switching the design's language re-seeds number/funnel captions that still match a template
  // default (never text the person has already retyped) into the new language, so a design built
  // from a template and switched straight to Arabic does not keep English "People reached" etc.
  const onDesignChange = useCallback(
    (changes: Partial<InfographicConfig>): void => {
      if (!changes.language) return patchConfig(changes);
      setHistory((h) => pushState(h, { ...h.present, ...changes, sections: reseedSectionCaptions(h.present.sections, changes.language as InfographicLanguage) }, Date.now()));
    },
    [patchConfig],
  );
  const patchSection = useCallback(
    (index: number, changes: Partial<InfographicSectionConfig>, key?: string): void =>
      setHistory((h) => pushState(h, { ...h.present, sections: h.present.sections.map((s, i) => (i === index ? { ...s, ...changes } : s)) }, Date.now(), key ?? `section-${index}-${Object.keys(changes).join(",")}`)),
    [],
  );

  const sections = config.sections;
  const validation = useMemo(() => validateConfig(config, knownTemplates()), [config]);
  const templateLabel = INFOGRAPHIC_TEMPLATES[design.templateId as keyof typeof INFOGRAPHIC_TEMPLATES]?.label ?? design.templateId;

  // ---- the map the browser resolves (pins and, when asked, shaded areas); nothing geographic is stored on the server
  const mapSection = sections.find((s) => s.kind === "MAP" && !s.hidden);
  const metric = mapSection?.mapMetric ?? "NONE";
  useEffect(() => {
    if (!mapSection) {
      setMapInputs({ points: [], shapes: [], ready: true });
      return;
    }
    let cancelled = false;
    void (async () => {
      if (scope === "PORTFOLIO") {
        // A portfolio map: one pin per country, coloured by how delivery is going there, over each country's outline.
        const shapes: MapShape[] = [];
        const points: MapInputs["points"] = [];
        try {
          const assets = await loadMapAssets();
          for (const row of portfolioCountries) {
            const focus = countryView(assets.world, row.country);
            if (!focus) continue;
            points.push({ name: row.country, lat: focus.center[1], lng: focus.center[0], worst: row.offTrack + row.atRisk > 0 ? "LATE" : row.onTrack > 0 ? "ON_TIME" : "CANCELLED", count: Math.min(999, Math.max(1, row.projects)) });
            shapes.push(...buildMapShapes({ country: row.country, world: assets.world, withRegions: false }));
          }
        } catch {
          // The page still draws without the outlines.
        }
        if (!cancelled) setMapInputs({ points: points.slice(0, 400), shapes: shapePointCount(shapes) <= 60_000 ? shapes : [], ready: true });
        return;
      }
      const items = planMapPoints(data).map((p) => ({ id: p.id, title: p.title, location: p.location, signal: p.signal }));
      const counts = new Map(planMapPoints(data).map((p) => [p.id, p.count] as const));
      const resolved = items.length > 0 ? siteMapData(items, { country: data.project.country }) : { points: [] as never[] };
      const points = (resolved.points as Array<{ name: string; lat: number; lng: number; worst: string; items?: Array<{ id: string }> }>).map((p) => ({ name: p.name, lat: p.lat, lng: p.lng, worst: p.worst, count: Math.max(1, Math.min(999, (p.items ?? []).reduce((n, it) => n + (counts.get(it.id) ?? 1), 0) || 1)) }));
      let shapes: MapShape[] = [];
      try {
        const assets = await loadMapAssets();
        const valueByLocation: Record<string, number> = {};
        if (metric === "REACH") for (const row of data.reach.registeredByLocation) valueByLocation[normalizePlace(row.location)] = row.unique;
        if (metric === "ACTIVITIES_DONE") for (const row of data.activities.rows) valueByLocation[normalizePlace(row.location)] = row.done;
        if (metric === "ACTIVITIES_PLANNED") for (const row of data.activities.rows) valueByLocation[normalizePlace(row.location)] = row.planned;
        shapes = buildMapShapes({ country: data.project.country, world: assets.world, admin1: assets.admin1, valueByLocation, withRegions: metric !== "NONE" });
      } catch {
        shapes = [];
      }
      if (!cancelled) setMapInputs({ points: points.slice(0, 400), shapes: shapePointCount(shapes) <= 60_000 ? shapes : shapes.slice(0, 1), ready: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [data, scope, portfolioCountries, mapSection !== undefined, metric]); // eslint-disable-line react-hooks/exhaustive-deps

  const mapBody = useCallback(() => ({ mapPoints: mapInputs.points, mapShapes: mapInputs.shapes }), [mapInputs]);

  // ---- the live preview, drawn by the server; edits settle for a moment before a new picture is asked for
  const requestId = useRef(0);
  useEffect(() => {
    if (!mapInputs.ready) return;
    const id = (requestId.current += 1);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewing(true);
      const draft = validation.ok ? validation.value : undefined;
      const r = await studio<PreviewResponse>(`infographics/${design.id}/preview`, { method: "POST", body: { ...(draft ? { config: draft } : {}), ...mapBody() }, signal: controller.signal });
      if (id !== requestId.current) return;
      setPreviewing(false);
      if (r.ok) {
        setPages(r.data.pages);
        setCheck(r.data.check);
        setAltText(r.data.altText);
        setPreviewError(undefined);
      } else if (r.message) setPreviewError(validation.ok ? r.message : `${r.message} (Showing the last picture that could be drawn.)`);
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [config, mapInputs.ready, mapBody, design.id, validation]);

  // ---- saving
  const save = useCallback(async (): Promise<boolean> => {
    if (!validation.ok) {
      setMessage({ tone: "error", text: validation.error.message });
      return false;
    }
    setSaving(true);
    setMessage(undefined);
    const r = await studio<{ status?: "DRAFT" | "IN_REVIEW" | "APPROVED" }>(`infographics/${design.id}`, { method: "PUT", body: { config: validation.value } });
    setSaving(false);
    if (r.ok) {
      savedRef.current = history.present;
      setSavedTick((n) => n + 1);
      if (r.data.status) setStatus(r.data.status);
      setMessage({ tone: "ok", text: "Saved." });
      return true;
    }
    setMessage({ tone: "error", text: r.message });
    return false;
  }, [design.id, history.present, validation]);

  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (canEdit) void saveRef.current();
      } else if (!typing && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setHistory((h) => (event.shiftKey ? redo(h) : undo(h)));
      } else if (!typing && event.key.toLowerCase() === "y") {
        event.preventDefault();
        setHistory((h) => redo(h));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent): void => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ---- editing the list of blocks
  const moveSection = (from: number, to: number): void => {
    if (to < 0 || to >= sections.length || from === to) return;
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved as InfographicSectionConfig);
    commit({ ...config, sections: next });
    setSelected(to);
  };
  const addSection = (kind: InfographicSectionConfig["kind"]): void => {
    const at = selected !== undefined ? selected + 1 : sections.length;
    commit({ ...config, sections: [...sections.slice(0, at), newSection(kind), ...sections.slice(at)] });
    setSelected(at);
    setTab("block");
  };
  const removeSection = (index: number): void => {
    commit({ ...config, sections: sections.filter((_, i) => i !== index) });
    setSelected(sections.length > 1 ? Math.max(0, Math.min(index, sections.length - 2)) : undefined);
  };
  const duplicate = (index: number): void => {
    const copy = duplicateSection(sections[index] as InfographicSectionConfig);
    commit({ ...config, sections: [...sections.slice(0, index + 1), copy, ...sections.slice(index + 1)] });
    setSelected(index + 1);
  };
  const select = (index: number): void => {
    setSelected(index);
    setTab("block");
  };

  const useMessages = (texts: string[]): void => {
    const messages = texts.map((text) => ({ text: text.slice(0, 160) })).slice(0, 5);
    const at = sections.findIndex((s) => s.kind === "KEY_MESSAGES");
    if (at >= 0) {
      patchSection(at, { messages }, "ideas");
      select(at);
    } else {
      const section = { ...newSection("KEY_MESSAGES"), messages };
      const index = Math.min(1, sections.length);
      commit({ ...config, sections: [...sections.slice(0, index), section, ...sections.slice(index)] });
      select(index);
    }
  };

  const flagged = useMemo(() => {
    const out: Record<number, number> = {};
    for (const f of check?.findings ?? []) if (f.sectionIndex !== undefined && !f.waived) out[f.sectionIndex] = (out[f.sectionIndex] ?? 0) + 1;
    return out;
  }, [check]);
  const blockers = check?.blockers.length ?? 0;
  const selectedSection = selected !== undefined ? sections[selected] : undefined;
  const statusInfo = STATUS_INFO[status];
  const waivers = config.waivers ?? [];

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <Link className="text-sm text-slate-500 hover:text-slate-800" href={scope === "PORTFOLIO" ? "/portfolio/infographics" : `/projects/${projectId}/infographics`}>
          ← All infographics
        </Link>
        <Badge tone="neutral">{templateLabel}</Badge>
        <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
        <Badge tone={dirty ? "warning" : "neutral"}>{dirty ? "Unsaved changes" : "Saved"}</Badge>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              <Button size="sm" variant="ghost" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo(history)} onClick={() => setHistory(undo)}>
                ↶ Undo
              </Button>
              <Button size="sm" variant="ghost" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo(history)} onClick={() => setHistory(redo)}>
                ↷ Redo
              </Button>
              <Button size="sm" variant="secondary" pending={saving} disabled={!dirty || !validation.ok} onClick={() => void save()}>
                Save
              </Button>
            </>
          )}
          {canExport && (
            <Button size="sm" onClick={() => setTab("publish")}>
              Publish…
            </Button>
          )}
        </div>
      </div>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.tone === "error" ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"}`}>
          {message.text}
        </p>
      )}
      {!validation.ok && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">This design has a problem: {validation.error.message}</p>}
      {!canEdit && <p className="mt-3 text-sm text-slate-500">You can look at this design but not change it.</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)_340px]">
        <aside className="card h-fit p-3">
          <SectionList sections={sections} selected={selected} onSelect={select} onMove={moveSection} onToggleHidden={(i) => patchSection(i, { hidden: !sections[i]?.hidden || undefined }, `hide-${i}`)} onDuplicate={duplicate} onRemove={removeSection} onAdd={addSection} flagged={flagged} canEdit={canEdit} scope={scope} />
        </aside>

        <StudioPreview pages={pages} loading={previewing} error={previewError} selected={selected} onSelect={select} altText={altText} />

        <aside className="card h-fit max-h-[calc(100vh-130px)] overflow-y-auto p-3">
          <div role="tablist" aria-label="Settings" className="mb-3 flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${tab === t.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"}`}
              >
                {t.label}
                {t.id === "check" && blockers > 0 ? ` (${blockers})` : ""}
              </button>
            ))}
          </div>
          {tab === "block" &&
            (selectedSection && selected !== undefined ? (
              <>
                <PanelHeading>{BLOCK_CATALOG[selectedSection.kind].label}</PanelHeading>
                <BlockEditor scope={scope} section={selectedSection} patch={(changes) => patchSection(selected, changes)} data={data} sheet={sheet} canEdit={canEdit} />
              </>
            ) : (
              <p className="text-sm text-slate-500">Choose a block in the list, or click it on the page, to change it.</p>
            ))}
          {tab === "design" && <DesignPanel config={config} onChange={onDesignChange} data={data} canEdit={canEdit} hasBrandKit={hasBrandKit} onOpenBrand={() => setBrandOpen(true)} scope={scope} />}
          {tab === "ideas" && <SuggestionsPanel projectId={projectId} language={config.language} canEdit={canEdit} onUseHeadline={(text) => patchConfig({ title: text.slice(0, 120) })} onUseMessages={useMessages} />}
          {tab === "check" && (
            <CheckPanel
              check={check}
              checking={previewing}
              canEdit={canEdit}
              waived={waivers}
              onSelect={select}
              onWaive={(ruleId, note) => patchConfig({ waivers: [...waivers.filter((w) => w.ruleId !== ruleId), { ruleId, note }] })}
              onUnwaive={(ruleId) => patchConfig({ waivers: waivers.filter((w) => w.ruleId !== ruleId) })}
            />
          )}
          {tab === "publish" && (
            <PublishPanel
              designId={design.id}
              projectId={projectId}
              status={status}
              onStatus={setStatus}
              profile={config.profile}
              dirty={dirty}
              check={check}
              canEdit={canEdit}
              canExport={canExport}
              canApprove={canApprove}
              ensureSaved={save}
              mapInputs={mapBody as never}
              onSaveAsTemplate={() => setTemplateOpen(true)}
              scope={scope}
            />
          )}
        </aside>
      </div>

      <BrandKitDialog open={brandOpen} onClose={() => setBrandOpen(false)} canManage={canManageBrand} onSaved={() => setHasBrandKit(true)} />
      <SaveTemplateDialog open={templateOpen} onClose={() => setTemplateOpen(false)} designId={design.id} defaultName={config.title ?? templateLabel} />
    </div>
  );
}
