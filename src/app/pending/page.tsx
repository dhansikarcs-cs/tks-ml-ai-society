import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, Cloud, ShieldCheck, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/lib/theme";

export default function PendingPage() {
  return (
    <main className="account-page">
      <div className="account-top-row">
        <Link href="/login" className="account-back"><ArrowLeft size={15} /> Back to sign in</Link>
        <ThemeToggle className="account-theme-toggle" />
      </div>
      <section className="account-card pending-card">
        <span className="account-mark"><Clock3 size={19} /></span>
        <p className="account-eyebrow">MEMBERSHIP REVIEW</p>
        <h1>You’re signed in — approval pending.</h1>
        <p>Your account was created successfully, but society cloud access is not active yet. A new membership must be approved by an administrator before protected member features are unlocked.</p>

        <div className="pending-status-list" aria-label="What happens next">
          <div className="pending-status-item pending-done">
            <span><CheckCircle2 size={15} /></span>
            <div><strong>Account created &amp; signed in</strong><small>Your credentials are verified and your profile exists.</small></div>
          </div>
          <div className="pending-status-item pending-current">
            <span><Clock3 size={15} /></span>
            <div><strong>Waiting for administrator approval</strong><small>An admin reviews your request and sets your membership to approved. This can’t be bypassed from the app.</small></div>
          </div>
          <div className="pending-status-item">
            <span><Cloud size={15} /></span>
            <div><strong>After approval: cloud features unlock</strong><small>Progress sync, cloud notes/projects/submissions, member resources, and society data become available when you sign in.</small></div>
          </div>
          <div className="pending-status-item">
            <span><Sparkles size={15} /></span>
            <div><strong>AI assistant (if configured)</strong><small>The assistant requires an approved account and server-side AI credentials. It stays unavailable until both are in place.</small></div>
          </div>
        </div>

        <div className="pending-note">
          <ShieldCheck size={14} />
          <p><strong>What you can do now:</strong> continue in the local workspace on this device. Local progress, sessions, projects, and notes stay in your browser and are not shared until you have an approved cloud account.</p>
        </div>

        <div className="pending-actions">
          <Link href="/" className="account-primary pending-primary">Continue in local workspace</Link>
          <Link href="/login" className="account-secondary">Sign in with another account</Link>
        </div>
      </section>
    </main>
  );
}
