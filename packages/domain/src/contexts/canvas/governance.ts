/**
 * Checking a canvas before it is shared or published (Phase 45.8). Block-owned rules come from each definition; the rules here
 * are about the canvas as a whole. The profile only chooses which rules run, never what is drawn.
 */
import { manualWithoutSource, unacceptedDrafts } from "./binding.js";
import type { LintSeverity } from "./block-definition.js";
import type { Canvas, CanvasProfile } from "./canvas.js";
import { definitionFor } from "./blocks/registry.js";
import { DESIGN_TRANSITIONS, canApplyDesignAction, type DesignAction, type DesignStatus } from "../infographics/workflow.js";

export interface CanvasFinding { ruleId: string; severity: LintSeverity; pageId: string; blockId: string; message: string }
interface CanvasRule { id: string; severity: LintSeverity; profiles: readonly CanvasProfile[]; check: (c: Canvas) => Array<{ pageId: string; blockId: string; message: string }> }

const PUBLIC_PROFILES: readonly CanvasProfile[] = ["DONOR_REPORT", "SNAPSHOT", "SOCIAL"];
const visible = (c: Canvas) => c.pages.flatMap((p) => p.blocks.filter((b) => !b.style?.hidden).map((b) => ({ p, b })));

export const CANVAS_RULES: readonly CanvasRule[] = [
  { id: "ALT_MISSING", severity: "BLOCKER", profiles: PUBLIC_PROFILES, check: (c) => visible(c).filter(({ b }) => (definitionFor(b.kind) as { needsAlt?: boolean } | undefined)?.needsAlt === true && !(b.alt ?? "").trim() && !(b.props as { altText?: string })?.altText).map(({ p, b }) => ({ pageId: p.id, blockId: b.id, message: "Describe this picture in a sentence for people who cannot see it." })) },
  { id: "MANUAL_NO_SOURCE", severity: "BLOCKER", profiles: ["DONOR_REPORT"], check: (c) => visible(c).filter(({ b }) => manualWithoutSource(b.bindings).length > 0).map(({ p, b }) => ({ pageId: p.id, blockId: b.id, message: "A figure someone typed needs its source named." })) },
  { id: "AI_NOT_ACCEPTED", severity: "BLOCKER", profiles: ["DONOR_REPORT", "SNAPSHOT", "SOCIAL", "INTERNAL"], check: (c) => visible(c).filter(({ b }) => unacceptedDrafts(b.bindings).length > 0).map(({ p, b }) => ({ pageId: p.id, blockId: b.id, message: "A person has to read and accept the AI-drafted text before this is shared." })) },
  { id: "EMPTY_PAGE", severity: "WARN", profiles: ["DONOR_REPORT", "SNAPSHOT", "SOCIAL", "INTERNAL", "LIVE_INTERNAL"], check: (c) => c.pages.filter((p) => visible({ ...c, pages: [p] }).length === 0).map((p) => ({ pageId: p.id, blockId: "", message: "This page has nothing on it." })) },
  { id: "TOO_MANY_THEMES", severity: "TIP", profiles: ["SNAPSHOT"], check: (c) => (visible(c).filter(({ b }) => (definitionFor(b.kind) as { headline?: boolean } | undefined)?.headline === true).length > 3 ? [{ pageId: "", blockId: "", message: "A snapshot tells one story; more than three headline blocks may be too many." }] : []) },
];

/** Findings for a canvas: canvas rules for its profile, plus the rules each block owns. Waived rule ids are skipped only when the caller passes them with a reason elsewhere. */
export function checkCanvas(canvas: Canvas): CanvasFinding[] {
  const out: CanvasFinding[] = [];
  for (const rule of CANVAS_RULES) if (rule.profiles.includes(canvas.profile)) for (const f of rule.check(canvas)) out.push({ ruleId: rule.id, severity: rule.severity, ...f });
  for (const { p, b } of visible(canvas)) {
    const def = definitionFor(b.kind) as unknown as { lint: ReadonlyArray<{ id: string; severity: LintSeverity; check: (props: unknown) => string | null }> } | undefined;
    for (const rule of def?.lint ?? []) { const message = rule.check(b.props); if (message) out.push({ ruleId: rule.id, severity: rule.severity, pageId: p.id, blockId: b.id, message }); }
  }
  return out;
}

export const canPublish = (findings: ReadonlyArray<CanvasFinding>, waived: ReadonlySet<string> = new Set()): boolean =>
  !findings.some((f) => f.severity === "BLOCKER" && !waived.has(f.ruleId));

/** The review workflow is the infographics' (draft, in review, approved); a canvas uses the same table, so there is one rule. */
export const CANVAS_TRANSITIONS = DESIGN_TRANSITIONS;
export const canApplyCanvasAction = (s: DesignStatus, a: DesignAction): boolean => canApplyDesignAction(s, a);
