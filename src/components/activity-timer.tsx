"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3, Coffee, GripVertical, Pause, Play, RotateCcw, Square, X } from "lucide-react";
import { readLocal, writeLocal, type StudySession } from "@/lib/local-data";
import { persistStudySession } from "@/lib/progress";

type Draft = {
  startedAt: string;
  seconds: number;
  running: boolean;
  category: StudySession["category"];
  lastActiveAt?: number;
  breaksTaken?: number;
  streakSeconds?: number;
};

const IDLE_LIMIT_MS = 90 * 1000;
const POMODORO_MS = 25 * 60;
const BREAK_SUGGEST_SECONDS = 5 * 60;
const KEY = "global-reading-timer";
const OPEN_KEY = "global-reading-timer-open";
const POS_KEY = "global-reading-timer-pos";

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
  const [category, setCategory] = useState<StudySession["category"]>("reading");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [breakSuggestion, setBreakSuggestion] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [breakLeft, setBreakLeft] = useState(0);
  const [showReflection, setShowReflection] = useState(false);
  const [reflection, setReflection] = useState("");
  const [humanConfirmed, setHumanConfirmed] = useState(false);
  const [reflectionError, setReflectionError] = useState("");

  const lastTick = useRef(0);
  const lastActivity = useRef(Date.now());
  const draftRef = useRef<Draft | null>(null);
  const secondsRef = useRef(0);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved?: boolean; pointerId: number; captured: boolean } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const didDragRef = useRef(false);
  const streakRef = useRef(0);
  const breakTickRef = useRef(0);

  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { secondsRef.current = seconds; }, [seconds]);

  useEffect(() => {
    setOpen(readLocal<boolean>(OPEN_KEY, false));
    const storedPos = readLocal<{ x: number; y: number } | null>(POS_KEY, null);
    if (storedPos && typeof storedPos.x === "number" && typeof storedPos.y === "number") setPos(storedPos);
    const stored = readLocal<Draft | null>(KEY, null);
    if (stored) {
      setDraft({ ...stored, running: false });
      setSeconds(stored.seconds || 0);
      setCategory(stored.category || "reading");
      streakRef.current = stored.streakSeconds || 0;
      setIdle(true);
    }
  }, []);

  const persistDraft = useCallback((value: Draft | null) => {
    if (value) writeLocal(KEY, value);
    else writeLocal(KEY, null);
  }, []);

  const markActive = useCallback(() => { lastActivity.current = Date.now(); }, []);

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

  // Work timer tick
  useEffect(() => {
    const tick = () => {
      const d = draftRef.current;
      if (!d?.running || onBreak) return;
      const now = Date.now();
      const prev = lastTick.current || now;
      lastTick.current = now;
      const delta = now - prev;
      const active = document.visibilityState === "visible" && now - lastActivity.current <= IDLE_LIMIT_MS;
      setIdle(!active);
      if (active && delta > 0 && delta <= 5000) {
        const add = Math.max(1, Math.round(delta / 1000));
        streakRef.current += add;
        if (streakRef.current >= POMODORO_MS) setBreakSuggestion(true);
        setSeconds((cur) => {
          const next = cur + add;
          const updated = { ...d, seconds: next, lastActiveAt: now, streakSeconds: streakRef.current };
          draftRef.current = updated;
          setDraft(updated);
          if (next % 10 < 2) persistDraft(updated);
          return next;
        });
      }
    };
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [persistDraft, onBreak]);

  // Break countdown tick
  useEffect(() => {
    if (!onBreak) return;
    breakTickRef.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const delta = Math.max(1, Math.round((now - breakTickRef.current) / 1000));
      breakTickRef.current = now;
      setBreakLeft((cur) => {
        const next = Math.max(0, cur - delta);
        if (next === 0) {
          setOnBreak(false);
          setBreakSuggestion(false);
          streakRef.current = 0;
          // resume timer automatically after break ends
          const d = draftRef.current;
          if (d) {
            const resumed = { ...d, running: true, streakSeconds: 0 };
            draftRef.current = resumed;
            setDraft(resumed);
            persistDraft(resumed);
            lastTick.current = Date.now();
            lastActivity.current = Date.now();
            setIdle(false);
          }
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [onBreak, persistDraft]);

  function toggleOpen() {
    if (didDragRef.current) { didDragRef.current = false; return; }
    setOpen((v) => { const next = !v; writeLocal(OPEN_KEY, next); return next; });
  }

  function start() {
    if (onBreak) { setOnBreak(false); setBreakLeft(0); }
    const next: Draft = { startedAt: draftRef.current?.startedAt || new Date().toISOString(), seconds: secondsRef.current || 0, running: true, category, lastActiveAt: Date.now(), breaksTaken: draftRef.current?.breaksTaken || 0, streakSeconds: streakRef.current };
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
    const next = { ...d, running: false, seconds: secondsRef.current, streakSeconds: streakRef.current };
    setDraft(next);
    draftRef.current = next;
    persistDraft(next);
    setIdle(true);
  }

  function startBreak() {
    const d = draftRef.current;
    if (d?.running) {
      const paused = { ...d, running: false, seconds: secondsRef.current, streakSeconds: streakRef.current, breaksTaken: (d.breaksTaken || 0) + 1 };
      setDraft(paused);
      draftRef.current = paused;
      persistDraft(paused);
    } else if (d) {
      const updated = { ...d, breaksTaken: (d.breaksTaken || 0) + 1 };
      setDraft(updated);
      draftRef.current = updated;
      persistDraft(updated);
    }
    setOnBreak(true);
    setBreakLeft(BREAK_SUGGEST_SECONDS);
    setBreakSuggestion(false);
    setIdle(true);
  }

  function skipBreak() {
    setOnBreak(false);
    setBreakLeft(0);
    setBreakSuggestion(false);
    streakRef.current = 0;
    const d = draftRef.current;
    if (d) {
      const updated = { ...d, streakSeconds: 0 };
      setDraft(updated);
      draftRef.current = updated;
      persistDraft(updated);
    }
  }

  function requestStop() {
    // Pause timer while reflecting
    const d = draftRef.current;
    if (d?.running) pause();
    setShowReflection(true);
    setReflectionError("");
  }

  function confirmStop() {
    const text = reflection.trim();
    if (text.length < 10) { setReflectionError("Please add a short reflection (at least 10 characters) about what you worked on."); return; }
    if (!humanConfirmed) { setReflectionError("Please confirm this work was done by you before saving the session."); return; }
    const d = draftRef.current;
    const secs = secondsRef.current;
    if (d && secs > 0) {
      const entry: StudySession = {
        id: crypto.randomUUID(),
        startedAt: d.startedAt,
        endedAt: new Date().toISOString(),
        seconds: secs,
        category: d.category || "reading",
        reflection: text,
        humanConfirmed: true,
        breaksTaken: d.breaksTaken || 0,
      };
      void persistStudySession(entry);
      setSavedMsg(`Saved ${formatDuration(secs)} ${entry.category} session.`);
      window.setTimeout(() => setSavedMsg(""), 5000);
    }
    setDraft(null);
    draftRef.current = null;
    setSeconds(0);
    secondsRef.current = 0;
    streakRef.current = 0;
    setIdle(false);
    setOnBreak(false);
    setBreakLeft(0);
    setBreakSuggestion(false);
    setShowReflection(false);
    setReflection("");
    setHumanConfirmed(false);
    setReflectionError("");
    persistDraft(null);
  }

  function cancelReflection() {
    setShowReflection(false);
    setReflectionError("");
  }

  function resetTimer() {
    setDraft(null);
    draftRef.current = null;
    setSeconds(0);
    secondsRef.current = 0;
    streakRef.current = 0;
    setIdle(false);
    setOnBreak(false);
    setBreakLeft(0);
    setBreakSuggestion(false);
    setShowReflection(false);
    setReflection("");
    setHumanConfirmed(false);
    setReflectionError("");
    persistDraft(null);
    setSavedMsg("");
  }

  const running = !!draft?.running;
  const activeTracking = running && !idle && !onBreak;

  function clampPos(x: number, y: number) {
    const el = rootRef.current;
    const w = el?.offsetWidth ?? 280;
    const h = el?.offsetHeight ?? 56;
    const maxX = Math.max(8, window.innerWidth - w - 8);
    const maxY = Math.max(8, window.innerHeight - h - 8);
    return { x: Math.min(maxX, Math.max(8, x)), y: Math.min(maxY, Math.max(8, y)) };
  }

  function onDragPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const inAction = target.closest(".activity-timer-actions button, .activity-timer-actions input, .activity-timer-actions select, .activity-timer-actions textarea, .activity-timer-actions a, .activity-timer-actions label, .timer-icon-btn, .timer-btn, .timer-reflection");
    if (inAction) return;
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: rect.left, originY: rect.top, moved: false, pointerId: e.pointerId, captured: false };
  }

  function onDragPointerMove(e: React.PointerEvent) {
    const d = dragRef.current as any;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    if (!d.captured) {
      try { (e.currentTarget as HTMLElement).setPointerCapture(d.pointerId); d.captured = true; } catch {}
    }
    d.moved = true;
    didDragRef.current = true;
    if (!dragging) setDragging(true);
    setPos(clampPos(d.originX + dx, d.originY + dy));
  }

  function onDragPointerUp(e: React.PointerEvent) {
    const d = dragRef.current as any;
    if (!d) return;
    const moved = !!d.moved;
    const captured = !!d.captured;
    dragRef.current = null;
    setDragging(false);
    if (moved) {
      setPos((cur) => { if (cur) writeLocal(POS_KEY, cur); return cur; });
      window.setTimeout(() => { didDragRef.current = false; }, 0);
    } else {
      didDragRef.current = false;
    }
    if (captured) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    }
  }

  function onDragPointerCancel() {
    const d = dragRef.current as any;
    if (!d) return;
    dragRef.current = null;
    setDragging(false);
    didDragRef.current = false;
  }

  const posStyle: React.CSSProperties = pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : {};

  return (
    <div ref={rootRef} className={`activity-timer-root ${open ? "activity-timer-open" : "activity-timer-collapsed"} ${dragging ? "is-dragging" : ""} ${pos ? "is-moved" : ""}`} style={posStyle} aria-live="polite" onPointerDown={onDragPointerDown} onPointerMove={onDragPointerMove} onPointerUp={onDragPointerUp} onPointerCancel={onDragPointerCancel}>
      {!open ? (
        <button className={`activity-timer-fab ${running ? "is-running" : ""} ${onBreak ? "is-break" : ""}`} onClick={toggleOpen} title="Activity timer" aria-label="Open activity timer">
          <Clock3 size={16} />
          {onBreak ? <span>Break {formatDuration(breakLeft)}</span> : running ? <span>{formatDuration(seconds)}</span> : <span>Timer</span>}
          {activeTracking && <i className="timer-live-dot" aria-hidden />}
        </button>
      ) : (
        <div className="activity-timer-bar" role="region" aria-label="Activity timer">
          <div className="timer-drag-handle" aria-hidden title="Drag to move"><GripVertical size={14} /></div>
          <div className="activity-timer-main">
            <span className={`timer-status-dot ${activeTracking ? "active" : onBreak ? "break" : running ? "paused" : "idle"}`} aria-hidden />
            <div className="activity-timer-info">
              <strong>{formatDuration(seconds)}</strong>
              <small>
                {onBreak ? `Break time — ${formatDuration(breakLeft)} left. Stretch, rest your eyes.` :
                 running ? (idle ? "Paused — move mouse/scroll/type to track active time" : `Tracking ${category} time`) :
                 seconds > 0 ? "Timer paused" : "Pick an activity, start timer, and stay active to track time"}
              </small>
            </div>
          </div>

          {breakSuggestion && !onBreak && !showReflection && (
            <div className="timer-break-suggest" role="status">
              <Coffee size={14} />
              <span>25 minutes of focus done. Take a 5-min break?</span>
              <button type="button" className="small-outline-button timer-btn" onClick={startBreak}>Take break</button>
              <button type="button" className="small-outline-button timer-btn" onClick={skipBreak}>Skip</button>
            </div>
          )}

          {showReflection ? (
            <div className="timer-reflection">
              <strong>Before saving — quick reflection</strong>
              <p className="module-muted">What did you work on? Write it in your own words. This helps keep your progress real and meaningful.</p>
              <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} rows={3} placeholder="e.g. I practiced linear regression, debugged my notebook, and summarized key formulas..." />
              <label className="timer-human-check">
                <input type="checkbox" checked={humanConfirmed} onChange={(e) => setHumanConfirmed(e.target.checked)} />
                <span>I confirm this work/reflection was done by me (not AI-generated).</span>
              </label>
              {reflectionError && <p className="timer-reflection-error" role="alert">{reflectionError}</p>}
              <div className="activity-timer-actions">
                <button type="button" className="primary-button timer-btn" onClick={confirmStop}>Save session</button>
                <button type="button" className="small-outline-button timer-btn" onClick={cancelReflection}>Back</button>
              </div>
            </div>
          ) : (
            <div className="activity-timer-actions">
              <label className="timer-category-label">
                <span className="sr-only">Activity type</span>
                <select className="timer-category-select" value={category} disabled={running || onBreak} onChange={(e) => { const c = e.target.value as StudySession["category"]; setCategory(c); const d = draftRef.current; if (d) { const next = { ...d, category: c }; setDraft(next); draftRef.current = next; persistDraft(next); } }}>
                  <option value="reading">Reading</option>
                  <option value="lesson">Lesson</option>
                  <option value="coding">Coding</option>
                  <option value="research">Research</option>
                </select>
              </label>
              {!running && !onBreak ? (
                <button className="small-outline-button timer-btn" onClick={start}><Play size={14} /> {seconds > 0 ? "Resume" : "Start"}</button>
              ) : running ? (
                <button className="small-outline-button timer-btn" onClick={pause}><Pause size={14} /> Pause</button>
              ) : (
                <button className="small-outline-button timer-btn" onClick={start}><Play size={14} /> Resume</button>
              )}
              <button className="small-outline-button timer-btn" onClick={onBreak ? skipBreak : startBreak} disabled={!draft && seconds === 0 && !running}><Coffee size={14} /> {onBreak ? "End break" : "Break"}</button>
              <button className="small-outline-button timer-btn" onClick={requestStop} disabled={!draft && seconds === 0}><Square size={14} /> Stop</button>
              <button className="icon-button timer-icon-btn" onClick={resetTimer} title="Reset timer" aria-label="Reset timer"><RotateCcw size={14} /></button>
              <button className="icon-button timer-icon-btn" onClick={toggleOpen} title="Minimize timer" aria-label="Minimize timer"><X size={14} /></button>
            </div>
          )}
          {savedMsg && <span className="timer-saved-msg">{savedMsg}</span>}
        </div>
      )}
    </div>
  );
}
