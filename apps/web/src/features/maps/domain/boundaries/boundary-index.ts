/** A level's index file for tiled boundaries (Phase 49.3): every unit but its outline. Written by `scripts/maps/build-boundary-tiles.mjs`. */
export interface BoundaryIndexRow { ref: string; name: string; pcode?: string; parentPcode?: string; bbox: [number, number, number, number] }
export interface BoundaryIndex { sourceLayer: string; units: BoundaryIndexRow[] }
