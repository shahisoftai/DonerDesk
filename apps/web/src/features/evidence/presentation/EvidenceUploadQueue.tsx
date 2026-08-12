"use client";

import { useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadEvidenceAction } from "@/lib/actions/evidence";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { FileDropzone } from "@/components/editor/FileDropzone";
import { EVIDENCE_TYPE_LABEL, CONFIDENTIALITY_LABEL, EVIDENCE_TYPE_OPTIONS, CONFIDENTIALITY_OPTIONS } from "@/lib/labels";
import {
  uploadReducer,
  titleFromFile,
  countByState,
  type UploadItem,
} from "./upload-queue";

export function EvidenceUploadQueue({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [items, dispatch] = useReducer(uploadReducer, [] as UploadItem[]);

  const [evidenceType, setEvidenceType] = useState("OTHER");
  const [confidentialityLevel, setConfidentialityLevel] = useState("INTERNAL");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const uploading = countByState(items, "uploading");
  const success = countByState(items, "success");
  const errors = countByState(items, "error");
  const queued = countByState(items, "queued");

  function addFiles(files: File[]) {
    const valid = files.filter((f) => f.size > 0);
    dispatch({
      type: "add",
      files: valid.map((f) => ({ file: f, title: titleFromFile(f) })),
    });
  }

  async function uploadItem(item: UploadItem): Promise<{ ok: boolean }> {
    const fd = new FormData();
    fd.append("projectId", projectId);
    fd.append("title", item.title.trim());
    fd.append("evidenceType", evidenceType);
    fd.append("confidentialityLevel", confidentialityLevel);
    if (location) fd.append("location", location);
    if (notes) fd.append("notes", notes);
    fd.append("file", item.file);

    const result = await uploadEvidenceAction(fd);
    if (!result.ok) {
      dispatch({ type: "fail", key: item.key, error: result.error.message });
      return { ok: false };
    }
    dispatch({ type: "success", key: item.key, id: result.value.id });
    return { ok: true };
  }

  async function uploadAll() {
    let failed = false;
    for (const item of items) {
      if (item.state !== "queued") continue;
      dispatch({ type: "start", key: item.key });
      const uploaded = await uploadItem({ ...item, state: "uploading" });
      if (!uploaded.ok) failed = true;
    }
    if (!failed) {
      router.push(`/projects/${projectId}/evidence`);
      router.refresh();
    }
  }

  return (
    <div className="card mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Evidence type">
          <Select value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
            {EVIDENCE_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{EVIDENCE_TYPE_LABEL[t] ?? t.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </Field>
        <Field label="Confidentiality">
          <Select value={confidentialityLevel} onChange={(e) => setConfidentialityLevel(e.target.value)}>
            {CONFIDENTIALITY_OPTIONS.map((c) => (
              <option key={c} value={c}>{CONFIDENTIALITY_LABEL[c]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Location (optional)">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </div>

      <FileDropzone
        onFiles={addFiles}
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.csv,.txt"
        label="Drop files here or click to browse"
        hint="You can select multiple files. Each is uploaded separately."
      />

      {items.length > 0 && (
        <ul aria-label="Upload queue" className="space-y-2">
          {items.map((item) => (
            <li key={item.key} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <div className="min-w-0 flex-1">
                <Input
                  aria-label="File title"
                  value={item.title}
                  onChange={(e) => dispatch({ type: "set-title", key: item.key, title: e.target.value })}
                  disabled={item.state === "uploading" || item.state === "success"}
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {item.file.name} · {stateLabel(item.state)}
                  {item.error ? ` — ${item.error}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {item.state === "queued" && (
                  <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "remove", key: item.key })}>
                    Remove
                  </Button>
                )}
                {item.state === "error" && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "retry", key: item.key })}>
                      Retry
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "remove", key: item.key })}>
                      Remove
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {queued > 0 && `${queued} waiting · `}
            {uploading > 0 && `${uploading} uploading · `}
            {success > 0 && `${success} uploaded · `}
            {errors > 0 && `${errors} failed`}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
            <Button onClick={uploadAll} pending={uploading > 0} disabled={queued === 0}>
              Upload {queued > 0 ? `${queued} file${queued > 1 ? "s" : ""}` : "files"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function stateLabel(state: string): string {
  switch (state) {
    case "queued":
      return "Waiting";
    case "uploading":
      return "Uploading…";
    case "success":
      return "Uploaded";
    case "error":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return state;
  }
}
