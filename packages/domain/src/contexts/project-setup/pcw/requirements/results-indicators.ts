/** Requirements of slides 3 (Results framework) and 4 (Indicators). */
import type { RequirementDef } from "../requirement.js";
import { MET, allOf, live, open, present, undecidedCount } from "./shared.js";

const label = (code: string | null, title: string | null): string => code ?? title ?? "?";

export const RESULTS_REQUIREMENTS: readonly RequirementDef[] = [
  {
    key: "results.decided", slide: "RESULTS", coversSteps: [7], allowsNotUsed: false,
    check: (d) => {
      const n = undecidedCount(d.proposal.logframe);
      return n === 0 ? MET : open("resultsUndecided", { count: n });
    },
  },
  {
    key: "results.chain", slide: "RESULTS", coversSteps: [7], allowsNotUsed: false,
    check: (d) => {
      const nodes = live(d.proposal.logframe);
      if (nodes.length === 0) return open("resultsEmpty");
      const hasChild = (code: string | null, level: string) => code !== null && nodes.some((n) => n.level === level && n.parentCode === code);
      const problems = [
        ...nodes.filter((n) => n.level === "OUTCOME" && !hasChild(n.code, "OUTPUT")).map((n) => label(n.code, n.title)),
        ...nodes.filter((n) => n.level === "OUTPUT" && !hasChild(n.code, "ACTIVITY")).map((n) => label(n.code, n.title)),
      ];
      return allOf(problems, "resultsBroken");
    },
  },
  {
    key: "results.codes", slide: "RESULTS", coversSteps: [9], allowsNotUsed: false,
    check: (d) => {
      const kept = new Set(d.extras.confirmedGeneratedCodes);
      const problems = live(d.proposal.logframe).filter((n) => n.code === null || (n.codeSource === "GENERATED" && !kept.has(n.code))).map((n) => label(n.code, n.title));
      return allOf(problems, "codesUnconfirmed");
    },
  },
];

export const INDICATOR_REQUIREMENTS: readonly RequirementDef[] = [
  {
    key: "indicators.decided", slide: "INDICATORS", coversSteps: [8], allowsNotUsed: false,
    check: (d) => {
      const n = undecidedCount(d.proposal.indicators);
      return n === 0 ? MET : open("indicatorsUndecided", { count: n });
    },
  },
  {
    key: "indicators.perOutput", slide: "INDICATORS", coversSteps: [8], allowsNotUsed: false,
    check: (d) => {
      const indicators = live(d.proposal.indicators);
      const problems = live(d.proposal.logframe)
        .filter((n) => n.level === "OUTPUT" && !indicators.some((i) => i.logframeCode !== null && i.logframeCode === n.code))
        .map((n) => label(n.code, n.title));
      return allOf(problems, "outputWithoutIndicator");
    },
  },
  {
    key: "indicators.complete", slide: "INDICATORS", coversSteps: [8], allowsNotUsed: false,
    check: (d) => {
      const problems = live(d.proposal.indicators)
        .filter((i) => {
          const baselineAnswered = present(i.baseline) || (i.code !== null && d.extras.indicatorSetup[i.code]?.baselineNone === true);
          return !present(i.type) || !present(i.frequency) || !present(i.target) || !baselineAnswered;
        })
        .map((i) => label(i.code, i.title));
      return allOf(problems, "indicatorIncomplete");
    },
  },
  {
    key: "indicators.owners", slide: "INDICATORS", coversSteps: [8], allowsNotUsed: false,
    check: (d) => {
      const team = new Set(d.extras.team.map((p) => p.key));
      const problems = live(d.proposal.indicators)
        .filter((i) => {
          const owner = i.code === null ? undefined : d.extras.indicatorSetup[i.code]?.ownerKey;
          return owner === undefined || !team.has(owner);
        })
        .map((i) => label(i.code, i.title));
      return allOf(problems, "indicatorWithoutOwner");
    },
  },
  {
    key: "indicators.direction", slide: "INDICATORS", coversSteps: [8], allowsNotUsed: false,
    check: (d) => {
      const problems = live(d.proposal.indicators)
        .filter((i) => i.code === null || d.extras.indicatorSetup[i.code]?.directionConfirmed !== true)
        .map((i) => label(i.code, i.title));
      return allOf(problems, "directionUnconfirmed");
    },
  },
];
