import { DomainError } from "../core/domain-error.js";

export class IndicatorCode {
  private readonly _value: string;
  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): IndicatorCode {
    const v = (value ?? "").trim();
    if (!v) throw DomainError.validation("IndicatorCode required");
    if (v.length > 64) throw DomainError.validation("IndicatorCode too long");
    return new IndicatorCode(v.toUpperCase());
  }

  toString(): string {
    return this._value;
  }

  equals(other: IndicatorCode | null | undefined): boolean {
    return other !== null && other !== undefined && other._value === this._value;
  }
}
