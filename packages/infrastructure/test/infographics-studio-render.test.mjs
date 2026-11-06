import test from "node:test";
import assert from "node:assert/strict";
import { configFromTemplate, INFOGRAPHIC_TEMPLATE_IDS, INFOGRAPHIC_FORMAT_IDS, INFOGRAPHIC_FORMATS, INFOGRAPHIC_SECTION_KINDS, INFOGRAPHIC_THEME_IDS, validateConfig, knownTemplates, INFOGRAPHIC_LANGUAGES } from "@donordesk/domain";
import { composeInfographicDocument, rasterizePage } from "../dist/infographics/composer.js";
import { InfographicComposerRenderer } from "../dist/infographics/renderer.js";
import { sheet, data, provenance, pins, richConfig, fakePhoto, gulu } from "./fixtures/infographic-fixtures.mjs";

const compose = (config, over = {}) =>
  composeInfographicDocument({ config, data, sheet, provenance, mapPoints: pins, mapShapes: [{ kind: "COUNTRY", rings: [gulu] }], organizationName: "Org", templateLabel: "Template", assets: { a1: fakePhoto() }, ...over });
const svgs = async (config, over) => (await compose(config, over)).map((p) => p.svg).join("\n");
const renderInput = (config, over = {}) => ({
  configJson: JSON.stringify(config), dataJson: JSON.stringify(data), sheetJson: JSON.stringify(sheet), provenanceJson: JSON.stringify(provenance),
  mapPointsJson: JSON.stringify(pins), organizationName: "Org", ...over,
});

test("the rich design validates and every block kind draws something recognisable", async () => {
  const config = richConfig();
  assert.equal(validateConfig(config, knownTemplates()).ok, true);
  const all = await svgs(config);
  for (const needle of ["Clean water reached 21,345", "21,300", "People in need", "48,000", "63%", "Key messages", "Who we reached", "Female 11,800 (55%)", "Under 5", "5–17", "60 and over", "Progress against targets", "88%", "Results by sector", "Timeline", "2026-04-02", "In their words", "Community leader, Gulu", "Funding", "Trends", "Results chain", "Outcomes", "Notes and sources", "Figures to 30 September 2026."]) {
    assert.ok(all.includes(needle), `missing “${needle}”`);
  }
});

test("no raw code ever reaches the page: age groups, sexes and levels read as words", async () => {
  const all = await svgs(richConfig({ sections: [{ kind: "DEMOGRAPHICS" }, { kind: "RESULTS_CHAIN" }, { kind: "KPIS" }] }));
  const visible = [...all.matchAll(/>([^<>]+)</g)].map((m) => m[1]);
  for (const word of visible) assert.doesNotMatch(word, /^[A-Z]+(_[A-Z0-9]+)+$/, `raw key “${word}” on the page`);
  assert.match(all, />Under 5</);
  const fr = await svgs(richConfig({ language: "fr", sections: [{ kind: "DEMOGRAPHICS" }] }));
  assert.match(fr, /Moins de 5 ans/);
  assert.match(fr, /60 ans et plus/);
});

test("a rate is never read as percent of target; a missing value is never zero", async () => {
  const all = await svgs(richConfig({ sections: [{ kind: "PROGRESS_RINGS", indicatorIds: ["i3"] }, { kind: "TABLE" }] }));
  assert.match(all, />64%</, "the rate shows its own value");
  assert.doesNotMatch(all, />80%</, "the 64 is not turned into 80% of anything");
  const empty = await svgs(richConfig({ sections: [{ kind: "BIG_NUMBERS", numbers: [{ source: "REACH_UNIQUE", label: "Reached" }, { source: "INDICATOR", label: "x", indicatorId: "nope" }] }] }), { data: { ...data, reach: { ...data.reach, overallUnique: 0 } } });
  assert.match(empty, /Not yet reported/);
  assert.doesNotMatch(empty, />0</);
});

