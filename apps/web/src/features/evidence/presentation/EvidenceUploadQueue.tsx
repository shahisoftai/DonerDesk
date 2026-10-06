"use client";

import { useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadEvidenceAction } from "@/lib/actions/evidence";
import { linkDriveEvidenceAction } from "@/lib/actions/drive";
import { fileIdempotencyKey, newIdempotencyKey, retryWhileUnavailable } from "@/lib/shared/create-retry";
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
  driveFileIdFromLink,
  fileTypeForName,
  countByState,
  type UploadItem,
} from "./upload-queue";

export function EvidenceUploadQueue({
  projectId,
  storageProvider = "LOCAL",
  activities = [],
  indicators = [],
  periods = [],
  initialActivityId,
}: {
  projectId: string;
  storageProvider?: string;
  /** What a file can be attached to. Attaching on upload makes the file count as proof straight away. */
  activities?: Array<{ id: string; label: string; periodLabel?: string }>;
  /** Set when the form is opened from an activity ("Add evidence"), so the link is already chosen. */
  initialActivityId?: string;
  indicators?: Array<{ id: string; label: string }>;
  periods?: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  // Scopes the per-file keys to this visit: adding the same file again later is a new upload.
  const sessionKey = useRef(newIdempotencyKey());
  const [items, dispatch] = useReducer(uploadReducer, [] as UploadItem[]);

  const [evidenceType, setEvidenceType] = useState("OTHER");
  const [confidentialityLevel, setConfidentialityLevel] = useState("INTERNAL");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [activityId, setActivityId] = useState(initialActivityId && activities.some((a) => a.id === initialActivityId) ? initialActivityId : "");
  const [indicatorId, setIndicatorId] = useState("");
  const [reportingPeriodId, setReportingPeriodId] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [driveLinkError, setDriveLinkError] = useState<string | null>(null);

  const driveMode = storageProvider === "GOOGLE_DRIVE";

  const uploading = countByState(items, "uploading");
  const success = countByState(items, "success");
  const errors = countByState(items, "error");
  const queued = countByState(items, "queued");

  function addFiles(files: File[]) {
    const valid = files.filter((f) => f.size > 0);
    dispatch({
      type: "add",
      items: valid.map((f) => ({ file: f, title: titleFromFile(f) })),
    });
  }

  function addDriveLink() {
    const id = driveFileIdFromLink(driveLink);
    if (!id) {
      setDriveLinkError("Enter a valid Google Drive share link or file ID.");
      return;
    }
    setDriveLinkError(null);
    const trimmed = driveLink.trim();
    const isUrl = /^https?:\/\//i.test(trimmed);
    dispatch({
      type: "add",
      items: [{ driveFileId: id, driveWebLink: isUrl ? trimmed : undefined, title: id }],
    });
    setDriveLink("");
  }

  async function uploadItem(item: UploadItem): Promise<{ ok: boolean }> {
    const common = {
      evidenceType: evidenceType as "OTHER" | "ATTENDANCE_SHEET" | "PHOTO" | "DISTRIBUTION_LIST" | "TRAINING_RECORD" | "FIELD_VISIT_REPORT" | "MONITORING_REPORT" | "KOBO_ODK_EXPORT" | "PROCUREMENT_DOCUMENT" | "APPROVAL_DOCUMENT" | "BENEFICIARY_LIST" | "MEETING_MINUTES" | "CASE_STUDY" | "FINANCIAL_DOCUMENT" | "SUPPLIER_DOCUMENT" | "DONOR_COMMUNICATION",
      confidentialityLevel: confidentialityLevel as "PUBLIC" | "INTERNAL" | "SENSITIVE" | "HIGHLY_SENSITIVE",
      location: location || undefined,
      notes: notes || undefined,
      activityId: activityId || undefined,
      indicatorId: indicatorId || undefined,
      reportingPeriodId: reportingPeriodId || undefined,
    };

    const result = item.driveFileId
      ? await linkDriveEvidenceAction({
          projectId,
          title: item.title.trim() || item.driveFileId,
          fileName: item.title.trim() || item.driveFileId,
          fileType: fileTypeForName(item.title.trim() || item.driveFileId),
          driveFileId: item.driveFileId,
          driveWebLink: item.driveWebLink,
          ...common,
        })
      : // Each file has its own key, kept across the retries below and a manual "Retry": a file that timed out but was
        // saved is answered from the first save instead of being stored twice.
        await retryWhileUnavailable(() => uploadEvidenceAction(buildFormData(item, projectId, common), { idempotencyKey: fileIdempotencyKey(sessionKey.current, item.key) }));

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

      {(activities.length > 0 || indicators.length > 0) && (
        <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-white/10">
          <legend className="px-1 text-xs font-medium text-slate-600 dark:text-slate-300">Use as proof for (optional)</legend>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Choosing an activity or indicator attaches the file to it, so reports use it as evidence. You can change this later.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {activities.length > 0 && (
              <Field label="Activity">
                <Select value={activityId} onChange={(e) => setActivityId(e.target.value)}>
                  <option value="">None</option>
                  {activities.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </Select>
              </Field>
            )}
            {indicators.length > 0 && (
              <Field label="Indicator">
                <Select value={indicatorId} onChange={(e) => setIndicatorId(e.target.value)}>
                  <option value="">None</option>
                  {indicators.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                </Select>
              </Field>
            )}
            {indicatorId && !activityId && periods.length > 0 && (
              <Field label="For reporting period">
                <Select value={reportingPeriodId} onChange={(e) => setReportingPeriodId(e.target.value)}>
                  <option value="">Choose a period…</option>
                  {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </Select>
              </Field>
            )}
          </div>
          {activityId && activities.find((a) => a.id === activityId)?.periodLabel && (
            <p role="status" className="text-xs text-slate-600 dark:text-slate-300">
              Reporting period: {activities.find((a) => a.id === activityId)?.periodLabel} (taken from the activity)
            </p>
          )}
        </fieldset>
      )}

      <FileDropzone
        onFiles={addFiles}
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.csv,.txt"
        label={driveMode ? "Drop files here or click to browse — saved to your project's Google Drive folder" : "Drop files here or click to browse"}
        hint={driveMode ? "You can select multiple files. Each is uploaded into your project's Evidence folder in Google Drive." : "You can select multiple files. Each is uploaded separately."}
      />

      {driveMode && (
        <Field
          label="Or link an existing Google Drive file"
          htmlFor="driveLink"
          error={driveLinkError ?? undefined}
          hint="Paste a Google Drive share link (e.g. https://drive.google.com/file/d/.../view) or a file ID to reference a file that is already in your Drive."
        >
          <div className="flex gap-2">
            <Input
              id="driveLink"
              value={driveLink}
              onChange={(e) => {
                setDriveLink(e.target.value);
                setDriveLinkError(null);
              }}
              placeholder="https://drive.google.com/file/d/…/view"
            />
            <Button type="button" variant="secondary" onClick={addDriveLink} disabled={!driveLink.trim()}>
              Add to queue
            </Button>
          </div>
        </Field>
      )}

      {items.length > 0 && (
        <ul aria-label="Upload queue" className="space-y-2">
          {items.map((item) => (
            <li key={item.key} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <div className="min-w-0 flex-1">
                <Input
                  aria-label="Evidence title"
                  value={item.title}
                  onChange={(e) => dispatch({ type: "set-title", key: item.key, title: e.target.value })}
                  disabled={item.state === "uploading" || item.state === "success"}
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {item.file ? item.file.name : item.driveFileId} · {stateLabel(item.state)}
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
            {success > 0 && `${success} completed · `}
            {errors > 0 && `${errors} failed`}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
            <Button onClick={uploadAll} pending={uploading > 0} disabled={queued === 0}>
              {driveMode ? "Save" : "Upload"} {queued > 0 ? `${queued} file${queued > 1 ? "s" : ""}` : "files"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildFormData(
  item: UploadItem,
  projectId: string,
  common: {
    evidenceType: string;
    confidentialityLevel: string;
    location?: string;
    notes?: string;
    activityId?: string;
    indicatorId?: string;
    reportingPeriodId?: string;
  },
): FormData {
  const fd = new FormData();
  fd.append("projectId", projectId);
  fd.append("title", item.title.trim());
  fd.append("evidenceType", common.evidenceType);
  fd.append("confidentialityLevel", common.confidentialityLevel);
  if (common.location) fd.append("location", common.location);
  if (common.notes) fd.append("notes", common.notes);
  if (common.activityId) fd.append("activityId", common.activityId);
  if (common.indicatorId) fd.append("indicatorId", common.indicatorId);
  if (common.reportingPeriodId) fd.append("reportingPeriodId", common.reportingPeriodId);
  if (item.file) fd.append("file", item.file);
  return fd;
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
