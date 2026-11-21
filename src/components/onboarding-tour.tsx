"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Compass, X } from "lucide-react";

type Step = { href: string; title: string; body: string };
const KEY = "tks-onboarding-v1";
const steps: Step[] = [
  { href: "/", title: "Overview", body: "Your dashboard shows progress, focus, upcoming work, and quick access to key areas." },
  { href: "/curriculum", title: "Curriculum", body: "Follow the 24-week learning path, track week completion, and explore build/analyze ideas." },
  { href: "/resources", title: "Resources", body: "Find curated learning materials, open them in-tab, and track reading activity." },
  { href: "/projects", title: "Project Lab", body: "Plan your own projects, track milestones, and use guided analysis workflows." },
  { href: "/notebook", title: "Notebook", body: "Take local-first notes with Markdown/LaTeX. Your notes stay on this device unless you export/sync features you use." },
  { href: "/assistant", title: "AI Assistant", body: "Get learning help. Use society server AI if configured, or add your own API/local model in Provider settings." },
  { href: "/analytics", title: "Analytics", body: "Track focus sessions and learning activity. Use explicit timers for accurate personal analytics." },
  { href: "/leaderboard", title: "Achievements", body: "See badges, milestones, and society rankings based on real tracked progress." },
  { href: "/help", title: "Help Center", body: "Ask for help, report issues, or send suggestions. Admin can review and respond." },
  { href: "/account", title: "Account Settings", body: "Update your name, username, password, and profile photo details." },
];

export function OnboardingTour() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) { setOpen(true); setIndex(0); return; }
      const parsed = JSON.parse(raw) as { done?: boolean; index?: number };
      if (!parsed.done) { setOpen(true); setIndex(Math.min(Math.max(parsed.index ?? 0, 0), steps.length - 1)); }
    } catch {}
  }, []);

  useEffect(() => {
    function onStart() { setIndex(0); setOpen(true); try { localStorage.setItem(KEY, JSON.stringify({ done: false, index: 0 })); } catch {} }
    window.addEventListener("tks:start-tour", onStart);
    return () => window.removeEventListener("tks:start-tour", onStart);
  }, []);

  if (!open) return null;
  const step = steps[index];

  function persist(nextIndex: number, done: boolean) {
    try { localStorage.setItem(KEY, JSON.stringify({ done, index: nextIndex })); } catch {}
  }
  function close(done = true) { setOpen(false); persist(index, done); }
  function go(next: number) {
    const safe = Math.min(Math.max(next, 0), steps.length - 1);
    setIndex(safe); persist(safe, false);
    const href = steps[safe].href;
    if (pathname !== href) router.push(href);
  }

  return (
    <div className="onboarding-tour" role="dialog" aria-label="Workspace tour">
      <div className="onboarding-tour-head">
        <span className="onboarding-tour-badge"><Compass size={14} /> Workspace tour</span>
        <button className="icon-button" onClick={() => close(true)} aria-label="Close tour"><X size={16} /></button>
      </div>
      <p className="onboarding-tour-step">Step {index + 1} of {steps.length}</p>
      <h3>{step.title}</h3>
      <p>{step.body}</p>
      <div className="onboarding-tour-actions">
        <button className="small-outline-button" onClick={() => close(true)}>Skip</button>
        <div style={{display:"flex",gap:8}}>
          <button className="small-outline-button" onClick={() => go(index - 1)} disabled={index === 0}>Back</button>
          {index < steps.length - 1 ? (
            <button className="primary-button" onClick={() => go(index + 1)}>Next</button>
          ) : (
            <button className="primary-button" onClick={() => close(true)}>Finish</button>
          )}
        </div>
      </div>
      {pathname !== step.href && <button className="text-button onboarding-tour-go" onClick={() => router.push(step.href)}>Go to {step.title}</button>}
    </div>
  );
}

export function startOnboardingTour() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("tks:start-tour"));
}
