export type UploadItemState = "queued" | "uploading" | "success" | "error" | "cancelled";

export interface UploadItem {
  key: string;
  title: string;
  state: UploadItemState;
  error?: string;
  uploadedId?: string;
  file?: File;
  /** Google Drive link-first evidence: the Drive file id, no byte copy. */
  driveFileId?: string;
  driveWebLink?: string;
}

export type UploadAction =
  | { type: "add"; items: Array<{ file?: File; driveFileId?: string; driveWebLink?: string; title: string }> }
  | { type: "set-title"; key: string; title: string }
  | { type: "start"; key: string }
  | { type: "success"; key: string; id: string }
  | { type: "fail"; key: string; error: string }
  | { type: "remove"; key: string }
  | { type: "retry"; key: string };

export function titleFromFile(file: File): string {
  const name = file.name.replace(/\.[^.]+$/, "").trim();
  return name || file.name;
}

/**
 * Extracts a Google Drive file id from a share link or returns the input when
 * it already looks like a bare file id. Handles /file/d/<id>/view, ?id=<id>,
 * and /open?id=<id> forms. Returns null for anything unrecognized.
 */
export function driveFileIdFromLink(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^[A-Za-z0-9_-]{20,}$/.test(value)) return value;
  const fileD = value.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
  if (fileD && fileD[1]) return fileD[1];
  const query = value.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (query && query[1]) return query[1];
  return null;
}

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  csv: "text/csv",
  txt: "text/plain",
};

export function fileTypeForName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}

export function uploadReducer(items: UploadItem[], action: UploadAction): UploadItem[] {
  switch (action.type) {
    case "add": {
      const existingKeys = new Set(items.map((i) => i.key));
      const additions: UploadItem[] = [];
      for (const item of action.items) {
        const key = item.file
          ? `${item.file.name}:${item.file.size}:${item.file.lastModified}`
          : `drive:${item.driveFileId}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        additions.push({
          key,
          file: item.file,
          driveFileId: item.driveFileId,
          driveWebLink: item.driveWebLink,
          title: item.title,
          state: "queued",
        });
      }
      return [...items, ...additions];
    }
    case "set-title":
      return items.map((i) => (i.key === action.key ? { ...i, title: action.title } : i));
    case "start":
      return items.map((i) => (i.key === action.key && (i.state === "queued" || i.state === "error") ? { ...i, state: "uploading", error: undefined } : i));
    case "success":
      return items.map((i) => (i.key === action.key && i.state === "uploading" ? { ...i, state: "success", uploadedId: action.id } : i));
    case "fail":
      return items.map((i) => (i.key === action.key && i.state === "uploading" ? { ...i, state: "error", error: action.error } : i));
    case "remove":
      return items.filter((i) => i.key !== action.key);
    case "retry":
      return items.map((i) => (i.key === action.key && i.state === "error" ? { ...i, state: "queued", error: undefined } : i));
    default:
      return items;
  }
}

export function countByState(items: UploadItem[], state: UploadItemState): number {
  return items.filter((i) => i.state === state).length;
}
