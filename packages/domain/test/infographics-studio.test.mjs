import test from "node:test";
import assert from "node:assert/strict";
import {
  INFOGRAPHIC_TEMPLATES, INFOGRAPHIC_TEMPLATE_IDS, INFOGRAPHIC_SECTION_KINDS, SECTION_LABEL_KEY, DEFAULT_SECTION_LABEL,
  configFromTemplate, knownTemplates, validateConfig, spanOf,
  INFOGRAPHIC_FORMATS, INFOGRAPHIC_FORMAT_IDS, resolveFormat, gridFor, packRows, GRID_SPANS,
  INFOGRAPHIC_ICONS, iconById, iconSvg,
  INFOGRAPHIC_LABELS, LABEL_KEYS, INFOGRAPHIC_LANGUAGES, formatNumber, labelsFor, fill,
  UN_MAP_DISCLAIMER, borderNotesFor, mapDisclaimerLines,
  checkDesign, DESIGN_RULES, resolveTheme,
  suggestHeadlines, suggestKeyMessages, suggestTemplates,
  nextStatus, canApplyDesignAction, checkDesignApprover, shareLinkExpiry, isShareLinkLive, DESIGN_STATUSES,
  validateBrandKit, themeFromBrand, readableOn, contrastRatio, INFOGRAPHIC_THEMES, provenanceFooter, buildProvenance, isRtl,
} from "../dist/index.js";

const v = (config) => validateConfig(config, knownTemplates());
const base = (id = "OVERVIEW") => configFromTemplate(id);

test("every template validates, names a known format and has unique, visible, label-able sections", () => {
  for (const id of INFOGRAPHIC_TEMPLATE_IDS) {
    const t = INFOGRAPHIC_TEMPLATES[id];
    assert.equal(t.id, id);
    assert.ok(t.family, `${id} has a family`);
    if (t.format) assert.ok(INFOGRAPHIC_FORMAT_IDS.includes(t.format), `${id} format`);
    const result = v(configFromTemplate(id));
    assert.equal(result.ok, true, `${id}: ${result.error?.message}`);
    for (const section of t.sections) assert.ok(INFOGRAPHIC_SECTION_KINDS.includes(section.kind));
  }
});

test("every section kind has an English heading and a label key (or none) that exists", () => {
  for (const kind of INFOGRAPHIC_SECTION_KINDS) {
    assert.ok(DEFAULT_SECTION_LABEL[kind].length > 0);
    const key = SECTION_LABEL_KEY[kind];
    if (key) assert.ok(LABEL_KEYS.includes(key), `${kind} -> ${key}`);
    if (key) assert.equal(DEFAULT_SECTION_LABEL[kind], INFOGRAPHIC_LABELS.en[key], `${kind} English heading agrees with the label table`);
  }
});

test("labels: every language has every key, no empty strings, and placeholders agree with English", () => {
  for (const lang of INFOGRAPHIC_LANGUAGES) {
    for (const key of LABEL_KEYS) {
      const text = INFOGRAPHIC_LABELS[lang][key];
      assert.ok(typeof text === "string" && text.length > 0, `${lang}.${key}`);
      const holes = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
      assert.equal(holes(text), holes(INFOGRAPHIC_LABELS.en[key]), `${lang}.${key} placeholders`);
    }
  }
  assert.equal(labelsFor("zz").notYetReported, "Not yet reported");
  assert.equal(fill("{n} of {m}", { n: 2, m: 5 }), "2 of 5");
});

test("numbers: locale grouping and rounding to hundreds or thousands", () => {
  assert.equal(formatNumber(21345, "en"), "21,345");
  assert.equal(formatNumber(21345, "en", "THOUSANDS"), "21,000");
  assert.equal(formatNumber(21345, "en", "HUNDREDS"), "21,300");
  assert.equal(formatNumber(42, "en", "THOUSANDS"), "42", "a small number is not rounded away");
  assert.match(formatNumber(21345, "fr"), /21\s?345/);
});