test("every format makes pages of its own canvas; screen formats become a carousel instead of overflowing", async () => {
  for (const id of INFOGRAPHIC_FORMAT_IDS) {
    const pages = await compose(richConfig({ format: id }));
    const f = INFOGRAPHIC_FORMATS[id];
    assert.ok(pages.length >= 1);
    for (const p of pages) assert.deepEqual([p.width, p.height], [f.width, f.height], `${id} canvas`);
  }
  assert.ok((await compose(richConfig({ format: "SQUARE" }))).length > 1, "a long design on a square card continues on the next card");
  assert.equal((await compose({ ...configFromTemplate("STORY_CARD"), sections: [{ kind: "BIG_NUMBERS", numbers: [{ source: "REACH_UNIQUE", label: "People reached" }] }] })).length, 1);
});

test("the grid places three blocks in one row and honours a page break", async () => {
  const config = richConfig({ format: "A4_PORTRAIT", sections: [{ kind: "TEXT", span: 4, text: "a" }, { kind: "TEXT", span: 4, text: "b" }, { kind: "TEXT", span: 4, text: "c" }, { kind: "TEXT", text: "d", pageBreakBefore: true }] });
  const pages = await compose(config);
  assert.equal(pages.length, 2, "a break starts a new page");
  const xs = [...pages[0].svg.matchAll(/<g transform="translate\(([\d.]+) 0\)">/g)].map((m) => Number(m[1]));
  assert.equal(xs.length, 3, "three blocks share one row");
  assert.ok(xs[0] < xs[1] && xs[1] < xs[2]);
});

test("empty authored blocks are left out of an export and hinted in the Studio preview", async () => {
  const config = richConfig({ sections: [{ kind: "KEY_MESSAGES" }, { kind: "TIMELINE" }, { kind: "QUOTE" }, { kind: "IMAGE" }, { kind: "SECTOR_GRID" }, { kind: "FUNNEL" }, { kind: "BIG_NUMBERS" }, { kind: "TEXT", text: "kept" }] });
  const exported = await svgs(config);
  assert.doesNotMatch(exported, /Add three to five|Add dated events|Choose an image/);
  assert.doesNotMatch(exported, /Key messages|Timeline/, "no empty headings in the export");
  const preview = await svgs(config, { preview: true });
  assert.match(preview, /Add three to five key messages/);
  assert.match(preview, /Add dated events/);
  assert.match(preview, /Choose an image/);
});

test("authored text in every new block is escaped", async () => {
  const evil = "<script>alert(1)</script> & \"x\"";
  const config = richConfig({
    title: evil, subtitle: evil,
    sections: [
      { kind: "HERO" },
      { kind: "BIG_NUMBERS", numbers: [{ source: "MANUAL", label: evil, value: evil, caption: evil, sourceNote: evil }] },
      { kind: "KEY_MESSAGES", messages: [{ text: evil }] },
      { kind: "TIMELINE", events: [{ date: "2026-01-01", label: evil, detail: evil }] },
      { kind: "QUOTE", text: evil, attribution: evil },
      { kind: "SECTOR_GRID", sectors: [{ label: evil, indicatorIds: [] }] },
      { kind: "FUNNEL", stages: [{ label: evil, value: 5, sourceNote: evil }] },
      { kind: "LEGEND_NOTES", notes: [evil] },
      { kind: "IMAGE", assetId: "a1", caption: evil, credit: evil, altText: evil },
    ],
  });
  const all = await svgs(config, { organizationName: evil });
  assert.doesNotMatch(all, /<script/i);
  assert.match(all, /&lt;script&gt;/);
});

test("images: an uploaded asset is embedded; a removed asset draws nothing and never breaks the page", async () => {
  const withImg = await svgs(richConfig({ sections: [{ kind: "IMAGE", assetId: "a1", caption: "A new well", credit: "J. Ouma", altText: "A borehole" }] }));
  assert.match(withImg, /data:image\/png;base64,/);
  assert.match(withImg, /A new well/);
  assert.match(withImg, /Photo: J\. Ouma/);
  assert.match(withImg, /<title>A borehole<\/title>/);
  const gone = await svgs(richConfig({ sections: [{ kind: "IMAGE", assetId: "removed" }, { kind: "TEXT", text: "still here" }] }));
  assert.match(gone, /still here/);
});

