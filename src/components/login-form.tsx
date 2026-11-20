"use client";

import { ArrowRight, BrainCircuit, Clock3, LockKeyhole, Mail, ShieldCheck, User, UserCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { ThemeToggle } from "@/lib/theme";

type Affiliation = "tks" | "other";

export function LoginForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "recover" | "update">("sign-up");
  const [affiliation, setAffiliation] = useState<Affiliation>("tks");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode");
    const code = params.get("code");
    const errorDescription = params.get("error_description") || params.get("error");
    if (modeParam === "update") setMode("update");
    if (errorDescription) {
      setMessage(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
      setMode("recover");
    }
    const supabase = createSupabaseBrowserClient();
    if (code && supabase) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) {
          setMode("update");
          setMessage("Verified. Choose a new password for your account.");
          window.history.replaceState({}, "", "/login?mode=update");
        } else {
          setMode("recover");
          setMessage("This reset link is invalid or has expired. Please request a new one.");
        }
      });
    }
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update");
        setMessage("Verified. Choose a new password for your account.");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!configured) return setMessage("Cloud authentication is not configured. Add Supabase credentials to enable sign-in.");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const displayName = String(form.get("name") || "").trim();
    const username = String(form.get("username") || "").trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    const organizationName = String(form.get("organization") || "").trim();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);

    if (mode === "recover") {
      if (!email) {
        setBusy(false);
        return setMessage("Enter the email address you used for your account.");
      }
      const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login?mode=update` });
      setBusy(false);
      if (result.error) return setMessage(result.error.message);
      setMessage("If an account exists for that email, we've sent a password reset link. Check your inbox and spam folder, then open the link to set a new password.");
      return;
    }

    if (mode === "update") {
      if (password.length < 8) {
        setBusy(false);
        return setMessage("Choose a password with at least 8 characters.");
      }
      const result = await supabase.auth.updateUser({ password });
      setBusy(false);
      if (result.error) return setMessage(result.error.message || "Could not update password. Your reset link may have expired—request a new one.");
      try { await supabase.auth.signOut(); } catch {}
      window.history.replaceState({}, "", "/login");
      setMode("sign-in");
      setMessage("Password updated successfully. Sign in with your new password.");
      return;
    }

    if (mode === "sign-up") {
      if (username.length < 3) {
        setBusy(false);
        return setMessage("Choose a username with at least 3 characters (letters, numbers, _ . -).");
      }
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            username,
            affiliation,
            organization_name: affiliation === "other" ? organizationName : "",
          },
        },
      });
      setBusy(false);
      if (result.error) return setMessage(result.error.message);
      const needsConfirmation = !result.data.session;
      setMessage(
        needsConfirmation
          ? "Account created. Check your email to confirm it, then sign in. After confirmation, an administrator must approve your membership before you can access the platform."
          : "Account created and signed in. Your membership is pending administrator approval."
      );
      if (!needsConfirmation) window.setTimeout(() => window.location.assign("/pending"), 1000);
      return;
    }

    const result = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) return setMessage(result.error.message);
    if (!result.data.user) return setMessage("The account could not be verified. Please try again.");

    const next = new URLSearchParams(window.location.search).get("next") || "/";
    const { data: profile } = await supabase.from("profiles").select("membership_state,role").eq("id", result.data.user.id).maybeSingle();
    if (profile?.membership_state === "approved") {
      setMessage("Signed in. Redirecting…");
      window.location.assign(profile.role === "admin" && next.startsWith("/admin") ? next : next.startsWith("/") ? next : "/");
    } else {
      setMessage("Signed in. Your membership is pending administrator approval.");
      window.location.assign("/pending");
    }
  }

  const steps = [
    { icon: Mail, title: "Create your account", body: mode === "sign-up" ? "Tell us if you’re from TKS or outside, then enter your name, username, email, and password." : "Sign in with your registered email and password." },
    { icon: UserCheck, title: "Admin approval", body: "New accounts start as pending. Only an administrator can approve access to the platform." },
    { icon: ShieldCheck, title: "Secure member access", body: "Once approved, you can use the curriculum, projects, resources, notebook, analytics, and (if configured) the AI assistant." },
    { icon: Clock3, title: "Email confirmation", body: "If email confirmation is enabled, you must confirm your email before signing in and waiting for approval." },
  ];

  return (
    <main className="account-page">
      <div className="account-top-row">
        <span className="account-brand-mini"><BrainCircuit size={16} /> TKS ML &amp; AI Society</span>
        <ThemeToggle className="account-theme-toggle" />
      </div>
      <div className="account-layout">
        <section className="account-card">
          <span className="account-mark"><BrainCircuit size={19} /></span>
          <p className="account-eyebrow">TKS ML &amp; AI SOCIETY</p>
          <h1>{mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create your account" : mode === "recover" ? "Reset password" : "Set a new password"}</h1>
          <p>{mode === "sign-in" ? "Use your registered email and password to continue." : mode === "sign-up" ? "Register with your details to request access. Membership requires administrator approval before you can use the platform." : mode === "recover" ? "Enter your account email and we’ll send a secure link to set a new password." : "Enter a new password for your account (at least 8 characters)."}</p>

          {!configured && (
            <div className="setup-callout">
              <LockKeyhole size={16} />
              <div><strong>Sign-in unavailable</strong><span>Supabase authentication is not configured for this deployment. Contact the administrator to enable access.</span></div>
            </div>
          )}

          <form className="account-form" onSubmit={submit}>
            {mode === "sign-up" && (
              <>
                <fieldset className="affiliation-fieldset">
                  <legend>Are you from TKS?</legend>
                  <div className="affiliation-options">
                    <label className={`affiliation-option ${affiliation === "tks" ? "affiliation-active" : ""}`}>
                      <input type="radio" name="affiliation" value="tks" checked={affiliation === "tks"} onChange={() => setAffiliation("tks")} />
                      <span><strong>TKS member</strong><small>I’m part of The Knowledge Society</small></span>
                    </label>
                    <label className={`affiliation-option ${affiliation === "other" ? "affiliation-active" : ""}`}>
                      <input type="radio" name="affiliation" value="other" checked={affiliation === "other"} onChange={() => setAffiliation("other")} />
                      <span><strong>Outside TKS</strong><small>I’m joining from another community or independently</small></span>
                    </label>
                  </div>
                </fieldset>
                <label>Full name<input name="name" autoComplete="name" required placeholder="Your full name" maxLength={80} /></label>
                <label>Username<input name="username" autoComplete="username" required placeholder="e.g. alex_ml" minLength={3} maxLength={32} pattern="[A-Za-z0-9_.\-]+" title="3–32 characters: letters, numbers, underscore, dot, or hyphen" /></label>
                {affiliation === "other" && <label>Organization / school <span className="field-optional">(optional)</span><input name="organization" autoComplete="organization" placeholder="Where are you from?" maxLength={120} /></label>}
              </>
            )}

            {mode !== "update" && <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>}
            {mode !== "recover" && <label>Password<input name="password" type="password" minLength={8} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required placeholder="At least 8 characters" /></label>}

            {message && <p className="form-message" role="status">{message}</p>}
            <button className="account-primary" disabled={!configured || busy}>{busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Request access" : mode === "recover" ? "Send reset link" : "Update password"} <ArrowRight size={15} /></button>
          </form>

          {mode === "sign-in" && <button type="button" className="account-forgot" onClick={() => { setMode("recover"); setMessage(""); }}>Forgot your password?</button>}
          <button className="account-switch" onClick={() => { setMode(mode === "sign-up" || mode === "recover" || mode === "update" ? "sign-in" : "sign-up"); setMessage(""); setAffiliation("tks"); }}>
            {mode === "sign-in" ? "New here? Create an account" : mode === "sign-up" ? "Already have an account? Sign in" : "Back to sign in"}
          </button>
          <div className="account-security"><ShieldCheck size={14} /> Accounts are protected by secure authentication and access policies.</div>
        </section>

        <aside className="account-flow" aria-label="How access works">
          <p className="account-flow-eyebrow">HOW ACCESS WORKS</p>
          <h2>Sign in &amp; approval</h2>
          <ol className="account-flow-steps">
            {steps.map(({ icon: Icon, title, body }, index) => (
              <li key={title}>
                <span className="account-flow-icon">{mode === "sign-up" && index === 0 ? <User size={15} /> : <Icon size={15} />}</span>
                <div><strong>{title}</strong><p>{body}</p></div>
              </li>
            ))}
          </ol>
          <div className="account-flow-note">
            <strong>After you sign in</strong>
            <p>Approved members are taken to the learning platform. If your membership is still pending, you’ll see a waiting page until an administrator approves your account. This platform requires a signed-in, approved account.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
