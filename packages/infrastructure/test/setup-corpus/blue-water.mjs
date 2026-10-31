// A small synthetic proposal with recorded model replies per area (Phase 36.2 fixture; no live model in CI).
// One reply deliberately invents a figure ("2,500") and one a quote that is not in the document: both must be dropped.
export const DOCUMENT_ID = "doc-1";

export const BLOCKS = [
  "Project title: Blue Water for Gulu. Funded by the European Union.",
  "The project runs from 1 March 2027 to 28 February 2029 in Uganda, in the WASH sector.",
  "Goal 1: Improved health of households in Gulu District.",
  "Outcome 1.1: Households use safe water.",
  "Output 1.1.1: 40 boreholes rehabilitated.",
  "Indicator 1.1.a: Number of people with access to safe water. Baseline 0, target 12,000, measured quarterly.",
  "Activity A1: Borehole rehabilitation in Gulu District from 1 April 2027 to 30 September 2027.",
  "Quarterly progress reports and a final report are due to the donor.",
  "Budget: EU contribution EUR 1,250,000. Personnel EUR 400,000. Equipment EUR 600,000.",
  "Risk: flooding during the rainy season may delay works; mitigation: schedule works in the dry season.",
].map((text, index) => ({ documentId: DOCUMENT_ID, index, page: 1, text }));

const f = (value, quote, block) => ({ value, quote, block, confidence: "HIGH" });

export const REPLIES = {
  FACTS: {
    name: f("Blue Water for Gulu", "Project title: Blue Water for Gulu.", 0),
    code: null,
    donor: f("European Union", "Funded by the European Union.", 0),
    countries: f(["Uganda"], "in Uganda", 1),
    sectors: f(["WASH"], "in the WASH sector", 1),
    startDate: f("2027-03-01", "The project runs from 1 March 2027 to 28 February 2029", 1),
    endDate: f("2029-02-28", "The project runs from 1 March 2027 to 28 February 2029", 1),
    currency: f("EUR", "EU contribution EUR 1,250,000.", 8),
    summary: null,
  },
  LOGFRAME: {
    logframe: [
      { level: "Impact", code: "1", title: "Improved health of households in Gulu District", quote: "Goal 1: Improved health of households in Gulu District.", block: 2, confidence: "HIGH" },
      { level: "OUTCOME", code: "1.1", parentCode: "1", title: "Households use safe water", quote: "Outcome 1.1: Households use safe water.", block: 3, confidence: "HIGH" },
      { level: "OUTPUT", code: "1.1.1", parentCode: "1.1", title: "40 boreholes rehabilitated", quote: "Output 1.1.1: 40 boreholes rehabilitated.", block: 4, confidence: "HIGH" },
      { level: "OUTPUT", code: "1.1.2", parentCode: "1.1", title: "Latrines built", quote: "Output 1.1.2: Latrines built.", block: 4, confidence: "HIGH" },
    ],
  },
  INDICATORS: {
    indicators: [
      { code: "1.1.a", title: "Number of people with access to safe water", logframeCode: "1.1", type: "number", baseline: "0", target: "12,000", frequency: "quarterly",
        quote: "Indicator 1.1.a: Number of people with access to safe water. Baseline 0, target 12,000, measured quarterly.", block: 5, confidence: "HIGH" },
      { code: "1.1.b", title: "Boreholes functional", target: "2,500", quote: "Output 1.1.1: 40 boreholes rehabilitated.", block: 4, confidence: "LOW" },
    ],
  },
  PERIODS: { periods: [
    { type: "quarterly", start: null, end: null, quote: "Quarterly progress reports", block: 7, confidence: "HIGH" },
    { type: "FINAL", quote: "a final report are due to the donor", block: 7, confidence: "HIGH" },
  ] },
  PLAN: { plan: [
    { title: "Borehole rehabilitation", logframeCode: "1.1.1", start: "2027-04-01", end: "2027-09-30", location: "Gulu District",
      quote: "Activity A1: Borehole rehabilitation in Gulu District from 1 April 2027 to 30 September 2027.", block: 6, confidence: "HIGH" },
  ] },
  PLACES: { places: [{ name: "Gulu District", adminLevel: 2, parentName: "Uganda", quote: "Gulu District", block: 2, confidence: "MEDIUM" }] },
  FUNDING_BUDGET: {
    funding: [{ sourceName: "European Union", amount: "1,250,000", currency: "eur", quote: "EU contribution EUR 1,250,000.", block: 8, confidence: "HIGH" }],
    budget: [
      { category: "Personnel", amount: "400,000", currency: "EUR", quote: "Personnel EUR 400,000.", block: 8, confidence: "HIGH" },
      { category: "Equipment", amount: "600,000", currency: "EUR", quote: "Equipment EUR 600,000.", block: 8, confidence: "HIGH" },
    ],
  },
  RISKS: { risks: [{ kind: "RISK", title: "Flooding during the rainy season may delay works", mitigation: "schedule works in the dry season",
    quote: "Risk: flooding during the rainy season may delay works; mitigation: schedule works in the dry season.", block: 9, confidence: "HIGH" }] },
};

/** What a correct reading keeps after grounding: the invented indicator and the unquoted output are gone. */
export const EXPECTED = { logframe: 3, indicators: 1, periods: 2, plan: 1, places: 1, funding: 1, budget: 2, risks: 1, factsStated: 7 };
