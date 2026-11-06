"use client";

import { useState } from "react";
import {
  DATA_CHART_TEMPLATES,
  DATA_CHART_TEMPLATE_ORDER,
} from "@donordesk/domain/contexts/reporting/data-charts.js";
import type { DataSheet } from "@donordesk/domain/contexts/reporting/data-sheet.js";
import type { BigNumberItem, FunnelStage, InfographicSectionConfig, KeyMessage, PresenceRow, SectorCard, TimelineEvent } from "@donordesk/domain/contexts/infographics/index.js";
import { Button } from "@/components/ui/Button";
import { studio } from "../../domain/studio-api";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { InfographicData } from "../../domain/studio-view";
import { BLOCK_CATALOG, SPAN_LABEL, spanChoices } from "../../domain/block-catalog";
import { MAP_METRIC_INFO, NUMBER_SOURCE_INFO, ROUNDING_INFO } from "../../domain/studio-copy";
import { AssetLibrary } from "./AssetLibrary";
import { AssetThumb, Check, Group, IconPicker, ListEditor } from "./primitives";

type Patch = (changes: Partial<InfographicSectionConfig>) => void;

interface Props {
  /** A portfolio page offers portfolio figures and no single project's records. */
  scope?: "PROJECT" | "PORTFOLIO";
  section: InfographicSectionConfig;
  patch: Patch;
  data: InfographicData;
  sheet: DataSheet;
  canEdit: boolean;
}

/** Tick the indicators a block should show. Nothing ticked means the block chooses for itself. */
function IndicatorChecklist({ sheet, value, onChange, max, disabled, label = "Indicators" }: { sheet: DataSheet; value: string[]; onChange: (ids: string[]) => void; max: number; disabled?: boolean; label?: string }) {
  const toggle = (id: string, on: boolean): void => onChange(on ? [...value, id].slice(0, max) : value.filter((x) => x !== id));
  return (
    <fieldset className="space-y-1">
      <legend className="label">{label}</legend>
      <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-white/10">
        {sheet.indicators.length === 0 && <p className="text-xs text-slate-500">This project has no indicators yet.</p>}
        {sheet.indicators.map((indicator) => {
          const checked = value.includes(indicator.id);
          return <Check key={indicator.id} checked={checked} disabled={disabled || (!checked && value.length >= max)} onChange={(on) => toggle(indicator.id, on)} label={`${indicator.code} ${indicator.name}`} />;
        })}
      </div>
      <p className="text-xs text-slate-500">{value.length === 0 ? "None chosen: the block picks the first indicators that have values." : `${value.length} of at most ${max} chosen.`}</p>
    </fieldset>
  );
}

function ImageChoice({ section, patch, canEdit, withDetails }: { section: InfographicSectionConfig; patch: Patch; canEdit: boolean; withDetails: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {section.assetId ? <AssetThumb id={section.assetId} className="h-16 w-24 rounded-md" alt="" /> : <div className="flex h-16 w-24 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-400">No picture</div>}
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            {section.assetId ? "Change picture" : "Choose a picture"}
          </Button>
          {section.assetId && canEdit && (
            <Button size="sm" variant="ghost" onClick={() => patch({ assetId: undefined, consentConfirmed: undefined, altText: undefined })}>
              Remove picture
            </Button>
          )}
        </div>
      </div>
      <AssetLibrary
        open={open}
        onClose={() => setOpen(false)}
        kind="IMAGE"
        canEdit={canEdit}
        onChoose={(asset) => {
          patch({ assetId: asset.id, ...(asset.credit && !section.credit ? { credit: asset.credit } : {}) });
          setOpen(false);
        }}
      />
      {section.assetId && (
        <>
          {withDetails && (
            <>
              <Field label="Caption">
                <Input value={section.caption ?? ""} maxLength={160} disabled={!canEdit} onChange={(event) => patch({ caption: event.target.value })} />
              </Field>
              <Field label="Photo credit">
                <Input value={section.credit ?? ""} maxLength={80} disabled={!canEdit} onChange={(event) => patch({ credit: event.target.value })} />
              </Field>
            </>
          )}
          <Field label="Describe the picture" hint="One sentence for people who cannot see it.">
            <Input value={section.altText ?? ""} maxLength={200} disabled={!canEdit} onChange={(event) => patch({ altText: event.target.value })} />
          </Field>
          <Check checked={Boolean(section.consentConfirmed)} disabled={!canEdit} onChange={(on) => patch({ consentConfirmed: on })} label="The people shown agreed to appear" hint="Required before a design with photos is published." />
        </>
      )}
    </div>
  );
}

