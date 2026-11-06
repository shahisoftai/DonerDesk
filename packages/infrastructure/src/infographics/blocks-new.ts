/**
 * The Phase 32 blocks: headline, headline numbers, funnel, progress rings, who we reached, sector
 * cards, timeline, key messages, quote, image, notes, banner, funding, trends, table and results
 * chain. A block draws only what the records or the author supplied: a figure with no value says
 * "Not yet reported"; an authored block with nothing in it is left out of an export (the Studio
 * preview shows a hint). Percent of target is drawn only where the domain allows one.
 */
import { buildDataChart, type InfographicSectionConfig, type BigNumberItem } from "@donordesk/domain";
import { arcPath, flipBack, fmt, icon, framed, headingHeight, heading, notReported, panelRect, paragraph, parseFigure, previewHint, r, text, textWidth, wrapText, mixHex, esc, type RenderCtx, type Slot } from "./kit.js";
import { chartSvg, titleFor } from "./blocks-core.js";
import { ageLabel, chosenIndicators, latestById, latestFinance, periodsInRange, sexLabel, sortedAgeGroups, type LatestValue } from "./facts.js";

/** Text colour that reads on a given fill: white on dark, ink on light. */
function onColor(c: RenderCtx, fill: string): string {
  const n = parseInt(fill.slice(1), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.6 ? c.t.ink : "#ffffff";
}

// ---------- HERO ----------
export function heroBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const { t, s, config } = c;
  const title = section.title ?? config.title ?? c.data.project.title;
  const subtitle = section.text ?? config.subtitle;
  const asset = section.assetId ? c.assets.get(section.assetId) : undefined;
  const compact = c.format.height < 1300 || width < 700;
  const pad = 28 * s;
  const fill = t.accent;
  const ink = asset ? "#ffffff" : onColor(c, fill);
  const titleSize = (compact ? 28 : 36) * s;
  const titleLines = wrapText(title, width - pad * 2, titleSize, 3, true);
  const subLines = subtitle ? wrapText(subtitle, width - pad * 2, 14 * s, 2) : [];
  const minH = asset ? (compact ? 200 : 260) * s : 0;
  const h = Math.max(minH, pad + 24 * s + titleLines.length * titleSize * 1.15 + (subLines.length ? 12 * s + subLines.length * 14 * s * 1.4 : 0) + pad);
  let svg = "";
  if (asset) {
    svg += `<clipPath id="hero-clip"><rect x="0" y="0" width="${r(width)}" height="${r(h)}" rx="${t.radius}"/></clipPath><g clip-path="url(#hero-clip)">${flipBack(c, width / 2, `<image x="0" y="0" width="${r(width)}" height="${r(h)}" href="${asset.dataUri}" preserveAspectRatio="xMidYMid slice"/>`)}<rect x="0" y="0" width="${r(width)}" height="${r(h)}" fill="#000000" opacity="0.5"/></g>`;
  } else svg += `<rect x="0" y="0" width="${r(width)}" height="${r(h)}" rx="${t.radius}" fill="${fill}"/>`;
  const kicker = `${c.data.project.donorName ? `${c.data.project.donorName} · ` : ""}${c.data.project.country}`.trim();
  svg += text(c, pad, pad + 6 * s, kicker.toUpperCase(), { size: 11 * s, fill: ink, spacing: 1, opacity: 0.9 });
  const tp = paragraph(c, pad, pad + 14 * s, title, width - pad * 2, { size: titleSize, bold: true, fill: ink, maxLines: 3, lineHeight: titleSize * 1.15 });
  svg += tp.svg;
  if (subtitle) svg += paragraph(c, pad, pad + 20 * s + tp.height, subtitle, width - pad * 2, { size: 14 * s, fill: ink, maxLines: 2, opacity: 0.95 }).svg;
  return { svg, width, height: h + 18 * s };
}

// ---------- BIG NUMBERS ----------
interface ResolvedNumber {
  value: string;
  detail?: string;
  muted: boolean;
}

