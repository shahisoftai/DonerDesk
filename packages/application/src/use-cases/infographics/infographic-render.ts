import {
  DomainError,
  PORTFOLIO_PROJECT_ID,
  buildAltText,
  buildProvenance,
  cellPercentOfTarget,
  checkDesign,
  hasShareOfTarget,
  indexCells,
  labelsFor,
  resolveTheme,
  themeFromBrand,
  type DataSheet,
  type DesignCheckResult,
  type InfographicConfig,
  type InfographicProvenance,
  type OrganizationBrandKit,
  type Result,
  type StoryFacts,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { IStorage } from "../../ports/infrastructure.js";
import type { IBrandKitRepository, IInfographicAssetRepository, InfographicRenderInput, IOrganizationBrandReader } from "../../ports/infographics.js";
import type { GetProjectDataSheetHandler } from "../data-center/data-sheet.js";
import type { GetProjectInfographicDataHandler, ProjectInfographicDataDto } from "./infographic-data.js";
import type { GetPortfolioInfographicDataHandler, PortfolioInfographicDataDto } from "./portfolio-data.js";

/** What a portfolio design sees in place of one project's records: nothing, so a block about a single project says "Not yet reported" rather than guessing. */
function emptyProjectData(asAt: string): ProjectInfographicDataDto {
  return {
    projectId: PORTFOLIO_PROJECT_ID,
    project: { title: "Portfolio", projectCode: "", donorName: "", sector: "", country: "", start: asAt, end: asAt, status: "ACTIVE" },
    periods: [],
    periodOrder: [],
    indicators: [],
    reach: { overallUnique: 0, registeredByLocation: [], attendancesByActivityLocation: [], beneficiariesWithoutLocation: 0, attendancesWithoutLocation: 0, registeredTotal: 0, bySex: {}, byAgeGroup: {} },
    activities: { rows: [], unlocated: 0 },
    finance: { enabled: false, rows: [] },
    provenance: { generatedAt: asAt, unverifiedValues: 0, locationTrackedIndicators: 0, projectWideIndicators: 0 },
  } as unknown as ProjectInfographicDataDto;
}

/** The picture the Studio sends along with a render: pins and outlines resolved in the browser (no server-side geometry). */
export interface RenderMapInput {
  mapPoints?: ReadonlyArray<{ name: string; lat: number; lng: number; worst: string; count?: number }>;
  mapShapes?: ReadonlyArray<{ kind: "COUNTRY" | "REGION"; rings: Array<Array<[number, number]>>; name?: string; value?: number }>;
}

export interface BuiltRender {
  input: InfographicRenderInput;
  data: ProjectInfographicDataDto;
  sheet: DataSheet;
  provenance: InfographicProvenance;
  check: DesignCheckResult;
  facts: StoryFacts;
  altText: string;
  periodIds: string[];
  indicatorIds: string[];
  organizationName: string;
  portfolio?: PortfolioInfographicDataDto;
}

/** The ids of every uploaded asset a design uses (images, cover, partner logos). */
export function assetIdsOf(config: InfographicConfig): string[] {
  const ids = new Set<string>();
  for (const section of config.sections) if (section.assetId) ids.add(section.assetId);
  if (config.coverAssetId) ids.add(config.coverAssetId);
  for (const id of config.donorLogoAssetIds ?? []) ids.add(id);
  return [...ids];
}

/** The periods a config's period range selects (the read model orders them; absent = all). */
export function periodIdsOf(config: InfographicConfig, data: ProjectInfographicDataDto): string[] {
  const fromIndex = config.periodFromId ? data.periodOrder.indexOf(config.periodFromId) : 0;
  const toIndex = config.periodToId ? data.periodOrder.indexOf(config.periodToId) : data.periodOrder.length - 1;
  if (fromIndex < 0 || toIndex < 0) return [...data.periodOrder];
  return data.periodOrder.slice(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex) + 1);
}

/** Indicators the design actually names in its visible sections. */
export function indicatorIdsOf(config: InfographicConfig, data: ProjectInfographicDataDto): string[] {
  const named = new Set<string>();
  for (const section of config.sections) {
    if (section.hidden) continue;
    for (const id of section.indicatorIds ?? []) named.add(id);
    for (const id of section.chart?.indicatorIds ?? []) named.add(id);
    for (const item of section.numbers ?? []) if (item.indicatorId) named.add(item.indicatorId);
    for (const sector of section.sectors ?? []) for (const id of sector.indicatorIds) named.add(id);
  }
  return data.indicators.filter((indicator) => named.has(indicator.id)).map((indicator) => indicator.id);
}

