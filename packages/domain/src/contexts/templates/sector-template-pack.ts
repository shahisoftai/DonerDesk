import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import type { Sector } from "../identity/role.js";

export type TemplatePackStatus = "DRAFT" | "PUBLISHED" | "DEPRECATED";

export interface IndicatorTemplate {
  code: string;
  name: string;
  type: "quantitative" | "qualitative" | "binary";
  unit?: string;
  baselineGuidance: string;
  targetGuidance: string;
  meansOfVerification: string[];
  dataSource: string[];
  disaggregationBy?: ("gender" | "age" | "disability" | "location" | "incident_type" | "referral_type")[];
}

export interface LogframeNodeTemplate {
  level: "goal" | "purpose" | "output" | "activity";
  code?: string;
  title: string;
  description: string;
  suggestedIndicators: number;
  guidance: string;
}

export interface ComplianceChecklistTemplate {
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  category: "evidence" | "indicator" | "timeline" | "financial" | "safeguarding";
  relatedDonorRequirements?: string[];
}

export interface SectorTemplatePackProps {
  name: string;
  sector: Sector;
  version: number;
  description: string;
  donorName: string;
  reportType: string;
  language: string;
  status: TemplatePackStatus;
  indicatorTemplates: IndicatorTemplate[];
  logframeTemplates: LogframeNodeTemplate[];
  complianceTemplates: ComplianceChecklistTemplate[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class SectorTemplatePack extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    private props: SectorTemplatePackProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    name: string;
    sector: Sector;
    version?: number;
    description: string;
    donorName: string;
    reportType: string;
    language?: string;
    indicatorTemplates?: IndicatorTemplate[];
    logframeTemplates?: LogframeNodeTemplate[];
    complianceTemplates?: ComplianceChecklistTemplate[];
  }): SectorTemplatePack {
    if (!input.name?.trim()) {
      throw DomainError.validation("Template pack name is required");
    }
    if (!input.donorName?.trim()) {
      throw DomainError.validation("Donor name is required");
    }
    return new SectorTemplatePack(
      input.id,
      input.tenantId,
      {
        name: input.name.trim(),
        sector: input.sector,
        version: input.version ?? 1,
        description: input.description.trim(),
        donorName: input.donorName.trim(),
        reportType: input.reportType,
        language: input.language ?? "en",
        status: "DRAFT",
        indicatorTemplates: input.indicatorTemplates ?? [],
        logframeTemplates: input.logframeTemplates ?? [],
        complianceTemplates: input.complianceTemplates ?? [],
      },
    );
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    props: SectorTemplatePackProps;
    createdAt: Date;
  }): SectorTemplatePack {
    return new SectorTemplatePack(input.id, input.tenantId, input.props, input.createdAt);
  }

  get name(): string { return this.props.name; }
  get sector(): Sector { return this.props.sector; }
  get version(): number { return this.props.version; }
  get description(): string { return this.props.description; }
  get donorName(): string { return this.props.donorName; }
  get reportType(): string { return this.props.reportType; }
  get language(): string { return this.props.language; }
  get status(): TemplatePackStatus { return this.props.status; }
  get indicatorTemplates(): IndicatorTemplate[] { return [...this.props.indicatorTemplates]; }
  get logframeTemplates(): LogframeNodeTemplate[] { return [...this.props.logframeTemplates]; }
  get complianceTemplates(): ComplianceChecklistTemplate[] { return [...this.props.complianceTemplates]; }

  publish(): void {
    if (this.props.status === "DEPRECATED") {
      throw DomainError.invalidTransition("Cannot publish a deprecated template pack");
    }
    this.props.status = "PUBLISHED";
    this.touch();
  }

  deprecate(): void {
    if (this.props.status === "DEPRECATED") {
      throw DomainError.invalidTransition("Already deprecated");
    }
    this.props.status = "DEPRECATED";
    this.touch();
  }

  updateContent(patches: {
    description?: string;
    indicatorTemplates?: IndicatorTemplate[];
    logframeTemplates?: LogframeNodeTemplate[];
    complianceTemplates?: ComplianceChecklistTemplate[];
  }): void {
    if (this.props.status === "PUBLISHED") {
      this.props.version += 1;
    }
    if (patches.description !== undefined) {
      this.props.description = patches.description.trim();
    }
    if (patches.indicatorTemplates !== undefined) {
      this.props.indicatorTemplates = patches.indicatorTemplates;
    }
    if (patches.logframeTemplates !== undefined) {
      this.props.logframeTemplates = patches.logframeTemplates;
    }
    if (patches.complianceTemplates !== undefined) {
      this.props.complianceTemplates = patches.complianceTemplates;
    }
    this.touch();
  }
}

