"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Check, CircleAlert, ClipboardList, Search, ShieldCheck, Users, X } from "lucide-react";
import { ModuleShell, Panel } from "@/components/module-shell";
import { curriculum } from "@/lib/curriculum";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Profile = { id: string; email: string; display_name: string; role: string; membership_state: string; created_at: string };
type Submission = { id: string; user_id: string; assignment_id: string; response: string; repository_url: string | null; status: string; submitted_at: string | null };
type AdminResource = { id: string; week_id: number | null; title: string; url: string; kind: string; note: string | null };
type AdminStats = { approved_members: number; active_members_7d: number; active_seconds_7d: number; pending_reviews: number; published_assignments: number };
type AdminProject = { id: string; user_id: string; week_id: number | null; title: string; description: string; repository_url: string | null; reflection: string; status: string; updated_at: string };
type SupportRequest = { id: string; user_id: string; category: string; subject: string; message: string; status: "open" | "in_progress" | "resolved"; admin_note: string | null; created_at: string };
type ProgressRow = { user_id: string; week_id: number; item_key: string; completed: boolean };
type SessionRow = { user_id: string; active_seconds: number; started_at: string };

export function AdminConsole() {
  const [state, setState] = useState<"loading" | "setup" | "signed-out" | "pending" | "denied" | "ready" | "error">("loading");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [assignmentTitles, setAssignmentTitles] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"members" | "progress" | "submissions" | "content" | "analytics" | "support">("members");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resources, setResources] = useState<AdminResource[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [weekDraft, setWeekDraft] = useState({ title: curriculum[0].title, summary: curriculum[0].summary, build: curriculum[0].build, assignment: curriculum[0].assignment });
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [leaderboardWeights, setLeaderboardWeights] = useState({ assessment: 25, project: 30, research: 20, consistency: 15, repository: 10 });
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [peerSelections, setPeerSelections] = useState<Record<string, string>>({});
  const [projectFeedbackDrafts, setProjectFeedbackDrafts] = useState<Record<string, string>>({});
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [supportNotes, setSupportNotes] = useState<Record<string, string>>({});
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  const [sessionRows, setSessionRows] = useState<SessionRow[]>([]);

  const loadAdmin = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setState("setup"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setState("signed-out"); return; }
    const { data: own, error: profileError } = await supabase.from("profiles").select("role,membership_state").eq("id", user.id).maybeSingle();
    if (profileError) { setState("error"); setMessage(profileError.message); return; }
    if (!own || own.membership_state !== "approved") { setState("pending"); return; }
    if (own.role !== "admin") { setState("denied"); return; }
    const [{ data: memberRows, error: membersError }, { data: submissionRows }, { data: assignments }, { data: resourceRows }, { data: statRows }, { data: settings }, { data: curriculumRows }, { data: projectRows }, { data: supportRows }, { data: progressData }, { data: sessionData }] = await Promise.all([
      supabase.from("profiles").select("id,email,display_name,role,membership_state,created_at").order("created_at", { ascending: false }),
      supabase.from("submissions").select("id,user_id,assignment_id,response,repository_url,status,submitted_at").in("status", ["submitted", "in_review", "reviewed"]).order("submitted_at", { ascending: false }),
      supabase.from("assignments").select("id,title"),
      supabase.from("resources").select("id,week_id,title,url,kind,note").order("title"),
      supabase.from("society_analytics").select("*").maybeSingle(),
      supabase.from("leaderboard_settings").select("weights,enabled").eq("singleton", true).maybeSingle(),
      supabase.from("curriculum_weeks").select("id,title,summary,content"),
      supabase.from("projects").select("id,user_id,week_id,title,description,repository_url,reflection,status,updated_at").order("updated_at", { ascending: false }),
      supabase.from("support_requests").select("id,user_id,category,subject,message,status,admin_note,created_at").order("created_at", { ascending: false }),
      supabase.from("lesson_progress").select("user_id,week_id,item_key,completed"),
      supabase.from("learning_sessions").select("user_id,active_seconds,started_at").order("started_at", { ascending: false }).limit(2000),
    ]);
    if (membersError) { setState("error"); setMessage(membersError.message); return; }
    setProfiles((memberRows ?? []) as Profile[]);
    setSubmissions((submissionRows ?? []) as Submission[]);
    setProjects((projectRows ?? []) as AdminProject[]);
    setAssignmentTitles(Object.fromEntries((assignments ?? []).map((item) => [item.id, item.title])));
    setResources((resourceRows ?? []) as AdminResource[]);
    setStats((statRows ?? null) as AdminStats | null);
    setSupportRequests((supportRows ?? []) as SupportRequest[]);
    setProgressRows((progressData ?? []) as ProgressRow[]);
    setSessionRows((sessionData ?? []) as SessionRow[]);
    if (settings?.weights) setLeaderboardWeights((current) => ({ ...current, ...(settings.weights as typeof current) }));
    if (settings) setLeaderboardEnabled(settings.enabled);
    const selected = curriculumRows?.find((row) => Number(row.id) === selectedWeek);
    const week = curriculum[selectedWeek - 1];
    const savedContent = (selected?.content ?? {}) as Record<string, string>;
    if (week) setWeekDraft({
      title: selected?.title ?? week.title,
      summary: selected?.summary ?? week.summary,
      build: savedContent.build ?? week.build,
      assignment: savedContent.assignment ?? week.assignment,
    });
    setState("ready");
  }, [selectedWeek]);

  useEffect(() => { void loadAdmin(); }, [loadAdmin]);

  useEffect(() => {
    const week = curriculum[selectedWeek - 1];
    if (week) setWeekDraft({ title: week.title, summary: week.summary, build: week.build, assignment: week.assignment });
  }, [selectedWeek]);

  async function setMembership(profile: Profile, status: "approved" | "denied") {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ membership_state: status }).eq("id", profile.id);
    setBusy(false);
    if (error) return setMessage(error.message);
    setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, membership_state: status } : item));
    setMessage(`${profile.display_name || profile.email} ${status}.`);
  }

  async function changeRole(profile: Profile, role: "member" | "admin") {
    if (!window.confirm(`Change ${profile.display_name || profile.email} to ${role}? Administrators have access to member-management operations.`)) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.from("profiles").update({ role }).eq("id", profile.id);
    if (error) return setMessage(error.message);
    setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, role } : item));
    setMessage(`Role updated to ${role}.`);
  }

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("assignments").insert({
      week_id: Number(form.get("week")),
      title: String(form.get("title") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      due_at: form.get("due_at") || null,
      published: form.get("published") === "on",
      created_by: user?.id,
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    setMessage("Assignment created.");
    formElement.reset();
    void loadAdmin();
  }

  async function createAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("announcements").insert({
      title: String(form.get("title") ?? "").trim(),
      body: String(form.get("body") ?? "").trim(),
      published: form.get("published") === "on",
      published_at: form.get("published") === "on" ? new Date().toISOString() : null,
      created_by: user?.id,
    });
    if (error) return setMessage(error.message);
    setMessage("Announcement saved.");
    formElement.reset();
  }

  async function createResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const url = String(form.get("url") ?? "").trim();
    try {
      if (new URL(url).protocol !== "https:") throw new Error("Use an HTTPS resource URL.");
    } catch (error) {
      return setMessage(error instanceof Error ? error.message : "Enter a valid URL.");
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("resources").insert({
      week_id: form.get("week") ? Number(form.get("week")) : null,
      title: String(form.get("title") ?? "").trim(),
      url,
      kind: String(form.get("kind") ?? "Reference"),
      note: String(form.get("note") ?? "").trim() || null,
      created_by: user?.id,
    });
    if (error) return setMessage(error.message);
    formElement.reset();
    setMessage("Resource added to the member library.");
    void loadAdmin();
  }

  async function saveCurriculumWeek(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const original = curriculum[selectedWeek - 1];
    const { data: existing } = await supabase.from("curriculum_weeks").select("content").eq("id", selectedWeek).maybeSingle();
    const content = { ...((existing?.content ?? {}) as Record<string, unknown>), build: weekDraft.build, assignment: weekDraft.assignment };
    const { error } = await supabase.from("curriculum_weeks").upsert({
      id: selectedWeek,
      phase_id: original.phase,
      title: weekDraft.title.trim(),
      summary: weekDraft.summary.trim(),
      content,
      published: true,
    }, { onConflict: "id" });
    if (error) return setMessage(error.message);
    setMessage(`Week ${selectedWeek} curriculum updated. Approved members will see the published changes.`);
  }

  async function saveWeights(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const total = Object.values(leaderboardWeights).reduce((sum, value) => sum + Number(value), 0);
    if (total !== 100) return setMessage(`Leaderboard weights must add up to 100% (currently ${total}%).`);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.from("leaderboard_settings").upsert({ singleton: true, enabled: leaderboardEnabled, weights: leaderboardWeights, updated_at: new Date().toISOString() });
    setMessage(error ? error.message : "Leaderboard scoring weights saved.");
  }

  async function saveMemberScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = ["assessment", "project", "research", "consistency", "repository"] as const;
    const score = Object.fromEntries(values.map((key) => [key, Number(form.get(key))]));
    if (values.some((key) => !Number.isFinite(score[key]) || score[key] < 0 || score[key] > 100)) {
      return setMessage("Contribution components must each be between 0 and 100.");
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.from("leaderboard_scores").upsert({
      user_id: String(form.get("user_id")),
      period_type: String(form.get("period_type")),
      period_key: String(form.get("period_key")).trim(),
      assessment_points: score.assessment,
      project_points: score.project,
      research_points: score.research,
      consistency_points: score.consistency,
      repository_points: score.repository,
      updated_at: new Date().toISOString(),
    });
    setMessage(error ? error.message : "Contribution score recorded. Rankings reflect the configured weights.");
  }

  async function deleteResource(resource: AdminResource) {
    if (!window.confirm(`Remove “${resource.title}” from the society resource library?`)) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.from("resources").delete().eq("id", resource.id);
    if (error) return setMessage(error.message);
    setResources((current) => current.filter((item) => item.id !== resource.id));
    setMessage("Resource removed.");
  }

  async function addFeedback(submission: Submission) {
    const body = feedbackDrafts[submission.id]?.trim();
    if (!body) return setMessage("Write feedback before submitting it.");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("feedback").insert({ submission_id: submission.id, reviewer_id: user?.id, body, is_peer_review: false });
    if (error) return setMessage(error.message);
    setFeedbackDrafts((current) => ({ ...current, [submission.id]: "" }));
    setMessage("Feedback sent to the member.");
    await reviewSubmission(submission, "reviewed");
  }

  async function assignPeerReviewer(submission: Submission) {
    const reviewerId = peerSelections[submission.id];
    if (!reviewerId) return setMessage("Choose an approved member to review this work.");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("peer_review_assignments").insert({ submission_id: submission.id, reviewer_id: reviewerId, created_by: user?.id });
    setMessage(error ? error.message : "Peer review assigned.");
  }

  async function addProjectFeedback(project: AdminProject) {
    const body = projectFeedbackDrafts[project.id]?.trim();
    if (!body) return setMessage("Write feedback before sending it.");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("project_feedback").insert({ project_id: project.id, reviewer_id: user?.id, body });
    if (error) return setMessage(error.message);
    setProjectFeedbackDrafts((current) => ({ ...current, [project.id]: "" }));
    setMessage("Project feedback sent to the member.");
  }

  async function updateProjectStatus(project: AdminProject, status: "planning" | "in_progress" | "submitted") {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.from("projects").update({ status, updated_at: new Date().toISOString() }).eq("id", project.id);
    if (error) return setMessage(error.message);
    setProjects((current) => current.map((item) => item.id === project.id ? { ...item, status } : item));
  }

  async function reviewSubmission(submission: Submission, action: "in_review" | "reviewed") {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.from("submissions").update({ status: action, updated_at: new Date().toISOString() }).eq("id", submission.id);
    if (error) return setMessage(error.message);
    setSubmissions((current) => current.map((item) => item.id === submission.id ? { ...item, status: action } : item));
    setMessage(`Submission marked ${action.replace("_", " ")}.`);
  }

  async function updateSupportRequest(request: SupportRequest, status: SupportRequest["status"]) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const admin_note = (supportNotes[request.id] ?? request.admin_note ?? "").trim() || null;
    const { error } = await supabase.from("support_requests").update({ status, admin_note }).eq("id", request.id);
    if (error) return setMessage(error.message);
    setSupportRequests((current) => current.map((item) => item.id === request.id ? { ...item, status, admin_note } : item));
    setMessage(`Support request marked ${status.replace("_", " ")}.`);
  }

  const filteredProfiles = useMemo(() => profiles.filter((profile) => `${profile.display_name} ${profile.email} ${profile.membership_state} ${profile.role}`.toLowerCase().includes(query.toLowerCase())), [profiles, query]);
  const pendingCount = profiles.filter((profile) => profile.membership_state === "pending").length;
  const openSupportCount = supportRequests.filter((request) => request.status !== "resolved").length;

  return <ModuleShell title="Administration" description="Secure member, learning-content, and submission management." icon={ShieldCheck}>
    {state !== "ready" ? <div className="admin-access-card">
      <span className="admin-access-icon">{state === "loading" ? <ShieldCheck size={22} /> : state === "denied" ? <CircleAlert size={22} /> : <ShieldCheck size={22} />}</span>
      <h2>{state === "loading" ? "Checking administrator access…" : state === "setup" ? "Cloud administration needs setup" : state === "signed-out" ? "Sign in to administer" : state === "pending" ? "Membership approval required" : state === "denied" ? "Administrator role required" : "Could not load admin workspace"}</h2>
      <p>{state === "setup" ? "Add Supabase project credentials, apply the database migration, and sign in with an approved administrator account. Administrative access requires a real server-enforced role." : state === "signed-out" ? "Administrative operations require a signed-in, approved administrator account." : state === "denied" ? "Your account is not an approved administrator. Member and administrator data is protected by database row-level security." : state === "pending" ? "Your membership needs administrator approval before protected society data is available." : message}</p>
      {state === "setup" || state === "signed-out" ? <a className="primary-button module-action-button" href="/login">Account setup <ShieldCheck size={14} /></a> : null}
    </div> : <>
      <div className="admin-metrics"><div><span><Users size={16} /></span><strong>{profiles.length}</strong><small>Members</small></div><div><span><CircleAlert size={16} /></span><strong>{pendingCount}</strong><small>Awaiting approval</small></div><div><span><ClipboardList size={16} /></span><strong>{submissions.filter((item) => ["submitted", "in_review"].includes(item.status)).length + openSupportCount}</strong><small>Reviews &amp; open requests</small></div></div>
      <div className="admin-tabs">{(["members", "progress", "submissions", "content", "analytics", "support"] as const).map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={activeTab === tab ? "admin-tab-active" : ""}>{tab === "members" ? "Members" : tab === "progress" ? "Member progress" : tab === "submissions" ? "Submissions" : tab === "content" ? "Curriculum & updates" : tab === "analytics" ? "Society analytics" : `Support (${openSupportCount})`}</button>)}</div>
      {activeTab === "members" && <Panel collapsible title="Member management" description="Approve membership requests and manage access. Role changes require confirmation.">
        <label className="module-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search members..." /></label>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Member</th><th>Status</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{filteredProfiles.map((profile) => <tr key={profile.id}><td><strong>{profile.display_name || "Member"}</strong><small>{profile.email}</small></td><td><span className={`member-state member-${profile.membership_state}`}>{profile.membership_state}</span></td><td><select value={profile.role as "member" | "admin"} onChange={(event) => void changeRole(profile, event.target.value as "member" | "admin")} aria-label={`Change role for ${profile.display_name}`}><option value="member">Member</option><option value="admin">Admin</option></select></td><td>{new Date(profile.created_at).toLocaleDateString()}</td><td>{profile.membership_state === "pending" ? <div className="admin-row-actions"><button onClick={() => void setMembership(profile, "approved")} disabled={busy}><Check size={13} /> Approve</button><button onClick={() => void setMembership(profile, "denied")} disabled={busy}><X size={13} /> Deny</button></div> : profile.membership_state === "denied" ? <button className="admin-row-text-button" onClick={() => void setMembership(profile, "approved")}>Reinstate</button> : <span className="admin-current-status">Active</span>}</td></tr>)}</tbody></table></div>
        {!filteredProfiles.length && <div className="admin-table-empty">No members match this search.</div>}
      </Panel>}
      {activeTab === "progress" && <Panel collapsible title="Member progress (admin only)" description="Master view of member learning progress. Only visible to administrators.">
        <label className="module-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search members..." /></label>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Member</th><th>Curriculum</th><th>Study time</th><th>Projects</th><th>Submissions</th><th>Last active</th></tr></thead><tbody>{filteredProfiles.map((profile) => {
          const pRows = progressRows.filter((r) => r.user_id === profile.id && r.completed);
          const completedWeeks = new Set(pRows.filter((r) => r.item_key === "complete").map((r) => r.week_id)).size;
          const completedItems = pRows.length;
          const memberSessions = sessionRows.filter((s) => s.user_id === profile.id);
          const totalSeconds = memberSessions.reduce((sum, s) => sum + (Number(s.active_seconds) || 0), 0);
          const lastActive = memberSessions[0]?.started_at;
          const memberProjects = projects.filter((p) => p.user_id === profile.id).length;
          const memberSubmissions = submissions.filter((s) => s.user_id === profile.id).length;
          const pct = Math.round((completedWeeks / 24) * 100);
          return <tr key={profile.id}><td><strong>{profile.display_name || "Member"}</strong><small>{profile.email}</small></td><td><div className="admin-progress-cell"><strong>{pct}%</strong><small>{completedWeeks}/24 weeks · {completedItems} items</small><div className="admin-progress-bar"><span style={{ width: `${pct}%` }} /></div></div></td><td><strong>{(totalSeconds / 3600).toFixed(1)}h</strong><small>{memberSessions.length} sessions</small></td><td><strong>{memberProjects}</strong></td><td><strong>{memberSubmissions}</strong></td><td><small>{lastActive ? new Date(lastActive).toLocaleDateString() : "No activity"}</small></td></tr>;
        })}</tbody></table></div>
        {!filteredProfiles.length && <div className="admin-table-empty">No members match this search.</div>}
      </Panel>}
      {activeTab === "submissions" && <div className="admin-review-panels"><Panel collapsible title="Assignment submission review" description="Review member explanations and repository submissions; do not infer code you have not inspected.">
        {submissions.length ? <div className="submission-review-list">{submissions.map((submission) => <article className="submission-review-card" key={submission.id}>
          <div className="submission-review-heading"><div><strong>{assignmentTitles[submission.assignment_id] ?? "Assignment"}</strong><small>Member {submission.user_id.slice(0, 8)} · {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "Draft"}</small></div><span className={`member-state member-${submission.status}`}>{submission.status.replace("_", " ")}</span></div>
          {submission.repository_url && (isGithubUrl(submission.repository_url) ? <a href={submission.repository_url} target="_blank" rel="noopener noreferrer">{submission.repository_url}</a> : <p>Repository link was omitted because it is not a valid GitHub URL.</p>)}
          <p>{submission.response || "No written explanation provided."}</p>
          <label className="admin-feedback-field">Feedback for the member<textarea rows={2} value={feedbackDrafts[submission.id] ?? ""} onChange={(event) => setFeedbackDrafts((current) => ({ ...current, [submission.id]: event.target.value }))} placeholder="Share clear, actionable feedback…" /></label>
          <div className="submission-review-actions"><button onClick={() => void reviewSubmission(submission, "in_review")}>Mark in review</button><button onClick={() => void addFeedback(submission)}>Send feedback &amp; mark reviewed</button></div>
          <div className="peer-assignment-controls"><select value={peerSelections[submission.id] ?? ""} onChange={(event) => setPeerSelections((current) => ({ ...current, [submission.id]: event.target.value }))}><option value="">Assign an approved peer reviewer…</option>{profiles.filter((profile) => profile.membership_state === "approved" && profile.id !== submission.user_id).map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name || profile.email}</option>)}</select><button onClick={() => void assignPeerReviewer(submission)}>Assign</button></div>
        </article>)}</div> : <div className="admin-table-empty">No submissions are waiting for review.</div>}
      </Panel>
      <Panel collapsible title="Project lab review" description="Review project documentation and send private feedback to the project owner.">
        {projects.length ? <div className="submission-review-list">{projects.map((project) => <article className="submission-review-card" key={project.id}>
          <div className="submission-review-heading"><div><strong>{project.title}</strong><small>{profiles.find((profile) => profile.id === project.user_id)?.display_name || `Member ${project.user_id.slice(0, 8)}`} · Updated {new Date(project.updated_at).toLocaleDateString()}</small></div><select value={project.status} onChange={(event) => void updateProjectStatus(project, event.target.value as "planning" | "in_progress" | "submitted")} aria-label={`Project status for ${project.title}`}><option value="planning">Planning</option><option value="in_progress">In progress</option><option value="submitted">Submitted</option></select></div>
          {project.week_id && <small className="project-review-week">Week {project.week_id}: {curriculum[project.week_id - 1]?.title}</small>}
          {project.repository_url && (isGithubUrl(project.repository_url) ? <a href={project.repository_url} target="_blank" rel="noopener noreferrer">{project.repository_url}</a> : <p>Repository link omitted: it is not a valid GitHub URL.</p>)}
          <p>{project.description || "No project description."}</p>
          <div className="project-review-reflection">{project.reflection || "No experiment reflection provided."}</div>
          <label className="admin-feedback-field">Private feedback<textarea rows={2} value={projectFeedbackDrafts[project.id] ?? ""} onChange={(event) => setProjectFeedbackDrafts((current) => ({ ...current, [project.id]: event.target.value }))} placeholder="Give the member a specific next step…" /></label>
          <button className="admin-row-text-button" onClick={() => void addProjectFeedback(project)}>Send project feedback</button>
        </article>)}</div> : <div className="admin-table-empty">No cloud projects have been created yet.</div>}
      </Panel></div>}
      {activeTab === "content" && <div className="admin-content-grid">
        <Panel collapsible title="Create assignment" description="Assignments are private until published.">
          <form className="admin-form" onSubmit={createAssignment}><label>Curriculum week<select name="week">{curriculum.map((week) => <option key={week.week} value={week.week}>Week {week.week}: {week.title}</option>)}</select></label><label>Assignment title<input name="title" required maxLength={120} placeholder="Assignment title" /></label><label>Description<textarea name="description" required rows={4} maxLength={4000} placeholder="Explain the task and submission requirements…" /></label><label>Due date<input name="due_at" type="datetime-local" /></label><label className="admin-checkbox"><input type="checkbox" name="published" /> Publish for approved members</label><button className="primary-button module-action-button" disabled={busy}>Create assignment</button></form>
        </Panel>
        <Panel collapsible title="Society announcement" description="Share schedule changes, milestones, or useful guidance.">
          <form className="admin-form" onSubmit={createAnnouncement}><label>Title<input name="title" required maxLength={160} placeholder="Announcement title" /></label><label>Message<textarea name="body" required rows={5} maxLength={5000} placeholder="Write a clear, concise update…" /></label><label className="admin-checkbox"><input type="checkbox" name="published" /> Publish now</label><button className="primary-button module-action-button">Save announcement</button></form>
        </Panel>
        <Panel collapsible title="Add a resource" description="Use direct HTTPS links. We do not bypass embedding or access restrictions.">
          <form className="admin-form" onSubmit={createResource}><label>Resource title<input name="title" required maxLength={160} placeholder="Official documentation or lecture" /></label><label>Link<input name="url" type="url" required placeholder="https://…" /></label><label>Resource type<select name="kind"><option>Documentation</option><option>Video</option><option>Course</option><option>Paper</option><option>Repository</option><option>Reference</option><option>PDF</option></select></label><label>Curriculum week<select name="week"><option value="">General resource</option>{curriculum.map((week) => <option key={week.week} value={week.week}>Week {week.week}: {week.title}</option>)}</select></label><label>Access note<input name="note" maxLength={240} placeholder="Optional: enrollment, payment, or context" /></label><button className="primary-button module-action-button">Add resource</button></form>
          <div className="admin-resource-list">{resources.slice(0, 6).map((resource) => <div key={resource.id}><span><strong>{resource.title}</strong><small>{resource.week_id ? `Week ${resource.week_id}` : "General"} · {resource.kind}</small></span><button className="icon-button delete-project-button" onClick={() => void deleteResource(resource)} aria-label={`Delete ${resource.title}`}><X size={14} /></button></div>)}</div>
        </Panel>
        <Panel collapsible title="Edit curriculum" description="Update the published title, summary, weekly build, and assignment.">
          <form className="admin-form" onSubmit={saveCurriculumWeek}><label>Week<select value={selectedWeek} onChange={(event) => setSelectedWeek(Number(event.target.value))}>{curriculum.map((week) => <option key={week.week} value={week.week}>Week {week.week}: {week.title}</option>)}</select></label><label>Title<input value={weekDraft.title} onChange={(event) => setWeekDraft((current) => ({ ...current, title: event.target.value }))} required maxLength={120} /></label><label>Summary<textarea rows={2} value={weekDraft.summary} onChange={(event) => setWeekDraft((current) => ({ ...current, summary: event.target.value }))} required maxLength={1000} /></label><label>Weekly build<input value={weekDraft.build} onChange={(event) => setWeekDraft((current) => ({ ...current, build: event.target.value }))} required maxLength={160} /></label><label>Assignment<textarea rows={3} value={weekDraft.assignment} onChange={(event) => setWeekDraft((current) => ({ ...current, assignment: event.target.value }))} required maxLength={3000} /></label><button className="primary-button module-action-button">Publish curriculum changes</button></form>
          <div className="admin-curriculum-list">{curriculum.map((week) => <div key={week.week}><span>W{String(week.week).padStart(2, "0")}</span><strong>{week.title}</strong><small>{week.build}</small></div>)}</div>
        </Panel>
        <Panel collapsible title="Leaderboard scoring" description="Weights must total 100%. Idle browsing never counts as a contribution.">
          <form className="admin-weight-form" onSubmit={saveWeights}><label className="leaderboard-enabled-control"><span>Enable member rankings</span><input type="checkbox" checked={leaderboardEnabled} onChange={(event) => setLeaderboardEnabled(event.target.checked)} /></label>{Object.entries(leaderboardWeights).map(([key, value]) => <label key={key}><span>{key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}</span><div><input type="number" min={0} max={100} value={value} onChange={(event) => setLeaderboardWeights((current) => ({ ...current, [key]: Number(event.target.value) }))} /><b>%</b></div></label>)}<button className="primary-button module-action-button">Save weights</button></form>
        </Panel>
        <Panel collapsible title="Record a member contribution score" description="Use reviewed evidence, not browser activity. Values are component scores from 0–100 before weighting.">
          <form className="admin-form" onSubmit={saveMemberScore}><label>Approved member<select name="user_id" required><option value="">Choose a member…</option>{profiles.filter((profile) => profile.membership_state === "approved").map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name || profile.email}</option>)}</select></label><label>Period<select name="period_type"><option value="overall">Overall</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label>Period key<input name="period_key" required placeholder="e.g. overall, 2026-W47, 2026-11" /></label><div className="admin-score-grid">{(["assessment","project","research","consistency","repository"] as const).map((key) => <label key={key}>{key[0].toUpperCase() + key.slice(1)}<input name={key} type="number" min="0" max="100" step="0.1" defaultValue="0" /></label>)}</div><button className="primary-button module-action-button">Save contribution score</button></form>
        </Panel>
      </div>}
      {activeTab === "analytics" && <div className="admin-content-grid"><Panel collapsible title="Society activity · last 7 days" description="Aggregated engagement only. Individual learning-session details remain member-private.">
        {stats ? <div className="admin-aggregate-stats"><div><strong>{stats.approved_members}</strong><span>Approved members</span></div><div><strong>{stats.active_members_7d}</strong><span>Members with a session</span></div><div><strong>{Math.round(stats.active_seconds_7d / 360) / 10}h</strong><span>Estimated active study time</span></div><div><strong>{stats.pending_reviews}</strong><span>Submissions awaiting review</span></div></div> : <div className="admin-table-empty">Aggregated analytics are unavailable. Apply the latest migration to enable the privacy-safe summary view.</div>}
        <p className="analytics-small-print">Session time estimates engagement, not attention or understanding. No keystrokes, screenshots, webcam, microphone, or cross-site tracking are collected.</p>
      </Panel><Panel collapsible title="AI assistant configuration" description="Provider secrets must remain server-side and never be stored in browser settings.">
        <div className="admin-ai-setup"><span className="assistant-config-badge">Environment configuration</span><p>Set <code>AI_API_URL</code>, <code>AI_API_KEY</code>, and <code>AI_MODEL</code> on the server. Also configure Supabase auth and apply the database migration. The assistant stays unavailable until all are present.</p><span>See the repository&apos;s <code>.env.example</code> and README.</span></div>
      </Panel></div>}
      {activeTab === "support" && <Panel collapsible title="Help center requests" description="Private member requests for help, bug reports, and complaints. Only administrators can view and respond.">
        {supportRequests.length ? <div className="submission-review-list">{supportRequests.map((request) => {
          const member = profiles.find((profile) => profile.id === request.user_id);
          return <article className="submission-review-card help-admin-card" key={request.id}>
            <div className="submission-review-heading"><div><strong>{request.subject}</strong><small>{member?.display_name || member?.email || `Member ${request.user_id.slice(0, 8)}`} · {request.category} · {new Date(request.created_at).toLocaleString()}</small></div><span className={`member-state member-${request.status === "resolved" ? "approved" : request.status === "in_progress" ? "pending" : "denied"}`}>{request.status.replace("_", " ")}</span></div>
            <p>{request.message}</p>
            <label className="admin-feedback-field">Admin response / internal note<textarea rows={2} value={supportNotes[request.id] ?? request.admin_note ?? ""} onChange={(event) => setSupportNotes((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Reply or add a note visible to the member…" /></label>
            <div className="submission-review-actions"><button onClick={() => void updateSupportRequest(request, "in_progress")}>Mark in progress</button><button onClick={() => void updateSupportRequest(request, "resolved")}>Save &amp; mark resolved</button><button onClick={() => void updateSupportRequest(request, "open")}>Reopen</button></div>
          </article>;
        })}</div> : <div className="admin-table-empty">No support requests yet.</div>}
      </Panel>}
      {message && <p className="module-status-message" role="status">{message}</p>}
    </>}
  </ModuleShell>;
}

function isGithubUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" && url.pathname.split("/").filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}
