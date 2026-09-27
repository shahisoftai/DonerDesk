import type { DocumentBlock, ITemplateExtractionService, TemplateExtractionRequest, TemplateExtractionResult } from "@donordesk/application";
import type { DomainError, Result } from "@donordesk/domain";
import { linesToBlocks } from "../../parsers/structured/text-blocks.js";
import { analyzeSection } from "./content-analyzer.js";
import { analyzeRequirements, guidanceKindFor, isAnnexHeading, ANNEX_ITEM, type RequirementScanInput } from "./requirements-analyzer.js";
import { buildSectionTree, splitNumbering, type SectionDraft } from "./section-tree.js";
import { CANONICAL_OUTLINE } from "./canonical-outline.js";

export const HEURISTIC_EXTRACTOR_VERSION = "heuristic-v2";
const MAX_SECTIONS = 150;

interface OutlineNode {
  ref: string;
  parentRef?: string;
  heading: string;
  level: number;
  page?: number;
  body: DocumentBlock[];
}

const SECTION_COLUMN = /^(section|heading|chapter|part|component|report\s+section|item|title)s?\b/i;
const GUIDANCE_COLUMN = /\b(guidance|description|instructions?|content|what\s+to\s+include|requirements?|questions?|details?|explanation)\b/i;
const LIMIT_COLUMN = /\b(length|words?|pages?|limit)\b/i;

function blocksFor(request: TemplateExtractionRequest): DocumentBlock[] {
  if (request.document && request.document.blocks.length > 0) return request.document.blocks;
  return linesToBlocks(request.rawText.split(/\r?\n/).map((text) => ({ text })));
}

/** Title block ("Quarterly Narrative Report Template") before the first real section. */
function takeDocumentTitle(blocks: DocumentBlock[]): { title?: string; rest: DocumentBlock[] } {
  const first = blocks[0];
  if (first?.kind === "PARAGRAPH" && first.text.length <= 100 && /\b(report|template|format)\b/i.test(first.text) && !/[.?!:]$/.test(first.text)) {
    return { title: first.text.replace(/\s*[-–:]?\s*template$/i, "").trim(), rest: blocks.slice(1) };
  }
  const idx = blocks.findIndex((b) => b.kind === "HEADING" || (b.kind === "PARAGRAPH" && b.emphasis));
  if (idx === -1 || idx > 3) return { rest: blocks };
  const b = blocks[idx]!;
  const text = b.kind === "TABLE" ? "" : b.text;
  const nextHeading = blocks.slice(idx + 1).find((x) => x.kind === "HEADING");
  const isTitle = /\b(report|template|format|guidelines?)\b/i.test(text) && !/^\d/.test(text) && (b.kind !== "HEADING" || !nextHeading || nextHeading.level >= b.level);
  if (!isTitle) return { rest: blocks };
  return { title: text.replace(/\s*[-–:]?\s*template$/i, "").trim(), rest: [...blocks.slice(0, idx), ...blocks.slice(idx + 1)] };
}

/** Headings → nested outline with levels normalised to 1..n relative to the document. */
function buildOutline(blocks: DocumentBlock[]): { preface: DocumentBlock[]; nodes: OutlineNode[] } {
  const levels = [...new Set(blocks.filter((b): b is Extract<DocumentBlock, { kind: "HEADING" }> => b.kind === "HEADING").map((b) => b.level))].sort((a, b) => a - b);
  const rank = new Map(levels.map((l, i) => [l, i + 1]));
  const preface: DocumentBlock[] = [];
  const nodes: OutlineNode[] = [];
  const stack: OutlineNode[] = [];
  let current: OutlineNode | undefined;
  for (const b of blocks) {
    if (b.kind !== "HEADING") {
      (current ? current.body : preface).push(b);
      continue;
    }
    const wanted = rank.get(b.level) ?? 1;
    while (stack.length > 0 && stack[stack.length - 1]!.level >= wanted) stack.pop();
    const parent = stack[stack.length - 1];
    const node: OutlineNode = { ref: `h${nodes.length}`, parentRef: parent?.ref, heading: b.text, level: parent ? parent.level + 1 : 1, page: b.page, body: [] };
    nodes.push(node);
    stack.push(node);
    current = node;
  }
  return { preface, nodes };
}

