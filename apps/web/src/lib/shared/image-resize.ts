/**
 * How a photo is shrunk before it is kept or sent (Phase 44, decided: 1600 px on the long side, JPEG at about 0.8). Only the plan is
 * here, pure and tested; the browser does the drawing (`lib/client/reduce-image.ts`). A photo that is already small enough is left
 * exactly as it is, and a shrunk copy that is not smaller than the original is thrown away.
 */
export const IMAGE_MAX_SIDE = 1600;
export const IMAGE_QUALITY = 0.8;
/** A photo under this size is never worth redrawing, whatever its dimensions. */
export const IMAGE_KEEP_UNDER_BYTES = 300 * 1024;

const REDUCIBLE = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface ResizePlan {
  /** False: keep the original untouched. */
  resize: boolean;
  width: number;
  height: number;
}

export function planImageResize(input: { width: number; height: number; bytes: number; type: string }, maxSide = IMAGE_MAX_SIDE): ResizePlan {
  const { width, height } = input;
  const keep: ResizePlan = { resize: false, width, height };
  if (!REDUCIBLE.has(input.type)) return keep;
  if (!(width > 0 && height > 0)) return keep;
  if (input.bytes <= IMAGE_KEEP_UNDER_BYTES) return keep;
  const longSide = Math.max(width, height);
  // Within the limit the size can still be cut by re-encoding, but only a large file is worth it.
  if (longSide <= maxSide) return input.bytes > 1_500_000 ? { resize: true, width, height } : keep;
  const scale = maxSide / longSide;
  return { resize: true, width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Keeps the smaller of the original and the shrunk copy. */
export function smaller<T extends { size: number }>(original: T, reduced: T | null): T {
  return reduced && reduced.size > 0 && reduced.size < original.size ? reduced : original;
}
