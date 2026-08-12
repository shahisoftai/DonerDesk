import { DomainError } from "../core/domain-error.js";

export class TenantId {
  private readonly _value: string;
  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): TenantId {
    if (!/^[A-Za-z0-9_-]{3,128}$/.test(value)) {
      throw DomainError.validation("TenantId must be 3-128 URL-safe characters");
    }
    return new TenantId(value);
  }

  toString(): string {
    return this._value;
  }

  equals(other: TenantId | null | undefined): boolean {
    return other !== null && other !== undefined && other._value === this._value;
  }
}