test("a hero photo gets a dark overlay so the headline stays readable", async () => {
  const hero = await svgs(richConfig({ sections: [{ kind: "HERO", assetId: "a1" }] }));
  assert.match(hero, /opacity="0.5"/);
  assert.match(hero, /preserveAspectRatio="xMidYMid slice"/);
});

test("French and Spanish pages use their own words and number formats", async () => {
  const fr = await svgs(richConfig({ language: "fr", sections: [{ kind: "KPIS" }, { kind: "DEMOGRAPHICS" }, { kind: "MAP" }] }));
  assert.match(fr, /Chiffres clés/);
  assert.match(fr, /Femmes/);
  assert.match(fr, /Les frontières et les noms indiqués/);
  assert.match(fr, /Données/);
  assert.doesNotMatch(fr, /Key figures/);
  const es = await svgs(richConfig({ language: "es", sections: [{ kind: "BIG_NUMBERS", numbers: [{ source: "FINANCE_BUDGET", label: "Presupuesto" }] }, { kind: "MAP" }] }));
  assert.match(es, /Los límites y los nombres/);
  assert.match(es, /Generado el/);
  for (const lang of INFOGRAPHIC_LANGUAGES) assert.ok((await compose(richConfig({ language: lang }))).length >= 1);
});

test("maps: legend, disclaimer, border notes for the country, and an opt-out", async () => {
  const base = { kind: "MAP" };
  const normal = await svgs(richConfig({ sections: [base] }));
  assert.match(normal, /do not imply official endorsement/);
  assert.match(normal, /3 sites/);
  assert.match(normal, /Done/);
  const sudan = await svgs(richConfig({ sections: [base] }), { data: { ...data, project: { ...data.project, country: "South Sudan" } } });
  assert.match(sudan, /Abyei/);
  const off = await svgs(richConfig({ mapDisclaimer: false, sections: [base] }));
  assert.doesNotMatch(off, /endorsement/);
  const empty = await svgs(richConfig({ sections: [base] }), { mapPoints: [], mapShapes: [] });
  assert.match(empty, /Not yet reported/);
});