export const NUTRITION_INDICATOR_TEMPLATES: IndicatorTemplate[] = [
  {
    code: "NUT-01",
    name: "Number of children under 5 years screened for malnutrition",
    type: "quantitative",
    unit: "children",
    baselineGuidance: "Record count of children screened using MUAC or weight-for-height Z-scores",
    targetGuidance: "Set based on catchment population and seasonal patterns",
    meansOfVerification: ["MUAC tape measurement records", "Screening forms", "Health facility registers"],
    dataSource: ["Community health worker reports", "Health facility HMIS data", "Mobile screening app data"],
    disaggregationBy: ["gender", "age"],
  },
  {
    code: "NUT-02",
    name: "Number of children under 5 with severe acute malnutrition (SAM) admitted to OTP",
    type: "quantitative",
    unit: "children",
    baselineGuidance: "Count admissions to Outpatient Therapeutic Feeding Programme",
    targetGuidance: "Plan based on SAM prevalence estimates (2-5% of under-5 population in emergencies)",
    meansOfVerification: ["OTP admission registers", "RUTF distribution records", "Discharge summaries"],
    dataSource: ["Nutrition facility records", "INGO partner reports", "Ministry of Health HMIS"],
    disaggregationBy: ["gender", "age", "disability"],
  },
  {
    code: "NUT-03",
    name: "Number of children under 5 with moderate acute malnutrition (MAM) receiving supplementary feeding",
    type: "quantitative",
    unit: "children",
    baselineGuidance: "Count children receiving BSFP or SFP rations",
    targetGuidance: "Plan based on MAM prevalence estimates (5-10% of under-5 population)",
    meansOfVerification: ["Supplementary feeding ration cards", "Distribution registers", "Attendance records"],
    dataSource: ["CSB/Plumpy distribution records", "SFP program data", "Community volunteer reports"],
    disaggregationBy: ["gender", "age"],
  },
  {
    code: "NUT-04",
    name: "Number of pregnant and lactating women (PLW) receiving nutritional support",
    type: "quantitative",
    unit: "women",
    baselineGuidance: "Count PLW receiving IYCF counselling or supplementary feeding",
    targetGuidance: "Plan based on expected births (4-5% of population) + lactating women",
    meansOfVerification: ["ANC register", "IYCF counselling cards", "RUTF/FBF distribution records"],
    dataSource: ["Health facility ANC/PNC registers", "Community health worker reports", "INGO partner data"],
    disaggregationBy: ["location"],
  },
  {
    code: "NUT-05",
    name: "Default rate from SAM treatment programme",
    type: "quantitative",
    unit: "percentage",
    baselineGuidance: "% of SAM cases who defaulted before cure (SPHERE standard <15%)",
    targetGuidance: "Set target below SPHERE minimum standard of 15%",
    meansOfVerification: ["OTP registers", "Default tracing forms", "Outcome data"],
    dataSource: ["Program database", "Monthly partner reports", "QA visits"],
    disaggregationBy: ["gender", "age"],
  },
];

