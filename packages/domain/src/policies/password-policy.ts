import { DomainError } from "../core/domain-error.js";

export type PasswordCharacterClass = "lower" | "upper" | "digit" | "symbol";

const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

export interface PasswordPolicyResult {
  ok: boolean;
  errors: string[];
  classesCovered: PasswordCharacterClass[];
}

export class PasswordPolicy {
  static readonly MIN_LENGTH = MIN_LENGTH;
  static readonly MAX_LENGTH = MAX_LENGTH;
  static readonly REQUIRED_CLASS_COUNT = 3;
  static readonly CLASSES: PasswordCharacterClass[] = ["lower", "upper", "digit", "symbol"];

  static validate(input: string): PasswordPolicyResult {
    const errors: string[] = [];
    if (typeof input !== "string") {
      return { ok: false, errors: ["Password is required"], classesCovered: [] };
    }
    if (input.length < MIN_LENGTH) errors.push(`Password must be at least ${MIN_LENGTH} characters.`);
    if (input.length > MAX_LENGTH) errors.push(`Password must be at most ${MAX_LENGTH} characters.`);
    if (/\s/.test(input)) errors.push("Password must not contain whitespace.");
    if (/[\u0000-\u001f\u007f]/.test(input)) errors.push("Password must not contain control characters.");

    const classesCovered = this.detectClasses(input);
    if (classesCovered.length < this.REQUIRED_CLASS_COUNT) {
      errors.push(`Password must contain at least ${this.REQUIRED_CLASS_COUNT} of: lowercase, uppercase, digit, symbol.`);
    }
    return { ok: errors.length === 0, errors, classesCovered };
  }

  static assert(input: string): void {
    const result = this.validate(input);
    if (!result.ok) throw DomainError.validation(result.errors[0] ?? "Password does not meet policy", { errors: result.errors });
  }

  static strength(input: string): { score: 0 | 1 | 2 | 3 | 4; label: "Very weak" | "Weak" | "Fair" | "Strong" | "Excellent"; classesCovered: PasswordCharacterClass[] } {
    const result = this.validate(input);
    const classes = result.classesCovered.length;
    let score: 0 | 1 | 2 | 3 | 4 = 0;
    if (input.length >= MIN_LENGTH && classes >= 3) score = 3;
    if (input.length >= 16 && classes >= 3) score = 4;
    if (input.length < MIN_LENGTH) score = 0;
    else if (classes < 2) score = 1;
    else if (classes < 3) score = 2;
    const labels = { 0: "Very weak", 1: "Weak", 2: "Fair", 3: "Strong", 4: "Excellent" } as const;
    return { score, label: labels[score], classesCovered: result.classesCovered };
  }

  private static detectClasses(input: string): PasswordCharacterClass[] {
    const classes: PasswordCharacterClass[] = [];
    if (/[a-z]/.test(input)) classes.push("lower");
    if (/[A-Z]/.test(input)) classes.push("upper");
    if (/[0-9]/.test(input)) classes.push("digit");
    if (/[^A-Za-z0-9\s]/.test(input)) classes.push("symbol");
    return classes;
  }
}
