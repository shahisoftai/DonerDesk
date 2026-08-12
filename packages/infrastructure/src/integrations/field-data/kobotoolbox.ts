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

export function extractKoboData(submission: KoboSubmission): {
  location?: string;
  date?: string;
  beneficiaryCount?: number;
  imageUrls?: string[];
  notes?: string;
} {
  const data = submission.data;

  const location = extractField(data, ["location", "geo", "gps", "latitude", "longitude"]);
  const date = extractField(data, ["date", "submission_date", "visit_date", "activity_date"]);
  const beneficiaryCount = extractNumericField(data, ["beneficiaries", "beneficiary_count", "participants", "attendance"]);
  const imageUrls = extractImageUrls(data);
  const notes = extractField(data, ["notes", "comments", "observations", "description", "narrative"]);

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
  const keys = ["photo", "photos", "image", "images", "attachment", "attachments", "media"];

  for (const key of keys) {
    const value = findNestedField(data, key);
    if (value) {
      if (typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://"))) {
        urls.push(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string" && (item.startsWith("http://") || item.startsWith("https://"))) {
            urls.push(item);
          } else if (typeof item === "object" && item !== null) {
            const itemStr = JSON.stringify(item);
            const urlMatch = itemStr.match(/https?:\/\/[^\s"']+/);
            if (urlMatch) {
              urls.push(urlMatch[0]!);
            }
          }
        }
      }
    }
  }

  return urls;
}