export const WASH_INDICATOR_TEMPLATES: IndicatorTemplate[] = [
  {
    code: "WASH-01",
    name: "Number of people with sustained access to safe drinking water",
    type: "quantitative",
    unit: "people",
    baselineGuidance: "Count people within 500m of water point with <30 min queue time",
    targetGuidance: "Set based on population in target area and UNHCR/SPHERE standards (20L/p/d)",
    meansOfVerification: ["Water point functionality checks", "User surveys", "Metered output data"],
    dataSource: ["Water point monitoring logs", "Committee records", "Remote sensing (for large schemes)"],
    disaggregationBy: ["gender", "location", "disability"],
  },
  {
    code: "WASH-02",
    name: "Number of people with access to appropriate sanitation facilities",
    type: "quantitative",
    unit: "people",
    baselineGuidance: "Count people using latrines meeting UNHCR/SPHERE standards (1:20 ratio, privacy)",
    targetGuidance: "Plan for 100% coverage in target settlements per SPHERE standards",
    meansOfVerification: ["Household surveys", "Latrine inspection checklists", "Demographic data"],
    dataSource: ["Household surveys", "SHASHA assessment data", "Community leader interviews"],
    disaggregationBy: ["gender", "location"],
  },
  {
    code: "WASH-03",
    name: "Number of critical water points equipped with chlorine disinfection",
    type: "quantitative",
    unit: "water points",
    baselineGuidance: "Count permanent/semi-permanent water points with functioning chlorination",
    targetGuidance: "100% of communal water points should have permanent chlorination",
    meansOfVerification: ["Water safety plans", "Residual chlorine tests", "Chlorinator maintenance logs"],
    dataSource: ["Water point inspections", "Laboratory test results", "Supervision reports"],
    disaggregationBy: ["location"],
  },
  {
    code: "WASH-04",
    name: "Number of households receiving hygiene kit distribution",
    type: "quantitative",
    unit: "households",
    baselineGuidance: "Count hygiene kit distributions per household (1 kit per family)",
    targetGuidance: "Set based on household count in target area",
    meansOfVerification: ["Distribution lists", "Beneficiary cards", "Post-distribution monitoring"],
    dataSource: ["Distribution waybills", "Beneficiary database", "PDM survey data"],
    disaggregationBy: ["gender"],
  },
  {
    code: "WASH-05",
    name: "Incidence of diarrheal disease in children under 5",
    type: "quantitative",
    unit: "cases per 10,000 under-5 per month",
    baselineGuidance: "Track reported cases through health facility HMIS",
    targetGuidance: "SPHERE target: <5% incidence in under-5 population",
    meansOfVerification: ["Health facility registers", "Community health worker reports", "CMAM screening data"],
    dataSource: ["HMIS data", "NGO clinic records", "Community surveillance data"],
    disaggregationBy: ["gender", "age", "location"],
  },
];

export const PROTECTION_INDICATOR_TEMPLATES: IndicatorTemplate[] = [
  {
    code: "PROT-01",
    name: "Number of individuals receiving protection monitoring visits",
    type: "quantitative",
    unit: "individuals",
    baselineGuidance: "Count unique individuals visited by protection monitors",
    targetGuidance: "Set based on caseload capacity and visit frequency targets",
    meansOfVerification: ["Case management database", "Monitoring visit forms", "Supervisor sign-off"],
    dataSource: ["Case management system", "Field visit logs", "Community focal point reports"],
    disaggregationBy: ["gender", "age", "disability"],
  },
  {
    code: "PROT-02",
    name: "Number of protection incidents documented and reported",
    type: "quantitative",
    unit: "incidents",
    baselineGuidance: "Count documented incidents through DTM or case management system",
    targetGuidance: "All verified incidents should be documented",
    meansOfVerification: ["Incident registration forms", "Incident database", "Cluster/sector reporting"],
    dataSource: ["DTM reports", "Incident database", "Partner reports to UNHCR/cluster"],
    disaggregationBy: ["gender", "age", "incident_type"],
  },
  {
    code: "PROT-03",
    name: "Number of individuals referred to specialized protection services",
    type: "quantitative",
    unit: "individuals",
    baselineGuidance: "Count successful referrals with follow-up confirmation",
    targetGuidance: "Set based on identified caseload with specific protection needs",
    meansOfVerification: ["Referral forms", "Service provider confirmation", "Case follow-up records"],
    dataSource: ["Referral tracking system", "Partner service logs", "Case management database"],
    disaggregationBy: ["gender", "age", "referral_type"],
  },
  {
    code: "PROT-04",
    name: "Percentage of unaccompanied and separated children (UASC) with care arrangements",
    type: "quantitative",
    unit: "percentage",
    baselineGuidance: "% of registered UASC with documented interim care arrangement",
    targetGuidance: "100% of UASC should have documented care arrangements",
    meansOfVerification: ["UASC registration forms", "Best interest assessments", "Care arrangement docs"],
    dataSource: ["UASC case files", "CPIMS/CPMS data", "Child protection database"],
    disaggregationBy: ["gender", "age"],
  },
  {
    code: "PROT-05",
    name: "Number of community-based protection mechanisms functional",
    type: "quantitative",
    unit: "mechanisms",
    baselineGuidance: "Count active CPCs, PSEA networks, or community alert systems",
    targetGuidance: "Set based on community structure - aim for 1 per 500 people",
    meansOfVerification: ["Meeting minutes", "Activity reports", "Capacity assessments"],
    dataSource: ["Community leader reports", "INGO partner monitoring", "Cluster coordination data"],
    disaggregationBy: ["location"],
  },
];

