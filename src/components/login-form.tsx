"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, BrainCircuit, Check, Clock3, LockKeyhole, Mail, ShieldCheck, UserCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { ThemeToggle } from "@/lib/theme";

export function LoginForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "recover" | "update">("sign-in");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const modeParam = new URLSearchParams(window.location.search).get("mode");
    if (modeParam === "update") setMode("update");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!configured) return setMessage("Cloud authentication is not configured. Use the local workspace or add Supabase credentials.");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const displayName = String(form.get("name") || "").trim();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    if (mode === "recover") {
      const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login?mode=update` });
      setBusy(false);
      setMessage(result.error?.message ?? "If an account exists for that email, password-reset instructions are on the way.");
      return;
    }
    if (mode === "update") {
      const result = await supabase.auth.updateUser({ password });
      setBusy(false);
      if (result.error) return setMessage(result.error.message);
      setMode("sign-in");
      setMessage("Password updated. Sign in with your new password.");
      return;
    }
    const result = mode === "sign-up"
      ? await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) return setMessage(result.error.message);
    if (mode === "sign-up") {
      const needsConfirmation = !result.data.session;
      setMessage(
        needsConfirmation
          ? "Account created. Check your email to confirm it, then sign in. After that, an administrator must approve your membership before cloud progress, projects, and AI access are unlocked."
          : "Account created. Your membership is now pending administrator approval — you’ll be taken to the waiting page."
      );
      if (!needsConfirmation) window.setTimeout(() => window.location.assign("/pending"), 900);
      return;
    }
    if (!result.data.user) return setMessage("The account could not be verified. Please try signing in again.");
    const { data: profile } = await supabase.from("profiles").select("membership_state").eq("id", result.data.user.id).maybeSingle();
    if (profile?.membership_state === "approved") {
      setMessage("Signed in. Taking you to your learning workspace…");
      window.location.assign("/");
    } else {
      setMessage("Signed in. Your membership is still pending approval — an administrator needs to approve it before cloud features are available.");
      window.location.assign("/pending");
    }
  }

  const steps = [
    { icon: Mail, title: "Create or sign in", body: mode === "sign-up" ? "Use your email and a password. If email confirmation is enabled, you’ll confirm your address first." : "Sign in with the email and password for your society account." },
    { icon: UserCheck, title: "Membership review", body: "New accounts start as pending. An administrator approves members before cloud data becomes available." },
    { icon: ShieldCheck, title: "Secure access", body: "Approved members can sync progress, notes, projects, and submissions. The AI assistant also requires an approved account and server configuration." },
    { icon: Clock3, title: "Local workspace", body: "No account? You can still use the full local workspace on this device; nothing is shared until you sign in." },
  ];

  return (
    <main className="account-page">
      <div className="account-top-row">
        <Link href="/" className="account-back"><ArrowLeft size={15} /> Back to workspace</Link>
        <ThemeToggle className="account-theme-toggle" />
      </div>
      <div className="account-layout">
      <section className="account-card">
        <span className="account-mark"><BrainCircuit size={19} /></span>
        <p className="account-eyebrow">TKS ML &amp; AI SOCIETY</p>
        <h1>{mode === "sign-in" ? "Welcome back." : mode === "sign-up" ? "Join the society." : mode === "recover" ? "Reset your password." : "Choose a new password."}</h1>
        <p>{mode === "sign-in" ? "Sign in to continue your learning journey." : mode === "sign-up" ? "Create an account to request membership access." : mode === "recover" ? "We’ll email you a secure link to reset your password." : "Set a new password for your society account."}</p>
        {!configured && (
          <div className="setup-callout">
            <LockKeyhole size={16} />
            <div><strong>Cloud sign-in needs setup</strong><span>Add Supabase URL and anon key to <code>.env.local</code>, then restart the app. The local workspace remains available without an account.</span></div>
          </div>
        )}
        <form className="account-form" onSubmit={submit}>
          {mode === "sign-up" && <label>Display name<input name="name" autoComplete="name" required placeholder="Your name" /></label>}
          {mode !== "update" && <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>}
          {mode !== "recover" && <label>Password<input name="password" type="password" minLength={8} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required placeholder="At least 8 characters" /></label>}
          {message && <p className="form-message" role="status">{message}</p>}
          <button className="account-primary" disabled={!configured || busy}>{busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Request membership" : mode === "recover" ? "Send reset link" : "Update password"} <ArrowRight size={15} /></button>
        </form>
        {mode === "sign-in" && <button className="account-forgot" onClick={() => { setMode("recover"); setMessage(""); }}>Forgot password?</button>}
        <button className="account-switch" onClick={() => { setMode(mode === "sign-up" || mode === "recover" || mode === "update" ? "sign-in" : "sign-up"); setMessage(""); }}>
          {mode === "sign-in" ? "New to the society? Request access" : mode === "sign-up" ? "Already have an account? Sign in" : "Back to sign in"}
        </button>
        <div className="account-security"><ShieldCheck size={14} /> Your membership data is protected by database access policies.</div>
      </section>

      <aside className="account-flow" aria-label="How sign-in works">
        <p className="account-flow-eyebrow">HOW IT WORKS</p>
        <h2>Signing in, step by step</h2>
        <ol className="account-flow-steps">
          {steps.map(({ icon: Icon, title, body }, index) => (
            <li key={title}>
              <span className="account-flow-icon">{mode === "sign-up" && index === 0 ? <Check size={15} /> : <Icon size={15} />}</span>
              <div><strong>{title}</strong><p>{body}</p></div>
            </li>
          ))}
        </ol>
        <div className="account-flow-note">
          <strong>After you sign in</strong>
          <p>Approved members go to the dashboard. Pending members go to a waiting page until an administrator approves the account. If cloud access isn’t configured yet, the app continues in local workspace mode.</p>
        </div>
      </aside>
      </div>
    </main>
  );
}
