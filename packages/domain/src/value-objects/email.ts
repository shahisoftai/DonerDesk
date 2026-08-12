import { DomainError } from "../core/domain-error.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private readonly _value: string;
  private constructor(value: string) {
    this._value = value.toLowerCase();
  }

  static create(value: string): Email {
    if (!value || !EMAIL_RE.test(value)) {
      throw DomainError.validation("Invalid email address", { value });
    }
    return new Email(value);
  }

  toString(): string {
    return this._value;
  }

  equals(other: Email | null | undefined): boolean {
    return other !== null && other !== undefined && other._value === this._value;
  }
}
