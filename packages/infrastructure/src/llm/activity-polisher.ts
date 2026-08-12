import type { IActivityPolisher } from "@donordesk/application";

export class StubActivityPolisher implements IActivityPolisher {
  async polish(input: { roughSummary: string; achievements: string; challenges: string; lessonsLearned: string }): Promise<{ narrative: string; model: string }> {
    const sentences = [
      "During the reporting period, the team implemented the planned activities.",
      input.roughSummary ? `Field notes: ${this.truncate(input.roughSummary, 300)}` : "",
      input.achievements ? `Key achievements include: ${this.truncate(input.achievements, 200)}.` : "",
      input.challenges ? `Challenges encountered: ${this.truncate(input.challenges, 200)}.` : "",
      input.lessonsLearned ? `Lessons learned: ${this.truncate(input.lessonsLearned, 200)}.` : "",
    ].filter(Boolean);
    return { narrative: sentences.join(" "), model: "stub-v1" };
  }

  private truncate(s: string, n: number): string {
    return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
  }
}
