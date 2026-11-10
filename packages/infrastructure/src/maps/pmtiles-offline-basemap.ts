import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { IOfflineBasemapBuilder, OfflineBasemapFile } from "@donordesk/application";

const run = promisify(execFile);
interface Region { id: string; file: string; bbox: [number, number, number, number]; maxzoom: number; keep?: boolean }

/**
 * Cuts an offline basemap with the `pmtiles` tool from the region files nginx already serves (Phase 49.4): `<dir>/basemap-regions.json`
 * (shipped by sync-tiles.sh) says which file holds which box. The smallest region holding the whole box is used, else the world file (low
 * detail). Results are kept in `<dir>/offline/<hash>.pmtiles` and reused; one cut at a time, so a busy host is never asked for two.
 */
export class PmtilesOfflineBasemap implements IOfflineBasemapBuilder {
  private busy: Promise<unknown> = Promise.resolve();

  constructor(private readonly dir = process.env.OFFLINE_BASEMAP_DIR ?? "/opt/donordesk/shared/tiles", private readonly tool = process.env.PMTILES_BIN ?? "pmtiles") {}

  async build(bbox: readonly [number, number, number, number], maxzoom: number): Promise<OfflineBasemapFile | null> {
    const conf = join(this.dir, "basemap-regions.json");
    if (!existsSync(conf)) return null;
    const { world, regions } = JSON.parse(readFileSync(conf, "utf8")) as { world: Region; regions: Region[] };
    const holds = (r: Region) => bbox[0] >= r.bbox[0] && bbox[1] >= r.bbox[1] && bbox[2] <= r.bbox[2] && bbox[3] <= r.bbox[3];
    const size = (r: Region) => (r.bbox[2] - r.bbox[0]) * (r.bbox[3] - r.bbox[1]);
    const region = regions.filter((r) => r.keep !== false && holds(r) && existsSync(join(this.dir, r.file))).sort((a, b) => size(a) - size(b))[0] ?? (existsSync(join(this.dir, world.file)) ? world : null);
    if (!region) return null;
    const zoom = Math.min(maxzoom, region.maxzoom);
    const box = bbox.map((n) => Math.round(n * 1000) / 1000);
    const name = createHash("sha256").update(`${region.file}|${box.join(",")}|${zoom}`).digest("hex").slice(0, 24);
    const out = join(this.dir, "offline", `${name}.pmtiles`);
    if (existsSync(out)) return { path: out, bytes: statSync(out).size, maxzoom: zoom };
    mkdirSync(join(this.dir, "offline"), { recursive: true });
    const job = this.busy.then(async () => {
      if (existsSync(out)) return;
      await run(this.tool, ["extract", join(this.dir, region.file), `${out}.tmp`, `--bbox=${box.join(",")}`, `--maxzoom=${zoom}`], { timeout: 300_000 });
      renameSync(`${out}.tmp`, out);
    });
    this.busy = job.catch(() => undefined);
    try { await job; } catch { return null; }
    return existsSync(out) ? { path: out, bytes: statSync(out).size, maxzoom: zoom } : null;
  }
}
