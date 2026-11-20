import assert from "node:assert/strict";
import test from "node:test";
import { curriculum, phases } from "./curriculum";

test("curriculum contains exactly 24 ordered weeks across six phases", () => {
  assert.equal(curriculum.length, 24);
  assert.deepEqual(curriculum.map((week) => week.week), Array.from({ length: 24 }, (_, index) => index + 1));
  assert.equal(phases.length, 6);
  for (const phase of phases) {
    assert.equal(phase.weeks.length, 4);
    assert.deepEqual(curriculum.filter((week) => week.phase === phase.id).map((week) => week.week), phase.weeks);
  }
});

test("every curriculum week is populated with usable lesson and assessment content", () => {
  for (const week of curriculum) {
    assert.ok(week.title.trim(), `week ${week.week} title`);
    assert.ok(week.summary.trim(), `week ${week.week} summary`);
    for (const field of ["objectives", "topics", "mathematics", "vocabulary", "lectures", "readings", "coding", "assessment", "resources"] as const) {
      assert.ok(week[field].length > 0, `week ${week.week} has ${field}`);
      assert.ok(week[field].every((item) => typeof item === "string" || (typeof item === "object" && Boolean(item.title && item.url))), `week ${week.week} has valid ${field}`);
    }
    assert.ok(week.activity.trim());
    assert.ok(week.assignment.trim());
    assert.ok(week.build.trim());
  }
});

test("all curated resource links use HTTPS and courses with known payment needs are labelled", () => {
  for (const week of curriculum) {
    for (const resource of week.resources) {
      assert.equal(new URL(resource.url).protocol, "https:", `${resource.title} must use HTTPS`);
    }
  }
  const mathematicsCourse = curriculum.flatMap((week) => week.resources).find((resource) => resource.url.includes("coursera.org/specializations/mathematics-for-machine-learning"));
  assert.match(mathematicsCourse?.note ?? "", /paid enrollment/i);
});
