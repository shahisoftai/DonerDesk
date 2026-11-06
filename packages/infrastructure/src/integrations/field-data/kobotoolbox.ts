import { extractFieldData, type ExtractedFieldData, type FieldKeys } from "./extraction.js";

export interface KoboSubmission {
  submission_id: string;
  form_id: string;
  submitted_at: string;
  data: Record<string, unknown>;
  metadata?: {
    device_id?: string;
    username?: string;
    start_time?: string;
    end_time?: string;
  };
}

export interface KoboMapping {
  id: string;
  tenantId: string;
  koboFormId: string;
  projectId: string;
  indicatorId?: string;
  evidenceTitleTemplate: string;
  active: boolean;
}

export interface FieldDataResult {
  success: boolean;
  evidenceId?: string;
  error?: string;
}

const KOBO_KEYS: FieldKeys = {
  location: ["location", "geo", "gps", "latitude", "longitude"],
  date: ["date", "submission_date", "visit_date", "activity_date"],
  count: ["beneficiaries", "beneficiary_count", "participants", "attendance"],
  photos: ["photo", "photos", "image", "images", "attachment", "attachments", "media"],
  notes: ["notes", "comments", "observations", "description", "narrative"],
  photoLinksInObjects: true,
};

export function extractKoboData(submission: KoboSubmission): ExtractedFieldData {
  return extractFieldData(submission.data, KOBO_KEYS);
}
