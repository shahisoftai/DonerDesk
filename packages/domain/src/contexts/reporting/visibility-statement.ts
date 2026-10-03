/**
 * Donor visibility & attribution catalog (donor-quality remediation WS3).
 *
 * Exact attribution wording per donor family. Institutional donors audit this
 * sentence for compliance; paraphrasing it is a visibility failure. The
 * catalog is pure data + pure functions (zero infrastructure deps).
 *
 * SOLID: OCP — a new donor family is one more array entry, no new logic.
 * SRP — this module owns attribution wording only.
 */

export interface VisibilityStatement {
  /** Canonical donor-family key. */
  donorKey: string;
  /** Human label used in logs/preflight surfaces. */
  label: string;
  /** Lower-cased alias tokens matched against the donor name (word-boundary safe). */
  aliases: readonly string[];
  /**
   * Exact attribution sentence(s). `{donor}` and `{organization}` are the only
   * placeholders; both are substituted by `buildVisibilityStatement`.
   */
  statement: string;
  /** Non-negotiable usage rules surfaced to narrators and export builders. */
  rules: readonly string[];
}

export const VISIBILITY_STATEMENTS: readonly VisibilityStatement[] = [
  {
    donorKey: "european-union",
    label: "European Union (incl. ECHO, INTPA, NEAR)",
    aliases: ["european union", "eu", "echo", "european commission", "intpa", "devco", "europeaid"],
    statement: "This project is funded by the European Union.",
    rules: [
      "Use the exact sentence; never abbreviate the European Union to 'EU' inside the attribution sentence.",
      "Do not use the EU emblem unless the action's visibility plan grants it.",
      "Add when applicable: 'Views and opinions expressed are however those of the author(s) only and do not necessarily reflect those of the European Union. Neither the European Union nor the granting authority can be held responsible for them.'",
    ],
  },
  {
    donorKey: "us-usaid",
    label: "United States Agency for International Development",
    aliases: ["usaid", "bha", "bureau for humanitarian assistance", "american people", "us agency for international development"],
    statement:
      "This document is made possible by the generous support of the American people through the United States Agency for International Development (USAID).",
    rules: [
      "Follow the attribution with: 'The contents are the responsibility of {organization} and do not necessarily reflect the views of USAID or the United States Government.'",
      "Never imply USAID endorsement of the reported results.",
    ],
  },
  {
    donorKey: "uk-fcdo",
    label: "UK International Development (FCDO)",
    aliases: ["fcdo", "foreign commonwealth", "uk international development", "dfid", "british people", "united kingdom"],
    statement: "This material has been funded by UK International Development from the British people.",
    rules: ["Add: 'The views expressed do not necessarily reflect the UK Government's official policies.'"],
  },
  {
    donorKey: "global-fund",
    label: "The Global Fund to Fight AIDS, Tuberculosis and Malaria",
    aliases: ["global fund"],
    statement: "This project is supported by the Global Fund to Fight AIDS, Tuberculosis and Malaria.",
    rules: ["Do not alter the fund's official name.", "Do not imply endorsement of specific findings."],
  },
  {
    donorKey: "gcf",
    label: "Green Climate Fund",
    aliases: ["green climate fund", "gcf"],
    statement: "This project is funded by the Green Climate Fund.",
    rules: ["Use the official fund name in full.", "Do not imply endorsement of specific findings."],
  },
  {
    donorKey: "unhcr",
    label: "UNHCR, the UN Refugee Agency",
    aliases: ["unhcr", "un refugee agency"],
    statement: "This project is implemented in partnership with UNHCR, the UN Refugee Agency.",
    rules: ["Use the official name 'UNHCR, the UN Refugee Agency' on first mention."],
  },
];

/** Fallback for donors outside the catalog: neutral, non-implying attribution. */
export const GENERIC_VISIBILITY_STATEMENT: VisibilityStatement = {
  donorKey: "generic",
  label: "Generic donor attribution",
  aliases: [],
  statement: "This project is implemented with the support of {donor}.",
  rules: ["Use the donor's preferred official name once the reporting officer confirms it."],
};

function normalize(text: string): string {
  return ` ${(text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()} `;
}

/**
 * Resolves the visibility statement for a donor name. Alias matching is
 * word-boundary safe (aliases are compared as padded tokens). Unknown donors
 * resolve to the generic statement.
 */
