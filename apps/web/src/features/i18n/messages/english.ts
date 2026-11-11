import type { Messages } from "../domain/translate.ts";
import { en } from "./en.ts";

/** English alone: the source language and the fallback. The browser always has this; the other languages are fetched when a person uses one (`loaders.ts`). */
export const ENGLISH_ONLY: Messages = en;