/** Donor templates that list sections in a "Section | Guidance" table. */
function outlineFromGuidanceTable(blocks: DocumentBlock[]): OutlineNode[] {
  for (const b of blocks) {
    if (b.kind !== "TABLE" || b.rows.length < 3) continue;
    const header = b.rows[0]!;
    const sectionCol = header.findIndex((c) => SECTION_COLUMN.test(c.trim()));
    const guidanceCol = header.findIndex((c, i) => i !== sectionCol && GUIDANCE_COLUMN.test(c));
    if (sectionCol === -1 || guidanceCol === -1) continue;
    const limitCol = header.findIndex((c, i) => i !== sectionCol && i !== guidanceCol && LIMIT_COLUMN.test(c));
    return b.rows
      .slice(1)
      .filter((r) => (r[sectionCol] ?? "").trim().length >= 2)
      .map((r, i) => {
        const guidance = [r[guidanceCol] ?? "", limitCol >= 0 && r[limitCol] ? `(maximum ${r[limitCol]})` : ""].join(" ").trim();
        const { numbering } = splitNumbering(r[sectionCol]!);
        const depth = numbering && /^\d+(\.\d+)+$/.test(numbering) ? Math.min(4, numbering.split(".").length) : 1;
        return { ref: `t${i}`, heading: r[sectionCol]!, level: depth, body: guidance ? [{ kind: "PARAGRAPH" as const, text: guidance }] : [] };
      })
      .map((n, i, all) => {
        if (n.level === 1) return n;
        const parent = [...all.slice(0, i)].reverse().find((p) => p.level === n.level - 1);
        return parent ? { ...n, parentRef: parent.ref } : { ...n, level: 1 };
      });
  }
  return [];
}

/** Drops a bare trailing page number that survived from a TOC/reference copy ("Annex A: Beneficiary List  4"). */
function stripTrailingPageNumber(text: string): string {
  return text.replace(/[\s.]+\d{1,4}\s*$/, "").trim() || text.trim();
}

/**
 * A donor template often lists each annex twice — once as a bare TOC-adjacent
 * reference, once as the real heading with its content underneath. Both carry
 * the same roman-numeral numbering ("Annex II"), so when a top-level ANNEX
 * draft's numbering repeats, only the later occurrence (the real heading) is
 * kept.
 */
function dedupeAnnexNumbering(drafts: readonly SectionDraft[]): SectionDraft[] {
  const lastIndexByNumbering = new Map<string, number>();
  drafts.forEach((d, i) => {
    if (!d.parentRef && d.inputType === "ANNEX" && d.numbering) lastIndexByNumbering.set(d.numbering, i);
  });
  return drafts.filter((d, i) => !(!d.parentRef && d.inputType === "ANNEX" && d.numbering) || lastIndexByNumbering.get(d.numbering!) === i);
}

function textOf(blocks: DocumentBlock[]): { text: string; listItems: string[] } {
  return {
    text: blocks.filter((b) => b.kind === "PARAGRAPH").map((b) => (b as { text: string }).text).join(" "),
    listItems: blocks.filter((b) => b.kind === "LIST_ITEM").map((b) => (b as { text: string }).text),
  };
}

/**
 * Deterministic template extraction over the document outline. Used when no
 * LLM is configured and as the fallback when the LLM extraction fails. Never
 * silently substitutes a generic outline: the CANONICAL method is reported.
 */