test("provenance footer follows the language", () => {
  const p = buildProvenance({ generatedAt: "2026-10-24T12:00:00.000Z", periodLabels: ["T1 2026"], unverifiedCount: 2 });
  assert.match(provenanceFooter(p, "fr"), /Données: T1 2026/);
  assert.match(provenanceFooter(p, "fr"), /2 valeurs non encore vérifiées/);
  assert.match(provenanceFooter(p, "es"), /Generado el/);
});

test("formats: every format has a positive canvas and a grid whose 12 columns fill the content width", () => {
  for (const id of INFOGRAPHIC_FORMAT_IDS) {
    const f = INFOGRAPHIC_FORMATS[id];
    assert.ok(f.width > 0 && f.height > 0 && f.margin > 0 && f.pdf.width > 0);
    const g = gridFor(f);
    assert.ok(Math.abs(g.spanWidth(12) - g.contentWidth) < 0.001, `${id} 12 columns = content width`);
    assert.ok(Math.abs(g.spanWidth(6) * 2 + g.gap - g.contentWidth) < 0.001, `${id} two halves tile`);
  }
  assert.equal(resolveFormat(undefined).id, "A4_PORTRAIT");
  assert.equal(resolveFormat("NOPE").id, "A4_PORTRAIT");
  assert.equal(INFOGRAPHIC_FORMATS.A4_PORTRAIT.width, 1240, "A4 keeps the Phase 31 canvas");
});

test("grid: rows pack to twelve columns; a break forces a new row", () => {
  const rows = packRows([{ span: 6 }, { span: 6 }, { span: 4 }, { span: 4 }, { span: 4 }, { span: 8 }, { span: 6 }, { span: 12 }]);
  assert.deepEqual(rows.map((r) => r.map((x) => x.span)), [[6, 6], [4, 4, 4], [8], [6], [12]]);
  assert.deepEqual(packRows([{ span: 6 }, { span: 6, breakBefore: true }]).map((r) => r.length), [1, 1]);
  assert.deepEqual(packRows([]), []);
  assert.equal(spanOf({ size: "HALF" }), 6);
  assert.equal(spanOf({ size: "THIRD" }), 4);
  assert.equal(spanOf({}), 12);
  assert.equal(spanOf({ span: 8, size: "HALF" }), 8);
  assert.deepEqual([...GRID_SPANS], [3, 4, 6, 8, 9, 12]);
});

test("icons: unique ids, plain 24-grid paths, and iconSvg draws only known ones", () => {
  const ids = new Set();
  for (const icon of INFOGRAPHIC_ICONS) {
    assert.ok(!ids.has(icon.id), `duplicate ${icon.id}`);
    ids.add(icon.id);
    assert.match(icon.path, /^[MmLlHhVvCcSsQqTtAaZz0-9\s.,-]+$/, `${icon.id} path characters`);
    assert.ok(icon.label.length > 0);
  }
  assert.ok(INFOGRAPHIC_ICONS.length >= 20);
  assert.equal(iconSvg("nope", 0, 0, 24, "#000"), "");
  assert.match(iconSvg("water", 10, 20, 48, "#123456"), /translate\(10 20\) scale\(2\)/);
  assert.ok(iconById("health"));
});

test("map disclaimers: the UN text exists in all three languages; border notes follow the country", () => {
  for (const lang of INFOGRAPHIC_LANGUAGES) assert.ok(UN_MAP_DISCLAIMER[lang].length > 40);
  assert.deepEqual(borderNotesFor("Uganda", "en"), []);
  assert.deepEqual(borderNotesFor("South Sudan", "en").map((n) => n.id).sort(), ["ABYEI", "SUDAN_SOUTH_SUDAN"]);
  assert.deepEqual(borderNotesFor("Republic of the Sudan", "fr").map((n) => n.id).sort(), ["ABYEI", "SUDAN_SOUTH_SUDAN"]);
  assert.deepEqual(borderNotesFor("India", "es").map((n) => n.id), ["JAMMU_KASHMIR"]);
  assert.deepEqual(borderNotesFor("Indonesia", "en"), [], "whole words only");
  assert.deepEqual(borderNotesFor(undefined, "en"), []);
  assert.equal(mapDisclaimerLines("Uganda", "en").length, 1);
  assert.equal(mapDisclaimerLines("Sudan", "en").length, 4 - 1);
});

