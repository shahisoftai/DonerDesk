import { DomainError, type Result, type TenantId } from "@donordesk/domain";
import type { ICanvasRepository } from "../../ports/canvas.js";
import type { IInfographicAssetRepository } from "../../ports/infographics.js";
import type { IStorage } from "../../ports/infrastructure.js";
import { fail, ok } from "./canvas-shared.js";

export interface PublicAssetDto { bytes: Buffer; contentType: string }

/** The ids of library pictures a canvas names (an image block's picture, a logo): the only pictures a link holder may fetch through the canvas's link. */
export function assetIdsOfCanvas(pages: ReadonlyArray<{ blocks: ReadonlyArray<{ props?: unknown }> }>): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown, key = ""): void => {
    if (typeof v === "string") { if (/^assetId$|AssetId$/.test(key)) out.add(v); return; }
    if (Array.isArray(v)) { for (const x of v) walk(x, key); return; }
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  for (const p of pages) for (const b of p.blocks) walk(b.props);
  return out;
}

/** A picture on a canvas a share link opens (Phase 61.8). The link is the credential: only a picture the canvas itself names, in the link's own organisation, is served; every other case answers the same "not available". */
export class GetPublicCanvasAssetHandler {
  constructor(private readonly canvases: ICanvasRepository, private readonly assets: IInfographicAssetRepository, private readonly storage: IStorage) {}
  async handle(tenantId: TenantId, canvasId: string, assetId: string): Promise<Result<PublicAssetDto, DomainError>> {
    const canvas = await this.canvases.findById(canvasId, tenantId);
    if (!canvas.ok || !canvas.value) return fail(DomainError.notFound("File", "unavailable"));
    if (!assetIdsOfCanvas(canvas.value.canvas.pages).has(assetId)) return fail(DomainError.notFound("File", "unavailable"));
    const asset = await this.assets.findById(assetId, tenantId);
    if (!asset.ok || !asset.value || asset.value.archivedAt) return fail(DomainError.notFound("File", "unavailable"));
    try {
      return ok({ bytes: await this.storage.read(asset.value.storageKey), contentType: asset.value.contentType });
    } catch {
      return fail(DomainError.notFound("File", "unavailable"));
    }
  }
}
