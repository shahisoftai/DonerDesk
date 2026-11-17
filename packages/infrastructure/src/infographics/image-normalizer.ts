import { DomainError } from "@donordesk/domain";
import type { Result } from "@donordesk/domain";
import type { IImageNormalizer } from "@donordesk/application";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";

/** Parts of an SVG that can run code, load other files or reach the network. An upload containing any of them is refused, not cleaned. */
const SVG_FORBIDDEN = /<\s*script|<\s*foreignObject|<!ENTITY|<!DOCTYPE[^>]*\[|\son[a-z]+\s*=|javascript:|<\s*iframe|<\s*embed|<\s*object|<\s*audio|<\s*video|<\s*link|<\s*style[^>]*@import|(?:href|src)\s*=\s*["'](?!data:image\/(?:png|jpeg|webp);base64,|#)/i;

/** True when the bytes look like an SVG document (told from the content, not the file name). */
export function looksLikeSvg(bytes: Buffer): boolean {
  const head = bytes.subarray(0, 2048).toString("utf8").replace(/^\uFEFF/, "").trimStart().toLowerCase();
  return head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg")) || head.startsWith("<!doctype svg");
}

/** An SVG becomes a PNG on upload and only the PNG is kept: the vector file, with anything it could carry, never reaches a page or a file. */
export function rasteriseSvg(bytes: Buffer, maxEdge: number): Result<Buffer, DomainError> {
  if (bytes.length > 2_000_000) return { ok: false, error: DomainError.validation("An SVG picture is at most 2 MB") };
  const text = bytes.toString("utf8");
  if (SVG_FORBIDDEN.test(text)) return { ok: false, error: DomainError.validation("This SVG contains scripts or links to other files. Export it again as a plain picture (without scripts or external links), or use a PNG.") };
  try {
    const r = new Resvg(text, { fitTo: { mode: "width", value: maxEdge }, font: { loadSystemFonts: false }, background: "rgba(0,0,0,0)" });
    return { ok: true, value: Buffer.from(r.render().asPng()) };
  } catch {
    return { ok: false, error: DomainError.validation("The SVG could not be read; try a PNG or JPEG") };
  }
}

/**
 * Re-encodes an uploaded picture so a design can embed it safely: only real PNG or JPEG pictures are accepted (the
 * type is read from the bytes, never from the file name), the longest edge is bounded, and every piece of embedded
 * metadata (camera model, GPS position, authorship) is dropped by the re-encode. An SVG is checked for scripts and links,
 * drawn to a PNG and only the PNG is kept (Phase 61.8); any other format is refused.
 */
export class SharpImageNormalizer implements IImageNormalizer {
  async normalize(input: Buffer, opts?: { maxEdge?: number }): Promise<Result<{ bytes: Buffer; contentType: "image/png" | "image/jpeg"; width: number; height: number }, DomainError>> {
    let bytes = input;
    const maxEdge = opts?.maxEdge ?? 2000;
    if (looksLikeSvg(bytes)) {
      const png = rasteriseSvg(bytes, maxEdge);
      if (!png.ok) return png;
      bytes = png.value;
    }
    try {
      const probe = sharp(bytes, { failOn: "error", limitInputPixels: 80_000_000 });
      const meta = await probe.metadata();
      if (meta.format !== "png" && meta.format !== "jpeg" && meta.format !== "webp") return { ok: false, error: DomainError.validation("Use a PNG, JPEG, WebP or SVG picture") };
      // A WebP is kept as a PNG so every file and screen reads it the same way.
      const png = meta.format === "png" || meta.format === "webp";
      // `rotate()` applies the camera's orientation before the metadata that carried it is removed.
      let pipeline = sharp(bytes, { failOn: "error", limitInputPixels: 80_000_000 }).rotate().resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true });
      pipeline = png ? pipeline.png({ compressionLevel: 9 }) : pipeline.jpeg({ quality: 86, mozjpeg: true });
      const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
      return { ok: true, value: { bytes: data, contentType: png ? "image/png" : "image/jpeg", width: info.width, height: info.height } };
    } catch {
      return { ok: false, error: DomainError.validation("The picture could not be read; try another file") };
    }
  }
}