test("validation: new block fields are cleaned, bounded and never truncated", () => {
  const withSection = (section) => v({ ...base("CUSTOM"), sections: [section] });
  assert.equal(withSection({ kind: "KEY_MESSAGES", messages: [{ text: "  Water reached 3 villages  " }] }).value.sections[0].messages[0].text, "Water reached 3 villages");
  assert.equal(withSection({ kind: "KEY_MESSAGES", messages: [{ text: "x".repeat(161) }] }).ok, false);
  assert.equal(withSection({ kind: "KEY_MESSAGES", messages: Array.from({ length: 6 }, () => ({ text: "a" })) }).ok, false);
  assert.equal(withSection({ kind: "BIG_NUMBERS", numbers: [{ source: "INDICATOR", label: "x" }] }).ok, false, "an indicator figure needs an indicator");
  assert.equal(withSection({ kind: "BIG_NUMBERS", numbers: [{ source: "NOPE", label: "x" }] }).ok, false);
  assert.equal(withSection({ kind: "BIG_NUMBERS", numbers: [{ source: "MANUAL", label: "In need", value: "1.2 million", sourceNote: "HNO 2026", iconId: "people" }] }).ok, true);
  assert.equal(withSection({ kind: "BIG_NUMBERS", numbers: [{ source: "MANUAL", label: "x", iconId: "ghost" }] }).ok, false);
  assert.equal(withSection({ kind: "FUNNEL", stages: [{ label: "In need", value: -1 }] }).ok, false);
  assert.equal(withSection({ kind: "TIMELINE", events: [{ date: "2026-02-30", label: "x" }] }).ok, false, "a real calendar date");
  const ordered = withSection({ kind: "TIMELINE", events: [{ date: "2026-05-01", label: "b" }, { date: "2026-03-01", label: "a" }] });
  assert.deepEqual(ordered.value.sections[0].events.map((e) => e.label), ["a", "b"]);
  assert.equal(withSection({ kind: "TEXT", span: 5 }).ok, false);
  assert.equal(withSection({ kind: "TEXT", span: 8 }).ok, true);
  assert.equal(withSection({ kind: "SECTOR_GRID", sectors: [{ label: "WASH", indicatorIds: ["a", "b", "c", "d", "e"] }] }).ok, false);
});

test("validation: config-level format, profile, language, waivers and logos", () => {
  assert.equal(v({ ...base(), format: "POSTER" }).ok, false);
  assert.equal(v({ ...base(), format: "STORY" }).value.format, "STORY");
  assert.equal(v({ ...base(), profile: "NOPE" }).ok, false);
  assert.equal(v({ ...base(), language: "de" }).ok, false);
  assert.equal("language" in v({ ...base(), language: "en" }).value, false, "English is the default and is not stored");
  assert.equal(v({ ...base(), language: "fr" }).value.language, "fr");
  assert.equal(v({ ...base(), waivers: [{ ruleId: "MAP_DISCLAIMER", note: " " }] }).ok, false, "a waiver needs a reason");
  assert.equal(v({ ...base(), donorLogoAssetIds: ["a", "b", "c", "d"] }).ok, false);
  assert.equal(v({ ...base(), themeId: "BRAND" }).ok, true);
});

const ctx = (config, over = {}) => ({ config, theme: resolveTheme(config.themeId), unverifiedValues: 0, indicatorIds: new Set(["i1"]), assetIds: new Set(), ...over });
const ids = (result) => result.findings.map((f) => f.ruleId);

test("design check: every rule has a unique id and a plain title", () => {
  const seen = new Set();
  for (const rule of DESIGN_RULES) {
    assert.ok(!seen.has(rule.id));
    seen.add(rule.id);
    assert.ok(rule.title.length > 3);
  }
});

