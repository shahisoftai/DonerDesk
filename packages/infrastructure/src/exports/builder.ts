import type { IExportBuilder, ExportArtifacts, ExportChartInput, IStorage, IDonorTemplateRenderer } from "@donordesk/application";
import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, TextRun, ImageRun, PageBreak, TableOfContents } from "docx";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { ZipArchive } from "archiver";
import { renderChartPngCached, chartHasData } from "./chart-png-renderer.js";
import { parseMarkdownBlocks, renderDocxBlocks, renderPdfBlocks } from "./markdown-renderer.js";

/** Report section depth (1 = section, 2-4 = sub-sections); absent on legacy data. */
function sectionLevel(level: number | undefined): number {
  return Math.min(4, Math.max(1, level ?? 1));
}
/** Sections are Heading 2 (Heading 1 is reserved for report parts); sub-sections go one step deeper per level. */
const DOCX_SECTION_HEADINGS = [HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5] as const;
function sectionHeading(level: number | undefined) {
  return DOCX_SECTION_HEADINGS[sectionLevel(level) - 1]!;
}
const PDF_SECTION_SIZE = [14, 12.5, 11.5, 11] as const;

function escapeCsv(value: string): string {
  if (value == null) return "";
  const needsQuotes = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function textRuns(s: string): TextRun[] {
  return [new TextRun({ text: s })];
}

export class DefaultExportBuilder implements IExportBuilder {
  constructor(
    private readonly donorTemplateStorage?: IStorage,
    private readonly donorTemplateRenderer?: IDonorTemplateRenderer,
  ) {}

  async build(input: Parameters<IExportBuilder["build"]>[0]): Promise<ExportArtifacts> {
    if (input.exportIntent === "DONOR_SUBMISSION") {
      if (input.watermark) {
        throw new Error("Donor submission exports must never be watermarked");
      }
      if (!input.submissionSnapshotId) {
        throw new Error("Donor submission exports require a submission snapshot id");
      }
    }
    if (input.exportIntent === "INTERNAL_REVIEW" && !input.watermark) {
      throw new Error("Internal preview exports must be visibly watermarked");
    }
    switch (input.exportType) {
      case "WORD":
        return this.buildWord(input);
      case "PDF":
        return this.buildPdf(input);
      case "EXCEL_INDICATORS":
        return this.buildExcel(input);
      case "EVIDENCE_CHECKLIST":
        return this.buildChecklist(input);
      case "EVIDENCE_PACK_ZIP":
        return this.buildZip(input);
      case "DONOR_TEMPLATE":
        return this.buildDonorTemplate(input);
      default:
        throw new Error(`Unsupported export type: ${input.exportType}`);
    }
  }

  private watermarkText(input: Parameters<IExportBuilder["build"]>[0]): string {
    return input.watermark ? `${input.watermark} — NOT FOR DONOR SUBMISSION` : "";
  }

  private async buildWord(input: Parameters<IExportBuilder["build"]>[0]): Promise<ExportArtifacts> {
    const sections: Array<Paragraph | Table> = [];
    const chartImages = new Map<string, { png: Buffer; caption: string }>();
    if (input.charts && input.charts.length > 0) {
      for (const c of input.charts) {
        if (!chartHasData(c.indicators, c.config)) continue;
        try {
          const png = await renderChartPngCached({ config: c.config, indicators: c.indicators, width: 720, height: 420 });
          chartImages.set(c.sectionTitle, { png, caption: c.sectionTitle });
        } catch {
          // Chart rendering must never break an export; skip the image.
        }
      }
    }
    for (const s of input.sections) {
      sections.push(
        new Paragraph({
          heading: sectionHeading(s.level),
          children: textRuns(s.title),
        }),
      );
      // Render the section's markdown natively: headings, bullet lists,
      // emphasis, and real tables (previously one flat Paragraph of raw
      // markdown text shipped to the donor).
      sections.push(...renderDocxBlocks(parseMarkdownBlocks(s.content)));
      const chart = chartImages.get(s.title);
      if (chart) {
        sections.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: chart.png, transformation: { width: 540, height: 315 } })] }));
        sections.push(new Paragraph({ alignment: AlignmentType.CENTER, children: textRuns(chart.caption) }));
      }
    }
    const indicatorTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: ["Code", "Indicator", "Baseline", "Target", "Achievement", "Unit", "Status"].map(
            (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] }),
          ),
        }),
        ...input.indicators.map(
          (i) =>
            new TableRow({
              children: [i.code, i.name, i.baseline, i.target, i.achievement, i.unit ?? "", i.status].map(
                (v) => new TableCell({ children: [new Paragraph({ children: textRuns(v) })] }),
              ),
            }),
        ),
      ],
    });
    const doc = new Document({
      creator: "DonorDesk",
      title: input.reportTitle,
      features: { updateFields: true },
      sections: [
        {
          properties: {},
          children: [
            // Cover page.
            new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { before: 2400 }, children: textRuns(input.reportTitle) }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: textRuns(`Project: ${input.projectName}`) }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: textRuns(`Reporting period: ${input.reportingPeriodLabel}`) }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: textRuns("Prepared with DonorDesk") }),
            new Paragraph({ children: [new PageBreak()] }),
            // Word populates this on open (features.updateFields).
            new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-3" }),
            new Paragraph({ children: [new PageBreak()] }),
            ...sections,
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: textRuns("Indicator Progress"),
            }),
            indicatorTable,
            ...(this.watermarkText(input)
              ? [new Paragraph({ children: textRuns("") }), new Paragraph({ children: textRuns(this.watermarkText(input)) })]
              : []),
          ],
        },
      ],
    });
    const buffer = await Packer.toBuffer(doc);
    return {
      fileBuffer: buffer,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName: `${slug(input.projectName)}-${slug(input.reportingPeriodLabel)}-report.docx`,
    };
  }

  private async buildPdf(input: Parameters<IExportBuilder["build"]>[0]): Promise<ExportArtifacts> {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, info: { Title: input.reportTitle, Author: "DonorDesk" } });
    doc.on("data", (c) => chunks.push(c as Buffer));
    const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));
    // Cover page.
    doc.fontSize(22).text(input.reportTitle, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Project: ${input.projectName}`, { align: "center" });
    doc.text(`Reporting period: ${input.reportingPeriodLabel}`, { align: "center" });
    doc.text("Prepared with DonorDesk", { align: "center" });
    doc.moveDown();
    const chartImages = new Map<string, Buffer>();
    if (input.charts && input.charts.length > 0) {
      for (const c of input.charts) {
        if (!chartHasData(c.indicators, c.config)) continue;
        try {
          const png = await renderChartPngCached({ config: c.config, indicators: c.indicators, width: 720, height: 420 });
          chartImages.set(c.sectionTitle, png);
        } catch {
          // Chart rendering must never break an export; skip the image.
        }
      }
    }
    // Contents (section list; PDFKit has no page-number pass, so entries are
    // listed in reading order without page references).
    doc.fontSize(14).text("Contents");
    doc.fontSize(10);
    for (const s of input.sections) {
      doc.text(`${"    ".repeat(sectionLevel(s.level) - 1)}- ${s.title}`);
    }
    doc.moveDown();
    doc.addPage();
    for (const s of input.sections) {
      doc.fontSize(PDF_SECTION_SIZE[sectionLevel(s.level) - 1]!).font("Helvetica-Bold").text(s.title);
      doc.font("Helvetica");
      // Render the section's markdown natively instead of printing raw
      // pipes/dashes: headings, bullets, emphasis, and ruled tables.
      renderPdfBlocks(doc, parseMarkdownBlocks(s.content));
      const chart = chartImages.get(s.title);
      if (chart) {
        doc.moveDown();
        try {
          doc.image(chart, { fit: [480, 280], align: "center" });
        } catch {
          // Unsupported image stream; skip.
        }
        doc.moveDown();
      }
      doc.moveDown();
    }
    doc.fontSize(14).font("Helvetica-Bold").text("Indicator Progress");
    doc.font("Helvetica").fontSize(10);
    for (const i of input.indicators) {
      doc.text(`${i.code} — ${i.name} (baseline ${i.baseline}, target ${i.target}, achievement ${i.achievement}${i.unit ? ` ${i.unit}` : ""}, status ${i.status})`);
    }
    doc.moveDown();
    doc.fontSize(14).text("Compliance Checklist");
    doc.fontSize(10);
    for (const c of input.checklist) {
      doc.text(`[${c.severity}] ${c.title} — ${c.status}${c.resolutionNotes ? ` (${c.resolutionNotes})` : ""}`);
    }
    doc.moveDown();
    doc.fontSize(14).text("Evidence Pack Index");
    doc.fontSize(10);
    for (const e of input.evidenceItems) {
      doc.text(`- ${e.fileName} (${e.type}, ${e.verificationStatus}, confidentiality ${e.confidentiality})`);
    }
    if (this.watermarkText(input)) {
      doc.moveDown();
      doc.fontSize(9).text(this.watermarkText(input), { align: "center" });
    }
    doc.end();
    await done;
    return {
      fileBuffer: Buffer.concat(chunks),
      contentType: "application/pdf",
      fileName: `${slug(input.projectName)}-${slug(input.reportingPeriodLabel)}-report.pdf`,
    };
  }

  private async buildExcel(input: Parameters<IExportBuilder["build"]>[0]): Promise<ExportArtifacts> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "DonorDesk";
    const sheet = wb.addWorksheet("Indicators");
    sheet.columns = [
      { header: "Code", key: "code", width: 14 },
      { header: "Indicator", key: "name", width: 32 },
      { header: "Baseline", key: "baseline", width: 12 },
      { header: "Target", key: "target", width: 12 },
      { header: "Achievement", key: "achievement", width: 14 },
      { header: "Unit", key: "unit", width: 10 },
      { header: "Status", key: "status", width: 12 },
    ];
    for (const i of input.indicators) {
      sheet.addRow({ code: i.code, name: i.name, baseline: i.baseline, target: i.target, achievement: i.achievement, unit: i.unit ?? "", status: i.status });
    }
    const act = wb.addWorksheet("Activities");
    act.columns = [
      { header: "Title", key: "title", width: 32 },
      { header: "Date", key: "date", width: 16 },
      { header: "Location", key: "location", width: 18 },
      { header: "Participants", key: "participants", width: 12 },
    ];
    for (const a of input.activities) act.addRow(a);
    const buffer = await wb.xlsx.writeBuffer();
    return {
      fileBuffer: Buffer.from(buffer as ArrayBuffer),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName: `${slug(input.projectName)}-indicators.xlsx`,
    };
  }

  /**
   * Attempts to render the donor's own uploaded template via the docxtpl
   * worker. Returns undefined (never throws) on ANY failure — no mapping
   * configured, feature flag off, storage read failure, worker
   * unreachable, render error — so `buildDonorTemplate()` always has a
   * working fallback and an export never hard-fails because of this
   * feature. Dark-launched behind `DONOR_TEMPLATE_RENDER_ENABLED=1`.
   */
  private async tryRenderDonorTemplate(input: Parameters<IExportBuilder["build"]>[0]): Promise<ExportArtifacts | undefined> {
    if (process.env.DONOR_TEMPLATE_RENDER_ENABLED !== "1") return undefined;
    if (!input.donorTemplate || !this.donorTemplateStorage || !this.donorTemplateRenderer) return undefined;

    try {
      const templatedBuffer = await this.donorTemplateStorage.read(input.donorTemplate.templatedFileKey);
      const context: Record<string, string> = {};
      for (const { placeholderKey, sectionTitle } of input.donorTemplate.placeholderSections) {
        const section = input.sections.find((s) => s.title === sectionTitle);
        context[placeholderKey] = section?.content ?? "";
      }
      const result = await this.donorTemplateRenderer.render({ templatedDocxBuffer: templatedBuffer, context });
      if (!result.ok) return undefined;
      return {
        fileBuffer: result.value.renderedDocxBuffer,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileName: `${slug(input.projectName)}-${slug(input.reportingPeriodLabel)}-donor-template.docx`,
      };
    } catch {
      return undefined;
    }
  }

  private async buildDonorTemplate(input: Parameters<IExportBuilder["build"]>[0]): Promise<ExportArtifacts> {
    const rendered = await this.tryRenderDonorTemplate(input);
    if (rendered) return rendered;

    // Fallback (default for every tenant without an approved, locked donor
    // template mapping, and the safety net on any renderer/storage failure):
    // a generic title+sections DOCX. Behaviour-identical to before this
    // feature existed.
    const sections: Array<Paragraph | Table> = [];
    for (const s of input.sections) {
      if (!s.title.trim()) continue;
      sections.push(new Paragraph({ heading: sectionHeading(s.level), children: textRuns(s.title) }));
      sections.push(...renderDocxBlocks(parseMarkdownBlocks(s.content)));
    }
    const doc = new Document({
      creator: "DonorDesk",
      title: input.reportTitle,
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
              children: textRuns(input.reportTitle),
            }),
            new Paragraph({ children: textRuns(`Project: ${input.projectName}`) }),
            new Paragraph({ children: textRuns(`Reporting period: ${input.reportingPeriodLabel}`) }),
            new Paragraph({ children: textRuns("") }),
            ...sections,
          ],
        },
      ],
    });
    const buffer = await Packer.toBuffer(doc);
    return {
      fileBuffer: buffer,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName: `${slug(input.projectName)}-${slug(input.reportingPeriodLabel)}-donor-template.docx`,
    };
  }

  private async buildChecklist(input: Parameters<IExportBuilder["build"]>[0]): Promise<ExportArtifacts> {
    const lines: string[] = ["Title,Severity,Status,Resolution Notes"];
    for (const c of input.checklist) {
      lines.push([c.title, c.severity, c.status, c.resolutionNotes ?? ""].map(escapeCsv).join(","));
    }
    return {
      fileBuffer: Buffer.from(lines.join("\n"), "utf8"),
      contentType: "text/csv",
      fileName: `${slug(input.projectName)}-checklist.csv`,
    };
  }

  private async buildZip(input: Parameters<IExportBuilder["build"]>[0]): Promise<ExportArtifacts> {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<void>((resolve) => archive.on("end", () => resolve()));
    archive.append(`${input.reportTitle}\nProject: ${input.projectName}\nReporting period: ${input.reportingPeriodLabel}\n`, { name: "README.txt" });
    archive.append(this.buildIndexCsv(input), { name: "index.csv" });
    const checklists = ["Title,Severity,Status,Resolution Notes", ...input.checklist.map((c) => [c.title, c.severity, c.status, c.resolutionNotes ?? ""].map(escapeCsv).join(","))].join("\n");
    archive.append(checklists, { name: "03_Evidence_Checklist/01_checklist.csv" });
    archive.append(JSON.stringify(input.sections.map((s) => ({ title: s.title, content: s.content, status: s.status })), null, 2), { name: "01_Final_Report/sections.json" });
    archive.append(JSON.stringify(input.indicators, null, 2), { name: "02_Indicator_Table/indicators.json" });
    for (const a of input.activities) {
      archive.append(JSON.stringify(a, null, 2), { name: `04_Activities/${slug(a.title)}.json` });
    }
    archive.finalize();
    await done;
    return {
      fileBuffer: Buffer.concat(chunks),
      contentType: "application/zip",
      fileName: `${slug(input.projectName)}-evidence-pack.zip`,
    };
  }

  private buildIndexCsv(input: Parameters<IExportBuilder["build"]>[0]): string {
    const lines = ["File Name,Title,Type,Status,Confidentiality"];
    for (const e of input.evidenceItems) {
      lines.push([e.fileName, e.title, e.type, e.verificationStatus, e.confidentiality].map(escapeCsv).join(","));
    }
    return lines.join("\n");
  }
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
