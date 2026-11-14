import type { CellValue } from "../model.js";

/** What one guesser thinks of one column. The confirm screen shows `reason`; nothing is applied until the person confirms (§1.1). */
export interface ColumnGuess {
  kind?: string | undefined;
  semantic?: string | undefined;
  /** 0..1. Below 0.6 the confirm screen highlights the column. */
  confidence: number;
  reason: string;
}

export interface GuessInput {
  header: string;
  /** Up to 200 non-empty cells from the column. */
  samples: readonly CellValue[];
}

export interface Guesser {
  key: string;
  guess(input: GuessInput): ColumnGuess | undefined;
}
