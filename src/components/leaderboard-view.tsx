"use client";

import { useEffect, useState } from "react";
import { Award, BookOpen, Eye, EyeOff, Flame, FlaskConical, LockKeyhole, Medal, Trophy, Users } from "lucide-react";
import { ModuleShell, Panel } from "@/components/module-shell";
import { readLocal, writeLocal, type Project, type StudySession } from "@/lib/local-data";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Ranking = { user_id: string; display_name: string; period_type: string; period_key: string; total_points: number };
const badgeDetails = [
  { id: "first-week", title: "A solid start", detail: "Complete your first curriculum week", icon: BookOpen },
  { id: "first-project", title: "Builder", detail: "Submit a practical project", icon: FlaskConical },
  { id: "steady-practice", title: "Steady practice", detail: "Learn on five different days", icon: Flame },
  { id: "ten-weeks", title: "Finding your rhythm", detail: "Complete ten curriculum weeks", icon: Award },
];

export function LeaderboardView() {
  const [period, setPeriod] = useState<"overall" | "weekly" | "monthly">("overall");
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [cloud, setCloud] = useState(false);
  const [visible, setVisible] = useState(true);
  const [member, setMember] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [notice, setNotice] = useState("");
  const [completedWeeks, setCompletedWeeks] = useState(0);
  const [projectsSubmitted, setProjectsSubmitted] = useState(0);
  const [studyDays, setStudyDays] = useState(0);

  useEffect(() => {
    setVisible(readLocal("leaderboard-visible", true));
    const progress = readLocal<Record<string, boolean>>("curriculum-progress", {});
    setCompletedWeeks(Object.entries(progress).filter(([key, value]) => key.startsWith("week-") && key.endsWith("-complete") && value).length);
    const projects = readLocal<Project[]>("projects", []);
    setProjectsSubmitted(projects.filter((project) => project.status === "submitted").length);
    const sessions = readLocal<StudySession[]>("learning-sessions", []);
    setStudyDays(new Set(sessions.map((session) => new Date(session.startedAt).toDateString())).size);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setCloud(true);
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("membership_state,leaderboard_visible").eq("id", user.id).maybeSingle();
      if (profile?.membership_state !== "approved") return;
      setMember(true);
      setVisible(profile.leaderboard_visible);
      const { data } = await supabase.from("society_leaderboard").select("user_id,display_name,period_type,period_key,total_points").eq("period_type", period).order("total_points", { ascending: false }).limit(50);
      setRankings((data ?? []) as Ranking[]);
    });
  }, [period]);

  async function toggleVisibility() {
    const next = !visible;
    setVisible(next);
    if (cloud && member) {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase!.auth.getUser();
      const { error } = await supabase!.from("profiles").update({ leaderboard_visible: next }).eq("id", user!.id);
      if (error) setVisible(!next);
      setNotice(error ? `Could not update preference: ${error.message}` : next ? "Your profile is visible on the society leaderboard." : "You’re hidden from the society leaderboard.");
    } else {
      writeLocal("leaderboard-visible", next);
      setNotice("Preference saved on this device. Sign in to control your society leaderboard visibility.");
    }
    window.setTimeout(() => setNotice(""), 4000);
  }

  const earned = new Set<string>();
  if (completedWeeks >= 1) earned.add("first-week");
  if (projectsSubmitted > 0) earned.add("first-project");
  if (studyDays >= 5) earned.add("steady-practice");
  if (completedWeeks >= 10) earned.add("ten-weeks");

  return <ModuleShell title="Achievements" description="Recognise progress and meaningful contributions—not time spent with a tab open." icon={Trophy}>
    <div className="leaderboard-hero">
      <div><span className="leaderboard-overline">GROWTH OVER GRIND</span><h2>Celebrate the work that matters.</h2><p>Learning consistency, thoughtful projects, and research contributions make progress visible.</p></div>
      <div className="leaderboard-hero-icon"><Trophy size={27} /></div>
    </div>
    <div className="achievement-summary-grid">
      <div><span><BookOpen size={16} /></span><strong>{completedWeeks}</strong><small>Weeks completed</small></div>
      <div><span><FlaskConical size={16} /></span><strong>{projectsSubmitted}</strong><small>Projects submitted locally</small></div>
      <div><span><Flame size={16} /></span><strong>{studyDays}</strong><small>Learning days logged</small></div>
    </div>
    <div className="leaderboard-layout">
      <Panel collapsible title="Society leaderboard" description="Rankings are based on assessed contributions, never idle time." action={<button className="small-outline-button" onClick={toggleVisibility}>{visible ? <Eye size={14} /> : <EyeOff size={14} />}{visible ? "Visible" : "Hidden"}</button>}>
        <div className="ranking-tabs">{(["overall", "weekly", "monthly"] as const).map((value) => <button key={value} className={period === value ? "ranking-tab-active" : ""} onClick={() => setPeriod(value)}>{value === "overall" ? "Overall" : value === "weekly" ? "This week" : "This month"}</button>)}</div>
        {rankings.length > 0 ? <div className="ranking-list">{rankings.map((entry, index) => <div key={entry.user_id} className="ranking-row"><span className={`ranking-position ${index < 3 ? `top-rank rank-${index + 1}` : ""}`}>{index < 3 ? <Medal size={15} /> : index + 1}</span><span className="ranking-avatar">{initials(entry.display_name)}</span><span className="ranking-person"><strong>{entry.display_name}{entry.user_id === currentUserId ? " (you)" : ""}</strong><small>Society member</small></span><strong className="ranking-points">{Number(entry.total_points).toFixed(1)} <small>pts</small></strong></div>)}</div> : <div className="leaderboard-empty"><span><Users size={21} /></span><strong>No society rankings to show yet.</strong><p>{!cloud ? "Configure Supabase to enable approved member accounts and privacy-safe shared rankings." : !member ? "Sign in with an approved society account to view the leaderboard." : "Rankings will appear when administrators publish contribution scores."}</p></div>}
        <div className="score-explainer"><strong>How contributions are weighted</strong><span>Assessments 25% · Practical projects 30% · Research 20% · Learning consistency 15% · Repository analysis 10%</span><small>Administrators can adjust these weights. Browser time never earns points.</small></div>
      </Panel>
      <div className="achievement-column">
        <Panel collapsible title="Your milestones" description="Earned from real progress on this device.">
          <div className="badge-list">{badgeDetails.map(({ id, title, detail, icon: Icon }) => <div className={`badge-item ${earned.has(id) ? "badge-earned" : "badge-locked"}`} key={id}><span><Icon size={17} /></span><div><strong>{title}</strong><small>{detail}</small></div>{earned.has(id) ? <span className="badge-earned-label">Earned</span> : <LockKeyhole size={14} className="badge-lock-icon" />}</div>)}</div>
        </Panel>
        <div className="leaderboard-privacy"><LockKeyhole size={15} /><span><strong>Your privacy is yours.</strong> Personal notes and detailed analytics are never shown on the leaderboard. You can hide your profile at any time.</span></div>
      </div>
    </div>
    {notice && <p className="module-status-message" role="status">{notice}</p>}
  </ModuleShell>;
}

function initials(value: string) { return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "M"; }