function resolveNumber(c: RenderCtx, item: BigNumberItem, rounding: InfographicSectionConfig["rounding"]): ResolvedNumber {
  const none: ResolvedNumber = { value: c.l.notYetReported, muted: true };
  const reach = c.data.reach;
  const activitiesDone = c.data.activities.rows.reduce((n, x) => n + x.done, 0);
  const activitiesPlanned = c.data.activities.rows.reduce((n, x) => n + x.planned, 0) + c.data.activities.unlocated;
  const finance = latestFinance(c);
  switch (item.source) {
    case "MANUAL":
      return item.value ? { value: item.value, muted: false } : none;
    case "INDICATOR": {
      const found = item.indicatorId ? latestById(c, item.indicatorId) : undefined;
      if (!found) return none;
      const n = found.number;
      const shown = n !== null ? fmt(c, n, rounding) : found.value;
      return { value: `${shown}${found.unit === "%" ? "%" : found.unit ? ` ${found.unit}` : ""}`, ...(found.verified ? {} : { detail: c.l.notVerifiedYet }), muted: false };
    }
    case "PORTFOLIO_PROJECTS":
    case "PORTFOLIO_COUNTRIES":
    case "PORTFOLIO_OFF_TRACK":
    case "PORTFOLIO_AT_RISK":
    case "PORTFOLIO_OPEN_RISKS":
    case "PORTFOLIO_REPORTS_OVERDUE": {
      const p = c.portfolio;
      if (!p || p.rows.length === 0) return none;
      const n = item.source === "PORTFOLIO_PROJECTS" ? p.totals.projects : item.source === "PORTFOLIO_COUNTRIES" ? p.totals.countries : item.source === "PORTFOLIO_OFF_TRACK" ? p.totals.behind : item.source === "PORTFOLIO_AT_RISK" ? p.totals.needAttention : item.source === "PORTFOLIO_OPEN_RISKS" ? p.totals.openRisks : p.totals.reportsOverdue;
      return { value: fmt(c, n, rounding), muted: false };
    }
    case "REACH_UNIQUE":
      return reach.overallUnique > 0 ? { value: fmt(c, reach.overallUnique, rounding), muted: false } : none;
    case "REACH_REGISTERED":
      return reach.registeredTotal > 0 ? { value: fmt(c, reach.registeredTotal, rounding), muted: false } : none;
    case "ACTIVITIES_DONE":
      return activitiesPlanned > 0 ? { value: fmt(c, activitiesDone, rounding), muted: false } : none;
    case "ACTIVITIES_PLANNED":
      return activitiesPlanned > 0 ? { value: fmt(c, activitiesPlanned, rounding), muted: false } : none;
    case "FINANCE_BUDGET":
    case "FINANCE_EXPENDITURE":
    case "FINANCE_BALANCE": {
      if (!finance) return none;
      const raw = item.source === "FINANCE_BUDGET" ? finance.budget : item.source === "FINANCE_EXPENDITURE" ? finance.expenditure : finance.balance;
      const n = parseFigure(raw);
      return { value: `${finance.currency} ${n !== null ? fmt(c, n, rounding) : raw}`, ...(finance.verified ? {} : { detail: c.l.notVerifiedYet }), muted: false };
    }
  }
}

export function bigNumbersBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot | undefined {
  const title = titleFor(c, section);
  const items = section.numbers ?? [];
  if (items.length === 0) return previewHint(c, title, width, "Add the figures to show");
  const { t, s } = c;
  const gap = c.grid.gap;
  const n = items.length;
  const perRow = width < 560 * s ? Math.min(n, 2) : Math.min(n, 6);
  const rows = Math.ceil(n / perRow);
  const cardW = (width - 24 * s - gap * (perRow - 1)) / perRow;
  const cardH = 112 * s;
  const bodyH = rows * cardH + (rows - 1) * gap + 24 * s;
  let body = "";
  items.forEach((item, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const x = 12 * s + col * (cardW + gap);
    const y = 12 * s + row * (cardH + gap);
    const resolved = resolveNumber(c, item, section.rounding);
    body += `<rect x="${r(x)}" y="${r(y)}" width="${r(cardW)}" height="${r(cardH)}" rx="${r(Math.min(8, t.radius))}" fill="${t.surface}"/>`;
    let tx = x + 14 * s;
    if (item.iconId) {
      body += icon(c, item.iconId, x + 14 * s, y + 14 * s, 26 * s, t.accent);
      tx = x + 14 * s;
    }
    const valueSize = resolved.muted ? 13 * s : Math.min(34 * s, Math.max(16 * s, ((cardW - 28 * s) / Math.max(resolved.value.length, 3)) * 1.55));
    const vy = item.iconId ? y + 66 * s : y + 46 * s;
    body += text(c, tx, vy, resolved.value, { size: valueSize, bold: !resolved.muted, fill: resolved.muted ? t.subtle : t.ink, italic: resolved.muted });
    wrapText(item.label, cardW - 28 * s, 10.5 * s, 2).forEach((line, li) => (body += text(c, tx, vy + 16 * s + li * 13 * s, line, { size: 10.5 * s, fill: t.muted })));
    const foot = item.caption ?? resolved.detail ?? "";
    if (foot) body += text(c, tx, y + cardH - 8 * s, wrapText(foot, cardW - 28 * s, 8.5 * s, 1)[0] ?? foot, { size: 8.5 * s, fill: resolved.detail ? t.warn : t.muted });
  });
  const sources = items.filter((x) => x.source === "MANUAL" && x.sourceNote).map((x) => x.sourceNote as string);
  const slot = framed(c, title, width, bodyH, body);
  if (sources.length === 0) return slot;
  const src = `${c.l.source}: ${[...new Set(sources)].join("; ")}`;
  const p = paragraph(c, 0, 0, src, width, { size: 8.5 * s, maxLines: 2, fill: t.muted });
  const y = headingHeight(c, title) + bodyH + 4 * s;
  return { svg: `${slot.svg}<g transform="translate(0 ${r(y)})">${p.svg}</g>`, width, height: y + p.height + 12 * s };
}