export class HeuristicTemplateExtractor implements ITemplateExtractionService {
  async extract(request: TemplateExtractionRequest): Promise<Result<TemplateExtractionResult, DomainError>> {
    const started = Date.now();
    const warnings: string[] = [];
    const { title, rest } = takeDocumentTitle(blocksFor(request));
    let { preface, nodes } = buildOutline(rest);
    const styled = request.document?.format === "DOCX" && nodes.length > 0;
    if (nodes.length === 0) {
      nodes = outlineFromGuidanceTable(rest);
      if (nodes.length > 0) {
        preface = [];
        warnings.push("Sections were read from a section/guidance table in the template.");
      }
    }

    const scan: RequirementScanInput = { documentTitle: title, passages: [], annexCandidates: [] };
    if (preface.length) scan.passages.push({ kind: "PREFACE", ...textOf(preface) });

    const excluded = new Set<string>();
    const drafts: SectionDraft[] = [];
    for (const node of nodes) {
      const { numbering, title: sectionTitle } = splitNumbering(node.heading);
      const kind = guidanceKindFor(sectionTitle);
      const parentExcluded = node.parentRef ? excluded.has(node.parentRef) : false;
      const annexHeading = isAnnexHeading(sectionTitle);
      const annexItem = ANNEX_ITEM.test(node.heading) && /^(annex|appendix|attachment)\b/i.test(node.heading);
      const analysis = analyzeSection(sectionTitle, node.body);
      const bodyText = textOf(node.body);

      if (annexHeading) {
        for (const item of bodyText.listItems) scan.annexCandidates.push({ name: stripTrailingPageNumber(item) });
      } else if (annexItem) {
        scan.annexCandidates.push({ name: stripTrailingPageNumber(node.heading), description: analysis.description || undefined });
      }

      if (kind || parentExcluded) {
        excluded.add(node.ref);
        scan.passages.push({ kind: kind ?? "GENERAL", page: node.page, ...bodyText });
      } else {
        scan.passages.push({ kind: "SECTION", page: node.page, ...bodyText });
      }
      drafts.push({
        ref: node.ref,
        parentRef: node.parentRef,
        title: sectionTitle.length >= 2 ? sectionTitle : node.heading,
        numbering,
        description: analysis.description,
        instructions: analysis.instructions,
        mandatoryQuestions: analysis.mandatoryQuestions,
        evidenceNeeded: analysis.evidenceNeeded,
        requiredTables: analysis.requiredTables,
        minWords: analysis.minWords,
        maxWords: analysis.maxWords,
        pageLimit: analysis.pageLimit,
        required: analysis.required,
        inputType: annexItem ? "ANNEX" : analysis.inputType,
        includeInReport: !(kind || parentExcluded),
        source: { excerpt: node.heading, ...(node.page ? { page: node.page } : {}) },
        confidence: styled ? 0.8 : 0.65,
        ...(annexItem ? { title: stripTrailingPageNumber(sectionTitle.length >= 2 ? sectionTitle : node.heading) } : {}),
      });
    }

    let sections = buildSectionTree(dedupeAnnexNumbering(drafts).slice(0, MAX_SECTIONS), warnings);
    if (drafts.length > MAX_SECTIONS) warnings.push(`Only the first ${MAX_SECTIONS} headings were kept.`);
    let method: "HEURISTIC" | "CANONICAL" = "HEURISTIC";
    if (!sections.some((s) => s.includeInReport)) {
      method = "CANONICAL";
      warnings.push("No section headings could be detected, so a generic donor report outline was proposed. Replace it with the donor's real sections before approving.");
      sections = buildSectionTree(CANONICAL_OUTLINE.map((c) => ({ ...c, confidence: 0.3 })), warnings);
    }
    const requirements = analyzeRequirements(scan);
    const reportable = sections.filter((s) => s.includeInReport).length;
    return {
      ok: true,
      value: {
        sections,
        requirements,
        meta: { method, promptVersion: HEURISTIC_EXTRACTOR_VERSION, warnings, extractedAt: new Date().toISOString(), durationMs: Date.now() - started },
        summary:
          method === "CANONICAL"
            ? "No structure detected; a generic outline was proposed for you to replace."
            : `Found ${reportable} report section(s)${sections.length > reportable ? ` and ${sections.length - reportable} guidance section(s)` : ""}, ${requirements.annexes.length} annex(es) and ${requirements.compliance.length} compliance rule(s).`,
      },
    };
  }
}
