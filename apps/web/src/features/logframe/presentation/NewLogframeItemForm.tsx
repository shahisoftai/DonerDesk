"use client";

import { useActionState } from "@/lib/client/action-state";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogframeLevelSchema } from "@donordesk/contracts";
import { createLogframeItemAction } from "@/lib/actions/logframe";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { useLevelName } from "./FrameworkVocabularyProvider";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { eligibleParents, logframeLevelRank, type OutlineSource } from "@/features/logframe/domain/logframe-outline";
import { LogframeItemSelect } from "./LogframeItemSelect";
import { Textarea } from "@/components/ui/Textarea";

const LEVELS = LogframeLevelSchema.options;

function levelBelow(level: string | undefined): string {
  if (!level) return LEVELS[0];
  return LEVELS[Math.min(logframeLevelRank(level) + 1, LEVELS.length - 1)] ?? level;
}

export function NewLogframeItemForm({
  projectId,
  items,
  initialParentId,
}: {
  projectId: string;
  items: OutlineSource[];
  initialParentId?: string;
}) {
  const router = useRouter();
  const levelName = useLevelName();
  const { t } = useI18n();
  const initialParent = items.find((item) => item.id === initialParentId);
  const [level, setLevel] = useState(levelBelow(initialParent?.level));
  const [parentId, setParentId] = useState(initialParent?.id ?? "");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rationale, setRationale] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const save = useActionState();

  const parents = eligibleParents(items, { level });

  function changeLevel(next: string) {
    setLevel(next);
    if (parentId && !eligibleParents(items, { level: next }).some((item) => item.id === parentId)) setParentId("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // One key for this form: a double click or a repeat after a timeout never saves the item twice.
    const result = await save.runCreate((idempotencyKey) =>
      createLogframeItemAction(
        {
          projectId,
          parentId: parentId || undefined,
          level,
          code: code || undefined,
          title,
          description: description || undefined,
          rationale: rationale || undefined,
          assumptions: assumptions || undefined,
        },
        { idempotencyKey },
      ),
    );
    if (!result) return;
    router.push(`/projects/${projectId}/logframe`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Level" htmlFor="level">
          <Select id="level" value={level} onChange={(event) => changeLevel(event.target.value)}>
            {LEVELS.map((option) => <option key={option} value={option}>{levelName(option)}</option>)}
          </Select>
        </Field>
        <Field label="Code (optional)" htmlFor="code">
          <Input id="code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="e.g. O1.2" maxLength={50} />
        </Field>
      </div>
      <Field
        label="Belongs under"
        htmlFor="parentId"
        description={parents.length === 0 ? "Nothing sits above this level yet, so it will be a top-level item." : "Only higher-level items can be parents."}
      >
        <LogframeItemSelect id="parentId" items={parents} value={parentId} onChange={setParentId} emptyLabel="Top level (no parent)" />
      </Field>
      <Field label="Title" htmlFor="title">
        <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} maxLength={300} />
      </Field>
      <Field label="Description (optional)" htmlFor="description">
        <Textarea dictate id="description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} />
      </Field>
      <details className="rounded border border-slate-200 p-3 dark:border-white/10">
        <summary className="cursor-pointer text-sm font-medium">{t("framework.logic.summary")}</summary>
        <div className="mt-3 space-y-4">
          <Field label={t("framework.edit.rationale")} htmlFor="rationale" hint={t("framework.edit.rationaleHint")}>
            <Textarea dictate id="rationale" value={rationale} onChange={(event) => setRationale(event.target.value)} maxLength={4000} />
          </Field>
          <Field label={t("framework.edit.assumptions")} htmlFor="assumptions" hint={t("framework.edit.assumptionsHint")}>
            <Textarea dictate id="assumptions" value={assumptions} onChange={(event) => setAssumptions(event.target.value)} maxLength={4000} />
          </Field>
        </div>
      </details>
      {save.error && <InlineAlert tone="danger" title={save.error} />}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" pending={save.busy}>{save.waiting ? "Still saving…" : "Save item"}</Button>
      </div>
    </form>
  );
}
