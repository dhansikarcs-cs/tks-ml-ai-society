"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import {
  Activity, ArrowLeft, BookOpen, BrainCircuit, ChevronDown, CircleHelp, Code2, FileText, LogIn, LogOut,
  FlaskConical, LayoutDashboard, Maximize2, Menu, Minimize2, Settings2, Trophy, UserRound, X,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/lib/theme";
import { OnboardingTour } from "@/components/onboarding-tour";

const items = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/curriculum", label: "Curriculum", icon: BookOpen },
  { href: "/resources", label: "Resources", icon: FileText },
  { href: "/projects", label: "Project lab", icon: FlaskConical },
  { href: "/notebook", label: "Notebook", icon: Code2 },
  { href: "/assistant", label: "AI assistant", icon: BrainCircuit },
  { href: "/analytics", label: "Analytics", icon: Activity },
  { href: "/leaderboard", label: "Achievements", icon: Trophy },
  { href: "/help", label: "Help center", icon: CircleHelp },
  { href: "/account", label: "Account settings", icon: UserRound },
  { href: "/admin", label: "Administration", icon: Settings2 },
];

export function ModuleShell({
  title,
  description,
  icon: Icon,
  children,
  actions,
}: {
  title: string;
  description: string;
  icon: typeof BookOpen;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const cached = typeof window !== "undefined" ? (() => { try { return JSON.parse(sessionStorage.getItem("tks-member-shell") || "null") as { signedIn: boolean; isAdmin: boolean; memberName: string } | null; } catch { return null; } })() : null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [signedIn, setSignedIn] = useState(cached?.signedIn ?? false);
  const [isAdmin, setIsAdmin] = useState(cached?.isAdmin ?? false);
  const [memberName, setMemberName] = useState(cached?.memberName ?? "");
  const cloudConfigured = isSupabaseConfigured();
  useEffect(() => { try { setFocusMode(localStorage.getItem("tks-focus-mode") === "1"); } catch {} }, []);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        sessionStorage.removeItem("tks-member-shell");
        setSignedIn(false); setIsAdmin(false); setMemberName("");
        return;
      }
      setSignedIn(true);
      const { data } = await supabase.from("profiles").select("display_name,role,membership_state").eq("id", user.id).maybeSingle();
      const name = data?.display_name || user.email?.split("@")[0] || "Member";
      const admin = data?.role === "admin" && data?.membership_state === "approved";
      setMemberName(name);
      setIsAdmin(admin);
      try { sessionStorage.setItem("tks-member-shell", JSON.stringify({ signedIn: true, isAdmin: admin, memberName: name })); } catch {}
    });
  }, []);

  async function signOut() {
    try { sessionStorage.removeItem("tks-member-shell"); } catch {}
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    window.location.assign("/login");
  }
  const initials = (memberName || "M").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase().slice(0, 2);
  const visibleItems = items.filter((item) => item.href !== "/admin" || isAdmin);
  function toggleFocusMode() {
    const next = !focusMode;
    setFocusMode(next);
    try { localStorage.setItem("tks-focus-mode", next ? "1" : "0"); } catch {}
  }

  return (
    <div className={`module-frame ${focusMode ? "module-focus-mode" : ""}`}>
      <aside className={`module-sidebar ${menuOpen ? "module-sidebar-open" : ""}`}>
        <div className="module-brand">
          <Link className="module-brand-home" href="/"><span className="brand-mark"><BrainCircuit size={18} /></span><span><strong>TKS Society</strong><small>ML &amp; AI</small></span></Link>
          <button className="icon-button module-sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <div className="module-workspace"><span className="workspace-avatar">T</span><span><strong>Learning workspace</strong><small>{cloudConfigured ? (signedIn ? "Member access" : "Sign in required") : "Local workspace"}</small></span></div>
        <p className="module-nav-label">YOUR WORKSPACE</p>
        <nav className="module-navigation" aria-label="Main navigation">
          {visibleItems.map(({ href, label, icon: NavIcon }) => (
            <Link key={href} href={href} className={`module-nav-link ${pathname === href ? "module-nav-active" : ""}`} aria-current={pathname === href ? "page" : undefined} onClick={() => setMenuOpen(false)}>
              <NavIcon size={16} strokeWidth={1.8} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="module-sidebar-footer">
          <div className="module-local-note">{cloudConfigured ? <><span className="cloud-status" />Secure member access</> : <><span className="local-status" />Local-only · this device</>}</div>
          <div className="module-sidebar-actions">
            <ThemeToggle className="module-sidebar-theme" />
            {signedIn ? <button className="module-account-link" onClick={signOut}><LogOut size={15} /> Sign out</button> : <Link className="module-account-link" href="/login"><LogIn size={15} /> Sign in</Link>}
          </div>
          {signedIn ? <Link href="/account" className="module-user module-user-link" onClick={() => setMenuOpen(false)}><span className="profile-avatar">{initials}</span><span><strong>{memberName || "Member"}</strong><small>Account settings</small></span></Link> : <div className="module-user"><span className="profile-avatar">{initials}</span><span><strong>{memberName || (cloudConfigured ? "Member" : "Local workspace")}</strong><small>{cloudConfigured ? "Signed out" : "Personal device"}</small></span></div>}
        </div>
      </aside>
      {menuOpen && <button className="module-scrim" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}
      <div className="module-main">
        <OnboardingTour />
        <header className="module-topbar">
          <div className="module-crumb"><button className="icon-button module-menu-trigger" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><Link href="/">Workspace</Link><span>/</span><strong>{title}</strong></div>
          <div className="module-top-actions"><button className="icon-button module-theme-toggle" onClick={toggleFocusMode} aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"} title={focusMode ? "Exit focus mode" : "Focus mode"}>{focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button><ThemeToggle className="module-theme-toggle" />{signedIn ? <button className="module-login-link" onClick={signOut}><LogOut size={15} /> Sign out</button> : <Link href="/login" className="module-login-link"><LogIn size={15} /> Sign in</Link>}<span className="profile-avatar">{initials}</span></div>
        </header>
        <main className="module-content">
          {!cloudConfigured && <div className="local-mode-banner"><span className="local-status" /><span><strong>Local workspace</strong> · Your learning, notes, and projects are saved on this device. Optional cloud accounts/sync can be enabled for society access.</span><Link href="/login">Account & sync options <ArrowLeft size={13} /></Link></div>}
          <div className="module-page-heading"><div className="module-page-icon"><Icon size={19} /></div><div><p>LEARNING WORKSPACE</p><h1>{title}</h1><span>{description}</span></div>{actions && <div className="module-page-actions">{actions}</div>}</div>
          {children}
          <footer className="module-footer"><span>Learning is a practice, not a race.</span><Link href="/">Back to overview</Link></footer>
        </main>
      </div>
    </div>
  );
}

export function Panel({ title, description, children, action, collapsible = true, defaultOpen = true }: { title: string; description?: string; children: ReactNode; action?: ReactNode; collapsible?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`module-panel ${collapsible ? "module-panel-collapsible" : ""} ${collapsible && !open ? "module-panel-collapsed" : ""}`}>
      <div className="module-panel-heading">
        <div>
          {collapsible ? <button type="button" className="module-panel-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}><ChevronDown size={16} className={open ? "" : "is-collapsed"} /><span><h2>{title}</h2>{description && <p>{description}</p>}</span></button> : <><h2>{title}</h2>{description && <p>{description}</p>}</>}
        </div>
        {action}
      </div>
      {(!collapsible || open) && children}
    </section>
  );
}
