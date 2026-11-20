"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ArrowRight, BookOpen, Check, CheckCircle2, ChevronDown, ChevronRight, Clock3, ExternalLink, Search } from "lucide-react";
import { phases, type CurriculumWeek } from "@/lib/curriculum";
import { readLocal, writeLocal } from "@/lib/local-data";
import { ModuleShell, Panel } from "@/components/module-shell";
import { useCurriculumData } from "@/lib/use-curriculum";
import { loadProgress, persistProgressItem } from "@/lib/progress";

type ProgressMap = Record<string, boolean>;

export function CurriculumView() {
  const { curriculum: curriculumData } = useCurriculumData();
  const [progress, setProgress] = useState<ProgressMap>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [activeWeek, setActiveWeek] = useState(1);
  const [openPhase, setOpenPhase] = useState(1);
  const [query, setQuery] = useState("");
  const [detailTab, setDetailTab] = useState<"overview" | "resources" | "assessment">("overview");

  useEffect(() => {
    setProgress(readLocal("curriculum-progress", {}));
    void loadProgress().then(setProgress);
    setAnswers(readLocal("assessment-responses", {}));
    const requestedWeek = Number(new URLSearchParams(window.location.search).get("week"));
    if (requestedWeek >= 1 && requestedWeek <= 24) {
      setActiveWeek(requestedWeek);
      setOpenPhase(Math.ceil(requestedWeek / 4));
    }
  }, []);

  const selected = curriculumData.find((item) => item.week === activeWeek) ?? curriculumData[0];
  const completedCount = curriculumData.filter((item) => progress[`week-${item.week}-complete`]).length;
  const visibleCurriculum = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return curriculumData;
    return curriculumData.filter((week) =>
      `${week.title} ${week.summary} ${week.topics.join(" ")} ${week.build}`.toLowerCase().includes(normalized),
    );
  }, [query, curriculumData]);

  function toggle(key: string) {
    const completed = !progress[key];
    setProgress((current) => ({ ...current, [key]: completed }));
    void persistProgressItem(key, completed);
    const weekMatch = key.match(/^week-(\d+)-complete$/);
    if (weekMatch && completed) writeLocal("last-achievement", { title: `Week ${weekMatch[1]} complete`, earnedAt: new Date().toISOString() });
    else if (weekMatch) writeLocal("last-achievement", null);
  }

  function setItem(key: string, checked: boolean) {
    setProgress((current) => ({ ...current, [key]: checked }));
    void persistProgressItem(key, checked);
  }

  function setAnswer(key: string, value: string) {
    setAnswers((current) => {
      const next = { ...current, [key]: value };
      writeLocal("assessment-responses", next);
      return next;
    });
  }

  return (
    <ModuleShell title="Curriculum" description="A 24-week path from mathematical foundations to applied AI engineering." icon={BookOpen}>
      <div className="curriculum-summary">
        <div><span className="curriculum-summary-icon"><BookOpen size={17} /></span><div><strong>24 weeks · 6 phases</strong><small>Designed for a steady 5–7 hours each week</small></div></div>
        <div className="curriculum-progress-copy"><span>{completedCount} of 24 weeks complete</span><strong>{Math.round((completedCount / 24) * 100)}%</strong><div className="curriculum-progress-track"><i style={{ width: `${(completedCount / 24) * 100}%` }} /></div></div>
      </div>
      <div className="curriculum-layout">
        <Panel title="Your learning path" description="Choose a week to explore its lessons and build.">
          <label className="module-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a topic or week…" /><kbd>{visibleCurriculum.length}</kbd></label>
          <div className="phase-list">
            {phases.map((phase) => {
              const weeks = visibleCurriculum.filter((week) => week.phase === phase.id);
              if (query && !weeks.length) return null;
              const phaseComplete = phase.weeks.filter((week) => progress[`week-${week}-complete`]).length;
              const expanded = query ? true : openPhase === phase.id;
              return <section className="phase-block" key={phase.id}>
                <button className={`phase-heading ${expanded ? "phase-expanded" : ""}`} onClick={() => setOpenPhase(expanded && !query ? 0 : phase.id)} aria-expanded={expanded}>
                  <span className="phase-number">{String(phase.id).padStart(2, "0")}</span>
                  <span className="phase-title-wrap"><strong>Month {String(phase.id).padStart(2, "0")} <span>·</span> {phase.title}</strong><small>{phaseComplete}/4 weeks complete</small></span>
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {expanded && <div className="week-list">{weeks.map((week) => <WeekListItem key={week.week} week={week} active={week.week === activeWeek} complete={Boolean(progress[`week-${week.week}-complete`])} onSelect={() => { setActiveWeek(week.week); writeLocal("last-active-week", week.week); }} />)}</div>}
              </section>;
            })}
            {!visibleCurriculum.length && <div className="module-empty compact"><Search size={20} /><strong>No matching weeks</strong><span>Try a topic like “probability” or “transformers”.</span></div>}
          </div>
        </Panel>

        <div className="curriculum-detail">
          <WeekDetail
            week={selected}
            progress={progress}
            detailTab={detailTab}
            setDetailTab={setDetailTab}
            setItem={setItem}
            answers={answers}
            setAnswer={setAnswer}
            toggleWeek={() => toggle(`week-${selected.week}-complete`)}
          />
          <div className="week-switcher">
            <button disabled={selected.week === 1} onClick={() => { setActiveWeek(selected.week - 1); writeLocal("last-active-week", selected.week - 1); setDetailTab("overview"); }}><ChevronRight className="previous-chevron" size={14} /> Previous week</button>
            <span>Week {selected.week} of 24</span>
            <button disabled={selected.week === 24} onClick={() => { setActiveWeek(selected.week + 1); writeLocal("last-active-week", selected.week + 1); setOpenPhase(Math.ceil((selected.week + 1) / 4)); setDetailTab("overview"); }}>Next week <ChevronRight size={14} /></button>
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}

