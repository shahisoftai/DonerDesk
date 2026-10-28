/** Example data and copy for the public site. Everything numeric here is an illustration and is labelled "Example data" where it is shown. */

export interface SectorExample {
  id: string;
  /** URL segment of the sector page; absent for the "something else" chip. */
  slug?: string;
  label: string;
  dot: string;
  title: string;
  line: string;
  kpis: Array<{ label: string; value: number; target: number; percent?: true }>;
  lineTitle: string;
  series: number[];
  target: number[];
  places: Array<[string, number]>;
  placeLabel: string;
  foot: string;
}

export const SECTORS: SectorExample[] = [
  { id: "wash", slug: "wash", label: "Water & sanitation", dot: "#2f8fd0", title: "WASH recovery programme · Q2", line: "Water points working, people with access, hygiene sessions held, across every donor, in one view.",
    kpis: [{ label: "People with safe water", value: 48200, target: 60000 }, { label: "Water points working", value: 91, target: 100, percent: true }, { label: "Latrines built", value: 1240, target: 1500 }],
    lineTitle: "People with safe water, by month (thousands)", series: [6, 14, 23, 31, 40, 48], target: [10, 20, 30, 40, 50, 60],
    places: [["Gulu", 9.8], ["Kitgum", 8.1], ["Pader", 6.4], ["Lira", 5.2], ["Amuru", 3.9]], placeLabel: "People with safe water (thousands)", foot: "Reported to 3 donors" },
  { id: "health", slug: "health", label: "Health", dot: "#d4574a", title: "Maternal and child health · Q2", line: "Antenatal visits, skilled births and stock-outs by district, with the evidence behind each figure.",
    kpis: [{ label: "Antenatal visits", value: 12480, target: 15000 }, { label: "Skilled births", value: 78, target: 85, percent: true }, { label: "Clinics with no stock-out", value: 27, target: 31 }],
    lineTitle: "Antenatal visits, by month (thousands)", series: [1.4, 3.1, 5.4, 7.6, 10.1, 12.5], target: [2.5, 5, 7.5, 10, 12.5, 15],
    places: [["Dowa", 3.2], ["Ntcheu", 2.9], ["Mchinji", 2.5], ["Salima", 2.1], ["Kasungu", 1.8]], placeLabel: "Antenatal visits (thousands)", foot: "Reported to 2 donors" },
  { id: "nutrition", slug: "nutrition", label: "Nutrition", dot: "#c28a00", title: "Community nutrition · Q2", line: "Admissions, cure rates and defaulters by site, and the report your donor asked for.",
    kpis: [{ label: "Children admitted for treatment", value: 2480, target: 3000 }, { label: "Cure rate", value: 94, target: 75, percent: true }, { label: "Sites reporting on time", value: 29, target: 31 }],
    lineTitle: "Children admitted, by month (thousands)", series: [0.3, 0.7, 1.2, 1.7, 2.1, 2.5], target: [0.5, 1, 1.5, 2, 2.5, 3],
    places: [["Mandera", 0.74], ["Wajir", 0.62], ["Turkana", 0.55], ["Marsabit", 0.34], ["Garissa", 0.23]], placeLabel: "Children admitted (thousands)", foot: "Reported to 2 donors" },
  { id: "education", slug: "education", label: "Education", dot: "#6a4fc1", title: "Girls’ education · Term 2", line: "Enrolment, attendance and learning results by school and term.",
    kpis: [{ label: "Girls enrolled", value: 8420, target: 10000 }, { label: "Average attendance", value: 88, target: 90, percent: true }, { label: "Teachers trained", value: 212, target: 260 }],
    lineTitle: "Girls enrolled, by month (thousands)", series: [3.1, 5.2, 6.4, 7.3, 8.0, 8.4], target: [4, 6, 7.5, 8.5, 9.3, 10],
    places: [["North zone", 2.6], ["East zone", 2.2], ["Central", 1.9], ["West zone", 1.0], ["Riverside", 0.7]], placeLabel: "Girls enrolled (thousands)", foot: "Reported to 2 donors" },
  { id: "food", slug: "food-security", label: "Food security", dot: "#3f9a4f", title: "Food assistance and livelihoods · Q2", line: "Households reached, what they received, and how their food security changed.",
    kpis: [{ label: "Households reached", value: 15600, target: 20000 }, { label: "Acceptable food consumption", value: 63, target: 70, percent: true }, { label: "Cash distributed (USD, thousand)", value: 412, target: 520 }],
    lineTitle: "Households reached, by month (thousands)", series: [2.2, 5.1, 8.0, 10.9, 13.4, 15.6], target: [3.3, 6.6, 10, 13.3, 16.6, 20],
    places: [["Bor", 4.1], ["Pibor", 3.6], ["Akobo", 3.0], ["Ayod", 2.7], ["Twic", 2.2]], placeLabel: "Households reached (thousands)", foot: "Reported to 3 donors" },
  { id: "protection", slug: "protection", label: "Protection", dot: "#a24a8c", title: "Community protection · Q2", line: "Cases referred, sessions held and risks reviewed, with confidentiality kept.",
    kpis: [{ label: "Cases referred", value: 640, target: 800 }, { label: "Awareness sessions held", value: 96, target: 120 }, { label: "Safe spaces open", value: 9, target: 10 }],
    lineTitle: "Cases referred, by month", series: [60, 150, 240, 350, 500, 640], target: [100, 200, 300, 450, 600, 800],
    places: [["Zone A", 210], ["Zone B", 160], ["Zone C", 120], ["Zone D", 90], ["Zone E", 60]], placeLabel: "Cases referred", foot: "Reported to 1 donor" },
  { id: "other", label: "Something else", dot: "#4a6264", title: "Your programme · Q2", line: "Your indicators, your places and your donors, set up in an afternoon.",
    kpis: [{ label: "Participants reached", value: 9300, target: 12000 }, { label: "Activities completed", value: 64, target: 80, percent: true }, { label: "Indicators on target", value: 11, target: 14 }],
    lineTitle: "Participants reached, by month (thousands)", series: [1.2, 2.8, 4.6, 6.3, 7.9, 9.3], target: [2, 4, 6, 8, 10, 12],
    places: [["Site 1", 2.7], ["Site 2", 2.3], ["Site 3", 1.9], ["Site 4", 1.4], ["Site 5", 1.0]], placeLabel: "Participants (thousands)", foot: "Reported to your donors" },
];

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

