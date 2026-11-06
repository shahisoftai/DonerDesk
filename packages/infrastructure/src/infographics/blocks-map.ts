/**
 * The map block (Phase 32.5): site pins over an optional outline the browser resolved from the
 * bundled boundaries, optional first-level areas shaded by a value (choropleth), a legend, and the
 * UN map disclaimer. The server never holds geometry: whatever outlines arrive in the request are
 * drawn as given, and without any the pins stand alone on a plain panel.
 */
import { mapDisclaimerLines, resolveLanguage, type InfographicSectionConfig } from "@donordesk/domain";
import { flipBack, framed, headingHeight, mixHex, notReported, paragraph, r, text, wrapText, type RenderCtx, type Slot, type MapShapeInput } from "./kit.js";
import { titleFor } from "./blocks-core.js";

const SIGNAL_LABEL = (c: RenderCtx, signal: string): string =>
  c.portfolio
    ? // On a portfolio page a pin is a country and its colour is how delivery is going there.
      signal === "ON_TIME" ? c.l.onTrack : signal === "LATE" ? c.l.offTrack : signal === "DONE" ? c.l.atRisk : c.l.noPlan
    : signal === "ON_TIME" ? c.l.pinOnTime : signal === "LATE" ? c.l.pinLate : signal === "DONE" ? c.l.pinDone : c.l.pinCancelled;

function quantileBreaks(values: number[], bins: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 1; i < bins; i += 1) out.push(sorted[Math.min(sorted.length - 1, Math.floor((i / bins) * sorted.length))] ?? 0);
  return out;
}

function ringPath(ring: Array<[number, number]>, project: (lng: number, lat: number) => [number, number]): string {
  return ring.map(([lng, lat], i) => `${i === 0 ? "M" : "L"}${r(project(lng, lat)[0])} ${r(project(lng, lat)[1])}`).join("") + "Z";
}

