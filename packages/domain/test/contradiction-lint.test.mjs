import assert from "node:assert/strict";
import test from "node:test";

import {
  lintReportContradictions,
  calculateReadiness,
  DATA_QUALITY_PENALTY,
} from "../dist/index.js";

const findings = [
  {
    indicatorCode: "OUT-5",
    value: "2500",
    target: "2500",
    qualityFlags: [],
  },
  {
    indicatorCode: "OUT-7",
    value: "0",
    target: "600",
    qualityFlags: ["MISSING_DENOMINATOR"],
  },
];

function sections(...pairs) {
  return pairs.map(([title, content], i) => ({ id: `s-${i}`, title, content }));
}

test("prose figure matching no verified record is a BLOCKER", () => {
  const result = lintReportContradictions({
    sections: sections(["Overview", "A total of 5,600 children were attending regularly across the quarter."]),
    findings,
  });
  assert.equal(result.blockers, 1);
  assert.equal(result.findings[0].kind, "PROSE_VALUE_NOT_IN_VERIFIED_DATA");
  assert.match(result.findings[0].detail, /5,600/);
  assert.match(result.findings[0].detail, /reviewer note cannot resolve/);
});

test("figures present in findings, targets, updates, or activities are accepted", () => {
  const result = lintReportContradictions({
    sections: sections([
      "Overview",
      [
        "OUT-5 recorded 2,500 children enrolled against a target of 2,500.",
        "The update log quotes 1,200 learners.",
        "Staff trained 80 facilitators.",
      ].join(" "),
    ]),
    findings,
    recordedValues: [{ indicatorCode: "OUT-9", texts: ["1,200 learners reached"] }],
    activities: [{ title: "ToT", participantNumbers: [80] }],
  });
  assert.equal(result.blockers, 0, JSON.stringify(result.findings));
});

test("percentage without calculable basis is a BLOCKER; derivable percentage is accepted", () => {
  const result = lintReportContradictions({
    sections: sections([
      "Overview",
      "Coverage reached 87% of the planned districts. Beneficiaries trained equalled 85% of the annual target.",
    ]),
    findings: [
      ...findings,
      { indicatorCode: "IND-2", value: "850", target: "1000", qualityFlags: [] },
    ],
  });
  const kinds = result.findings.map((f) => f.kind);
  assert.ok(kinds.includes("PERCENTAGE_WITHOUT_BASIS"), JSON.stringify(result.findings));
  assert.equal(result.findings.filter((f) => f.kind === "PERCENTAGE_WITHOUT_BASIS").length, 1);
  assert.equal(result.findings[0].excerpt.includes("87%"), true);
});


test("same quantity quoted with 3+ distinct values is a BLOCKER across sections", () => {
  const result = lintReportContradictions({
    sections: sections(
      ["Overview", "The project operates 30 learning centres."],
      ["Activities", "Supplies were distributed to 45 learning centres."],
      ["Annex", "Reports were collected from 75 learning centres."],
    ),
    findings,
  });
  const divergence = result.findings.filter((f) => f.kind === "SAME_METRIC_DIVERGENCE");
  assert.equal(divergence.length, 1);
  assert.equal(divergence[0].severity, "BLOCKER");
  assert.match(divergence[0].detail, /30/);
  assert.match(divergence[0].detail, /45/);
  assert.match(divergence[0].detail, /75/);
});

test("two distinct values warn, delta phrasing is exempt", () => {
  const warned = lintReportContradictions({
    sections: sections(["A", "The project runs 30 learning centres."], ["B", "Books reached 45 learning centres."]),
    findings,
  });
  assert.deepEqual(
    warned.findings.filter((f) => f.kind === "SAME_METRIC_DIVERGENCE").map((f) => f.severity),
    ["WARNING"],
  );

  const exempt = lintReportContradictions({
    sections: sections(["A", "Functional centres increased from 30 to 45 during the period."]),
    findings,
  });
  assert.equal(exempt.findings.filter((f) => f.kind === "SAME_METRIC_DIVERGENCE").length, 0);
});

test("out-of-period dates warn; in-period dates stay silent", () => {
  const result = lintReportContradictions({
    sections: sections(["Activities", "The training on 28 February 2026 preceded this quarter; review closed on 2026-05-30."]),
    findings,
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-06-30T00:00:00.000Z",
  });
  const dates = result.findings.filter((f) => f.kind === "OUT_OF_PERIOD_DATE");
  assert.equal(dates.length, 1);
  assert.equal(dates[0].severity, "WARNING");
  assert.match(dates[0].detail, /28 February 2026/);
});

