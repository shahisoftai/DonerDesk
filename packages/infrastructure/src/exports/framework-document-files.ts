import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import PDFDocument from "pdfkit";
import type { FrameworkDocument } from "@donordesk/domain";
import { renderDocxBlocks, renderPdfBlocks, type MdBlock } from "./markdown-renderer.js";

/** A gap is a dash in a file: a baseline nobody set is never written as 0, and an unwritten assumption is not "not measured". */
const GAP = "—";
function table(doc: FrameworkDocument): MdBlock {
  return {
    type: "table",
    header: doc.columns.map((c) => c.label),
    rows: doc.rows.map((row) => doc.columns.map((c) => {
      // A column that describes the other kind of row is empty by design; only a value that could exist and does not is a gap.
      if (c.owner !== row.kind) return "";
      const value = row.cells[c.key];
      if (value === null || value === undefined) return GAP;
      return row.kind === "RESULT" && c.key === "title" ? `${"  ".repeat(row.depth)}${value}` : value;
    })),
  };
}

export const FRAMEWORK_FILE_NAME = (doc: FrameworkDocument, extension: "docx" | "pdf") => `${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "framework"}.${extension}`;

export async function buildFrameworkDocx(doc: FrameworkDocument): Promise<Buffer> {
  const file = new Document({
    creator: "DonorDesk",
    title: doc.title,
    sections: [{ children: [new Paragraph({ text: doc.title, heading: HeadingLevel.HEADING_1 }), ...renderDocxBlocks([table(doc)])] }],
  });
  return Buffer.from(await Packer.toBuffer(file));
}

export async function buildFrameworkPdf(doc: FrameworkDocument): Promise<Buffer> {
  const pdf = new PDFDocument({ margin: 40, size: "A4", layout: "landscape", info: { Title: doc.title, Author: "DonorDesk" } });
  const chunks: Buffer[] = [];
  pdf.on("data", (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((resolve) => pdf.on("end", () => resolve(Buffer.concat(chunks))));
  renderPdfBlocks(pdf, [{ type: "heading", level: 1, inline: [{ text: doc.title }] }, table(doc)]);
  pdf.end();
  return done;
}
