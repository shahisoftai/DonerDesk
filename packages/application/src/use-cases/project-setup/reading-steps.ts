/**
 * The steps around the per-area reading: the survey of headings before it, and after it the focused second looks, the check of
 * key values and the recognition of places. Each is optional and none can lose what was read: a step that fails leaves the
 * proposal as it was.
 */
import { SETUP_AREAS, addOnlyNew, findingFor, groundAreaPatch, markDoubted, setupRepairs, verifiableFields, type ProjectSetupProposal, type SectionFinding, type SetupAreaKey, type SourceBlock, type TenantId } from "@donordesk/domain";
import type { ISetupAreaExtractor, ISetupFieldVerifier, ISetupPlaceLookup, ISetupSectionSurveyor, SetupUsage } from "../../ports/project-setup.js";

export interface ReadingSteps {
  surveyor?: ISetupSectionSurveyor | undefined;
  verifier?: ISetupFieldVerifier | undefined;
  placeLookup?: ISetupPlaceLookup | undefined;
}

const MAX_PLACE_LOOKUPS = 25;

export type AreaFinding = SectionFinding & { emptyHeadingPaths: string[] };

export interface SurveyResult {
  preferred: Map<SetupAreaKey, string[]>;
  findings: Map<SetupAreaKey, AreaFinding>;
  usage?: SetupUsage | undefined;
}

export async function surveySections(steps: ReadingSteps, extractors: ReadonlyArray<ISetupAreaExtractor>, tenantId: TenantId, blocks: ReadonlyArray<SourceBlock>): Promise<SurveyResult> {
  const answer = steps.surveyor ? await steps.surveyor.survey({ tenantId, blocks }).catch(() => undefined) : undefined;
  const preferred = new Map<SetupAreaKey, string[]>();
  const findings = new Map<SetupAreaKey, AreaFinding>();
  for (const extractor of extractors) {
    const area = extractor.area;
    const fed = blocks.filter((b) => extractor.feeds?.(b)).map((b) => b.section).filter((s): s is string => !!s);
    const sections = [...new Set([...(answer?.sections[area] ?? []), ...fed])];
    preferred.set(area, sections);
    if (SETUP_AREAS[area].alwaysPresent) continue;
    const finding = findingFor(area, sections, blocks);
    const emptyHeadingPaths = sections.filter((s) => finding.emptyHeadings.includes(s.split(" > ").pop()!.trim()));
    findings.set(area, { ...finding, emptyHeadingPaths });
  }
  return { preferred, findings, usage: answer?.usage };
}

export interface AfterAreasInput {
  extractors: ReadonlyArray<ISetupAreaExtractor>;
  tenantId: TenantId;
  proposalId: string;
  blocks: ReadonlyArray<SourceBlock>;
  sourceText: string;
  maxTokens: number;
  timeoutMs: number;
  skipRepairs: boolean;
}

const add = (a: SetupUsage, b: SetupUsage | undefined): SetupUsage => (b ? { calls: a.calls + b.calls, inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens } : a);

/** A part with items was found, whatever its headings; the stored finding keeps only what a person is told. */
function storedFindings(findings: ReadonlyMap<SetupAreaKey, AreaFinding>, data: ProjectSetupProposal): SectionFinding[] {
  return [...findings.values()].map(({ emptyHeadingPaths: _paths, ...f }) => {
    const hasItems = SETUP_AREAS[f.area].items(data) > 0;
    if (f.state === "NOT_IN_DOCUMENTS" && hasItems) return { ...f, state: "FOUND" as const };
    return f;
  });
}

export async function afterAllAreas(steps: ReadingSteps, input: AfterAreasInput, start: ProjectSetupProposal, findings: ReadonlyMap<SetupAreaKey, AreaFinding>): Promise<{ data: ProjectSetupProposal; usage: SetupUsage }> {
  let data = start;
  let usage: SetupUsage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  if (!input.skipRepairs) {
    for (const repair of setupRepairs(data)) {
      const extractor = input.extractors.find((e) => e.area === repair.area);
      const again = await extractor?.extract({ tenantId: input.tenantId, proposalId: input.proposalId, area: repair.area, blocks: input.blocks, sourceText: input.sourceText, prior: {}, maxTokens: input.maxTokens, timeoutMs: input.timeoutMs, hint: repair.hint });
      if (!again?.ok) continue;
      usage = add(usage, again.value.usage);
      const grounded = groundAreaPatch(repair.area, again.value.fields, input.sourceText, input.blocks);
      if (!("error" in grounded)) data = { ...data, ...addOnlyNew(data as unknown as Record<string, unknown>, grounded.fields) } as ProjectSetupProposal;
    }
  }
  if (steps.verifier && !input.skipRepairs) {
    const checked = await steps.verifier.doubted({ tenantId: input.tenantId, fields: verifiableFields(data) }).catch(() => ({ paths: [] as string[], usage: undefined }));
    usage = add(usage, checked.usage);
    data = markDoubted(data, checked.paths);
  }
  if (steps.placeLookup) {
    const country = Array.isArray(data.facts.countries.value) && data.facts.countries.value.length === 1 ? data.facts.countries.value[0]! : null;
    const places = await Promise.all(data.places.map(async (place, i) => {
      if (i >= MAX_PLACE_LOOKUPS || !place.value?.name) return place;
      const recognised = await steps.placeLookup!.lookup(place.value.name, country).catch(() => null);
      return recognised ? { ...place, value: { ...place.value, recognised } } : place;
    }));
    data = { ...data, places };
  }
  return { data: { ...data, sectionFindings: storedFindings(findings, data) }, usage };
}
