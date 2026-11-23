import type { FormField, FormProblem, HowVerified } from "@donordesk/domain/contexts/collection/index.js";

/** What a field renderer may use: translation, files, places and the phone's position. Passed down, never imported, so a renderer stays small. */
export interface FillContext {
  t(key: string, params?: Record<string, string | number>): string;
  /** Sends a photo, document or drawn signature; without it a file question cannot be answered. */
  uploadFile?: ((file: File, fieldKey: string) => Promise<{ ok: true; id: string; name: string } | { ok: false; message: string }>) | undefined;
  placeNames?: ReadonlyArray<string> | undefined;
  /** Names of files already attached, by answer id, for "Attached: …". */
  fileNames: Readonly<Record<string, string>>;
  rememberFile(id: string, name: string): void;
  /** The phone's position, for a GPS question; resolves to the two numbers or a sentence. */
  locate(): Promise<{ ok: true; lat: string; lon: string } | { ok: false; message: string }>;
  /** The problem sentence for a path (`blocks[0].name`), when the person has tried to send. */
  problemAt(path: string): string | undefined;
  /** The wording language in use, for right-to-left layout of free text. */
  language: string | undefined;
  /** How the answers that ask for it were established, by field key (top-level questions only). */
  how: Readonly<Record<string, HowVerified>>;
  setHow(key: string, mode: HowVerified | undefined): void;
  /** Only a form that is being filled in can be changed; a read-only view draws the same fields without inputs. */
  readOnly: boolean;
}

export interface FieldViewProps {
  field: FormField;
  value: unknown;
  onChange(value: unknown): void;
  /** Where this question sits for problems: "" at the top, `blocks[1].` inside a repeat row. */
  prefix: string;
  ctx: FillContext;
  /** The answers around it (a repeat row sees its own row), for a calculated field. */
  scope: Readonly<Record<string, unknown>>;
}

export type FieldView = (props: FieldViewProps) => React.ReactNode;
export type { FormProblem };
