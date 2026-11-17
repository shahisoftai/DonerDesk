/**
 * Pictures on a canvas (Phase 61.8). One place where the browser's side of an upload lives: what a file may be, where a picture is
 * shown from, and how an upload turns into a block. The server re-draws every picture (size bounded, metadata removed, an SVG drawn
 * to a PNG) and keeps it in the organisation's Google Drive; nothing here decides that, it only prepares the request.
 */
import { readFileAsBase64, studio, type AssetItem } from "@/features/infographics/domain/studio-api";

export const MEDIA_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";
export const MEDIA_MAX_BYTES = 6_000_000;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

/** Where a library picture is shown from (through the app's own gateway, which checks who is asking). */
export const assetUrl = (assetId: string): string => `/api/infographic-studio/infographic-assets/${encodeURIComponent(assetId)}/file`;

export type UploadResult = { ok: true; asset: AssetItem } | { ok: false; message: string };

/** What is wrong with a file before it is sent, or null. */
export function mediaProblem(file: { type: string; size: number; name: string }): string | null {
  if (file.size === 0) return "That file is empty.";
  if (file.size > MEDIA_MAX_BYTES) return "Choose a picture under 6 MB.";
  const type = file.type || (/\.svg$/i.test(file.name) ? "image/svg+xml" : "");
  return ALLOWED.has(type) ? null : "Use a PNG, JPEG, WebP or SVG picture.";
}

export const isPicture = (file: { type: string; name: string }): boolean => file.type.startsWith("image/") || /\.(png|jpe?g|webp|svg)$/i.test(file.name);

/** Sends a picture to the library. `name` is what it is called (and, until the person writes better words, what it is described as). */
export async function uploadPicture(file: File, kind: "IMAGE" | "LOGO" | "ICON" = "IMAGE", name?: string): Promise<UploadResult> {
  const problem = mediaProblem(file);
  if (problem) return { ok: false, message: problem };
  try {
    const dataBase64 = await readFileAsBase64(file);
    const r = await studio<AssetItem>("infographic-assets", { method: "POST", body: { name: (name ?? file.name.replace(/\.[^.]+$/, "")).slice(0, 120) || "Picture", kind, dataBase64 } });
    return r.ok ? { ok: true, asset: r.data } : { ok: false, message: r.message };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function listPictures(): Promise<{ ok: true; items: AssetItem[] } | { ok: false; message: string }> {
  const r = await studio<{ items: AssetItem[] }>("infographic-assets");
  return r.ok ? { ok: true, items: r.data.items } : { ok: false, message: r.message };
}

/** The settings a new picture block starts with: the picture, and its name as its description until the person writes a better one. */
export const imageProps = (asset: { id: string; name: string }): Record<string, unknown> => ({ assetId: asset.id, altText: asset.name, fit: "CONTAIN", consentConfirmed: true });
