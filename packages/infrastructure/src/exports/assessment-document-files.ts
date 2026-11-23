import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { AssessmentDocument } from "@donordesk/domain";
import type { IAssessmentFiles } from "@donordesk/application";
import { renderDocxBlocks, renderPdfBlocks, type MdBlock } from "./markdown-renderer.js";

/**
 * Draws a completed assessment (Phase 62.9) from the document model. The model decides every word; this file only lays it out: one
 * heading per section, a table for each grid or repeat, a short list for single answers. Word handles any script (and right to left);
 * the PDF uses the standard fonts, so the handler sends right-to-left languages to Word or Excel.
 */
const run = (text: string, bold = false) => ({ text, ...(bold ? { bold: true } : {}) });

function blocks(doc: AssessmentDocument): MdBlock[] {
  const out: MdBlock[] = [{ type: "heading", level: 1, inline: [run(doc.title)] }];
  const meta = [doc.facility ? `Facility: ${doc.facility}` : "", doc.visitedOn ? `Visited on: ${doc.visitedOn}` : ""].filter(Boolean).join("   ·   ");
  if (meta) out.push({ type: "paragraph", inline: [run(meta)] });
  if (doc.score) {
    out.push({ type: "heading", level: 2, inline: [run("Score")] });
    out.push({ type: "paragraph", inline: [run(`Overall: ${doc.score.overall === null ? "not enough answered" : `${doc.score.overall}%`}${doc.score.band ? ` (${doc.score.band})` : ""}${doc.score.illustrative ? " — illustrative weights and bands" : ""}`)] });
    out.push({ type: "table", header: ["Section", "Score (%)"], rows: doc.score.sections.map((s) => [s.title, s.skipped ? "Not applicable" : s.percent === null ? "Not answered" : String(s.percent)]) });
  }
  for (const section of doc.sections) {
    out.push({ type: "heading", level: 2, inline: [run(section.title)] });
    if (section.intro) out.push({ type: "paragraph", inline: [run(section.intro)] });
    if (section.rows.length > 0) out.push({ type: "table", header: ["Question", "Answer", "Checked by"], rows: section.rows.map((r) => [r.label, r.answer, r.how ?? ""]) });
    for (const t of section.tables) {
      out.push({ type: "heading", level: 3, inline: [run(t.title)] });
      out.push({ type: "table", header: t.headers, rows: t.rows.length > 0 ? t.rows : [["No rows"]] });
    }
  }
  if (doc.signatures.length > 0) {
    out.push({ type: "heading", level: 2, inline: [run("Sign-off")] });
    out.push({ type: "table", header: ["Signer", "Signed"], rows: doc.signatures.map((s) => [s.signer, s.signed ? "Signed" : "Not signed"]) });
  }
  return out;
}

export class AssessmentDocumentFiles implements IAssessmentFiles {
  async pdf(doc: AssessmentDocument): Promise<Buffer> {
    const pdf = new PDFDocument({ margin: 40, size: "A4", info: { Title: doc.title, Author: "DonorDesk" } });
    const chunks: Buffer[] = [];
    pdf.on("data", (c) => chunks.push(c as Buffer));
    const done = new Promise<Buffer>((resolve) => pdf.on("end", () => resolve(Buffer.concat(chunks))));
    renderPdfBlocks(pdf, blocks(doc));
    pdf.end();
    return done;
  }

  async docx(doc: AssessmentDocument, options: { rtl: boolean }): Promise<Buffer> {
    const children = [new Paragraph({ children: [new TextRun({ text: doc.title })], heading: HeadingLevel.HEADING_1, ...(options.rtl ? { bidirectional: true } : {}) }), ...renderDocxBlocks(blocks(doc).slice(1))];
    const file = new Document({ creator: "DonorDesk", title: doc.title, sections: [{ children }] });
    return Buffer.from(await Packer.toBuffer(file));
  }

  async xlsx(doc: AssessmentDocument): Promise<Buffer> {
    const book = new ExcelJS.Workbook();
    book.creator = "DonorDesk";
    const summary = book.addWorksheet("Summary");
    summary.addRow([doc.title]).font = { bold: true, size: 14 };
    if (doc.facility) summary.addRow(["Facility", doc.facility]);
    if (doc.visitedOn) summary.addRow(["Visited on", doc.visitedOn]);
    if (doc.score) {
      summary.addRow([]);
      summary.addRow(["Overall score (%)", doc.score.overall === null ? "Not enough answered" : doc.score.overall, doc.score.band ?? ""]);
      for (const s of doc.score.sections) summary.addRow([s.title, s.skipped ? "Not applicable" : s.percent === null ? "Not answered" : s.percent]);
      if (doc.score.illustrative) summary.addRow(["Weights and bands are illustrative."]);
    }
    summary.columns = [{ width: 44 }, { width: 24 }, { width: 18 }];
    const taken = new Set<string>(["Summary"]);
    const sheetName = (title: string): string => {
      let base = title.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28) || "Sheet";
      for (let n = 2; taken.has(base.toLowerCase()); n += 1) base = `${base.slice(0, 25)} ${n}`;
      taken.add(base.toLowerCase());
      return base;
    };
    for (const section of doc.sections) {
      const sheet = book.addWorksheet(sheetName(section.title));
      sheet.addRow(["Question", "Answer", "Checked by"]).font = { bold: true };
      for (const r of section.rows) sheet.addRow([r.label, r.answer, r.how ?? ""]);
      for (const t of section.tables) {
        sheet.addRow([]);
        sheet.addRow([t.title]).font = { bold: true };
        sheet.addRow(t.headers).font = { bold: true };
        for (const row of t.rows) sheet.addRow(row);
      }
      sheet.columns = [{ width: 52 }, { width: 28 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
    }
    return Buffer.from(await book.xlsx.writeBuffer());
  }
}
