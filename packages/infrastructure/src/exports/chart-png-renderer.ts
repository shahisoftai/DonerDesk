import * as echarts from "echarts";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { buildChartOption, resolveChartData, type ChartConfig, type ChartIndicatorInput } from "@donordesk/domain";

export interface RenderChartPngInput {
  config: ChartConfig;
  indicators: ChartIndicatorInput[];
  width?: number;
  height?: number;
  backgroundColor?: string;
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
  const option = buildChartOption(input.indicators, input.config);

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
export function chartCacheKey(config: ChartConfig, indicators: ChartIndicatorInput[], width?: number, height?: number): string {
  const payload = JSON.stringify({ config, indicators, width: width ?? 720, height: height ?? 420 });
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
  const key = chartCacheKey(input.config, input.indicators, input.width, input.height);
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

export function chartHasData(indicators: ChartIndicatorInput[], config: ChartConfig): boolean {
  const resolved = resolveChartData(indicators, config);
  if (resolved.series.length === 0) return false;
  return resolved.series.some((s) => s.data.some((d) => d !== null && Number(d) !== 0));
}
