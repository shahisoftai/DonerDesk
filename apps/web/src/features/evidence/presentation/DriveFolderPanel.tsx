"use client";

import { useCallback, useEffect, useState } from "react";
import { listWorkspaceFilesAction, linkDriveEvidenceAction } from "@/lib/actions/drive";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import type { WorkspaceFile, WorkspaceFilesResponse } from "@/lib/server/schemas";

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

/**
 * Lists the current files in the project's storage folders (Google Drive or the
 * local workspace mirror). Re-reads on mount (so every page load after login
 * picks up files added directly in Drive) and on the explicit "Refresh" button.
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
  const [folders, setFolders] = useState<WorkspaceFilesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<Set<string>>(new Set());
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
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setError(null);
    setLinked((prev) => new Set(prev).add(file.id));
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
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
          {folders.folders.map((group) => (
            <div key={group.role}>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {group.label} <span className="font-normal text-slate-400">({group.files.length})</span>
              </h3>
              {group.files.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">No files yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-200/70 dark:divide-white/10">
                  {group.files.map((file) => {
                    const isLinked = linked.has(file.id);
                    return (
                      <li key={file.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800 dark:text-slate-200">{file.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {fileLabel(file)}
                            {file.size !== undefined ? ` · ${formatBytes(file.size)}` : ""}
                            {file.modifiedTime ? ` · ${formatDate(file.modifiedTime)}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {linkAsEvidence && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isLinked}
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
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