export interface SectorPage {
  slug: string;
  name: string;
  indicatorExample: string;
  headline: string;
  lede: string;
  problems: Array<{ title: string; text: string }>;
  note?: string;
  metaDescription: string;
}

export const SECTOR_PAGES: SectorPage[] = [
  { slug: "wash", name: "Water, sanitation and hygiene", indicatorExample: "people with safe water, water points working, latrines built, hygiene sessions held",
    headline: "Run a WASH programme across several donors without rebuilding the numbers each quarter.",
    lede: "People with safe access, water points working, latrines built and hygiene sessions held, in one record that every donor report is drawn from.",
    problems: [
      { title: "Inspections happen far from the office", text: "Record each visit in the field, offline. The work plan and map show where inspections took place and what is still due." },
      { title: "Every donor counts people differently", text: "Keep one set of results and one place for each donor's template. Reports follow each funder's structure and cite the same figures." },
      { title: "Hygiene sessions are easy to hold and hard to prove", text: "Attach attendance sheets and photos to the activity they prove, and open the evidence from any number in the report." },
    ],
    metaDescription: "Manage a water, sanitation and hygiene programme in one record: indicators, field data, evidence, maps and donor reports. Start free." },
  { slug: "health", name: "Health", indicatorExample: "antenatal visits, skilled births, immunisation, stock-outs",
    headline: "Run a health programme across districts and donors without rebuilding the numbers each quarter.",
    lede: "Antenatal visits, skilled births, immunisation and stock-outs by district, with the evidence behind each figure and the report your funder asked for.",
    problems: [
      { title: "Facility data arrives late and in different shapes", text: "Bring in spreadsheets, KoboToolbox or SurveyCTO submissions, or enter results in a sheet. Late values are visible while there is still time to chase them." },
      { title: "Gaps surface after the report", text: "Every indicator is shown against its own target, with gaps shown as gaps and never as zero, so you see the shortfall before the funder does." },
      { title: "Funders want the same facts in different formats", text: "Load each donor's template once and draft each report from the same record, with every statement tied to its source." },
    ],
    metaDescription: "Manage a health programme in one record: indicators by district, field data, evidence and donor reports drawn from the same numbers." },
  { slug: "nutrition", name: "Nutrition", indicatorExample: "admissions, cure rate, defaulter rate, sites reporting",
    headline: "Run a nutrition programme across sites without chasing every report by hand.",
    lede: "Admissions, cure rates and defaulters by site, with the report your donor asked for drawn from the same record.",
    problems: [
      { title: "Sites report on different days", text: "Set an entry window for each period, hand values in for review, and see which sites are late at a glance." },
      { title: "Rates are easy to get wrong", text: "Rates are shown as recorded and are never added together or judged as a percent of a target. Formula indicators calculate a ratio from its parts, exactly." },
      { title: "Donor reports ask for the same admissions in new tables", text: "Ask for results by site, by sex or by age group in one sentence with the report builder, then keep the report." },
    ],
    metaDescription: "Manage a nutrition programme in one record: admissions, cure rates and sites by period, with donor reports drawn from the same data." },
  { slug: "education", name: "Education", indicatorExample: "enrolment, attendance, teachers trained, learning results",
    headline: "Run an education programme across schools and terms without losing the record between them.",
    lede: "Enrolment, attendance and learning results by school and term, with the evidence of training and activities kept beside them.",
    problems: [
      { title: "Attendance lives in each school's book", text: "Collect it with forms on a phone, offline, or enter it in a sheet that accepts a paste from Excel." },
      { title: "Results are asked for by school, term and sex", text: "Record a split by sex or age group once, then break results down by it in charts and in the report builder." },
      { title: "Teacher training is easy to count and hard to prove", text: "Link attendance lists and photos to the training they prove, and open them from any figure." },
    ],
    metaDescription: "Manage an education programme in one record: enrolment, attendance and results by school and term, with evidence and donor reports." },
  { slug: "food-security", name: "Food security and livelihoods", indicatorExample: "households reached, food consumption, cash distributed",
    headline: "Run a food security programme across distributions and donors with one set of figures.",
    lede: "Households reached, what they received and how their food security changed, with distributions recorded where they happen.",
    problems: [
      { title: "Distributions happen far from the office", text: "Field teams record activities and fill forms offline, with photo questions, and everything sends when a signal returns." },
      { title: "Reach is reported by place and by donor", text: "See results by place on a map and in tables, and keep each donor's report on its own template." },
      { title: "Reports must show change, not only activity", text: "Indicators carry a baseline and a target, and the report draws on measured results with the activity records that support them." },
    ],
    metaDescription: "Manage a food security and livelihoods programme in one record: households reached by place, field data, evidence and donor reports." },
  { slug: "protection", name: "Protection", indicatorExample: "cases referred, sessions held, safe spaces open",
    headline: "Run a protection programme with the care sensitive work needs and the record funders expect.",
    lede: "Cases referred, sessions held and risks reviewed, with confidential files kept confidential and every change logged.",
    problems: [
      { title: "Sensitive material needs care", text: "Evidence carries a confidentiality level, and only people whose role allows it can open the restricted files." },
      { title: "Partners deliver and you report", text: "Give outside partners access to named projects only, so they can record what they deliver and nothing else." },
      { title: "Risks change every week", text: "Keep a risk register with owners and review dates, and see which reviews are overdue on the project overview." },
    ],
    note: "DonorDesk is not a case-management system. It holds programme results and evidence, not individual case files.",
    metaDescription: "Manage a protection programme in one record: results, confidential evidence, partner access and risks, with donor reports drawn from the record." },
];

export const FIELD_STEPS = [
  { title: "Recorded in the field", text: "A field officer records a borehole inspection on a phone with no signal." },
  { title: "It appears on the dashboard", text: "When the phone reconnects the record is sent. After review, the figure moves on the dashboard, against its target." },
  { title: "The draft cites its source", text: "The donor report is drafted from the record. Each statement points to the activity or value it came from." },
  { title: "A person approves", text: "Checks run before submission. The approver sees what each statement rests on, then exports in the donor's format." },
];

export const SOUND_FAMILIAR = [
  "The report is due and the numbers are in six places.",
  "Three donors, three formats.",
  "The field team has no signal.",
  "Nobody can say which activities are late.",
  "An audit is coming and the evidence is in chat threads.",
];