export const EDUCATION_INDICATOR_TEMPLATES: IndicatorTemplate[] = [
  {
    code: "EDU-01",
    name: "Number of children (3-17 years) enrolled in formal or non-formal education",
    type: "quantitative",
    unit: "children",
    baselineGuidance: "Count children enrolled in school or accelerated/literacy programs",
    targetGuidance: "Set based on school-age population census data in target area",
    meansOfVerification: ["School enrollment registers", "Program attendance records", "EMIS data"],
    dataSource: ["Ministry of Education data", "INGO enrollment records", "Community surveys"],
    disaggregationBy: ["gender", "age", "disability"],
  },
  {
    code: "EDU-02",
    name: "Attendance rate in supported learning facilities",
    type: "quantitative",
    unit: "percentage",
    baselineGuidance: "% of enrolled children attending on any given day",
    targetGuidance: "Set >80% as minimum standard (SPHERE)",
    meansOfVerification: ["Daily attendance registers", "Spot-check observations", "Teacher reports"],
    dataSource: ["School registers", "INGO monitoring data", "Community focal point reports"],
    disaggregationBy: ["gender", "age"],
  },
  {
    code: "EDU-03",
    name: "Number of teachers trained in psychosocial support (PSS) and pedagogy",
    type: "quantitative",
    unit: "teachers",
    baselineGuidance: "Count teachers completing certified PSS/pedagogy training",
    targetGuidance: "Set based on teacher deployment plan and training capacity",
    meansOfVerification: ["Training attendance records", "Pre/post assessments", "Training certificates"],
    dataSource: ["INGO training database", "Ministry of Education records", "Training partner reports"],
    disaggregationBy: ["gender"],
  },
  {
    code: "EDU-04",
    name: "Student learning outcomes in literacy and numeracy",
    type: "quantitative",
    unit: "percentage meeting benchmarks",
    baselineGuidance: "% of students meeting minimum proficiency in reading/writing and math",
    targetGuidance: "Set based on grade-level benchmarks - 70% minimum for literacy",
    meansOfVerification: ["Standardized assessments", "Teacher evaluations", "Community-based assessment"],
    dataSource: ["Assessment results", "INGO monitoring data", "Ministry EMIS"],
    disaggregationBy: ["gender", "age", "disability"],
  },
  {
    code: "EDU-05",
    name: "Number of learning spaces rehabilitated or established",
    type: "quantitative",
    unit: "spaces",
    baselineGuidance: "Count classrooms, learning centers, or temporary learning spaces",
    targetGuidance: "Plan based on enrollment targets and space requirements (1.5m2 per child minimum)",
    meansOfVerification: ["Completion certificates", "Space inspection checklists", "GIS mapping"],
    dataSource: ["INGO construction monitoring", "Ministry of Education data", "Site photos"],
    disaggregationBy: ["location"],
  },
];

