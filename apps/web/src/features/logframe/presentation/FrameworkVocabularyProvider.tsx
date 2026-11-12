"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_VOCABULARY, documentName, isDefaultVocabulary, levelName, type FrameworkVocabulary } from "@donordesk/domain/contexts/logframe/framework-vocabulary.js";

const VocabularyContext = createContext<FrameworkVocabulary>(DEFAULT_VOCABULARY);

/** Hands the project's donor words to every logframe screen below it. Plain data in, so a server page can pass it. */
export function FrameworkVocabularyProvider({ vocabulary, children }: { vocabulary?: FrameworkVocabulary | undefined; children: ReactNode }) {
  return <VocabularyContext.Provider value={vocabulary ?? DEFAULT_VOCABULARY}>{children}</VocabularyContext.Provider>;
}

/** `name("OUTPUT")` is what this project's donor calls that level; an unknown level reads as it was stored. */
export function useLevelName(): (level: string) => string {
  const vocabulary = useContext(VocabularyContext);
  return (level) => (level in vocabulary.levels ? levelName(level as keyof FrameworkVocabulary["levels"], vocabulary) : level);
}

/** The donor's word for a level, or undefined when the project uses the default words (so a translated default can show instead). */
export function useDonorLevelWord(): (level: string) => string | undefined {
  const vocabulary = useContext(VocabularyContext);
  return (level) => (!isDefaultVocabulary(vocabulary) && level in vocabulary.levels ? vocabulary.levels[level as keyof FrameworkVocabulary["levels"]] : undefined);
}

export function useFrameworkDocumentName(): string {
  return documentName(useContext(VocabularyContext));
}
