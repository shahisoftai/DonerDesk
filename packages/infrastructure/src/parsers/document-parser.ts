import mammoth from "mammoth";
import * as ExcelJS from "exceljs";
import type { IDocumentParser } from "@donordesk/application";

export class TolerantDocumentParser implements IDocumentParser {
  async parse(input: { buffer: Buffer; fileType: string; fileName: string }): Promise<{ text: string; metadata?: Record<string, unknown> }> {
    const name = input.fileName.toLowerCase();
    const ext = name.split(".").pop() ?? "";
    try {
      if (ext === "docx" || input.fileType.includes("officedocument.wordprocessingml")) {
        const result = await mammoth.extractRawText({ buffer: input.buffer });
        return { text: result.value };
      }
      if (ext === "xlsx" || input.fileType.includes("spreadsheetml")) {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(input.buffer);
        const parts: string[] = [];
        wb.eachSheet((sheet) => {
          parts.push(`# ${sheet.name}`);
          sheet.eachRow((row) => {
            const cells: string[] = [];
            row.eachCell((cell) => cells.push(String(cell.value ?? "")));
            parts.push(cells.join("\t"));
          });
        });
        return { text: parts.join("\n") };
      }
      if (ext === "txt" || input.fileType.startsWith("text/")) {
        return { text: input.buffer.toString("utf8") };
      }
      if (ext === "csv") {
        return { text: input.buffer.toString("utf8") };
      }
      if (ext === "pdf" || input.fileType === "application/pdf") {
        // pdf-parse can be slow / heavy on small installs; we try to lazy import.
        try {
          const mod = await import("pdf-parse");
          const data = await (mod as { default: (b: Buffer) => Promise<{ text: string }> }).default(input.buffer);
          return { text: data.text };
        } catch (e) {
          return { text: "", metadata: { parseError: String(e) } };
        }
      }
      // For images we just store the filename as the "text" placeholder.
      return { text: name };
    } catch (e) {
      return { text: "", metadata: { parseError: String(e) } };
    }
  }
}