/** Unverified plotted values: any visible section naming an indicator whose latest figures are unverified. */
export function unverifiedCountOf(config: InfographicConfig, data: ProjectInfographicDataDto): number {
  let count = 0;
  for (const indicator of data.indicators) {
    if (indicator.location.kind === "PROJECT_WIDE") continue;
    for (const row of indicator.location.rows) {
      if (!config.locationKeys?.length || config.locationKeys.includes(row.key)) count += row.unverified;
    }
  }
  return count;
}

/** The figures a suggestion or a description may use, read from the same data the image shows. */
export function storyFactsOf(data: ProjectInfographicDataDto, sheet: DataSheet, config?: InfographicConfig): StoryFacts {
  const cells = indexCells(sheet);
  const order = (config ? periodIdsOf(config, data) : data.periodOrder).slice().reverse();
  const indicators: Array<StoryFacts["indicators"][number]> = [];
  for (const indicator of sheet.indicators) {
    for (const periodId of order) {
      const cell = cells.get(`${indicator.id}|${periodId}`);
      if (!cell) continue;
      const useCumulative = !indicator.isRate && cell.cumulativeValue.trim() !== "";
      const value = useCumulative ? cell.cumulativeValue : cell.periodValue;
      if (value.trim() === "") continue;
      const pct = hasShareOfTarget(indicator) ? Number.parseFloat(cellPercentOfTarget(indicator, cell)) : Number.NaN;
      indicators.push({ name: indicator.name, value: indicator.unit === "%" ? `${value}%` : value, ...(indicator.target ? { target: indicator.target } : {}), ...(Number.isFinite(pct) ? { percentOfTarget: pct } : {}), isRate: indicator.isRate });
      break;
    }
  }
  indicators.sort((a, b) => (b.percentOfTarget ?? -1) - (a.percentOfTarget ?? -1));
  const names = new Map<string, number>();
  for (const row of data.activities.rows) names.set(row.location, (names.get(row.location) ?? 0) + row.planned + row.done);
  for (const row of data.reach.registeredByLocation) names.set(row.location, (names.get(row.location) ?? 0) + row.unique);
  return {
    projectTitle: data.project.title,
    ...(data.project.country ? { country: data.project.country } : {}),
    locations: [...names.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name),
    reachUnique: data.reach.overallUnique,
    activitiesDone: data.activities.rows.reduce((n, row) => n + row.done, 0),
    activitiesPlanned: data.activities.rows.reduce((n, row) => n + row.planned, 0) + data.activities.unlocated,
    financeEnabled: data.finance.enabled && data.finance.rows.length > 0,
    indicators,
  };
}

/**
 * Builds everything a render needs from the design and the project's records: the data read, the
 * sheet, the brand, the images (read from storage, as data URIs), the provenance and the Design
 * check. The Studio preview and every export go through this one function, so they cannot differ.
 */
export class InfographicRenderService {
  constructor(
    private readonly data: GetProjectInfographicDataHandler,
    private readonly sheet: GetProjectDataSheetHandler,
    private readonly brands: IOrganizationBrandReader,
    private readonly brandKits: IBrandKitRepository,
    private readonly assets: IInfographicAssetRepository,
    private readonly storage: IStorage,
    private readonly clock: IClock,
    private readonly portfolioData?: GetPortfolioInfographicDataHandler,
  ) {}

  async build(ctx: AuthenticatedContext, projectId: string, config: InfographicConfig, opts: RenderMapInput & { preview?: boolean } = {}): Promise<Result<BuiltRender, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const portfolioMode = config.scope === "PORTFOLIO" || projectId === PORTFOLIO_PROJECT_ID;
    let portfolio: PortfolioInfographicDataDto | undefined;
    if (portfolioMode) {
      if (!this.portfolioData) return { ok: false, error: DomainError.validation("Portfolio infographics are not available here") };
      const read = await this.portfolioData.handle(ctx);
      if (!read.ok) return read;
      portfolio = read.value;
    }
    const emptySheet: DataSheet = { projectId: PORTFOLIO_PROJECT_ID, periods: [], indicators: [], cells: [], finance: [] };
    const [dataResult, sheetResult, brand, kitResult] = portfolioMode
      ? [{ ok: true as const, value: emptyProjectData(portfolio!.asAt) }, { ok: true as const, value: emptySheet }, await this.brands.brandFor(tenantId), await this.brandKits.get(tenantId)]
      : [await this.data.handle(ctx, projectId), await this.sheet.handle(ctx, projectId), await this.brands.brandFor(tenantId), await this.brandKits.get(tenantId)];
    if (!dataResult.ok) return dataResult;
    if (!sheetResult.ok) return sheetResult;
    if (!brand.ok) return brand;
    if (!kitResult.ok) return kitResult;
    const data = dataResult.value;
    const sheet = sheetResult.value;
    const kit: OrganizationBrandKit | undefined = kitResult.value ?? undefined;
    const useKit = Boolean(kit) && (config.themeId === "BRAND" || config.branding);