// ---------- FUNNEL ----------
export function funnelBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot | undefined {
  const title = titleFor(c, section);
  const stages = section.stages ?? [];
  if (stages.length === 0) return previewHint(c, title, width, "Add people in need, targeted and reached");
  const { t, s } = c;
  const resolved = stages.map((stage) => ({ ...stage, n: stage.bind === "REACH_UNIQUE" ? c.data.reach.overallUnique || null : stage.bind === "REACH_REGISTERED" ? c.data.reach.registeredTotal || null : stage.value ?? null }));
  if (resolved.every((x) => x.n === null) && !c.preview) return undefined;
  const max = Math.max(1, ...resolved.map((x) => x.n ?? 0));
  const rowH = 54 * s;
  const bodyH = resolved.length * rowH + 20 * s;
  const maxBar = width - 48 * s;
  let body = "";
  let prev: number | null = null;
  resolved.forEach((stage, i) => {
    const y = 14 * s + i * rowH;
    const w = stage.n === null ? 0 : Math.max(maxBar * 0.12, (stage.n / max) * maxBar);
    const x = 24 * s + (maxBar - w) / 2;
    const shade = mixHex(t.accent, "#ffffff", Math.min(0.62, i * 0.2));
    if (stage.n !== null) {
      body += `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(rowH - 14 * s)}" rx="${r(Math.min(6, t.radius))}" fill="${shade}"/>`;
      body += text(c, 24 * s + maxBar / 2, y + (rowH - 14 * s) / 2 + 6 * s, fmt(c, stage.n), { size: 20 * s, bold: true, fill: onColor(c, shade), anchor: "middle" });
    } else body += text(c, 24 * s + maxBar / 2, y + (rowH - 14 * s) / 2 + 5 * s, c.l.notYetReported, { size: 12 * s, italic: true, fill: t.subtle, anchor: "middle" });
    body += text(c, 24 * s, y + rowH - 14 * s + 11 * s, stage.label, { size: 10.5 * s, fill: t.muted, bold: true });
    if (stage.n !== null && prev !== null && prev > 0) body += text(c, width - 24 * s, y + rowH - 14 * s + 11 * s, `${Math.round((stage.n / prev) * 100)}%`, { size: 10.5 * s, fill: t.muted, anchor: "end" });
    if (stage.n !== null) prev = stage.n;
  });
  const slot = framed(c, title, width, bodyH, body);
  const notes = [...new Set(stages.map((x) => x.sourceNote).filter((x): x is string => Boolean(x)))];
  if (notes.length === 0) return slot;
  const p = paragraph(c, 0, 0, `${c.l.source}: ${notes.join("; ")}`, width, { size: 8.5 * s, maxLines: 2, fill: t.muted });
  const y = headingHeight(c, title) + bodyH + 4 * s;
  return { svg: `${slot.svg}<g transform="translate(0 ${r(y)})">${p.svg}</g>`, width, height: y + p.height + 12 * s };
}

// ---------- PROGRESS RINGS ----------
export function progressRingsBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const title = titleFor(c, section);
  const picked = chosenIndicators(c, section.indicatorIds, 6, !section.indicatorIds?.length);
  if (picked.length === 0) return notReported(c, title, width, 110);
  const { t, s } = c;
  const perRow = Math.max(1, Math.min(picked.length, Math.floor(width / (170 * s))));
  const cellW = width / perRow;
  const rows = Math.ceil(picked.length / perRow);
  const cellH = 168 * s;
  let body = "";
  picked.forEach((ind, i) => {
    const cx = (i % perRow) * cellW + cellW / 2;
    const top = Math.floor(i / perRow) * cellH + 14 * s;
    const R = 44 * s;
    const cy = top + R + 4 * s;
    body += `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(R)}" fill="none" stroke="${t.accentSoft}" stroke-width="${r(12 * s)}"/>`;
    if (ind.percent !== null) {
      const frac = Math.min(ind.percent / 100, 1);
      if (frac > 0) body += `<path d="${arcPath(cx, cy, R, frac)}" fill="none" stroke="${ind.percent >= 100 ? t.signals.ON_TIME : t.accent}" stroke-width="${r(12 * s)}" stroke-linecap="round"/>`;
      body += text(c, cx, cy + 7 * s, `${Math.round(ind.percent)}%`, { size: 20 * s, bold: true, anchor: "middle" });
    } else {
      body += text(c, cx, cy + 6 * s, `${ind.number !== null ? fmt(c, ind.number) : ind.value}${ind.unit === "%" ? "%" : ""}`, { size: 17 * s, bold: true, anchor: "middle" });
    }
    const name = wrapText(`${ind.code} ${ind.name}`, cellW - 20 * s, 10.5 * s, 2, true);
    name.forEach((line, li) => (body += text(c, cx, cy + R + 22 * s + li * 13 * s, line, { size: 10.5 * s, bold: true, anchor: "middle" })));
    const sub = ind.percent !== null && ind.targetNumber !== null ? `${ind.number !== null ? fmt(c, ind.number) : ind.value} / ${fmt(c, ind.targetNumber)}` : ind.isRate ? c.l.latest : "";
    if (sub) body += text(c, cx, cy + R + 22 * s + name.length * 13 * s + 2 * s, sub, { size: 9.5 * s, fill: ind.verified ? t.muted : t.warn, anchor: "middle" });
  });
  return framed(c, title, width, rows * cellH + 10 * s, body);
}

