"use client";

import { FormEvent, useEffect, useState } from "react";
import { CircleHelp, LifeBuoy, MessageSquareWarning, Send } from "lucide-react";
import { ModuleShell, Panel } from "@/components/module-shell";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type SupportRequest = {
  id: string;
  category: "help" | "bug" | "complaint" | "feedback" | "other";
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

const categories = [
  { value: "help", label: "Help / question" },
  { value: "bug", label: "Bug report" },
  { value: "complaint", label: "Complaint" },
  { value: "feedback", label: "Feedback" },
  { value: "other", label: "Other" },
] as const;

export function HelpCenter() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const configured = isSupabaseConfigured();

  async function load() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("support_requests")
      .select("id,category,subject,message,status,admin_note,created_at,updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRequests((data ?? []) as SupportRequest[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const subject = String(form.get("subject") || "").trim();
    const body = String(form.get("message") || "").trim();
    const category = String(form.get("category") || "help");
    if (subject.length < 3) return setMessage("Please enter a short subject (at least 3 characters).");
    if (body.length < 10) return setMessage("Please describe your request in a bit more detail (at least 10 characters).");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setMessage("Sign-in is required to submit a request.");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setMessage("Please sign in to submit a request.");
    setBusy(true);
    const { error } = await supabase.from("support_requests").insert({
      user_id: user.id,
      category,
      subject,
      message: body,
      status: "open",
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    formEl.reset();
    setMessage("Your request was sent to the administrator. Only you and the admin can see it.");
    void load();
  }

  const statusLabel: Record<SupportRequest["status"], string> = {
    open: "Open",
    in_progress: "In progress",
    resolved: "Resolved",
  };

  return (
    <ModuleShell title="Help center" description="Report a bug, raise a complaint, or ask for help. Your requests are private and visible only to you and the administrator." icon={LifeBuoy}>
      <div className="help-layout">
        <Panel collapsible title="Send a request" description="Be specific so the admin can help you quickly. Include what you were trying to do and what went wrong.">
          {!configured ? (
            <p className="module-muted">Help requests are a society feature and require a signed-in member account. For local learning, you can continue using all workspace tools on this device.</p>
          ) : (
            <form className="admin-form help-form" onSubmit={submit}>
              <label>Category
                <select name="category" defaultValue="help" aria-label="Request category">
                  {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label>Subject<input name="subject" required minLength={3} maxLength={160} placeholder="Short summary" /></label>
              <label>Details<textarea name="message" required minLength={10} maxLength={5000} rows={6} placeholder="Describe the issue, complaint, or help you need…" /></label>
              <button className="primary-button module-action-button" disabled={busy}><Send size={14} /> {busy ? "Sending…" : "Submit request"}</button>
              {message && <p className="module-status-message" role="status">{message}</p>}
            </form>
          )}
        </Panel>

        <Panel collapsible title="Your requests" description="Track the status of requests you’ve submitted.">
          {loading ? <p className="module-muted">Loading your requests…</p> : requests.length ? (
            <div className="help-request-list">
              {requests.map((req) => (
                <article key={req.id} className="help-request-card">
                  <div className="help-request-head">
                    <span className={`member-state member-${req.status === "resolved" ? "approved" : req.status === "in_progress" ? "pending" : "denied"}`}>{statusLabel[req.status]}</span>
                    <span className="help-request-meta">{req.category} · {new Date(req.created_at).toLocaleString()}</span>
                  </div>
                  <strong>{req.subject}</strong>
                  <p>{req.message}</p>
                  {req.admin_note && <div className="help-admin-reply"><MessageSquareWarning size={14} /><div><small>Admin response</small><p>{req.admin_note}</p></div></div>}
                </article>
              ))}
            </div>
          ) : (
            <div className="module-empty compact"><CircleHelp size={28} /><strong>No requests yet</strong><span>If you find a bug, have a complaint, or need help, submit a request and the admin will review it.</span></div>
          )}
        </Panel>
      </div>
    </ModuleShell>
  );
}
