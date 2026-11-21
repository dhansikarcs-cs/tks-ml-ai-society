"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { BookOpen, Check, Cloud, Copy, ExternalLink, FlaskConical, FolderGit2, Github, Plus, Search, Send, Sparkles, Trash2 } from "lucide-react";
import { ModuleShell, Panel } from "@/components/module-shell";
import { curriculum } from "@/lib/curriculum";
import { readLocal, writeLocal, type Project } from "@/lib/local-data";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { persistProgressItem } from "@/lib/progress";
import { loadProjectsWithCloud, syncProjectsToCloud } from "@/lib/project-sync";

type RepoAnalysis = {
  id: string;
  title: string;
  repository: string;
  source: "mine" | "others";
  purpose: string;
  notes: string;
  findings: string;
  architecture: string;
  algorithms: string;
  importantFiles: string;
  runNotes: string;
  questions: { text: string; answer: string }[];
  createdAt: string;
  updatedAt: string;
};

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
];
const capstoneItems = ["Define problem and evaluation criteria", "Collect or select a dataset and document its limits", "Establish a baseline and run experiments", "Analyse results and errors", "Document code, methods, and mathematics", "Write a reflection and future work section", "Prepare repository and presentation materials"];
const suggestedAnalyzeRepos = [
  { title: "scikit-learn/scikit-learn", url: "https://github.com/scikit-learn/scikit-learn", note: "Classical ML algorithms, estimators, and API design." },
  { title: "pytorch/examples", url: "https://github.com/pytorch/examples", note: "Reference implementations: vision, NLP, RL and more." },
  { title: "karpathy/micrograd", url: "https://github.com/karpathy/micrograd", note: "Tiny autograd engine — excellent for understanding backprop." },
  { title: "karpathy/nanoGPT", url: "https://github.com/karpathy/nanoGPT", note: "Minimal GPT training/inference codebase." },
  { title: "huggingface/transformers", url: "https://github.com/huggingface/transformers", note: "Large-scale transformer models and tooling." },
  { title: "microsoft/ML-For-Beginners", url: "https://github.com/microsoft/ML-For-Beginners", note: "Beginner-friendly ML curriculum and projects." },
];

