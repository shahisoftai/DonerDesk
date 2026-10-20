import { REQUIREMENT_KINDS, type ReportingRequirement, type RequirementKind } from "./reporting-requirement.js";

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export interface ParsedPackLines {
  requirements: ReportingRequirement[];
  /** One plain sentence per line that could not be read, naming the line. */
  errors: string[];
}

/**
 * Reads the requirement list a person types for a requirement pack. One requirement per line, `KIND: title`
 * (for example `SECTION: Executive summary`, `ANNEX: Indicator table`, `QUESTION: Safeguarding statement`); a trailing `?`
 * makes it advisory instead of mandatory. Blank lines and lines starting with `#` are ignored. The key is `KIND:title-slug`,
 * which is what the report's sections are matched against, so nobody has to know a key format.
 */
export function parseRequirementLines(text: string, packName: string): ParsedPackLines {
  const requirements: ReportingRequirement[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const colon = line.indexOf(":");
    const kind = (colon > 0 ? line.slice(0, colon) : "").trim().toUpperCase() as RequirementKind;
    if (!REQUIREMENT_KINDS.includes(kind)) {
      errors.push(`Line ${index + 1}: start with one of ${REQUIREMENT_KINDS.join(", ")}, then a colon and a title.`);
      return;
    }
    let title = line.slice(colon + 1).trim();
    const advisory = title.endsWith("?");
    if (advisory) title = title.slice(0, -1).trim();
    const key = `${kind}:${slug(title)}`;
    if (!slug(title)) {
      errors.push(`Line ${index + 1}: add a title after the colon.`);
      return;
    }
    if (seen.has(key)) {
      errors.push(`Line ${index + 1}: "${title}" is listed twice.`);
      return;
    }
    seen.add(key);
    requirements.push({
      id: key,
      key,
      kind,
      required: !advisory,
      severity: advisory ? "WARNING" : "BLOCKING",
      sourceReference: { sourceType: "DONOR_PACK", sourceId: "authored", version: 1, label: `${packName}: ${title}` },
      guidance: title,
    });
  });
  return { requirements, errors };
}
