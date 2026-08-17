#!/usr/bin/env node
// Generate 3 realistic demo donor report templates for the demo-tenant.
//
// Outputs, per template, into storage/demo-tenant/demo-content/:
//   - <slug>.docx  — a real Word document (heading structure + guidance text),
//     parseable by TolerantDocumentParser (mammoth) and section-extractable by
//     StubTemplateExtractionService.
//   - <slug>.txt   — the plain-text rendering (what mammoth would extract).
//   - <slug>.json  — the canonical section list + template metadata, ready to
//     import into DonorTemplate.sectionsJson (all required sections REVIEWED so
//     the reporting-period readiness gate passes).
//
// Run from packages/infrastructure so the `docx` dependency resolves:
//   node scripts/generate-demo-templates.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
} from "docx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "..", "..", "storage", "demo-tenant", "demo-content");

const SECTION_TYPE_HINTS = {
  NARRATIVE: "narrative",
  TABLE: "table",
  ANNEX: "annex",
  INDICATOR_TABLE: "indicator table",
  COMPLIANCE: "compliance",
};

const TEMPLATES = [
  {
    slug: "01-echo-narrative-report",
    templateName: "EU ECHO Narrative Report",
    donorName: "European Civil Protection and Humanitarian Aid Operations (ECHO)",
    reportType: "QUARTERLY",
    language: "en",
    notes:
      "Quarterly narrative report modelled on the EU ECHO humanitarian narrative reporting convention (single form style). Requires the intervention logframe, F4 financial statement, and distribution evidence.",
    requiredAnnexes: [
      "Intervention logframe / results framework",
      "Financial statement (F4)",
      "Distribution lists",
      "Photographs (captioned)",
    ],
    sections: [
      { title: "Executive Summary", description: "Overview of the period and headline results.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Activity summaries", minWords: 200, maxWords: 400 },
      { title: "Context and Situation Analysis", description: "Updates to the humanitarian context affecting the action.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Situation reports, assessments", minWords: 300, maxWords: 500 },
      { title: "Progress Against Results", description: "Progress against each outcome/output in the intervention logframe.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Monitoring reports, logframe tracker", minWords: 500, maxWords: 800 },
      { title: "Activities Implemented", description: "Activities delivered this period, linked to results.", inputType: "TABLE", required: true, evidenceNeeded: "Activity updates, attendance sheets", minWords: 200, maxWords: 500 },
      { title: "Indicator Progress", description: "Indicator achievements versus baselines and targets.", inputType: "INDICATOR_TABLE", required: true, evidenceNeeded: "Verified indicator data", minWords: 100, maxWords: 300 },
      { title: "Beneficiaries Reached", description: "Disaggregation by sex, age, and disability.", inputType: "TABLE", required: true, evidenceNeeded: "Attendance sheets, distribution lists", minWords: 100, maxWords: 300 },
      { title: "Cross-Cutting Issues", description: "Gender, protection, disability, and environment integration.", inputType: "COMPLIANCE", required: true, evidenceNeeded: "Safeguarding and inclusion checklists", minWords: 200, maxWords: 400 },
      { title: "Challenges and Corrective Actions", description: "Challenges, deviations from the plan, and corrective actions.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Field reports, meeting minutes", minWords: 200, maxWords: 500 },
      { title: "Lessons Learned and Best Practices", description: "Insights and adaptations for future implementation.", inputType: "NARRATIVE", required: false, evidenceNeeded: "", minWords: 100, maxWords: 300 },
      { title: "Coordination and Partnerships", description: "Coordination with authorities, clusters, and partners.", inputType: "NARRATIVE", required: false, evidenceNeeded: "", minWords: 100, maxWords: 300 },
      { title: "Communication and Visibility", description: "Visibility actions funded under the grant.", inputType: "NARRATIVE", required: false, evidenceNeeded: "", minWords: 50, maxWords: 200 },
      { title: "Annex List", description: "List of attached supporting documents.", inputType: "ANNEX", required: true, evidenceNeeded: "All verified evidence", minWords: 20, maxWords: 100 },
    ],
  },
  {
    slug: "02-usaid-performance-progress-report",
    templateName: "USAID Performance Progress Report",
    donorName: "United States Agency for International Development (USAID)",
    reportType: "QUARTERLY",
    language: "en",
    notes:
      "Quarterly performance progress report (PPR) modelled on the USAID progress-reporting convention, with a standard indicator table against baselines and targets.",
    requiredAnnexes: [
      "Disaggregated indicator data table",
      "Work plan update",
      "Success story (1-2 pages)",
    ],
    sections: [
      { title: "Executive Summary", description: "Concise summary of progress, results, and priorities.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Activity summaries", minWords: 200, maxWords: 300 },
      { title: "Implementation Status vs Work Plan", description: "Status of implementation against the approved work plan.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Work plan tracker", minWords: 400, maxWords: 600 },
      { title: "Performance Against Indicators", description: "Indicator results with baseline, target, and actuals.", inputType: "INDICATOR_TABLE", required: true, evidenceNeeded: "Verified indicator data", minWords: 100, maxWords: 300 },
      { title: "Major Activities and Outputs", description: "Major activities completed and outputs produced.", inputType: "TABLE", required: true, evidenceNeeded: "Activity updates, deliverables", minWords: 200, maxWords: 500 },
      { title: "Beneficiary Reach and Disaggregation", description: "Beneficiaries reached, disaggregated by sex and age.", inputType: "TABLE", required: true, evidenceNeeded: "Attendance sheets, distribution lists", minWords: 100, maxWords: 300 },
      { title: "Success Stories", description: "Brief success stories demonstrating results.", inputType: "NARRATIVE", required: false, evidenceNeeded: "Case studies, photographs", minWords: 150, maxWords: 400 },
      { title: "Challenges and Lessons Learned", description: "Challenges encountered, lessons learned, and adjustments.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Field reports, meeting minutes", minWords: 200, maxWords: 500 },
      { title: "Financial Status and Expenditure", description: "Expenditure against budget for the period.", inputType: "TABLE", required: false, evidenceNeeded: "Financial records", minWords: 50, maxWords: 200 },
      { title: "Planned Activities for Next Period", description: "Planned activities for the coming reporting period.", inputType: "NARRATIVE", required: true, evidenceNeeded: "", minWords: 150, maxWords: 400 },
      { title: "Annex List", description: "List of attached supporting documents.", inputType: "ANNEX", required: true, evidenceNeeded: "All verified evidence", minWords: 20, maxWords: 100 },
    ],
  },
  {
    slug: "03-institutional-donor-annual-report",
    templateName: "Institutional Donor Annual Narrative Report",
    donorName: "International Institutional Donor",
    reportType: "ANNUAL",
    language: "en",
    notes:
      "Annual narrative report modelled on institutional donor (FCDO/UKRI-style) annual review conventions, including financial summary, risk management, and sustainability.",
    requiredAnnexes: [
      "Logframe",
      "Annual financial statement",
      "Baseline and endline survey reports",
      "Photographs with captions",
    ],
    sections: [
      { title: "Cover Sheet and Project Identification", description: "Grant reference, project title, dates, and implementing partner.", inputType: "NARRATIVE", required: true, evidenceNeeded: "", minWords: 50, maxWords: 150 },
      { title: "Executive Summary", description: "Overview of the year's achievements against the logframe.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Activity summaries", minWords: 300, maxWords: 500 },
      { title: "Progress Against Project Outcomes", description: "Narrative progress against each outcome.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Monitoring and evaluation reports", minWords: 600, maxWords: 900 },
      { title: "Outputs and Key Activities", description: "Outputs delivered and key activities implemented.", inputType: "TABLE", required: true, evidenceNeeded: "Activity updates, deliverables", minWords: 200, maxWords: 500 },
      { title: "Indicator Results Table", description: "Indicator results with baselines, targets, and actuals.", inputType: "INDICATOR_TABLE", required: true, evidenceNeeded: "Verified indicator data, survey reports", minWords: 100, maxWords: 300 },
      { title: "Beneficiaries Reached", description: "Beneficiary counts and disaggregation.", inputType: "TABLE", required: true, evidenceNeeded: "Attendance sheets, distribution lists", minWords: 100, maxWords: 300 },
      { title: "Financial Summary", description: "Expenditure against budget with variance notes.", inputType: "TABLE", required: false, evidenceNeeded: "Financial records", minWords: 50, maxWords: 200 },
      { title: "Risk Management and Mitigation", description: "Key risks and how they were mitigated.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Risk register", minWords: 200, maxWords: 500 },
      { title: "Lessons Learned", description: "Lessons learned and recommendations.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Evaluation and review reports", minWords: 200, maxWords: 400 },
      { title: "Sustainability and Exit Strategy", description: "Sustainability of results and handover planning.", inputType: "NARRATIVE", required: false, evidenceNeeded: "", minWords: 150, maxWords: 400 },
      { title: "Communication and Visibility", description: "Visibility and communication activities.", inputType: "NARRATIVE", required: false, evidenceNeeded: "", minWords: 50, maxWords: 200 },
      { title: "Annex List", description: "List of attached supporting documents.", inputType: "ANNEX", required: true, evidenceNeeded: "All verified evidence", minWords: 20, maxWords: 100 },
    ],
  },
];

