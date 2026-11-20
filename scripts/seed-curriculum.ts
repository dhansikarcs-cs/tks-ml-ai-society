import { createClient } from "@supabase/supabase-js";
import { curriculum, phases } from "../src/lib/curriculum";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment before seeding.");
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  const phaseRows = phases.map((phase) => ({
    id: phase.id,
    title: phase.title,
    subtitle: phase.subtitle,
    sort_order: phase.id,
  }));
  const phaseResult = await supabase.from("curriculum_phases").upsert(phaseRows, { onConflict: "id" });
  if (phaseResult.error) throw phaseResult.error;

  const weekRows = curriculum.map((week) => ({
    id: week.week,
    phase_id: week.phase,
    title: week.title,
    summary: week.summary,
    content: {
      objectives: week.objectives,
      topics: week.topics,
      mathematics: week.mathematics,
      vocabulary: week.vocabulary,
      lectures: week.lectures,
      readings: week.readings,
      paper: week.paper ?? null,
      coding: week.coding,
      activity: week.activity,
      assignment: week.assignment,
      assessment: week.assessment,
      build: week.build,
    },
  }));
  const weekResult = await supabase.from("curriculum_weeks").upsert(weekRows, { onConflict: "id" });
  if (weekResult.error) throw weekResult.error;

  const resourceRows = curriculum.flatMap((week) => week.resources.map((resource) => ({
    week_id: week.week,
    title: resource.title,
    url: resource.url,
    kind: resource.kind,
    note: resource.note ?? null,
  })));
  const resourceResult = await supabase.from("resources").upsert(resourceRows, { onConflict: "week_id,url", ignoreDuplicates: true });
  if (resourceResult.error) throw resourceResult.error;

  const assignmentRows = curriculum.map((week) => ({
    week_id: week.week,
    title: `Week ${String(week.week).padStart(2, "0")}: ${week.build}`,
    description: week.assignment,
    published: true,
  }));
  const assignmentResult = await supabase.from("assignments").upsert(assignmentRows, { onConflict: "week_id,title", ignoreDuplicates: true });
  if (assignmentResult.error) throw assignmentResult.error;

  console.log(`Seeded ${phases.length} phases, ${curriculum.length} weeks, ${resourceRows.length} resource links, and ${assignmentRows.length} assignments.`);
}

seed().catch((error: unknown) => {
  console.error("Curriculum seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
