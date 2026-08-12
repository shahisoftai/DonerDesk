import type { ILLMProvider, LLMCompletionInput, LLMCompletionResult } from "@donordesk/application";

export class StubLLMProvider implements ILLMProvider {
  readonly name = "stub";
  readonly model = "stub-v1";
  readonly promptVersion = "p1";

  async complete(input: LLMCompletionInput): Promise<LLMCompletionResult> {
    const text = this.generate(input);
    return {
      text,
      parsed: input.jsonMode ? this.tryJson(text) : undefined,
      model: this.model,
      promptVersion: this.promptVersion,
      usage: { inputTokens: input.userPrompt.length, outputTokens: text.length },
    };
  }

  private generate(input: LLMCompletionInput): string {
    const sys = input.systemPrompt.toLowerCase();
    const usr = input.userPrompt;

    if (input.jsonMode) {
      if (sys.includes("template") && sys.includes("sections")) {
        return JSON.stringify({
          sections: [
            { id: "s1", title: "Executive Summary", description: "Brief overview", inputType: "NARRATIVE", required: true, evidenceNeeded: "Activity summaries" },
            { id: "s2", title: "Project Progress", description: "Status vs. plan", inputType: "NARRATIVE", required: true, evidenceNeeded: "Activity updates" },
            { id: "s3", title: "Indicator Progress", description: "Indicator table", inputType: "INDICATOR_TABLE", required: true, evidenceNeeded: "Indicator data" },
            { id: "s4", title: "Achievements", description: "Highlights", inputType: "NARRATIVE", required: true, evidenceNeeded: "Verified evidence" },
            { id: "s5", title: "Challenges", description: "Issues faced", inputType: "NARRATIVE", required: true, evidenceNeeded: "Field reports" },
            { id: "s6", title: "Lessons Learned", description: "Insights", inputType: "NARRATIVE", required: false, evidenceNeeded: "" },
            { id: "s7", title: "Risks & Mitigation", description: "Top risks", inputType: "NARRATIVE", required: false, evidenceNeeded: "" },
            { id: "s8", title: "Beneficiary Reach", description: "Disaggregation", inputType: "TABLE", required: true, evidenceNeeded: "Attendance sheets" },
            { id: "s9", title: "Annex List", description: "Attachments", inputType: "ANNEX", required: true, evidenceNeeded: "All verified evidence" },
          ],
        });
      }
      if (sys.includes("tag") || sys.includes("classify")) {
        const indicators = (input.userPrompt.match(/"code"\s*:\s*"([^"]+)"/g) ?? []).map((s) => s.split('"')[3]).filter(Boolean);
        const tags: Array<{ field: string; value: string; confidence: string; accepted: boolean }> = [
          { field: "evidenceType", value: "OTHER", confidence: "LOW", accepted: false },
        ];
        if (indicators[0]) tags.push({ field: "indicatorId", value: indicators[0], confidence: "MEDIUM", accepted: false });
        return JSON.stringify({
          summary: "Stub summary of the uploaded document. Replace with real LLM in production.",
          tags,
          sensitivityWarning: undefined,
        });
      }
      if (sys.includes("polish") || sys.includes("narrative")) {
        return JSON.stringify({ narrative: `Polished narrative based on: ${usr.slice(0, 200)}` });
      }
    }

    if (sys.includes("template") && sys.includes("sections")) {
      return [
        "Executive Summary",
        "Project Progress",
        "Indicator Progress",
        "Achievements",
        "Challenges",
        "Lessons Learned",
        "Risks & Mitigation",
        "Beneficiary Reach",
        "Annex List",
      ].join("\n");
    }

    if (sys.includes("polish") || sys.includes("narrative")) {
      return `During the reporting period, the team implemented activities as planned. ${usr.slice(0, 300)}`;
    }

    return `[Stub LLM response — replace provider in production.]\n\n${usr.slice(0, 400)}`;
  }

  private tryJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}