// ---------- DEMOGRAPHICS ----------
export function demographicsBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const title = titleFor(c, section);
  const { t, s } = c;
  const sex = Object.entries(c.data.reach.bySex).filter(([, n]) => n > 0);
  const ages = sortedAgeGroups(Object.entries(c.data.reach.byAgeGroup).filter(([, n]) => n > 0));
  if (sex.length === 0 && ages.length === 0) return notReported(c, title, width, 100);
  const total = sex.reduce((n, [, v]) => n + v, 0);
  let body = "";
  let y = 24 * s;
  if (sex.length > 0) {
    body += text(c, 16 * s, y, c.l.sex, { size: 10 * s, bold: true, fill: t.muted });
    y += 12 * s;
    const barW = width - 32 * s;
    let x = 16 * s;
    const colors = [t.accent, t.accent2, t.palette[2] ?? t.accent, t.palette[3] ?? t.muted];
    sex.forEach(([key, n], i) => {
      const w = (n / total) * barW;
      body += `<rect x="${r(x)}" y="${r(y)}" width="${r(Math.max(w, 2))}" height="${r(22 * s)}" fill="${colors[i % colors.length]}"/>`;
      x += w;
    });
    y += 22 * s + 16 * s;
    let lx = 16 * s;
    sex.forEach(([key, n], i) => {
      const label = `${sexLabel(c, key)} ${fmt(c, n)} (${Math.round((n / total) * 100)}%)`;
      body += `<rect x="${r(lx)}" y="${r(y - 9 * s)}" width="${r(10 * s)}" height="${r(10 * s)}" fill="${colors[i % colors.length]}"/>`;
      body += text(c, lx + 15 * s, y, label, { size: 10.5 * s });
      lx += textWidth(label, 10.5 * s) + 38 * s;
      if (lx > width - 120 * s && i < sex.length - 1) {
        lx = 16 * s;
        y += 16 * s;
      }
    });
    y += 26 * s;
  }
  if (ages.length > 0) {
    body += text(c, 16 * s, y, c.l.ageGroup, { size: 10 * s, bold: true, fill: t.muted });
    y += 8 * s;
    const max = Math.max(...ages.map(([, n]) => n));
    const labelW = 74 * s;
    const barMax = Math.max(40, width - labelW - 90 * s);
    ages.slice(0, 8).forEach(([key, n]) => {
      y += 20 * s;
      body += text(c, 16 * s, y + 10 * s, ageLabel(c, key), { size: 10.5 * s });
      body += `<rect x="${r(16 * s + labelW)}" y="${r(y)}" width="${r(Math.max(2, (n / max) * barMax))}" height="${r(13 * s)}" rx="${r(3 * s)}" fill="${t.accent}"/>`;
      body += text(c, 16 * s + labelW + (n / max) * barMax + 8 * s, y + 10.5 * s, fmt(c, n), { size: 10.5 * s });
    });
    y += 24 * s;
  }
  return framed(c, title, width, y, body);
}

// ---------- SECTOR GRID ----------
export function sectorGridBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot | undefined {
  const title = titleFor(c, section);
  const sectors = section.sectors ?? [];
  if (sectors.length === 0) return previewHint(c, title, width, "Add sectors and choose their indicators");
  const { t, s } = c;
  const gap = c.grid.gap;
  const perRow = Math.max(1, Math.min(sectors.length, Math.floor((width + gap) / (230 * s + gap))));
  const cardW = (width - gap * (perRow - 1)) / perRow;
  const rowsOf = (list: typeof sectors): number => list.length;
  void rowsOf;
  const cardHs = sectors.map((sector) => (60 + Math.max(1, sector.indicatorIds.length) * 44 + 12) * s);
  const rows: number[] = [];
  for (let i = 0; i < sectors.length; i += perRow) rows.push(Math.max(...cardHs.slice(i, i + perRow)));
  let body = "";
  let top = 0;
  sectors.forEach((sector, i) => {
    const col = i % perRow;
    const rowIndex = Math.floor(i / perRow);
    if (col === 0 && i > 0) top += (rows[rowIndex - 1] ?? 0) + gap;
    const x = col * (cardW + gap);
    const h = rows[rowIndex] ?? 0;
    body += `<g transform="translate(${r(x)} ${r(top)})"><rect x="0" y="0" width="${r(cardW)}" height="${r(h)}" rx="${t.radius}" fill="${t.card}" stroke="${t.cardStroke}"/>`;
    body += `<circle cx="${r(30 * s)}" cy="${r(30 * s)}" r="${r(18 * s)}" fill="${t.accentSoft}"/>${sector.iconId ? icon(c, sector.iconId, 18 * s, 18 * s, 24 * s, t.accent) : ""}`;
    body += text(c, 56 * s, 36 * s, wrapText(sector.label, cardW - 70 * s, 14 * s, 1, true)[0] ?? sector.label, { size: 14 * s, bold: true });
    const inds = sector.indicatorIds.map((id) => latestById(c, id));
    if (inds.length === 0) body += text(c, 16 * s, 76 * s, c.l.notYetReported, { size: 11 * s, italic: true, fill: t.subtle });
    inds.forEach((ind, k) => {
      const y = 64 * s + k * 44 * s;
      if (!ind) {
        body += text(c, 16 * s, y + 14 * s, c.l.notYetReported, { size: 11 * s, italic: true, fill: t.subtle });
        return;
      }
      body += text(c, 16 * s, y + 10 * s, wrapText(ind.name, cardW - 32 * s, 10 * s, 1)[0] ?? ind.name, { size: 10 * s, fill: t.muted });
      const val = ind.number !== null ? fmt(c, ind.number) : ind.value;
      body += text(c, 16 * s, y + 30 * s, `${val}${ind.unit === "%" ? "%" : ""}`, { size: 16 * s, bold: true, fill: ind.verified ? t.ink : t.warn });
      if (ind.percent !== null && ind.targetNumber !== null) {
        const bx = cardW * 0.46;
        const bw = cardW - bx - 16 * s;
        body += `<rect x="${r(bx)}" y="${r(y + 20 * s)}" width="${r(bw)}" height="${r(8 * s)}" rx="${r(4 * s)}" fill="${t.accentSoft}"/><rect x="${r(bx)}" y="${r(y + 20 * s)}" width="${r(Math.max(4 * s, Math.min(1, ind.percent / 100) * bw))}" height="${r(8 * s)}" rx="${r(4 * s)}" fill="${t.accent}"/>`;
        body += text(c, cardW - 16 * s, y + 14 * s, `${Math.round(ind.percent)}% · ${fmt(c, ind.targetNumber)}`, { size: 9.5 * s, fill: t.muted, anchor: "end" });
      }
    });
    body += "</g>";
  });
  const total = rows.reduce((n, h) => n + h, 0) + gap * (rows.length - 1);
  return { svg: `${heading(c, title)}<g transform="translate(0 ${r(headingHeight(c, title))})">${body}</g>`, width, height: headingHeight(c, title) + total + 18 * s };
}

