"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, BookOpen, Check, Clock3, Pause, Play, RotateCcw, StopCircle, Target } from "lucide-react";
import { ModuleShell, Panel } from "@/components/module-shell";
import { readLocal, writeLocal, type StudySession } from "@/lib/local-data";
import { loadSessions, persistStudySession } from "@/lib/progress";

type Draft = { startedAt: string; seconds: number; category: StudySession["category"]; running: boolean };
const IDLE_LIMIT = 2 * 60;

export function AnalyticsView() {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [category, setCategory] = useState<StudySession["category"]>("lesson");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [goalMinutes, setGoalMinutes] = useState(300);
  const lastTick = useRef(0);
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    setSessions(readLocal("learning-sessions", []));
    void loadSessions().then(setSessions);
    setGoalMinutes(readLocal("weekly-goal-minutes", 300));
    const recovery = readLocal<Draft | null>("active-learning-session", null);
    if (recovery) {
      setDraft({ ...recovery, running: false });
      setSeconds(recovery.seconds);
      setPaused(true);
    }
  }, []);

  const saveDraft = useCallback((value: Draft | null) => {
    if (value) writeLocal("active-learning-session", value);
    else writeLocal("active-learning-session", null);
  }, []);

  useEffect(() => {
    const markActive = () => { lastActivity.current = Date.now(); };
    window.addEventListener("pointerdown", markActive, { passive: true });
    window.addEventListener("pointermove", markActive, { passive: true });
    window.addEventListener("scroll", markActive, { passive: true });
    window.addEventListener("keydown", markActive);
    window.addEventListener("touchstart", markActive, { passive: true });
    const handleVisibility = () => { lastTick.current = Date.now(); };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pointerdown", markActive);
      window.removeEventListener("pointermove", markActive);
      window.removeEventListener("scroll", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("touchstart", markActive);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!draft?.running) return;
      const now = Date.now();
      const delta = now - (lastTick.current || now);
      lastTick.current = now;
      const isActive = document.visibilityState === "visible" && now - lastActivity.current <= IDLE_LIMIT;
      setPaused(!isActive);
      if (isActive && delta > 0 && delta <= 4000) {
        setSeconds((current) => {
          const next = current + Math.max(1, Math.round(delta / 1000));
          const updated = { ...draft, seconds: next };
          setDraft(updated);
          if (next % 15 < 2) saveDraft(updated);
          return next;
        });
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [draft, saveDraft]);

  const now = Date.now();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const weekSessions = sessions.filter((session) => new Date(session.startedAt) >= weekStart);
  const weekSeconds = weekSessions.reduce((sum, session) => sum + session.seconds, 0);
  const goalSeconds = goalMinutes * 60;
  const completion = Math.min(100, Math.round((weekSeconds / Math.max(goalSeconds, 1)) * 100));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    const total = weekSessions.filter((session) => new Date(session.startedAt).toDateString() === date.toDateString()).reduce((sum, session) => sum + session.seconds, 0);
    return { label: date.toLocaleDateString("en", { weekday: "short" }).slice(0, 1), date, seconds: total };
  });
  const maxDay = Math.max(3600, ...days.map((day) => day.seconds));
  const grouped = useMemo(() => ({
    lesson: sessions.filter((session) => session.category === "lesson").reduce((a, b) => a + b.seconds, 0),
    reading: sessions.filter((session) => session.category === "reading").reduce((a, b) => a + b.seconds, 0),
    coding: sessions.filter((session) => session.category === "coding").reduce((a, b) => a + b.seconds, 0),
    research: sessions.filter((session) => session.category === "research").reduce((a, b) => a + b.seconds, 0),
  }), [sessions]);

  function startSession() {
    const next: Draft = { startedAt: new Date().toISOString(), seconds: 0, category, running: true };
    setDraft(next); setSeconds(0); setPaused(false); lastTick.current = Date.now(); lastActivity.current = Date.now(); saveDraft(next);
  }

  function resumeSession() {
    if (!draft) return;
    const next = { ...draft, running: true };
    setDraft(next); setPaused(false); lastTick.current = Date.now(); lastActivity.current = Date.now(); saveDraft(next);
  }

  function pauseSession() {
    if (!draft) return;
    const next = { ...draft, running: false };
    setDraft(next); setPaused(true); saveDraft(next);
  }

  function finishSession() {
    if (!draft) return;
    if (seconds > 0) {
      const end = new Date().toISOString();
      const entry: StudySession = { id: crypto.randomUUID(), startedAt: draft.startedAt, endedAt: end, seconds, category: draft.category };
      const next = [entry, ...sessions];
      setSessions(next);
      void persistStudySession(entry);
    }
    setDraft(null); setSeconds(0); setPaused(false); saveDraft(null);
  }

  function discardSession() {
    setDraft(null); setSeconds(0); setPaused(false); saveDraft(null);
  }

  function updateGoal(value: number) {
    const safe = Math.max(30, Math.min(3000, value));
    setGoalMinutes(safe); writeLocal("weekly-goal-minutes", safe);
  }

  const todaySessions = sessions.filter((session) => new Date(session.startedAt).toDateString() === new Date(now).toDateString()).length;
  return <ModuleShell title="Learning analytics" description="Reflect on intentional learning sessions and steady progress—without surveillance." icon={Activity}>
    <div className="analytics-privacy-banner"><span><Target size={16} /></span><p><strong>Private by design.</strong> No keystrokes, screenshots, webcam, microphone, or cross-site tracking. Session time is an estimate of active engagement, not proof of attention or understanding.</p></div>
    <div className="analytics-grid">
      <div className="analytics-main-column">
        <Panel collapsible title="Focus session" description="Start a session when you’re ready. It pauses if this tab is hidden or you’re inactive for two minutes.">
          {!draft ? <div className="session-start-panel">
            <div className="session-start-icon"><Clock3 size={23} /></div>
            <div><h3>Make a little space to learn.</h3><p>Only count time while this page is visible and you’re active.</p></div>
            <div className="session-start-controls"><label>Session type<select value={category} onChange={(event) => setCategory(event.target.value as StudySession["category"])}><option value="lesson">Lesson</option><option value="reading">Reading</option><option value="coding">Coding</option><option value="research">Research</option></select></label><button className="primary-button module-action-button" onClick={startSession}><Play size={14} fill="currentColor" /> Start session</button></div>
          </div> : <div className="session-running-panel">
            <span className={`session-live-dot ${draft.running && !paused ? "live" : ""}`} />
            <div className="session-time-display">{formatDuration(seconds)}</div>
            <p>{draft.running ? paused ? "Paused while you’re away · return and interact to resume timing." : `Tracking your ${draft.category} session.` : "Session paused. Resume when you’re ready."}</p>
            <div className="session-running-actions">{draft.running ? <button className="small-outline-button" onClick={pauseSession}><Pause size={14} /> Pause</button> : <button className="small-outline-button" onClick={resumeSession}><Play size={14} /> Resume</button>}<button className="primary-button module-action-button" onClick={finishSession}><StopCircle size={14} /> Finish session</button><button className="icon-button" onClick={discardSession} aria-label="Discard session"><RotateCcw size={15} /></button></div>
            <span className="session-recovery-note">Your active timer is periodically saved in this browser.</span>
          </div>}
        </Panel>
        <Panel collapsible title="This week" description="Time from sessions you explicitly started.">
          <div className="weekly-analytics-summary"><div><strong>{formatDuration(weekSeconds + (draft?.running && !paused ? seconds : 0))}</strong><span>of {formatDuration(goalSeconds)} target</span></div><label>Weekly goal<select value={goalMinutes} onChange={(event) => updateGoal(Number(event.target.value))}><option value={180}>3 hours</option><option value={300}>5 hours</option><option value={420}>7 hours</option><option value={600}>10 hours</option></select></label></div>
          <div className="weekly-analytics-track"><span style={{ width: `${completion}%` }} /></div>
          <div className="weekly-chart" aria-label="Active learning time by day">{days.map((day, index) => <div key={index} className="weekly-chart-day"><div className="weekly-chart-bar-wrap"><i style={{ height: `${Math.max(day.seconds ? 6 : 2, day.seconds / maxDay * 100)}%` }} /></div><span>{day.label}</span></div>)}</div>
          <div className="weekly-chart-caption"><span>{completion}% of weekly target</span><span>{Math.max(0, Math.round((goalSeconds - weekSeconds) / 3600 * 10) / 10)} hours remaining</span></div>
        </Panel>
        <Panel collapsible title="Recent sessions" description="A local history of completed focus sessions.">
          {sessions.length ? <div className="session-history">{sessions.slice(0, 12).map((session) => <div key={session.id} className="session-history-row"><span className={`session-category-symbol category-${session.category}`}><BookOpen size={14} /></span><span><strong>{capitalize(session.category)} session</strong><small>{new Date(session.startedAt).toLocaleString()}</small></span><b>{formatDuration(session.seconds)}</b></div>)}</div> : <div className="module-empty compact"><Clock3 size={20} /><strong>No sessions yet</strong><span>Start a session when you begin a focused study block.</span></div>}
        </Panel>
      </div>
      <aside className="analytics-side-column">
        <Panel collapsible title="Learning rhythm" description="Your own recent activity.">
          <div className="analytics-stat-stack"><div><span>Study sessions this week</span><strong>{weekSessions.length}</strong></div><div><span>Active days this week</span><strong>{new Set(weekSessions.map((session) => new Date(session.startedAt).toDateString())).size}</strong></div><div><span>Sessions today</span><strong>{todaySessions}</strong></div></div>
          <p className="analytics-small-print">No streaks or rankings are based on idle browser time.</p>
        </Panel>
        <Panel collapsible title="Time by activity" description="All-time time you chose to track.">
          <div className="activity-breakdown">{Object.entries(grouped).map(([name, total]) => <div key={name}><span className={`breakdown-dot breakdown-${name}`} /><span>{capitalize(name)}</span><strong>{formatDuration(total)}</strong></div>)}</div>
          {Object.values(grouped).every((value) => value === 0) && <p className="analytics-empty-note">Your breakdown will appear here after you finish a session.</p>}
        </Panel>
        <div className="analytics-data-note"><Check size={14} /><span>Detailed analytics currently stay in this browser. No cloud session sync is configured.</span></div>
      </aside>
    </div>
  </ModuleShell>;
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m`;
  return `${secs}s`;
}
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