test("maps: regions with values are shaded in classes with a legend", async () => {
  const sq = (x, y) => [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
  const shapes = [{ kind: "COUNTRY", rings: [[[0, 0], [4, 0], [4, 2], [0, 2]]] }, ...[0, 1, 2, 3].map((i) => ({ kind: "REGION", name: `R${i}`, value: (i + 1) * 100, rings: [sq(i, 0)] }))];
  const all = await svgs(richConfig({ sections: [{ kind: "MAP" }] }), { mapShapes: shapes, mapPoints: [] });
  assert.match(all, /Legend: 100/);
  assert.match(all, /400/);
  const fills = new Set([...all.matchAll(/<path d="M[^"]+" fill="(#[0-9a-f]{6})" stroke/g)].map((m) => m[1]));
  assert.ok(fills.size >= 3, "regions of different value get different shades");
});

test("the print theme draws in greys only, even for charts", async () => {
  const all = await svgs(richConfig({ themeId: "PRINT_MONO", sections: [{ kind: "SMALL_MULTIPLES" }, { kind: "PROGRESS_RINGS" }, { kind: "KEY_MESSAGES", messages: [{ text: "a" }] }, { kind: "HERO" }] }));
  const hexes = [...new Set([...all.matchAll(/#([0-9a-f]{6})\b/gi)].map((m) => m[1].toLowerCase()))];
  const colourful = hexes.filter((h) => !(h.slice(0, 2) === h.slice(2, 4) && h.slice(2, 4) === h.slice(4, 6)));
  assert.deepEqual(colourful, [], `non-grey colours: ${colourful.join(",")}`);
});

test("a brand kit colours the page, readable on white", async () => {
  const all = await svgs(richConfig({ themeId: "BRAND", sections: [{ kind: "HERO" }] }), { brand: { primaryColor: "#ffd400" } });
  assert.doesNotMatch(all, /fill="#ffd400"/, "the pale primary is darkened until it reads");
  assert.match(all, /<rect x="0" y="0" width="1096"/);
});

test("donor logos and the acknowledgement appear in the footer; the footer line follows the brand", async () => {
  const all = await svgs(richConfig({ branding: true, acknowledgement: "With funding from X", donorLogoAssetIds: ["a1"], sections: [{ kind: "TEXT", text: "x" }] }), { brand: { primaryColor: "#0b66b3", footerLine: "www.example.org" } });
  assert.match(all, /With funding from X/);
  assert.match(all, /www\.example\.org/);
  assert.match(all, /<image [^>]*data:image\/png/);
});

test("preview pages carry the same drawing as the export (one composer)", async () => {
  const config = richConfig();
  const a = (await compose(config)).map((p) => p.svg);
  const b = (await compose(config, { preview: true })).map((p) => p.svg);
  assert.deepEqual(a, b, "with nothing empty, preview and export are byte-identical");
});

test("every template composes with no data at all and says 'Not yet reported' instead of failing", async () => {
  const empty = {
    ...data, indicators: [], reach: { overallUnique: 0, registeredTotal: 0, registeredByLocation: [], attendancesByActivityLocation: [], beneficiariesWithoutLocation: 0, attendancesWithoutLocation: 0, bySex: {}, byAgeGroup: {} },
    activities: { rows: [], unlocated: 0 }, finance: { enabled: false, rows: [] }, periods: [], periodOrder: [],
  };
  for (const id of INFOGRAPHIC_TEMPLATE_IDS) {
    const pages = await composeInfographicDocument({ config: configFromTemplate(id), data: empty, sheet: { ...sheet, periods: [], indicators: [], cells: [] }, provenance: { ...provenance, periodLabels: [] }, mapPoints: [], organizationName: "Org", templateLabel: id, preview: true });
    assert.ok(pages.length >= 1, id);
    await rasterizePage(pages[0].svg);
  }
});

test("every template composes with the full fixture in every theme", async () => {
  for (const id of INFOGRAPHIC_TEMPLATE_IDS) for (const themeId of INFOGRAPHIC_THEME_IDS) {
    const pages = await compose({ ...configFromTemplate(id), themeId });
    assert.ok(pages.length >= 1, `${id}/${themeId}`);
  }
});

test("section kinds: every one is composed by some template or by the rich design (no dead block)", () => {
  const used = new Set(richConfig().sections.map((s) => s.kind));
  for (const id of INFOGRAPHIC_TEMPLATE_IDS) for (const s of configFromTemplate(id).sections) used.add(s.kind);
  used.add("CHART");
  used.add("BANNER");
  used.add("DIVIDER");
  for (const kind of INFOGRAPHIC_SECTION_KINDS) assert.ok(used.has(kind), kind);
});

test("banner and divider draw; a chart honours the theme palette", async () => {
  const all = await svgs(richConfig({ sections: [{ kind: "BANNER", text: "Thank you to our partners" }, { kind: "DIVIDER" }, { kind: "CHART", chart: { template: "INDICATOR_OVER_TIME", indicatorIds: ["i1"], measure: "CUMULATIVE", type: "LINE" } }] }));
  assert.match(all, /Thank you to our partners/);
  assert.match(all, /<line /);
  assert.match(all, /<svg x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+" viewBox=/, "the chart is drawn as a vector picture");
});

test("the renderer: PNG at 1x/2x/3x, SVG pages, multi-page PNG, PDF with page sizes and real text, PPTX is a zip", async () => {
  const r = new InfographicComposerRenderer();
  const input = renderInput(richConfig({ format: "A4_LANDSCAPE" }), { assetsJson: JSON.stringify({ a1: fakePhoto() }) });
  const size = (png) => [png.readUInt32BE(16), png.readUInt32BE(20)];
  const one = await r.renderPng(input, 1);
  const two = await r.renderPng(input, 2);
  assert.deepEqual(size(one.value), [1754, 1240]);
  assert.deepEqual(size(two.value), [3508, 2480]);
  const svg = await r.renderSvgPages(input);
  assert.equal(svg.ok, true);
  assert.ok(svg.value.length >= 2);
  assert.match(svg.value[0].svg, /^<svg /);
  const pngs = await r.renderPngPages(input, 1);
  assert.equal(pngs.value.length, svg.value.length);
  const pdf = await r.renderPdf(input);
  assert.equal(pdf.ok, true);
  const raw = pdf.value.toString("latin1");
  assert.match(raw, /\/MediaBox \[0 0 841\.89 595\.28\]/, "landscape A4 paper");
  assert.equal((raw.match(/\/Type \/Page\b/g) ?? []).length, svg.value.length, "one PDF page per composed page");
  assert.match(raw, /LiberationSans/);
  const pptx = await r.renderPptx(input, { title: "T", altText: "A summary", sourcesNote: "Source: records" });
  assert.equal(pptx.ok, true);
  assert.equal(pptx.value.subarray(0, 2).toString(), "PK", "a PowerPoint file is a zip");
  assert.ok(pptx.value.length > 5000);
  const bad = await r.renderPng({ ...input, configJson: "{" });
  assert.equal(bad.ok, false);
});

test("the renderer is deterministic across formats", async () => {
  const r = new InfographicComposerRenderer();
  for (const format of ["A4_PORTRAIT", "SLIDE_16_9", "STORY"]) {
    const input = renderInput(richConfig({ format }), { assetsJson: JSON.stringify({ a1: fakePhoto() }) });
    const a = await r.renderPng(input, 1);
    const b = await r.renderPng(input, 1);
    assert.equal(a.value.equals(b.value), true, format);
    const p1 = await r.renderPdf(input);
    const p2 = await r.renderPdf(input);
    assert.equal(p1.value.length, p2.value.length, `${format} pdf`);
  }
});

test("pages say where each block sits, so a click on the picture can select it", async () => {
  const config = richConfig({ sections: [{ kind: "TEXT", span: 6, text: "a" }, { kind: "TEXT", span: 6, text: "b" }, { kind: "TEXT", hidden: true, text: "hidden" }, { kind: "TEXT", text: "c" }] });
  const [page] = await compose(config);
  assert.deepEqual(page.blocks.map((b) => b.index), [0, 1, 3], "indexes are the design's own, hidden blocks are skipped");
  const [a, b, c] = page.blocks;
  assert.equal(a.y, b.y, "two halves share a row");
  assert.ok(b.x > a.x + a.width - 1);
  assert.ok(c.y > a.y + a.height, "the next row is below");
  for (const blk of page.blocks) assert.ok(blk.x >= 0 && blk.y >= 0 && blk.x + blk.width <= page.width && blk.y + blk.height <= page.height);
  const [sq] = await compose(richConfig({ format: "SQUARE", sections: [{ kind: "TEXT", text: "a" }, { kind: "KEY_MESSAGES", messages: [{ text: "x" }] }] }));
  assert.ok(sq.blocks.length === 2);
});

test("a crafted logo or image value cannot add attributes or elements to the page", async () => {
  const evil = 'data:image/png;base64,AAAA" onload="alert(1)" x="';
  const evilAsset = { dataUri: evil, width: 10, height: 10 };
  const all = await svgs(richConfig({ branding: true, donorLogoAssetIds: ["bad"], sections: [{ kind: "IMAGE", assetId: "bad" }, { kind: "HERO", assetId: "bad" }, { kind: "QUOTE", text: "q", assetId: "bad" }] }), { assets: { bad: evilAsset }, logoUrl: evil });
  assert.doesNotMatch(all, /onload/i);
  assert.doesNotMatch(all, /alert\(1\)/);
  for (const bad of ['javascript:alert(1)', 'https://example.com/x.png', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,AA AA']) {
    const out = await svgs(richConfig({ sections: [{ kind: "IMAGE", assetId: "x" }, { kind: "TEXT", text: "kept" }] }), { assets: { x: { dataUri: bad, width: 5, height: 5 } }, logoUrl: bad });
    assert.doesNotMatch(out, /javascript:|https:\/\/example|text\/html|image\/svg\+xml/, bad);
    assert.match(out, /kept/);
  }
});

import sharp from "sharp";

const inkPixels = async (svg, region) => {
  const png = await rasterizePage(svg);
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let y = region.y; y < region.y + region.height; y++) for (let x = region.x; x < region.x + region.width; x++) {
    const i = (y * info.width + x) * info.channels;
    if (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200) n++;
  }
  return n;
};

test("Arabic: the page is mirrored, words are Arabic, numbers stay Western, and the bundled face really draws the letters", async () => {
  const sections = [{ kind: "TEXT", span: 6, title: "ملاحظات", text: "تم الوصول إلى 21,345 شخصاً في أوغندا." }, { kind: "TEXT", span: 6, text: "second" }, { kind: "DEMOGRAPHICS" }, { kind: "MAP" }];
  const ar = await compose(richConfig({ language: "ar", themeId: "HUMANITARIAN_BLUE", sections }));
  const en = await compose(richConfig({ language: "en", themeId: "HUMANITARIAN_BLUE", sections }));
  const svg = ar.map((p) => p.svg).join("\n");
  assert.match(svg, /من وصلنا إليهم/, "section words in Arabic");
  assert.match(svg, /إناث/);
  assert.match(svg, /إن الحدود والأسماء المبينة/, "the UN map disclaimer in Arabic");
  assert.match(svg, /11,800/, "numbers stay in Western digits");
  assert.match(svg, /Noto Sans Arabic/);
  assert.match(svg, /scale\(-1 1\)/, "the page is mirrored");
  // The first block sits on the right of the first row, and the second to its left.
  const [first, second] = ar[0].blocks;
  assert.ok(first.x > second.x, "reading starts on the right");
  const [enFirst, enSecond] = en[0].blocks;
  assert.ok(enFirst.x < enSecond.x);
  assert.equal(first.x + first.width + enFirst.x, ar[0].width - 0 + (ar[0].width - ar[0].width), "mirror images of each other about the page centre");
  // Arabic letters really appear: the title region has ink.
  const ink = await inkPixels(ar[0].svg, { x: first.x, y: first.y, width: first.width, height: 60 });
  assert.ok(ink > 300, `Arabic title draws (${ink} dark pixels)`);
  // Pictures are not mirrored: an image block's picture is flipped back about its own centre.
  const withImage = await svgs(richConfig({ language: "ar", sections: [{ kind: "IMAGE", assetId: "a1" }] }));
  assert.match(withImage, /<g transform="translate\([\d.]+ 0\) scale\(-1 1\)"><image /);
});

test("Arabic: a PDF page with right-to-left script goes in as a picture (the vector writer cannot shape it); English stays vector text", async () => {
  const r = new InfographicComposerRenderer();
  const input = (language) => renderInput(richConfig({ language, sections: [{ kind: "TEXT", text: language === "ar" ? "مرحبا بكم" : "Hello" }] }));
  const ar = await r.renderPdf(input("ar"));
  const en = await r.renderPdf(input("en"));
  assert.equal(ar.ok, true);
  assert.doesNotMatch(ar.value.toString("latin1"), /LiberationSans/, "no selectable text face: the page is an image");
  assert.match(en.value.toString("latin1"), /LiberationSans/);
});

test("Arabic text typed into an English design is also drawn correctly in the PDF", async () => {
  const r = new InfographicComposerRenderer();
  const pdf = await r.renderPdf(renderInput(richConfig({ language: "en", sections: [{ kind: "TEXT", text: "اسم المشروع" }] })));
  assert.equal(pdf.ok, true);
  assert.doesNotMatch(pdf.value.toString("latin1"), /LiberationSans/);
});

const portfolio = {
  asAt: "2026-10-25",
  totals: { projects: 4, behind: 1, needAttention: 1, openRisks: 5, highRisks: 2, reportsOverdue: 1, countries: 2, onTrack: 1, noPlan: 1 },
  rows: [
    { title: "Clean Water for Gulu District", donorName: "Example Donor", country: "Uganda", status: "ACTIVE", band: "OFF_TRACK", bandLabel: "Behind", lateActivities: 3, valuesOverdue: 1, openRisks: 3, highRisks: 1, reportsOverdue: 1, nextReport: { deadline: "2026-10-01", daysUntil: -24 } },
    { title: "Nutrition in Kitgum <script>", donorName: "Other Donor", country: "Uganda", status: "ACTIVE", band: "AT_RISK", bandLabel: "Needs attention", lateActivities: 1, valuesOverdue: 0, openRisks: 2, highRisks: 1, reportsOverdue: 0, nextReport: { deadline: "2026-11-30", daysUntil: 36 } },
    { title: "Health in Turkana", donorName: "Example Donor", country: "Kenya", status: "ACTIVE", band: "ON_TRACK", bandLabel: "On track", lateActivities: 0, valuesOverdue: 0, openRisks: 0, highRisks: 0, reportsOverdue: 0 },
    { title: "Schools in Wajir", donorName: "Third", country: "Kenya", status: "DRAFT", band: "NO_PLAN", bandLabel: "No plan yet", lateActivities: 0, valuesOverdue: 0, openRisks: 0, highRisks: 0, reportsOverdue: 0 },
  ],
  countries: [{ country: "Uganda", projects: 2, offTrack: 1, atRisk: 1, onTrack: 0, noPlan: 0 }, { country: "Kenya", projects: 2, offTrack: 0, atRisk: 0, onTrack: 1, noPlan: 1 }],
};

test("a portfolio page draws the dashboard's own read: counts, bands, countries and projects, with nothing combined into a score", async () => {
  const config = { ...configFromTemplate("PORTFOLIO_OVERVIEW"), themeId: "HUMANITARIAN_BLUE" };
  assert.equal(validateConfig(config, knownTemplates()).ok, true);
  const all = await svgs(config, { portfolio, mapPoints: [{ name: "Uganda", lat: 1, lng: 32, worst: "LATE", count: 2 }], data: { ...data, project: { ...data.project, country: "" } } });
  for (const needle of ["Portfolio at a glance", "Delivery health", "Projects by country", "Clean Water for Gulu District", "Needs attention", "Behind", "Uganda", "Kenya", "As at 2026-10-25", "24d late", "No plan yet", "Open risks", "Reports overdue"]) {
    assert.ok(all.includes(needle), `missing “${needle}”`);
  }
  assert.doesNotMatch(all, /score/i, "no combined score anywhere");
  assert.doesNotMatch(all, /<script/i, "a project title with markup is escaped");
  assert.match(all, /&lt;script&gt;/);
});

test("a portfolio page with no visible projects says so instead of drawing zeros", async () => {
  const empty = { ...portfolio, totals: { ...portfolio.totals, projects: 0 }, rows: [], countries: [] };
  const all = await svgs({ ...configFromTemplate("PORTFOLIO_OVERVIEW") }, { portfolio: empty });
  assert.match(all, /Not yet reported/);
});

test("portfolio figures can be headline numbers, and the map prints the border notes of every country in the portfolio", async () => {
  const cfg = { ...configFromTemplate("PORTFOLIO_OVERVIEW"), sections: [{ kind: "BIG_NUMBERS", numbers: [{ source: "PORTFOLIO_PROJECTS", label: "Projects" }, { source: "PORTFOLIO_OFF_TRACK", label: "Behind" }, { source: "PORTFOLIO_OPEN_RISKS", label: "Risks" }] }, { kind: "MAP" }] };
  const sudan = { ...portfolio, countries: [{ country: "Uganda", projects: 1, offTrack: 0, atRisk: 0, onTrack: 1, noPlan: 0 }, { country: "South Sudan", projects: 1, offTrack: 0, atRisk: 0, onTrack: 1, noPlan: 0 }] };
  const all = await svgs(cfg, { portfolio: sudan, mapPoints: [{ name: "Juba", lat: 4.8, lng: 31.6, worst: "DONE" }] });
  assert.match(all, />4</);
  assert.match(all, /Abyei/);
  assert.equal((all.match(/do not imply official endorsement/g) ?? []).length, 1, "the disclaimer is printed once");
});

test("who does what, where: columns are the places (grouped by the one normalizer), ticks are presence, the source is printed", async () => {
  const cfg = richConfig({ sections: [{ kind: "THREE_W", caption: "Partner reports, September 2026", presence: [
    { who: "Water Aid", what: "Boreholes", where: ["Gulu", "Kitgum"] },
    { who: "Care Org", what: "Hygiene", where: ["Gulu District"] },
    { who: "Care Org", what: "Latrines <b>", where: ["gulu", "Pader"] },
  ] }] });
  const all = await svgs(cfg);
  assert.match(all, /Who does what, where/);
  assert.match(all, /Source: Partner reports, September 2026/);
  assert.match(all, /2 organizations/, "two organizations, however many rows");
  assert.equal((all.match(/>Gulu</g) ?? []).length + (all.match(/>Gulu District</g) ?? []).length, 1, "Gulu, Gulu District and gulu are one column");
  assert.equal((all.match(/<circle cx="[\d.]+" cy="[\d.]+" r="6" fill/g) ?? []).length, 5, "one tick per place a row names");
  assert.doesNotMatch(all, /<b>/);
  const preview = await svgs(richConfig({ sections: [{ kind: "THREE_W" }] }), { preview: true });
  assert.match(preview, /Add the organizations/);
  assert.doesNotMatch(await svgs(richConfig({ sections: [{ kind: "THREE_W" }] })), /Add the organizations|Who does what/);
});

test("the PDF is tagged: a document of described figures, in the page's language, with a title; charts are vector, not pictures", async () => {
  const r = new InfographicComposerRenderer();
  const cfg = richConfig({ language: "fr", sections: [{ kind: "CHART", title: "Forages", chart: { template: "INDICATOR_OVER_TIME", indicatorIds: ["i1"], measure: "CUMULATIVE", type: "LINE" } }, { kind: "TEXT", text: "Bonjour" }] });
  const pdf = await r.renderPdf(renderInput(cfg), { altText: "Une description de la page" });
  assert.equal(pdf.ok, true);
  const raw = pdf.value.toString("latin1");
  assert.match(raw, /\/StructTreeRoot/, "a structure tree");
  assert.match(raw, /\/MarkInfo/);
  assert.match(raw, /\/Lang \(fr-FR\)/);
  assert.match(raw, /\/S \/Figure/);
  assert.match(raw, /Une description de la page/, "the page's description is its alternative text");
  assert.match(raw, /\/S \/Document/);
  assert.equal((raw.match(/\/Subtype \/Image/g) ?? []).length, 0, "the chart is drawn as vector lines and text");
  const two = await r.renderPdf(renderInput(richConfig({ format: "A4_PORTRAIT" })), { altText: "Résumé" });
  const figures = (two.value.toString("latin1").match(/\/S \/Figure/g) ?? []).length;
  assert.ok(figures >= 2, "one figure per page");
  const ar = await r.renderPdf(renderInput(richConfig({ language: "ar", sections: [{ kind: "TEXT", text: "مرحبا" }] })));
  assert.match(ar.value.toString("latin1"), /\/S \/Figure/, "a page drawn as a picture is still a described figure");
  assert.match(ar.value.toString("latin1"), /\/Lang \(ar\)/);
});
