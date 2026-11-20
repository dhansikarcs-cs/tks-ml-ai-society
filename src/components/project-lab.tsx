"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, ChevronRight, Cloud, ExternalLink, FlaskConical, Github, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { ModuleShell, Panel } from "@/components/module-shell";
import { curriculum } from "@/lib/curriculum";
import { readLocal, writeLocal, type Project } from "@/lib/local-data";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { persistProgressItem } from "@/lib/progress";
import { loadProjectsWithCloud, syncProjectsToCloud } from "@/lib/project-sync";

const milestoneTemplate = [
  "Define the problem and success criteria",
  "Explore data and establish a baseline",
  "Implement and document the approach",
  "Evaluate results and analyse errors",
  "Write limitations and reflection",
];
const repoQuestions = [
  "What problem does the project solve?",
  "What is its architecture?",
  "What mathematical concepts does it use?",
  "What algorithms are implemented?",
  "Which files are important?",
  "How does the implementation work?",
  "What datasets are used?",
  "How is performance evaluated?",
  "What are its limitations?",
  "How could it be improved?",
];
const capstoneItems = [
  "Problem definition", "Literature review", "Dataset selection", "Exploratory data analysis",
  "Mathematical and algorithmic justification", "Model implementation", "Experimentation",
  "Evaluation metrics", "Error analysis", "Limitations", "Ethical considerations",
  "Deployment or demonstration", "Technical documentation", "Final presentation",
];
type PeerReview = {
  assignmentId: string;
  submissionId: string;
  title: string;
  author: string;
  response: string;
  repository: string | null;
  feedback: string | null;
};

