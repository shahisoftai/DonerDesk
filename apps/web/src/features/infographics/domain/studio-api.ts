/**
 * The Studio's calls to the server (Phase 32), in one place. Every call goes through the gateway route
 * `/api/infographic-studio/…`, returns a plain result (never throws for an HTTP error) and carries the
 * server's own one-sentence reason when it says no.
 */
import type { InfographicConfig } from "@donordesk/domain/contexts/infographics/index.js";

export interface Finding {
  ruleId: string;
  severity: "BLOCKER" | "WARN" | "TIP";
  message: string;
  fix: string;
  sectionIndex?: number;
  waived?: boolean;
}

export interface CheckResult {
  findings: Finding[];
  blockers: Finding[];
  canPublish: boolean;
}

export interface PreviewPage {
  svg: string;
  width: number;
  height: number;
  /** Where each block sits on the page (canvas px); a click on one selects it. */
  blocks?: Array<{ index: number; x: number; y: number; width: number; height: number }>;
}

export interface PreviewResponse {
  pages: PreviewPage[];
  check: CheckResult;
  altText: string;
  footer: string;
}

export interface AssetItem {
  id: string;
  kind: "IMAGE" | "LOGO";
  name: string;
  contentType: string;
  width: number;
  height: number;
  sizeBytes: number;
  credit?: string;
  createdAt: string;
}

export interface BrandKit {
  primaryColor: string;
  secondaryColor?: string;
  logoAssetId?: string;
  partnerLogoAssetIds?: string[];
  footerLine?: string;
  acknowledgement?: string;
}

export interface ExportRow {
  id: string;
  format: "PNG" | "PDF" | "SVG" | "PPTX" | "PACK";
  createdAt: string;
  generatedById: string;
  pageCount?: number;
  approved?: boolean;
  sizeBytes?: number;
}

export interface ShareLinkRow {
  id: string;
  exportId: string;
  expiresAt: string;
  revokedAt?: string;
  viewCount: number;
  live: boolean;
  createdAt: string;
}

export interface Suggestions {
  headlines: Array<{ text: string }>;
  messages: Array<{ text: string }>;
  templates: Array<{ templateId: string; reason: string; label: string }>;
}

export type AiText = { available: false; reason: string } | { available: true; model: string; headlines: Array<{ text: string }>; messages: Array<{ text: string }>; droppedUngrounded: number };

export interface TemplateListing {
  builtIn: Array<{ id: string; label: string; description: string; family: string; scope?: "PROJECT" | "PORTFOLIO"; format?: string; profile?: string; themeId?: string; sectionKinds: string[] }>;
  mine: Array<{ id: string; name: string; description?: string; baseTemplateId: string; createdAt: string }>;
}

export type StudioResult<T> = { ok: true; data: T } | { ok: false; message: string; status: number };

const ROOT = "/api/infographic-studio";

export async function studio<T>(path: string, init?: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; signal?: AbortSignal }): Promise<StudioResult<T>> {
  try {
    const response = await fetch(`${ROOT}/${path}`, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init?.signal,
      cache: "no-store",
    });
    const text = await response.text();
    let parsed: unknown = undefined;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    if (!response.ok) {
      const title = (parsed as { title?: string } | undefined)?.title;
      return { ok: false, status: response.status, message: title ?? (response.status === 401 ? "Your session has ended. Sign in again." : response.status === 403 ? "You do not have access to do this." : "That did not work. Try again.") };
    }
    return { ok: true, data: parsed as T };
  } catch (error) {
    if ((error as { name?: string }).name === "AbortError") return { ok: false, status: 0, message: "" };
    return { ok: false, status: 0, message: "You appear to be offline. Try again when you are connected." };
  }
}

/** A draft config as the preview and the review calls take it. */
export type DraftConfig = InfographicConfig;

/** `data:` URL for showing a composed SVG page in an `<img>`: an image cannot run scripts, whatever the SVG holds. */
export const svgDataUrl = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Reads a chosen file as base64 (no `data:` prefix). */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}
