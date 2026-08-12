import { createHash } from "node:crypto";
import type { Sector } from "@donordesk/domain";

export interface LessonPattern {
  id: string;
  tenantId: string;
  sector: Sector;
  donorName: string;
  patternType: "recurring_challenge" | "mitigation_success" | "best_practice" | "risk_signal";
  title: string;
  description: string;
  frequency: number;
  projectsAffected: string[];
  mitigationStrategies: string[];
  evidenceReferences: string[];
  firstObserved: Date;
  lastObserved: Date;
  confidence: number;
}

export interface LessonsLearnedQuery {
  tenantId: string;
  sector?: Sector;
  donorName?: string;
  patternType?: LessonPattern["patternType"];
  startDate?: Date;
  endDate?: Date;
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

export interface LessonAggregation {
  sector: Sector;
  donorName: string;
  totalPatterns: number;
  challenges: number;
  mitigations: number;
  bestPractices: number;
  topRiskSignals: string[];
  commonChallenges: string[];
  successfulMitigations: Array<{ strategy: string; successRate: number }>;
}

export interface ProjectLessonsSummary {
  projectId: string;
  challengesSurfaces: number;
  mitigationsApplied: number;
  lessonsIncorporated: boolean;
  lastLessonDate?: Date;
}

const CHALLENGE_KEYWORDS = [
  "challenge", "difficulty", "delay", "shortage", "gap", "issue", "problem",
  "constraint", "barrier", "obstacle", "failure", "risk", "threat", "concern",
  "lack", "insufficient", "inadequate", "weakness",
];

const MITIGATION_KEYWORDS = [
  "solution", "mitigation", "response", "strategy", "approach", "measure",
  "intervention", "adjustment", "adaptation", "workaround", "remedy",
  "countermeasure", "prevention", "precaution", "contingency",
];

const SUCCESS_INDICATORS = [
  "success", "achieved", "improved", "effective", "efficient", "resolved",
  "overcame", "managed", "controlled", "reduced", "minimized",
];

export class LessonsLearnedMiner {
  private constructor() {}

