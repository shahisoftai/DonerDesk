import { sectionKind } from "./section-kind.js";

/**
 * Which sections of a report ask the officer for a statement of their own, and how a statement is keyed. Environmental,
 * branding, gender, coordination and safeguarding sections have no indicator or activity behind them, so unless a person
 * writes something the report can only say "no record".
 */
export interface NoteableSection {
  id: string;
  title: string;
  canonicalTitle?: string;
  /** False for guidance-only template sections (not part of the report). */
  includeInReport?: boolean;
}

/** The key a statement is stored under: the section's own id (a template section id is stable across periods). */
export function sectionNoteKey(section: Pick<NoteableSection, "id">): string {
  return section.id;
}

/**
 * The sections of a donor template that are compliance statements. The built-in blueprints are left out on purpose:
 * their risk and sustainability sections are written from the story answers.
 */
export function complianceSectionsOf(sections: ReadonlyArray<NoteableSection>): Array<{ key: string; title: string }> {
  return sections
    .filter((s) => s.includeInReport !== false && !s.id.startsWith("bp:") && sectionKind(s) === "compliance")
    .map((s) => ({ key: sectionNoteKey(s), title: s.title }));
}