test("gender figures quoted while all findings lack disaggregation is a BLOCKER", () => {
  const result = lintReportContradictions({
    sections: sections(["Overview", "The project reached 1,320 girls and 1,180 boys."]),
    findings: [{ indicatorCode: "OUT-5", value: "2500", qualityFlags: ["MISSING_DISAGGREGATION"] }],
  });
  assert.ok(result.findings.some((f) => f.kind === "DISAGGREGATION_CONTRADICTION" && f.severity === "BLOCKER"));
});

test("table rows, provenance lines, indicator codes, and years are exempt", () => {
  const result = lintReportContradictions({
    sections: sections([
      "Annex A",
      [
        "| Code | Indicator | Value | Target | RAG |",
        "|------|-----------|-------|--------|-----|",
        "| OUT-5 | Enrolment | 2,500 | 2,500 | GREEN |",
        "| OUT-7 | Coverage | 0 | 600 | GREY |",
        "",
        "Source: Field reports, HMIS data, education cluster assessments (2026).",
        "Since the 2021 baseline the programme expanded; see OUT-5 and OUT-7.",
      ].join("\n"),
    ]),
    findings,
  });
  assert.equal(result.blockers, 0, JSON.stringify(result.findings));
});

test("blockquoted beneficiary speech is exempt from value checks", () => {
  const result = lintReportContradictions({
    sections: sections(["Beneficiary Voice", '> "Before the project we walked 7 kilometres for water," one participant said.']),
    findings,
  });
  assert.equal(result.blockers, 0, JSON.stringify(result.findings));
});

test("empty and clean inputs lint clean", () => {
  const empty = lintReportContradictions({ sections: [] });
  assert.deepEqual(empty, { findings: [], blockers: 0, warnings: 0 });
  const clean = lintReportContradictions({
    sections: sections(["Overview", "OUT-5 recorded 2,500 children enrolled."]),
    findings,
  });
  assert.equal(clean.blockers, 0);
});

test("readiness: legacy callers get identical overall; blockers degrade quality and cap overall", () => {
  const base = {
    totalSections: 9,
    approvedSections: 9,
    totalIndicators: 20,
    verifiedIndicators: 20,
    requiredEvidenceCount: 5,
    attachedEvidenceCount: 5,
    totalChecklistItems: 38,
    resolvedOrAcceptedItems: 38,
    approvalProgress: 100,
  };
  const legacy = calculateReadiness(base);
  assert.equal(legacy.overall, 100);
  assert.equal(legacy.qualityScore, 100);
  assert.equal(legacy.dataQualityBlockers, 0);

  const degraded = calculateReadiness({ ...base, dataQualityBlockers: 6 });
  assert.equal(degraded.dataQualityBlockers, 6);
  assert.equal(degraded.qualityScore, Math.max(0, 100 - 6 * DATA_QUALITY_PENALTY));
  assert.equal(degraded.overall, Math.min(100, degraded.qualityScore));
});

import { toLintFindingData } from "../dist/index.js";

// ── a roll-up report quotes life-of-project totals, breakdowns, finance and record figures ──

const lifeFinding = toLintFindingData({
  indicatorCode: "IND-1", value: "240", target: "1200", baseline: "0", unit: "children", qualityFlags: [],
  cumulativeValue: "1260",
  lifeOfProject: { value: "1260", disaggregation: [{ value: "656" }, { value: "604" }] },
  disaggregation: [{ value: "125" }, { value: "115" }],
});
const quote = (content, extra = {}) => lintReportContradictions({ sections: [{ id: "s1", title: "Results", content }], findings: [lifeFinding], ...extra });
const states = (r) => r.findings.filter((f) => f.severity === "BLOCKER").map((f) => f.kind);

test("life-of-project totals, their percent of target and both breakdowns are quotable", () => {
  const r = quote("Enrolment closed at 1,260 children against a target of 1,200, or 105% of target, with 656 female and 604 male; the August figure of 240 comprised 125 female and 115 male.");
  assert.deepEqual(states(r), []);
});

test("a figure that is in no record is still a contradiction", () => {
  const r = quote("Enrolment closed at 1,500 children, with 700 female and 800 male.");
  assert.ok(states(r).includes("PROSE_VALUE_NOT_IN_VERIFIED_DATA"));
});

test("figures the project's own records state (budget, finance, counts) are quotable plain or as a percent", () => {
  const text = "The project closed with expenditure of 407400 USD against a budget of 420000 USD, a burn rate of 97%, with 30 activity records.";
  assert.ok(states(quote(text)).length > 0, "unknown without grounding");
  assert.deepEqual(states(quote(text, { groundedFigures: ["407400", "420000", "97", "30"] })), []);
});

