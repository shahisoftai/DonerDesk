import { D, MONTHS, split } from "./data.mjs";
const SITES = ["Johi", "Mehar", "Khairpur Nathan Shah", "Dadu", "Johi", "Mehar"];
const WP_SITES = [["Johi (Bhan Syedabad)", "Johi (Wahi Pandhi)"], ["Mehar (Dhoro)", "Johi (Pat Feeder)"], ["Mehar (Radhan)", "Khairpur Nathan Shah (Gulshan)"], ["Dadu (Sakrand Road)", "Mehar (Bubak)"], ["Khairpur Nathan Shah (Mirpur Bathoro)", "Johi (Sita Road)"], ["Dadu (Kachho)", "Mehar (Wagan)"]];
const day = (m, d) => `2026-${String(3 + m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
export function activities(m) {
  const M = MONTHS[m], s = SITES[m];
  const wp = D["1.1"][m], ppl = D["O1"][m], com = D["1.2"][m], lat = D["2.1"][m], blk = D["2.2"][m], hyg = D["2.3"][m], cl = D["1.3"][m];
  const [pf, pm] = split(ppl, 0.55), [hf, hm] = split(hyg, 0.54);
  return [
    { node: "A1.1", title: `A1.1 — Rehabilitation of ${wp} water point(s), ${WP_SITES[m][0]}`, date: day(m, 6), loc: WP_SITES[m][0] + ", Dadu district", total: ppl, male: pm, female: pf,
      summary: `Repair teams rehabilitated ${wp} hand pump and solar mini-scheme water point(s) in ${M}, including new platforms, drains and disinfection, and handed them to the local water user committees.`,
      achievements: `${wp} water point(s) rehabilitated and functional in ${M}; about ${ppl} people (${pf} female, ${pm} male) now use them.`,
      challenges: m === 2 ? "Flooding at one site delayed completion by a week." : m === 4 ? "Spare parts were delayed ten days and bought locally." : "Minor delays in transporting materials on washed-out roads.",
      lessons: "Pre-positioning spare parts at the Dadu field office prevents repair delays.", next: m < 5 ? `Continue rehabilitation of water points in ${MONTHS[m + 1]}.` : "Hand over all schemes to the committees and the district PHED office." },
    { node: "A1.2", title: `A1.2 — Water user committee formation and training, ${SITES[(m + 1) % 6]}`, date: day(m, 12), loc: SITES[(m + 1) % 6] + ", Dadu district", total: com * 12, male: com * 7, female: com * 5,
      summary: `The partner team formed ${com} water user committee(s) in ${M} and trained members on operation, minor repair, fee collection and record keeping.`,
      achievements: `${com} committee(s) formed and trained in ${M}, with ${com * 12} members (${com * 5} women and ${com * 7} men).`,
      challenges: "Women's attendance depended on the timing of sessions around household chores.", lessons: "Evening sessions near the water point increase women's participation.", next: m < 5 ? "Mentor existing committees and form the remaining ones." : "Final mentoring visits and handover certificates." },
    { node: "A1.3", title: `A1.3 — Chlorination and water quality testing, ${s}`, date: day(m, 18), loc: s + ", Dadu district", total: undefined,
      summary: `Field staff chlorinated all rehabilitated water points and tested residual chlorine at each in ${M}.`,
      achievements: `${cl} percent of tested water samples met the residual chlorine standard in ${M}.`,
      challenges: "Some samples fell below standard at points where dosing records were incomplete.", lessons: "Weekly dosing logs kept by committees raise compliance.", next: "Continue monthly testing and retrain committees where results are low." },
    { node: "A2.1", title: `A2.1 — Household latrine construction, ${SITES[(m + 2) % 6]}`, date: day(m, 22), loc: SITES[(m + 2) % 6] + ", Dadu district", total: lat,
      summary: `Households built ${lat} latrines in ${M} with community labour, technical supervision by the site engineer and project-supplied slabs and pans.`,
      achievements: `${lat} household latrines completed and checked for use in ${M}.`,
      challenges: m === 0 ? "Materials arrived late, so construction started slowly." : "Occasional shortages of cement at the Dadu supplier.", lessons: "Paying slab suppliers on delivery avoids construction pauses.", next: m < 5 ? "Continue construction at the next cluster of villages." : "Final completion checks and household spot-checks." },
    { node: "A2.2", title: blk ? `A2.2 — School WASH block construction, ${SITES[(m + 3) % 6]}` : `A2.2 — School WASH block site selection and design, ${SITES[(m + 3) % 6]}`, date: day(m, 25), loc: SITES[(m + 3) % 6] + " primary school, Dadu district", total: undefined,
      summary: blk ? `Contractors completed ${blk} gender-separated school WASH block(s) with latrines, handwashing points and water supply in ${M}.` : `The engineer and school management committees selected schools and agreed designs for the gender-separated WASH blocks in ${M}.`,
      achievements: blk ? `${blk} school WASH block(s) completed and handed over in ${M}.` : "Five schools selected and designs approved; no blocks completed yet.",
      challenges: "Schools needed temporary access arrangements during construction.", lessons: "Involving head teachers in design improves maintenance planning.", next: m < 5 ? "Start or continue construction of the next school blocks." : "Final school block handover." },
    { node: "A2.3", title: `A2.3 — Hygiene promotion sessions and handwashing demonstrations, ${SITES[(m + 4) % 6]}`, date: day(m, 28), loc: SITES[(m + 4) % 6] + ", Dadu district", total: hyg, male: hm, female: hf, children: Math.round(hyg * 0.4),
      summary: `Hygiene promoters ran community and school sessions with handwashing demonstrations in ${M}, reaching ${hyg} people.`,
      achievements: `${hyg} people reached with hygiene promotion in ${M} (${hf} female, ${hm} male); handwashing station coverage reached ${D["O2"][m]} percent in spot-checks.`,
      challenges: m === 3 ? "Extreme heat reduced turnout at afternoon sessions." : "Competing agricultural and household work reduced turnout at some sessions.", lessons: "Songs and child-led demonstrations keep sessions engaging.", next: m < 5 ? "Continue sessions and the monthly handwashing spot-check." : "Endline handwashing spot-check." },
  ];
}
