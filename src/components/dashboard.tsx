"use client";

import Link from "next/link";
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  Command,
  FileText,
  Flame,
  FlaskConical,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Search,
  Settings2,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { CurriculumWeek } from "@/lib/curriculum";
import { readLocal, type StudySession } from "@/lib/local-data";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useCurriculumData } from "@/lib/use-curriculum";
import { loadProgress, persistProgressItem } from "@/lib/progress";
import { ThemeToggle } from "@/lib/theme";

export default function Dashboard() {
  const { curriculum: curriculumData } = useCurriculumData();
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const [showLesson, setShowLesson] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [todayLabel, setTodayLabel] = useState("TODAY");
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [goalMinutes, setGoalMinutes] = useState(300);
  const [activeWeekNumber, setActiveWeekNumber] = useState(1);
  const [memberName, setMemberName] = useState("Learner");
  const [memberInitials, setMemberInitials] = useState("LW");
  const [isAdmin, setIsAdmin] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [announcement, setAnnouncement] = useState<{ title: string; body: string } | null>(null);
  const [nextAssignment, setNextAssignment] = useState<{ title: string; week: number; dueAt: string | null } | null>(null);
  const [pendingAssignmentCount, setPendingAssignmentCount] = useState(0);
  const [lastAchievement, setLastAchievement] = useState<{ title: string; earnedAt: string } | null>(null);

  useEffect(() => {
    setTodayLabel(new Intl.DateTimeFormat("en", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date()).toUpperCase());
    const loadLocalData = () => {
      setProgress(readLocal("curriculum-progress", {}));
      setSessions(readLocal("learning-sessions", []));
      setGoalMinutes(readLocal("weekly-goal-minutes", 300));
      setLastAchievement(readLocal("last-achievement", null));
      const completedWeeks = readLocal<Record<string, boolean>>("curriculum-progress", {});
      const firstIncomplete = curriculumData.find((week) => !completedWeeks[`week-${week.week}-complete`])?.week ?? 24;
      const lastVisited = Number(readLocal("last-active-week", firstIncomplete));
      const lastValid = lastVisited >= 1 && lastVisited <= 24 && !completedWeeks[`week-${lastVisited}-complete`] ? lastVisited : firstIncomplete;
      setActiveWeekNumber(lastValid);
    };
    loadLocalData();
    void loadProgress().then(setProgress);
    window.addEventListener("tks-local-data", loadLocalData);
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setShowLesson(false);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("tks-local-data", loadLocalData);
      window.removeEventListener("keydown", handleShortcut);
    };
  }, [curriculumData]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setSignedIn(true);
      const { data } = await supabase.from("profiles").select("display_name,membership_state,role").eq("id", user.id).maybeSingle();
      if (data?.display_name) {
        setMemberName(data.display_name);
        setMemberInitials(data.display_name.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase());
      }
      setIsAdmin(data?.role === "admin" && data?.membership_state === "approved");
      if (data?.membership_state === "approved") {
        const { data: latest } = await supabase.from("announcements").select("title,body").eq("published", true).order("published_at", { ascending: false }).limit(1).maybeSingle();
        if (latest) setAnnouncement({ title: latest.title, body: latest.body });
        const [{ data: assignments }, { data: submissions }] = await Promise.all([
          supabase.from("assignments").select("id,title,week_id,due_at").eq("published", true).order("due_at", { ascending: true, nullsFirst: false }),
          supabase.from("submissions").select("assignment_id,status").eq("user_id", user.id),
        ]);
        const completedIds = new Set((submissions ?? []).filter((item) => ["submitted", "in_review", "reviewed"].includes(item.status)).map((item) => item.assignment_id));
        const pending = (assignments ?? []).filter((item) => !completedIds.has(item.id));
        setPendingAssignmentCount(pending.length);
        const upcoming = pending.find((item) => !item.due_at || new Date(item.due_at) >= new Date()) ?? pending[0];
        if (upcoming) setNextAssignment({ title: upcoming.title, week: upcoming.week_id, dueAt: upcoming.due_at });
      }
    });
  }, []);

  const showComingSoon = (section: string) => {
    setNotice(`${section} isn’t available here yet.`);
    window.setTimeout(() => setNotice(""), 3200);
  };

  const toggleProgress = (key: string) => {
    const completed = !progress[key];
    setProgress((current) => ({ ...current, [key]: completed }));
    void persistProgressItem(key, completed);
  };

  async function handleAccountAction() {
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
    if (user && supabase) await supabase.auth.signOut();
    window.location.assign("/login");
  }

  const currentWeek: CurriculumWeek = curriculumData[activeWeekNumber - 1];
  const completedWeeks = curriculumData.filter((week) => progress[`week-${week.week}-complete`]).length;
  const curriculumPercent = Math.round((completedWeeks / curriculumData.length) * 100);
  const weekKeys = [
    { key: "lesson", label: "Review learning objectives" },
    { key: "coding", label: "Complete coding practice" },
    { key: "activity", label: "Try the weekly activity" },
    { key: "assignment", label: `Start ${currentWeek.build}` },
  ];
  const completedItems = weekKeys.filter((item) => progress[`week-${currentWeek.week}-${item.key}`]).length;
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const weekSessions = sessions.filter((session) => new Date(session.startedAt) >= monday);
  const weekSeconds = weekSessions.reduce((total, session) => total + session.seconds, 0);
  const targetSeconds = goalMinutes * 60;
  const remainingSeconds = Math.max(0, targetSeconds - weekSeconds);
  const weeklyPercent = Math.min(100, Math.round(weekSeconds / Math.max(targetSeconds, 1) * 100));
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(day.getDate() + index);
    return {
      label: day.toLocaleDateString("en", { weekday: "short" }).slice(0, 1),
      active: weekSessions.some((session) => new Date(session.startedAt).toDateString() === day.toDateString()),
      seconds: weekSessions.filter((session) => new Date(session.startedAt).toDateString() === day.toDateString()).reduce((total, session) => total + session.seconds, 0),
    };
  });
  const maxDaySeconds = Math.max(3600, ...weekDays.map((day) => day.seconds));
  const recentSessions = sessions.slice(0, 3);
  const sessionDays = new Set(sessions.map((session) => new Date(session.startedAt).toDateString()));
  let streak = 0;
  const streakDate = new Date();
  if (!sessionDays.has(streakDate.toDateString())) streakDate.setDate(streakDate.getDate() - 1);
  while (sessionDays.has(streakDate.toDateString())) { streak++; streakDate.setDate(streakDate.getDate() - 1); }
  const formatHours = (seconds: number) => `${(seconds / 3600).toFixed(1)}`;
  const resourceOne = currentWeek.resources[0];
  const resourceTwo = currentWeek.resources[1] ?? currentWeek.resources[0];

  return (
    <main className="app-frame">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <Link className="brand-home" href="/" aria-label="TKS ML and AI Society home"><span className="brand-mark"><BrainCircuit size={19} strokeWidth={1.8} /></span><span className="brand-copy"><strong>TKS Society</strong><small>ML &amp; AI</small></span></Link>
          <button className="icon-button sidebar-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <button className="workspace-switch" onClick={() => showComingSoon("Workspace switcher")}>
          <span className="workspace-avatar">T</span>
          <span className="workspace-copy"><strong>Learning workspace</strong><small>{isSupabaseConfigured() ? (signedIn ? "Member access" : "Sign in required") : "Local workspace"}</small></span>
          <ChevronDown size={15} className="muted-icon" />
        </button>

        <div className="nav-group">
          <p className="nav-label">YOUR WORKSPACE</p>
          {[
            { label: "Overview", icon: LayoutDashboard, href: "/", active: true },
            { label: "Curriculum", icon: BookOpen, href: "/curriculum", detail: "24 weeks" },
            { label: "Resources", icon: FileText, href: "/resources" },
            { label: "Project lab", icon: FlaskConical, href: "/projects" },
            { label: "Notebook", icon: Code2, href: "/notebook" },
            { label: "AI assistant", icon: FlaskConical, href: "/assistant" },
            { label: "Analytics", icon: Clock3, href: "/analytics" },
            { label: "Achievements", icon: Target, href: "/leaderboard" },
            { label: "Help center", icon: CircleHelp, href: "/help" },
            ...(isAdmin ? [{ label: "Administration", icon: Settings2, href: "/admin" }] : []),
          ].map(({ label, icon: Icon, active, detail, href }) => (
            <button
              className={`nav-item ${active ? "nav-active" : ""}`}
              key={label}
              onClick={() => href === "/" ? setMobileNav(false) : window.location.assign(href)}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {detail && <span className="nav-detail">{detail}</span>}
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="week-mini">
            <div className="week-mini-top"><span>YOUR LEARNING PATH</span><MoreHorizontal size={17} /></div>
            <div className="week-mini-title">Week {activeWeekNumber} of 24</div>
            <div className="mini-progress"><span style={{ width: `${curriculumPercent}%` }} /></div>
            <div className="week-mini-foot"><span>{currentWeek.title}</span><span>{curriculumPercent}%</span></div>
          </div>
          <button className="nav-item" onClick={() => void handleAccountAction()}><Settings2 size={17} /><span>{signedIn ? "Account & sign out" : "Account & sync"}</span></button>
          <div className="profile-row">
            <div className="profile-avatar">{memberInitials}</div>
            <div className="profile-copy"><strong>{memberName}</strong><small>{isSupabaseConfigured() ? (signedIn ? "Society account" : "Signed out") : "Local workspace"}</small></div>
            <button className="icon-button profile-menu" onClick={() => void handleAccountAction()} aria-label="Account and sign out"><MoreHorizontal size={18} /></button>
          </div>
        </div>
      </aside>

      {mobileNav && <button className="mobile-backdrop" aria-label="Close menu" onClick={() => setMobileNav(false)} />}

      <section className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>Overview</strong></div>
          </div>
          <div className="topbar-actions">
            <button className="search-trigger" onClick={() => setSearchOpen((v) => !v)} aria-label="Search workspace">
              <Search size={15} /><span>Search anything</span><kbd><Command size={11} /> K</kbd>
            </button>
            <span className="topbar-divider" />
            <ThemeToggle className="icon-button" />
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => showComingSoon("Notifications")}><Bell size={18} /><i /></button>
            <div className="profile-avatar top-avatar">{memberInitials}</div>
          </div>
        </header>

        {searchOpen && (
          <div className="search-popover">
            <div className="search-input-wrap"><Search size={17} /><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search lessons and topics…" onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); }} /><kbd>ESC</kbd></div>
            {searchQuery.trim() ? <div className="dashboard-search-results">
              {curriculumData.filter((week) => `${week.title} ${week.topics.join(" ")} ${week.build}`.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5).map((week) => <button key={week.week} onClick={() => window.location.assign(`/curriculum?week=${week.week}`)}><BookOpen size={14} /><span><strong>Week {week.week}: {week.title}</strong><small>{week.topics.slice(0, 3).join(" · ")}</small></span><ArrowRight size={13} /></button>)}
              {curriculumData.every((week) => !`${week.title} ${week.topics.join(" ")} ${week.build}`.toLowerCase().includes(searchQuery.toLowerCase())) && <p>No curriculum matches. Search currently covers curriculum weeks and topics.</p>}
            </div> : <p>Search across all 24 curriculum weeks and topics.</p>}
          </div>
        )}

        <div className="page-content">
          <div className="preview-notice"><span className="preview-indicator" /> {isSupabaseConfigured() ? "MEMBER WORKSPACE" : "LOCAL WORKSPACE"} <span className="preview-divider">·</span> {isSupabaseConfigured() ? "Signed in with secure member access. Your progress and focus sessions are saved on this device and can sync when available." : "Your progress and focus sessions are saved in this browser on this device."}</div>
          <div className="welcome-row">
            <div>
              <div className="eyebrow"><span className="status-dot" /> {todayLabel}</div>
              <h1>Good morning, {memberName} <span className="wave">✳</span></h1>
              <p className="welcome-subtitle">A little progress today adds up to something remarkable.</p>
            </div>
            <button className="secondary-button weekly-plan-button" onClick={() => window.location.assign("/curriculum")}><CalendarDays size={16} /> View weekly plan</button>
          </div>

          <section className="hero-card" aria-label="Continue learning">
            <div className="hero-content">
              <div className="hero-kicker"><span className="hero-kicker-dot" /> YOUR LEARNING PATH <span className="kicker-separator">/</span> WEEK {String(currentWeek.week).padStart(2, "0")}</div>
              <h2>{currentWeek.title}</h2>
              <p className="hero-description">{currentWeek.summary}</p>
              <div className="hero-meta">
                <span><BookOpen size={15} /> {currentWeek.objectives.length} objectives</span>
                <span><Clock3 size={15} /> About 5–7 hours</span>
                <span className="hero-meta-level">Foundations</span>
              </div>
              <button className="primary-button" onClick={() => setShowLesson(true)}>Continue learning <ArrowRight size={16} /></button>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
              <div className="art-grid" />
              <div className="art-axis axis-x" /><div className="art-axis axis-y" />
              <div className="art-line line-one" /><div className="art-line line-two" />
              <div className="art-point point-one" /><div className="art-point point-two" /><div className="art-point point-three" />
              <span className="art-label label-a">v₁</span><span className="art-label label-b">v₂</span>
              <div className="art-equation">T<span>(</span>v<span>)</span> = Av</div>
            </div>
            <div className="hero-week-tag">MONTH {String(currentWeek.phase).padStart(2, "0")} <span>•</span> {currentWeek.week <= 4 ? "MATHEMATICAL FOUNDATIONS" : currentWeek.week <= 8 ? "PROBABILITY & DATA" : currentWeek.week <= 12 ? "CLASSICAL MACHINE LEARNING" : currentWeek.week <= 16 ? "DEEP LEARNING" : currentWeek.week <= 20 ? "MODERN AI" : "APPLIED AI ENGINEERING"}</div>
          </section>

          <section className="overview-grid" aria-label="Learning overview">
            <article className="stat-card progress-stat">
              <div className="stat-top"><span className="stat-icon purple-icon"><BookOpen size={17} /></span><span className="stat-period">YOUR JOURNEY</span><button className="icon-button tiny-menu" aria-label="Progress details" onClick={() => showComingSoon("Progress details")}><MoreHorizontal size={17} /></button></div>
              <div className="stat-main"><strong>{curriculumPercent}<span>%</span></strong><span className="stat-trend"><Check size={12} /> {completedWeeks} weeks</span></div>
              <p className="stat-caption">Curriculum completed</p>
              <div className="stat-progress-track"><span style={{ width: `${curriculumPercent}%` }} /></div>
              <div className="stat-foot"><span>{completedWeeks} of 24 weeks complete</span><span>{24 - completedWeeks} to go</span></div>
            </article>
            <article className="stat-card streak-stat">
              <div className="stat-top"><span className="stat-icon amber-icon"><Flame size={17} /></span><span className="stat-period">CONSISTENCY</span><button className="icon-button tiny-menu" aria-label="Streak details" onClick={() => showComingSoon("Streak details")}><MoreHorizontal size={17} /></button></div>
              <div className="stat-main"><strong>{streak}<span className="unit"> {streak === 1 ? "day" : "days"}</span></strong>{streak > 0 && <span className="streak-flame"><Flame size={15} fill="currentColor" /></span>}</div>
              <p className="stat-caption">Consecutive days with a completed focus session</p>
              <div className="week-dots" aria-label={`${weekDays.filter((day) => day.active).length} active days this week`}>{weekDays.map((day, i) => <span key={`${day.label}-${i}`} className={day.active ? "day-active" : ""}>{day.active ? <Check size={11} /> : day.label}</span>)}</div>
              <div className="stat-foot"><span>{weekSessions.length} sessions this week</span><span>{weekDays.filter((day) => day.active).length} active days</span></div>
            </article>
            <article className="stat-card hours-stat">
              <div className="stat-top"><span className="stat-icon blue-icon"><Clock3 size={17} /></span><span className="stat-period">THIS WEEK</span><button className="icon-button tiny-menu" aria-label="Study time details" onClick={() => showComingSoon("Study time details")}><MoreHorizontal size={17} /></button></div>
              <div className="stat-main"><strong>{formatHours(weekSeconds)}<span className="unit"> hrs</span></strong><span className="stat-trend"><Clock3 size={12} /> {formatHours(remainingSeconds)} hrs left</span></div>
              <p className="stat-caption">Of your {formatHours(targetSeconds)} hour weekly target</p>
              <div className="hours-chart" aria-label="Weekly study time chart">
                {weekDays.map((day, index) => <div className="chart-column" key={index}><span className={day.active ? "chart-bar chart-today" : "chart-bar"} style={{ height: `${Math.max(day.seconds ? 5 : 2, day.seconds / maxDaySeconds * 100)}%` }} /><small>{day.label}</small></div>)}
              </div>
            </article>
          </section>

          <section className="content-grid">
            <div className="main-feed">
              <div className="section-heading"><div><h3>This week</h3><p>Your learning, at a comfortable pace.</p></div><button className="text-button" onClick={() => window.location.assign(`/curriculum?week=${currentWeek.week}`)}>View plan <ArrowRight size={14} /></button></div>
              <article className="focus-card">
                <div className="focus-topline"><div className="focus-label"><span className="focus-label-dot" /> WEEKLY FOCUS</div><span className="focus-week">{String(currentWeek.week).padStart(2, "0")} / 24</span></div>
                <div className="focus-body">
                  <div className="focus-copy"><h4>{currentWeek.topics.slice(0, 3).join(" · ")}</h4><p>{currentWeek.activity}</p><button className="inline-link" onClick={() => window.location.assign(`/curriculum?week=${currentWeek.week}`)}>Explore this week <ArrowRight size={14} /></button></div>
                  <div className="focus-completion"><div className="completion-ring" style={{ "--progress": `${completedItems * 25}%` } as React.CSSProperties}><div><strong>{completedItems}</strong><span>of 4</span></div></div><span>steps done</span></div>
                </div>
                <div className="milestone-list">
                  {weekKeys.map((item, index) => <button key={item.key} className={`milestone-row ${progress[`week-${currentWeek.week}-${item.key}`] ? "milestone-done" : ""}`} onClick={() => toggleProgress(`week-${currentWeek.week}-${item.key}`)}>
                    <span className="milestone-check">{progress[`week-${currentWeek.week}-${item.key}`] && <Check size={13} />}</span><span>{item.label}</span>{index === 3 && !progress[`week-${currentWeek.week}-${item.key}`] && <span className="build-tag">WEEKLY BUILD</span>}
                  </button>)}
                </div>
              </article>

              <div className="section-heading activity-heading"><div><h3>Coming up</h3><p>A few things to keep on your radar.</p></div><button className="icon-button" aria-label="More upcoming items" onClick={() => showComingSoon("Upcoming items")}><MoreHorizontal size={19} /></button></div>
              <div className="upcoming-list">
                <button className="upcoming-item" onClick={() => window.location.assign(`/curriculum?week=${currentWeek.week}`)}>
                  <div className="upcoming-date"><strong>01</strong><span>LEARN</span></div>
                  <div className="upcoming-copy"><div><h4>{currentWeek.lectures[0] ?? currentWeek.readings[0]}</h4><span className="upcoming-type"><span className="type-dot practice-dot" /> Suggested learning</span></div><p>Week {currentWeek.week} <span>·</span> Start anytime</p></div>
                  <ChevronRight size={17} className="upcoming-arrow" />
                </button>
                <button className="upcoming-item" onClick={() => window.location.assign(`/projects?week=${currentWeek.week}`)}>
                  <div className="upcoming-date due-date"><strong>{String(currentWeek.week).padStart(2, "0")}</strong><span>BUILD</span></div>
                  <div className="upcoming-copy"><div><h4>{nextAssignment?.title ?? currentWeek.build}</h4><span className="upcoming-type"><span className="type-dot project-dot" /> {pendingAssignmentCount ? `${pendingAssignmentCount} pending assignment${pendingAssignmentCount === 1 ? "" : "s"}` : "Weekly build"}</span></div><p>{nextAssignment?.dueAt ? `Due ${new Date(nextAssignment.dueAt).toLocaleDateString()}` : `Week ${nextAssignment?.week ?? currentWeek.week} · No fixed due date`}</p></div>
                  <ChevronRight size={17} className="upcoming-arrow" />
                </button>
              </div>
              <div className="section-heading activity-heading"><div><h3>Recent activity</h3><p>Your latest completed focus sessions.</p></div><button className="text-button" onClick={() => window.location.assign("/analytics")}>View analytics <ArrowRight size={13} /></button></div>
              <div className="recent-dashboard-activity">{recentSessions.length ? recentSessions.map((session) => <div key={session.id}><span className={`recent-activity-icon recent-${session.category}`}><Clock3 size={13} /></span><span><strong>{session.category[0].toUpperCase() + session.category.slice(1)} session</strong><small>{new Date(session.startedAt).toLocaleDateString()} · {formatHours(session.seconds)} hrs</small></span><Check size={13} className="recent-activity-check" /></div>) : <p>When you finish a focus session, it will appear here. Sessions are opt-in and saved on this device.</p>}</div>
            </div>

            <aside className="right-rail">
              <article className="target-card">
                <div className="rail-card-heading"><div><span className="rail-eyebrow">WEEKLY TARGET</span><h3>Make time for learning</h3></div><span className="target-icon"><Target size={17} /></span></div>
                <div className="target-numbers"><strong>{formatHours(weekSeconds)} <small>hrs</small></strong><span>of {formatHours(targetSeconds)} hours</span></div>
                <div className="target-track"><span style={{ width: `${weeklyPercent}%` }} /></div>
                <div className="target-foot"><span>{formatHours(remainingSeconds)} hours to go</span><span>{weeklyPercent}%</span></div>
                <p className="target-note">{weekSessions.length ? "Small, steady sessions work better than cramming. Keep your pace comfortable." : "Start a focus session when you begin learning. Only your active, visible study time is counted."}</p>
              </article>

              <article className="resource-card">
                <div className="rail-section-title"><div><h3>For this week</h3><p>Curated learning resources</p></div><button className="icon-button" onClick={() => window.location.assign("/resources")} aria-label="See all resources"><ArrowRight size={16} /></button></div>
                {[resourceOne, resourceTwo].map((resource, index) => <a key={`${resource.url}-${index}`} className="resource-item" href={resource.url} target="_blank" rel="noreferrer">
                  <span className={`resource-cover ${index === 0 ? "cover-video" : "cover-book"}`}><span>{index === 0 ? <span className="cover-play">↗</span> : "∑"}</span><span className="cover-caption">{resource.kind.toUpperCase()}</span></span>
                  <span className="resource-copy"><strong>{resource.title}</strong><small>{resource.note ?? resource.kind}<span> · </span>{resource.kind}</small><small className="resource-progress-caption">Week {currentWeek.week} · Suggested</small></span>
                  <ChevronRight size={16} className="resource-arrow" />
                </a>)}
                <button className="shelf-link" onClick={() => window.location.assign("/resources")}>Go to resource library <ArrowRight size={14} /></button>
              </article>

              <article className="announcement-card">
                <div className="announcement-icon"><Sparkles size={16} /></div>
                <div><span className="rail-eyebrow">{announcement ? "FROM THE SOCIETY" : "A NOTE ON PACING"}</span><h3>{announcement?.title ?? "Take one concept at a time"}</h3><p>{announcement?.body ?? "There’s no fixed schedule here. Return to your current week whenever you’re ready to continue."}</p><button onClick={() => announcement ? setNotice(`${announcement.title}: ${announcement.body}`) : window.location.assign(`/curriculum?week=${currentWeek.week}`)}>{announcement ? "Read announcement" : "Open your learning path"} <ArrowRight size={13} /></button></div>
              </article>

              {lastAchievement && <div className="dashboard-achievement"><span><Award size={16} /></span><div><small>LAST MILESTONE</small><strong>{lastAchievement.title}</strong><p>Earned {new Date(lastAchievement.earnedAt).toLocaleDateString()}</p></div><button onClick={() => window.location.assign("/leaderboard")} aria-label="View achievements"><ArrowRight size={14} /></button></div>}
              <div className="privacy-note"><span className="privacy-lock">◈</span><span>Your learning time is an estimate of activity, not attention. <button onClick={() => window.location.assign("/analytics")}>How it works</button></span></div>
            </aside>
          </section>
          <footer className="page-footer"><span>Built for curious minds.</span><span>Take it one concept at a time <span className="footer-spark">✳</span></span></footer>
        </div>
      </section>

      {showLesson && <div className="drawer-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowLesson(false); }}>
        <section className="lesson-drawer" role="dialog" aria-modal="true" aria-labelledby="lesson-title">
              <div className="drawer-top"><span className="drawer-kicker">WEEK {String(currentWeek.week).padStart(2, "0")} <span>·</span> LEARNING OVERVIEW</span><button className="icon-button" onClick={() => setShowLesson(false)} aria-label="Close lesson preview"><X size={19} /></button></div>
              <div className="lesson-progress"><span /></div>
              <div className="lesson-overline">{currentWeek.title.toUpperCase()} <span>•</span> WEEK {currentWeek.week} OF 24</div>
              <h2 id="lesson-title">{currentWeek.topics[0]}</h2>
              <p className="lesson-intro">{currentWeek.summary}</p>
              <div className="lesson-callout"><div className="callout-icon"><Sparkles size={16} /></div><p><strong>Start with this</strong><br />{currentWeek.objectives[0]}</p></div>
              <div className="lesson-section"><h3>Why it matters</h3><p>{currentWeek.activity}</p></div>
              <div className="lesson-equation">{currentWeek.mathematics[0]}</div>
              <div className="lesson-section"><h3>Learning objectives</h3><ul>{currentWeek.objectives.slice(0, 4).map((objective) => <li key={objective}>{objective}</li>)}</ul></div>
              <div className="drawer-bottom"><span><Clock3 size={14} /> {isSupabaseConfigured() ? "Progress saved to your account and this device" : "Review progress saved on this device"}</span><button className="primary-button" onClick={() => { if (!progress[`week-${currentWeek.week}-lesson`]) toggleProgress(`week-${currentWeek.week}-lesson`); setShowLesson(false); window.location.assign(`/curriculum?week=${currentWeek.week}`); }}>{progress[`week-${currentWeek.week}-lesson`] ? "Open this week" : "Mark reviewed & continue"} <ArrowRight size={15} /></button></div>
        </section>
      </div>}

      {notice && <div className="toast-message" role="status"><span className="toast-check"><Check size={14} /></span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={14} /></button></div>}
    </main>
  );
}
