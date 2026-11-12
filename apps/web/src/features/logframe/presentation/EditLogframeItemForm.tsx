"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { updateLogframeItemAction } from "@/lib/actions/logframe";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

export interface EditableLogframeItem {
  id: string;
  title: string;
  description?: string | undefined;
  assumptions?: string | undefined;
  rationale?: string | undefined;
}

/** Corrects the words of a result. Its level, code and place are not changed here. */
export function EditLogframeItemForm({ item, onDone }: { item: EditableLogframeItem; onDone: () => void }) {
  const router = useRouter();
  const { t } = useI18n();
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [assumptions, setAssumptions] = useState(item.assumptions ?? "");
  const [rationale, setRationale] = useState(item.rationale ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await updateLogframeItemAction(item.id, { title: title.trim(), description, assumptions, rationale });
    setBusy(false);
    if (!result.ok) return setError(result.error.message);
    onDone();
    router.refresh();
  }

  return (
    <div className="card mt-2 space-y-3" role="group" aria-label={`Edit ${item.title}`}>
      <Field label={t("framework.edit.title")} htmlFor={`edit-title-${item.id}`}>
        <Input id={`edit-title-${item.id}`} value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label={t("framework.edit.description")} htmlFor={`edit-desc-${item.id}`}>
        <Textarea dictate id={`edit-desc-${item.id}`} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label={t("framework.edit.rationale")} htmlFor={`edit-rationale-${item.id}`} hint={t("framework.edit.rationaleHint")}>
        <Textarea dictate id={`edit-rationale-${item.id}`} value={rationale} maxLength={4000} onChange={(e) => setRationale(e.target.value)} />
      </Field>
      <Field label={t("framework.edit.assumptions")} htmlFor={`edit-assumptions-${item.id}`} hint={t("framework.edit.assumptionsHint")}>
        <Textarea dictate id={`edit-assumptions-${item.id}`} value={assumptions} maxLength={4000} onChange={(e) => setAssumptions(e.target.value)} />
      </Field>
      {error && <p role="alert" className="text-sm text-danger-700 dark:text-danger-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onDone} disabled={busy}>{t("framework.edit.cancel")}</Button>
        <Button type="button" size="sm" onClick={() => void save()} pending={busy} disabled={title.trim().length < 2}>{t("framework.edit.save")}</Button>
      </div>
    </div>
  );
}