// ---------- TIMELINE ----------
export function timelineBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot | undefined {
  const title = titleFor(c, section);
  const events = section.events ?? [];
  if (events.length === 0) return previewHint(c, title, width, "Add dated events");
  const { t, s } = c;
  const twoCols = width >= 820 * s && events.length > 3;
  const colW = twoCols ? (width - 48 * s) / 2 : width - 32 * s;
  const perCol = twoCols ? Math.ceil(events.length / 2) : events.length;
  const hs = events.map((e) => (e.detail ? 62 : 44) * s);
  const colHeight = (col: number): number => hs.slice(col * perCol, col * perCol + perCol).reduce((n, h) => n + h, 0);
  const bodyH = Math.max(colHeight(0), twoCols ? colHeight(1) : 0) + 24 * s;
  let body = "";
  for (let col = 0; col < (twoCols ? 2 : 1); col += 1) {
    const x0 = 16 * s + col * (colW + 16 * s);
    let y = 18 * s;
    const slice = events.slice(col * perCol, col * perCol + perCol);
    body += `<line x1="${r(x0 + 6 * s)}" y1="${r(y + 4 * s)}" x2="${r(x0 + 6 * s)}" y2="${r(y + slice.reduce((n, _e, k) => n + (hs[col * perCol + k] ?? 0), 0) - 20 * s)}" stroke="${t.line}" stroke-width="${r(2 * s)}"/>`;
    slice.forEach((event, k) => {
      body += `<circle cx="${r(x0 + 6 * s)}" cy="${r(y + 6 * s)}" r="${r(6 * s)}" fill="${t.accent}"/>`;
      body += text(c, x0 + 24 * s, y + 10 * s, event.date, { size: 10 * s, fill: t.muted, bold: true });
      body += text(c, x0 + 24 * s, y + 26 * s, wrapText(event.label, colW - 30 * s, 12.5 * s, 1, true)[0] ?? event.label, { size: 12.5 * s, bold: true });
      if (event.detail) body += text(c, x0 + 24 * s, y + 42 * s, wrapText(event.detail, colW - 30 * s, 10.5 * s, 1)[0] ?? event.detail, { size: 10.5 * s, fill: t.muted });
      y += hs[col * perCol + k] ?? 0;
    });
  }
  return framed(c, title, width, bodyH, body);
}

// ---------- KEY MESSAGES ----------
export function keyMessagesBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot | undefined {
  const title = titleFor(c, section);
  const messages = section.messages ?? [];
  if (messages.length === 0) return previewHint(c, title, width, "Add three to five key messages");
  const { t, s } = c;
  const size = 13 * s;
  const textW = width - 32 * s - 40 * s;
  let y = 14 * s;
  let body = "";
  messages.forEach((m, i) => {
    const lines = wrapText(m.text, textW, size, 3);
    const h = Math.max(34 * s, lines.length * size * 1.4 + 12 * s);
    body += `<circle cx="${r(32 * s)}" cy="${r(y + 17 * s)}" r="${r(15 * s)}" fill="${t.accentSoft}"/>`;
    body += m.iconId ? icon(c, m.iconId, 20 * s, y + 5 * s, 24 * s, t.accent) : text(c, 32 * s, y + 22 * s, String(i + 1), { size: 14 * s, bold: true, fill: t.accent, anchor: "middle" });
    lines.forEach((line, li) => (body += text(c, 60 * s, y + 13 * s + size * 0.4 + li * size * 1.4, line, { size, fill: t.body })));
    y += h + 4 * s;
  });
  return framed(c, title, width, y + 10 * s, body);
}

