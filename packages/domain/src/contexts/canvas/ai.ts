/**
 * AI assistance on a canvas (Phase 45.9): the rules, not the model. SuperAdmin decides which organisations may use it; a model's
 * reply is only ever a proposal, and every sentence that states a figure the records do not hold is dropped before anyone sees it.
 */
import { numbersIn, ungroundedNumbers } from "../infographics/grounding.js";

/**
 * Who may switch canvas AI on: SuperAdmin only, per organisation (Phase 45 decision 5). The platform's `Organization.aiEnabled`
 * defaults to true, so on its own it would turn the canvas blocks on everywhere; canvas AI therefore needs both that flag and its
 * own `canvasAiEnabled`, which defaults to false and is set in the SuperAdmin tenant form beside "Enable AI features".
 */
export const canvasAiEnabledFor = (org: { aiEnabled: boolean; canvasAiEnabled: boolean }): boolean => org.aiEnabled && org.canvasAiEnabled;

export interface AiGateInput { organisationEnabled: boolean; providerConfigured: boolean; external: boolean; overCap: boolean }
export type AiGate = { allowed: true } | { allowed: false; reason: "OFF" | "NO_PROVIDER" | "NOT_FOR_PARTNERS" | "OVER_CAP" };
/** Off means hidden, not disabled: callers show nothing at all when `reason` is OFF. */
export function aiGate(i: AiGateInput): AiGate {
  if (!i.organisationEnabled) return { allowed: false, reason: "OFF" };
  if (i.external) return { allowed: false, reason: "NOT_FOR_PARTNERS" };
  if (!i.providerConfigured) return { allowed: false, reason: "NO_PROVIDER" };
  if (i.overCap) return { allowed: false, reason: "OVER_CAP" };
  return { allowed: true };
}

export interface GroundedText { kept: string[]; dropped: string[] }
const sentences = (text: string): string[] => text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

/** Keeps the sentences whose figures are all in `allowed`; the rest are counted and returned so the screen can say how many were dropped. */
export function groundText(text: string, allowed: ReadonlySet<number>): GroundedText {
  const kept: string[] = []; const dropped: string[] = [];
  for (const s of sentences(text)) (ungroundedNumbers(s, allowed).length === 0 ? kept : dropped).push(s);
  return { kept, dropped };
}

/** Translation must not change a figure: the same numbers, in the same amount, must appear before and after. */
export function sameFigures(original: string, translated: string): boolean {
  const a = [...numbersIn(original)].sort((x, y) => x - y); const b = [...numbersIn(translated)].sort((x, y) => x - y);
  return a.length === b.length && a.every((n, i) => n === b[i]);
}

/** A free-text question never carries its text into an audit row: only its length and the outcome. */
export const auditShape = (question: string, status: string, dropped: number): { length: number; status: string; dropped: number } => ({ length: question.length, status, dropped });
