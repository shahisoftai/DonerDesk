import { DomainError } from "../core/domain-error.js";

export class DateRange {
  private readonly _start: Date;
  private readonly _end: Date;
  private constructor(start: Date, end: Date) {
    this._start = start;
    this._end = end;
  }

  static create(start: Date, end: Date): DateRange {
    if (!(start instanceof Date) || isNaN(start.getTime())) {
      throw DomainError.validation("Invalid start date");
    }
    if (!(end instanceof Date) || isNaN(end.getTime())) {
      throw DomainError.validation("Invalid end date");
    }
    if (start.getTime() > end.getTime()) {
      throw DomainError.validation("DateRange start must be before end");
    }
    return new DateRange(new Date(start.getTime()), new Date(end.getTime()));
  }

  get start(): Date {
    return new Date(this._start.getTime());
  }

  get end(): Date {
    return new Date(this._end.getTime());
  }

  contains(d: Date): boolean {
    const t = d.getTime();
    return t >= this._start.getTime() && t <= this._end.getTime();
  }

  overlaps(other: DateRange): boolean {
    return this._start.getTime() <= other._end.getTime() && other._start.getTime() <= this._end.getTime();
  }

  days(): number {
    const ms = this._end.getTime() - this._start.getTime();
    return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
  }

  equals(other: DateRange | null | undefined): boolean {
    return (
      other !== null &&
      other !== undefined &&
      other._start.getTime() === this._start.getTime() &&
      other._end.getTime() === this._end.getTime()
    );
  }
}
