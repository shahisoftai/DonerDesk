/**
 * The infographic page composer (Phase 32): lays a validated composition onto pages of the chosen
 * format as SVG, from the same data the Studio previews (the Studio shows these very pages).
 * Deterministic: no clock inside (generatedAt arrives in the provenance), charts come from the
 * shared `buildDataChart` option builders rendered through ECharts SSR, bundled fonts, and every
 * officer-typed string is escaped.
 *
 * Missing data renders as "Not yet reported": never zero, never invented. Sections are placed on a
 * 12-column grid in order; a row that does not fit starts a new page (print formats) or the whole
 * design is scaled to fit one canvas (screen formats).
 */
import {
  gridFor,
  iconSvg,
  isRtl,
  labelsFor,
  packRows,
  provenanceFooter,
  resolveFormat,
  resolveTheme,
  spanOf,
  themeFromBrand,
  type DataSheet,
  type InfographicConfig,
  type InfographicProvenance,
  type InfographicSectionConfig,
  type OrganizationBrandKit,
} from "@donordesk/domain";
import type { PortfolioInfographicDataDto, ProjectInfographicDataDto } from "@donordesk/application";
import { svgToPng } from "./raster.js";
import { esc, flipBack, headingHeight, paragraph, r, safeImageUri, text, textWidth, wrapText, type MapPointInput, type MapShapeInput, type RenderAsset, type RenderCtx, type Slot } from "./kit.js";
import { activitiesBlock, chartBlock, kpiBlock, locationComparisonBlock, locationResultsBlock, reachBlock, textBlock } from "./blocks-core.js";
import { mapBlock } from "./blocks-map.js";
import { portfolioCountriesBlock, portfolioHealthBlock, portfolioSummaryBlock, portfolioTableBlock, threeWBlock } from "./blocks-portfolio.js";
import {
  bannerBlock,
  bigNumbersBlock,
  demographicsBlock,
  dividerBlock,
  fundingBlock,
  funnelBlock,
  heroBlock,
  imageBlock,
  keyMessagesBlock,
  legendNotesBlock,
  progressRingsBlock,
  quoteBlock,
  resultsChainBlock,
  sectorGridBlock,
  smallMultiplesBlock,
  tableBlock,
  timelineBlock,
} from "./blocks-new.js";

export type { RenderAsset, MapPointInput, MapShapeInput };

export interface InfographicComposeInput {
  config: InfographicConfig;
  data: ProjectInfographicDataDto;
  sheet: DataSheet;
  provenance: InfographicProvenance;
  mapPoints: MapPointInput[];
  mapShapes?: MapShapeInput[];
  organizationName: string;
  logoUrl?: string;
  templateLabel: string;
  /** Uploaded images by asset id, already normalised. */
  assets?: Record<string, RenderAsset>;
  brand?: OrganizationBrandKit;
  portfolio?: PortfolioInfographicDataDto;
  /** Studio preview: empty authored blocks draw a hint. */
  preview?: boolean;
}

