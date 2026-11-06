import { DomainError } from "@donordesk/domain";
import type { Result } from "@donordesk/domain";
import type { IImageNormalizer } from "@donordesk/application";
import sharp from "sharp";

/**
 * Re-encodes an uploaded picture so a design can embed it safely: only real PNG or JPEG pictures are accepted (the
 * type is read from the bytes, never from the file name), the longest edge is bounded, and every piece of embedded
 * metadata (camera model, GPS position, authorship) is dropped by the re-encode. SVG and other formats are refused:
 * an SVG can carry scripts and links.
 */
export class SharpImageNormalizer implements IImageNormalizer {
  async normalize(bytes: Buffer, opts?: { maxEdge?: number }): Promise<Result<{ bytes: Buffer; contentType: "image/png" | "image/jpeg"; width: number; height: number }, DomainError>> {
    const maxEdge = opts?.maxEdge ?? 2000;
    try {
      const probe = sharp(bytes, { failOn: "error", limitInputPixels: 80_000_000 });
      const meta = await probe.metadata();
      if (meta.format !== "png" && meta.format !== "jpeg") return { ok: false, error: DomainError.validation("Use a PNG or JPEG picture") };
      const png = meta.format === "png";
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