  static mineFromActivityUpdates(
    updates: Array<{
      id: string;
      tenantId: string;
      projectId: string;
      challenges: string;
      lessonsLearned: string;
      achievements: string;
      sector: Sector;
      donorName: string;
      activityDate: Date;
    }>,
  ): LessonPattern[] {
    if (updates.length === 0) return [];
    const groups = groupByScope(updates);
    if (groups.size > 1) {
      return Array.from(groups.values()).flatMap((group) => this.mineFromActivityUpdates(group));
    }
    const patterns: LessonPattern[] = [];
    const challengeMap = new Map<string, { text: string; count: number; projectIds: Set<string>; dates: Date[] }>();
    const mitigationMap = new Map<string, { text: string; count: number; projectIds: Set<string>; dates: Date[] }>();

    for (const update of updates) {
      const challenges = this.extractSentences(update.challenges, CHALLENGE_KEYWORDS);
      const lessons = this.extractSentences(update.lessonsLearned, MITIGATION_KEYWORDS);
      const achievements = this.extractSentences(update.achievements, SUCCESS_INDICATORS);

      for (const challenge of challenges) {
        const normalized = this.normalizeText(challenge);
        const existing = challengeMap.get(normalized);
        if (existing) {
          existing.count++;
          existing.projectIds.add(update.projectId);
          existing.dates.push(update.activityDate);
        } else {
          challengeMap.set(normalized, {
            text: challenge,
            count: 1,
            projectIds: new Set([update.projectId]),
            dates: [update.activityDate],
          });
        }
      }

      for (const lesson of lessons) {
        const normalized = this.normalizeText(lesson);
        const existing = mitigationMap.get(normalized);
        if (existing) {
          existing.count++;
          existing.projectIds.add(update.projectId);
          existing.dates.push(update.activityDate);
        } else {
          mitigationMap.set(normalized, {
            text: lesson,
            count: 1,
            projectIds: new Set([update.projectId]),
            dates: [update.activityDate],
          });
        }
      }

      for (const success of achievements) {
        const normalized = this.normalizeText(success);
        const existing = mitigationMap.get(normalized);
        if (existing) {
          existing.count++;
          existing.projectIds.add(update.projectId);
          existing.dates.push(update.activityDate);
        } else {
          mitigationMap.set(normalized, {
            text: success,
            count: 1,
            projectIds: new Set([update.projectId]),
            dates: [update.activityDate],
          });
        }
      }
    }

    for (const [normalized, data] of challengeMap) {
      if (data.count >= 2) {
        patterns.push(this.createPattern(
          `challenge-${normalized.slice(0, 20)}`,
          updates[0]?.tenantId ?? "",
          updates[0]?.sector ?? "MULTI_SECTOR",
          updates[0]?.donorName ?? "Unknown",
          "recurring_challenge",
          this.generateTitle(data.text, "recurring_challenge"),
          data.text,
          data.count,
          Array.from(data.projectIds),
          this.deriveMitigation(normalized, mitigationMap),
          data.dates[0] ?? new Date(),
          data.dates[data.dates.length - 1] ?? new Date(),
          this.calculateConfidence(data.count, data.projectIds.size),
        ));
      }
    }

    for (const [normalized, data] of mitigationMap) {
      if (data.count >= 2) {
        const challengeKeywords = CHALLENGE_KEYWORDS.filter((k) => data.text.toLowerCase().includes(k));
        const patternType: LessonPattern["patternType"] = challengeKeywords.length > 0
          ? "mitigation_success"
          : "best_practice";

        patterns.push(this.createPattern(
          `mitigation-${normalized.slice(0, 20)}`,
          updates[0]?.tenantId ?? "",
          updates[0]?.sector ?? "MULTI_SECTOR",
          updates[0]?.donorName ?? "Unknown",
          patternType,
          this.generateTitle(data.text, patternType),
          data.text,
          data.count,
          Array.from(data.projectIds),
          [],
          data.dates[0] ?? new Date(),
          data.dates[data.dates.length - 1] ?? new Date(),
          this.calculateConfidence(data.count, data.projectIds.size),
        ));
      }
    }

    return patterns;
  }

  static mineFromChecklistItems(
    items: Array<{
      id: string;
      tenantId: string;
      projectId: string;
      title: string;
      description: string;
      status: string;
      sector: Sector;
      donorName: string;
      createdAt: Date;
      resolvedAt?: Date;
    }>,
  ): LessonPattern[] {
    if (items.length === 0) return [];
    const groups = groupByScope(items);
    if (groups.size > 1) {
      return Array.from(groups.values()).flatMap((group) => this.mineFromChecklistItems(group));
    }
    const patterns: LessonPattern[] = [];
    const issueMap = new Map<string, { title: string; count: number; projectIds: Set<string>; sector: Sector; donorName: string; dates: Date[] }>();

    for (const item of items) {
      if (item.status === "RESOLVED" && item.resolvedAt) {
        const normalized = this.normalizeText(item.title);
        const existing = issueMap.get(normalized);
        if (existing) {
          existing.count++;
          existing.projectIds.add(item.projectId);
          existing.dates.push(item.resolvedAt);
        } else {
          issueMap.set(normalized, {
            title: item.title,
            count: 1,
            projectIds: new Set([item.projectId]),
            sector: item.sector,
            donorName: item.donorName,
            dates: [item.resolvedAt],
          });
        }
      }
    }

    for (const [normalized, data] of issueMap) {
      if (data.count >= 2) {
        patterns.push(this.createPattern(
          `checklist-${normalized.slice(0, 20)}`,
          items[0]?.tenantId ?? "",
          data.sector,
          data.donorName,
          "mitigation_success",
          `Resolved: ${data.title.slice(0, 50)}`,
          data.title,
          data.count,
          Array.from(data.projectIds),
          [],
          data.dates[0] ?? new Date(),
          data.dates[data.dates.length - 1] ?? new Date(),
          this.calculateConfidence(data.count, data.projectIds.size),
        ));
      }
    }

    return patterns;
  }

