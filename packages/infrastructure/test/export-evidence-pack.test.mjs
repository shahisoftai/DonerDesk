import assert from "node:assert/strict";
import test from "node:test";
import { DefaultExportBuilder, checklistCsvLines, packReadme } from "../dist/exports/builder.js";

const checklist = [{ title: "Sensitive data handling confirmed", severity: "HIGH", status: "RESOLVED", resolutionNotes: "The March safety audit is highly sensitive and excluded." }];

test("a donor copy of the checklist carries no internal resolution notes; an internal copy keeps them", () => {
  const donor = checklistCsvLines({ exportIntent: "DONOR_SUBMISSION", checklist });
  assert.deepEqual(donor, ["Title,Severity,Status", "Sensitive data handling confirmed,HIGH,RESOLVED"]);
  assert.equal(donor.join("\n").includes("safety audit"), false);
  const internal = checklistCsvLines({ exportIntent: "INTERNAL_REVIEW", checklist });
  assert.equal(internal[0], "Title,Severity,Status,Resolution Notes");
  assert.match(internal[1], /safety audit/);
});

test("the pack README says how many files it holds and names what it could not include, with the reason", () => {
  const text = packReadme({ reportTitle: "Final", projectName: "P", reportingPeriodLabel: "2026", evidenceFiles: [{ name: "a.pdf", buffer: Buffer.from("x") }], evidenceNotIncluded: [{ name: "drive.pdf", reason: "kept in the organisation's own Drive, not stored here" }] });
  assert.match(text, /Evidence files included: 1/);
  assert.match(text, /- drive\.pdf: kept in the organisation's own Drive/);
});

test("the zip contains the evidence files under 05_Evidence, not only an index", async () => {
  const builder = new DefaultExportBuilder();
  const out = await builder.build({
    exportType: "EVIDENCE_PACK_ZIP", exportIntent: "DONOR_SUBMISSION", submissionSnapshotId: "snap-1", projectName: "P", reportingPeriodLabel: "2026", reportTitle: "Final",
    sections: [], indicators: [], activities: [], checklist, includeSensitive: false,
    evidenceItems: [{ id: "e1", fileName: "register.csv", title: "Register", type: "ATTENDANCE", verificationStatus: "VERIFIED", confidentiality: "INTERNAL" }],
    evidenceFiles: [{ name: "register.csv", buffer: Buffer.from("No,Name\n1,A\n") }],
  });
  const names = [];
  let i = 0;
  while ((i = out.fileBuffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), i)) !== -1) {
    const len = out.fileBuffer.readUInt16LE(i + 28);
    names.push(out.fileBuffer.subarray(i + 46, i + 46 + len).toString("utf8"));
    i += 46 + len;
  }
  assert.ok(names.includes("05_Evidence/register.csv"), names.join(", "));
  assert.ok(names.includes("index.csv"));
});