export function mapBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const title = titleFor(c, section);
  const { t, s, mapPoints, mapShapes } = c;
  const bodyH = Math.min(Math.max(width * 0.62, 220 * s), 440 * s);
  const shapes = mapShapes.filter((shape) => shape.rings.length > 0);
  const hasGeometry = shapes.length > 0;
  if (mapPoints.length === 0 && !hasGeometry) {
    const slot = notReported(c, title, width, bodyH / s);
    return slot;
  }

  // Fit the view to what is drawn.
  const lngs: number[] = [];
  const lats: number[] = [];
  for (const shape of shapes) for (const ring of shape.rings) for (const [lng, lat] of ring) (lngs.push(lng), lats.push(lat));
  for (const p of mapPoints) (lngs.push(p.lng), lats.push(p.lat));
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const kx = Math.max(Math.cos(midLat), 0.2);
  const pad = 28 * s;
  const legendH = 26 * s;
  const innerW = width - pad * 2;
  const innerH = bodyH - pad * 2 - legendH;
  const spanX = Math.max((maxLng - minLng) * kx, 0.05);
  const spanY = Math.max(maxLat - minLat, 0.05);
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const offX = pad + (innerW - spanX * scale) / 2;
  const offY = pad + (innerH - spanY * scale) / 2;
  const project = (lng: number, lat: number): [number, number] => [offX + (lng - minLng) * kx * scale, offY + (maxLat - lat) * scale];

  // Geography keeps its own east–west direction on a mirrored page: draw it with a left-to-right context and flip the whole picture back.
  const cm: RenderCtx = c.rtl ? { ...c, rtl: false } : c;
  let geo = `<rect x="0" y="0" width="${r(width)}" height="${r(bodyH)}" rx="${t.radius}" fill="${t.mapWater}"/>`;
  const regions = shapes.filter((x): x is MapShapeInput & { value: number } => x.kind === "REGION" && typeof x.value === "number");
  const classes = 5;
  const breaks = regions.length > 0 ? quantileBreaks(regions.map((x) => x.value), classes) : [];
  const ramp = (i: number): string => mixHex(t.accentSoft, t.accent, 0.15 + (i / (classes - 1)) * 0.85);
  const classOf = (v: number): number => breaks.filter((b) => v >= b).length;
  for (const shape of shapes) {
    const d = shape.rings.map((ring) => ringPath(ring, project)).join("");
    if (shape.kind === "COUNTRY") geo += `<path d="${d}" fill="${t.card}" stroke="${t.mapNote}" stroke-width="${r(1.4 * s)}" stroke-linejoin="round"/>`;
    else {
      const fillColor = typeof shape.value === "number" ? ramp(classOf(shape.value)) : "none";
      geo += `<path d="${d}" fill="${fillColor}" stroke="${t.mapNote}" stroke-width="${r(0.8 * s)}" stroke-linejoin="round" opacity="0.95"/>`;
    }
  }
  const labelled = mapPoints.slice(0, 120);
  for (const point of labelled) {
    const [cx, cy] = project(point.lng, point.lat);
    const radius = Math.min(6 + (point.count ?? 1), 14) * s;
    geo += `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(radius)}" fill="${t.signals[point.worst as keyof typeof t.signals] ?? t.accent}" stroke="${t.card}" stroke-width="${r(2 * s)}"/>`;
    geo += text(cm, cx + radius + 3 * s, cy + 4 * s, wrapText(point.name, 110 * s, 9 * s, 1, true)[0] ?? point.name, { size: 9 * s, fill: t.mapLabel, bold: true });
  }

  let body = flipBack(c, width / 2, geo);
  // Legend: shading steps when regions carry values, otherwise the pin colours present.
  const ly = bodyH - legendH / 2 - 2 * s;
  let lx = 14 * s;
  if (regions.length > 0) {
    const min = Math.min(...regions.map((x) => x.value));
    const max = Math.max(...regions.map((x) => x.value));
    body += text(c, lx, ly + 3 * s, `${c.l.legend}: ${min.toLocaleString("en-US")}`, { size: 9 * s, fill: t.mapNote });
    lx += (c.l.legend.length + String(min).length + 4) * 5 * s;
    for (let i = 0; i < classes; i += 1) body += `<rect x="${r(lx + i * 18 * s)}" y="${r(ly - 6 * s)}" width="${r(18 * s)}" height="${r(10 * s)}" fill="${ramp(i)}" stroke="${t.mapNote}" stroke-width="0.4"/>`;
    body += text(c, lx + classes * 18 * s + 6 * s, ly + 3 * s, max.toLocaleString("en-US"), { size: 9 * s, fill: t.mapNote });
  } else {
    const present = [...new Set(labelled.map((p) => p.worst))];
    body += text(c, lx, ly + 3 * s, `${mapPoints.length} ${mapPoints.length === 1 ? c.l.siteOne : c.l.siteMany}`, { size: 9.5 * s, fill: t.mapNote });
    lx += (String(mapPoints.length).length + 8) * 6 * s + 16 * s;
    for (const signal of present) {
      body += `<circle cx="${r(lx + 4 * s)}" cy="${r(ly)}" r="${r(4 * s)}" fill="${t.signals[signal as keyof typeof t.signals] ?? t.accent}"/>`;
      const label = SIGNAL_LABEL(c, signal);
      body += text(c, lx + 12 * s, ly + 3 * s, label, { size: 9 * s, fill: t.mapNote });
      lx += 12 * s + label.length * 5.2 * s + 14 * s;
    }
  }

  const slot = framed(c, title, width, bodyH, body, "none");
  if (c.config.mapDisclaimer === false) return slot;
  const language = resolveLanguage(c.lang);
  const countries = c.portfolio ? c.portfolio.countries.map((x) => x.country) : [c.data.project.country];
  const lines = [...new Set(countries.flatMap((country) => mapDisclaimerLines(country, language)))];
  const note = lines.map((line) => paragraph(c, 0, 0, line, width, { size: 8 * s, maxLines: 3, fill: t.mapNote, lineHeight: 10.5 * s }));
  let y = headingHeight(c, title) + bodyH + 4 * s;
  let extra = "";
  for (const n of note) {
    extra += `<g transform="translate(0 ${r(y)})">${n.svg}</g>`;
    y += n.height + 3 * s;
  }
  return { svg: slot.svg + extra, width, height: y + 12 * s };
}
