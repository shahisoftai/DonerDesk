import { extractFieldData, type ExtractedFieldData, type FieldKeys } from "./extraction.js";

export interface OdkSubmission {
  id: number;
  instanceId: string;
  submitterId: number;
  submitterName: string;
  createdAt: string;
  updatedAt: string;
  reviewState: string;
  submittedBy: string;
  formId: string;
  xmlFormId: string;
  answers?: Record<string, unknown>;
}

export interface OdkMapping {
  id: string;
  tenantId: string;
  odkFormId: string;
  projectId: string;
  indicatorId?: string;
  evidenceTitleTemplate: string;
  active: boolean;
}

const ODK_KEYS: FieldKeys = {
  location: ["location", "geo", "gps", "latitude", "longitude", "_geolocation"],
  date: ["date", "visit_date", "activity_date", "start", "_submission_time"],
  count: ["beneficiaries", "count", "participants", "attendance"],
  photos: ["photo", "photos", "image", "images", "attachment", "attachments", "media", "filename"],
  notes: ["notes", "comments", "observation", "description"],
  photoLinksInObjects: false,
};

export function extractOdkData(submission: OdkSubmission): ExtractedFieldData {
  return extractFieldData(submission.answers ?? {}, ODK_KEYS);
}
