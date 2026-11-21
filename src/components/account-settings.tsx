"use client";

import { FormEvent, useEffect, useState } from "react";
import { Compass, KeyRound, Save, ShieldCheck, UserRound } from "lucide-react";
import { ModuleShell, Panel } from "@/components/module-shell";
import { startOnboardingTour } from "@/components/onboarding-tour";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Profile = {
  display_name: string;
  username: string;
  affiliation: "tks" | "other" | "";
  organization_name: string;
  avatar_url: string;
  email: string;
};

export function AccountSettings() {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(configured);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<Profile>({ display_name: "", username: "", affiliation: "", organization_name: "", avatar_url: "", email: "" });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      setSignedIn(true);
      const { data } = await supabase.from("profiles").select("display_name,username,affiliation,organization_name,avatar_url").eq("id", user.id).maybeSingle();
      setProfile({
        display_name: data?.display_name || user.user_metadata?.display_name || "",
        username: data?.username || "",
        affiliation: (data?.affiliation === "tks" || data?.affiliation === "other") ? data.affiliation : "",
        organization_name: data?.organization_name || "",
        avatar_url: data?.avatar_url || "",
        email: user.email || "",
      });
      try { const cached = JSON.parse(sessionStorage.getItem("tks-member-shell") || "{}"); sessionStorage.setItem("tks-member-shell", JSON.stringify({ ...cached, signedIn: true, memberName: data?.display_name || user.email?.split("@")[0] || "Member" })); } catch {}
      setLoading(false);
    });
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setSaving(true); setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("Sign in to update your profile."); setSaving(false); return; }
    const payload = {
      display_name: profile.display_name.trim(),
      username: profile.username.trim() || null,
      affiliation: profile.affiliation || null,
      organization_name: profile.organization_name.trim() || null,
      avatar_url: profile.avatar_url.trim() || null,
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    if (error) {
      setMessage(error.message.includes("profiles_username_unique") ? "That username is already taken." : error.message);
    } else {
      await supabase.auth.updateUser({ data: { display_name: payload.display_name, username: payload.username } });
      setMessage("Profile updated.");
      try {
        const cached = JSON.parse(sessionStorage.getItem("tks-member-shell") || "{}");
        sessionStorage.setItem("tks-member-shell", JSON.stringify({ ...cached, memberName: payload.display_name || profile.email.split("@")[0] || "Member" }));
      } catch {}
    }
    setSaving(false);
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const form = event.currentTarget;
    const password = String(new FormData(form).get("password") || "");
    const confirm = String(new FormData(form).get("confirm") || "");
    if (password.length < 8) { setPasswordMessage("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setPasswordMessage("Passwords do not match."); return; }
    setSavingPassword(true); setPasswordMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setPasswordMessage(error ? error.message : "Password updated.");
    if (!error) form.reset();
    setSavingPassword(false);
  }

  return (
    <ModuleShell title="Account settings" description="Manage your profile, password, and account details." icon={UserRound}>
      {!configured ? (
        <Panel title="Account unavailable"><p className="panel-muted">Supabase is not configured for this deployment. Profile settings are available when cloud sign-in is enabled.</p></Panel>
      ) : loading ? (
        <Panel title="Loading"><p className="panel-muted">Loading your account…</p></Panel>
      ) : !signedIn ? (
        <Panel title="Sign in required"><p className="panel-muted">Sign in to manage your profile and password.</p></Panel>
      ) : (
        <div className="account-settings-grid">
          <Panel collapsible title="Profile" description="Your name and username are visible in society features where applicable.">
            <form className="admin-form account-settings-form" onSubmit={saveProfile}>
              <label>Email<input value={profile.email} disabled readOnly /></label>
              <label>Display name<input value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} maxLength={80} required /></label>
              <label>Username<input value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} minLength={3} maxLength={32} pattern="[A-Za-z0-9_.\-]+" title="3-32 characters: letters, numbers, underscore, dot, or hyphen" placeholder="e.g. alex_ml" /></label>
              <label>Affiliation
                <select value={profile.affiliation} onChange={(e) => setProfile({ ...profile, affiliation: e.target.value as Profile["affiliation"] })}>
                  <option value="">Select</option>
                  <option value="tks">TKS member</option>
                  <option value="other">Outside TKS</option>
                </select>
              </label>
              <label>Organization / school<input value={profile.organization_name} onChange={(e) => setProfile({ ...profile, organization_name: e.target.value })} maxLength={120} placeholder="Optional" /></label>
              <label>Profile photo URL<input value={profile.avatar_url} onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })} maxLength={500} placeholder="https://..." /></label>
              {profile.avatar_url && <div className="account-avatar-preview"><img src={profile.avatar_url} alt="Profile preview" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /></div>}
              {message && <p className="form-message" role="status">{message}</p>}
              <button className="primary-button" disabled={saving} type="submit"><Save size={15} /> {saving ? "Saving..." : "Save profile"}</button>
            </form>
          </Panel>
          <Panel collapsible title="Password" description="Change your account password. Use at least 8 characters.">
            <form className="admin-form account-settings-form" onSubmit={savePassword}>
              <label>New password<input name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
              <label>Confirm new password<input name="confirm" type="password" minLength={8} autoComplete="new-password" required /></label>
              {passwordMessage && <p className="form-message" role="status">{passwordMessage}</p>}
              <button className="primary-button" disabled={savingPassword} type="submit"><KeyRound size={15} /> {savingPassword ? "Updating..." : "Update password"}</button>
            </form>
            <div className="account-security" style={{marginTop:12}}><ShieldCheck size={14} /> Passwords are managed by Supabase Auth. Never share your password.</div>
          </Panel>
          <Panel collapsible title="Workspace tour" description="Revisit the quick tour of each tab and what it’s for.">
            <button className="small-outline-button" type="button" onClick={startOnboardingTour}><Compass size={14} /> Start workspace tour</button>
          </Panel>
        </div>
      )}
    </ModuleShell>
  );
}
