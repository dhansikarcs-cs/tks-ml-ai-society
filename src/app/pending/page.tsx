"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, Cloud, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/lib/theme";

export default function PendingPage() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    window.location.assign("/login");
  }

  return (
    <main className="account-page">
      <div className="account-top-row">
        <span className="account-brand-mini"><ShieldCheck size={15} /> TKS ML &amp; AI Society</span>
        <ThemeToggle className="account-theme-toggle" />
      </div>
      <section className="account-card pending-card">
        <span className="account-mark"><Clock3 size={19} /></span>
        <p className="account-eyebrow">MEMBERSHIP REVIEW</p>
        <h1>Approval pending</h1>
        <p>Your account is signed in, but access to the platform is restricted until an administrator approves your membership. This can’t be bypassed from the app.</p>

        <div className="pending-status-list" aria-label="What happens next">
          <div className="pending-status-item pending-done">
            <span><CheckCircle2 size={15} /></span>
            <div><strong>Account created &amp; signed in</strong><small>Your email, profile, and affiliation details are saved securely.</small></div>
          </div>
          <div className="pending-status-item pending-current">
            <span><Clock3 size={15} /></span>
            <div><strong>Waiting for administrator approval</strong><small>An administrator must approve your membership before you can enter the learning workspace.</small></div>
          </div>
          <div className="pending-status-item">
            <span><Cloud size={15} /></span>
            <div><strong>After approval: full access</strong><small>Curriculum, projects, resources, notebook, analytics, and synced progress become available.</small></div>
          </div>
          <div className="pending-status-item">
            <span><Sparkles size={15} /></span>
            <div><strong>AI assistant (if configured)</strong><small>Available to approved members when server AI is configured, or you can use your own key/local model in supported areas once approved.</small></div>
          </div>
        </div>

        <div className="pending-note">
          <ShieldCheck size={14} />
          <p><strong>What to do now:</strong> please wait for admin approval, then sign in again. If you think there’s an issue, contact the society administrator.</p>
        </div>

        <div className="pending-actions">
          <button type="button" className="account-primary pending-primary" onClick={signOut} disabled={busy}><LogOut size={15} /> {busy ? "Signing out…" : "Sign out"}</button>
          <button type="button" className="account-secondary" onClick={() => window.location.reload()}>Check approval status</button>
        </div>
      </section>
    </main>
  );
}
