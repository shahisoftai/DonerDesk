import { DomainError } from "../core/domain-error.js";

export class Url {
  private readonly _value: string;
  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): Url {
    if (!value) throw DomainError.validation("Url required");
    try {
      new URL(value);
    } catch {
      throw DomainError.validation("Invalid URL", { value });
    }
    return new Url(value);
  }

  static optional(value: string | null | undefined): Url | undefined {
    if (!value) return undefined;
    return Url.create(value);
  }

  toString(): string {
    return this._value;
  }

  equals(other: Url | null | undefined): boolean {
    return other !== null && other !== undefined && other._value === this._value;
  }
}
