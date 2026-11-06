"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDashboardAction } from "@/lib/actions/dashboards";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

/** Starts an empty dashboard; charts are added from the Data Center. */
export function NewDashboardForm({ canShare, projects, projectId }: { canShare: boolean; projects: Array<{ id: string; name: string }>; projectId?: string }) {
  const router = useRouter();
  const act = useActionState();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"MINE" | "ORG" | "PROJECT">(projectId ? "PROJECT" : "MINE");
  const [project, setProject] = useState(projectId ?? projects[0]?.id ?? "");

  async function create() {
    const r = await act.run(() => saveDashboardAction({ name, scope, ...(scope === "PROJECT" ? { projectId: project } : {}), widgets: [] }));
    if (r && typeof r === "object") router.push(`/dashboards/${r.id}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
      <Field label="Who sees it">
        <Select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
          <option value="MINE">Only me</option>
          {canShare && <option value="ORG">The whole organisation</option>}
          {canShare && projects.length > 0 && <option value="PROJECT">One project</option>}
        </Select>
      </Field>
      {scope === "PROJECT" && <Field label="Project"><Select value={project} onChange={(e) => setProject(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>}
      <Button onClick={() => void create()} pending={act.busy} disabled={!name.trim() || act.busy}>Create</Button>
      {act.error && <p role="alert" className="w-full text-sm text-danger-600">{act.error}</p>}
    </div>
  );
}
