"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ArrowRight, BookOpen, Bot, Check, CheckCircle2, ChevronDown, ChevronRight, Clock3, Copy, ExternalLink, Lightbulb, Plus, Search, Send, Sparkles, Trash2, Video } from "lucide-react";
import { phases, type CurriculumWeek } from "@/lib/curriculum";
import { readLocal, writeLocal } from "@/lib/local-data";
import { ModuleShell, Panel } from "@/components/module-shell";
import { useCurriculumData } from "@/lib/use-curriculum";
import { loadProgress, persistProgressItem } from "@/lib/progress";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type ProgressMap = Record<string, boolean>;
type WeekCustom = { notes: string; videos: { title: string; url: string }[]; personalResources: { title: string; url: string }[] };
type DetailTab = "overview" | "resources" | "assessment" | "ideas" | "mine";

function defaultWeekCustom(): WeekCustom { return { notes: "", videos: [], personalResources: [] }; }

export function CurriculumView() {
  const { curriculum: curriculumData } = useCurriculumData();
  const [progress, setProgress] = useState<ProgressMap>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [activeWeek, setActiveWeek] = useState(1);
  const [openPhase, setOpenPhase] = useState(1);
  const [query, setQuery] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    setProgress(readLocal("curriculum-progress", {}));
    setAnswers(readLocal("assessment-responses", {}));
    const completed = readLocal<ProgressMap>("curriculum-progress", {});
    const firstIncomplete = curriculumData.find((week) => !completed[`week-${week.week}-complete`])?.week ?? 24;
    const savedWeek = Number(readLocal("last-active-week", firstIncomplete));
    const valid = savedWeek >= 1 && savedWeek <= 24 ? savedWeek : firstIncomplete;
    setActiveWeek(valid);
    setOpenPhase(Math.ceil(valid / 4));
    void loadProgress().then(setProgress);
  }, [curriculumData]);

  useEffect(() => {
    const load = () => setProgress(readLocal("curriculum-progress", {}));
    window.addEventListener("tks-local-data", load);
    return () => window.removeEventListener("tks-local-data", load);
  }, []);

  const selected = curriculumData.find((week) => week.week === activeWeek) ?? curriculumData[0];
  const completedWeeks = curriculumData.filter((week) => progress[`week-${week.week}-complete`]).length;
  const completionPercent = Math.round((completedWeeks / 24) * 100);
  const searchResults = useMemo(() => {
    if (!query.trim()) return curriculumData;
    const q = query.toLowerCase();
    return curriculumData.filter((week) => `${week.title} ${week.summary} ${week.topics.join(" ")} ${week.build}`.toLowerCase().includes(q));
  }, [query, curriculumData]);

  const setItem = (key: string, completed: boolean) => {
    const next = { ...progress, [key]: completed };
    setProgress(next);
    void persistProgressItem(key, completed);
  };

  const toggleWeek = () => {
    const key = `week-${selected.week}-complete`;
    const value = !progress[key];
    const next = { ...progress, [key]: value };
    ["lesson", "coding", "activity", "assignment"].forEach((item) => { next[`week-${selected.week}-${item}`] = value; });
    setProgress(next);
    writeLocal("curriculum-progress", next);
    void persistProgressItem(key, value);
    ["lesson", "coding", "activity", "assignment"].forEach((item) => void persistProgressItem(`week-${selected.week}-${item}`, value));
  };

  const setAnswer = (key: string, value: string) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    writeLocal("assessment-responses", next);
  };

  return <ModuleShell title="Curriculum" description="A structured 24-week path: objectives, mathematics, practice, resources, ideas to build/analyze, and space for your own notes and videos." icon={BookOpen}>
    <div className="curriculum-summary">
      <div><span className="curriculum-summary-icon"><BookOpen size={16} /></span><span><strong>{completedWeeks} of 24 weeks complete</strong><small>Practice-focused progress, saved in your browser and synced for approved members.</small></span></div>
      <div className="curriculum-progress-copy"><span>Overall progress</span><strong>{completionPercent}%</strong><div className="curriculum-progress-track"><i style={{ width: `${completionPercent}%` }} /></div></div>
    </div>
    <div className="curriculum-layout-tools"><button type="button" className="small-outline-button" onClick={() => setSidebarOpen((v) => !v)}>{sidebarOpen ? "Hide week list" : "Show week list"}</button></div>
    <div className={`curriculum-layout ${sidebarOpen ? "" : "sidebar-hidden"}`.trim()}>
      {sidebarOpen && <Panel collapsible title="Phase overview" description="Expand a phase and choose a week.">
        <label className="module-search" aria-label="Search curriculum"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search weeks, topics, or builds" /></label>
        <div className="phase-list">
          {phases.map((phase) => {
            const expanded = openPhase === phase.id || Boolean(query);
            const phaseWeeks = searchResults.filter((week) => phase.weeks.includes(week.week));
            if (query && phaseWeeks.length === 0) return null;
            return <div key={phase.id} className={`phase-block ${expanded ? "phase-expanded" : ""}`}>
              <button className="phase-heading" onClick={() => setOpenPhase(expanded ? 0 : phase.id)} aria-expanded={expanded}>
                <span className="phase-number">P{phase.id}</span>
                <span className="phase-title-wrap"><strong>{phase.title} <span>· Weeks {phase.weeks[0]}–{phase.weeks[3]}</span></strong><small>{phase.subtitle}</small></span>
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {expanded && <div className="week-list">{phaseWeeks.map((week) => {
                const complete = progress[`week-${week.week}-complete`];
                return <button key={week.week} className={`week-list-item ${week.week === selected.week ? "week-list-active" : ""}`} onClick={() => { setActiveWeek(week.week); writeLocal("last-active-week", week.week); setDetailTab("overview"); }}>
                  <span className={`week-list-state ${complete ? "week-state-complete" : ""}`}>{complete ? <Check size={12} /> : week.week}</span>
                  <span className="week-list-copy"><strong>Week {week.week}: {week.title}</strong><small>{week.build}</small></span>
                  {week.week === selected.week && <span className="week-current-marker" />}
                </button>;
              })}</div>}
            </div>;
          })}
        </div>
      </Panel>}
      <div className="curriculum-detail">
        <WeekDetail
          key={selected.week}
          week={selected}
          progress={progress}
          detailTab={detailTab}
          setDetailTab={setDetailTab}
          setItem={setItem}
          answers={answers}
          setAnswer={setAnswer}
          toggleWeek={toggleWeek}
        />
        <div className="week-switcher">
          <button disabled={selected.week === 1} onClick={() => { setActiveWeek(selected.week - 1); writeLocal("last-active-week", selected.week - 1); setDetailTab("overview"); setOpenPhase(Math.ceil((selected.week - 1) / 4)); }}><ChevronRight size={15} className="previous-chevron" /> Week {selected.week - 1}</button>
          <span>Week {selected.week} of 24</span>
          <button disabled={selected.week === 24} onClick={() => { setActiveWeek(selected.week + 1); writeLocal("last-active-week", selected.week + 1); setOpenPhase(Math.ceil((selected.week + 1) / 4)); setDetailTab("overview"); }}>Week {selected.week + 1} <ArrowRight size={15} /></button>
        </div>
      </div>
    </div>
  </ModuleShell>;
}

