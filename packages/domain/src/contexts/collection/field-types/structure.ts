import { evaluateFormFormula, parseFormFormula, roundTo } from "../calc-expression.js";
import { ok, type FieldTypeDef } from "./contract.js";

/** A heading and a block of read-only text take no answer: the engine only uses them to group and explain the questions. */
const SECTION: FieldTypeDef = { asks: false, validate: () => ok(undefined) };
const NOTE: FieldTypeDef = { asks: false, validate: () => ok(undefined) };

const CALCULATED: FieldTypeDef = {
  asks: true,
  computed: true,
  validate(f, _raw, ctx) {
    const parsed = parseFormFormula(f.formula ?? "");
    if (!parsed.ok) return ok(undefined);
    const n = evaluateFormFormula(parsed.expr, ctx.read);
    // A missing term gives no answer (never 0).
    return ok(n === null ? undefined : roundTo(n, f.decimals ?? 2));
  },
  checkDefinition(f, ctx) {
    const parsed = parseFormFormula(f.formula ?? "");
    if (!parsed.ok) return [parsed.reason];
    const unknown = parsed.refs.map((r) => r.split(".")[0]!).find((root) => !ctx.earlier.has(root));
    return unknown ? [`The formula names "${unknown}", which must be an earlier field of the form.`] : [];
  },
};

export const STRUCTURE_FIELD_TYPES = { SECTION, NOTE, CALCULATED } as const;
