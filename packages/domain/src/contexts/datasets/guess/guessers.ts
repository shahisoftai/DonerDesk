import { readDay, readMonth, readNumber, readWeek, readYesNo } from "../parse-cells.js";
import type { CellValue } from "../model.js";
import type { Guesser, GuessInput } from "./types.js";
import { headerHas } from "./words.js";
import { AMOUNT_HEADER_WORDS, RATE_HEADER_WORDS, SEMANTIC_HEADER_WORDS } from "./semantic-words.js";

/** Share of samples a reader accepts. */
function share(samples: readonly CellValue[], read: (c: CellValue) => unknown): number {
  if (samples.length === 0) return 0;
  return samples.filter((c) => { const v = read(c); return v !== undefined && v !== null; }).length / samples.length;
}

const pct = (n: number): string => `${Math.round(n * 100)} %`;

/** The registry (§3.1): every guesser is a row; `guessColumns` asks them all and keeps the most confident answer per property. */
export const GUESSERS: readonly Guesser[] = [
  {
    key: "SEMANTIC_FROM_HEADER",
    guess: ({ header }: GuessInput) => {
      for (const [semantic, words] of Object.entries(SEMANTIC_HEADER_WORDS)) {
        const hit = headerHas(header, words);
        if (hit) return { semantic, confidence: 0.75, reason: `The header says "${hit}".` };
      }
      return undefined;
    },
  },
  {
    key: "MONTH_FROM_VALUES",
    guess: ({ samples }) => { const s = share(samples, readMonth) * (share(samples, readNumber) > 0.9 ? 0 : 1); return s >= 0.9 ? { kind: "MONTH", semantic: "PERIOD", confidence: 0.6 + s * 0.3, reason: `${pct(s)} of the values read as months.` } : undefined; },
  },
  {
    key: "WEEK_FROM_VALUES",
    guess: ({ samples }) => { const s = share(samples, readWeek); return s >= 0.9 ? { kind: "WEEK", semantic: "PERIOD", confidence: 0.95, reason: `${pct(s)} of the values read as epidemiological weeks.` } : undefined; },
  },
  {
    key: "DAY_FROM_VALUES",
    guess: ({ samples }) => { const s = share(samples, (c) => (typeof c === "number" ? undefined : readDay(c))); return s >= 0.9 ? { kind: "DATE", confidence: 0.85, reason: `${pct(s)} of the values read as days.` } : undefined; },
  },
  {
    key: "YES_NO_FROM_VALUES",
    guess: ({ samples }) => {
      const s = share(samples, (c) => (typeof c === "number" ? undefined : readYesNo(c)));
      return s >= 0.95 && samples.length >= 3 ? { kind: "YES_NO", confidence: 0.8, reason: "Every value is yes or no." } : undefined;
    },
  },
  {
    key: "FIGURE_FROM_VALUES",
    guess: ({ header, samples }) => {
      const s = share(samples, readNumber);
      if (s < 0.9) return undefined;
      const rate = headerHas(header, RATE_HEADER_WORDS);
      if (rate || /%/.test(header)) return { kind: "RATE", confidence: 0.85, reason: `Numbers, and the header says "${rate ?? "%"}": a rate is never added up.` };
      const money = headerHas(header, AMOUNT_HEADER_WORDS);
      if (money) return { kind: "AMOUNT", confidence: 0.8, reason: `Numbers, and the header says "${money}".` };
      const whole = samples.every((c) => { const n = readNumber(c); return n === null || n === undefined || Number.isInteger(n); });
      return whole
        ? { kind: "COUNT", confidence: 0.7 + s * 0.2, reason: `${pct(s)} of the values are whole numbers.` }
        : { kind: "COUNT", confidence: 0.55, reason: "Numbers with decimals: check whether they can be added up." };
    },
  },
  {
    key: "TEXT_FALLBACK",
    guess: ({ samples }) => (samples.length === 0 ? { kind: "TEXT", confidence: 0.3, reason: "The column is empty." } : { kind: "TEXT", confidence: 0.5, reason: "The values are words." }),
  },
];