// ---------- QUOTE ----------
export function quoteBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot | undefined {
  const title = titleFor(c, section);
  if (!section.text?.trim()) return previewHint(c, title, width, "Add a quotation and who said it");
  const { t, s } = c;
  const asset = section.assetId ? c.assets.get(section.assetId) : undefined;
  const pad = 24 * s;
  const left = asset ? 96 * s : pad;
  const size = 19 * s;
  const para = paragraph(c, left + 20 * s, 16 * s, section.text, width - left - pad - 20 * s, { size, maxLines: 7, fill: t.ink, italic: true, lineHeight: size * 1.4 });
  const attr = section.attribution ? 22 * s : 0;
  const h = Math.max(para.height + 40 * s + attr, asset ? 100 * s : 0);
  let body = `<rect x="0" y="0" width="${r(5 * s)}" height="${r(h)}" fill="${t.accent}"/>`;
  body += text(c, left - 4 * s, 44 * s, "“", { size: 54 * s, bold: true, fill: t.accentSoft });
  body += para.svg;
  if (section.attribution) body += text(c, left + 20 * s, h - 14 * s, `— ${section.attribution}`, { size: 11.5 * s, bold: true, fill: t.muted });
  if (asset) {
    body += `<clipPath id="q-clip"><circle cx="${r(52 * s)}" cy="${r(h / 2)}" r="${r(34 * s)}"/></clipPath>${flipBack(c, 52 * s, `<image x="${r(18 * s)}" y="${r(h / 2 - 34 * s)}" width="${r(68 * s)}" height="${r(68 * s)}" href="${asset.dataUri}" preserveAspectRatio="xMidYMid slice" clip-path="url(#q-clip)"/>`)}`;
  }
  return framed(c, title, width, h, body, t.surface);
}

// ---------- IMAGE ----------
export function imageBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot | undefined {
  const asset = section.assetId ? c.assets.get(section.assetId) : undefined;
  if (!asset) return previewHint(c, titleFor(c, section), width, "Choose an image");
  const { t, s } = c;
  const maxH = Math.min(c.format.height * 0.42, 560 * s);
  const natural = (asset.height / asset.width) * width;
  const h = section.fit === "CONTAIN" ? Math.min(natural, maxH) : Math.min(Math.max(width * 0.5, 160 * s), maxH);
  const par = section.fit === "CONTAIN" ? "xMidYMid meet" : "xMidYMid slice";
  let svg = `<clipPath id="img-clip"><rect x="0" y="0" width="${r(width)}" height="${r(h)}" rx="${t.radius}"/></clipPath><g clip-path="url(#img-clip)"><rect x="0" y="0" width="${r(width)}" height="${r(h)}" fill="${t.surface}"/>${flipBack(c, width / 2, `<image x="0" y="0" width="${r(width)}" height="${r(h)}" href="${asset.dataUri}" preserveAspectRatio="${par}"/>`)}</g>`;
  let height = h;
  const caption = [section.caption, section.credit ? `${c.l.photoCredit}: ${section.credit}` : ""].filter(Boolean).join(" · ");
  if (caption) {
    const p = paragraph(c, 0, h + 6 * s, caption, width, { size: 10 * s, maxLines: 2, fill: t.muted });
    svg += p.svg;
    height += 6 * s + p.height;
  }
  const alt = section.altText ? `<title>${esc(section.altText)}</title>` : "";
  return { svg: `<g>${alt}${svg}</g>`, width, height: height + 18 * s };
}

// ---------- LEGEND / NOTES ----------
export function legendNotesBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const title = titleFor(c, section);
  const { t, s } = c;
  const lines: string[] = [...(section.notes ?? [])];
  const indicators = c.sheet.indicators.map((i) => i.code);
  const periods = periodsInRange(c).map((id) => c.sheet.periods.find((p) => p.id === id)?.label).filter((x): x is string => Boolean(x));
  const src = [c.l.source + ": " + (c.lang === "fr" ? "dossiers du projet" : c.lang === "es" ? "registros del proyecto" : "project records"), periods.length ? `${periods[0]}${periods.length > 1 ? ` – ${periods[periods.length - 1]}` : ""}` : "", indicators.length ? `${c.l.indicators} ${indicators.slice(0, 1)}${indicators.length > 1 ? ` – ${indicators[indicators.length - 1]}` : ""}` : ""].filter(Boolean).join(" · ");
  lines.push(src);
  const size = 10.5 * s;
  let y = 12 * s;
  let body = "";
  for (const line of lines) {
    const p = paragraph(c, 16 * s, y, line, width - 32 * s, { size, maxLines: 3, fill: t.muted });
    body += p.svg;
    y += p.height + 4 * s;
  }
  return framed(c, title, width, y + 10 * s, body, t.surface);
}

// ---------- BANNER / DIVIDER ----------
export function bannerBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot | undefined {
  const msg = section.text ?? section.title ?? c.config.acknowledgement;
  if (!msg) return previewHint(c, undefined, width, "Add a line of text");
  const { t, s } = c;
  const h = 56 * s;
  const fill = t.accent;
  return { svg: `<rect x="0" y="0" width="${r(width)}" height="${r(h)}" rx="${t.radius}" fill="${fill}"/>${text(c, width / 2, h / 2 + 6 * s, wrapText(msg, width - 40 * s, 16 * s, 1, true)[0] ?? msg, { size: 16 * s, bold: true, fill: onColor(c, fill), anchor: "middle" })}`, width, height: h + 18 * s };
}

export function dividerBlock(c: RenderCtx, width: number): Slot {
  return { svg: `<line x1="0" y1="${r(10 * c.s)}" x2="${r(width)}" y2="${r(10 * c.s)}" stroke="${c.t.line}" stroke-width="${r(1.5 * c.s)}"/>`, width, height: 22 * c.s };
}

