"use client";

import { CONDITIONAL_ICONS, CONDITIONAL_KINDS, RULE_OPERATORS, type ColourChoice, type ConditionalBand, type ConditionalRule } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { ColorField } from "./ColorField";

interface Props { value: ConditionalRule[] | undefined; card: string; resolve: (c: ColourChoice) => string; onChange: (v: ConditionalRule[] | undefined) => void }

const SEL = "rounded border border-slate-300 bg-white px-1 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-900";
const NUM = "w-20 rounded border border-slate-300 bg-white px-1 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-900";
const BAND: ConditionalBand = { op: "GTE", value: 0, color: { role: "good" } };

function fresh(kind: ConditionalRule["kind"]): ConditionalRule {
  switch (kind) {
    case "GRADIENT": return { kind, target: "background", min: { role: "bad" }, max: { role: "good" } };
    case "RULES": return { kind, target: "background", bands: [{ op: "LT", value: 50, color: { role: "bad" } }, { op: "GTE", value: 50, color: { role: "good" } }] };
    case "ICONS": return { kind, bands: [{ op: "GTE", value: 0, color: { role: "good" }, icon: "UP" }] };
    case "DATA_BARS": return { kind, color: { role: "accent" }, showValue: true };
  }
}

/** Conditional formatting rules (Phase 50.2): a colour scale, colour bands, icons or data bars. A gap is never coloured; the note says so. */
export function ConditionalRulesField({ value, card, resolve, onChange }: Props) {
  const { t } = useI18n();
  const rules = value ?? [];
  const put = (i: number, r: ConditionalRule | null) => { const next = rules.slice(); if (r) next[i] = r; else next.splice(i, 1); onChange(next.length ? next : undefined); };
  const bandRow = (rule: Extract<ConditionalRule, { bands: ConditionalBand[] }>, i: number, j: number) => {
    const b = rule.bands[j]!;
    const setBand = (nb: ConditionalBand) => put(i, { ...rule, bands: rule.bands.map((x, k) => (k === j ? nb : x)) });
    return (
      <li key={j} className="space-y-1 rounded bg-slate-50 p-2 dark:bg-slate-800">
        <div className="flex flex-wrap items-center gap-1">
          <select aria-label={t("rules.op.GTE")} className={SEL} value={b.op} onChange={(e) => setBand({ ...b, op: e.target.value as ConditionalBand["op"] })}>{RULE_OPERATORS.map((o) => <option key={o} value={o}>{t(`rules.op.${o}` as never)}</option>)}</select>
          <input type="number" className={NUM} aria-label="value" value={b.value} onChange={(e) => setBand({ ...b, value: Number(e.target.value) })} />
          {b.op === "BETWEEN" && <><span className="text-xs">{t("rules.and")}</span><input type="number" className={NUM} aria-label="to" value={b.to ?? ""} onChange={(e) => setBand({ ...b, to: Number(e.target.value) })} /></>}
          {rule.kind === "ICONS" && <select aria-label={t("rules.icon")} className={SEL} value={b.icon ?? "UP"} onChange={(e) => setBand({ ...b, icon: e.target.value as ConditionalBand["icon"] })}>{CONDITIONAL_ICONS.map((ic) => <option key={ic} value={ic}>{t(`rules.icon.${ic}` as never)}</option>)}</select>}
          <button type="button" className="ms-auto text-xs text-red-700 underline" onClick={() => put(i, { ...rule, bands: rule.bands.filter((_, k) => k !== j) })}>{t("rules.remove")}</button>
        </div>
        <ColorField label={t("format.f.color")} value={b.color} card={card} resolve={resolve} onChange={(c) => c && setBand({ ...b, color: c })} />
      </li>
    );
  };
  return (
    <div className="space-y-2" data-testid="conditional-rules">
      {rules.map((rule, i) => (
        <div key={i} className="space-y-2 rounded border border-slate-200 p-2 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <select aria-label={t("format.conditional")} className={SEL} value={rule.kind} onChange={(e) => put(i, fresh(e.target.value as ConditionalRule["kind"]))}>{CONDITIONAL_KINDS.map((k) => <option key={k} value={k}>{t(`rules.kind.${k}` as never)}</option>)}</select>
            {"target" in rule && <select aria-label={t("rules.target")} className={SEL} value={rule.target} onChange={(e) => put(i, { ...rule, target: e.target.value as "background" | "text" })}><option value="background">{t("rules.target.background")}</option><option value="text">{t("rules.target.text")}</option></select>}
            <button type="button" className="ms-auto text-xs text-red-700 underline" onClick={() => put(i, null)}>{t("rules.remove")}</button>
          </div>
          {rule.kind === "GRADIENT" && (["min", "mid", "max"] as const).map((k) => <ColorField key={k} label={t(`rules.${k}` as never)} value={rule[k]} card={card} resolve={resolve} onChange={(c) => put(i, k === "mid" ? { ...rule, mid: c } : c ? { ...rule, [k]: c } : rule)} />)}
          {rule.kind === "DATA_BARS" && <ColorField label={t("format.f.color")} value={rule.color} card={card} resolve={resolve} onChange={(c) => c && put(i, { ...rule, color: c })} />}
          {(rule.kind === "RULES" || rule.kind === "ICONS") && <><ul className="space-y-1">{rule.bands.map((_, j) => bandRow(rule, i, j))}</ul><button type="button" className="text-xs text-sky-700 underline" onClick={() => put(i, { ...rule, bands: [...rule.bands, { ...BAND, ...(rule.kind === "ICONS" ? { icon: "DOT" as const } : {}) }] })}>{t("rules.addBand")}</button></>}
        </div>
      ))}
      {rules.length < 4 && <button type="button" className="text-xs text-sky-700 underline" onClick={() => onChange([...rules, fresh("RULES")])}>{t("rules.add")}</button>}
      <p className="text-xs text-slate-500">{t("rules.gapNote")}</p>
    </div>
  );
}