function WeekListItem({ week, active, complete, onSelect }: { week: CurriculumWeek; active: boolean; complete: boolean; onSelect: () => void }) {
  return <button className={`week-list-item ${active ? "week-list-active" : ""}`} onClick={onSelect}>
    <span className={`week-list-state ${complete ? "week-state-complete" : ""}`}>{complete ? <Check size={12} /> : String(week.week).padStart(2, "0")}</span>
    <span className="week-list-copy"><strong>{week.title}</strong><small>{week.build}</small></span>
    {active && <span className="week-current-marker" />}
  </button>;
}

function WeekDetail({
  week, progress, detailTab, setDetailTab, setItem, answers, setAnswer, toggleWeek,
}: {
  week: CurriculumWeek;
  progress: ProgressMap;
  detailTab: "overview" | "resources" | "assessment";
  setDetailTab: (tab: "overview" | "resources" | "assessment") => void;
  setItem: (key: string, checked: boolean) => void;
  answers: Record<string, string>;
  setAnswer: (key: string, value: string) => void;
  toggleWeek: () => void;
}) {
  const checklist = [
    { id: "lesson", title: "Review learning objectives", meta: "Start here" },
    { id: "coding", title: "Complete coding practice", meta: `${week.coding.length} exercises` },
    { id: "activity", title: "Try the weekly activity", meta: "Hands-on practice" },
    { id: "assignment", title: "Submit the weekly build", meta: "Project deliverable" },
    { id: "assessment", title: "Check your understanding", meta: `${week.assessment.length} questions` },
  ];
  const completedItems = checklist.filter((item) => progress[`week-${week.week}-${item.id}`]).length;
  const weekDone = Boolean(progress[`week-${week.week}-complete`]);
  return <article className="week-detail-card">
    <div className="week-detail-top"><div><span className="week-detail-kicker">MONTH {String(week.phase).padStart(2, "0")} <span>·</span> WEEK {String(week.week).padStart(2, "0")}</span><h2>{week.title}</h2><p>{week.summary}</p></div><div className="week-completion-badge"><strong>{completedItems}/{checklist.length}</strong><small>steps</small></div></div>
    <div className="week-detail-meta"><span><BookOpen size={14} /> 5 learning elements</span><span><Clock3 size={14} /> 5–7 hours</span><span className="week-build-pill">{week.build}</span></div>
    <div className="week-tabs" role="tablist" aria-label="Week details">
      <button role="tab" aria-selected={detailTab === "overview"} className={detailTab === "overview" ? "week-tab-active" : ""} onClick={() => setDetailTab("overview")}>Overview</button>
      <button role="tab" aria-selected={detailTab === "resources"} className={detailTab === "resources" ? "week-tab-active" : ""} onClick={() => setDetailTab("resources")}>Resources <span>{week.resources.length}</span></button>
      <button role="tab" aria-selected={detailTab === "assessment"} className={detailTab === "assessment" ? "week-tab-active" : ""} onClick={() => setDetailTab("assessment")}>Assessment</button>
    </div>
    {detailTab === "overview" && <div className="week-detail-content">
      <section className="detail-section"><h3>By the end of this week</h3><ul className="objective-list">{week.objectives.map((objective) => <li key={objective}><CheckCircle2 size={15} />{objective}</li>)}</ul></section>
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
      <p className="progress-save-note">Progress is saved in this browser on this device. Add Supabase to sync it across devices.</p>
    </div>}
    {detailTab === "resources" && <div className="week-detail-content"><div className="detail-section"><h3>Curated for week {week.week}</h3><p className="module-muted">External resources open in a new tab. Some courses may require enrollment or payment.</p><div className="week-resource-list">{week.resources.map((resource) => <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer" className="week-resource-row"><span className="resource-kind-icon"><ExternalLink size={15} /></span><span><strong>{resource.title}</strong><small>{resource.kind}{resource.note ? ` · ${resource.note}` : ""}</small></span><ArrowRight size={14} /></a>)}</div><Link href={`/resources?week=${week.week}`} className="inline-module-link">Browse the full resource library <ArrowRight size={14} /></Link></div></div>}
    {detailTab === "assessment" && <div className="week-detail-content"><div className="detail-section"><h3>Quick understanding check</h3><p className="module-muted">Answer in your own words. This practice check is not graded.</p><div className="assessment-list">{week.assessment.map((question, index) => { const key = `week-${week.week}-question-${index}`; return <label key={question} className="assessment-row"><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{question}</strong><textarea value={answers[key] ?? ""} onChange={(event) => setAnswer(key, event.target.value)} placeholder="Jot down your explanation…" rows={2} /></div></label>; })}</div><p className="progress-save-note">Practice responses are saved in this browser, not submitted or graded.</p></div></div>}
  </article>;
}

function MathLine({ value }: { value: string }) {
  if (!/[=∑Σ∇λ∞∈^√]/.test(value)) return <>{value}</>;
  return <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{`$$${value}$$`}</ReactMarkdown>;
}
