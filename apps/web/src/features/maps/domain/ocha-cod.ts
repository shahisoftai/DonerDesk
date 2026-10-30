/**
 * OCHA COD-AB boundary files (HDX "cod-ab-<iso3>"): how to pick the file, read a unit's name, and keep only boundaries that are current.
 * Pure: the downloader script does the IO and calls these. A boundary that has been replaced (its `valid_to` is in the past) is left out,
 * so the newer one stands; when no feature says it ends, all are current.
 */
export interface HdxResource { format?: string; name?: string; download_url?: string }
export interface HdxPackage { license_title?: string; title?: string; dataset_date?: string; resources?: HdxResource[] }

/** The GeoJSON zip resource of a COD-AB dataset. */
export function geojsonZipUrl(pkg: HdxPackage): string | null {
  return pkg.resources?.find((r) => /^geojson$/i.test(r.format ?? "") && !!r.download_url)?.download_url ?? null;
}

export const codFileName = (iso: string, level: number): string => `${iso.toLowerCase()}_admin${level}.geojson`;

/** The unit's name: the English field first, then the first of the numbered local-language ones. */
export function unitName(props: Record<string, unknown>, level: number): string {
  for (const key of [`adm${level}_name`, `adm${level}_name1`, `adm${level}_name2`, `adm${level}_name3`, `adm${level}_en`]) {
    const v = props[key];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return "";
}

export const unitCode = (props: Record<string, unknown>, level: number): string => {
  const v = props[`adm${level}_pcode`];
  return typeof v === "string" ? v : "";
};

/** `valid_to` arrives as a date, a timestamp or empty. Empty means open-ended. */
function endsBefore(valid: unknown, today: string): boolean {
  if (typeof valid !== "string" || valid.trim() === "") return false;
  const day = valid.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day < today;
}

export interface CodFeature { type?: string; properties?: Record<string, unknown> | null; geometry?: unknown }

export interface ReadResult {
  features: Array<{ type: "Feature"; properties: { name: string; id: string }; geometry: unknown }>;
  /** Units left out: no name, no shape, or replaced by a newer boundary. */
  skipped: { noName: number; replaced: number; noShape: number };
  /** The version label of the newest feature, for the manifest. */
  version: string;
}

export function readLevel(features: readonly CodFeature[], level: number, today: string): ReadResult {
  const out: ReadResult = { features: [], skipped: { noName: 0, replaced: 0, noShape: 0 }, version: "" };
  for (const f of features) {
    const props = f.properties ?? {};
    if (!f.geometry) { out.skipped.noShape++; continue; }
    if (endsBefore(props.valid_to, today)) { out.skipped.replaced++; continue; }
    const name = unitName(props, level);
    if (!name) { out.skipped.noName++; continue; }
    out.features.push({ type: "Feature", properties: { name, id: unitCode(props, level) }, geometry: f.geometry });
    const v = String(props.valid_on ?? props.version ?? "").slice(0, 10);
    if (v > out.version) out.version = v;
  }
  return out;
}
