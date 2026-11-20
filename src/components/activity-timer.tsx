"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3, Pause, Play, RotateCcw, Save, X } from "lucide-react";
import { readLocal, writeLocal, type StudySession } from "@/lib/local-data";
import { persistStudySession } from "@/lib/progress";

type Draft = {
  startedAt: string;
  seconds: number;
  running: boolean;
  category: StudySession["category"];
  lastActiveAt?: number;
};

const IDLE_LIMIT_MS = 90 * 1000;
const KEY = "global-reading-timer";
const OPEN_KEY = "global-reading-timer-open";

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function ActivityTimer() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [idle, setIdle] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const lastTick = useRef(0);
  const lastActivity = useRef(Date.now());
  const draftRef = useRef<Draft | null>(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  useEffect(() => {
    setOpen(readLocal<boolean>(OPEN_KEY, false));
    const stored = readLocal<Draft | null>(KEY, null);
    if (stored) {
      setDraft({ ...stored, running: false });
      setSeconds(stored.seconds || 0);
      setIdle(true);
    }
  }, []);

  const persistDraft = useCallback((value: Draft | null) => {
    if (value) writeLocal(KEY, value);
    else writeLocal(KEY, null);
  }, []);

  const markActive = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  useEffect(() => {
    window.addEventListener("pointerdown", markActive, { passive: true });
    window.addEventListener("pointermove", markActive, { passive: true });
    window.addEventListener("scroll", markActive, { passive: true, capture: true });
    window.addEventListener("keydown", markActive);
    window.addEventListener("touchstart", markActive, { passive: true });
    window.addEventListener("focus", markActive);
    return () => {
      window.removeEventListener("pointerdown", markActive);
      window.removeEventListener("pointermove", markActive);
      window.removeEventListener("scroll", markActive, true);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("touchstart", markActive);
      window.removeEventListener("focus", markActive);
    };
  }, [markActive]);

  useEffect(() => {
    const tick = () => {
      const d = draftRef.current;
      if (!d?.running) return;
      const now = Date.now();
      const prev = lastTick.current || now;
      lastTick.current = now;
      const delta = now - prev;
      const active = document.visibilityState === "visible" && now - lastActivity.current <= IDLE_LIMIT_MS;
      setIdle(!active);
      if (active && delta > 0 && delta <= 5000) {
        const add = Math.max(1, Math.round(delta / 1000));
        setSeconds((cur) => {
          const next = cur + add;
          const updated = { ...d, seconds: next, lastActiveAt: now };
          draftRef.current = updated;
          setDraft(updated);
          if (next % 10 < 2) persistDraft(updated);
          return next;
        });
      }
    };
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [persistDraft]);

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      writeLocal(OPEN_KEY, next);
      return next;
    });
  }

  function start() {
    const next: Draft = { startedAt: new Date().toISOString(), seconds: secondsRef.current || 0, running: true, category: "reading", lastActiveAt: Date.now() };
    lastTick.current = Date.now();
    lastActivity.current = Date.now();
    setIdle(false);
    setDraft(next);
    draftRef.current = next;
    persistDraft(next);
    setSavedMsg("");
  }

  function pause() {
    const d = draftRef.current;
    if (!d) return;
    const next = { ...d, running: false, seconds: secondsRef.current };
    setDraft(next);
    draftRef.current = next;
    persistDraft(next);
    setIdle(true);
  }

  function finish() {
    const d = draftRef.current;
    const secs = secondsRef.current;
    if (d && secs > 0) {
      const entry: StudySession = {
        id: crypto.randomUUID(),
        startedAt: d.startedAt,
        endedAt: new Date().toISOString(),
        seconds: secs,
        category: d.category || "reading",
      };
      void persistStudySession(entry);
      setSavedMsg(`Saved ${formatDuration(secs)} reading session.`);
      window.setTimeout(() => setSavedMsg(""), 4000);
    }
    setDraft(null);
    draftRef.current = null;
    setSeconds(0);
    secondsRef.current = 0;
    setIdle(false);
    persistDraft(null);
  }

  function resetTimer() {
    setDraft(null);
    draftRef.current = null;
    setSeconds(0);
    secondsRef.current = 0;
    setIdle(false);
    persistDraft(null);
    setSavedMsg("");
  }

  const running = !!draft?.running;
  const activeTracking = running && !idle;

  return (
    <div className={`activity-timer-root ${open ? "activity-timer-open" : "activity-timer-collapsed"}`} aria-live="polite">
      {!open ? (
        <button className={`activity-timer-fab ${running ? "is-running" : ""}`} onClick={toggleOpen} title="Reading/activity timer" aria-label="Open reading timer">
          <Clock3 size={16} />
          {running ? <span>{formatDuration(seconds)}</span> : <span>Timer</span>}
          {activeTracking && <i className="timer-live-dot" aria-hidden />}
        </button>
      ) : (
        <div className="activity-timer-bar" role="region" aria-label="Reading and activity timer">
          <div className="activity-timer-main">
            <span className={`timer-status-dot ${activeTracking ? "active" : running ? "paused" : "idle"}`} aria-hidden />
            <div className="activity-timer-info">
              <strong>{formatDuration(seconds)}</strong>
              <small>
                {running ? (idle ? "Paused — move mouse/scroll/type to track reading" : "Tracking active reading time") : seconds > 0 ? "Timer paused" : "Track reading time (counts only when you’re active)"}
              </small>
            </div>
          </div>
          <div className="activity-timer-actions">
            {!running ? (
              <button className="small-outline-button timer-btn" onClick={start}><Play size={14} /> {seconds > 0 ? "Resume" : "Start"}</button>
            ) : (
              <button className="small-outline-button timer-btn" onClick={pause}><Pause size={14} /> Pause</button>
            )}
            <button className="small-outline-button timer-btn" onClick={finish} disabled={!draft && seconds === 0}><Save size={14} /> Save</button>
            <button className="icon-button timer-icon-btn" onClick={resetTimer} title="Reset timer" aria-label="Reset timer"><RotateCcw size={14} /></button>
            <button className="icon-button timer-icon-btn" onClick={toggleOpen} title="Minimize timer" aria-label="Minimize timer"><X size={14} /></button>
          </div>
          {savedMsg && <span className="timer-saved-msg">{savedMsg}</span>}
        </div>
      )}
    </div>
  );
}