test("design check: a clean DONOR_REPORT passes; profile INTERNAL is lenient", () => {
  const clean = { ...base("CUSTOM"), title: "Gulu district: clean water reached families", profile: "DONOR_REPORT", themeId: "HUMANITARIAN_BLUE", acknowledgement: "With funding from Example Donor", sections: [{ kind: "KEY_MESSAGES", messages: [{ text: "Water reached 3 villages" }] }] };
  const result = checkDesign(ctx(clean));
  assert.equal(result.canPublish, true, JSON.stringify(result.findings));
  assert.deepEqual(ids(checkDesign(ctx({ ...clean, profile: "INTERNAL", title: "" }))), [], "internal designs are not nagged");
});

test("design check: generic title, acronyms, title case", () => {
  const c = { ...base("CUSTOM"), profile: "SNAPSHOT", themeId: "HUMANITARIAN_BLUE", title: "Snapshot", sections: [{ kind: "KEY_MESSAGES", title: "Where We Work Now In Gulu", messages: [{ text: "a" }] }] };
  const found = ids(checkDesign(ctx(c)));
  assert.ok(found.includes("TITLE_GENERIC"));
  assert.ok(found.includes("SENTENCE_CASE"));
  assert.ok(ids(checkDesign(ctx({ ...c, title: "WFP FSL update in Gulu" }))).includes("TITLE_ACRONYM"));
  assert.ok(!ids(checkDesign(ctx({ ...c, title: "UN update in Gulu" }))).includes("TITLE_ACRONYM"), "common acronyms pass");
});

test("design check: charts - pie slices and line count", () => {
  const chart = (type, n) => ({ kind: "CHART", chart: { template: "INDICATORS_OVER_TIME", indicatorIds: Array.from({ length: n }, (_, i) => `i${i}`), measure: "PERIOD", type } });
  const c = (section) => ({ ...base("CUSTOM"), sections: [section] });
  assert.ok(ids(checkDesign(ctx(c(chart("PIE", 6))))).includes("PIE_SLICES"));
  assert.ok(!ids(checkDesign(ctx(c(chart("PIE", 5))))).includes("PIE_SLICES"));
  assert.ok(ids(checkDesign(ctx(c(chart("LINE", 5))))).includes("TOO_MANY_LINES"));
  assert.ok(!ids(checkDesign(ctx(c(chart("LINE", 4))))).includes("TOO_MANY_LINES"));
});

test("design check: the map disclaimer is a blocker for donor reports and can be waived with a reason", () => {
  const c = { ...base("CUSTOM"), profile: "DONOR_REPORT", mapDisclaimer: false, sections: [{ kind: "MAP" }] };
  const blocked = checkDesign(ctx(c));
  assert.equal(blocked.canPublish, false);
  assert.equal(blocked.blockers[0].ruleId, "MAP_DISCLAIMER");
  const waived = checkDesign(ctx({ ...c, waivers: [{ ruleId: "MAP_DISCLAIMER", note: "Internal board pack, no borders shown" }] }));
  assert.equal(waived.canPublish, true);
  assert.equal(waived.findings.find((f) => f.ruleId === "MAP_DISCLAIMER").waived, true);
  assert.equal(checkDesign(ctx({ ...c, profile: "INTERNAL" })).canPublish, true, "only a warning for internal designs");
});