export function ProjectLab() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newWeek, setNewWeek] = useState("");
  const [repoOpen, setRepoOpen] = useState(false);
  const [capstone, setCapstone] = useState<boolean[]>([]);
  const [message, setMessage] = useState("");
  const [assignmentWeek, setAssignmentWeek] = useState<number | null>(null);
  const [assignment, setAssignment] = useState<{ id: string; title: string } | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState({ repository: "", response: "", status: "draft" });
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [peerReviews, setPeerReviews] = useState<PeerReview[]>([]);
  const [peerFeedbackDrafts, setPeerFeedbackDrafts] = useState<Record<string, string>>({});
  const [projectFeedback, setProjectFeedback] = useState<{ id: string; body: string; created_at: string }[]>([]);
  const [cloudReady, setCloudReady] = useState(false);
  const initialProjectsLoaded = useRef(false);
  const selected = projects.find((project) => project.id === selectedId) ?? null;

  useEffect(() => {
    const storedProjects = readLocal<Project[]>("projects", []);
    setProjects(storedProjects);
    setSelectedId(storedProjects[0]?.id ?? null);
    setCapstone(readLocal<boolean[]>("capstone-checklist", Array(capstoneItems.length).fill(false)));
    void loadProjectsWithCloud().then(({ projects: merged, canSync }) => {
      setProjects((current) => {
        const combined = new Map(merged.map((project) => [project.id, project]));
        for (const project of current) {
          const saved = combined.get(project.id);
          if (!saved || project.updatedAt > saved.updatedAt) combined.set(project.id, project);
        }
        const result = Array.from(combined.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        writeLocal("projects", result);
        setSelectedId((selected) => selected ?? result[0]?.id ?? null);
        return result;
      });
      initialProjectsLoaded.current = true;
      setCloudReady(canSync);
    });
    const requestedWeek = Number(new URLSearchParams(window.location.search).get("week"));
    if (requestedWeek >= 1 && requestedWeek <= 24) {
      setAssignmentWeek(requestedWeek);
      const saved = readLocal<Record<string, typeof assignmentDraft>>("assignment-submissions", {});
      if (saved[String(requestedWeek)]) setAssignmentDraft(saved[String(requestedWeek)]);
      void loadAssignment(requestedWeek);
    }
    void loadPeerReviews();
  }, []);

  useEffect(() => {
    if (!initialProjectsLoaded.current || !cloudReady) return;
    const timeout = window.setTimeout(() => void syncProjectsToCloud(projects), 700);
    return () => window.clearTimeout(timeout);
  }, [projects, cloudReady]);

  useEffect(() => {
    if (!cloudReady || !selectedId) return;
    const timeout = window.setTimeout(() => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;
      void supabase.from("project_feedback").select("id,body,created_at").eq("project_id", selectedId).order("created_at", { ascending: false }).then(({ data }) => {
        setProjectFeedback((data ?? []) as { id: string; body: string; created_at: string }[]);
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [selectedId, cloudReady]);

  async function loadPeerReviews() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("membership_state").eq("id", user.id).maybeSingle();
    if (profile?.membership_state !== "approved") return;
    const { data: assigned } = await supabase.from("peer_review_assignments").select("id,submission_id").eq("reviewer_id", user.id);
    if (!assigned?.length) return;
    const results: PeerReview[] = [];
    for (const assignment of assigned) {
      const [{ data: submission }, { data: feedback }] = await Promise.all([
        supabase.from("submissions").select("id,user_id,assignment_id,response,repository_url").eq("id", assignment.submission_id).maybeSingle(),
        supabase.from("feedback").select("body").eq("submission_id", assignment.submission_id).eq("reviewer_id", user.id).eq("is_peer_review", true).maybeSingle(),
      ]);
      if (!submission) continue;
      const { data: titleRow } = await supabase.from("assignments").select("title").eq("id", submission.assignment_id).maybeSingle();
      results.push({
        assignmentId: assignment.id,
        submissionId: submission.id,
        title: titleRow?.title ?? "Member submission",
        author: `Member ${submission.user_id.slice(0, 8)}`,
        response: submission.response ?? "",
        repository: submission.repository_url,
        feedback: feedback?.body ?? null,
      });
    }
    setPeerReviews(results);
  }

  async function submitPeerFeedback(review: PeerReview) {
    const body = peerFeedbackDrafts[review.assignmentId]?.trim();
    if (!body) return setMessage("Add a thoughtful review before submitting.");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setMessage("Sign in to submit a peer review.");
    const { error } = await supabase.from("feedback").insert({ submission_id: review.submissionId, reviewer_id: user.id, body, is_peer_review: true });
    if (error) return setMessage(error.message);
    setPeerReviews((current) => current.map((item) => item.assignmentId === review.assignmentId ? { ...item, feedback: body } : item));
    setMessage("Peer review submitted to the project author.");
  }

  async function loadAssignment(week: number) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("membership_state").eq("id", user.id).maybeSingle();
    if (profile?.membership_state !== "approved") return;
    const { data: assignments } = await supabase.from("assignments").select("id,title").eq("week_id", week).eq("published", true).order("created_at", { ascending: false });
    if (!assignments?.length) return;
    setAssignment(assignments[0]);
    const { data: submission } = await supabase.from("submissions").select("repository_url,response,status").eq("assignment_id", assignments[0].id).eq("user_id", user.id).maybeSingle();
    if (submission) setAssignmentDraft({ repository: submission.repository_url ?? "", response: submission.response ?? "", status: submission.status });
  }

  function commit(next: Project[]) {
    setProjects(next);
    writeLocal("projects", next);
  }

  function create(event: FormEvent) {
    event.preventDefault();
    const project: Project = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      description: newDescription.trim(),
      week: newWeek ? Number(newWeek) : null,
      repository: "",
      reflection: "",
      status: "planning",
      milestones: milestoneTemplate.map((title) => ({ title, done: false })),
      updatedAt: new Date().toISOString(),
    };
    if (!project.title) return;
    commit([project, ...projects]);
    setSelectedId(project.id);
    setCreating(false);
    setNewTitle(""); setNewDescription(""); setNewWeek("");
    setMessage("Project created in this browser.");
  }

  function updateProject(patch: Partial<Project>) {
    if (!selected) return;
    commit(projects.map((project) => project.id === selected.id ? { ...project, ...patch, updatedAt: new Date().toISOString() } : project));
  }

  function toggleMilestone(index: number) {
    if (!selected) return;
    updateProject({ milestones: selected.milestones.map((milestone, i) => i === index ? { ...milestone, done: !milestone.done } : milestone) });
  }

  function saveCapstone(index: number, value: boolean) {
    const next = capstone.map((item, i) => i === index ? value : item);
    setCapstone(next);
    writeLocal("capstone-checklist", next);
  }

  function saveRepository(value: string) {
    if (value && !isValidGithubUrl(value)) {
      setMessage("Use a valid GitHub repository URL (github.com/owner/repo).");
      return;
    }
    updateProject({ repository: value });
    setMessage("Repository link saved locally. The platform has not fetched or analysed its contents.");
  }

  function submitProject() {
    if (!selected) return;
    if (selected.repository && !isValidGithubUrl(selected.repository)) return setMessage("Please enter a valid GitHub repository URL first.");
    updateProject({ status: "submitted" });
    writeLocal("last-achievement", { title: "Project submitted", earnedAt: new Date().toISOString() });
    if (selected.week) {
      void persistProgressItem(`week-${selected.week}-assignment`, true);
    }
    setMessage(cloudReady ? "Project submitted to your society workspace for administrator review." : "Project marked submitted in this browser only. Add an approved society account to share it with an administrator.");
  }

  async function saveAssignment(submit: boolean) {
    if (!assignmentWeek) return;
    if (assignmentDraft.repository && !isValidGithubUrl(assignmentDraft.repository)) {
      setMessage("Use a valid GitHub repository URL (github.com/owner/repo).");
      return;
    }
    setAssignmentSaving(true);
    const supabase = createSupabaseBrowserClient();
    if (supabase && assignment) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = user ? await supabase.from("profiles").select("membership_state").eq("id", user.id).maybeSingle() : { data: null };
      if (!user || profile?.membership_state !== "approved") {
        setAssignmentSaving(false);
        setMessage("Sign in with an approved member account to submit work for administrator review.");
        return;
      }
      const { error } = await supabase.from("submissions").upsert({
        assignment_id: assignment.id,
        user_id: user.id,
        repository_url: assignmentDraft.repository.trim() || null,
        response: assignmentDraft.response.trim(),
        status: submit ? "submitted" : "draft",
        submitted_at: submit ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "assignment_id,user_id" });
      setAssignmentSaving(false);
      if (error) return setMessage(error.message);
      setAssignmentDraft((current) => ({ ...current, status: submit ? "submitted" : "draft" }));
      if (submit) {
        void persistProgressItem(`week-${assignmentWeek}-assignment`, true);
        writeLocal("last-achievement", { title: "Weekly build submitted", earnedAt: new Date().toISOString() });
      }
      setMessage(submit ? "Assignment submitted for administrator review." : "Draft saved to your society account.");
      return;
    }
    const local = readLocal<Record<string, typeof assignmentDraft>>("assignment-submissions", {});
    const nextDraft = { ...assignmentDraft, status: submit ? "submitted" : "draft" };
    writeLocal("assignment-submissions", { ...local, [String(assignmentWeek)]: nextDraft });
    setAssignmentDraft(nextDraft);
    setAssignmentSaving(false);
    if (submit) {
      void persistProgressItem(`week-${assignmentWeek}-assignment`, true);
      writeLocal("last-achievement", { title: "Weekly build submitted", earnedAt: new Date().toISOString() });
    }
    setMessage(submit ? "Submitted locally in this browser. Configure an approved society account for administrator review." : "Draft saved in this browser.");
  }

  function removeSelected() {
    if (!selected || !window.confirm(`Delete “${selected.title}” and its local milestones?`)) return;
    const deleted = readLocal<string[]>("project-deleted-ids", []);
    writeLocal("project-deleted-ids", Array.from(new Set([...deleted, selected.id])));
    const next = projects.filter((project) => project.id !== selected.id);
    commit(next);
    setSelectedId(next[0]?.id ?? null);
  }

  return <ModuleShell title="Project laboratory" description="Plan practical builds, document experiments, and keep your technical work moving." icon={FlaskConical}
    actions={<button className="primary-button module-action-button" onClick={() => setCreating((value) => !value)}><Plus size={15} /> New project</button>}>
    <div className="project-lab-overview">
      <div><span className="project-overview-icon"><FlaskConical size={17} /></span><span><strong>Build by understanding</strong><small>Projects connect each week&apos;s theory to practice.</small></span></div>
      <div className="project-lab-count"><strong>{projects.length}</strong><span>local projects</span></div>
    </div>
    {creating && <Panel title="Start a project" description="Create a local workspace. You can add a repository and milestones anytime.">
      <form className="new-project-form" onSubmit={create}>
        <label>Project name<input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} required placeholder="e.g. PCA visual explorer" /></label>
        <label>Related curriculum week<select value={newWeek} onChange={(event) => setNewWeek(event.target.value)}><option value="">Personal project</option>{curriculum.map((week) => <option key={week.week} value={week.week}>Week {week.week}: {week.title}</option>)}</select></label>
        <label className="project-description-field">What are you exploring?<textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} rows={2} placeholder="A short project goal…" /></label>
        <div><button type="button" className="small-outline-button" onClick={() => setCreating(false)}>Cancel</button><button className="primary-button module-action-button"><Plus size={14} /> Create project</button></div>
      </form>
    </Panel>}
    {assignmentWeek && <Panel title={`Week ${assignmentWeek} assignment`} description={curriculum[assignmentWeek - 1].assignment} action={assignmentDraft.status === "submitted" ? <span className="member-state member-submitted">Submitted</span> : null}>
      {assignment && <p className="assignment-cloud-note"><Cloud size={13} /> This assignment is published for members. Your submission will be visible to administrators.</p>}
      {!assignment && <p className="assignment-cloud-note"><Cloud size={13} /> {createSupabaseBrowserClient() ? "Sign in to find published assignments. The curriculum build can still be tracked locally." : "No cloud assignment is configured. Save a local draft or link this work to a project."}</p>}
      <div className="assignment-submit-form"><label>Repository URL (optional)<input value={assignmentDraft.repository} onChange={(event) => setAssignmentDraft((current) => ({ ...current, repository: event.target.value }))} placeholder="https://github.com/owner/repository" /></label><label>Technical explanation &amp; reflection<textarea value={assignmentDraft.response} onChange={(event) => setAssignmentDraft((current) => ({ ...current, response: event.target.value }))} rows={4} placeholder="What did you implement? What did you learn? What are the limitations?" /></label><div><button className="small-outline-button" disabled={assignmentSaving} onClick={() => void saveAssignment(false)}>Save draft</button><button className="primary-button module-action-button" disabled={assignmentSaving || assignmentDraft.status === "submitted"} onClick={() => void saveAssignment(true)}><Send size={13} /> {assignmentSaving ? "Saving…" : assignmentDraft.status === "submitted" ? "Submitted" : "Submit assignment"}</button></div></div>
    </Panel>}
    <div className="project-workspace-layout">
      <Panel title="My projects" description="Saved only in this browser until cloud sync is configured.">
        <div className="project-list">
          {projects.map((project) => <button key={project.id} className={`project-list-card ${selectedId === project.id ? "project-list-active" : ""}`} onClick={() => setSelectedId(project.id)}>
            <span className="project-list-icon"><FlaskConical size={15} /></span><span><strong>{project.title}</strong><small>{project.week ? `Week ${project.week} · ` : ""}{project.milestones.filter((item) => item.done).length}/{project.milestones.length} milestones</small></span><span className={`project-status status-${project.status}`}>{project.status.replace("_", " ")}</span>
          </button>)}
          {!projects.length && <div className="module-empty compact"><FlaskConical size={20} /><strong>Your first build starts here</strong><span>Create a project to plan the work and track milestones.</span><button className="text-button" onClick={() => setCreating(true)}>Create a project <ArrowRight size={13} /></button></div>}
        </div>
        <div className="repo-analysis-toggle"><button onClick={() => setRepoOpen((value) => !value)} aria-expanded={repoOpen}><Github size={15} /> Repository analysis guide {repoOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
          {repoOpen && <div className="repo-analysis-content"><p>Use these questions to inspect a repository yourself. TKS does not fetch or inspect GitHub contents in this workspace.</p><ol>{repoQuestions.map((question) => <li key={question}>{question}</li>)}</ol><span>For safety and accuracy, only claim findings you personally verified in the repository.</span></div>}
        </div>
      </Panel>
      <div className="project-detail-column">
        {selected ? <Panel title={selected.title} description={selected.description || "A practical workspace connected to your learning path."} action={<button className="icon-button delete-project-button" onClick={removeSelected} aria-label="Delete project"><Trash2 size={16} /></button>}>
          <div className="project-detail-meta"><span className={`project-status status-${selected.status}`}>{selected.status.replace("_", " ")}</span>{selected.week && <span>Week {selected.week} · {curriculum[selected.week - 1]?.title}</span>}<span>Updated {new Date(selected.updatedAt).toLocaleDateString()}</span></div>
          <div className="project-repo-row"><Github size={16} /><label><span>GitHub repository URL</span><input value={selected.repository} onChange={(event) => updateProject({ repository: event.target.value })} onBlur={(event) => { if (event.target.value) saveRepository(event.target.value); }} placeholder="https://github.com/owner/repository" /></label>{selected.repository && isValidGithubUrl(selected.repository) && <a href={selected.repository} target="_blank" rel="noopener noreferrer" aria-label="Open repository"><ExternalLink size={15} /></a>}</div>
          <div className="milestone-heading"><div><h3>Project milestones</h3><p>{selected.milestones.filter((item) => item.done).length} of {selected.milestones.length} complete</p></div><span className="milestone-progress-ring">{Math.round(selected.milestones.filter((item) => item.done).length / Math.max(selected.milestones.length, 1) * 100)}%</span></div>
          <div className="project-milestones">{selected.milestones.map((milestone, index) => <label className="project-milestone" key={milestone.title}><input type="checkbox" checked={milestone.done} onChange={() => toggleMilestone(index)} /><span className="project-milestone-check">{milestone.done && <Check size={13} />}</span><span className={milestone.done ? "milestone-text-done" : ""}>{milestone.title}</span></label>)}</div>
          <label className="project-reflection-label">Experiment notes &amp; reflection<textarea value={selected.reflection} onChange={(event) => updateProject({ reflection: event.target.value })} rows={4} placeholder="What did you try? What surprised you? What would you change next?" /></label>
          <div className="project-submit-row"><span><Sparkles size={14} /> Keep claims tied to experiments you ran.</span><button className="primary-button module-action-button" disabled={selected.status === "submitted"} onClick={submitProject}><Send size={14} /> {selected.status === "submitted" ? cloudReady ? "Submitted for review" : "Submitted locally" : "Mark as submitted"}</button></div>
          {projectFeedback.length > 0 && <div className="member-project-feedback"><h3>Administrator feedback</h3>{projectFeedback.map((item) => <article key={item.id}><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></article>)}</div>}
        </Panel> : <div className="module-empty project-empty"><FlaskConical size={24} /><strong>Select or create a project</strong><span>Your project plan and milestones will appear here.</span></div>}
        {message && <p className="project-message" role="status">{message}</p>}
        <Panel title="Capstone readiness" description="Track the 14 elements expected in the final submission.">
          <div className="capstone-progress-line"><span>{capstone.filter(Boolean).length} / 14 components ready</span><div><i style={{ width: `${(capstone.filter(Boolean).length / 14) * 100}%` }} /></div></div>
          <div className="capstone-checklist">{capstoneItems.map((item, index) => <label key={item}><input type="checkbox" checked={Boolean(capstone[index])} onChange={(event) => saveCapstone(index, event.target.checked)} /><span className="project-milestone-check">{capstone[index] && <Check size={12} />}</span>{item}</label>)}</div>
        </Panel>
      </div>
    </div>
    <Panel title="Peer reviews for you" description="Review assigned society work carefully and offer specific, constructive suggestions.">
      {peerReviews.length ? <div className="peer-review-list">{peerReviews.map((review) => <article key={review.assignmentId} className="peer-review-card"><div><strong>{review.title}</strong><small>{review.author}</small></div>{review.repository && isValidGithubUrl(review.repository) && <a href={review.repository} target="_blank" rel="noopener noreferrer">Open repository <ExternalLink size={12} /></a>}<p>{review.response || "No written explanation was submitted."}</p>{review.feedback ? <div className="peer-review-complete"><Check size={13} /> Review sent: {review.feedback}</div> : <><label>Your peer feedback<textarea rows={3} value={peerFeedbackDrafts[review.assignmentId] ?? ""} onChange={(event) => setPeerFeedbackDrafts((current) => ({ ...current, [review.assignmentId]: event.target.value }))} placeholder="What is clear? What question could help the author improve?" /></label><button className="small-outline-button" onClick={() => void submitPeerFeedback(review)}>Submit peer review</button></>}</article>)}</div> : <div className="peer-review-empty"><Sparkles size={17} /><span>No peer reviews are assigned right now. When the society admin assigns you a review, it will appear here.</span></div>}
    </Panel>
    <div className="peer-review-notice"><span><Sparkles size={16} /></span><div><strong>Peer review is better with people.</strong><p>Local projects are private to this device. Once an administrator configures cloud membership, you can submit work for society review.</p></div><span className="peer-review-state">Cloud access required</span></div>
  </ModuleShell>;
}

function isValidGithubUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" && url.pathname.split("/").filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}