  static aggregateBySectorAndDonor(patterns: LessonPattern[]): LessonAggregation[] {
    const aggregationMap = new Map<string, LessonAggregation>();

    for (const pattern of patterns) {
      const key = `${pattern.sector}:${pattern.donorName}`;
      const existing = aggregationMap.get(key);
      if (existing) {
        existing.totalPatterns++;
        if (pattern.patternType === "recurring_challenge") existing.challenges++;
        if (pattern.patternType === "mitigation_success") existing.mitigations++;
        if (pattern.patternType === "best_practice") existing.bestPractices++;
        if (pattern.patternType === "risk_signal") {
          existing.topRiskSignals.push(pattern.title);
        }
      } else {
        aggregationMap.set(key, {
          sector: pattern.sector,
          donorName: pattern.donorName,
          totalPatterns: 1,
          challenges: pattern.patternType === "recurring_challenge" ? 1 : 0,
          mitigations: pattern.patternType === "mitigation_success" ? 1 : 0,
          bestPractices: pattern.patternType === "best_practice" ? 1 : 0,
          topRiskSignals: pattern.patternType === "risk_signal" ? [pattern.title] : [],
          commonChallenges: [],
          successfulMitigations: [],
        });
      }
    }

    return Array.from(aggregationMap.values());
  }

  private static extractSentences(text: string, keywords: string[]): string[] {
    if (!text) return [];
    const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 10);
    return sentences.filter((sentence) => {
      const lower = sentence.toLowerCase();
      return keywords.some((keyword) => lower.includes(keyword));
    });
  }

  private static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);
  }

  private static generateTitle(text: string, type: LessonPattern["patternType"]): string {
    const truncated = text.slice(0, 60);
    switch (type) {
      case "recurring_challenge":
        return `Recurring: ${truncated}`;
      case "mitigation_success":
        return `Effective: ${truncated}`;
      case "best_practice":
        return `Best Practice: ${truncated}`;
      case "risk_signal":
        return `Risk Alert: ${truncated}`;
    }
  }

  private static deriveMitigation(
    challengeNormalized: string,
    mitigationMap: Map<string, { text: string; count: number; projectIds: Set<string>; dates: Date[] }>,
  ): string[] {
    const mitigations: string[] = [];
    for (const [normalized, data] of mitigationMap) {
      const challengeWords = challengeNormalized.split(" ");
      const mitigationWords = normalized.split(" ");
      const overlap = challengeWords.filter((w) => mitigationWords.includes(w)).length;
      if (overlap >= 2) {
        mitigations.push(data.text);
      }
    }
    return mitigations.slice(0, 3);
  }

  private static createPattern(
    id: string,
    tenantId: string,
    sector: Sector,
    donorName: string,
    patternType: LessonPattern["patternType"],
    title: string,
    description: string,
    frequency: number,
    projectsAffected: string[],
    mitigationStrategies: string[],
    firstObserved: Date,
    lastObserved: Date,
    confidence: number,
  ): LessonPattern {
    return {
      id: createHash("sha256").update(JSON.stringify([tenantId, sector, donorName, id])).digest("hex"),
      tenantId,
      sector,
      donorName,
      patternType,
      title,
      description,
      frequency,
      projectsAffected,
      mitigationStrategies,
      evidenceReferences: [],
      firstObserved,
      lastObserved,
      confidence,
    };
  }

  private static calculateConfidence(count: number, uniqueProjects: number): number {
    const countScore = Math.min(count / 10, 1) * 0.5;
    const projectScore = Math.min(uniqueProjects / 5, 1) * 0.5;
    return Math.round((countScore + projectScore) * 100);
  }
}

function groupByScope<T extends { tenantId: string; sector: Sector; donorName: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    if (!item.tenantId.trim()) continue;
    const key = JSON.stringify([item.tenantId, item.sector, item.donorName]);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}
