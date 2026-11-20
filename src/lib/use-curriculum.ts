"use client";

import { useEffect, useState } from "react";
import { curriculum as defaultCurriculum, type CurriculumWeek } from "@/lib/curriculum";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function useCurriculumData() {
  const [weeks, setWeeks] = useState<CurriculumWeek[]>(defaultCurriculum);
  const [cloudLoaded, setCloudLoaded] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase!.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase!.from("profiles").select("membership_state").eq("id", user.id).maybeSingle();
      if (profile?.membership_state !== "approved") return;
      const { data, error } = await supabase!.from("curriculum_weeks").select("id,title,summary,content").eq("published", true);
      if (error || !data || cancelled) return;
      const overrides = new Map(data.map((row) => [Number(row.id), row]));
      setWeeks(defaultCurriculum.map((week) => {
        const row = overrides.get(week.week);
        if (!row) return week;
        const content = (row.content ?? {}) as Partial<CurriculumWeek>;
        return {
          ...week,
          title: row.title ?? week.title,
          summary: row.summary ?? week.summary,
          build: content.build ?? week.build,
          assignment: content.assignment ?? week.assignment,
          objectives: content.objectives ?? week.objectives,
          topics: content.topics ?? week.topics,
          mathematics: content.mathematics ?? week.mathematics,
          vocabulary: content.vocabulary ?? week.vocabulary,
          lectures: content.lectures ?? week.lectures,
          readings: content.readings ?? week.readings,
          coding: content.coding ?? week.coding,
          assessment: content.assessment ?? week.assessment,
          activity: content.activity ?? week.activity,
          paper: content.paper ?? week.paper,
        };
      }));
      setCloudLoaded(true);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return { curriculum: weeks, cloudLoaded };
}
