/** Quote, image, timeline, sector cards and the who-does-what-where matrix, painted from their models (Phase 45.2). */
import type { ModelOf } from "@donordesk/domain";
import { imageModel, quoteModel, sectorGridModel, threeWModel, timelineModel } from "@donordesk/domain";
import { esc, flipBack, fmt, framed, heading, headingHeight, icon, notReported, paragraph, previewHint, r, text, wrapText } from "../../infographics/kit.js";
import type { PrintPainter } from "../print-types.js";

type Quote = ModelOf<typeof quoteModel>;
export const paintQuote: PrintPainter<Quote> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return previewHint(c, title, width, "Add a quotation and who said it");
  const q = model.model;
  const { t, s } = c;
  const asset = q.assetId ? c.assets.get(q.assetId) : undefined;
  const pad = 24 * s;
  const left = asset ? 96 * s : pad;
  const size = 19 * s;
  const para = paragraph(c, left + 20 * s, 16 * s, q.text, width - left - pad - 20 * s, { size, maxLines: 7, fill: t.ink, italic: true, lineHeight: size * 1.4 });
  const attr = q.attribution ? 22 * s : 0;
  const h = Math.max(para.height + 40 * s + attr, asset ? 100 * s : 0);
  let body = `<rect x="0" y="0" width="${r(5 * s)}" height="${r(h)}" fill="${t.accent}"/>`;
  body += text(c, left - 4 * s, 44 * s, "“", { size: 54 * s, bold: true, fill: t.accentSoft });
  body += para.svg;
  if (q.attribution) body += text(c, left + 20 * s, h - 14 * s, `— ${q.attribution}`, { size: 11.5 * s, bold: true, fill: t.muted });
  if (asset) body += `<clipPath id="q-clip"><circle cx="${r(52 * s)}" cy="${r(h / 2)}" r="${r(34 * s)}"/></clipPath>${flipBack(c, 52 * s, `<image x="${r(18 * s)}" y="${r(h / 2 - 34 * s)}" width="${r(68 * s)}" height="${r(68 * s)}" href="${asset.dataUri}" preserveAspectRatio="xMidYMid slice" clip-path="url(#q-clip)"/>`)}`;
  return framed(c, title, width, h, body, t.surface);
};

type Image = ModelOf<typeof imageModel>;
export const paintImage: PrintPainter<Image> = ({ model, ctx: c, title, width }) => {
  // The picture itself is a file the page holds; a model that names one the page does not have is the same as none chosen.
  const asset = model.state === "ready" ? c.assets.get(model.model.assetId) : undefined;
  if (model.state !== "ready" || !asset) return previewHint(c, title, width, "Choose an image");
  const m = model.model;
  const { t, s } = c;
  const maxH = Math.min(c.format.height * 0.42, 560 * s);
  const natural = (asset.height / asset.width) * width;
  const h = m.fit === "CONTAIN" ? Math.min(natural, maxH) : Math.min(Math.max(width * 0.5, 160 * s), maxH);
  const par = m.fit === "CONTAIN" ? "xMidYMid meet" : "xMidYMid slice";
  let svg = `<clipPath id="img-clip"><rect x="0" y="0" width="${r(width)}" height="${r(h)}" rx="${t.radius}"/></clipPath><g clip-path="url(#img-clip)"><rect x="0" y="0" width="${r(width)}" height="${r(h)}" fill="${t.surface}"/>${flipBack(c, width / 2, `<image x="0" y="0" width="${r(width)}" height="${r(h)}" href="${asset.dataUri}" preserveAspectRatio="${par}"/>`)}</g>`;
  let height = h;
  const caption = [m.caption, m.credit ? `${c.l.photoCredit}: ${m.credit}` : ""].filter(Boolean).join(" · ");
  if (caption) {
    const p = paragraph(c, 0, h + 6 * s, caption, width, { size: 10 * s, maxLines: 2, fill: t.muted });
    svg += p.svg;
    height += 6 * s + p.height;
  }
  return { svg: `<g>${m.altText ? `<title>${esc(m.altText)}</title>` : ""}${svg}</g>`, width, height: height + 18 * s };
};

type Timeline = ModelOf<typeof timelineModel>;
export const paintTimeline: PrintPainter<Timeline> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return previewHint(c, title, width, "Add dated events");
  const events = model.model.events;
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
};

