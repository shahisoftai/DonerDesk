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
    patterns: [/\+?\d[\d\s().-]{7,}\d/g, /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g],
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
      /\b\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct)\b\.?/gi,
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

  constructor(recognizers = DEFAULT_RECOGNIZERS, defaultPolicy: PiiPolicy = "redact") {
    this.recognizers = recognizers;
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

export function createPiiFirewall(policy?: PiiPolicy): PiiFirewall {
  return new PiiFirewall(DEFAULT_RECOGNIZERS, policy ?? "redact");
}