// ---------- FUNDING ----------
export function fundingBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const title = titleFor(c, section);
  const { t, s } = c;
  if (!c.data.finance.enabled || c.data.finance.rows.length === 0) return notReported(c, title, width, 84);
  const periods = new Set(periodsInRange(c));
  const rows = c.data.finance.rows.filter((row) => periods.has(row.periodId)).slice(-6);
  const shown = rows.length > 0 ? rows : c.data.finance.rows.slice(-6);
  const labelOf = (id: string): string => c.sheet.periods.find((p) => p.id === id)?.label ?? id;
  const max = Math.max(1, ...shown.map((x) => parseFigure(x.budget) ?? 0));
  const barX = 150 * s;
  const barMax = Math.max(60, width - barX - 150 * s);
  let body = "";
  let y = 18 * s;
  shown.forEach((row) => {
    const budget = parseFigure(row.budget);
    const spent = parseFigure(row.expenditure);
    body += text(c, 16 * s, y + 14 * s, wrapText(labelOf(row.periodId), barX - 24 * s, 11 * s, 1, true)[0] ?? "", { size: 11 * s, bold: true });
    if (budget !== null) body += `<rect x="${r(barX)}" y="${r(y)}" width="${r(Math.max(2, (budget / max) * barMax))}" height="${r(10 * s)}" rx="${r(5 * s)}" fill="${t.accentSoft}" stroke="${t.cardStroke}"/>`;
    if (spent !== null) body += `<rect x="${r(barX)}" y="${r(y + 14 * s)}" width="${r(Math.max(2, (spent / max) * barMax))}" height="${r(10 * s)}" rx="${r(5 * s)}" fill="${row.verified ? t.accent : t.subtle}"/>`;
    body += text(c, width - 16 * s, y + 10 * s, `${c.l.budget} ${row.currency} ${budget !== null ? fmt(c, budget) : row.budget}`, { size: 10 * s, fill: t.muted, anchor: "end" });
    body += text(c, width - 16 * s, y + 24 * s, `${c.l.expenditure} ${spent !== null ? fmt(c, spent) : row.expenditure}${row.burnRatePercent ? ` · ${row.burnRatePercent}%` : ""}${row.verified ? "" : ` · ${c.l.notVerifiedYet}`}`, { size: 10 * s, fill: row.verified ? t.ink : t.warn, anchor: "end" });
    y += 40 * s;
  });
  return framed(c, title, width, y + 6 * s, body);
}

// ---------- SMALL MULTIPLES ----------
export function smallMultiplesBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const title = titleFor(c, section);
  const { t, s } = c;
  const ids = section.indicatorIds?.length
    ? section.indicatorIds.slice(0, 6)
    : c.sheet.indicators.filter((i) => c.sheet.cells.filter((x) => x.indicatorId === i.id && (x.periodValue.trim() !== "" || x.cumulativeValue.trim() !== "")).length >= 2).slice(0, 4).map((i) => i.id);
  if (ids.length === 0) return notReported(c, title, width, 110);
  const gap = c.grid.gap;
  const perRow = Math.max(1, Math.min(ids.length, Math.floor((width + gap) / (260 * s + gap))));
  const tileW = (width - gap * (perRow - 1) - 24 * s) / perRow;
  const tileH = 170 * s;
  const rows = Math.ceil(ids.length / perRow);
  let body = "";
  ids.forEach((id, i) => {
    const ind = c.sheet.indicators.find((x) => x.id === id);
    const x = 12 * s + (i % perRow) * (tileW + gap);
    const y = 12 * s + Math.floor(i / perRow) * (tileH + gap);
    if (!ind) return;
    body += text(c, x + 4 * s, y + 12 * s, wrapText(`${ind.code} ${ind.name}`, tileW - 8 * s, 10.5 * s, 1, true)[0] ?? ind.code, { size: 10.5 * s, bold: true });
    const built = buildDataChart(c.sheet, { template: "INDICATOR_OVER_TIME", indicatorIds: [id], measure: ind.isRate ? "PERIOD" : "CUMULATIVE", type: "LINE", fromPeriodId: c.config.periodFromId, toPeriodId: c.config.periodToId, showTarget: false });
    if (!built.ok) {
      body += text(c, x + 4 * s, y + 70 * s, c.l.notYetReported, { size: 11 * s, italic: true, fill: t.subtle });
      return;
    }
    body += chartSvg(c, { ...built.option, title: undefined, legend: { show: false }, grid: { left: 40, right: 12, top: 14, bottom: 26 } }, x, y + 18 * s, Math.round(tileW), Math.round(tileH - 22 * s));
  });
  return framed(c, title, width, rows * (tileH + gap) + 8 * s, body);
}

