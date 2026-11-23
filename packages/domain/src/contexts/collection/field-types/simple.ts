import { asNumber, isRealDate } from "../answer-values.js";
import { FILE_ID, type FormField } from "../form-model.js";
import { bad, ok, type FieldCtx, type FieldTypeDef } from "./contract.js";

const at = (f: FormField, ctx: FieldCtx): string => ctx.prefix + f.key;
const label = (f: FormField): string => f.label;

const NUMBER: FieldTypeDef = {
  asks: true, takesRange: true,
  validate(f, raw, ctx) {
    const n = asNumber(raw);
    if (n === null) return bad(at(f, ctx), `${label(f)} must be a number.`, "NUMBER", { label: f.label });
    if (f.min !== undefined && n < f.min) return bad(at(f, ctx), `${label(f)} cannot be below ${f.min}.`, "MIN", { label: f.label, min: f.min });
    if (f.max !== undefined && n > f.max) return bad(at(f, ctx), `${label(f)} cannot be above ${f.max}.`, "MAX", { label: f.label, max: f.max });
    return ok(n);
  },
};

const DATE: FieldTypeDef = {
  asks: true,
  validate(f, raw, ctx) {
    const t = String(raw).trim();
    return isRealDate(t) ? ok(t) : bad(at(f, ctx), `${label(f)} must be a real date written as YYYY-MM-DD.`, "DATE", { label: f.label });
  },
};

const YES_NO: FieldTypeDef = {
  asks: true,
  validate(f, raw, ctx) {
    const t = String(raw).trim().toLowerCase();
    if (raw === true || ["yes", "y", "true", "1"].includes(t)) return ok(true);
    if (raw === false || ["no", "n", "false", "0"].includes(t)) return ok(false);
    return bad(at(f, ctx), `${label(f)} should be Yes or No.`, "YES_NO", { label: f.label });
  },
};

const GPS: FieldTypeDef = {
  asks: true,
  validate(f, raw, ctx) {
    const g = raw as { lat?: unknown; lon?: unknown };
    const lat = asNumber(g?.lat);
    const lon = asNumber(g?.lon);
    if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return bad(at(f, ctx), `${label(f)} must be a latitude (−90 to 90) and a longitude (−180 to 180).`, "GPS", { label: f.label });
    return ok({ lat, lon });
  },
};

const FILE: FieldTypeDef = {
  asks: true,
  validate(f, raw, ctx) {
    const t = String(raw).trim();
    return FILE_ID.test(t) ? ok(t) : bad(at(f, ctx), `${label(f)}: attach a photo or document first.`, "FILE", { label: f.label });
  },
};

const SIGNATURE: FieldTypeDef = {
  asks: true,
  validate(f, raw, ctx) {
    const t = String(raw).trim();
    return FILE_ID.test(t) ? ok(t) : bad(at(f, ctx), `${label(f)}: sign first.`, "FILE", { label: f.label });
  },
};

const text = (): FieldTypeDef => ({
  asks: true,
  validate(f, raw, ctx) {
    const t = String(raw).trim();
    const limit = f.maxLength ?? 2000;
    return t.length > limit ? bad(at(f, ctx), `${label(f)} is longer than ${limit} characters.`, "TOO_LONG", { label: f.label, max: limit }) : ok(t);
  },
});

export const SIMPLE_FIELD_TYPES = { NUMBER, DATE, YES_NO, GPS, FILE, SIGNATURE, TEXT: text(), PLACE: text() } as const;
