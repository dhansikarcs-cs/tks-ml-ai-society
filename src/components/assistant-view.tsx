"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ArrowUp, Bot, BookOpen, Check, CircleHelp, KeyRound, Plus, Server, Settings2, Sparkles, TriangleAlert, UserRound } from "lucide-react";
import { ModuleShell } from "@/components/module-shell";
import { CollapsibleBlock } from "@/components/collapsible";
import { curriculum } from "@/lib/curriculum";
import { readLocal, writeLocal } from "@/lib/local-data";

type Message = { role: "user" | "assistant"; content: string };
type ProviderMode = "server" | "custom";
type CustomProvider = { mode: ProviderMode; url: string; key: string; model: string };

const PROVIDER_KEY = "assistant-provider";
const promptIdeas = [
  "Explain this concept using an intuitive example.",
  "Give me a hint for my current assignment—don’t solve it.",
  "Help me understand the math behind this algorithm.",
  "Ask me three questions to check my understanding.",
];

const defaultProvider: CustomProvider = {
  mode: "server",
  url: "https://api.groq.com/openai/v1/chat/completions",
  key: "",
  model: "llama-3.3-70b-versatile",
};

function loadProvider(): CustomProvider {
  if (typeof window === "undefined") return defaultProvider;
  try {
    const raw = window.localStorage.getItem(PROVIDER_KEY);
    if (!raw) return defaultProvider;
    const parsed = JSON.parse(raw) as Partial<CustomProvider>;
    return {
      mode: parsed.mode === "custom" ? "custom" : "server",
      url: typeof parsed.url === "string" && parsed.url ? parsed.url : defaultProvider.url,
      key: typeof parsed.key === "string" ? parsed.key : "",
      model: typeof parsed.model === "string" && parsed.model ? parsed.model : defaultProvider.model,
    };
  } catch {
    return defaultProvider;
  }
}

function buildSystem(week: number) {
  const info = curriculum[week - 1];
  const context = info
    ? `Current curriculum context: Week ${info.week}, "${info.title}". Summary: ${info.summary} Topics: ${info.topics.join(", ")}. Objectives: ${info.objectives.join("; ")}. Assignment: ${info.assignment}.`
    : "No specific curriculum week is selected.";
  return `You are the TKS ML & AI Society learning assistant. Explain accurately, patiently, and at the learner's level. Guide with questions and hints; do not provide a complete answer to an active assignment or assessment. Help the learner reason through it and ask them to explain their thinking. For code, explain errors and minimal fixes rather than replacing the whole project. Distinguish established facts from uncertainty. Never claim to have inspected a repository or file that was not supplied. Do not ask for secrets or personal sensitive data. Use Markdown and LaTeX where useful. ${context}`;
}