test("design check: sources, consent, assets, empty blocks, small numbers, funnel order, funding in snapshot", () => {
  const source = checkDesign(ctx({ ...base("CUSTOM"), profile: "DONOR_REPORT", sections: [{ kind: "BIG_NUMBERS", numbers: [{ source: "MANUAL", label: "In need", value: "1.2 million" }] }] }));
  assert.ok(source.blockers.some((b) => b.ruleId === "SOURCE_MISSING"));
  const consent = checkDesign(ctx({ ...base("CUSTOM"), profile: "SOCIAL", sections: [{ kind: "IMAGE", assetId: "a1" }] }, { assetIds: new Set(["a1"]) }));
  assert.ok(consent.blockers.some((b) => b.ruleId === "PHOTO_CONSENT"));
  assert.ok(!checkDesign(ctx({ ...base("CUSTOM"), profile: "SOCIAL", sections: [{ kind: "IMAGE", assetId: "a1", consentConfirmed: true, altText: "A well" }] }, { assetIds: new Set(["a1"]) })).blockers.length);
  assert.ok(checkDesign(ctx({ ...base("CUSTOM"), sections: [{ kind: "IMAGE", assetId: "gone", consentConfirmed: true }] })).blockers.some((b) => b.ruleId === "ASSET_MISSING"));
  assert.ok(ids(checkDesign(ctx({ ...base("CUSTOM"), sections: [{ kind: "KEY_MESSAGES" }] }))).includes("EMPTY_BLOCK"));
  assert.ok(ids(checkDesign(ctx({ ...base("CUSTOM"), sections: [{ kind: "REACH" }] }, { smallestReachCell: 3 }))).includes("SMALL_NUMBERS"));
  assert.ok(!ids(checkDesign(ctx({ ...base("CUSTOM"), sections: [{ kind: "REACH" }] }, { smallestReachCell: 12 }))).includes("SMALL_NUMBERS"));
  assert.ok(ids(checkDesign(ctx({ ...base("CUSTOM"), sections: [{ kind: "FUNNEL", stages: [{ label: "a", value: 10, sourceNote: "x" }, { label: "b", value: 20, sourceNote: "x" }] }] }))).includes("FUNNEL_ORDER"));
  assert.ok(ids(checkDesign(ctx({ ...base("CUSTOM"), profile: "SNAPSHOT", sections: [{ kind: "FUNDING" }] }))).includes("DASHBOARD_DATA_IN_SNAPSHOT"));
  assert.ok(ids(checkDesign(ctx({ ...base("CUSTOM"), sections: [{ kind: "TEXT" }] }, { unverifiedValues: 2 }))).includes("UNVERIFIED_VALUES"));
  assert.ok(ids(checkDesign(ctx({ ...base("CUSTOM"), sections: [{ kind: "KPIS", indicatorIds: ["zzz"] }] }))).includes("INDICATOR_GONE"));
});

test("design check: hidden sections are not checked; findings sort worst first", () => {
  const c = { ...base("CUSTOM"), profile: "DONOR_REPORT", sections: [{ kind: "KEY_MESSAGES", hidden: true }, { kind: "MAP" }], mapDisclaimer: false };
  const result = checkDesign(ctx(c));
  assert.ok(!ids(result).includes("EMPTY_BLOCK"));
  assert.equal(result.findings[0].severity, "BLOCKER");
});

test("design check: the low-contrast classic theme is flagged for donor reports only", () => {
  const donor = checkDesign(ctx({ ...base("CUSTOM"), profile: "DONOR_REPORT", themeId: "DEFAULT", sections: [{ kind: "TEXT" }] }));
  assert.ok(ids(donor).includes("CONTRAST"));
  assert.ok(!ids(checkDesign(ctx({ ...base("CUSTOM"), profile: "DONOR_REPORT", themeId: "HIGH_CONTRAST", sections: [{ kind: "TEXT" }] }))).includes("CONTRAST"));
});

const facts = { projectTitle: "Clean Water", country: "Uganda", locations: ["Gulu", "Kitgum", "Pader"], reachUnique: 21345, activitiesDone: 14, activitiesPlanned: 19, financeEnabled: false, indicators: [{ name: "Boreholes rehabilitated", value: "86", target: "120", percentOfTarget: 71.6, isRate: false }, { name: "Latrine use", value: "64%", isRate: true }] };