function BigNumbersEditor({ section, patch, sheet, canEdit, scope = "PROJECT" }: Props) {
  const items = section.numbers ?? [];
  return (
    <div className="space-y-3">
      <ListEditor<BigNumberItem>
        items={items}
        disabled={!canEdit}
        max={6}
        itemLabel="Figure"
        addLabel="Add a figure"
        make={() => (scope === "PORTFOLIO" ? { source: "PORTFOLIO_PROJECTS", label: "Projects", iconId: "chart" } : { source: "REACH_UNIQUE", label: "People reached", iconId: "people" })}
        onChange={(next) => patch({ numbers: next })}
        render={(item, update) => (
          <div className="space-y-2">
            <Field label="Where it comes from">
              <Select value={item.source} disabled={!canEdit} onChange={(event) => update({ source: event.target.value as BigNumberItem["source"] })}>
                {NUMBER_SOURCE_INFO.filter((o) => (scope === "PORTFOLIO" ? o.scope === "PORTFOLIO" || o.value === "MANUAL" : !o.scope)).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Label">
              <Input value={item.label} maxLength={60} disabled={!canEdit} onChange={(event) => update({ label: event.target.value })} />
            </Field>
            {item.source === "INDICATOR" && (
              <Field label="Indicator">
                <Select value={item.indicatorId ?? ""} disabled={!canEdit} onChange={(event) => update({ indicatorId: event.target.value || undefined })}>
                  <option value="">Choose…</option>
                  {sheet.indicators.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.code} {i.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {item.source === "MANUAL" && (
              <>
                <Field label="The figure">
                  <Input value={item.value ?? ""} maxLength={24} disabled={!canEdit} onChange={(event) => update({ value: event.target.value })} placeholder="1.2 million" />
                </Field>
                <Field label="Source of this figure" hint="Required for a donor report: say who published it.">
                  <Input value={item.sourceNote ?? ""} maxLength={80} disabled={!canEdit} onChange={(event) => update({ sourceNote: event.target.value })} placeholder="Needs assessment, March 2026" />
                </Field>
              </>
            )}
            <Field label="Small print under the label">
              <Input value={item.caption ?? ""} maxLength={80} disabled={!canEdit} onChange={(event) => update({ caption: event.target.value })} />
            </Field>
            <details>
              <summary className="cursor-pointer text-xs text-slate-500">Icon</summary>
              <div className="mt-2">
                <IconPicker value={item.iconId} disabled={!canEdit} onChange={(id) => update({ iconId: id })} />
              </div>
            </details>
          </div>
        )}
      />
      <Field label="Rounding" hint="Round headline numbers that keep changing.">
        <Select value={section.rounding ?? "NONE"} disabled={!canEdit} onChange={(event) => patch({ rounding: event.target.value as InfographicSectionConfig["rounding"] })}>
          {ROUNDING_INFO.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function FunnelEditor({ section, patch, canEdit }: Props) {
  return (
    <ListEditor<FunnelStage>
      items={section.stages ?? []}
      disabled={!canEdit}
      max={5}
      itemLabel="Stage"
      addLabel="Add a stage"
      make={() => ({ label: "New stage" })}
      onChange={(next) => patch({ stages: next })}
      render={(stage, update) => {
        const mode = stage.bind ?? "TYPED";
        return (
          <div className="space-y-2">
            <Field label="Name">
              <Input value={stage.label} maxLength={40} disabled={!canEdit} onChange={(event) => update({ label: event.target.value })} />
            </Field>
            <Field label="Figure">
              <Select value={mode} disabled={!canEdit} onChange={(event) => update(event.target.value === "TYPED" ? { bind: undefined } : { bind: event.target.value as FunnelStage["bind"], value: undefined })}>
                <option value="TYPED">A figure I type</option>
                <option value="REACH_UNIQUE">People reached (unique), from my records</option>
                <option value="REACH_REGISTERED">People registered, from my records</option>
              </Select>
            </Field>
            {mode === "TYPED" && (
              <>
                <Field label="Number of people">
                  <Input type="number" min={0} value={stage.value ?? ""} disabled={!canEdit} onChange={(event) => update({ value: event.target.value === "" ? undefined : Number(event.target.value) })} />
                </Field>
                <Field label="Source" hint="Who published this figure?">
                  <Input value={stage.sourceNote ?? ""} maxLength={80} disabled={!canEdit} onChange={(event) => update({ sourceNote: event.target.value })} />
                </Field>
              </>
            )}
          </div>
        );
      }}
    />
  );
}

function SectorEditor({ section, patch, sheet, canEdit }: Props) {
  return (
    <ListEditor<SectorCard>
      items={section.sectors ?? []}
      disabled={!canEdit}
      max={8}
      itemLabel="Sector"
      addLabel="Add a sector"
      make={() => ({ label: "New sector", indicatorIds: [] })}
      onChange={(next) => patch({ sectors: next })}
      render={(sector, update) => (
        <div className="space-y-2">
          <Field label="Name">
            <Input value={sector.label} maxLength={40} disabled={!canEdit} onChange={(event) => update({ label: event.target.value })} />
          </Field>
          <details>
            <summary className="cursor-pointer text-xs text-slate-500">Icon</summary>
            <div className="mt-2">
              <IconPicker value={sector.iconId} disabled={!canEdit} onChange={(id) => update({ iconId: id })} />
            </div>
          </details>
          <IndicatorChecklist sheet={sheet} value={sector.indicatorIds} max={4} disabled={!canEdit} onChange={(ids) => update({ indicatorIds: ids })} label="Indicators in this sector" />
        </div>
      )}
    />
  );
}

function PresenceEditor({ section, patch, canEdit, scope, data }: Props) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | undefined>();
  const draftFromPlan = async (): Promise<void> => {
    setBusy(true);
    setNote(undefined);
    const res = await studio<{ rows: PresenceRow[]; used: number; skipped: number }>(`projects/${data.projectId}/infographic-presence`);
    setBusy(false);
    if (!res.ok) return setNote(res.message);
    if (res.data.rows.length === 0) return setNote("No planned activity has both a lead and a place yet, so there is nothing to draft.");
    patch({ presence: res.data.rows, ...(section.caption?.trim() ? {} : { caption: "Work plan" }) });
    setNote(`Drafted ${res.data.rows.length} rows from ${res.data.used} planned activities${res.data.skipped ? `; ${res.data.skipped} had no lead or no place and were left out` : ""}. Check them and name the source.`);
  };
  return (
    <div className="space-y-3">
      {canEdit && scope !== "PORTFOLIO" && (
        <div className="space-y-1">
          <Button size="sm" variant="secondary" pending={busy} onClick={() => void draftFromPlan()}>Draft rows from my plan</Button>
          {note && <p role="status" className="text-xs text-slate-600 dark:text-slate-300">{note}</p>}
        </div>
      )}
      <ListEditor<PresenceRow>
        items={section.presence ?? []}
        disabled={!canEdit}
        max={16}
        itemLabel="Organization"
        addLabel="Add an organization"
        make={() => ({ who: "", what: "", where: [] })}
        onChange={(next) => patch({ presence: next })}
        render={(row, update) => (
          <div className="space-y-2">
            <Field label="Who">
              <Input value={row.who} maxLength={60} disabled={!canEdit} onChange={(event) => update({ who: event.target.value })} />
            </Field>
            <Field label="What they do">
              <Input value={row.what} maxLength={60} disabled={!canEdit} onChange={(event) => update({ what: event.target.value })} />
            </Field>
            <Field label="Where (places, separated by commas)" hint="Up to eight. “Gulu” and “Gulu District” count as one place.">
              <Input value={row.where.join(", ")} disabled={!canEdit} onChange={(event) => update({ where: event.target.value.split(",").map((w) => w.slice(0, 60)).slice(0, 8) })} />
            </Field>
          </div>
        )}
      />
      <Field label="Source" hint="Required for a donor report: where this information comes from.">
        <Input value={section.caption ?? ""} maxLength={160} disabled={!canEdit} placeholder="Partner reports, September 2026" onChange={(event) => patch({ caption: event.target.value })} />
      </Field>
    </div>
  );
}

function TimelineEditor({ section, patch, canEdit }: Props) {
  return (
    <ListEditor<TimelineEvent>
      items={section.events ?? []}
      disabled={!canEdit}
      max={12}
      itemLabel="Event"
      addLabel="Add an event"
      make={() => ({ date: new Date().toISOString().slice(0, 10), label: "" })}
      onChange={(next) => patch({ events: next })}
      render={(event, update) => (
        <div className="space-y-2">
          <Field label="Date">
            <Input type="date" value={event.date} disabled={!canEdit} onChange={(e) => update({ date: e.target.value })} />
          </Field>
          <Field label="What happened">
            <Input value={event.label} maxLength={80} disabled={!canEdit} onChange={(e) => update({ label: e.target.value })} />
          </Field>
          <Field label="A little more">
            <Input value={event.detail ?? ""} maxLength={160} disabled={!canEdit} onChange={(e) => update({ detail: e.target.value })} />
          </Field>
        </div>
      )}
    />
  );
}

function MessagesEditor({ section, patch, canEdit }: Props) {
  return (
    <ListEditor<KeyMessage>
      items={section.messages ?? []}
      disabled={!canEdit}
      max={5}
      itemLabel="Message"
      addLabel="Add a message"
      make={() => ({ text: "" })}
      onChange={(next) => patch({ messages: next })}
      render={(message, update) => (
        <div className="space-y-2">
          <Textarea rows={2} maxLength={160} aria-label="Message" value={message.text} disabled={!canEdit} onChange={(event) => update({ text: event.target.value })} />
          <details>
            <summary className="cursor-pointer text-xs text-slate-500">Icon</summary>
            <div className="mt-2">
              <IconPicker value={message.iconId} disabled={!canEdit} onChange={(id) => update({ iconId: id })} />
            </div>
          </details>
        </div>
      )}
    />
  );
}

function ChartEditor({ section, patch, sheet, canEdit }: Props) {
  const chart = section.chart;
  if (!chart) return null;
  const info = DATA_CHART_TEMPLATES[chart.template];
  const setChart = (changes: Partial<NonNullable<InfographicSectionConfig["chart"]>>): void => patch({ chart: { ...chart, ...changes } });
  return (
    <div className="space-y-3">
      <Field label="Chart">
        <Select
          value={chart.template}
          disabled={!canEdit}
          onChange={(event) => {
            const next = DATA_CHART_TEMPLATES[event.target.value as keyof typeof DATA_CHART_TEMPLATES];
            setChart({ template: event.target.value as typeof chart.template, indicatorIds: [], type: next.types[0] ?? chart.type });
          }}
        >
          {DATA_CHART_TEMPLATE_ORDER.map((id) => (
            <option key={id} value={id}>
              {DATA_CHART_TEMPLATES[id].label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Drawn as">
        <Select value={chart.type} disabled={!canEdit} onChange={(event) => setChart({ type: event.target.value as typeof chart.type })}>
          {info.types.map((type) => (
            <option key={type} value={type}>
              {type.charAt(0) + type.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </Field>
      {info.indicators !== "none" && <IndicatorChecklist sheet={sheet} value={chart.indicatorIds} max={info.indicators === "one" ? 1 : 30} disabled={!canEdit} onChange={(ids) => setChart({ indicatorIds: ids })} label={info.indicators === "one" ? "Indicator (choose one)" : "Indicators"} />}
      <Field label="Figures shown">
        <Select value={chart.measure} disabled={!canEdit} onChange={(event) => setChart({ measure: event.target.value as typeof chart.measure })}>
          <option value="PERIOD">This period's value</option>
          <option value="CUMULATIVE">Total to date</option>
          <option value="PERCENT_OF_TARGET">Percent of target</option>
        </Select>
      </Field>
      <Check checked={Boolean(chart.showTarget)} disabled={!canEdit} onChange={(on) => setChart({ showTarget: on })} label="Draw the target as a line" />
    </div>
  );
}

/** The editor for the selected block: the fields that block has, and nothing else. */
export function BlockEditor(props: Props) {
  const { section, patch, canEdit, sheet, data } = props;
  const info = BLOCK_CATALOG[section.kind];
  const widths = spanChoices(section.kind);
  const span = section.span ?? (section.size === "HALF" ? 6 : section.size === "THIRD" ? 4 : 12);
  const locations = [...new Map([...data.activities.rows.map((r) => [r.key, r.location] as const), ...data.reach.registeredByLocation.map((r) => [r.key, r.location] as const)])];
  const kind = section.kind;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-slate-500">{info.description}</p>
      {kind !== "DIVIDER" && (
        <Field label={kind === "HERO" ? "Headline" : "Heading"} hint={kind === "HERO" ? "Leave empty to use the design's title." : undefined}>
          <Input value={section.title ?? ""} maxLength={120} disabled={!canEdit} placeholder={kind === "HERO" ? "The design's title" : info.label} onChange={(event) => patch({ title: event.target.value })} />
        </Field>
      )}

      {kind === "HERO" && (
        <>
          <Field label="Sentence under the headline">
            <Textarea rows={2} maxLength={160} value={section.text ?? ""} disabled={!canEdit} onChange={(event) => patch({ text: event.target.value })} />
          </Field>
          <Group title="Photo behind the headline" defaultOpen={Boolean(section.assetId)}>
            <ImageChoice section={section} patch={patch} canEdit={canEdit} withDetails={false} />
          </Group>
        </>
      )}
      {kind === "TEXT" && (
        <Field label="Text" hint={`${(section.text ?? "").length} of 600`}>
          <Textarea rows={6} maxLength={600} dictate value={section.text ?? ""} disabled={!canEdit} onChange={(event) => patch({ text: event.target.value })} />
        </Field>
      )}
      {kind === "BANNER" && (
        <Field label="The line">
          <Input value={section.text ?? ""} maxLength={160} disabled={!canEdit} onChange={(event) => patch({ text: event.target.value })} />
        </Field>
      )}
      {kind === "QUOTE" && (
        <>
          <Field label="What was said">
            <Textarea rows={4} maxLength={600} value={section.text ?? ""} disabled={!canEdit} onChange={(event) => patch({ text: event.target.value })} />
          </Field>
          <Field label="Who said it">
            <Input value={section.attribution ?? ""} maxLength={80} disabled={!canEdit} placeholder="A community leader, Gulu" onChange={(event) => patch({ attribution: event.target.value })} />
          </Field>
          <Group title="Photo of the speaker" defaultOpen={Boolean(section.assetId)}>
            <ImageChoice section={section} patch={patch} canEdit={canEdit} withDetails={false} />
          </Group>
        </>
      )}
      {kind === "IMAGE" && (
        <>
          <ImageChoice section={section} patch={patch} canEdit={canEdit} withDetails />
          <Field label="How the picture fits">
            <Select value={section.fit ?? "COVER"} disabled={!canEdit} onChange={(event) => patch({ fit: event.target.value as "COVER" | "CONTAIN" })}>
              <option value="COVER">Fill the space (crops the edges)</option>
              <option value="CONTAIN">Show all of it</option>
            </Select>
          </Field>
        </>
      )}
      {kind === "BIG_NUMBERS" && <BigNumbersEditor {...props} />}
      {kind === "FUNNEL" && <FunnelEditor {...props} />}
      {kind === "SECTOR_GRID" && <SectorEditor {...props} />}
      {kind === "TIMELINE" && <TimelineEditor {...props} />}
      {kind === "THREE_W" && <PresenceEditor {...props} />}
      {kind === "KEY_MESSAGES" && <MessagesEditor {...props} />}
      {kind === "CHART" && <ChartEditor {...props} />}
      {kind === "LEGEND_NOTES" && (
        <Field label="Notes (one per line)" hint="Definitions, caveats, methods. The data sources are added for you.">
          <Textarea rows={5} value={(section.notes ?? []).join("\n")} disabled={!canEdit} onChange={(event) => patch({ notes: event.target.value.split("\n").slice(0, 8).map((l) => l.slice(0, 200)) })} />
        </Field>
      )}
      {(kind === "PROGRESS_RINGS" || kind === "SMALL_MULTIPLES" || kind === "TABLE" || kind === "LOCATION_RESULTS" || kind === "KPIS") && (
        <IndicatorChecklist sheet={sheet} value={section.indicatorIds ?? []} max={kind === "PROGRESS_RINGS" ? 6 : kind === "SMALL_MULTIPLES" ? 6 : 30} disabled={!canEdit} onChange={(ids) => patch({ indicatorIds: ids })} />
      )}
      {kind === "MAP" && (
        <Field label="Map shading" hint="Pins are always drawn. Shaded areas use the boundaries built into the app, with the standard map disclaimer.">
          <Select value={section.mapMetric ?? "NONE"} disabled={!canEdit} onChange={(event) => patch({ mapMetric: event.target.value as InfographicSectionConfig["mapMetric"] })}>
            {MAP_METRIC_INFO.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {(kind === "LOCATION_RESULTS" || kind === "LOCATION_COMPARISON") && locations.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="label">Only these locations</legend>
          <div className="flex flex-wrap gap-1.5">
            {locations.map(([key, name]) => {
              const on = (section.locationKeys ?? []).includes(key);
              return (
                <button key={key} type="button" aria-pressed={on} disabled={!canEdit} onClick={() => patch({ locationKeys: on ? (section.locationKeys ?? []).filter((k) => k !== key) : [...(section.locationKeys ?? []), key] })} className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 text-slate-600"}`}>
                  {name}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500">{(section.locationKeys ?? []).length === 0 ? "None chosen: all locations." : ""}</p>
        </fieldset>
      )}

      {kind !== "DIVIDER" && widths.length > 1 && (
        <Field label="Width on the page">
          <Select value={String(span)} disabled={!canEdit} onChange={(event) => patch({ span: Number(event.target.value) })}>
            {widths.map((w) => (
              <option key={w} value={w}>
                {SPAN_LABEL[w]}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Check checked={Boolean(section.pageBreakBefore)} disabled={!canEdit} onChange={(on) => patch({ pageBreakBefore: on || undefined })} label="Start a new page here" hint="Print formats only; on a card it starts the next card." />
    </div>
  );
}
