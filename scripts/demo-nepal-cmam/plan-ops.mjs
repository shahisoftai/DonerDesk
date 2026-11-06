// Phase 28 actions per month: what planning decisions the team makes (moves with a reason, cancellations, requests, comments)
// and which planned activities are marked Done. Usage: node plan-ops.mjs <m> pre|post
import { attach } from "../demo-ui/lib.mjs"; import * as A from "./acts-plan.mjs"; import { readFileSync } from "node:fs"; import { MN } from "./data.mjs";
const S = JSON.parse(readFileSync("plan-state.json", "utf8"));
const m = Number(process.argv[2]); const phase = process.argv[3];
const { page, browser } = await attach("planops");
const PRE = {
  1: async () => {
    await A.files(page, "A1.1:1", ["Kobo/ODK export", "Photo"]);
    await A.ask(page, "A1.1:1", "Ask for completed activity", "Ram", "Please enter the February screening record and attach the register extract.");
    await A.move(page, "A2.1:1", "2026-02-09", "2026-02-15", "Caregivers had returned to their flood-damaged homes, so the counselling round moved to the market-day schedule.");
  },
  2: async () => {
    await A.move(page, "A2.3:2", "2026-03-10", "2026-03-16", "The provincial store delivered the therapeutic food nine days late, so the delivery round to the health posts moved to the following week.");
    await A.comment(page, "A2.3:2", "Stock cards at three health posts show no cartons left. I have raised this as a problem so the district health office can see it.");
    await A.ask(page, "A2.3:2", "Ask for a file", "Bikash", "Please attach the signed March delivery notes for every site.", true);
  },
  5: async () => {
    await A.cancel(page, "R:5", "Floodwater closed the Bardiya meeting hall and the rivers were not crossable for ten days; the leaders will be reached through the monthly group meetings instead.");
    await A.move(page, "A1.1:5", "2026-06-15", "2026-06-21", "Early monsoon rains closed four outreach sites for ten days; the screening round ran in the first dry week.");
  },
  6: async () => {
    await A.move(page, "J:6", "2026-08-17", "2026-08-21", "The district health officers were deployed to the flood response in Bardiya, so the joint review was moved to August.");
    await A.comment(page, "A1.2:6", "Two outreach sites were cut off by the Babai river for part of July; admissions still reached the monthly figure through the health post.");
  },
};
const HELD = (mm) => {
  const keys = ["A1.1", "A1.2", "A1.3", "A2.1", "A2.2", "A2.3"].map((n) => `${n}:${mm}`);
  if ([0, 2, 4, 6, 7].includes(mm)) keys.push(`A1.4:${mm}`);
  if (mm === 7) keys.push("J:6", "H:7");
  return keys.filter((k) => S[k]);
};
if (phase === "pre") { await (PRE[m]?.() ?? Promise.resolve()); console.log("pre done", MN[m]); }
if (phase === "post") { for (const k of HELD(m)) await A.done(page, k); console.log("held marked done", HELD(m).length); }
await browser.close(); process.exit(0);
