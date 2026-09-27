"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogframeLevelSchema } from "@donordesk/contracts";
import { createLogframeItemAction } from "@/lib/actions/logframe";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { LOGFRAME_LEVEL_LABEL } from "@/lib/labels";
import { eligibleParents, logframeLevelRank, type OutlineSource } from "@/features/logframe/domain/logframe-outline";
import { LogframeItemSelect } from "./LogframeItemSelect";

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
  const initialParent = items.find((item) => item.id === initialParentId);
  const [level, setLevel] = useState(levelBelow(initialParent?.level));
  const [parentId, setParentId] = useState(initialParent?.id ?? "");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parents = eligibleParents(items, { level });

  function changeLevel(next: string) {
    setLevel(next);
    if (parentId && !eligibleParents(items, { level: next }).some((item) => item.id === parentId)) setParentId("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await createLogframeItemAction({
      projectId,
      parentId: parentId || undefined,
      level,
      code: code || undefined,
      title,
      description: description || undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.push(`/projects/${projectId}/logframe`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Level" htmlFor="level">
          <Select id="level" value={level} onChange={(event) => changeLevel(event.target.value)}>
            {LEVELS.map((option) => <option key={option} value={option}>{LOGFRAME_LEVEL_LABEL[option] ?? option}</option>)}
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
        <textarea id="description" className="input" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} />
      </Field>
      {error && <InlineAlert tone="danger" title={error} />}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" pending={busy}>Save item</Button>
      </div>
    </form>
  );
}
