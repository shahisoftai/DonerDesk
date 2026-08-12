import { DomainError } from "../core/domain-error.js";

export class UserId {
  private readonly _value: string;
  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): UserId {
    if (!value) throw DomainError.validation("UserId required");
    return new UserId(value);
  }

  static generate(): UserId {
    return new UserId(crypto.randomUUID());
  }

  toString(): string {
    return this._value;
  }

  equals(other: UserId | null | undefined): boolean {
    return other !== null && other !== undefined && other._value === this._value;
  }
}
