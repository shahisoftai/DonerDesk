"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listWorkspaceFilesAction, linkDriveEvidenceAction, importDriveFileAction } from "@/lib/actions/drive";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { REPORT_TYPE_LABEL, REPORT_TYPE_OPTIONS } from "@/lib/labels";
import type { WorkspaceFile, WorkspaceFilesResponse, ImportedLogframeItem } from "@/lib/server/schemas";

function formatBytes(size?: number): string {
  if (size === undefined) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function fileLabel(file: WorkspaceFile): string {
  const type = file.mimeType?.split("/")[0] ?? "";
  return type || "file";
}

function importKindForRole(role: string): "template" | "logframe" | "data" | null {
  if (role === "01-Donor-Templates") return "template";
  if (role === "02-Logframe") return "logframe";
  if (role === "03-Data-Files") return "data";
  return null;
}

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "").trim();
}

type ImportPreview =
  | { fileId: string; name: string; text: string }
  | {
      fileId: string;
      name: string;
      created: number;
      skipped: number;
      warnings: string[];
      items: ImportedLogframeItem[];
    };

/**
 * Lists the current files in the project's storage folders (Google Drive or the
 * local workspace mirror) and lets the user link evidence or import
 * template/logframe/data content into the app. Re-reads on mount (after login)
 * and on the explicit "Refresh" button.
 */