export const FOOD_SECURITY_INDICATOR_TEMPLATES: IndicatorTemplate[] = [
  {
    code: "FS-01",
    name: "Number of households receiving food assistance",
    type: "quantitative",
    unit: "households",
    baselineGuidance: "Count unique HH receiving food rations or cash/voucher transfers",
    targetGuidance: "Set based on IPC/CH analysis and caseload assessment",
    meansOfVerification: ["Distribution registers", "Beneficiary database", "Cash transfer records"],
    dataSource: ["WFP/commercial retailer data", "INGO distribution reports", "IPC analysis"],
    disaggregationBy: ["gender", "location"],
  },
  {
    code: "FS-02",
    name: "Food Consumption Score (FCS) - percentage of HH with acceptable consumption",
    type: "quantitative",
    unit: "percentage",
    baselineGuidance: "% of HH with FCS > 35 (acceptable) using WFP methodology",
    targetGuidance: "Plan to improve from Crisis/Emergency to Stressed/Acceptable",
    meansOfVerification: ["Household surveys using FCS module", "FSMS data", "PDMs"],
    dataSource: ["WFP FSMS", "INGO survey data", "Joint assessment missions"],
    disaggregationBy: ["gender", "location"],
  },
  {
    code: "FS-03",
    name: "Household Dietary Diversity Score (HDDS) - average score",
    type: "quantitative",
    unit: "food groups (0-12)",
    baselineGuidance: "Average HDDS using 24-hour recall methodology (12 food groups)",
    targetGuidance: "Target > 6 food groups for adequate diet diversity",
    meansOfVerification: ["HDDS survey module", "FSMS data", "Nutrition assessments"],
    dataSource: ["WFP/multi-cluster surveys", "INGO assessment data", "Community nutrition surveillance"],
    disaggregationBy: ["gender", "location"],
  },
  {
    code: "FS-04",
    name: "Number of livelihood assets distributed (livestock, tools, seeds)",
    type: "quantitative",
    unit: "households",
    baselineGuidance: "Count HH receiving productive assets for livelihood recovery",
    targetGuidance: "Set based on livelihoods assessment and recovery strategy",
    meansOfVerification: ["Distribution records", "Beneficiary confirmation", "Follow-up visits"],
    dataSource: ["INGO distribution database", "Government agriculture records", "Market assessment data"],
    disaggregationBy: ["gender", "location"],
  },
  {
    code: "FS-05",
    name: "Livestock body condition score (for livestock distribution programs)",
    type: "qualitative",
    unit: "score (1-5)",
    baselineGuidance: "Average body condition score of distributed livestock",
    targetGuidance: "Target > 3.0 average (fair condition) for productive animals",
    meansOfVerification: ["Veterinary checks", "Community animal health worker reports", "Mortality records"],
    dataSource: ["INGO veterinary records", "Community vaccine logs", "FAW/FAO data"],
    disaggregationBy: ["location"],
  },
];

export const NUTRITION_COMPLIANCE_TEMPLATES: ComplianceChecklistTemplate[] = [
  {
    title: "SAM admission criteria documented",
    description: "All OTP admissions meet WHO/UNICEF SAM criteria (MUAC <115mm or WHZ < -3)",
    severity: "critical",
    category: "evidence",
    relatedDonorRequirements: ["UNHCR NUT 2019 Standard", "Sphere Handbook"],
  },
  {
    title: "RUTF stock levels maintained above 1-month buffer",
    description: "OTP/TFC maintains minimum 30-day RUTF stock at all times",
    severity: "critical",
    category: "financial",
    relatedDonorRequirements: ["UNHCR Supply Chain Standard"],
  },
  {
    title: "MUAC screening coverage >= 80% of under-5 children monthly",
    description: "Monthly MUAC screening reported for target population",
    severity: "high",
    category: "evidence",
    relatedDonorRequirements: ["UNHCR NUT Standard 3.2"],
  },
  {
    title: "IYCF counselling sessions documented",
    description: "PLW and caregivers of children 0-23 months received documented counselling",
    severity: "high",
    category: "evidence",
    relatedDonorRequirements: ["WHO IYCF Guidelines 2023"],
  },
];

