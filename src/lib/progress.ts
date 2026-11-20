"use client";

import { readLocal, writeLocal, type StudySession } from "@/lib/local-data";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type ProgressMap = Record<string, boolean>;

function unpackProgress(week: number, key: string) {
  return `week-${week}-${key}`;
}

export async function loadProgress(): Promise<ProgressMap> {
  const local = readLocal<ProgressMap>("curriculum-progress", {});
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return local;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return local;
  const { data: profile } = await supabase.from("profiles").select("membership_state").eq("id", user.id).maybeSingle();
  if (profile?.membership_state !== "approved") return local;
  const { data, error } = await supabase.from("lesson_progress").select("week_id,item_key,completed").eq("user_id", user.id);
  if (error || !data) return local;
  const merged = { ...local };
  for (const row of data) merged[unpackProgress(row.week_id, row.item_key)] = row.completed;
  writeLocal("curriculum-progress", merged);
  return merged;
}

export async function persistProgressItem(key: string, completed: boolean) {
  const next = { ...readLocal<ProgressMap>("curriculum-progress", {}), [key]: completed };
  writeLocal("curriculum-progress", next);
  const match = key.match(/^week-(\d+)-(.+)$/);
  if (!match) return;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: profile } = await supabase.from("profiles").select("membership_state").eq("id", user.id).maybeSingle();
  if (profile?.membership_state !== "approved") return;
  const { error } = await supabase.from("lesson_progress").upsert({
    user_id: user.id,
    week_id: Number(match[1]),
    item_key: match[2],
    completed,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,week_id,item_key" });
  if (error) console.warn("Progress sync will retry on a future update:", error.message);
}

export async function persistStudySession(session: StudySession) {
  const current = readLocal<StudySession[]>("learning-sessions", []);
  if (!current.some((item) => item.id === session.id)) writeLocal("learning-sessions", [session, ...current]);
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: profile } = await supabase.from("profiles").select("membership_state").eq("id", user.id).maybeSingle();
  if (profile?.membership_state !== "approved") return;
  const { error } = await supabase.from("learning_sessions").upsert({
    id: session.id,
    user_id: user.id,
    category: session.category,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    active_seconds: session.seconds,
  });
  if (error) console.warn("Session sync is unavailable:", error.message);
}

export async function loadSessions(): Promise<StudySession[]> {
  const local = readLocal<StudySession[]>("learning-sessions", []);
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return local;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return local;
  const { data: profile } = await supabase.from("profiles").select("membership_state").eq("id", user.id).maybeSingle();
  if (profile?.membership_state !== "approved") return local;
  const { data, error } = await supabase.from("learning_sessions").select("id,category,started_at,ended_at,active_seconds").eq("user_id", user.id).order("started_at", { ascending: false });
  if (error || !data) return local;
  const merged = new Map(local.map((session) => [session.id, session]));
  for (const row of data) merged.set(row.id, { id: row.id, category: row.category as StudySession["category"], startedAt: row.started_at, endedAt: row.ended_at, seconds: row.active_seconds });
  const result = Array.from(merged.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  writeLocal("learning-sessions", result);
  return result;
}
