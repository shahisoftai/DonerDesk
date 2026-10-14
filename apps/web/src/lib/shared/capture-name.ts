/**
 * Phone cameras hand every photo the same name ("image.jpg"), and the upload lists treat a repeated name as the same file,
 * so each captured photo is renamed from the moment it was taken: photo-20270312-141502.jpg.
 */
export function captureFileName(takenAt: Date, mimeType: string, taken = 0): string {
  const iso = takenAt.toISOString();
  const stamp = `${iso.slice(0, 10).replace(/-/g, "")}-${iso.slice(11, 19).replace(/:/g, "")}`;
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : mimeType === "image/heic" ? "heic" : "jpg";
  return `photo-${stamp}${taken > 0 ? `-${taken + 1}` : ""}.${ext}`;
}
