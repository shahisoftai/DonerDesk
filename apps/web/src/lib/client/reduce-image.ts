import { IMAGE_QUALITY, planImageResize, smaller } from "../shared/image-resize.ts";

/**
 * Shrinks a photo in the browser before it is queued or sent: less phone storage and less mobile data. Any trouble (a format the
 * browser cannot draw, no canvas, a failure) quietly keeps the original: a photo is never lost to its own shrinking.
 */
export async function reduceImage(file: File): Promise<File> {
  try {
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
    const bitmap = await createImageBitmap(file);
    try {
      const plan = planImageResize({ width: bitmap.width, height: bitmap.height, bytes: file.size, type: file.type });
      if (!plan.resize) return file;
      const canvas = document.createElement("canvas");
      canvas.width = plan.width;
      canvas.height = plan.height;
      const context = canvas.getContext("2d");
      if (!context) return file;
      context.drawImage(bitmap, 0, 0, plan.width, plan.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", IMAGE_QUALITY));
      if (!blob) return file;
      const name = file.name.replace(/\.(png|webp|jpe?g)$/i, "") + ".jpg";
      const reduced = new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
      return smaller(file, reduced);
    } finally {
      bitmap.close?.();
    }
  } catch {
    return file;
  }
}
