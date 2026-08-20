import { PrismaClient } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_ADMIN_URL ?? "postgresql://donordesk_migrator:KpPBXNNhtTF41JfjV5lMZlCd@127.0.0.1:5432/donordesk";

console.log("Linking EERP demo evidence to activities and indicator updates...");

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

const TENANT_ID = "faed0177-5f2d-4a42-864f-e4c254e6d247";
const PROJECT_ID = "0d0e3a2b-ad21-4b07-a2e1-b649d828e26f";

interface EvidenceRow {
  id: string;
  title: string;
}

interface ActivityRow {
  id: string;
  activityTitle: string;
}

interface UpdateRow {
  id: string;
  indicatorId: string;
}

async function main() {
  const evidenceRows = await prisma.$queryRaw<EvidenceRow[]>`
    SELECT id, title FROM "EvidenceFile" WHERE "projectId" = ${PROJECT_ID}
  `;
  const evidence = new Map<string, string>(evidenceRows.map((e) => [e.id, e.title.toLowerCase()]));

  const activities = await prisma.$queryRaw<ActivityRow[]>`
    SELECT id, "activityTitle" FROM "ActivityUpdate" WHERE "projectId" = ${PROJECT_ID}
  `;

  const indicatorCodeById = new Map<string, string | null>();
  const indicatorRows = await prisma.$queryRaw<Array<{ id: string; code: string }>>`
    SELECT id, code FROM "Indicator" WHERE "projectId" = ${PROJECT_ID}
  `;
  for (const r of indicatorRows) indicatorCodeById.set(r.id, r.code);

  const updates = await prisma.$queryRaw<UpdateRow[]>`
    SELECT id, "indicatorId" FROM "IndicatorUpdate"
    WHERE "indicatorId" IN (SELECT id FROM "Indicator" WHERE "projectId" = ${PROJECT_ID})
  `;

  // Keyword matching: which evidence "talks about" which activity / indicator.
  const keywords = (s: string): string[] => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["the", "and", "for", "with", "that", "this", "sheet", "list", "report", "update", "file", "2026"].includes(w));

  // Curated demo mapping: indicator code -> evidence title substrings.
  const INDICATOR_EVIDENCE_MAP: Array<{ code: string; substrings: string[] }> = [
    { code: "OUT-1", substrings: ["learning centre establishment photos", "learning centre inspection"] },
    { code: "OUT-2", substrings: ["learning materials distribution"] },
    { code: "OUT-3", substrings: ["teacher training attendance"] },
    { code: "OUT-4", substrings: ["beneficiary list", "enrolment campaign"] },
    { code: "OUT-5", substrings: ["beneficiary list", "attendance"] },
    { code: "OUT-6", substrings: ["baseline learning assessment", "midline learning assessment"] },
    { code: "OUT-7", substrings: ["baseline learning assessment", "midline learning assessment"] },
    { code: "OUT-8", substrings: ["numeracy flashcard", "baseline learning assessment", "midline learning assessment"] },
    { code: "OUT-9", substrings: ["numeracy flashcard", "midline learning assessment"] },
    { code: "OUT-10", substrings: ["teacher training attendance"] },
    { code: "OUT-11", substrings: ["child safeguarding training"] },
    { code: "OUT-12", substrings: ["community volunteer training"] },
    { code: "OUT-13", substrings: ["beneficiary list", "enrolment campaign"] },
    { code: "OUT-14", substrings: ["beneficiary list", "attendance"] },
    { code: "OUT-15", substrings: ["attendance"] },
    { code: "OUT-16", substrings: ["baseline learning assessment", "midline learning assessment"] },
    { code: "OUT-17", substrings: ["numeracy flashcard", "midline learning assessment"] },
    { code: "OUT-18", substrings: ["child safeguarding training", "child protection referral"] },
    { code: "OUT-19", substrings: ["child protection referral"] },
    { code: "OUT-20", substrings: ["beneficiary list", "community volunteer"] },
  ];

  // Activity title -> evidence title substrings.
  const ACTIVITY_EVIDENCE_MAP: Array<{ substrings: string[]; match: string[] }> = [
    { match: ["teacher training"], substrings: ["teacher training attendance"] },
    { match: ["learning centre", "establishment"], substrings: ["learning centre establishment photos", "learning centre inspection"] },
    { match: ["learning centre", "expansion"], substrings: ["learning centre photos", "learning centre inspection"] },
    { match: ["distribution", "learning kit", "material"], substrings: ["learning materials distribution"] },
    { match: ["baseline", "assessment"], substrings: ["baseline learning assessment"] },
    { match: ["midline", "assessment"], substrings: ["midline learning assessment"] },
    { match: ["safeguarding", "protection"], substrings: ["child safeguarding training", "child protection referral"] },
    { match: ["volunteer"], substrings: ["community volunteer training"] },
    { match: ["enrolment", "mobilisation", "campaign"], substrings: ["enrolment campaign photos", "beneficiary list"] },
    { match: ["numeracy"], substrings: ["numeracy flashcard"] },
    { match: ["inspection"], substrings: ["learning centre inspection"] },
    { match: ["remedial", "support"], substrings: ["midline learning assessment", "baseline learning assessment"] },
  ];

  const matchByMap = (title: string, map: Array<{ code?: string; substrings: string[]; match?: string[] }>, mode: "code" | "activity"): string[] => {
    const titleLower = title.toLowerCase();
    const hits: string[] = [];
    for (const entry of map) {
      if (mode === "code") {
        // entry.code is the indicator code; the evidence substrings are the
        // evidence titles that support that indicator.
        if (entry.code && titleLower === entry.code.toLowerCase()) {
          for (const [id, evTitle] of evidence) {
            if (entry.substrings.some((s) => evTitle.includes(s))) hits.push(id);
          }
        }
      } else if (entry.match?.some((m) => titleLower.includes(m))) {
        for (const [id, evTitle] of evidence) {
          if (entry.substrings.some((s) => evTitle.includes(s))) hits.push(id);
        }
      }
    }
    return [...new Set(hits)].slice(0, 2);
  };

  const scoreTitle = (title: string, haystack: string[]): number => {
    const words = keywords(title);
    let score = 0;
    for (const w of words) {
      if (haystack.some((h) => h.includes(w))) score += 1;
    }
    return score;
  };

  const matchEvidence = (title: string): string[] => {
    const titleLower = title.toLowerCase();
    const haystack = [titleLower];
    const scored: Array<{ id: string; score: number }> = [];
    for (const [id, evTitle] of evidence) {
      const s = scoreTitle(evTitle, haystack);
      if (s > 0) scored.push({ id, score: s });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 2).map((x) => x.id);
  };

  // 1. Link evidence to activities by curated map + keyword fallback.
  let linkedActivities = 0;
  for (const a of activities) {
    const mapped = matchByMap(a.activityTitle, ACTIVITY_EVIDENCE_MAP, "activity");
    const ids = mapped.length > 0 ? mapped : matchEvidence(a.activityTitle);
    if (ids.length > 0) {
      await prisma.$executeRaw`
        UPDATE "ActivityUpdate" SET "attachedEvidenceIds" = ${JSON.stringify(ids)}::text, "updatedAt" = NOW()
        WHERE id = ${a.id}
      `;
      linkedActivities += 1;
    }
  }

  // 2. Link evidence to indicator updates by curated code map + fallback.
  let linkedUpdates = 0;
  for (const u of updates) {
    const code = indicatorCodeById.get(u.indicatorId) ?? "";
    const mapped = matchByMap(code, INDICATOR_EVIDENCE_MAP, "code");
    const ids = mapped.length > 0 ? mapped : matchEvidence(code);
    if (ids.length > 0) {
      await prisma.$executeRaw`
        UPDATE "IndicatorUpdate" SET "attachedEvidenceIds" = ${JSON.stringify(ids)}::text, "updatedAt" = NOW()
        WHERE id = ${u.id}
      `;
      linkedUpdates += 1;
    }
  }

  console.log(`Linked evidence to ${linkedActivities} activities and ${linkedUpdates} indicator updates.`);
  console.log(`Evidence files available: ${evidence.size}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });