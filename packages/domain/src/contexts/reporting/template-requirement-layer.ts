import type { ReportingRequirement } from "./reporting-requirement.js";

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "annex";
}

/**
 * The requirements a donor's own template places on a report, as a layer for the requirement resolver. Before this the
 * resolver read only signed award overrides and donor packs, so what a reviewed template said never reached the gate that
 * blocks approval.
 *
 * Only what can be checked against the report's structure becomes a requirement: a required annex must appear as a
 * section of the report (the evaluator matches the key to a section title). Compliance statements and indicator wording
 * cannot be matched to a section by title, so they stay checklist items; making them requirements would block approval
 * with nothing a person could do to satisfy them. A template is reviewed by a person before it is used, so a required
 * annex is blocking.
 */
export function requirementsFromTemplate(template: {
  id: string;
  version: number;
  templateName: string;
  requirements: { annexes: ReadonlyArray<{ id?: string; name: string; required: boolean; description?: string }> };
}): ReportingRequirement[] {
  const seen = new Set<string>();
  const out: ReportingRequirement[] = [];
  for (const annex of template.requirements.annexes) {
    const name = annex.name.trim();
    if (!annex.required || !name) continue;
    const key = `ANNEX:${slug(name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `${template.id}:${key}`,
      key,
      kind: "ANNEX",
      required: true,
      severity: "BLOCKING",
      sourceReference: {
        sourceType: "TEMPLATE",
        sourceId: template.id,
        version: template.version,
        label: `${template.templateName}: required annex "${name}"`,
      },
      ...(annex.description ? { guidance: annex.description } : {}),
    });
  }
  return out;
}
