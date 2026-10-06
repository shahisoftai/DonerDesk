/** What the activity form sends for a file dropped on it: the file is uploaded against the new activity and inherits its period. */

export interface ActivityEvidenceContext {
  projectId: string;
  activityId: string;
  reportingPeriodId: string;
  activityDate?: string;
  location?: string;
}

export function evidenceTypeForFile(file: Pick<File, "name" | "type">): "PHOTO" | "OTHER" {
  return file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic)$/i.test(file.name) ? "PHOTO" : "OTHER";
}

export function titleForFile(file: Pick<File, "name">): string {
  return file.name.replace(/\.[^.]+$/, "").trim() || file.name;
}

/** Fields before the file: the API reads the multipart fields that arrive ahead of it. */
export function activityEvidenceFormData(file: File, context: ActivityEvidenceContext): FormData {
  const fd = new FormData();
  fd.append("projectId", context.projectId);
  fd.append("title", titleForFile(file));
  fd.append("evidenceType", evidenceTypeForFile(file));
  fd.append("confidentialityLevel", "INTERNAL");
  fd.append("activityId", context.activityId);
  fd.append("reportingPeriodId", context.reportingPeriodId);
  if (context.location) fd.append("location", context.location);
  if (context.activityDate) fd.append("activityDate", context.activityDate);
  fd.append("file", file);
  return fd;
}

export interface FileUploadOutcome {
  name: string;
  ok: boolean;
  error?: string;
}

export function failedUploads(outcomes: ReadonlyArray<FileUploadOutcome>): FileUploadOutcome[] {
  return outcomes.filter((o) => !o.ok);
}