export const WASH_COMPLIANCE_TEMPLATES: ComplianceChecklistTemplate[] = [
  {
    title: "Water quality testing results available",
    description: "Monthly E. coli and residual chlorine testing at distribution points",
    severity: "critical",
    category: "evidence",
    relatedDonorRequirements: ["UNHCR WASH Standard 2019", "Sphere WASH Standards"],
  },
  {
    title: "Latrine to user ratio <= 1:20 for communal facilities",
    description: "Current latrine ratio calculated from facility inspection data",
    severity: "critical",
    category: "evidence",
    relatedDonorRequirements: ["Sphere WASH Standards Chapter 2"],
  },
  {
    title: "Hygiene promotion activities documented",
    description: "Hygiene promotion sessions conducted with attendance records",
    severity: "high",
    category: "evidence",
    relatedDonorRequirements: ["IFRC Hygiene Promotion Standard"],
  },
  {
    title: "Solid waste management plan in place",
    description: "Documented plan for excreta disposal and solid waste management",
    severity: "medium",
    category: "evidence",
    relatedDonorRequirements: ["Sphere WASH Standards"],
  },
];

export const PROTECTION_COMPLIANCE_TEMPLATES: ComplianceChecklistTemplate[] = [
  {
    title: "GBV case management protocol in place",
    description: "Written protocol for GBV survivor-centered response and referrals",
    severity: "critical",
    category: "safeguarding",
    relatedDonorRequirements: ["IASC GBV Guidelines", "UNHCR Protection Policy"],
  },
  {
    title: "CP case management system operational",
    description: "Active case management database for unaccompanied and separated children",
    severity: "critical",
    category: "safeguarding",
    relatedDonorRequirements: ["UNHCR CPMS Standard", "CPMS 2.0"],
  },
  {
    title: "PSEA training completed by all staff",
    description: "100% of staff and partners completed PSEA training with current certificates",
    severity: "high",
    category: "safeguarding",
    relatedDonorRequirements: ["UNHCR PSEA Policy 2022"],
  },
  {
    title: "Incident reporting mechanism accessible and documented",
    description: "Community awareness of reporting channels; documented materials available",
    severity: "high",
    category: "safeguarding",
    relatedDonorRequirements: ["IASC Protection Policy"],
  },
];

export const EDUCATION_COMPLIANCE_TEMPLATES: ComplianceChecklistTemplate[] = [
  {
    title: "Child safeguarding policy displayed at learning spaces",
    description: "CP policy and reporting mechanism visibly posted in all learning spaces",
    severity: "critical",
    category: "safeguarding",
    relatedDonorRequirements: ["INEE Minimum Standards", "Child Safeguarding Standards"],
  },
  {
    title: "Teacher background checks completed",
    description: "All teachers have completed reference checks and background verification",
    severity: "high",
    category: "safeguarding",
    relatedDonorRequirements: ["INEE Minimum Standards Chapter 3"],
  },
  {
    title: "Learning space safety inspection completed",
    description: "Fire safety, structural integrity, and WASH access verified at each site",
    severity: "high",
    category: "evidence",
    relatedDonorRequirements: ["INEE Minimum Standards", "Sphere Education Standards"],
  },
  {
    title: "Education cluster coordination documented",
    description: "Active participation in Education Cluster coordination meetings",
    severity: "medium",
    category: "timeline",
    relatedDonorRequirements: ["Education Cluster Guidance"],
  },
];

export const FOOD_SECURITY_COMPLIANCE_TEMPLATES: ComplianceChecklistTemplate[] = [
  {
    title: "IPC analysis conducted and current",
    description: "IPC acute food insecurity analysis within last 6 months",
    severity: "critical",
    category: "evidence",
    relatedDonorRequirements: ["IPC Protocol Version 3.1", "WFP EMW Guidance"],
  },
  {
    title: "Beneficiary eligibility criteria documented",
    description: "Clear targeting criteria based on vulnerability assessment",
    severity: "critical",
    category: "evidence",
    relatedDonorRequirements: ["WFP Targeting Guidance", "Cluster SOPs"],
  },
  {
    title: "Market price monitoring data available",
    description: "Regular market price data for key commodities in intervention area",
    severity: "high",
    category: "evidence",
    relatedDonorRequirements: ["WFP M&E Standards"],
  },
  {
    title: "Post-distribution monitoring completed",
    description: "PDM survey conducted within 2 weeks of each distribution",
    severity: "high",
    category: "evidence",
    relatedDonorRequirements: ["WFP PDM Guidance", "Cash & Voucher Guidelines"],
  },
];
