export type UploadItemState = "queued" | "uploading" | "success" | "error" | "cancelled";

export interface UploadItem {
  key: string;
  file: File;
  title: string;
  state: UploadItemState;
  error?: string;
  uploadedId?: string;
}

export type UploadAction =
  | { type: "add"; files: Array<{ file: File; title: string }> }
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

export function uploadReducer(items: UploadItem[], action: UploadAction): UploadItem[] {
  switch (action.type) {
    case "add": {
      const existingKeys = new Set(items.map((i) => i.key));
      const additions: UploadItem[] = [];
      for (const f of action.files) {
        const key = `${f.file.name}:${f.file.size}:${f.file.lastModified}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        additions.push({ key, file: f.file, title: f.title, state: "queued" });
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
