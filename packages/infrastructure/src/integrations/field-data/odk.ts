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

export function extractOdkData(submission: OdkSubmission): {
  location?: string;
  date?: string;
  beneficiaryCount?: number;
  imageUrls?: string[];
  notes?: string;
} {
  const data = submission.answers ?? {};

  const location = extractField(data, ["location", "geo", "gps", "latitude", "longitude", "_geolocation"]);
  const date = extractField(data, ["date", "visit_date", "activity_date", "start", "_submission_time"]);
  const beneficiaryCount = extractNumericField(data, ["beneficiaries", "count", "participants", "attendance"]);
  const imageUrls = extractImageUrls(data);
  const notes = extractField(data, ["notes", "comments", "observation", "description"]);

  return {
    location: location as string | undefined,
    date: date as string | undefined,
    beneficiaryCount: beneficiaryCount as number | undefined,
    imageUrls: imageUrls as string[] | undefined,
    notes: notes as string | undefined,
  };
}

function extractField(data: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = findNestedField(data, key);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function extractNumericField(data: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = findNestedField(data, key);
    if (value !== undefined && value !== null) {
      const text = String(value).trim();
      const num = typeof value === "number" ? value : /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
      if (Number.isFinite(num) && num >= 0) {
        return num;
      }
    }
  }
  return undefined;
}

function findNestedField(obj: Record<string, unknown>, key: string, depth = 0, seen = new Set<object>()): unknown {
  if (depth > 20 || seen.has(obj)) return undefined;
  seen.add(obj);
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    return obj[key];
  }
  for (const value of Object.values(obj)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nested = findNestedField(value as Record<string, unknown>, key, depth + 1, seen);
      if (nested !== undefined) {
        return nested;
      }
    }
  }
  return undefined;
}

function extractImageUrls(data: Record<string, unknown>): string[] {
  const urls: string[] = [];
  const keys = ["photo", "photos", "image", "images", "attachment", "attachments", "media", "filename"];

  for (const key of keys) {
    const value = findNestedField(data, key);
    if (value) {
      if (typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://"))) {
        urls.push(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string" && (item.startsWith("http://") || item.startsWith("https://"))) {
            urls.push(item);
          }
        }
      }
    }
  }

  return urls;
}
