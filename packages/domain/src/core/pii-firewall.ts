export type PiiEntityType =
  | "EMAIL"
  | "PHONE"
  | "NATIONAL_ID"
  | "CREDIT_CARD"
  | "NAME"
  | "ADDRESS"
  | "DATE_OF_BIRTH"
  | "PASSPORT";

export interface PiiMatch {
  type: PiiEntityType;
  value: string;
  start: number;
  end: number;
  score: number;
}

export type PiiPolicy = "reject" | "redact" | "transform" | "allow";

export interface PiiDetectionResult {
  hasPii: boolean;
  matches: PiiMatch[];
  policy: PiiPolicy;
  redactedText?: string;
  transformedText?: string;
}

interface Recognizer {
  type: PiiEntityType;
  patterns: RegExp[];
  score: number;
  normalize?: (match: string) => string;
}

const DEFAULT_RECOGNIZERS: Recognizer[] = [
  {
    type: "EMAIL",
    patterns: [/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g],
    score: 0.95,
    normalize: (m) => m.toLowerCase(),
  },
  {
    type: "PHONE",
    // A phone number has a shape: a leading +, a bracketed area code, a leading 0 with separators, or 3-3-4 groups. A bare
    // run of digits, dots, hyphens and tabs is NOT one: it is a year range (2021-2024), a table of amounts or a decimal.
    patterns: [
      /\+\d[\d ().-]{6,}\d/g,
      /\(\d{2,4}\)[ .-]?\d{3,4}[ .-]?\d{3,4}\b/g,
      /\b0\d{2,4}[ .-]\d{3,4}[ .-]?\d{3,4}\b/g,
      /\b\d{3}[ .-]\d{3}[ .-]\d{4}\b/g,
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    ],
    score: 0.8,
    normalize: (m) => m.replace(/\D/g, ""),
  },
  {
    type: "NATIONAL_ID",
    patterns: [/\b\d{5}-?\d{7}-?\d\b/g, /\b[A-Z]{1,2}\d{6,10}\b/g],
    score: 0.75,
  },
  {
    type: "CREDIT_CARD",
    patterns: [/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g],
    score: 0.9,
  },
  {
    type: "DATE_OF_BIRTH",
    patterns: [
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi,
    ],
    score: 0.7,
  },
  {
    type: "ADDRESS",
    patterns: [
      // A house number, one to four name words on the same line, then the street word as a word of its own ("12 Baker St.").
      // (Without the word boundary and the single line, "10 targeted health facilities ... checklist" matched: "checklist" ends in "st".)
      /\b\d{1,5}[ ]+(?:[A-Za-z0-9'.-]+[ ]+){1,4}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct)\b\.?/gi,
    ],
    score: 0.65,
  },
  {
    type: "PASSPORT",
    patterns: [/\b[A-Z]{1,2}\d{6,9}\b/g],
    score: 0.7,
  },
];

export class PiiFirewall {
  private readonly recognizers: Recognizer[];
  private readonly defaultPolicy: PiiPolicy;

  constructor(recognizers = DEFAULT_RECOGNIZERS, defaultPolicy: PiiPolicy = "redact", keep: ReadonlyArray<PiiEntityType> = []) {
    this.recognizers = keep.length === 0 ? recognizers : recognizers.filter((r) => !keep.includes(r.type));
    this.defaultPolicy = defaultPolicy;
  }

  detect(text: string): PiiMatch[] {
    const matches: PiiMatch[] = [];

    for (const recognizer of this.recognizers) {
      for (const pattern of recognizer.patterns) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
          matches.push({
            type: recognizer.type,
            value: match[0]!,
            start: match.index,
            end: match.index + match[0]!.length,
            score: recognizer.score,
          });
        }
      }
    }

    const sorted = matches.sort((a, b) => a.start - b.start || b.score - a.score || b.end - a.end);
    const resolved: PiiMatch[] = [];
    for (const match of sorted) {
      const previous = resolved[resolved.length - 1];
      if (!previous || match.start >= previous.end) {
        resolved.push({ ...match });
        continue;
      }
      const end = Math.max(previous.end, match.end);
      if (match.score > previous.score) {
        previous.type = match.type;
        previous.score = match.score;
      }
      previous.end = end;
      previous.value = text.slice(previous.start, end);
    }
    return resolved;
  }

  redact(text: string, replacement = "[REDACTED]"): string {
    const matches = this.detect(text);
    if (matches.length === 0) return text;

    let result = "";
    let lastEnd = 0;
    for (const match of matches) {
      result += text.slice(lastEnd, match.start);
      result += replacement;
      lastEnd = match.end;
    }
    result += text.slice(lastEnd);
    return result;
  }

  apply(text: string, policy: PiiPolicy = this.defaultPolicy): PiiDetectionResult {
    const matches = this.detect(text);

    if (matches.length === 0) {
      return { hasPii: false, matches: [], policy };
    }

    switch (policy) {
      case "reject":
        return {
          hasPii: true,
          matches,
          policy: "reject",
        };

      case "redact": {
        const redactedText = this.redact(text);
        return {
          hasPii: true,
          matches,
          policy: "redact",
          redactedText,
        };
      }

      case "transform":
        return {
          hasPii: true,
          matches,
          policy: "transform",
          transformedText: this.transform(text, matches),
        };

      case "allow":
      default:
        return {
          hasPii: true,
          matches,
          policy: "allow",
        };
    }
  }

  private transform(text: string, matches: PiiMatch[]): string {
    let result = "";
    let lastEnd = 0;
    for (const match of matches) {
      result += text.slice(lastEnd, match.start);
      result += this.getMaskedValue(match);
      lastEnd = match.end;
    }
    result += text.slice(lastEnd);
    return result;
  }

  private getMaskedValue(match: PiiMatch): string {
    switch (match.type) {
      case "EMAIL":
        return "[EMAIL]";
      case "PHONE":
        return "[PHONE]";
      case "NATIONAL_ID":
        return "[ID]";
      case "CREDIT_CARD":
        return "[CARD]";
      case "DATE_OF_BIRTH":
        return "[DOB]";
      case "ADDRESS":
        return "[ADDRESS]";
      case "PASSPORT":
        return "[PASSPORT]";
      case "NAME":
      default:
        return "[NAME]";
    }
  }

  preProcessForLlm(text: string): string {
    return this.redact(text);
  }
}