test("suggestions: headlines and messages only state figures from the facts", () => {
  const h = suggestHeadlines(facts, "en");
  assert.equal(h[0].text, "21,345 people reached in Uganda");
  assert.ok(h.some((s) => /14 of 19 planned activities completed in Uganda/.test(s.text)));
  assert.ok(h.some((s) => /Boreholes rehabilitated: 72% of the target reached/.test(s.text)));
  assert.equal(suggestHeadlines(facts, "en", "THOUSANDS")[0].text, "21,000 people reached in Uganda");
  assert.match(suggestHeadlines(facts, "fr")[0].text, /personnes atteintes en Uganda/);
  const allowed = new Set(["21,345", "14", "19", "86", "120", "72", "3", "64", "71", "21", "345"]);
  for (const m of suggestKeyMessages(facts, "en")) for (const n of m.text.match(/\d[\d,]*/g) ?? []) assert.ok(allowed.has(n) || allowed.has(n.replace(/,/g, "")), `${n} in “${m.text}” is in the facts`);
  const msgs = suggestKeyMessages(facts, "en").map((m) => m.text);
  assert.ok(msgs.some((m) => /against a target of 120 \(72%\)/.test(m)));
  assert.ok(!msgs.some((m) => /Latrine use: 64%.*target/.test(m)), "a rate never gets a percent of target");
  assert.ok(msgs.some((m) => /3 locations, including Gulu, Kitgum, Pader/.test(m)));
  assert.equal(suggestHeadlines({ ...facts, reachUnique: 0, activitiesDone: 0, indicators: [] }, "en")[0].text, "Clean Water", "nothing recorded: the title");
});

test("suggestions: templates follow what the project holds", () => {
  assert.equal(suggestTemplates({ ...facts }).length, 3);
  assert.equal(suggestTemplates({ projectTitle: "x", locations: [], reachUnique: 0, activitiesDone: 0, activitiesPlanned: 0, financeEnabled: false, indicators: [] })[0].templateId, "OVERVIEW");
  assert.ok(suggestTemplates({ ...facts, financeEnabled: true, reachUnique: 0, indicators: [], locations: [] }).some((s) => s.templateId === "FUNDING_SNAPSHOT"));
});

test("workflow: statuses move only along the table; edits return an approved design to draft", () => {
  assert.equal(nextStatus("DRAFT", "REQUEST_REVIEW"), "IN_REVIEW");
  assert.equal(nextStatus("IN_REVIEW", "APPROVE"), "APPROVED");
  assert.equal(nextStatus("APPROVED", "EDIT"), "DRAFT");
  assert.equal(nextStatus("DRAFT", "APPROVE"), undefined, "no approving what nobody reviewed");
  assert.equal(canApplyDesignAction("APPROVED", "REQUEST_REVIEW"), false);
  for (const s of DESIGN_STATUSES) assert.ok(canApplyDesignAction(s, "EDIT"));
});

test("workflow: second approver rule, self-approval only when nobody else can", () => {
  assert.deepEqual(checkDesignApprover({ approverId: "a", requestedById: "b", otherApproversExist: true }), { allowed: true, self: false });
  assert.equal(checkDesignApprover({ approverId: "a", requestedById: "a", otherApproversExist: true }).allowed, false);
  assert.deepEqual(checkDesignApprover({ approverId: "a", requestedById: "a", otherApproversExist: false }), { allowed: true, self: true });
});

test("share links: expiry is clamped and a revoked or expired link is not live", () => {
  const now = new Date("2026-10-25T00:00:00Z");
  assert.equal(shareLinkExpiry(now, undefined).toISOString(), "2026-11-24T00:00:00.000Z");
  assert.equal(shareLinkExpiry(now, 0).toISOString(), "2026-10-26T00:00:00.000Z");
  assert.equal(shareLinkExpiry(now, 999).toISOString(), "2027-01-23T00:00:00.000Z");
  assert.equal(isShareLinkLive({ expiresAt: new Date("2026-10-26T00:00:00Z") }, now), true);
  assert.equal(isShareLinkLive({ expiresAt: new Date("2026-10-24T00:00:00Z") }, now), false);
  assert.equal(isShareLinkLive({ expiresAt: new Date("2026-10-26T00:00:00Z"), revokedAt: now }, now), false);
});

