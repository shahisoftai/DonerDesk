/** What a field-data tool's submission yields for an evidence record. */
export interface ExtractedFieldData {
  location?: string;
  date?: string;
  beneficiaryCount?: number;
  imageUrls?: string[];
  notes?: string;
}

/** The keys a tool's submissions use for each thing we read. Order matters: the first key with a value wins. */
export interface FieldKeys {
  location: string[];
  date: string[];
  count: string[];
  photos: string[];
  notes: string[];
  /** Also read a web address out of an object inside a photo list (Kobo attachments carry one). */
  photoLinksInObjects: boolean;
}

/** Reads one submission's answers with a tool's own keys; the finding rules are the same for every tool. */
export function extractFieldData(data: Record<string, unknown>, keys: FieldKeys): ExtractedFieldData {
  return {
    location: extractField(data, keys.location) as string | undefined,
    date: extractField(data, keys.date) as string | undefined,
    beneficiaryCount: extractNumericField(data, keys.count),
    imageUrls: extractImageUrls(data, keys.photos, keys.photoLinksInObjects),
    notes: extractField(data, keys.notes) as string | undefined,
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

const isWebAddress = (value: unknown): value is string => typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://"));

function extractImageUrls(data: Record<string, unknown>, keys: string[], linksInObjects: boolean): string[] {
  const urls: string[] = [];

  for (const key of keys) {
    const value = findNestedField(data, key);
    if (value) {
      if (isWebAddress(value)) {
        urls.push(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (isWebAddress(item)) {
            urls.push(item);
          } else if (linksInObjects && typeof item === "object" && item !== null) {
            const urlMatch = JSON.stringify(item).match(/https?:\/\/[^\s"']+/);
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