    // Uploaded images, read once.
    const wanted = [...new Set([...assetIdsOf(config), ...(useKit && kit?.logoAssetId ? [kit.logoAssetId] : [])])];
    const assetRows = await this.assets.findByIds(wanted, tenantId);
    if (!assetRows.ok) return assetRows;
    const live = assetRows.value.filter((row) => !row.archivedAt);
    const assets: Record<string, { dataUri: string; width: number; height: number }> = {};
    for (const row of live) {
      try {
        const bytes = await this.storage.read(row.storageKey);
        assets[row.id] = { dataUri: `data:${row.contentType};base64,${bytes.toString("base64")}`, width: row.width, height: row.height };
      } catch {
        // A file missing from storage is treated as a removed asset: the Design check names it.
      }
    }

    const periodIds = periodIdsOf(config, data);
    const periodLabels = portfolio ? [`${labelsFor(config.language).asAt} ${portfolio.asAt}`] : periodIds.map((id) => data.periods.find((p) => p.id === id)?.label).filter((x): x is string => Boolean(x));
    const indicatorIds = indicatorIdsOf(config, data);
    const provenance = buildProvenance({
      generatedAt: this.clock.now().toISOString(),
      periodLabels,
      indicatorCodes: data.indicators.filter((i) => indicatorIds.includes(i.id)).map((i) => i.code),
      unverifiedCount: unverifiedCountOf(config, data),
      notYetReportedCount: data.indicators.filter((i) => i.location.kind === "PROJECT_WIDE" && !i.projectWideValue).length,
    });
    const facts = storyFactsOf(data, sheet, config);
    const smallest = data.reach.registeredByLocation.filter((row) => row.unique > 0).reduce<number | undefined>((min, row) => (min === undefined || row.unique < min ? row.unique : min), undefined);
    const theme = resolveTheme(config.themeId, useKit && kit ? themeFromBrand(kit) : undefined);
    const check = checkDesign({
      config,
      theme,
      ...(data.project.country ? { country: data.project.country } : {}),
      unverifiedValues: provenance.unverifiedCount,
      indicatorIds: new Set(sheet.indicators.map((i) => i.id)),
      assetIds: new Set(Object.keys(assets)),
      ...(smallest !== undefined ? { smallestReachCell: smallest } : {}),
    });
    const title = config.title ?? data.project.title;
    const altText = buildAltText(config, { title, ...(data.project.country ? { country: data.project.country } : {}), reachUnique: facts.reachUnique, activitiesDone: facts.activitiesDone, activitiesPlanned: facts.activitiesPlanned, ...(periodLabels.length ? { periodLabel: periodLabels.length > 1 ? `${periodLabels[0]} – ${periodLabels[periodLabels.length - 1]}` : periodLabels[0] } : {}) });

    const orgLogo = useKit && kit?.logoAssetId && assets[kit.logoAssetId] ? assets[kit.logoAssetId]!.dataUri : brand.value.logoUrl;
    const input: InfographicRenderInput = {
      configJson: JSON.stringify(config),
      dataJson: JSON.stringify(data),
      sheetJson: JSON.stringify(sheet),
      mapPointsJson: JSON.stringify(opts.mapPoints ?? []),
      mapShapesJson: JSON.stringify(opts.mapShapes ?? []),
      assetsJson: JSON.stringify(assets),
      ...(useKit && kit ? { brandJson: JSON.stringify(kit) } : {}),
      ...(portfolio ? { portfolioJson: JSON.stringify(portfolio) } : {}),
      organizationName: brand.value.name,
      ...(orgLogo ? { logoUrl: orgLogo } : {}),
      provenanceJson: JSON.stringify(provenance),
      ...(opts.preview ? { preview: true } : {}),
    };
    return { ok: true, value: { input, data, sheet, provenance, check, facts, altText, periodIds, indicatorIds, organizationName: brand.value.name, ...(portfolio ? { portfolio } : {}) } };
  }
}
