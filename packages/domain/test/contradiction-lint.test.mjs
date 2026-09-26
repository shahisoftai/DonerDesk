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
