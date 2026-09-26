import {
  createRequirementPack,
  type ReportingRequirement,
  type ReportingRequirementPack,
  type RequirementPackStatus,
} from "./reporting-requirement.js";

/**
 * First-party donor pack blueprints (donor-quality remediation WS6).
 *
 * Distinctive requirements of flagship donor reporting formats, encoded as
 * data so tenants can instantiate a reviewed starting point instead of
 * transcribing guidelines by hand. Packs remain tenant-owned artefacts (see
 * ADR 0006); this catalog is the first-party source, not an automatic seed.
 *
 * SOLID: OCP — adding a donor pack is a data entry, never new logic. SRP —
 * this module owns pack data only; precedence and evaluation live elsewhere.
 */

type BlueprintRequirement = Omit<ReportingRequirement, "id" | "sourceReference">;

const SOURCE_LABEL = "First-party donor pack blueprint";

function sourceReference(packKey: string) {
  return { sourceType: "DONOR_PACK" as const, sourceId: `blueprint:${packKey}`, version: 1, label: SOURCE_LABEL };
}

function requirement(packKey: string, index: number, r: BlueprintRequirement): ReportingRequirement {
  return { ...r, id: `${packKey}:r${index + 1}`, sourceReference: sourceReference(packKey) };
}

export interface DonorPackBlueprint {
  /** Stable catalog key, e.g. "usaid-qpr". */
  key: string;
  donorKey: string;
  mechanismKey: string;
  reportType: string;
  name: string;
  language: string;
  requirements: BlueprintRequirement[];
}

export const DONOR_PACK_BLUEPRINTS: readonly DonorPackBlueprint[] = [
  {
    key: "usaid-qpr",
    donorKey: "us-usaid",
    mechanismKey: "bha-award",
    reportType: "QPR",
    name: "USAID/BHA Quarterly Progress Report",
    language: "en",
    requirements: [
      {
        key: "SECTION:executive-summary",
        kind: "SECTION",
        required: true,
        severity: "BLOCKING",
        wordLimit: { min: 150, max: 500 },
        guidance:
          "Summarize the quarter's outcomes first, then delivery context. State any target shortfalls explicitly with the recorded reasons; do not bury shortfalls after achievements.",
      },
      {
        key: "QUESTION:beneficiary-reach",
        kind: "QUESTION",
        required: true,
        severity: "BLOCKING",
        guidance:
          "How many individuals were directly reached this quarter, with sex and age disaggregation as recorded?",
      },
      {
        key: "QUESTION:safeguarding-psea",
        kind: "QUESTION",
        required: true,
        severity: "BLOCKING",
        guidance: "Report any safeguarding or PSEA concerns and the actions taken, or state clearly that none were recorded.",
      },
      {
        key: "DECLARATION:usaid-attribution",
        kind: "DECLARATION",
        required: true,
        severity: "BLOCKING",
        guidance:
          "Include the standard USAID attribution and disclaimer wording exactly as provided by the visibility guidance.",
      },
      {
        key: "INDICATOR:bu-indicators",
        kind: "INDICATOR",
        required: true,
        severity: "BLOCKING",
        guidance: "Report each Business Unit indicator with its recorded value; never estimate missing values.",
      },
    ],
  },
  {
    key: "echo-hip",
    donorKey: "european-union-echo",
    mechanismKey: "hip",
    reportType: "HIP-NARRATIVE",
    name: "ECHO Humanitarian Implementation Plan Narrative",
    language: "en",
    requirements: [
      {
        key: "SECTION:logic-and-intervention",
        kind: "SECTION",
        required: true,
        severity: "WARNING",
        guidance:
          "Explain how activities contributed to the specific objective of the HIP, using only recorded results and observations.",
      },
      {
        key: "QUESTION:accountability-affected",
        kind: "QUESTION",
        required: true,
        severity: "BLOCKING",
        guidance: "Describe accountability to affected population mechanisms used this period and any feedback received.",
      },
      {
        key: "SECTION:visibility",
        kind: "SECTION",
        required: true,
        severity: "BLOCKING",
        guidance:
          "Report visibility actions taken. Include the exact EU-funded attribution sentence; ECHO visibility rules apply to all published materials.",
      },
      {
        key: "DECLARATION:eu-attribution",
        kind: "DECLARATION",
        required: true,
        severity: "BLOCKING",
        guidance: "State 'This project is funded by the European Union.' verbatim with the applicable disclaimer.",
      },
      {
        key: "FINANCIAL:expenditure",
        kind: "FINANCIAL",
        required: true,
        severity: "BLOCKING",
        guidance:
          "Report expenditure against the sanctioned budget, cash basis, and state whether figures are unaudited; quote recorded variance explanations only.",
      },
    ],
  },
  {
    key: "unhcr-ppa",
    donorKey: "unhcr",
    mechanismKey: "ppa",
    reportType: "PPA-ANNUAL",
    name: "UNHCR Project Partnership Agreement Annual Report",
    language: "en",
    requirements: [
      {
        key: "SECTION:progress-against-results",
        kind: "SECTION",
        required: true,
        severity: "BLOCKING",
        guidance:
          "Narrate progress against each planned result, quoting recorded indicator values; flag results that could not be calculated instead of substituting estimates.",
      },
      {
        key: "QUESTION:protection-mainstreaming",
        kind: "QUESTION",
        required: true,
        severity: "BLOCKING",
        guidance: "Describe how protection principles, including age-gender-diversity mainstreaming, were applied this period.",
      },
      {
        key: "QUESTION:environmental-impact",
        kind: "QUESTION",
        required: false,
        severity: "WARNING",
        guidance: "Describe environmental mitigation measures applied, or state that none were planned or recorded.",
      },
      {
        key: "SAFEGUARD:unhcr-policy-compliance",
        kind: "SAFEGUARD",
        required: true,
        severity: "BLOCKING",
        guidance: "Confirm compliance with UNHCR policy requirements and report any incidents or deviations with actions taken.",
      },
    ],
  },
];

export function listDonorPackBlueprintKeys(): string[] {
  return DONOR_PACK_BLUEPRINTS.map((b) => b.key);
}

/**
 * Instantiates a pack from a blueprint. Pure transformation — persistence and
 * activation remain the caller's (use-case) responsibility.
 */
export function instantiateDonorPackBlueprint(input: {
  key: string;
  id: string;
  tenantId?: string;
  status?: RequirementPackStatus;
  version?: number;
}): ReportingRequirementPack {
  const blueprint = DONOR_PACK_BLUEPRINTS.find((b) => b.key === input.key);
  if (!blueprint) {
    throw new Error(`Unknown donor pack blueprint: ${input.key}. Known: ${listDonorPackBlueprintKeys().join(", ")}`);
  }
  return createRequirementPack({
    id: input.id,
    tenantId: input.tenantId,
    donorKey: blueprint.donorKey,
    mechanismKey: blueprint.mechanismKey,
    reportType: blueprint.reportType,
    version: input.version ?? 1,
    language: blueprint.language,
    name: blueprint.name,
    status: input.status,
    requirements: blueprint.requirements.map((r, i) => requirement(blueprint.key, i, r)),
  });
}

