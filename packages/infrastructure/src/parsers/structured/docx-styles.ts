import type { DocumentBlock, TextStyle } from "@donordesk/application";
import { htmlText } from "./html-blocks.js";

interface RunProps {
  size?: number;
  bold?: boolean;
  color?: string;
}

const normalize = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();

function runProps(rPr: string | undefined): RunProps {
  if (!rPr) return {};
  const sz = /<w:sz w:val="(\d+)"/.exec(rPr);
  const color = /<w:color w:val="([0-9A-Fa-f]{6}|auto)"/.exec(rPr);
  const b = /<w:b(?:\s+w:val="([^"]*)")?\s*\/>/.exec(rPr);
  return {
    ...(sz ? { size: Number(sz[1]) / 2 } : {}),
    ...(b ? { bold: !/^(0|false|off)$/i.test(b[1] ?? "") } : {}),
    ...(color ? { color: color[1]!.toUpperCase() } : {}),
  };
}

const merge = (...props: RunProps[]): RunProps => Object.assign({}, ...props.map((p) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined))));

/** Paragraph-style run defaults (one `basedOn` hop) plus the document defaults. */
function styleDefaults(stylesXml: string | undefined): { doc: RunProps; byId: Map<string, RunProps> } {
  const byId = new Map<string, RunProps>();
  if (!stylesXml) return { doc: {}, byId };
  const doc = runProps(/<w:docDefaults>[\s\S]*?<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(stylesXml)?.[1]);
  const raw = new Map<string, { props: RunProps; basedOn?: string }>();
  for (const m of stylesXml.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g)) {
    raw.set(m[1]!, { props: runProps(/<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(m[2]!)?.[1]), basedOn: /<w:basedOn w:val="([^"]+)"/.exec(m[2]!)?.[1] });
  }
  for (const [id, s] of raw) byId.set(id, merge(s.basedOn ? (raw.get(s.basedOn)?.props ?? {}) : {}, s.props));
  return { doc, byId };
}

/**
 * Formatting of each non-empty paragraph, in document order, keyed by its
 * normalised text. The dominant run (most characters) decides the style, so a
 * heading with a trailing tab or page number keeps its heading formatting.
 */
export async function readDocxParagraphStyles(buffer: Buffer): Promise<Map<string, TextStyle[]>> {
  // Loaded lazily: formatting is only a level hint, so a missing module must not break DOCX parsing.
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  const out = new Map<string, TextStyle[]>();
  if (!documentXml) return out;
  const { doc, byId } = styleDefaults(await zip.file("word/styles.xml")?.async("string"));
  for (const p of documentXml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)) {
    const body = p[1]!;
    const pPr = /<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(body)?.[1] ?? "";
    const base = merge(doc, byId.get(/<w:pStyle w:val="([^"]+)"/.exec(pPr)?.[1] ?? "") ?? {});
    let text = "";
    let dominant: { props: RunProps; chars: number } | undefined;
    for (const r of body.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g)) {
      const runText = [...r[1]!.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((t) => t[1]).join("");
      if (!runText) continue;
      text += runText;
      const chars = runText.trim().length;
      if (!dominant || chars > dominant.chars) dominant = { props: runProps(/<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(r[1]!)?.[1]), chars };
    }
    const key = normalize(htmlText(text));
    if (!key || !dominant) continue;
    const props = merge(base, dominant.props);
    const style: TextStyle = {
      key: `${props.size ?? "?"}|${props.bold ? "b" : ""}|${props.color && props.color !== "AUTO" ? props.color : "000000"}`,
      ...props,
    };
    const list = out.get(key) ?? [];
    list.push(style);
    out.set(key, list);
  }
  return out;
}

/** Attaches each heading/paragraph block's formatting, matching paragraphs by text in document order. */
export function attachStyles(blocks: DocumentBlock[], styles: Map<string, TextStyle[]>): DocumentBlock[] {
  return blocks.map((b) => {
    if (b.kind !== "HEADING" && b.kind !== "PARAGRAPH") return b;
    const style = styles.get(normalize(b.text))?.shift();
    return style ? { ...b, style } : b;
  });
}