export function resolveVisibilityStatement(donorName: string): VisibilityStatement {
  const normalized = normalize(donorName);
  if (!normalized.trim()) return GENERIC_VISIBILITY_STATEMENT;
  for (const entry of VISIBILITY_STATEMENTS) {
    for (const alias of entry.aliases) {
      if (normalized.includes(` ${alias} `)) return entry;
    }
  }
  return GENERIC_VISIBILITY_STATEMENT;
}

function renderStatement(statement: string, donor: string, organization?: string): string {
  return statement
    .replaceAll("{donor}", donor.trim() || "the donor")
    .replaceAll("{organization}", organization?.trim() || "the implementing organization");
}

/** Renders the exact attribution text with placeholders substituted. */
export function buildVisibilityStatement(donorName: string, implementingOrganization?: string): string {
  const resolved = resolveVisibilityStatement(donorName);
  return renderStatement(resolved.statement, donorName, implementingOrganization);
}

/**
 * Prompt block for narrators: exact sentence plus usage rules. Empty array
 * when no donor name is known (callers append nothing).
 *
 * Sections are drafted one at a time from the same report-wide context, so
 * "include it once" alone made every section include it. When
 * `attributionSection` is given (the title from `attributionSectionTitle`),
 * the block names the one section that carries it; the block stays identical
 * for every section of the report (provider prefix caching).
 */
export function visibilityPromptBlock(donorName: string, implementingOrganization?: string, attributionSection?: string): string[] {
  const donor = (donorName ?? "").trim();
  if (!donor) return [];
  const resolved = resolveVisibilityStatement(donor);
  return [
    `# Attribution and visibility (mandatory)`,
    `- Include this attribution sentence exactly once, word for word: "${renderStatement(resolved.statement, donor, implementingOrganization)}"`,
    ...resolved.rules.map((r) => `- ${renderStatement(r, donor, implementingOrganization)}`),
    attributionSection
      ? `- The attribution belongs only in the section titled "${attributionSection}". When writing any other section, do not include the attribution sentence or any disclaimer.`
      : `- Place the attribution in this report's opening narrative or acknowledgement section; never inside a table or a list item.`,
    ``,
  ];
}

const ATTRIBUTION_TITLE_RE = /acknowledg|visibility|disclaimer|attribution|donor recognition/i;

/**
 * The one section that carries the donor attribution: a section made for it
 * (acknowledgements, visibility, disclaimer) when the report has one, else the
 * first top-level section that is not an annex.
 */
export function attributionSectionTitle(
  sections: ReadonlyArray<{ title: string; level?: number; inputType?: string }>,
): string | undefined {
  const dedicated = sections.find((s) => ATTRIBUTION_TITLE_RE.test(s.title));
  if (dedicated) return dedicated.title;
  return (sections.find((s) => (s.level ?? 1) === 1 && s.inputType !== "ANNEX") ?? sections[0])?.title;
}

/**
 * The exact sentences of a donor's attribution: the statement first, then any
 * full sentence quoted in its rules (disclaimers such as the EU "Views and
 * opinions expressed…" line). Short quoted tokens ('EU') are not sentences.
 */
export function attributionSentences(donorName: string, implementingOrganization?: string): string[] {
  const donor = (donorName ?? "").trim();
  if (!donor) return [];
  const resolved = resolveVisibilityStatement(donor);
  const quoted = resolved.rules.flatMap((r) =>
    Array.from(renderStatement(r, donor, implementingOrganization).matchAll(/'([^']+)'/g), (m) => m[1]!.trim()),
  );
  return [
    renderStatement(resolved.statement, donor, implementingOrganization),
    ...quoted.filter((q) => q.split(/\s+/).length >= 6 && /[.!]$/.test(q)),
  ];
}

/**
 * Keeps the attribution in exactly one section. Outside the attribution
 * section every exact attribution/disclaimer sentence is removed; inside it,
 * the statement is added at the top when the writer left it out.
 */
export function placeAttribution(content: string, sentences: readonly string[], isAttributionSection: boolean): string {
  if (sentences.length === 0 || !content) return content;
  if (isAttributionSection) {
    return content.includes(sentences[0]!) ? content : `${sentences[0]}\n\n${content.trimStart()}`;
  }
  let out = content;
  for (const sentence of sentences) {
    out = out.split(sentence).join("");
  }
  if (out === content) return content;
  return out
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/^[ \t]+(?=\S)/, "").replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