// ---------- TABLE ----------
export function tableBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const title = titleFor(c, section);
  const { t, s, l } = c;
  const all = section.indicatorIds?.length ? section.indicatorIds.map((id) => c.sheet.indicators.find((i) => i.id === id)).filter((x): x is NonNullable<typeof x> => Boolean(x)) : c.sheet.indicators;
  if (all.length === 0) return notReported(c, title, width, 84);
  const limit = 14;
  const list = all.slice(0, limit);
  const cols = { code: 16 * s, name: 70 * s, baseline: width - 330 * s, target: width - 250 * s, latest: width - 150 * s, pct: width - 16 * s };
  let body = "";
  let y = 26 * s;
  body += text(c, cols.code, y, "#", { size: 10 * s, bold: true, fill: t.muted });
  body += text(c, cols.name, y, l.indicators, { size: 10 * s, bold: true, fill: t.muted });
  body += text(c, cols.baseline, y, l.baseline, { size: 10 * s, bold: true, fill: t.muted, anchor: "end" });
  body += text(c, cols.target, y, l.target, { size: 10 * s, bold: true, fill: t.muted, anchor: "end" });
  body += text(c, cols.latest, y, l.latest, { size: 10 * s, bold: true, fill: t.muted, anchor: "end" });
  body += text(c, cols.pct, y, l.percentOfTarget, { size: 10 * s, bold: true, fill: t.muted, anchor: "end" });
  for (const ind of list) {
    y += 26 * s;
    const latest = c.sheet.indicators.find((x) => x.id === ind.id);
    const lv: LatestValue | undefined = latest ? chosenIndicators(c, [ind.id], 1)[0] : undefined;
    body += text(c, cols.code, y, wrapText(ind.code, 50 * s, 10.5 * s, 1, true)[0] ?? ind.code, { size: 10.5 * s, bold: true });
    body += text(c, cols.name, y, wrapText(ind.name, cols.baseline - cols.name - 90 * s, 10.5 * s, 1)[0] ?? ind.name, { size: 10.5 * s });
    const num = (v: string): string => {
      const n = parseFigure(v);
      return n === null ? v : fmt(c, n);
    };
    body += text(c, cols.baseline, y, ind.baseline ? num(ind.baseline) : "—", { size: 10.5 * s, anchor: "end", fill: ind.baseline ? t.ink : t.subtle });
    body += text(c, cols.target, y, ind.target ? num(ind.target) : "—", { size: 10.5 * s, anchor: "end", fill: ind.target ? t.ink : t.subtle });
    body += text(c, cols.latest, y, lv ? num(lv.value) : l.notReported, { size: 10.5 * s, anchor: "end", fill: lv ? (lv.verified ? t.ink : t.warn) : t.subtle });
    body += text(c, cols.pct, y, lv?.percent !== null && lv?.percent !== undefined ? `${Math.round(lv.percent)}%` : "—", { size: 10.5 * s, anchor: "end", fill: lv?.percent !== null && lv?.percent !== undefined ? t.ink : t.subtle });
    body += `<line x1="${r(12 * s)}" y1="${r(y + 9 * s)}" x2="${r(width - 12 * s)}" y2="${r(y + 9 * s)}" stroke="${t.line}"/>`;
  }
  if (all.length > limit) {
    y += 24 * s;
    body += text(c, 16 * s, y, `+${all.length - limit}`, { size: 10 * s, fill: t.muted });
  }
  return framed(c, title, width, y + 14 * s, body);
}

// ---------- RESULTS CHAIN ----------
const LEVEL_ORDER = ["IMPACT", "GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"];
export function resultsChainBlock(c: RenderCtx, section: InfographicSectionConfig, width: number): Slot {
  const title = titleFor(c, section);
  const { t, s, l } = c;
  const groups = new Map<string, LatestValue[]>();
  for (const ind of c.sheet.indicators) {
    const lv = chosenIndicators(c, [ind.id], 1)[0];
    const level = (ind.level ?? "OTHER").toUpperCase();
    const list = groups.get(level) ?? [];
    if (lv) list.push(lv);
    groups.set(level, list);
  }
  const ordered = [...groups.entries()].filter(([, list]) => list.length > 0).sort(([a], [b]) => (LEVEL_ORDER.indexOf(a) + 1 || 99) - (LEVEL_ORDER.indexOf(b) + 1 || 99));
  if (ordered.length === 0) return notReported(c, title, width, 110);
  const levelLabel = (level: string): string => (level === "IMPACT" ? l.impact : level === "GOAL" ? l.goal : level === "OUTCOME" ? l.outcome : level === "OUTPUT" ? l.output : level === "ACTIVITY" ? l.activity : l.indicators);
  let y = 12 * s;
  let body = "";
  const labelW = 120 * s;
  ordered.forEach(([level, list], gi) => {
    const rows = list.slice(0, 4);
    const h = Math.max(54 * s, rows.length * 30 * s + 16 * s);
    const shade = mixHex(t.accent, "#ffffff", Math.min(0.55, gi * 0.18));
    body += `<path d="M0 ${r(y)} H${r(labelW)} L${r(labelW + 14 * s)} ${r(y + h / 2)} L${r(labelW)} ${r(y + h)} H0 Z" fill="${shade}"/>`;
    body += text(c, 14 * s, y + h / 2 + 5 * s, levelLabel(level), { size: 12.5 * s, bold: true, fill: onColor(c, shade) });
    rows.forEach((lv, k) => {
      const ry = y + 22 * s + k * 30 * s;
      body += text(c, labelW + 30 * s, ry, wrapText(`${lv.code} ${lv.name}`, width - labelW - 190 * s, 11 * s, 1)[0] ?? lv.code, { size: 11 * s });
      body += text(c, width - 16 * s, ry, `${lv.number !== null ? fmt(c, lv.number) : lv.value}${lv.unit === "%" ? "%" : ""}${lv.percent !== null && lv.targetNumber !== null ? ` / ${fmt(c, lv.targetNumber)} · ${Math.round(lv.percent)}%` : ""}`, { size: 11 * s, bold: true, anchor: "end", fill: lv.verified ? t.ink : t.warn });
    });
    y += h + 8 * s;
  });
  return framed(c, title, width, y + 4 * s, body);
}
