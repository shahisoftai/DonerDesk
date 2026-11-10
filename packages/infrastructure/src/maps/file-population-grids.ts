import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PopulationGrid } from "@donordesk/domain";
import type { IPopulationGrids } from "@donordesk/application";

interface Header { west: number; north: number; cellDeg: number; cols: number; rows: number; source: string; year: string }

/**
 * Population grids as files beside the tiles (Phase 49.7): `<dir>/<ISO>.json` (the header) and `<dir>/<ISO>.bin` (Float32, little-endian,
 * row-major from the north-west, -1 for no data), written by `scripts/maps/build_context_layers.py`. A grid is read once and kept.
 */
export class FilePopulationGrids implements IPopulationGrids {
  private readonly cache = new Map<string, PopulationGrid>();
  constructor(private readonly dir = process.env.POPULATION_GRID_DIR ?? "/opt/donordesk/shared/tiles/context/population-grid") {}

  async covering(box: readonly [number, number, number, number]): Promise<PopulationGrid | null> {
    if (!existsSync(this.dir)) return null;
    for (const file of readdirSync(this.dir).filter((f) => f.endsWith(".json")).sort()) {
      const h = JSON.parse(readFileSync(join(this.dir, file), "utf8")) as Header;
      const east = h.west + h.cols * h.cellDeg, south = h.north - h.rows * h.cellDeg;
      if (box[0] < h.west || box[2] > east || box[1] < south || box[3] > h.north) continue;
      const key = file.replace(/\.json$/, "");
      let grid = this.cache.get(key);
      if (!grid) {
        const buf = readFileSync(join(this.dir, `${key}.bin`));
        grid = { ...h, values: new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4) };
        this.cache.set(key, grid);
      }
      return grid;
    }
    return null;
  }
}