function guidanceFor(section) {
  const type = SECTION_TYPE_HINTS[section.inputType] ?? "narrative";
  const limit =
    section.minWords !== undefined || section.maxWords !== undefined
      ? ` (${[section.minWords, section.maxWords]
          .filter((n) => n !== undefined)
          .map((n, i) => (i === 0 ? `min ${n} words` : `max ${n} words`))
          .join(", ")})`
      : "";
  return `Instructions: provide a ${type}${limit}. ${section.description}`;
}

function placeholderFor(section) {
  if (section.inputType === "INDICATOR_TABLE") {
    return "Table: Indicator | Baseline | Target | Actual | Unit | Status";
  }
  if (section.inputType === "TABLE") {
    return "Table: Item | Detail | Quantity | Evidence";
  }
  if (section.inputType === "ANNEX") {
    return "List the attached annexes below.";
  }
  return "[Write section content here. Claims must be supported by verified evidence.]";
}

function buildRows(headers, rows) {
  return [
    new TableRow({
      children: headers.map((h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })),
    }),
    ...rows.map(
      (cells) =>
        new TableRow({
          children: cells.map((c) => new TableCell({ children: [new Paragraph({ children: [new TextRun(c)] })] })),
        }),
    ),
  ];
}

function docxChildren(t, index) {
  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun(t.templateName)],
    }),
    new Paragraph({ children: [new TextRun({ text: `Donor: ${t.donorName}`, italics: true })] }),
    new Paragraph({ children: [new TextRun({ text: `Report type: ${t.reportType}   Language: ${t.language}`, italics: true })] }),
    new Paragraph({ children: [new TextRun({ text: "Reporting period: ______  Project: ______  Grant reference: ______", italics: true })] }),
    new Paragraph({ children: [new TextRun("")] }),
  ];
  t.sections.forEach((section, i) => {
    const heading = `${i + 1}. ${section.title}`;
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(heading)] }));
    children.push(new Paragraph({ children: [new TextRun({ text: guidanceFor(section), italics: true })] }));
    if (section.inputType === "INDICATOR_TABLE") {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: buildRows(["Indicator", "Baseline", "Target", "Actual", "Unit", "Status"], [["", "", "", "", "", ""]]),
        }),
      );
    } else if (section.inputType === "TABLE") {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: buildRows(["Item", "Detail", "Quantity", "Evidence"], [["", "", "", ""], ["", "", "", ""]]),
        }),
      );
    } else {
      children.push(new Paragraph({ children: [new TextRun(placeholderFor(section))] }));
    }
    children.push(new Paragraph({ children: [new TextRun("")] }));
  });
  return children;
}