export function createPiiFirewall(policy?: PiiPolicy, keep: ReadonlyArray<PiiEntityType> = []): PiiFirewall {
  return new PiiFirewall(DEFAULT_RECOGNIZERS, policy ?? "redact", keep);
}

/** The policy used when nothing is configured. */
export const DEFAULT_PII_POLICY: PiiPolicy = "redact";

/**
 * Validates a configured policy. One place, so the provider factory, the
 * evidence package builder and the record chunks cannot disagree about what
 * the setting means.
 */
export function resolvePiiPolicy(raw: string | undefined): PiiPolicy {
  const policy = (raw ?? DEFAULT_PII_POLICY) as PiiPolicy;
  if (!["reject", "redact", "transform", "allow"].includes(policy)) {
    throw new Error(`Invalid LLM_PII_POLICY: ${policy}`);
  }
  return policy;
}

/**
 * Redacts text for a model, honouring the policy. "allow" sends it unchanged. `keep` names kinds of entity that are left
 * as they are for a caller whose text is not about people (a project document's dates are content, not birth dates).
 */
export function redactForLlm(text: string, policy: PiiPolicy = DEFAULT_PII_POLICY, keep: ReadonlyArray<PiiEntityType> = []): string {
  if (!text) return text;
  if (policy === "allow") return text;
  if (policy === "reject") {
    const firewall = createPiiFirewall(policy, keep);
    const result = firewall.apply(text, policy);
    if (result.hasPii) throw new Error("LLM request rejected because it contains PII");
    return text;
  }
  return createPiiFirewall(policy, keep).redact(text);
}