test("evidence ids cited in prose are not figures", () => {
  const text = "- A1.1 field report (evidenceId: d050b4a0-5886-4525-b04f-905804496ea0) and the review (ea438d3b), verified.";
  assert.deepEqual(states(quote(text)), []);
});

test("different figures for 'female' or 'target' are different metrics, not a divergence", () => {
  const r = lintReportContradictions({
    sections: [
      { id: "a", title: "Activities", content: "Caregiver sessions reached 35 female participants." },
      { id: "b", title: "Summary", content: "Enrolment included 656 female children." },
      { id: "c", title: "Other", content: "Teacher training included 33 female teachers." },
    ],
    groundedFigures: ["35", "656", "33"],
  });
  assert.deepEqual(r.findings.filter((f) => f.kind === "SAME_METRIC_DIVERGENCE"), []);
});

test("an age range is a description of the children, not an achievement", () => {
  const r = lintReportContradictions({
    sections: [{ id: "s", title: "Background", content: "The project enrolled children aged 6-14 and later 12 to 17 years old; participants were aged 15." }],
  });
  assert.deepEqual(r.findings.filter((f) => f.severity === "BLOCKER"), []);
  const real = lintReportContradictions({ sections: [{ id: "s", title: "Results", content: "The project enrolled 6000 children." }] });
  assert.ok(real.findings.some((f) => f.kind === "PROSE_VALUE_NOT_IN_VERIFIED_DATA"), "a real unsupported figure is still caught");
});

test("a month's figure and the life-of-project figure for the same quantity are not a divergence (demo 4)", () => {
  const grounded = ["2800", "14000"];
  const r = lintReportContradictions({
    sections: [
      { id: "a", title: "Results", content: "In August, 2,800 people reached safe water this month." },
      { id: "b", title: "Summary", content: "Over the life of the project, 14,000 people reached safe water." },
    ],
    findings: [],
    groundedFigures: grounded,
  });
  assert.equal(r.findings.filter((f) => f.kind === "SAME_METRIC_DIVERGENCE").length, 0);
});

test("two different life-of-project figures for the same quantity still diverge, and two month figures too", () => {
  const life = lintReportContradictions({
    sections: [
      { id: "a", title: "Results", content: "In total, 14,000 people reached safe water." },
      { id: "b", title: "Summary", content: "To date, 12,000 people reached safe water." },
    ],
    findings: [],
    groundedFigures: ["14000", "12000"],
  });
  const diverged = life.findings.filter((f) => f.kind === "SAME_METRIC_DIVERGENCE");
  assert.equal(diverged.length, 1);
  assert.match(diverged[0].detail, /life of the project/);
  const month = lintReportContradictions({
    sections: [
      { id: "a", title: "Results", content: "This month 2,800 people reached safe water." },
      { id: "b", title: "Summary", content: "This month 2,500 people reached safe water." },
    ],
    findings: [],
    groundedFigures: ["2800", "2500"],
  });
  assert.equal(month.findings.filter((f) => f.kind === "SAME_METRIC_DIVERGENCE").length, 1);
});

test("a written date is never read as a figure: no '31,' from 'August 31, 2026' or 'as of August 31'", () => {
  for (const text of [
    "The final round of testing was completed on August 31, 2026 across all sites.",
    "As of August 31, the project had reached every committee.",
    "Handover took place on 31 August with all committees present.",
    "The work was signed off by 31 August.",
  ]) {
    const r = lintReportContradictions({ sections: [{ id: "a", title: "Summary", content: text }], findings: [] });
    assert.deepEqual(r.findings.filter((f) => f.kind === "PROSE_VALUE_NOT_IN_VERIFIED_DATA"), [], text);
  }
});

test("a figure followed by a comma is read without the comma", () => {
  const r = lintReportContradictions({ sections: [{ id: "a", title: "Summary", content: "The project built 24 water points, which serve every village." }], findings: [], groundedFigures: ["24"] });
  assert.deepEqual(r.findings, []);
});

test("an award number is an identifier, not a figure (demo 6: Introduction blocked approval)", () => {
  const result = lintReportContradictions({
    sections: sections(["Introduction", "This report covers a USAID-funded cooperative agreement (award no. 72061526CA00012) in Turkana."]),
    findings,
  });
  assert.equal(result.blockers, 0, JSON.stringify(result.findings));
  const stray = lintReportContradictions({
    sections: sections(["Overview", "A total of 5,600 children were attending regularly."]),
    findings,
  });
  assert.equal(stray.blockers, 1);
});