function textContent(t) {
  const lines = [t.templateName, `Donor: ${t.donorName}`, `Report type: ${t.reportType}   Language: ${t.language}`, "Reporting period: ______  Project: ______  Grant reference: ______", ""];
  t.sections.forEach((section, i) => {
    lines.push(`${i + 1}. ${section.title}`);
    lines.push(guidanceFor(section));
    if (section.inputType === "INDICATOR_TABLE") {
      lines.push("Indicator\tBaseline\tTarget\tActual\tUnit\tStatus");
    } else if (section.inputType === "TABLE") {
      lines.push("Item\tDetail\tQuantity\tEvidence");
    } else {
      lines.push(placeholderFor(section));
    }
    lines.push("");
  });
  return lines.join("\n");
}

function sidecar(t) {
  return {
    fileName: `${t.slug}.docx`,
    templateName: t.templateName,
    donorName: t.donorName,
    reportType: t.reportType,
    language: t.language,
    notes: t.notes,
    requiredAnnexes: t.requiredAnnexes,
    sections: t.sections.map((s) => ({
      title: s.title,
      description: s.description,
      inputType: s.inputType,
      required: s.required,
      evidenceNeeded: s.evidenceNeeded,
      minWords: s.minWords,
      maxWords: s.maxWords,
      reviewStatus: "REVIEWED",
    })),
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const t of TEMPLATES) {
    const doc = new Document({
      creator: "DonorDesk",
      title: t.templateName,
      sections: [{ properties: {}, children: docxChildren(t, 0) }],
    });
    const buffer = await Packer.toBuffer(doc);
    await writeFile(join(OUT_DIR, `${t.slug}.docx`), buffer);
    await writeFile(join(OUT_DIR, `${t.slug}.txt`), textContent(t));
    await writeFile(join(OUT_DIR, `${t.slug}.json`), JSON.stringify(sidecar(t), null, 2));
    console.log(`Wrote ${t.slug}.docx / .txt / .json -> ${OUT_DIR}`);
  }
  console.log("Done. 3 demo donor templates generated.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