export function DriveFolderPanel({
  projectId,
  folderRoles,
  title = "Project storage folder",
  linkAsEvidence = false,
}: {
  projectId: string;
  folderRoles: string[];
  title?: string;
  linkAsEvidence?: boolean;
}) {
  const router = useRouter();
  const [folders, setFolders] = useState<WorkspaceFilesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const [importing, setImporting] = useState<WorkspaceFile | null>(null);
  const [templateForm, setTemplateForm] = useState({ templateName: "", donorName: "", reportType: "CUSTOM" });
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const folderKey = folderRoles.join(",");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listWorkspaceFilesAction(projectId, folderKey.split(","));
    if (!result.ok) {
      setError(result.error.message);
    } else {
      setFolders(result.value);
    }
    setLoading(false);
  }, [projectId, folderKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function link(file: WorkspaceFile) {
    setBusy(`link:${file.id}`);
    setError(null);
    const result = await linkDriveEvidenceAction({
      projectId,
      title: file.name,
      fileName: file.name,
      fileType: file.mimeType || "application/octet-stream",
      driveFileId: file.id,
      driveWebLink: file.webViewLink,
      evidenceType: "OTHER",
      confidentialityLevel: "INTERNAL",
    });
    setBusy(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setLinked((prev) => new Set(prev).add(file.id));
  }

  function startImport(file: WorkspaceFile, kind: "template" | "logframe" | "data") {
    setError(null);
    setPreview(null);
    if (kind === "template") {
      setImporting(file);
      setTemplateForm({ templateName: baseName(file.name) || file.name, donorName: "", reportType: "CUSTOM" });
      return;
    }
    void importContent(file, kind);
  }

  async function importContent(file: WorkspaceFile, kind: "logframe" | "data") {
    setBusy(`import:${file.id}`);
    setError(null);
    const result = await importDriveFileAction(projectId, { driveFileId: file.id, kind });
    setBusy(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    const value = result.value;
    if (value.kind === "logframe") {
      setPreview({ fileId: file.id, name: value.name, created: value.created, skipped: value.skipped, warnings: value.warnings, items: value.items });
    } else if (value.kind === "data") {
      setPreview({ fileId: file.id, name: value.name, text: value.text });
    }
  }

  async function submitTemplateImport() {
    if (!importing) return;
    setBusy(`import:${importing.id}`);
    setError(null);
    const result = await importDriveFileAction(projectId, {
      driveFileId: importing.id,
      kind: "template",
      templateName: templateForm.templateName || importing.name,
      donorName: templateForm.donorName || undefined,
      reportType: templateForm.reportType,
    });
    setBusy(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    if (result.value.kind === "template") {
      router.push(`/projects/${projectId}/templates/${result.value.id}`);
    }
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">{title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Files currently in your project&apos;s storage folder. Added directly in Google Drive? Refresh to see them.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void load()} pending={loading}>
          Refresh
        </Button>
      </div>

      {error && <div className="mt-3"><InlineAlert tone="danger" title={error} /></div>}

      {folders === null && !loading && !error && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Checking storage folder…</p>
      )}

      {folders && (
        <div className="mt-4 space-y-4">
          {folders.deepLink && (
            <a className="text-sm text-brand-600 hover:underline dark:text-brand-400" href={folders.deepLink} target="_blank" rel="noopener noreferrer">
              Open project folder in Google Drive
            </a>
          )}
          {folders.folders.map((group) => {
            const kind = importKindForRole(group.role);
            return (
              <div key={group.role}>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {group.label} <span className="font-normal text-slate-400">({group.files.length})</span>
                </h3>
                {group.files.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">No files yet.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-200/70 dark:divide-white/10">
                    {group.files.map((file) => {
                      const isLinked = linked.has(file.id);
                      const isImportingTemplate = importing?.id === file.id && kind === "template";
                      const filePreview = preview && preview.fileId === file.id ? preview : null;
                      return (
                        <li key={file.id} className="py-2 text-sm">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-800 dark:text-slate-200">{file.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {fileLabel(file)}
                                {file.size !== undefined ? ` · ${formatBytes(file.size)}` : ""}
                                {file.modifiedTime ? ` · ${formatDate(file.modifiedTime)}` : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {kind && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  pending={busy === `import:${file.id}`}
                                  disabled={busy !== null && busy !== `import:${file.id}`}
                                  onClick={() => startImport(file, kind)}
                                >
                                  {kind === "template" ? "Import template" : "Import"}
                                </Button>
                              )}
                              {linkAsEvidence && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={isLinked || busy !== null}
                                  pending={busy === `link:${file.id}`}
                                  onClick={() => void link(file)}
                                >
                                  {isLinked ? "Linked" : "Link as evidence"}
                                </Button>
                              )}
                              {file.webViewLink && (
                                <a className="btn-secondary text-sm" href={file.webViewLink} target="_blank" rel="noopener noreferrer">
                                  Open
                                </a>
                              )}
                            </div>
                          </div>

                          {isImportingTemplate && (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="Template name" htmlFor="tplName">
                                  <Input
                                    id="tplName"
                                    value={templateForm.templateName}
                                    onChange={(e) => setTemplateForm((f) => ({ ...f, templateName: e.target.value }))}
                                  />
                                </Field>
                                <Field label="Donor name" htmlFor="tplDonor">
                                  <Input
                                    id="tplDonor"
                                    value={templateForm.donorName}
                                    onChange={(e) => setTemplateForm((f) => ({ ...f, donorName: e.target.value }))}
                                    placeholder="e.g. ECHO, USAID"
                                  />
                                </Field>
                                <Field label="Report type" htmlFor="tplType">
                                  <Select
                                    id="tplType"
                                    value={templateForm.reportType}
                                    onChange={(e) => setTemplateForm((f) => ({ ...f, reportType: e.target.value }))}
                                  >
                                    {REPORT_TYPE_OPTIONS.map((t) => (
                                      <option key={t} value={t}>{REPORT_TYPE_LABEL[t] ?? t}</option>
                                    ))}
                                  </Select>
                                </Field>
                              </div>
                              <div className="mt-3 flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={() => setImporting(null)}>Cancel</Button>
                                <Button size="sm" pending={busy === `import:${file.id}`} onClick={() => void submitTemplateImport()}>
                                  Create template
                                </Button>
                              </div>
                            </div>
                          )}

                          {filePreview && (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                              {"text" in filePreview ? (
                                <>
                                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{filePreview.name}</p>
                                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-slate-700 dark:text-slate-300">
                                    {filePreview.text}
                                  </pre>
                                </>
                              ) : (
                                <>
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Imported {filePreview.created} item{filePreview.created === 1 ? "" : "s"}
                                        {filePreview.skipped > 0 ? ` · ${filePreview.skipped} skipped (already exists)` : ""}
                                      </p>
                                      <p className="text-xs text-slate-500 dark:text-slate-400">{filePreview.name}</p>
                                    </div>
                                    <Button size="sm" onClick={() => router.push(`/projects/${projectId}/logframe`)}>
                                      View logframe
                                    </Button>
                                  </div>
                                  {filePreview.warnings.length > 0 && (
                                    <ul className="mt-2 space-y-1">
                                      {filePreview.warnings.map((w, idx) => (
                                        <li key={idx} className="text-xs text-amber-600 dark:text-amber-400">{w}</li>
                                      ))}
                                    </ul>
                                  )}
                                  {filePreview.items.length > 0 && (
                                    <ul className="mt-2 divide-y divide-slate-200/70 dark:divide-white/10">
                                      {filePreview.items.map((item) => (
                                        <li key={item.id} className="flex items-center gap-2 py-1 text-sm">
                                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                                            {item.level}
                                          </span>
                                          {item.code && <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.code}</span>}
                                          <span className="min-w-0 flex-1 break-words leading-5">{item.title}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
