import type { IExportBuilder, ExportArtifacts } from "@donordesk/application";
import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, TextRun } from "docx";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { ZipArchive } from "archiver";

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
  async build(input: Parameters<IExportBuilder["build"]>[0]): Promise<ExportArtifacts> {
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
      default:
        throw new Error(`Unsupported export type: ${input.exportType}`);
    }
  }

  private async buildWord(input: Parameters<IExportBuilder["build"]>[0]): Promise<ExportArtifacts> {
    const sections = input.sections.map(
      (s) =>
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: textRuns(s.title),
        }),
    );
    for (const s of input.sections) {
      sections.push(new Paragraph({ children: textRuns(s.content) }));
    }
    const indicatorTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: ["Code", "Indicator", "Baseline", "Target", "Achievement", "Unit", "Status"].map(
            (h) => new TableCell({ children: [new Paragraph({ children: textRuns(h) })] }),
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
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: textRuns("Indicator Progress"),
            }),
            indicatorTable,
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
    doc.fontSize(20).text(input.reportTitle, { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Project: ${input.projectName}`);
    doc.text(`Reporting period: ${input.reportingPeriodLabel}`);
    doc.moveDown();
    for (const s of input.sections) {
      doc.fontSize(14).text(s.title);
      doc.fontSize(11).text(s.content);
      doc.moveDown();
    }
    doc.fontSize(14).text("Indicator Progress");
    doc.fontSize(10);
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