export function AssistantView() {
  const [serverReady, setServerReady] = useState(false);
  const [serverReason, setServerReason] = useState("Checking assistant availability…");
  const [provider, setProvider] = useState<CustomProvider>(defaultProvider);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [week, setWeek] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const weekInfo = curriculum[week - 1];

  const customReady = provider.mode === "custom" && Boolean(provider.url.trim() && provider.model.trim());
  const ready = provider.mode === "server" ? serverReady : customReady;

  useEffect(() => {
    fetch("/api/assistant")
      .then((response) => response.json())
      .then((data: { ready: boolean; reason: string }) => {
        setServerReady(data.ready);
        setServerReason(data.reason ?? "");
      })
      .catch(() => setServerReason("The assistant service could not be reached."));
    setMessages(readLocal<Message[]>("assistant-history", []));
    setProvider(loadProvider());
  }, []);

  useEffect(() => {
    writeLocal("assistant-history", messages);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function updateProvider(next: CustomProvider) {
    setProvider(next);
    try { window.localStorage.setItem(PROVIDER_KEY, JSON.stringify(next)); } catch {}
  }

  function newConversation() {
    setMessages([]);
    setError("");
    writeLocal("assistant-history", []);
  }

  async function send(event?: FormEvent, suggested?: string) {
    event?.preventDefault();
    const text = (suggested ?? input).trim();
    if (!text || busy || !ready) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setError("");
    setBusy(true);
    try {
      let answer = "";
      if (provider.mode === "custom") {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (provider.key.trim()) headers.Authorization = `Bearer ${provider.key.trim()}`;
        const response = await fetch(provider.url.trim(), {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: provider.model.trim(),
            messages: [{ role: "system", content: buildSystem(week) }, ...next.slice(-14)],
            temperature: 0.4,
            max_tokens: 900,
          }),
        });
        const data = await response.json().catch(() => ({})) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } | string };
        if (!response.ok) {
          const msg = typeof data.error === "string" ? data.error : data.error?.message;
          throw new Error(msg || `The provider could not complete that request (${response.status}).`);
        }
        answer = data.choices?.[0]?.message?.content ?? "";
        if (!answer.trim()) throw new Error("The provider returned an empty response.");
      } else {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ week, messages: next.slice(-14) }),
        });
        const data = await response.json() as { answer?: string; error?: string };
        if (!response.ok) throw new Error(data.error ?? "The assistant could not respond.");
        answer = data.answer ?? "";
      }
      setMessages((current) => [...current, { role: "assistant", content: answer }]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The assistant could not respond.";
      if (provider.mode === "custom" && caught instanceof TypeError) {
        setError("Could not reach that provider from the browser (network/CORS error). For a local server like Ollama, allow browser access/CORS and use an OpenAI-compatible endpoint.");
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = provider.mode === "custom"
    ? (customReady ? `Custom provider · ${provider.model}` : "Set a custom provider endpoint and model")
    : (serverReady ? "Available via society server" : "Waiting for server configuration");

  return <ModuleShell title="AI learning assistant" description="Guided explanations and hints, grounded in the learning path." icon={Sparkles}
    actions={<><button className="small-outline-button" onClick={() => setShowSettings((v) => !v)}><Settings2 size={14} /> Provider</button><button className="small-outline-button" onClick={newConversation}><Plus size={14} /> New conversation</button></>}>
    {!ready && <div className="assistant-unavailable"><span><TriangleAlert size={17} /></span><div><strong>Assistant unavailable</strong><p>{provider.mode === "server" ? (serverReason || "Configure an AI provider and approved member authentication to enable the assistant.") : "Add a custom API endpoint and model in Provider settings to use your own or a local AI."} The rest of the workspace remains available.</p>{provider.mode === "server" && <p style={{marginTop:8}}><button type="button" className="text-button" onClick={() => setShowSettings(true)}>Use your own AI instead</button> - add your API key in Provider settings (stored only in this browser), or ask an admin to configure the server AI.</p>}</div><span className="assistant-config-badge">{provider.mode === "custom" ? "Custom setup needed" : "Not configured"}</span></div>}
    <div className="assistant-layout">
      <section className="assistant-chat-panel">
        <div className="assistant-chat-header"><div><span className="assistant-bot-avatar"><Bot size={17} /></span><span><strong>Society learning guide</strong><small>{statusLabel}</small></span></div><label>Lesson context<select value={week} onChange={(event) => setWeek(Number(event.target.value))}>{curriculum.map((item) => <option key={item.week} value={item.week}>Week {item.week} · {item.title}</option>)}</select></label></div>
        <div className="assistant-message-list">
          {messages.length === 0 ? <div className="assistant-welcome"><span className="assistant-large-icon"><Sparkles size={23} /></span><h2>What are you working through?</h2><p>I’ll help you build understanding, not skip the learning.</p><div className="suggested-prompt-grid">{promptIdeas.map((prompt) => <button key={prompt} disabled={!ready} onClick={() => send(undefined, prompt)}>{prompt}<ArrowUp size={13} /></button>)}</div></div> : messages.map((message, index) => <article className={`assistant-message message-${message.role}`} key={`${index}-${message.role}`}><span className="message-avatar">{message.role === "assistant" ? <Bot size={15} /> : <UserRound size={15} />}</span><div><small>{message.role === "assistant" ? "Learning guide" : "You"}</small>{message.role === "assistant" ? <div className="assistant-markdown"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{message.content}</ReactMarkdown></div> : <p>{message.content}</p>}</div></article>)}
          {busy && <div className="assistant-typing"><span /><span /><span /> Working through that…</div>}
          <div ref={bottomRef} />
        </div>
        {error && <p className="assistant-error" role="alert"><CircleHelp size={14} />{error}</p>}
        <form className="assistant-composer" onSubmit={send}><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={ready ? "Ask about a concept, code, or paper…" : "Choose a provider to start a conversation"} rows={2} disabled={!ready || busy} maxLength={5000} aria-label="Message the learning assistant" /><div><span>Enter to send · Shift+Enter for a new line</span><button type="submit" disabled={!ready || busy || !input.trim()} aria-label="Send message"><ArrowUp size={17} /></button></div></form>
        <p className="assistant-disclaimer"><Check size={13} /> AI can make mistakes. Verify important claims and never share private or sensitive data.</p>
      </section>
      <aside className="assistant-context-column">
        {showSettings && <div className="assistant-context-card assistant-provider-card"><span className="context-icon"><Settings2 size={16} /></span><span className="context-label">PROVIDER SETTINGS</span><h3>Choose how AI runs</h3>
          <div className="provider-mode-toggle">
            <button type="button" className={provider.mode === "server" ? "provider-mode-active" : ""} onClick={() => updateProvider({ ...provider, mode: "server" })}><Server size={13} /> Society server</button>
            <button type="button" className={provider.mode === "custom" ? "provider-mode-active" : ""} onClick={() => updateProvider({ ...provider, mode: "custom" })}><KeyRound size={13} /> Custom / local</button>
          </div>
          {provider.mode === "server" ? <div className="provider-help"><p>Uses the society server AI (shared for approved members). Admin setup: set <code>AI_API_URL</code>, <code>AI_API_KEY</code>, <code>AI_MODEL</code> in server env (Groq defaults are prefilled in <code>.env.production.example</code>; add your key).</p><p style={{marginTop:8}}><strong>Want to use your own AI now?</strong> Switch to <strong>Custom / local</strong> - your key stays in your browser only.</p></div> : <div className="provider-fields">
            <div className="provider-help"><p><strong>Add your own AI (private to your browser):</strong></p><ol style={{margin:"8px 0 0",paddingLeft:18,lineHeight:1.7}}><li>Pick a preset below (Groq/Grok/OpenRouter/local Ollama) or enter any OpenAI-compatible endpoint.</li><li>Paste your API key (not needed for some local servers).</li><li>Set the model name and start chatting. Settings are stored only in this browser; requests go directly to your provider.</li></ol><p style={{marginTop:8}}>Local AI: install <a href="https://ollama.com" target="_blank" rel="noreferrer">Ollama</a>, run <code>ollama run llama3.2</code>, and allow browser CORS if needed.</p></div>
            <label>API endpoint<input value={provider.url} onChange={(e) => updateProvider({ ...provider, url: e.target.value })} placeholder="https://api.x.ai/v1/chat/completions" /></label>
            <label>API key <small>(optional for some local servers)</small><input type="password" value={provider.key} onChange={(e) => updateProvider({ ...provider, key: e.target.value })} placeholder="Paste your key" autoComplete="off" /></label>
            <label>Model<input value={provider.model} onChange={(e) => updateProvider({ ...provider, model: e.target.value })} placeholder="grok-2-latest" /></label>
            <div className="provider-presets">
              <button type="button" className="text-button" onClick={() => updateProvider({ ...provider, mode: "custom", url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile" })}>Use Groq (free tier)</button>
              <button type="button" className="text-button" onClick={() => updateProvider({ ...provider, mode: "custom", url: "https://api.x.ai/v1/chat/completions", model: "grok-2-latest" })}>Use Grok (xAI)</button>
              <button type="button" className="text-button" onClick={() => updateProvider({ ...provider, mode: "custom", url: "http://localhost:11434/v1/chat/completions", model: "llama3.2", key: "" })}>Use local Ollama</button>
              <button type="button" className="text-button" onClick={() => updateProvider({ ...provider, mode: "custom", url: "https://openrouter.ai/api/v1/chat/completions", model: "meta-llama/llama-3.3-70b-instruct:free" })}>Use OpenRouter (free)</button>
            </div>
          </div>}
        </div>}
        <CollapsibleBlock className="assistant-collapsible" title={<span>Current context</span>}>
          <div className="assistant-context-card"><span className="context-icon"><BookOpen size={16} /></span><span className="context-label">CURRENT CONTEXT</span><h3>Week {week}: {weekInfo.title}</h3><p>{weekInfo.summary}</p><ul>{weekInfo.objectives.slice(0, 3).map((objective) => <li key={objective}>{objective}</li>)}</ul></div>
        </CollapsibleBlock>
        <CollapsibleBlock className="assistant-collapsible" title={<span>Tips & history</span>}>
          <div className="assistant-context-note"><Sparkles size={15} /><p>Ask for a hint, an analogy, or a small next step. The assistant is instructed not to give complete assessment answers.</p></div>
          <div className="assistant-history-note"><strong>Conversation history</strong><span>Kept only in this browser. Clear it anytime with "New conversation".</span></div>
        </CollapsibleBlock>
      </aside>
    </div>
  </ModuleShell>;
}