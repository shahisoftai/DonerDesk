import * as echarts from "echarts";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { buildChartOption, optionFromResolved, resolveChartData, type ChartConfig, type ChartIndicatorInput, type ResolvedChartData } from "@donordesk/domain";

/** A chart is either already resolved (drawn from a table) or a configuration over the report's indicator rows. */
export type ChartSource = { resolved: ResolvedChartData } | { config: ChartConfig; indicators: ChartIndicatorInput[] };

export type RenderChartPngInput = ChartSource & {
  width?: number;
  height?: number;
  backgroundColor?: string;
};

function optionFor(input: ChartSource): Record<string, unknown> {
  return "resolved" in input ? optionFromResolved(input.resolved, input.resolved.type) : buildChartOption(input.indicators, input.config);
}

/**
 * Server-side chart renderer. Uses ECharts in SSR mode to produce the exact
 * same option the browser panel renders (shared `buildChartOption`), then
 * rasterises the SVG to a PNG with sharp. Output is cached by content hash in
 * `renderChartPngCached` so unchanged charts are never re-rendered.
 */
export async function renderChartPng(input: RenderChartPngInput): Promise<Buffer> {
  const width = input.width ?? 720;
  const height = input.height ?? 420;
  const option = optionFor(input);

  const chart = echarts.init(null, null, {
    renderer: "svg",
    ssr: true,
    width,
    height,
  });
  chart.setOption(option);
  const svg = chart.renderToSVGString();
  chart.dispose();

  const png = await sharp(Buffer.from(svg))
    .resize(Math.round(width * 1.5), Math.round(height * 1.5))
    .png()
    .toBuffer();
  return png;
}

/**
 * Deterministic content hash for the PNG cache. Any change to the config, the
 * indicator data, or the canvas size produces a new cache key.
 */
export function chartCacheKey(source: ChartSource, width?: number, height?: number): string {
  const payload = JSON.stringify({ source, width: width ?? 720, height: height ?? 420 });
  return createHash("sha256").update(payload).digest("hex").slice(0, 24);
}

const pngCache = new Map<string, Buffer>();
const PNG_CACHE_MAX = 128;

/**
 * Content-hashed PNG cache. In-memory only (charts are small and the working
 * set is bounded); unchanged charts are never re-rendered, so repeated exports
 * of the same finalized report are fast.
 */
export async function renderChartPngCached(input: RenderChartPngInput): Promise<Buffer> {
  const key = chartCacheKey("resolved" in input ? { resolved: input.resolved } : { config: input.config, indicators: input.indicators }, input.width, input.height);
  const hit = pngCache.get(key);
  if (hit) return hit;
  const png = await renderChartPng(input);
  if (pngCache.size >= PNG_CACHE_MAX) {
    const oldest = pngCache.keys().next().value;
    if (oldest !== undefined) pngCache.delete(oldest);
  }
  pngCache.set(key, png);
  return png;
}

/** Whether there is anything to draw: at least one value that is present and not zero. */
export function chartHasData(source: ChartSource): boolean {
  const resolved = "resolved" in source ? source.resolved : resolveChartData(source.indicators, source.config);
  if (resolved.series.length === 0) return false;
  return resolved.series.some((s) => s.data.some((d) => d !== null && Number(d) !== 0));
}
