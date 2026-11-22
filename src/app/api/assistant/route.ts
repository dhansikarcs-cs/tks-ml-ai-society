import { NextResponse } from "next/server";
import { getWeek } from "@/lib/curriculum";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ConversationItem = { role: "user" | "assistant"; content: string };
const requestTimes = new Map<string, number[]>();

function providerConfigured() {
  return Boolean(process.env.AI_API_URL && process.env.AI_API_KEY && process.env.AI_MODEL);
}

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ ready: false, reason: "Cloud sign-in is required before the AI assistant can be used." });
  if (!providerConfigured()) return NextResponse.json({ ready: false, reason: "An administrator needs to configure an AI provider on the server." });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ ready: false, reason: "Cloud authentication is unavailable." });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ready: false, reason: "Sign in with an approved society account to use the assistant." });
  const { data: profile } = await supabase.from("profiles").select("membership_state").eq("id", user.id).maybeSingle();
  if (profile?.membership_state !== "approved") return NextResponse.json({ ready: false, reason: "AI assistance is available after membership approval." });
  return NextResponse.json({ ready: true, reason: null });
}

export async function POST(request: Request) {
  if (!providerConfigured()) return NextResponse.json({ error: "AI assistance is not configured yet." }, { status: 503 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Configure Supabase authentication before enabling AI assistance." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to use the learning assistant." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("membership_state").eq("id", user.id).maybeSingle();
  if (profile?.membership_state !== "approved") return NextResponse.json({ error: "AI assistance is available to approved members." }, { status: 403 });

  const now = Date.now();
  const recent = (requestTimes.get(user.id) ?? []).filter((timestamp) => now - timestamp < 60_000);
  if (recent.length >= 8) return NextResponse.json({ error: "You’re sending messages quickly. Please wait a minute and try again." }, { status: 429 });
  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= 50) return NextResponse.json({ error: "Your daily assistant quota is used up. Please try again tomorrow." }, { status: 429 });

  const raw = await request.text();
  if (raw.length > 30_000) return NextResponse.json({ error: "Conversation is too long. Start a new chat to continue." }, { status: 413 });
  let parsedBody: unknown;
  try { parsedBody = JSON.parse(raw) as unknown; }
  catch { return NextResponse.json({ error: "The message was not valid JSON." }, { status: 400 }); }
  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: "The request body must be an object." }, { status: 400 });
  }
  const body = parsedBody as { week?: number; messages?: ConversationItem[] };
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 14) {
    return NextResponse.json({ error: "Send between 1 and 14 recent messages." }, { status: 400 });
  }
  const safeMessages: ConversationItem[] = [];
  for (const item of messages) {
    if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string" || item.content.length > 5000) {
      return NextResponse.json({ error: "A message is invalid or too long." }, { status: 400 });
    }
    safeMessages.push({ role: item.role, content: item.content });
  }
  const week = Number.isInteger(body.week) ? getWeek(Number(body.week)) : undefined;
  const context = week
    ? `Current curriculum context: Week ${week.week}, "${week.title}". Summary: ${week.summary} Topics: ${week.topics.join(", ")}. Objectives: ${week.objectives.join("; ")}. Assignment: ${week.assignment}.`
    : "No specific curriculum week is selected.";
  const system = `You are the TKS ML & AI Society learning assistant. Explain accurately, patiently, and at the learner's level. Guide with questions and hints; do not provide a complete answer to an active assignment or assessment. Help the learner reason through it and ask them to explain their thinking. For code, explain errors and minimal fixes rather than replacing the whole project. Distinguish established facts from uncertainty. Never claim to have inspected a repository or file that was not supplied. Do not ask for secrets or personal sensitive data. Use Markdown and LaTeX where useful. ${context}`;

  try {
    const endpoint = new URL(process.env.AI_API_URL!);
    const isLocalDev = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(endpoint.hostname);
    if (endpoint.protocol !== "https:" && !isLocalDev) return NextResponse.json({ error: "The configured AI provider endpoint must use HTTPS." }, { status: 500 });
    requestTimes.set(user.id, [...recent, now]);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL,
        messages: [{ role: "system", content: system }, ...safeMessages],
        temperature: 0.4,
        max_tokens: 900,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const status = response.status;
      const detail = await response.text().catch(() => "");
      console.error("AI provider error", status, detail.slice(0, 300));
      return NextResponse.json({ error: status === 429 ? "The AI provider is busy. Try again shortly." : "The AI provider could not complete that request." }, { status: status === 429 ? 429 : 502 });
    }
    const result = await response.json() as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const answer = result.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) return NextResponse.json({ error: "The AI provider returned an empty response." }, { status: 502 });
    await supabase.from("ai_usage").insert({
      user_id: user.id,
      model: process.env.AI_MODEL!,
      input_tokens: result.usage?.prompt_tokens ?? 0,
      output_tokens: result.usage?.completion_tokens ?? 0,
    });
    return NextResponse.json({ answer });
  } catch (error) {
    console.error("AI assistant request failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The assistant is temporarily unavailable. Your conversation remains in this browser." }, { status: 502 });
  }
}
