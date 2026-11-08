import { defineContent } from "../content.js";
import { sectorWriter } from "../define.js";

const w = sectorWriter({ sector: "EDUCATION", src: "INEE_2010" });
const { ind } = w;
w.group("Access and learning environment");
const access = [
  ind("EDU-01", "Children and adolescents enrolled in supported education", { def: "Girls and boys enrolled in formal or non-formal education the project supports.", unit: "children", dims: ["SEX", "AGE", "DIS"], role: "children_enrolled", rec: true, std: "Access and learning environment", mov: ["Enrolment registers"] }),
  ind("EDU-02", "Attendance rate in supported schools or learning spaces", { def: "Share of enrolled children who attended on a typical school day in the period.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["SEX"], freq: "Monthly", role: "attendance_rate", rec: true, mov: ["Attendance registers"] }),
  ind("EDU-03", "Safe learning spaces built, rehabilitated or equipped", { def: "Classrooms or temporary learning spaces built, repaired or equipped to a safe standard.", unit: "learning spaces", role: "learning_spaces", rec: true, mov: ["Completion certificates"] }),
  ind("EDU-04", "Learning spaces with safe water and separate toilets", { def: "Share of supported learning spaces with safe water and separate toilets for girls and boys.", kind: "RATE", dir: "H", also: ["WASH"], mov: ["School assessment"], std: "Access and learning environment" }),
  ind("EDU-05", "Children receiving learning materials", { def: "Children who received textbooks, stationery or a learning kit.", unit: "children", dims: ["SEX"], mov: ["Distribution lists"] }),
];
w.group("Teaching and learning");
const teaching = [
  ind("EDU-06", "Teachers and facilitators trained", { def: "Teachers, facilitators and education staff who completed training in the project.", unit: "people", dims: ["SEX"], role: "teachers_trained", rec: true, std: "Teachers and other education personnel", mov: ["Training attendance lists"] }),
  ind("EDU-07", "Children demonstrating the expected reading skill for their grade", { def: "Share of tested children who read at or above the expected level for their grade.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["SEX"], freq: "Per assessment", std: "Teaching and learning", mov: ["Learning assessment"], src: "SDG" }),
  ind("EDU-08", "Children completing the school year or a learning cycle", { def: "Share of enrolled children who completed the year or cycle.", kind: "RATE", dir: "H", level: "OUTCOME", dims: ["SEX"], freq: "Annual", mov: ["School records"] }),
  ind("EDU-09", "Children given psychosocial and social-emotional learning support", { def: "Children who took part in structured psychosocial or social-emotional learning activities.", unit: "children", dims: ["SEX", "AGE"], also: ["MHPSS"], mov: ["Activity registers"] }),
  ind("EDU-10", "Parent and community committees active", { def: "School or community education committees that met in the period and acted on issues.", unit: "committees", mov: ["Meeting minutes"], std: "Community participation" }),
];

export const EDUCATION = defineContent({
  sectorId: "EDUCATION",
  summary: "Quality, safe education before, during and after crisis, following the INEE minimum standards.",
  indicators: [...access, ...teaching],
  dashboardTemplates: ["tpl-education-access-learning"],
  logframe: [
    { key: "g", level: "GOAL", title: "Girls and boys learn in safe, inclusive education" },
    { key: "o-access", level: "OUTCOME", title: "Children and adolescents have access to safe learning", parent: "g" },
    { key: "o-learn", level: "OUTCOME", title: "Children learn and stay in education", parent: "g" },
    { key: "out-spaces", level: "OUTPUT", title: "Learning spaces provided and equipped", parent: "o-access" },
    { key: "out-teach", level: "OUTPUT", title: "Teachers trained and supported", parent: "o-learn" },
  ],
  assessment: [
    { key: "out-of-school", question: "How many school-age girls and boys are out of school, and why?", answerType: "TEXT", why: "Shapes enrolment and barriers.", required: true },
    { key: "teachers", question: "Are there enough qualified teachers, and are they paid?", answerType: "TEXT", why: "Quality depends on teachers.", required: true },
    { key: "curriculum", question: "Which curriculum and language will be used?", answerType: "TEXT", why: "Recognition of learning matters.", required: false },
  ],
  forms: [{ key: "attendance", title: "Daily attendance", purpose: "Record attendance by class, girls and boys.", fields: [{ label: "School", type: "PLACE", required: true }, { label: "Date", type: "DATE", required: true }, { label: "Girls present", type: "NUMBER", required: true }, { label: "Boys present", type: "NUMBER", required: true }], feeds: ["EDU-02"] }],
  evidence: [{ key: "enrolment-register", name: "Enrolment register", description: "Children enrolled by class, sex and age.", confidentiality: "SENSITIVE" }, { key: "learning-assessment", name: "Learning assessment report", description: "Method and results of testing.", confidentiality: "INTERNAL" }],
  checklist: [{ key: "teacher-code", title: "Teachers signed a code of conduct", description: "Child safeguarding is part of the contract.", severity: "high", kind: "ATTESTATION", standard: "Teachers and other education personnel" }],
  risks: [{ title: "Schools are attacked or closed", kind: "RISK", seriousness: "HIGH", mitigation: "Agree safe-school measures and flexible learning options." }, { title: "Girls drop out for safety or cost reasons", kind: "PROBLEM", seriousness: "MEDIUM", mitigation: "Reduce costs, improve safety, and engage families." }],
  glossary: [{ term: "Learning space", meaning: "A school or temporary place where children learn." }, { term: "Non-formal education", meaning: "Organised learning outside the regular school system." }],
  blueprint: [{ title: "Access to education", guidance: "Enrolment, attendance and safe spaces." }, { title: "Learning outcomes", guidance: "Teaching quality, learning results and completion." }],
});
