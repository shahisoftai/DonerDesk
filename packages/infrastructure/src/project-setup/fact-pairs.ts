/**
 * Project facts read as label–value pairs (Phase 37 §9): a cover or summary table row ("Project title<TAB>…") or a
 * "Label: value" line whose label is a known one — English, French, Spanish — is read exactly, with its line as the quote.
 * A labelled cell is the document's own statement of that fact, so it is the primary reading; anything else the model found
 * is kept beside it as an alternative. Only the first pair for a label counts. Pure.
 */
import { countriesInText, datesInText, recogniseCountry, type Proposed, type ProposedFacts, type SourceBlock } from "@donordesk/domain";

type FactKey = "name" | "code" | "donor" | "countries" | "startDate" | "endDate" | "currency";

/** Folded labels per fact: one table, so a new language or wording is one more entry. */
export const FACT_LABELS: Readonly<Record<FactKey, readonly string[]>> = {
  name: ["project title", "project name", "title of the project", "title of project", "grant title", "award title", "program title", "programme title", "titre du projet", "nom du projet", "titulo del proyecto", "nombre del proyecto"],
  code: ["project code", "project number", "project no", "award number", "grant number", "agreement number", "project id", "code du projet", "numero du projet", "codigo del proyecto", "numero del proyecto"],
  donor: ["donor", "funder", "funding agency", "funded by", "funding source", "donateur", "bailleur", "bailleur de fonds", "donante", "financiador"],
  countries: ["country", "countries", "country of implementation", "implementing country", "pays", "pays d'intervention", "pais", "paises", "pais de ejecucion"],
  startDate: ["start date", "project start date", "commencement date", "date de debut", "date de demarrage", "fecha de inicio"],
  endDate: ["end date", "project end date", "completion date", "date de fin", "fecha de fin", "fecha de finalizacion"],
  currency: ["currency", "budget currency", "devise", "moneda"],
};

const fold = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’]/g, "'").replace(/[:*]+$/g, "").replace(/\s+/g, " ").trim();

const LABEL_TO_KEY: ReadonlyMap<string, FactKey> = new Map((Object.entries(FACT_LABELS) as [FactKey, readonly string[]][]).flatMap(([key, labels]) => labels.map((l) => [l, key] as const)));

/** The value of a label–value line: the cell after the label, or the text after the first colon. */
function pairOf(line: string): { label: string; value: string } | null {
  const cells = line.split("\t").map((c) => c.trim()).filter(Boolean);
  if (cells.length >= 2) return { label: cells[0]!, value: cells.slice(1).join(" ") };
  const at = line.indexOf(":");
  return at > 0 && at < 50 ? { label: line.slice(0, at), value: line.slice(at + 1).trim() } : null;
}

const QUOTE_LIMIT = 400;

function valueOf(key: FactKey, raw: string): unknown | null {
  const value = raw.trim();
  if (!value || value.length > 300) return null;
  switch (key) {
    case "name": return value;
    case "code": return value.length <= 40 ? value : null;
    case "donor": return value;
    case "countries": {
      const named = [...new Set([...value.split(/[,;/]| and | et | y /i).map((c) => recogniseCountry(c)).filter((c): c is string => c !== null), ...countriesInText(value)])];
      return named.length > 0 ? named : null;
    }
    case "startDate":
    case "endDate": {
      const dates = datesInText(value);
      return dates.length === 1 ? dates[0]! : null;
    }
    case "currency": return /^[A-Z]{3}$/.test(value.toUpperCase()) && /^[A-Za-z]{3}$/.test(value) ? value.toUpperCase() : null;
  }
}

export type FactPairs = Partial<Record<FactKey, Proposed<unknown>>>;

/** The first labelled value of each fact in the documents' blocks (reading order), or nothing. */
export function readFactPairs(blocks: ReadonlyArray<SourceBlock>): FactPairs {
  const found: FactPairs = {};
  for (const block of blocks) {
    if (block.docKind === "WORK_PLAN_GANTT") continue;
    for (const line of block.text.split("\n")) {
      const pair = pairOf(line);
      const key = pair ? LABEL_TO_KEY.get(fold(pair.label)) : undefined;
      if (!pair || !key || found[key]) continue;
      const value = valueOf(key, pair.value);
      if (value === null) continue;
      found[key] = {
        value, sourceQuote: line.replace(/\s+/g, " ").trim().slice(0, QUOTE_LIMIT),
        sourceRef: { documentId: block.documentId, block: block.index, ...(block.page !== undefined ? { page: block.page } : {}) },
        confidence: "HIGH", status: "PROPOSED",
      };
    }
  }
  return found;
}

export type { ProposedFacts };