function WeekDetail({ week, progress, detailTab, setDetailTab, setItem, answers, setAnswer, toggleWeek }: {
  week: CurriculumWeek;
  progress: ProgressMap;
  detailTab: DetailTab;
  setDetailTab: (tab: DetailTab) => void;
  setItem: (key: string, completed: boolean) => void;
  answers: Record<string, string>;
  setAnswer: (key: string, value: string) => void;
  toggleWeek: () => void;
}) {
  const checklist = [
    { id: "lesson", title: "Review the learning objectives", meta: "Concepts and mathematics" },
    { id: "resources", title: "Review week resources or suggest one", meta: "Explore curated/suggested resources, or suggest your own for admin approval" },
    { id: "coding", title: "Complete coding practice", meta: `${week.coding.length} activity${week.coding.length === 1 ? "" : "ies"}` },
    { id: "activity", title: "Try the weekly activity", meta: "Hands-on practice" },
    { id: "assignment", title: "Submit the weekly build", meta: "Project deliverable" },
    { id: "assessment", title: "Check your understanding", meta: `${week.assessment.length} questions` },
  ];
  const completedItems = checklist.filter((item) => progress[`week-${week.week}-${item.id}`]).length;
  const weekDone = Boolean(progress[`week-${week.week}-complete`]);

  const [custom, setCustom] = useState<WeekCustom>(defaultWeekCustom());
  const [suggestSubject, setSuggestSubject] = useState("");
  const [suggestBody, setSuggestBody] = useState("");
  const [suggestMsg, setSuggestMsg] = useState("");
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [newVideoTitle, setNewVideoTitle] = useState("");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newResTitle, setNewResTitle] = useState("");
  const [newResUrl, setNewResUrl] = useState("");
  const [copiedPrompt, setCopiedPrompt] = useState("");

  useEffect(() => {
    setCustom(readLocal<WeekCustom>(`week-custom-${week.week}`, defaultWeekCustom()));
    setSuggestMsg("");
  }, [week.week]);

  const saveCustom = (next: WeekCustom) => {
    setCustom(next);
    writeLocal(`week-custom-${week.week}`, next);
  };

  const addVideo = () => {
    const title = newVideoTitle.trim();
    const url = newVideoUrl.trim();
    if (!title || !url) return;
    saveCustom({ ...custom, videos: [...custom.videos, { title, url }] });
    setNewVideoTitle(""); setNewVideoUrl("");
  };
  const addResource = () => {
    const title = newResTitle.trim();
    const url = newResUrl.trim();
    if (!title || !url) return;
    saveCustom({ ...custom, personalResources: [...custom.personalResources, { title, url }] });
    setNewResTitle(""); setNewResUrl("");
  };

  async function submitSuggestion() {
    const subject = (suggestSubject || `Curriculum suggestion: Week ${week.week} - ${week.title}`).trim();
    const message = suggestBody.trim();
    if (message.length < 10) { setSuggestMsg("Please add more detail to your suggestion (at least 10 characters)."); return; }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setSuggestMsg("Sign in with an approved account to suggest curriculum additions to the admin."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSuggestMsg("Please sign in to send a suggestion."); return; }
    const { data: profile } = await supabase.from("profiles").select("membership_state").eq("id", user.id).maybeSingle();
    if (profile?.membership_state !== "approved") { setSuggestMsg("Your membership must be approved before sending suggestions."); return; }
    setSuggestBusy(true);
    const { error } = await supabase.from("support_requests").insert({
      user_id: user.id,
      category: "other",
      subject: subject.slice(0, 160),
      message: `[Curriculum suggestion for Week ${week.week}: ${week.title}]\n\n${message}`.slice(0, 5000),
      status: "open",
    });
    setSuggestBusy(false);
    if (error) { setSuggestMsg(error.message); return; }
    setSuggestBody(""); setSuggestSubject("");
    setSuggestMsg("Suggestion sent to the administrator for review. Thank you!");
  }

  const buildIdeas = [
    `Core build: ${week.build}. Start with the simplest working version, then add one improvement at a time.`,
    `Apply it to a small real dataset or example relevant to you; document assumptions and limitations.`,
    `Extend the weekly assignment: "${week.assignment}" — add evaluation, visualization, or a short written analysis.`,
    ...(week.coding[0] ? [`Turn coding practice into a mini-project: ${week.coding[0]}.`] : []),
  ];
  const analyzeIdeas = [
    `Analyze a repository or notebook related to "${week.title}"; identify architecture, key algorithms, data flow, and how results are evaluated.`,
    `Compare two approaches to ${week.topics[1] || week.topics[0] || "this topic"}: what trade-offs do they make?`,
    `Run or trace the week’s build and write an error/limitation analysis: where does it fail and why?`,
    ...(week.paper ? [`Read and summarize the paper: ${week.paper}. What problem, method, evidence, and limitations?`] : [`Find one short article/paper on ${week.topics[0] || week.title} and summarize its main claim and evidence.`]),
  ];
  const repoSuggestions = [
    ...week.resources.filter((r) => r.kind === "Repository"),
    ...[
      { title: "scikit-learn/scikit-learn", url: "https://github.com/scikit-learn/scikit-learn", kind: "Repository" as const, note: "Classical ML algorithms and API design." },
      { title: "pytorch/examples", url: "https://github.com/pytorch/examples", kind: "Repository" as const, note: "Reference implementations of common models." },
      { title: "karpathy/micrograd", url: "https://github.com/karpathy/micrograd", kind: "Repository" as const, note: "Tiny autograd engine - great for learning." },
    ].filter((r) => !week.resources.some((w) => w.url === r.url)),
  ].slice(0, 6);

  const aiPrompts = [
    { label: "Explain this week", prompt: `I'm on Week ${week.week}: "${week.title}" in an ML/AI curriculum. Explain the key concepts (${week.topics.slice(0, 5).join(", ")}) in simple terms, with an intuitive example and one common misconception.` },
    { label: "Quiz me", prompt: `Quiz me on Week ${week.week}: "${week.title}". Ask me 5 questions (mix of concept, math intuition, and practical) one at a time. After each answer, give feedback and the correct idea.` },
    { label: "Help with the build", prompt: `I'm working on the Week ${week.week} build: "${week.build}". Give me a step-by-step plan, what to watch out for, and how to evaluate if it works. Don't write the full solution for me - guide me.` },
    { label: "Assignment hint", prompt: `I need help with this Week ${week.week} assignment: "${week.assignment}". Give me hints and a way to think about it, but don't give the complete final answer.` },
    ...(week.paper ? [{ label: "Understand the paper", prompt: `Help me understand this paper/resource for Week ${week.week}: "${week.paper}". Summarize the problem, method, key results, and limitations in plain language.` }] : []),
  ];

  async function copyPrompt(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setCopiedPrompt(label); setTimeout(() => setCopiedPrompt(""), 1500); } catch {}
  }

  return <article className="week-detail-card">
    <div className="week-detail-top"><div><span className="week-detail-kicker">MONTH {String(week.phase).padStart(2, "0")} <span>·</span> WEEK {String(week.week).padStart(2, "0")}</span><h2>{week.title}</h2><p>{week.summary}</p></div><div className="week-completion-badge"><strong>{completedItems}/{checklist.length}</strong><small>steps</small></div></div>
    <div className="week-detail-meta"><span><BookOpen size={14} /> {checklist.length} learning elements</span><span><Clock3 size={14} /> {week.estimatedHours} hrs this week</span><span className="week-build-pill">{week.build}</span></div>
    <div className="week-tabs week-tabs-scroll" role="tablist" aria-label="Week details">
      <button role="tab" aria-selected={detailTab === "overview"} className={detailTab === "overview" ? "week-tab-active" : ""} onClick={() => setDetailTab("overview")}>Overview</button>
      <button role="tab" aria-selected={detailTab === "resources"} className={detailTab === "resources" ? "week-tab-active" : ""} onClick={() => setDetailTab("resources")}>Resources <span>{week.resources.length}</span></button>
      <button role="tab" aria-selected={detailTab === "assessment"} className={detailTab === "assessment" ? "week-tab-active" : ""} onClick={() => setDetailTab("assessment")}>Assessment</button>
      <button role="tab" aria-selected={detailTab === "ideas"} className={detailTab === "ideas" ? "week-tab-active" : ""} onClick={() => setDetailTab("ideas")}>Build &amp; analyze ideas</button>
      <button role="tab" aria-selected={detailTab === "mine"} className={detailTab === "mine" ? "week-tab-active" : ""} onClick={() => setDetailTab("mine")}>My notes &amp; videos</button>
    </div>

    {detailTab === "overview" && <div className="week-detail-content">
      <section className="detail-section"><h3>By the end of this week</h3><ul className="objective-list">{week.objectives.map((objective) => <li key={objective}><CheckCircle2 size={15} />{objective}</li>)}</ul></section>
      <section className="detail-section commitment-section"><h3><Clock3 size={15} /> Weekly commitment</h3><p className="module-muted"><strong>{week.estimatedHours} hours total</strong> this week. Flexible plan: {week.dailyCommitment}</p><div className="commitment-options"><span>Pick what fits your day:</span><div className="commitment-pills"><span>30 min</span><span>45 min</span><span>1 hr</span><span>Flexible split</span></div></div></section>
      <section className="detail-section"><h3>Exact topics to cover this week</h3><p className="module-muted">Focus on these specific topics — don&apos;t keep it vague.</p><ul className="objective-list exact-topic-list">{week.exactTopics.map((topic) => <li key={topic}><CheckCircle2 size={15} />{topic}</li>)}</ul></section>
      <section className="detail-section"><h3>Topics &amp; ideas</h3><div className="topic-pills">{week.topics.map((topic) => <span key={topic}>{topic}</span>)}</div></section>
      <section className="detail-section math-section"><h3>Mathematical foundations</h3><ul>{week.mathematics.map((item) => <li key={item}><MathLine value={item} /></li>)}</ul></section>
      <section className="detail-section"><h3>Technical vocabulary</h3><div className="vocab-list">{week.vocabulary.map((term) => <span key={term}>{term}</span>)}</div></section>
      <section className="detail-section"><h3>Learn &amp; practice</h3>
        {week.lectures.length > 0 && <p className="resource-lines"><strong>Lectures</strong>{week.lectures.join(" · ")}</p>}
        {week.readings.length > 0 && <p className="resource-lines"><strong>Reading</strong>{week.readings.join(" · ")}</p>}
        {week.paper && <p className="resource-lines"><strong>Research paper</strong>{week.paper}</p>}
        <p className="resource-lines"><strong>Coding practice</strong>{week.coding.join(" · ")}</p>
        <p className="activity-callout"><span>TRY IT</span>{week.activity}</p>
      </section>
      <section className="detail-section assignment-box"><div><span>WEEKLY BUILD</span><h3>{week.build}</h3><p>{week.assignment}</p></div><Link className="small-outline-button" href={`/projects?week=${week.week}`}>Open project lab <ArrowRight size={14} /></Link></section>
      <div className="week-checklist"><div><h3>Your weekly checklist</h3><span>{completedItems} of {checklist.length} complete</span></div>{checklist.map((item) => <label key={item.id} className="curriculum-check-row"><input type="checkbox" checked={Boolean(progress[`week-${week.week}-${item.id}`])} onChange={(event) => setItem(`week-${week.week}-${item.id}`, event.target.checked)} /><span className="curriculum-check-visual">{progress[`week-${week.week}-${item.id}`] && <Check size={12} />}</span><span><strong>{item.title}</strong><small>{item.meta}</small></span></label>)}</div>
      <button className={`complete-week-button ${weekDone ? "week-is-complete" : ""}`} onClick={toggleWeek}>{weekDone ? <><CheckCircle2 size={16} /> Week marked complete</> : <>Mark week complete <ArrowRight size={15} /></>}</button>
      <p className="progress-save-note">Progress is saved locally in this browser and can sync for approved members when signed in.</p>
    </div>}

    {detailTab === "resources" && <div className="week-detail-content"><div className="detail-section"><h3>Curated for week {week.week}</h3><p className="module-muted">Resources marked <strong>Compulsory</strong> are required for this week. Others are optional but helpful.</p><div className="week-resource-list">{week.resources.map((resource) => <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer" className="week-resource-row"><span className="resource-kind-icon"><ExternalLink size={15} /></span><span><strong>{resource.title} {resource.compulsory && <span className="compulsory-badge">Compulsory</span>}</strong><small>{resource.kind}{resource.note ? ` · ${resource.note}` : ""}</small></span><ArrowRight size={14} /></a>)}</div><Link href={`/resources?week=${week.week}`} className="inline-module-link">Browse the full resource library <ArrowRight size={14} /></Link></div></div>}

    {detailTab === "assessment" && <div className="week-detail-content"><div className="detail-section"><h3>Quick understanding check</h3><p className="module-muted">Answer in your own words. This practice check is not graded.</p><div className="assessment-list">{week.assessment.map((question, index) => { const key = `week-${week.week}-question-${index}`; return <label key={question} className="assessment-row"><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{question}</strong><textarea value={answers[key] ?? ""} onChange={(event) => setAnswer(key, event.target.value)} placeholder="Jot down your explanation…" rows={2} /></div></label>; })}</div><p className="progress-save-note">Practice responses are saved in this browser, not submitted or graded.</p></div></div>}

    {detailTab === "ideas" && <div className="week-detail-content">
      <section className="detail-section"><h3><Sparkles size={15} /> AI prompts for this week</h3><p className="module-muted">Use these prompts in your own AI (ChatGPT, Gemini, Claude, local model, etc.) or open them directly in our AI assistant.</p><div className="week-ai-prompts">{aiPrompts.map((item) => <div key={item.label} className="week-ai-prompt-card"><div className="week-ai-prompt-head"><strong>{item.label}</strong><div className="week-ai-prompt-actions"><button type="button" className="small-outline-button" onClick={() => void copyPrompt(item.prompt, item.label)}><Copy size={13} /> {copiedPrompt === item.label ? "Copied" : "Copy prompt"}</button><Link className="small-outline-button" href={`/assistant?prompt=${encodeURIComponent(item.prompt)}`}><Bot size={13} /> Open in AI assistant</Link></div></div><p>{item.prompt}</p></div>)}</div></section>
      <section className="detail-section"><h3><Lightbulb size={15} /> What to build this week (ideas & examples)</h3><ul className="idea-list">{buildIdeas.map((idea) => <li key={idea}>{idea}</li>)}</ul><Link className="inline-module-link" href={`/projects?week=${week.week}`}>Start building in Project lab <ArrowRight size={14} /></Link></section>
      <section className="detail-section"><h3><Search size={15} /> How to analyze (ideas & examples)</h3><ul className="idea-list">{analyzeIdeas.map((idea) => <li key={idea}>{idea}</li>)}</ul><Link className="inline-module-link" href="/projects">Open repo analysis workspace <ArrowRight size={14} /></Link></section>
      <section className="detail-section"><h3>Suggested repositories to analyze</h3><p className="module-muted">Pick a repo, clone it locally, run/read it, and document your findings in the Project lab analysis workspace.</p><div className="week-resource-list">{repoSuggestions.map((resource) => <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer" className="week-resource-row"><span className="resource-kind-icon"><ExternalLink size={15} /></span><span><strong>{resource.title} {"compulsory" in resource && resource.compulsory ? <span className="compulsory-badge">Compulsory</span> : null}</strong><small>Repository{resource.note ? ` · ${resource.note}` : ""}</small></span><ArrowRight size={14} /></a>)}</div></section>
      <section className="detail-section suggest-section"><h3>Suggest an addition to this week’s curriculum</h3><p className="module-muted">Have a great video, note, resource, or idea that should be added for everyone? Send it to the administrator for review.</p>
        <label className="suggest-field">Subject (optional)<input value={suggestSubject} onChange={(e) => setSuggestSubject(e.target.value)} placeholder={`e.g. Add video/resource for Week ${week.week}`} /></label>
        <label className="suggest-field">Your suggestion<textarea value={suggestBody} onChange={(e) => setSuggestBody(e.target.value)} rows={4} placeholder="Describe the resource, link, note, or idea and why it helps this week…" /></label>
        <button className="primary-button module-action-button" disabled={suggestBusy || !isSupabaseConfigured()} onClick={() => void submitSuggestion()}><Send size={14} /> {suggestBusy ? "Sending…" : "Send suggestion to admin"}</button>
        {!isSupabaseConfigured() && <p className="module-muted">Sign in with an approved member account to send suggestions to the admin (optional society feature).</p>}
        {suggestMsg && <p className="module-status-message" role="status">{suggestMsg}</p>}
      </section>
    </div>}

    {detailTab === "mine" && <div className="week-detail-content">
      <section className="detail-section"><h3>My personal notes for Week {week.week}</h3><p className="module-muted">Customize this week for yourself. Your notes are saved locally in this browser.</p>
        <textarea className="personal-notes-area" value={custom.notes} onChange={(e) => saveCustom({ ...custom, notes: e.target.value })} rows={6} placeholder="Write your own notes, summaries, reminders, or insights for this week…" />
      </section>
      <section className="detail-section"><h3><Video size={15} /> My videos for this week</h3><p className="module-muted">Add videos you find helpful (YouTube, lectures, talks, etc.). Saved locally.</p>
        <div className="custom-add-row"><input value={newVideoTitle} onChange={(e) => setNewVideoTitle(e.target.value)} placeholder="Video title" /><input value={newVideoUrl} onChange={(e) => setNewVideoUrl(e.target.value)} placeholder="https://…" /><button className="small-outline-button" onClick={addVideo}><Plus size={13} /> Add</button></div>
        <div className="custom-resource-list">{custom.videos.map((v, i) => <div key={`${v.url}-${i}`} className="custom-resource-item"><a href={v.url} target="_blank" rel="noreferrer"><Video size={14} /> <span><strong>{v.title}</strong><small>{v.url}</small></span></a><button className="icon-button" aria-label="Remove video" onClick={() => saveCustom({ ...custom, videos: custom.videos.filter((_, idx) => idx !== i) })}><Trash2 size={14} /></button></div>)}{!custom.videos.length && <p className="module-muted">No personal videos added yet.</p>}</div>
      </section>
      <section className="detail-section"><h3>My extra resources / links</h3><p className="module-muted">Add articles, docs, repos, or any links you want to keep for this week.</p>
        <div className="custom-add-row"><input value={newResTitle} onChange={(e) => setNewResTitle(e.target.value)} placeholder="Resource title" /><input value={newResUrl} onChange={(e) => setNewResUrl(e.target.value)} placeholder="https://…" /><button className="small-outline-button" onClick={addResource}><Plus size={13} /> Add</button></div>
        <div className="custom-resource-list">{custom.personalResources.map((r, i) => <div key={`${r.url}-${i}`} className="custom-resource-item"><a href={r.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> <span><strong>{r.title}</strong><small>{r.url}</small></span></a><button className="icon-button" aria-label="Remove resource" onClick={() => saveCustom({ ...custom, personalResources: custom.personalResources.filter((_, idx) => idx !== i) })}><Trash2 size={14} /></button></div>)}{!custom.personalResources.length && <p className="module-muted">No personal resources added yet.</p>}</div>
      </section>
      <p className="progress-save-note">Personal notes, videos, and links are saved in this browser on this device.</p>
    </div>}
  </article>;
}

function MathLine({ value }: { value: string }) {
  if (!/[=^_\\∑√∫λσμπ]/.test(value)) return <>{value}</>;
  return <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{`$${value}$`}</ReactMarkdown>;
}