export function ProjectLab() {
  const [labMode, setLabMode] = useState<"build" | "analyze">("build");
  const [projects, setProjects] = useState<Project[]>([]);
  const [analyses, setAnalyses] = useState<RepoAnalysis[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [capstone, setCapstone] = useState<boolean[]>(Array(capstoneItems.length).fill(false));
  const [message, setMessage] = useState("");
  const [assignment, setAssignment] = useState<{ id: string; title: string } | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState({ response: "", repository: "", status: "draft" });
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [projectFeedback, setProjectFeedback] = useState<{ id: string; body: string; created_at: string }[]>([]);
  const [cloudReady, setCloudReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const initialProjectsLoaded = useRef(false);

  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const assignmentWeek = params ? Number(params.get("week")) : NaN;

  useEffect(() => {
    setProjects(readLocal<Project[]>("projects", []));
    setAnalyses(readLocal<RepoAnalysis[]>("repo-analyses", []));
    setCapstone(readLocal<boolean[]>("capstone-checklist", Array(capstoneItems.length).fill(false)));
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        setSignedIn(Boolean(user));
        if (user) {
          const { data: profile } = await supabase.from("profiles").select("membership_state").eq("id", user.id).maybeSingle();
          if (profile?.membership_state === "approved") setCloudReady(true);
        }
      });
    }
    void loadProjectsWithCloud().then(({ projects: merged, canSync }) => {
      setProjects((current) => {
        const byId = new Map(merged.map((project) => [project.id, project]));
        for (const project of current) {
          const existing = byId.get(project.id);
          if (!existing || project.updatedAt > existing.updatedAt) byId.set(project.id, project);
        }
        const next = Array.from(byId.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        writeLocal("projects", next);
        return next;
      });
      initialProjectsLoaded.current = true;
      setCloudReady(canSync);
      if (canSync) setSignedIn(true);
    });
    if (!Number.isNaN(assignmentWeek)) {
      void (async () => {
        const sb = createSupabaseBrowserClient();
        if (!sb) return;
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        const { data: row } = await sb.from("assignments").select("id,title").eq("week_id", assignmentWeek).eq("status", "published").maybeSingle();
        if (row) {
          setAssignment(row as { id: string; title: string });
          const { data: submission } = await sb.from("submissions").select("response,repository_url,status").eq("assignment_id", row.id).eq("user_id", user.id).maybeSingle();
          if (submission) setAssignmentDraft({ response: submission.response ?? "", repository: submission.repository_url ?? "", status: submission.status ?? "draft" });
        }
      })();
    }
  }, [assignmentWeek]);

  useEffect(() => {
    if (!initialProjectsLoaded.current || !cloudReady) return;
    const timeout = window.setTimeout(() => void syncProjectsToCloud(projects), 700);
    return () => window.clearTimeout(timeout);
  }, [projects, cloudReady]);

  useEffect(() => {
    if (!cloudReady || !selectedId) return;
    const timeout = window.setTimeout(() => {
      const sb = createSupabaseBrowserClient();
      if (!sb) return;
      void sb.from("project_feedback").select("id,body,created_at").eq("project_id", selectedId).order("created_at", { ascending: false }).then(({ data }) => {
        setProjectFeedback((data ?? []) as { id: string; body: string; created_at: string }[]);
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [selectedId, cloudReady]);

  const persistProjects = (next: Project[]) => {
    const sorted = [...next].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    setProjects(sorted);
    writeLocal("projects", sorted);
  };
  const persistAnalyses = (next: RepoAnalysis[]) => {
    const sorted = [...next].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    setAnalyses(sorted);
    writeLocal("repo-analyses", sorted);
  };

  const createProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    if (!title) return;
    const project: Project = {
      id: crypto.randomUUID(),
      title,
      description: String(form.get("description") || "").trim(),
      week: form.get("week") ? Number(form.get("week")) : null,
      repository: String(form.get("repository") || "").trim(),
      reflection: "",
      status: "planning",
      milestones: milestoneTemplate.map((m) => ({ title: m, done: false })),
      updatedAt: new Date().toISOString(),
    };
    persistProjects([project, ...projects]);
    setSelectedId(project.id);
    setLabMode("build");
    event.currentTarget.reset();
    setMessage("Project created. Track milestones, document experiments, and submit when ready.");
  };

  const createAnalysis = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const repository = String(form.get("repository") || "").trim();
    if (!title) return;
    const source = (String(form.get("source") || "others") === "mine" ? "mine" : "others") as "mine" | "others";
    const analysis: RepoAnalysis = {
      id: crypto.randomUUID(),
      title,
      repository,
      source,
      purpose: String(form.get("purpose") || "").trim(),
      notes: "",
      findings: "",
      architecture: "",
      algorithms: "",
      importantFiles: "",
      runNotes: "",
      questions: repoQuestions.map((text) => ({ text, answer: "" })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persistAnalyses([analysis, ...analyses]);
    setSelectedAnalysisId(analysis.id);
    setLabMode("analyze");
    event.currentTarget.reset();
    setMessage(source === "mine" ? "Analysis workspace created for your repository." : "Analysis workspace created. Add the repo URL, clone it locally if needed, and record your findings.");
  };

  const updateProject = (patch: Partial<Project>) => {
    if (!selectedId) return;
    persistProjects(projects.map((project) => project.id === selectedId ? { ...project, ...patch, updatedAt: new Date().toISOString() } : project));
  };
  const updateAnalysis = (patch: Partial<RepoAnalysis>) => {
    if (!selectedAnalysisId) return;
    persistAnalyses(analyses.map((a) => a.id === selectedAnalysisId ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a));
  };
  const removeProject = (id: string) => {
    if (!window.confirm("Delete this project? This cannot be undone.")) return;
    const tombstones = readLocal<string[]>("project-deleted-ids", []);
    if (!tombstones.includes(id)) writeLocal("project-deleted-ids", [...tombstones, id]);
    const next = projects.filter((project) => project.id !== id);
    persistProjects(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  };
  const removeAnalysis = (id: string) => {
    if (!window.confirm("Delete this analysis workspace? This cannot be undone.")) return;
    const next = analyses.filter((a) => a.id !== id);
    persistAnalyses(next);
    if (selectedAnalysisId === id) setSelectedAnalysisId(next[0]?.id ?? null);
  };

  const selected = projects.find((project) => project.id === selectedId) ?? projects[0] ?? null;
  const selectedAnalysis = analyses.find((a) => a.id === selectedAnalysisId) ?? analyses[0] ?? null;
  useEffect(() => { if (!selectedId && projects[0]) setSelectedId(projects[0].id); }, [projects, selectedId]);
  useEffect(() => { if (!selectedAnalysisId && analyses[0]) setSelectedAnalysisId(analyses[0].id); }, [analyses, selectedAnalysisId]);

  const startSuggestedAnalysis = (repo: { title: string; url: string; note?: string }) => {
    const analysis: RepoAnalysis = {
      id: crypto.randomUUID(),
      title: `Analyze ${repo.title}`,
      repository: repo.url,
      source: "others",
      purpose: `Understand the architecture, algorithms, and implementation of ${repo.title}. ${repo.note ?? ""}`.trim(),
      notes: "",
      findings: "",
      architecture: "",
      algorithms: "",
      importantFiles: "",
      runNotes: "",
      questions: repoQuestions.map((text) => ({ text, answer: "" })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persistAnalyses([analysis, ...analyses]);
    setSelectedAnalysisId(analysis.id);
    setLabMode("analyze");
    setMessage(`Analysis workspace created for ${repo.title}. Clone it locally and start documenting your findings.`);
  };

  const toggleMilestone = (index: number) => {
    if (!selected) return;
    const milestones = selected.milestones.map((m, i) => i === index ? { ...m, done: !m.done } : m);
    const status = milestones.every((m) => m.done) ? "submitted" : milestones.some((m) => m.done) ? "in_progress" : "planning";
    updateProject({ milestones, status: selected.status === "submitted" ? "submitted" : status });
  };
  const updateCapstone = (index: number) => {
    const next = capstone.map((value, i) => (i === index ? !value : value));
    setCapstone(next);
    writeLocal("capstone-checklist", next);
  };

  async function saveAssignment(submit: boolean) {
    if (!assignment) { setMessage("No published cloud assignment was found for this week. You can still track your build locally in a project."); return; }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("Sign in to submit to the society workspace."); return; }
    setAssignmentSaving(true);
    const status = submit ? "submitted" : "draft";
    const { error } = await supabase.from("submissions").upsert({
      assignment_id: assignment.id,
      user_id: user.id,
      response: assignmentDraft.response.trim(),
      repository_url: assignmentDraft.repository.trim() || null,
      status,
      submitted_at: submit ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "assignment_id,user_id" });
    setAssignmentSaving(false);
    if (error) { setMessage(error.message); return; }
    setAssignmentDraft((current) => ({ ...current, status }));
    if (submit) { await persistProgressItem(`week-${assignmentWeek}-assignment`, true); await persistProgressItem(`week-${assignmentWeek}-complete`, true); setMessage("Assignment submitted for administrator review."); }
    else setMessage("Assignment draft saved.");
  }

  async function submitProject() {
    if (!selected) return;
    updateProject({ status: "submitted" });
    if (selected.week) void persistProgressItem(`week-${selected.week}-assignment`, true);
    setMessage(cloudReady ? "Project submitted to your society workspace for administrator review." : "Project marked as submitted locally on this device. Sign in with an approved account to sync and share it for review.");
  }

  async function copyText(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setMessage(`${label} copied.`); }
    catch { setMessage("Could not copy automatically. Please copy it manually."); }
  }

  const cloneCommand = selectedAnalysis?.repository ? `git clone ${selectedAnalysis.repository.trim()}` : "git clone <repository-url>";
  const openUrl = selectedAnalysis?.repository?.trim() || "";
  const cloudStatusText = !isSupabaseConfigured()
    ? "Running in local workspace mode on this device. Society sign-in/sync is not configured."
    : cloudReady
      ? "Signed in with an approved membership — projects can sync to the society workspace for review."
      : signedIn
        ? "Signed in. Society sync and review become available after membership approval."
        : "Your projects and analyses are saved locally. Sign in with an approved member account if you want to sync or submit for society review.";

  return <ModuleShell title="Project lab" description="Build your own projects and analyze repositories — yours or others’. Everything you create here is saved locally on this device; society sync and review are optional when you’re an approved member." icon={FlaskConical}>
    <div className="project-lab-overview">
      <div><span className="project-overview-icon"><Sparkles size={16} /></span><span><strong>{labMode === "build" ? "Build & track projects" : "Analyze repositories"}</strong><small>{cloudReady ? "Local work + society sync/review available." : "Saved locally on this device. Optional society sync/review when signed in and approved."}</small></span></div>
      <div className="project-lab-count"><strong>{labMode === "build" ? projects.length : analyses.length}</strong><span>{labMode === "build" ? "projects" : "analyses"}</span></div>
    </div>

    <div className="project-mode-tabs" role="tablist" aria-label="Project lab modes">
      <button role="tab" aria-selected={labMode === "build"} className={labMode === "build" ? "project-mode-active" : ""} onClick={() => setLabMode("build")}><FolderGit2 size={14} /> My projects</button>
      <button role="tab" aria-selected={labMode === "analyze"} className={labMode === "analyze" ? "project-mode-active" : ""} onClick={() => setLabMode("analyze")}><Search size={14} /> Analyze repositories</button>
    </div>

    {labMode === "build" && <>
    <Panel collapsible title="Start a new project" description="Define what you will build, evaluate, and document. Your project work is saved locally on this device and can optionally sync to the society workspace if you’re an approved member.">
      <form className="new-project-form" onSubmit={createProject}>
        <label className="project-name-field">Project title<input name="title" required placeholder="e.g. Week 3 PCA visual exploration" /></label>
        <label>Repository URL<input name="repository" placeholder="https://github.com/username/repository (optional)" /></label>
        <label>Related week<select name="week" defaultValue=""><option value="">Not linked to a week</option>{curriculum.map((week) => <option key={week.week} value={week.week}>Week {week.week} — {week.title}</option>)}</select></label>
        <label className="project-description-field">Description<textarea name="description" rows={2} placeholder="What are you building, testing, or analysing?" /></label>
        <div><button type="reset" className="small-outline-button">Clear</button><button className="primary-button module-action-button"><Plus size={14} /> Create project</button></div>
      </form>
      {message && <p className="module-status-message project-message">{message}</p>}
    </Panel>

    {assignmentWeek && <Panel collapsible title={`Week ${assignmentWeek} assignment`} description={curriculum[assignmentWeek - 1]?.assignment || "Weekly assignment"} action={assignmentDraft.status === "submitted" ? <span className="member-state member-submitted">Submitted</span> : null}>
      {assignment && <p className="assignment-cloud-note"><Cloud size={13} /> This assignment is published for members. Your submission will be visible to administrators.</p>}
      {!assignment && <p className="assignment-cloud-note"><Cloud size={13} /> {cloudReady ? "No published society assignment found for this week yet. You can still plan and track your build locally below." : "You can plan and track your weekly build locally here. Published society assignments and submissions are available when signed in with an approved membership."}</p>}
      <div className="assignment-submit-form"><label>Repository URL (optional)<input value={assignmentDraft.repository} onChange={(event) => setAssignmentDraft((current) => ({ ...current, repository: event.target.value }))} placeholder="https://github.com/owner/repository" /></label><label>Technical explanation &amp; reflection<textarea value={assignmentDraft.response} onChange={(event) => setAssignmentDraft((current) => ({ ...current, response: event.target.value }))} rows={4} placeholder="What did you implement? What did you learn? What are the limitations?" /></label><div><button className="small-outline-button" disabled={assignmentSaving} onClick={() => void saveAssignment(false)}>Save draft</button><button className="primary-button module-action-button" disabled={assignmentSaving || assignmentDraft.status === "submitted"} onClick={() => void saveAssignment(true)}><Send size={13} /> {assignmentSaving ? "Saving…" : assignmentDraft.status === "submitted" ? "Submitted" : "Submit assignment"}</button></div></div>
    </Panel>}

    <div className="project-workspace-layout">
      <Panel collapsible title="My projects" description={cloudReady ? "Saved locally on this device and synced to your approved society workspace." : "Saved locally in this browser on this device. You can back up/export anytime; optional society sync/review is available for approved members."}>
        <div className="project-list">
          {projects.map((project) => <button className={`project-list-card ${project.id === selected?.id ? "project-list-active" : ""}`} key={project.id} onClick={() => setSelectedId(project.id)}><span className="project-list-icon"><FlaskConical size={14} /></span><span><strong>{project.title}</strong><small>{project.week ? `Week ${project.week}` : "Independent"} · {project.milestones.filter((m) => m.done).length}/{project.milestones.length} milestones</small></span><span className={`project-status status-${project.status}`}>{project.status.replace("_", " ")}</span></button>)}
          {!projects.length && <div className="empty-state project-empty"><FlaskConical size={28} /><p>No projects yet. Create one to track experiments, repositories, and reflections.</p></div>}
        </div>
      </Panel>

      <Panel collapsible title={selected ? selected.title : "Project workspace"} description={selected?.description || "Select a project to track milestones, repository, and notes."} action={selected ? <button className="icon-button delete-project-button" aria-label="Delete project" onClick={() => removeProject(selected.id)}><Trash2 size={15} /></button> : undefined}>
        {selected ? <>
          <div className="project-detail-meta"><span className={`project-status status-${selected.status}`}>{selected.status.replace("_", " ")}</span><span>{selected.week ? `Week ${selected.week}` : "Independent project"}</span><span>Updated {new Date(selected.updatedAt).toLocaleDateString()}</span></div>
          <div className="project-repo-row"><Github size={15} /><label><span>Repository</span><input value={selected.repository} onChange={(event) => updateProject({ repository: event.target.value })} placeholder="https://github.com/username/repository" /></label>{selected.repository && <a href={selected.repository} target="_blank" rel="noreferrer" aria-label="Open repository"><ExternalLink size={14} /></a>}</div>
          <div className="milestone-heading"><div><h3>Project milestones</h3><p>Track implementation, analysis, and documentation.</p></div><span className="milestone-progress-ring">{Math.round(selected.milestones.filter((m) => m.done).length / selected.milestones.length * 100)}%</span></div>
          <div className="project-milestones">{selected.milestones.map((milestone, index) => <label key={milestone.title} className="project-milestone"><input type="checkbox" checked={milestone.done} onChange={() => toggleMilestone(index)} /><span className="project-milestone-check">{milestone.done && <Check size={10} />}</span><span className={milestone.done ? "milestone-text-done" : ""}>{milestone.title}</span></label>)}</div>
          <label className="project-reflection-label">Experiment notes &amp; reflection<textarea value={selected.reflection} onChange={(event) => updateProject({ reflection: event.target.value })} rows={4} placeholder="What did you try? What surprised you? What would you change next?" /></label>
          <div className="project-submit-row"><span><Sparkles size={14} /> Keep claims tied to experiments you ran.</span><button className="primary-button module-action-button" disabled={selected.status === "submitted"} onClick={submitProject}><Send size={14} /> {selected.status === "submitted" ? (cloudReady ? "Submitted for review" : "Submitted locally") : "Mark as submitted"}</button></div>
          {projectFeedback.length > 0 && <div className="member-project-feedback"><h3>Administrator feedback</h3>{projectFeedback.map((item) => <article key={item.id}><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></article>)}</div>}
        </> : <div className="empty-state project-empty"><FlaskConical size={28} /><p>Select a project, or create one to begin.</p></div>}
      </Panel>
    </div>

    <Panel collapsible title="Capstone checklist" description="A self-audit for your final project. This is guidance for you, not surveillance.">
      <div className="capstone-progress-line"><span>{capstone.filter(Boolean).length} of {capstoneItems.length} complete</span><div><i style={{ width: `${Math.round(capstone.filter(Boolean).length / capstoneItems.length * 100)}%` }} /></div></div>
      <div className="capstone-checklist">{capstoneItems.map((item, index) => <label key={item}><input type="checkbox" checked={capstone[index]} onChange={() => updateCapstone(index)} /><span className="project-milestone-check">{capstone[index] && <Check size={10} />}</span>{item}</label>)}</div>
    </Panel>

    <div className="peer-review-notice"><span><Sparkles size={16} /></span><div><strong>{cloudReady ? "Society review & feedback" : "Local work, optional society sharing"}</strong><p>{cloudReady ? "Your approved account can sync projects to the society workspace. Submit work for administrator review and keep reflections tied to evidence." : cloudStatusText}</p></div><span className={`peer-review-state ${cloudReady ? "peer-review-state-ready" : ""}`}>{cloudReady ? "Society sync ready" : "Saved locally"}</span></div>
    </>}

    {labMode === "analyze" && <>
    <Panel collapsible title="Analyze a repository" description="Take in a repo (yours or someone else’s), clone/copy it locally, run it if needed, and document what you learn in a structured workspace.">
      <form className="new-project-form" onSubmit={createAnalysis}>
        <label className="project-name-field">Analysis title<input name="title" required placeholder="e.g. Analyze ResNet implementation / Review a peer project" /></label>
        <label>Repository URL<input name="repository" placeholder="https://github.com/owner/repository" /></label>
        <label>Whose repository?
          <select name="source" defaultValue="others">
            <option value="mine">My own repository</option>
            <option value="others">Someone else’s / external repository</option>
          </select>
        </label>
        <label className="project-description-field">Analysis goal<textarea name="purpose" rows={2} placeholder="What do you want to understand, evaluate, or learn from this repo?" /></label>
        <div><button type="reset" className="small-outline-button">Clear</button><button className="primary-button module-action-button"><Plus size={14} /> Create analysis workspace</button></div>
      </form>
      {message && <p className="module-status-message project-message">{message}</p>}
      <div className="analysis-howto">
        <h3><BookOpen size={14} /> How to analyze (copy & run locally)</h3>
        <ol>
          <li>Paste the repository URL and create an analysis workspace.</li>
          <li>Copy the <code>git clone</code> command and run it on your machine (terminal).</li>
          <li>Read README/setup docs, install dependencies, and run the project/tests if available.</li>
          <li>Use the guided questions below to record architecture, math, algorithms, important files, and findings.</li>
        </ol>
        <p className="module-muted">This web app can’t execute arbitrary repositories on the server, but it gives you a workspace to organize and document your local analysis.</p>
      </div>
      <div className="analysis-suggestions">
        <h3>Suggested repositories to analyze</h3>
        <p className="module-muted">Great starting points for practice. Create a workspace, clone locally, and explore.</p>
        <div className="analysis-suggestion-list">
          {suggestedAnalyzeRepos.map((repo) => <div key={repo.url} className="analysis-suggestion-item">
            <a href={repo.url} target="_blank" rel="noreferrer"><strong>{repo.title}</strong><small>{repo.note}</small></a>
            <button className="small-outline-button" onClick={() => startSuggestedAnalysis(repo)}><Plus size={13} /> Analyze</button>
          </div>)}
        </div>
      </div>
    </Panel>

    <div className="project-workspace-layout">
      <Panel collapsible title="Analysis workspaces" description="Your repo analyses are saved locally in this browser.">
        <div className="project-list">
          {analyses.map((a) => <button className={`project-list-card ${a.id === selectedAnalysis?.id ? "project-list-active" : ""}`} key={a.id} onClick={() => setSelectedAnalysisId(a.id)}><span className="project-list-icon"><Search size={14} /></span><span><strong>{a.title}</strong><small>{a.source === "mine" ? "My repository" : "External repository"} · {a.questions.filter((q) => q.answer.trim()).length}/{a.questions.length} answered</small></span></button>)}
          {!analyses.length && <div className="empty-state project-empty"><Search size={28} /><p>No analyses yet. Create one to take in a repo and document your understanding.</p></div>}
        </div>
      </Panel>

      <Panel collapsible title={selectedAnalysis ? selectedAnalysis.title : "Repository analysis"} description={selectedAnalysis ? (selectedAnalysis.source === "mine" ? "Analyze and document your own repository." : "Analyze and document someone else’s repository.") : "Select or create an analysis workspace."} action={selectedAnalysis ? <button className="icon-button delete-project-button" aria-label="Delete analysis" onClick={() => removeAnalysis(selectedAnalysis.id)}><Trash2 size={15} /></button> : undefined}>
        {selectedAnalysis ? <>
          <div className="project-detail-meta"><span className="project-status status-in_progress">{selectedAnalysis.source === "mine" ? "My repo" : "External repo"}</span><span>Updated {new Date(selectedAnalysis.updatedAt).toLocaleDateString()}</span></div>
          <div className="project-repo-row"><Github size={15} /><label><span>Repository URL</span><input value={selectedAnalysis.repository} onChange={(event) => updateAnalysis({ repository: event.target.value })} placeholder="https://github.com/owner/repository" /></label>{openUrl && <a href={openUrl} target="_blank" rel="noreferrer" aria-label="Open repository"><ExternalLink size={14} /></a>}</div>
          <div className="analysis-actions">
            <button className="small-outline-button" onClick={() => void copyText(cloneCommand, "Clone command")}><Copy size={13} /> Copy clone command</button>
            {openUrl && <a className="small-outline-button" href={openUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open repository</a>}
          </div>
          <div className="analysis-command-box"><span>Clone locally</span><code>{cloneCommand}</code><small>Run in your terminal, then follow README/setup instructions to install and run.</small></div>
          <label className="project-reflection-label">Goal / what I’m analyzing<textarea value={selectedAnalysis.purpose} onChange={(event) => updateAnalysis({ purpose: event.target.value })} rows={2} placeholder="What question are you trying to answer about this repo?" /></label>
          <div className="analysis-grid">
            <label>Architecture<textarea value={selectedAnalysis.architecture} onChange={(event) => updateAnalysis({ architecture: event.target.value })} rows={3} placeholder="Key components, modules, data flow…" /></label>
            <label>Algorithms &amp; math<textarea value={selectedAnalysis.algorithms} onChange={(event) => updateAnalysis({ algorithms: event.target.value })} rows={3} placeholder="Models, equations, optimization, complexity…" /></label>
            <label>Important files<textarea value={selectedAnalysis.importantFiles} onChange={(event) => updateAnalysis({ importantFiles: event.target.value })} rows={3} placeholder="Entry points, configs, core modules, tests…" /></label>
            <label>How I ran / tested it<textarea value={selectedAnalysis.runNotes} onChange={(event) => updateAnalysis({ runNotes: event.target.value })} rows={3} placeholder="Setup steps, commands run, environment, results…" /></label>
          </div>
          <div className="analysis-questions">
            <h3>Guided analysis questions</h3>
            {selectedAnalysis.questions.map((q, i) => <label key={q.text} className="analysis-question"><span>{i + 1}. {q.text}</span><textarea value={q.answer} onChange={(event) => {
              const questions = selectedAnalysis.questions.map((item, idx) => idx === i ? { ...item, answer: event.target.value } : item);
              updateAnalysis({ questions });
            }} rows={2} placeholder="Your findings…" /></label>)}
          </div>
          <label className="project-reflection-label">Overall findings &amp; reflection<textarea value={selectedAnalysis.findings} onChange={(event) => updateAnalysis({ findings: event.target.value })} rows={4} placeholder="What did you learn? Strengths, limitations, ideas to apply in your own work?" /></label>
        </> : <div className="empty-state project-empty"><Search size={28} /><p>Select an analysis, or create one to begin.</p></div>}
      </Panel>
    </div>
    </>}
  </ModuleShell>;
}