/** Where one block sits on a page, in canvas px: the Studio overlays these so a click on the picture selects the block. */
export interface PlacedBlock {
  /** Index into `config.sections`. */
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A composed page: the SVG, its canvas size in px (the PDF writer scales it to the paper) and where its blocks are. */
export interface ComposedPage {
  svg: string;
  width: number;
  height: number;
  blocks: PlacedBlock[];
}

async function blockFor(c: RenderCtx, section: InfographicSectionConfig, width: number): Promise<Slot | undefined> {
  switch (section.kind) {
    case "KPIS": return kpiBlock(c, section, width);
    case "CHART": return chartBlock(c, section, width);
    case "LOCATION_RESULTS": return locationResultsBlock(c, section, width);
    case "LOCATION_COMPARISON": return locationComparisonBlock(c, section, width);
    case "REACH": return reachBlock(c, section, width);
    case "ACTIVITIES_BY_LOCATION": return activitiesBlock(c, section, width);
    case "MAP": return mapBlock(c, section, width);
    case "TEXT": return textBlock(c, section, width);
    case "HERO": return heroBlock(c, section.assetId || !c.config.coverAssetId ? section : { ...section, assetId: c.config.coverAssetId }, width);
    case "BIG_NUMBERS": return bigNumbersBlock(c, section, width);
    case "FUNNEL": return funnelBlock(c, section, width);
    case "PROGRESS_RINGS": return progressRingsBlock(c, section, width);
    case "DEMOGRAPHICS": return demographicsBlock(c, section, width);
    case "SECTOR_GRID": return sectorGridBlock(c, section, width);
    case "TIMELINE": return timelineBlock(c, section, width);
    case "KEY_MESSAGES": return keyMessagesBlock(c, section, width);
    case "QUOTE": return quoteBlock(c, section, width);
    case "IMAGE": return imageBlock(c, section, width);
    case "LEGEND_NOTES": return legendNotesBlock(c, section, width);
    case "BANNER": return bannerBlock(c, section, width);
    case "FUNDING": return fundingBlock(c, section, width);
    case "SMALL_MULTIPLES": return smallMultiplesBlock(c, section, width);
    case "TABLE": return tableBlock(c, section, width);
    case "RESULTS_CHAIN": return resultsChainBlock(c, section, width);
    case "DIVIDER": return dividerBlock(c, width);
    case "PORTFOLIO_SUMMARY": return portfolioSummaryBlock(c, section, width);
    case "PORTFOLIO_TABLE": return portfolioTableBlock(c, section, width);
    case "PORTFOLIO_HEALTH": return portfolioHealthBlock(c, section, width);
    case "PORTFOLIO_COUNTRIES": return portfolioCountriesBlock(c, section, width);
    case "THREE_W": return threeWBlock(c, section, width);
  }
}

interface PlacedRow {
  items: Array<{ slot: Slot; x: number; index: number }>;
  height: number;
  breakBefore: boolean;
}

export function contextFor(input: InfographicComposeInput): RenderCtx {
  const config = input.config;
  const brandTheme = input.brand ? themeFromBrand(input.brand) : undefined;
  const t = resolveTheme(config.themeId, brandTheme);
  const format = resolveFormat(config.format);
  const lang = config.language ?? "en";
  const rtl = isRtl(lang);
  return {
    t,
    rtl,
    font: rtl ? `'Noto Sans Arabic', ${t.font}` : t.font,
    format,
    grid: gridFor(format),
    s: Math.min(Math.max(format.width / 1240, 1), 1.6),
    lang,
    l: labelsFor(lang),
    config,
    data: input.data,
    ...(input.portfolio ? { portfolio: input.portfolio } : {}),
    sheet: input.sheet,
    mapPoints: input.mapPoints,
    mapShapes: input.mapShapes ?? [],
    assets: new Map(
      Object.entries(input.assets ?? {}).flatMap(([id, asset]) => {
        const dataUri = safeImageUri(asset.dataUri);
        return dataUri && Number.isFinite(asset.width) && Number.isFinite(asset.height) && asset.width > 0 && asset.height > 0 ? [[id, { ...asset, dataUri }] as const] : [];
      }),
    ),
    chartSeq: 0,
    preview: input.preview ?? false,
  };
}

/** The rendered pages (SVG strings with their canvas size) of one infographic. */
export async function composeInfographicPages(input: InfographicComposeInput): Promise<string[]> {
  return (await composeInfographicDocument(input)).map((page) => page.svg);
}

export async function composeInfographicDocument(input: InfographicComposeInput): Promise<ComposedPage[]> {
  const c = contextFor(input);
  const { t, s, format, grid, config } = c;
  const W = format.width;
  const H = format.height;
  const M = format.margin;

  // 1. Blocks on the grid.
  const sections = config.sections.filter((section) => !section.hidden);
  const built: Array<{ span: number; breakBefore: boolean; slot: Slot; index: number }> = [];
  for (const [index, section] of config.sections.entries()) {
    if (section.hidden) continue;
    const span = spanOf(section);
    const slot = await blockFor(c, section, grid.spanWidth(span));
    if (slot) built.push({ span, breakBefore: Boolean(section.pageBreakBefore), slot, index });
  }
  const packed = packRows(built.map((b) => ({ ...b })));
  const rows: PlacedRow[] = packed.map((items) => {
    let x = 0;
    const placed = items.map((item) => {
      // A right-to-left page lays blocks out from the right edge.
      const placedItem = { slot: item.slot, x: c.rtl ? grid.contentWidth - x - item.slot.width : x, index: item.index };
      x += item.slot.width + grid.gap;
      return placedItem;
    });
    return { items: placed, height: Math.max(...items.map((i) => i.slot.height)), breakBefore: Boolean(items[0]?.breakBefore) };
  });

  // 2. Page furniture sizes.
  const firstIsHero = sections[0]?.kind === "HERO";
  const acknowledgement = config.acknowledgement ?? (config.branding ? input.brand?.acknowledgement : undefined);
  const footerLine = config.branding ? input.brand?.footerLine : undefined;
  const footerH = (48 + (acknowledgement ? 18 : 0) + (footerLine ? 16 : 0)) * s;
  const topFirst = M + (firstIsHero ? 0 : 96 * s);
  const topNext = M + 44 * s;
  const gapY = 8 * s;

  // 3. Paginate. Print formats break where a row no longer fits. Screen formats (one card per page) shrink the
  // content to fit, down to a floor of 72%; beyond that the rest continues on the next card (a carousel).
  const pages: Array<{ rows: PlacedRow[]; scale: number }> = [];
  const MIN_SCALE = 0.72;
  const firstUsable = H - topFirst - M - footerH;
  const nextUsable = H - topNext - M - footerH;
  let current: PlacedRow[] = [];
  let used = 0;
  const capacity = (): number => (format.singlePage ? (pages.length === 0 ? firstUsable : nextUsable) / MIN_SCALE : pages.length === 0 ? firstUsable : nextUsable);
  const close = (): void => {
    const usable = pages.length === 0 ? firstUsable : nextUsable;
    pages.push({ rows: current, scale: format.singlePage && used > usable ? Math.max(usable / used, MIN_SCALE) : 1 });
    current = [];
    used = 0;
  };
  for (const row of rows) {
    if (current.length > 0 && (row.breakBefore || used + row.height > capacity())) close();
    current.push(row);
    used += row.height + gapY;
  }
  if (current.length > 0) close();
  if (pages.length === 0) pages.push({ rows: [], scale: 1 });

  // 4. Draw.
  const designTitle = config.title ?? input.templateLabel;
  const periodLabel = input.provenance.periodLabels.length > 0 ? `${c.l.reportingPeriod}: ${input.provenance.periodLabels.join(" – ")}` : c.l.allPeriods;
  const logo = safeImageUri(input.logoUrl);
  const donorLogos = (config.donorLogoAssetIds ?? []).map((id) => c.assets.get(id)).filter((x): x is RenderAsset => Boolean(x));
  const footerText = provenanceFooter(input.provenance, c.lang);

  const header = (pageIndex: number): string => {
    let out = "";
    if (pageIndex === 0 && !firstIsHero) {
      if (logo) out += flipBack(c, M + 23 * s, `<image x="${M}" y="${r(M - 10 * s)}" width="${r(46 * s)}" height="${r(46 * s)}" href="${logo}"/>`);
      const tx = M + (logo ? 58 * s : 0);
      out += text(c, tx, M + 8 * s, wrapText(input.organizationName, 44 * 12, 10 * s, 1)[0]?.toUpperCase() ?? "", { size: 10 * s, fill: t.muted });
      const tw = W - M * 2 - (logo ? 58 * s : 0) - 240 * s;
      const lines = wrapText(designTitle, Math.max(tw, 200), 24 * s, 2, true);
      lines.forEach((line, i) => (out += text(c, tx, M + 36 * s + i * 28 * s, line, { size: 24 * s, bold: true })));
      if (config.subtitle && lines.length < 2) out += text(c, tx, M + 36 * s + lines.length * 28 * s - 4 * s, wrapText(config.subtitle, tw, 11.5 * s, 1)[0] ?? "", { size: 11.5 * s, fill: t.muted });
      out += `<rect x="${r(W - M - 220 * s)}" y="${r(M - 14 * s)}" width="${r(220 * s)}" height="${r(30 * s)}" rx="${r(15 * s)}" fill="${t.accentSoft}"/>`;
      out += text(c, W - M - 110 * s, M + 6 * s, input.templateLabel, { size: 11 * s, bold: true, fill: t.accent, anchor: "middle" });
      out += text(c, W - M, M + 36 * s, wrapText(periodLabel, 240 * s, 10.5 * s, 1)[0] ?? periodLabel, { size: 10.5 * s, fill: t.muted, anchor: "end" });
      out += `<rect x="0" y="${r(M + 66 * s)}" width="${W}" height="${r(3 * s)}" fill="${t.accent}"/>`;
    } else if (pageIndex > 0) {
      out += text(c, M, M + 8 * s, `${input.organizationName.toUpperCase()}  ·  ${designTitle}`, { size: 10 * s, fill: t.muted });
      out += `<rect x="0" y="${r(M + 20 * s)}" width="${W}" height="${r(2 * s)}" fill="${t.accent}"/>`;
    }
    return out;
  };

  const footer = (pageIndex: number, total: number): string => {
    const fy = H - M - footerH + 16 * s;
    let out = `<rect x="0" y="${r(fy)}" width="${W}" height="${r(1.5 * s)}" fill="${t.line}"/>`;
    let y = fy + 20 * s;
    out += text(c, M, y, wrapText(footerText, W - M * 2 - 140 * s, 10 * s, 1)[0] ?? footerText, { size: 10 * s, fill: t.muted });
    out += text(c, W - M, y, "DonorDesk", { size: 10 * s, fill: t.muted, anchor: "end" });
    if (acknowledgement) {
      y += 18 * s;
      out += text(c, M, y, wrapText(acknowledgement, W - M * 2 - (donorLogos.length * 70 * s), 10.5 * s, 1)[0] ?? acknowledgement, { size: 10.5 * s, fill: t.body, bold: true });
    }
    if (footerLine) {
      y += 16 * s;
      out += text(c, M, y, wrapText(footerLine, W - M * 2, 9.5 * s, 1)[0] ?? footerLine, { size: 9.5 * s, fill: t.muted });
    }
    donorLogos.forEach((asset, i) => {
      const h = 30 * s;
      const w = Math.min(Math.max((asset.width / asset.height) * h, h), 90 * s);
      const lx = W - M - (donorLogos.length - i) * (96 * s);
      out += flipBack(c, lx + w / 2, `<image x="${r(lx)}" y="${r(fy + 26 * s)}" width="${r(w)}" height="${r(h)}" href="${asset.dataUri}" preserveAspectRatio="xMidYMid meet"/>`);
    });
    if (total > 1) out += text(c, W - M, H - M + 6 * s, c.l.pageOf.replace("{n}", String(pageIndex + 1)).replace("{m}", String(total)), { size: 9.5 * s, fill: t.muted, anchor: "end" });
    return out;
  };

  return pages.map((page, pageIndex) => {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>${esc(designTitle)}</title>`;
    svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="${t.page}"/>`;
    svg += c.rtl ? `<g transform="translate(${W} 0) scale(-1 1)">${header(pageIndex)}</g>` : header(pageIndex);
    const top = pageIndex === 0 ? topFirst : topNext;
    const offsetX = page.scale < 1 ? (grid.contentWidth * (1 - page.scale)) / 2 : 0;
    let y = 0;
    let body = "";
    const blocks: PlacedBlock[] = [];
    for (const row of page.rows) {
      for (const item of row.items) {
        body += `<g transform="translate(${r(item.x)} ${r(y)})">${c.rtl ? `<g transform="translate(${r(item.slot.width)} 0) scale(-1 1)">${item.slot.svg}</g>` : item.slot.svg}</g>`;
        blocks.push({ index: item.index, x: Math.round(M + offsetX + item.x * page.scale), y: Math.round(top + y * page.scale), width: Math.round(item.slot.width * page.scale), height: Math.round(Math.max(item.slot.height - 18 * s, 8) * page.scale) });
      }
      y += row.height + gapY;
    }
    svg += `<g transform="translate(${r(M + offsetX)} ${r(top)}) scale(${r(page.scale)})">${body}</g>`;
    svg += c.rtl ? `<g transform="translate(${W} 0) scale(-1 1)">${footer(pageIndex, pages.length)}</g>` : footer(pageIndex, pages.length);
    svg += `</svg>`;
    return { svg, width: W, height: H, blocks };
  });
}

/** One composed page rasterized (used by the PNG renderer). */
export async function rasterizePage(svg: string, scale = 1): Promise<Buffer> {
  return svgToPng(svg, scale);
}

export { iconSvg, headingHeight, paragraph, textWidth };
