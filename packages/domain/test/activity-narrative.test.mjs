import assert from "node:assert/strict";
import test from "node:test";
import { proposeActivityFromNarrative as propose } from "../dist/index.js";

const today = new Date("2027-03-15T10:00:00Z");

test("an empty description proposes nothing", () => {
  assert.deepEqual(propose("   ", { today }), {});
});

test("date, place, counts and the summary are taken from what the words state", () => {
  const out = propose("Held a hygiene session in Kisumu on 12 March 2027 with 40 women, 12 men and 8 children. 3 people with disabilities attended. 60 participants in total.", { today });
  assert.equal(out.activityDate, "2027-03-12");
  assert.equal(out.location, "Kisumu");
  assert.equal(out.participantsFemale, 40);
  assert.equal(out.participantsMale, 12);
  assert.equal(out.participantsChildren, 8);
  assert.equal(out.participantsDisability, 3);
  assert.equal(out.participantsTotal, 60);
  assert.match(out.activityTitle, /^Held a hygiene session in Kisumu/);
  assert.match(out.summary, /Held a hygiene session/);
});

test("nothing is invented: a text with no date, place or counts proposes only a title and summary", () => {
  const out = propose("The team met with the committee and agreed a plan.", { today });
  assert.deepEqual(Object.keys(out).sort(), ["activityTitle", "summary"]);
});

test("today and yesterday use the clock passed in; a month and day borrow this year", () => {
  assert.equal(propose("We trained staff today.", { today }).activityDate, "2027-03-15");
  assert.equal(propose("We trained staff yesterday.", { today }).activityDate, "2027-03-14");
  assert.equal(propose("Training on March 3rd.", { today }).activityDate, "2027-03-03");
  assert.equal(propose("Training on 31 February 2027.", { today }).activityDate, undefined);
});

test("labelled sections fill their fields; a label inside a sentence does not open one", () => {
  const out = propose("Opened the borehole. Achievements: 2 boreholes drilled. Challenges: the road was flooded. Lessons learned: start earlier. Next steps: return in May.", { today });
  assert.equal(out.achievements, "2 boreholes drilled.");
  assert.equal(out.challenges, "the road was flooded.");
  assert.equal(out.lessonsLearned, "start earlier.");
  assert.equal(out.nextSteps, "return in May.");
  assert.equal(out.summary, "Opened the borehole.");
  const inline = propose("We discussed the next steps with the committee.", { today });
  assert.equal(inline.nextSteps, undefined);
});

test("a sentence-initial 'In March' is not a place", () => {
  assert.equal(propose("In March we trained staff.", { today }).location, undefined);
  assert.equal(propose("We trained staff at Dadu District Hospital.", { today }).location, "Dadu District Hospital");
});

test("a long first sentence is shortened for the title only", () => {
  const long = `${"word ".repeat(60)}end.`;
  const out = propose(long, { today });
  assert.ok(out.activityTitle.length <= 120);
  assert.equal(out.summary, long.trim());
});