test("brand kit: validated, and the derived theme always reads at 4.5:1", () => {
  assert.equal(validateBrandKit({ primaryColor: "red" }).ok, false);
  assert.equal(validateBrandKit({ primaryColor: "#FFAA00", secondaryColor: "nope" }).ok, false);
  assert.equal(validateBrandKit({ primaryColor: "#FFAA00", partnerLogoAssetIds: Array(7).fill("a") }).ok, false);
  const kit = validateBrandKit({ primaryColor: "#FFD400", secondaryColor: "#AEE6FF", footerLine: " www.example.org " });
  assert.equal(kit.ok, true);
  assert.equal(kit.value.primaryColor, "#ffd400");
  assert.equal(kit.value.footerLine, "www.example.org");
  const theme = themeFromBrand(kit.value);
  assert.equal(theme.id, "BRAND");
  assert.ok(contrastRatio(theme.accent, theme.card) >= 4.5, "a pale yellow is darkened until text in it reads");
  assert.ok(contrastRatio(theme.accent2, theme.card) >= 4.5);
  assert.equal(theme.palette[0], theme.accent);
  assert.equal(readableOn("#000000", "#ffffff"), "#000000", "an already readable colour is untouched");
  assert.equal(resolveTheme("BRAND", theme).accent, theme.accent);
  assert.equal(resolveTheme("BRAND").id, "DEFAULT", "no kit: classic look");
  assert.equal(INFOGRAPHIC_THEMES.HIGH_CONTRAST.id, "HIGH_CONTRAST");
});

import { PORTFOLIO_KINDS, PORTFOLIO_PROJECT_ID } from "../dist/index.js";

test("portfolio designs: only portfolio-safe blocks, and portfolio blocks only in a portfolio design", () => {
  const portfolio = configFromTemplate("PORTFOLIO_OVERVIEW");
  assert.equal(portfolio.scope, "PORTFOLIO");
  assert.equal(v(portfolio).ok, true);
  assert.equal(v(portfolio).value.scope, "PORTFOLIO");
  const withProjectBlock = v({ ...portfolio, sections: [...portfolio.sections, { kind: "PROGRESS_RINGS" }] });
  assert.equal(withProjectBlock.ok, false);
  assert.match(withProjectBlock.error.message, /portfolio design/);
  const project = v({ ...base("CUSTOM"), sections: [{ kind: "PORTFOLIO_TABLE" }] });
  assert.equal(project.ok, false);
  assert.match(project.error.message, /belong in a portfolio design/);
  assert.equal(v({ ...base("CUSTOM"), scope: "EVERYTHING" }).ok, false);
  assert.equal("scope" in v({ ...base("CUSTOM"), scope: "PROJECT" }).value, false, "the default is not stored");
  assert.equal(PORTFOLIO_PROJECT_ID, "portfolio");
  for (const kind of ["MAP", "HERO", "BIG_NUMBERS", "TEXT", "PORTFOLIO_SUMMARY"]) assert.ok(PORTFOLIO_KINDS.has(kind), kind);
  assert.equal(PORTFOLIO_KINDS.has("FUNDING"), false);
});

