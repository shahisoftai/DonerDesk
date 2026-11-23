"use client";

import { cloneElement, isValidElement, useId, type ReactElement } from "react";
import { HOW_VERIFIED, isNotApplicable, type FormField, type HowVerified } from "@donordesk/domain/contexts/collection/index.js";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { FillContext } from "./field-types";

/**
 * The frame every question shares: its label and instructions, "not applicable", and how the answer was established. The control itself
 * is passed in, so a type never repeats this. A question marked not applicable shows its reason box instead of the control.
 */
export function FieldFrame({ field, label, value, onChange, error, how, onHow, ctx, children }: {
  field: FormField;
  label: string;
  value: unknown;
  onChange(value: unknown): void;
  error: string | undefined;
  how?: HowVerified | undefined;
  onHow?: ((mode: HowVerified | undefined) => void) | undefined;
  ctx: FillContext;
  children: React.ReactNode;
}) {
  const { t } = ctx;
  const na = isNotApplicable(value);
  // The question's own control carries this id, so its label names it for a screen reader (the frame wraps the control, so the Field cannot do it).
  const id = useId();
  const control = isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children;
  return (
    <Field label={label} htmlFor={id} {...(field.help ? { description: field.help } : {})} error={error}>
      <div id={`${id}-frame`} className="space-y-2">
        {na ? (
          <Input id={id} aria-label={t("assess.na.why")} placeholder={t("assess.na.why")} value={String((value as { reason?: string }).reason ?? "")} disabled={ctx.readOnly} onChange={(e) => onChange({ na: true, reason: e.target.value })} maxLength={300} />
        ) : control}
        <div className="flex flex-wrap items-center gap-3">
          {field.allowNotApplicable && !ctx.readOnly && (
            <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={na} onChange={(e) => onChange(e.target.checked ? { na: true } : undefined)} />
              {t("assess.na")}
            </label>
          )}
          {field.verify && onHow && !na && (
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span>{t("assess.how.label")}</span>
              <Select value={how ?? ""} disabled={ctx.readOnly} onChange={(e) => onHow(e.target.value ? (e.target.value as HowVerified) : undefined)}>
                <option value="">{t("common.choose")}</option>
                {HOW_VERIFIED.map((m) => <option key={m} value={m}>{t(`assess.how.${m}`)}</option>)}
              </Select>
            </label>
          )}
        </div>
      </div>
    </Field>
  );
}

/** Frames a control for a field view: the label (optional ones say so), the error at this path, and how it was established. */
export function framed(p: { field: FormField; value: unknown; onChange(value: unknown): void; prefix: string; ctx: FillContext }, control: React.ReactNode): React.ReactNode {
  const { field, ctx, prefix } = p;
  const label = field.required ? field.label : ctx.t("common.optional", { label: field.label });
  const top = prefix === "";
  return (
    <FieldFrame field={field} label={label} value={p.value} onChange={p.onChange} error={ctx.problemAt(prefix + field.key)} how={top ? ctx.how[field.key] : undefined} onHow={top ? (m) => ctx.setHow(field.key, m) : undefined} ctx={ctx}>
      {control}
    </FieldFrame>
  );
}
