"use client";

import { useState } from "react";
import {
  INFOGRAPHIC_FORMATS,
  INFOGRAPHIC_FORMAT_IDS,
  INFOGRAPHIC_LANGUAGES,
  INFOGRAPHIC_LANGUAGE_LABEL,
  INFOGRAPHIC_PROFILES,
  INFOGRAPHIC_THEMES,
  INFOGRAPHIC_THEME_ORDER,
  resolveFormat,
  resolveTheme,
  type InfographicConfig,
} from "@donordesk/domain/contexts/infographics/index.js";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { InfographicData } from "../../domain/studio-view";
import { PROFILE_INFO } from "../../domain/studio-copy";
import { AssetLibrary } from "./AssetLibrary";
import { AssetThumb, Check, Group, PanelHeading } from "./primitives";

interface Props {
  config: InfographicConfig;
  onChange: (changes: Partial<InfographicConfig>, key?: string) => void;
  data: InfographicData;
  canEdit: boolean;
  hasBrandKit: boolean;
  onOpenBrand: () => void;
  scope?: "PROJECT" | "PORTFOLIO";
}

/** The design as a whole: what it is for, its page, its look, its language, its funders. Block-by-block settings live beside the picture. */
export function DesignPanel({ config, onChange, data, canEdit, hasBrandKit, onOpenBrand, scope = "PROJECT" }: Props) {
  const [library, setLibrary] = useState<"COVER" | "LOGO" | undefined>();
  const theme = resolveTheme(config.themeId);
  const format = resolveFormat(config.format);
  const profile = config.profile ?? "INTERNAL";
  const logos = config.donorLogoAssetIds ?? [];
  const periods = data.periods;
  return (
    <div className="space-y-3 text-sm">
      <PanelHeading>Design</PanelHeading>
      <Field label="Title">
        <Input value={config.title ?? ""} maxLength={120} disabled={!canEdit} placeholder="Say what the page is about" onChange={(event) => onChange({ title: event.target.value }, "title")} />
      </Field>
      <Field label="Line under the title">
        <Input value={config.subtitle ?? ""} maxLength={160} disabled={!canEdit} onChange={(event) => onChange({ subtitle: event.target.value }, "subtitle")} />
      </Field>
      <Field label="What it is for" hint={PROFILE_INFO[profile].description}>
        <Select value={profile} disabled={!canEdit} onChange={(event) => onChange({ profile: event.target.value as InfographicConfig["profile"] })}>
          {INFOGRAPHIC_PROFILES.map((p) => (
            <option key={p} value={p}>
              {PROFILE_INFO[p].label}
            </option>
          ))}
        </Select>
      </Field>

      <Group title="Page">
        <Field label="Size" hint={format.description}>
          <Select value={format.id} disabled={!canEdit} onChange={(event) => onChange({ format: event.target.value })}>
            {INFOGRAPHIC_FORMAT_IDS.map((id) => (
              <option key={id} value={id}>
                {INFOGRAPHIC_FORMATS[id].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Language of the fixed words" hint="Words you type are never translated.">
          <Select value={config.language ?? "en"} disabled={!canEdit} onChange={(event) => onChange({ language: event.target.value })}>
            {INFOGRAPHIC_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {INFOGRAPHIC_LANGUAGE_LABEL[l]}
              </option>
            ))}
          </Select>
        </Field>
      </Group>

      <Group title="Look">
        <Field label="Theme" hint={theme.description}>
          <Select value={config.themeId ?? "DEFAULT"} disabled={!canEdit} onChange={(event) => onChange({ themeId: event.target.value })}>
            {INFOGRAPHIC_THEME_ORDER.map((id) => (
              <option key={id} value={id}>
                {INFOGRAPHIC_THEMES[id].label}
              </option>
            ))}
            {hasBrandKit && <option value="BRAND">Organization brand</option>}
          </Select>
        </Field>
        <div className="flex gap-1" aria-hidden="true">
          {theme.palette.map((color) => (
            <span key={color} className="h-4 w-4 rounded-full border border-black/10" style={{ background: color }} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onOpenBrand}>
            {hasBrandKit ? "Brand kit" : "Set up a brand kit"}
          </Button>
          <Check checked={Boolean(config.branding)} disabled={!canEdit || !hasBrandKit} onChange={(on) => onChange({ branding: on || undefined })} label="Use the brand's footer line and logo" />
        </div>
      </Group>

      {scope === "PROJECT" && <Group title="Data" defaultOpen={false}>
        <Field label="From period">
          <Select value={config.periodFromId ?? ""} disabled={!canEdit} onChange={(event) => onChange({ periodFromId: event.target.value || undefined })}>
            <option value="">First period</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="To period">
          <Select value={config.periodToId ?? ""} disabled={!canEdit} onChange={(event) => onChange({ periodToId: event.target.value || undefined })}>
            <option value="">Latest period</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
      </Group>}

      <Group title="Funders and credits" defaultOpen={Boolean(config.acknowledgement || logos.length)}>
        <Field label="Thank-you line" hint="Printed in the footer of every page.">
          <Input value={config.acknowledgement ?? ""} maxLength={200} disabled={!canEdit} placeholder="With funding from …" onChange={(event) => onChange({ acknowledgement: event.target.value }, "ack")} />
        </Field>
        <div>
          <p className="label">Partner logos (up to three)</p>
          <div className="flex flex-wrap items-center gap-2">
            {logos.map((id) => (
              <span key={id} className="relative">
                <AssetThumb id={id} className="h-10 w-16 rounded border border-slate-200 bg-white object-contain" alt="" />
                {canEdit && (
                  <button type="button" aria-label="Remove this logo" className="absolute -right-1 -top-1 rounded-full bg-slate-700 px-1 text-[10px] text-white" onClick={() => onChange({ donorLogoAssetIds: logos.filter((x) => x !== id) })}>
                    ✕
                  </button>
                )}
              </span>
            ))}
            {canEdit && logos.length < 3 && (
              <Button size="sm" variant="secondary" onClick={() => setLibrary("LOGO")}>
                Add a logo
              </Button>
            )}
          </div>
        </div>
        <div>
          <p className="label">Cover picture</p>
          <div className="flex items-center gap-2">
            {config.coverAssetId ? <AssetThumb id={config.coverAssetId} className="h-12 w-20 rounded" alt="" /> : <span className="text-xs text-slate-500">None. A headline banner uses it behind its title.</span>}
            {canEdit && (
              <Button size="sm" variant="secondary" onClick={() => setLibrary("COVER")}>
                {config.coverAssetId ? "Change" : "Choose"}
              </Button>
            )}
            {canEdit && config.coverAssetId && (
              <Button size="sm" variant="ghost" onClick={() => onChange({ coverAssetId: undefined })}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </Group>

      {scope === "PROJECT" && (
        <Group title="Keep it up to date" defaultOpen={Boolean(config.autoRefresh)}>
          <Check checked={Boolean(config.autoRefresh)} disabled={!canEdit} onChange={(on) => onChange({ autoRefresh: on || undefined })} label="Prepare a new draft when a report is approved" hint="When a report for a period is approved, a copy of this design up to that period is made as a draft and its author is told. Nothing is published for you." />
        </Group>
      )}

      <Group title="Maps" defaultOpen={false}>
        <Check checked={config.mapDisclaimer !== false} disabled={!canEdit} onChange={(on) => onChange({ mapDisclaimer: on ? undefined : false })} label="Print the map disclaimer under maps" hint="The standard United Nations wording, in the page's language. A donor report needs it." />
      </Group>

      <AssetLibrary
        open={library !== undefined}
        onClose={() => setLibrary(undefined)}
        kind={library === "LOGO" ? "LOGO" : "IMAGE"}
        canEdit={canEdit}
        onChoose={(asset) => {
          if (library === "LOGO") onChange({ donorLogoAssetIds: [...logos, asset.id].slice(0, 3) });
          else onChange({ coverAssetId: asset.id });
          setLibrary(undefined);
        }}
      />
    </div>
  );
}
