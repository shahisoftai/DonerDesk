import { DomainError } from "../core/domain-error.js";

export class Money {
  private readonly _amount: number;
  private readonly _currency: string;
  private constructor(amount: number, currency: string) {
    this._amount = amount;
    this._currency = currency.toUpperCase();
  }

  static create(amount: number, currency = "USD"): Money {
    if (!Number.isFinite(amount)) throw DomainError.validation("Money amount must be a number");
    if (amount < 0) throw DomainError.validation("Money amount cannot be negative");
    if (!currency || currency.length !== 3) throw DomainError.validation("Currency must be a 3-letter ISO code");
    return new Money(Math.round(amount * 100) / 100, currency);
  }

  get amount(): number {
    return this._amount;
  }

  get currency(): string {
    return this._currency;
  }

  equals(other: Money | null | undefined): boolean {
    return (
      other !== null &&
      other !== undefined &&
      other._amount === this._amount &&
      other._currency === this._currency
    );
  }

  toString(): string {
    return `${this._amount.toFixed(2)} ${this._currency}`;
  }
}