test("who does what, where: rows are cleaned and bounded; a matrix without a source is flagged", () => {
  const ok = v({ ...base("CUSTOM"), profile: "DONOR_REPORT", sections: [{ kind: "THREE_W", presence: [{ who: "  Water Aid ", what: "Boreholes", where: ["Gulu", "Gulu", " Kitgum "] }, { who: "   ", what: "x", where: [] }] }] });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value.sections[0].presence, [{ who: "Water Aid", what: "Boreholes", where: ["Gulu", "Kitgum"] }], "blank rows and repeated places are dropped");
  assert.equal(v({ ...base("CUSTOM"), sections: [{ kind: "THREE_W", presence: Array.from({ length: 17 }, (_, i) => ({ who: `o${i}`, what: "", where: [] })) }] }).ok, false);
  assert.equal(v({ ...base("CUSTOM"), sections: [{ kind: "THREE_W", presence: [{ who: "a", what: "b", where: Array.from({ length: 9 }, (_, i) => `p${i}`) }] }] }).ok, false);
  const flagged = checkDesign({ config: ok.value, theme: resolveTheme("HUMANITARIAN_BLUE"), unverifiedValues: 0, indicatorIds: new Set(), assetIds: new Set() });
  assert.ok(flagged.blockers.some((b) => b.ruleId === "SOURCE_MISSING" && /who-does-what-where/.test(b.message)));
  const sourced = checkDesign({ config: { ...ok.value, sections: [{ ...ok.value.sections[0], caption: "Partner reports, Sept 2026" }] }, theme: resolveTheme("HUMANITARIAN_BLUE"), unverifiedValues: 0, indicatorIds: new Set(), assetIds: new Set() });
  assert.equal(sourced.blockers.length, 0);
  const empty = checkDesign({ config: { ...base("CUSTOM"), sections: [{ kind: "THREE_W" }] }, theme: resolveTheme("DEFAULT"), unverifiedValues: 0, indicatorIds: new Set(), assetIds: new Set() });
  assert.ok(empty.findings.some((f) => f.ruleId === "EMPTY_BLOCK"));
});

test("Arabic is a full language: labels, right-to-left, UN disclaimer, suggestions", () => {
  assert.ok(INFOGRAPHIC_LANGUAGES.includes("ar"));
  assert.equal(isRtl("ar"), true);
  assert.equal(isRtl("fr"), false);
  assert.match(UN_MAP_DISCLAIMER.ar, /الأمم المتحدة/);
  assert.match(suggestHeadlines({ projectTitle: "x", country: "أوغندا", locations: [], reachUnique: 5, activitiesDone: 0, activitiesPlanned: 0, financeEnabled: false, indicators: [] }, "ar")[0].text, /تم الوصول إلى 5 شخص في أوغندا/);
  assert.match(formatNumber(21345, "ar"), /^21,345$/, "Western digits, as UN products print them");
  assert.deepEqual(borderNotesFor("Sudan", "ar").map((n) => n.id).sort(), ["ABYEI", "SUDAN_SOUTH_SUDAN"]);
});

test("AI text keeps only sentences whose figures the records hold", async () => {
  const { groundAiText, buildAiTextPrompt } = await import("../dist/index.js");
  const facts = { projectTitle: "Clean water", country: "Sudan", locations: ["Kassala"], reachUnique: 1234, activitiesDone: 5, activitiesPlanned: 8, financeEnabled: false, indicators: [{ name: "Wells", value: "12", target: "20", percentOfTarget: 60, isRate: false }] };
  const out = groundAiText(JSON.stringify({ headlines: ["About 1,200 people reached in Sudan", "9,999 people reached"], messages: ["5 of 8 activities are done.", "Wells: 60% of the target."] }), facts);
  assert.deepEqual(out.headlines.map((h) => h.text), ["About 1,200 people reached in Sudan"]);
  assert.equal(out.messages.length, 2);
  assert.equal(out.droppedUngrounded, 1);
  assert.equal(groundAiText("not json", facts).headlines.length, 0);
  assert.match(buildAiTextPrompt(facts, "fr").system, /Français/);
});

test("AI text is salvaged when the reply is cut off at the output token limit (observed in production with a reasoning model)", async () => {
  const { groundAiText } = await import("../dist/index.js");
  const facts = { projectTitle: "Clean water", country: "Sudan", locations: ["Kassala"], reachUnique: 1234, activitiesDone: 5, activitiesPlanned: 8, financeEnabled: false, indicators: [] };
  // No closing brace or bracket anywhere: the model's budget ran out mid-reply.
  const truncated = '{"headlines":["1,234 people reached in Sudan"],"messages":["5 of 8 activities are done';
  const out = groundAiText(truncated, facts);
  assert.deepEqual(out.headlines.map((h) => h.text), ["1,234 people reached in Sudan"]);
  assert.deepEqual(out.messages.map((m) => m.text), ["5 of 8 activities are done"]);
});
