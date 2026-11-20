"use client";

import { readLocal, writeLocal, type Project } from "@/lib/local-data";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export async function loadProjectsWithCloud(): Promise<{ projects: Project[]; canSync: boolean }> {
  const local = readLocal<Project[]>("projects", []);
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return { projects: local, canSync: false };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { projects: local, canSync: false };
  const { data: profile } = await supabase.from("profiles").select("membership_state").eq("id", user.id).maybeSingle();
  if (profile?.membership_state !== "approved") return { projects: local, canSync: false };
  const { data, error } = await supabase.from("projects").select("id,title,description,week_id,repository_url,reflection,status,updated_at").eq("user_id", user.id);
  if (error || !data) return { projects: local, canSync: false };
  const deletedIds = new Set(readLocal<string[]>("project-deleted-ids", []));
  const ids = data.map((project) => project.id);
  const { data: milestones } = ids.length
    ? await supabase.from("project_milestones").select("project_id,title,completed_at").in("project_id", ids).order("sort_order")
    : { data: [] };
  const cloudProjects: Project[] = data.filter((row) => !deletedIds.has(row.id)).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    week: row.week_id ?? null,
    repository: row.repository_url ?? "",
    reflection: row.reflection ?? "",
    status: row.status as Project["status"],
    milestones: (milestones ?? []).filter((item) => item.project_id === row.id).map((item) => ({ title: item.title, done: Boolean(item.completed_at) })),
    updatedAt: row.updated_at,
  }));
  const merged = new Map(local.map((project) => [project.id, project]));
  for (const cloud of cloudProjects) {
    const existing = merged.get(cloud.id);
    if (!existing || cloud.updatedAt > existing.updatedAt) merged.set(cloud.id, cloud);
  }
  const projects = Array.from(merged.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  writeLocal("projects", projects);
  return { projects, canSync: true };
}

export async function syncProjectsToCloud(projects: Project[]) {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: profile } = await supabase.from("profiles").select("membership_state").eq("id", user.id).maybeSingle();
  if (profile?.membership_state !== "approved") return;
  const tombstones = readLocal<string[]>("project-deleted-ids", []);
  const failedDeletes: string[] = [];
  for (const id of tombstones) {
    const { error } = await supabase.from("projects").delete().eq("id", id).eq("user_id", user.id);
    if (error) failedDeletes.push(id);
  }
  writeLocal("project-deleted-ids", failedDeletes);
  for (const project of projects) {
    const { error } = await supabase.from("projects").upsert({
      id: project.id,
      user_id: user.id,
      week_id: project.week,
      title: project.title,
      description: project.description,
      repository_url: project.repository || null,
      reflection: project.reflection,
      status: project.status,
      updated_at: project.updatedAt,
    });
    if (error) {
      console.warn("Project cloud sync is unavailable:", error.message);
      continue;
    }
    const rows = project.milestones.map((milestone, index) => ({
      project_id: project.id,
      title: milestone.title,
      completed_at: milestone.done ? project.updatedAt : null,
      sort_order: index,
    }));
    if (rows.length) {
      const { error: milestoneError } = await supabase.from("project_milestones").upsert(rows, { onConflict: "project_id,title" });
      if (milestoneError) console.warn("Project milestone sync is unavailable:", milestoneError.message);
    }
  }
}