type Sectors = ModelOf<typeof sectorGridModel>;
export const paintSectorGrid: PrintPainter<Sectors> = ({ model, ctx: c, title, width }) => {
  if (model.state === "empty") return previewHint(c, title, width, "Add sectors and choose their indicators");
  if (model.state !== "ready") return notReported(c, title, width);
  const sectors = model.model.sectors;
  const { t, s } = c;
  const gap = c.grid.gap;
  const perRow = Math.max(1, Math.min(sectors.length, Math.floor((width + gap) / (230 * s + gap))));
  const cardW = (width - gap * (perRow - 1)) / perRow;
  const cardHs = sectors.map((sector) => (60 + Math.max(1, sector.indicators.length) * 44 + 12) * s);
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
    if (sector.indicators.length === 0) body += text(c, 16 * s, 76 * s, c.l.notYetReported, { size: 11 * s, italic: true, fill: t.subtle });
    sector.indicators.forEach((ind, k) => {
      const y = 64 * s + k * 44 * s;
      if (!ind) { body += text(c, 16 * s, y + 14 * s, c.l.notYetReported, { size: 11 * s, italic: true, fill: t.subtle }); return; }
      body += text(c, 16 * s, y + 10 * s, wrapText(ind.name, cardW - 32 * s, 10 * s, 1)[0] ?? ind.name, { size: 10 * s, fill: t.muted });
      const val = ind.amount !== null ? fmt(c, ind.amount) : ind.text;
      body += text(c, 16 * s, y + 30 * s, `${val}${ind.unit === "%" ? "%" : ""}`, { size: 16 * s, bold: true, fill: ind.verified ? t.ink : t.warn });
      if (ind.percent !== null && ind.target !== null) {
        const bx = cardW * 0.46;
        const bw = cardW - bx - 16 * s;
        body += `<rect x="${r(bx)}" y="${r(y + 20 * s)}" width="${r(bw)}" height="${r(8 * s)}" rx="${r(4 * s)}" fill="${t.accentSoft}"/><rect x="${r(bx)}" y="${r(y + 20 * s)}" width="${r(Math.max(4 * s, Math.min(1, ind.percent / 100) * bw))}" height="${r(8 * s)}" rx="${r(4 * s)}" fill="${t.accent}"/>`;
        body += text(c, cardW - 16 * s, y + 14 * s, `${Math.round(ind.percent)}% · ${fmt(c, ind.target)}`, { size: 9.5 * s, fill: t.muted, anchor: "end" });
      }
    });
    body += "</g>";
  });
  const total = rows.reduce((n, h) => n + h, 0) + gap * (rows.length - 1);
  return { svg: `${heading(c, title)}<g transform="translate(0 ${r(headingHeight(c, title))})">${body}</g>`, width, height: headingHeight(c, title) + total + 18 * s };
};

type ThreeW = ModelOf<typeof threeWModel>;
export const paintThreeW: PrintPainter<ThreeW> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return previewHint(c, title, width, "Add the organizations, what they do and where");
  const { rows, places, partners, source } = model.model;
  const { t, s, l } = c;
  const whoW = Math.min(170 * s, width * 0.24);
  const whatW = Math.min(170 * s, width * 0.24);
  const gridX = 16 * s + whoW + whatW;
  const colW = Math.max(40 * s, (width - gridX - 16 * s) / Math.max(places.length, 1));
  const rowH = 30 * s;
  const headH = 44 * s;
  let body = text(c, 16 * s, 28 * s, l.who, { size: 10 * s, bold: true, fill: t.muted });
  body += text(c, 16 * s + whoW, 28 * s, l.what, { size: 10 * s, bold: true, fill: t.muted });
  places.forEach((place, i) => {
    const cx = gridX + i * colW + colW / 2;
    wrapText(place.name, colW - 6 * s, 9.5 * s, 2, true).forEach((line, li) => (body += text(c, cx, 20 * s + li * 12 * s, line, { size: 9.5 * s, bold: true, fill: t.muted, anchor: "middle" })));
  });
  rows.forEach((row, ri) => {
    const y = headH + ri * rowH;
    if (ri % 2 === 0) body += `<rect x="${r(8 * s)}" y="${r(y - 4 * s)}" width="${r(width - 16 * s)}" height="${r(rowH)}" fill="${t.surface}"/>`;
    body += text(c, 16 * s, y + 15 * s, wrapText(row.who, whoW - 10 * s, 11 * s, 1, true)[0] ?? row.who, { size: 11 * s, bold: true });
    body += text(c, 16 * s + whoW, y + 15 * s, wrapText(row.what, whatW - 10 * s, 10.5 * s, 1)[0] ?? "", { size: 10.5 * s, fill: t.body });
    const keys = new Set(row.placeKeys);
    places.forEach((place, i) => { if (keys.has(place.key)) body += `<circle cx="${r(gridX + i * colW + colW / 2)}" cy="${r(y + 11 * s)}" r="${r(6 * s)}" fill="${t.accent}"/>`; });
  });
  const totalY = headH + rows.length * rowH + 6 * s;
  body += `<line x1="${r(12 * s)}" y1="${r(totalY - 6 * s)}" x2="${r(width - 12 * s)}" y2="${r(totalY - 6 * s)}" stroke="${t.line}"/>`;
  body += text(c, 16 * s, totalY + 12 * s, `${partners} ${l.partnersCount}`, { size: 10 * s, bold: true, fill: t.muted });
  places.forEach((place, i) => (body += text(c, gridX + i * colW + colW / 2, totalY + 12 * s, String(place.count), { size: 10.5 * s, bold: true, anchor: "middle" })));
  const height = totalY + 28 * s;
  const slot = framed(c, title, width, height, body);
  if (!source) return slot;
  const note = paragraph(c, 0, 0, `${l.source}: ${source}`, width, { size: 8.5 * s, maxLines: 2, fill: t.muted });
  const y = headingHeight(c, title) + height + 4 * s;
  return { svg: `${slot.svg}<g transform="translate(0 ${r(y)})">${note.svg}</g>`, width, height: y + note.height + 12 * s };
};
