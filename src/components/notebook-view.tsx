"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  ArrowDownToLine, ArrowLeftRight, Check, Cloud, Download, FilePlus2, Folder, Link2,
  Pin, Plus, Search, Trash2, TriangleAlert, Upload,
} from "lucide-react";
import { ModuleShell, Panel } from "@/components/module-shell";
import { curriculum } from "@/lib/curriculum";
import { exportWorkspaceBackup, importWorkspaceBackup, loadNotes, readLocal, removeNote, saveNote, writeLocal, type Note, type WorkspaceBackup } from "@/lib/local-data";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Conflict = { id: string; local: Note; cloud: Record<string, unknown> };
const emptyNote = (): Note => ({ id: crypto.randomUUID(), title: "", body: "", folder: "General", tags: [], week: null, pinned: false, updatedAt: new Date().toISOString() });

export function NotebookView() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState("All notes");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [saveStatus, setSaveStatus] = useState<"loading" | "saved" | "saving" | "error">("loading");
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [syncMessage, setSyncMessage] = useState("");
  const [dirtyNotes, setDirtyNotes] = useState<Set<string>>(() => new Set());
  const configured = isSupabaseConfigured();
  const selected = notes.find((note) => note.id === selectedId) ?? null;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const selectedTagList = selected?.tags.join(",") ?? "";
  const selectedDirty = selected ? dirtyNotes.has(selected.id) : false;

  useEffect(() => {
    loadNotes().then((items) => {
      setNotes(items);
      setSelectedId(items[0]?.id ?? null);
      setSaveStatus("saved");
    }).catch(() => { setSaveStatus("error"); setError("Your browser could not open local notebook storage. Export any text you need before refreshing."); });
  }, []);

  useEffect(() => {
    const note = selectedRef.current;
    if (!note || !selectedDirty) return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      const current = selectedRef.current;
      if (!current || current.id !== note.id) return;
      const updated = { ...current, updatedAt: new Date().toISOString() };
      saveNote(updated).then(() => {
        setNotes((current) => current.map((note) => note.id === updated.id ? updated : note).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
        setDirtyNotes((current) => { const next = new Set(current); next.delete(updated.id); return next; });
        setSaveStatus("saved");
      }).catch(() => { setSaveStatus("error"); setError("Autosave failed. Download your note as Markdown to keep a recovery copy."); });
    }, 750);
    return () => window.clearTimeout(timer);
  }, [selected?.id, selected?.title, selected?.body, selected?.pinned, selected?.week, selectedTagList, selectedDirty]);

  const visibleNotes = useMemo(() => notes
    .filter((note) => (folderFilter === "All notes" || (folderFilter === "Pinned" ? note.pinned : (note.folder || "General") === folderFilter)) && `${note.title} ${note.body} ${note.tags.join(" ")} ${note.folder ?? "General"}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)), [notes, search, folderFilter]);
  const folders = Array.from(new Set(notes.map((note) => note.folder || "General")));

  function updateSelected(patch: Partial<Note>) {
    if (!selected) return;
    setNotes((current) => current.map((note) => note.id === selected.id ? { ...note, ...patch } : note));
    setDirtyNotes((current) => new Set(current).add(selected.id));
  }

  async function flushSelected() {
    if (!selected || !dirtyNotes.has(selected.id)) return;
    const updated = { ...selected, updatedAt: new Date().toISOString() };
    await saveNote(updated);
    setNotes((current) => current.map((note) => note.id === updated.id ? updated : note));
    setDirtyNotes((current) => { const next = new Set(current); next.delete(updated.id); return next; });
    setSaveStatus("saved");
  }

  async function selectNote(id: string) {
    await flushSelected();
    setSelectedId(id);
  }

  async function createNote() {
    await flushSelected();
    const note = emptyNote();
    try {
      await saveNote(note);
      setNotes((current) => [note, ...current]);
      setSelectedId(note.id);
      setMode("edit");
      setSaveStatus("saved");
    } catch {
      setError("Could not create a note in local storage.");
    }
  }

  async function deleteSelected() {
    if (!selected || !window.confirm(`Delete “${selected.title || "Untitled note"}” from this device? This cannot be undone.`)) return;
    const tombstones = readLocal<string[]>("notebook-deleted-ids", []);
    writeLocal("notebook-deleted-ids", Array.from(new Set([...tombstones, selected.id])));
    try { await removeNote(selected.id); }
    catch {
      setError("Could not delete this note from local storage.");
      return;
    }
    const remaining = notes.filter((note) => note.id !== selected.id);
    setNotes(remaining);
    setSelectedId(remaining[0]?.id ?? null);
  }

  function exportNote() {
    if (!selected) return;
    const content = `# ${selected.title || "Untitled note"}\n\n${selected.body}\n\n---\nTags: ${selected.tags.join(", ")}\n`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(selected.title || "note").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function exportAllNotes() {
    const all = await loadNotes();
    if (!all.length) { setSyncMessage("No notes to export yet."); return; }
    const content = all.map((note) => `# ${note.title || "Untitled note"}\n\n${note.body}\n\n---\nFolder: ${note.folder || "General"}\nTags: ${note.tags.join(", ")}\nUpdated: ${note.updatedAt}\n`).join("\n\n====================\n\n");
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "tks-notes-backup.md";
    anchor.click();
    URL.revokeObjectURL(url);
    setSyncMessage("All notes exported as Markdown. Save it to your preferred drive or cloud.");
  }

  async function downloadWorkspaceBackup() {
    try {
      const backup = await exportWorkspaceBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `tks-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setSyncMessage("Workspace backup downloaded (notes, progress, projects, and local data). Store it in your preferred drive or cloud.");
    } catch {
      setSyncMessage("Could not create a backup. Try exporting the current note as Markdown.");
    }
  }

  async function importWorkspaceBackupFile(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as WorkspaceBackup;
      if (!parsed || parsed.version !== 1) { setSyncMessage("That file is not a supported TKS workspace backup."); return; }
      if (!window.confirm("Import this backup? Local data and notes with matching IDs will be updated/added on this device.")) return;
      await importWorkspaceBackup(parsed);
      const items = await loadNotes();
      setNotes(items);
      setSelectedId(items[0]?.id ?? null);
      setSaveStatus("saved");
      setSyncMessage("Backup imported on this device. Your local workspace data has been restored/merged.");
    } catch {
      setSyncMessage("Could not import that backup file. Make sure it is a valid TKS backup JSON.");
    }
  }

  async function syncCloud() {
    try { await flushSelected(); }
    catch { setSyncMessage("Save the current note locally before syncing."); return; }
    setSyncMessage("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setSyncMessage("Cloud sync needs Supabase credentials. Your notes remain available in this browser.");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setSyncMessage("Sign in to sync notes. Local notes stay on this device.");
    const { data: profile } = await supabase.from("profiles").select("membership_state").eq("id", user.id).maybeSingle();
    if (profile?.membership_state !== "approved") return setSyncMessage("Cloud sync is available after membership approval.");
    const tombstones = readLocal<string[]>("notebook-deleted-ids", []);
    for (const id of tombstones) {
      const { error: deleteError } = await supabase.from("notes").delete().eq("id", id).eq("user_id", user.id);
      if (deleteError) return setSyncMessage(`A deleted note could not be removed from the cloud: ${deleteError.message}`);
    }
    if (tombstones.length) {
      writeLocal("notebook-deleted-ids", []);
      const priorBase = JSON.parse(localStorage.getItem("tks-society:notebook-sync-base") || "{}") as Record<string, string>;
      for (const id of tombstones) delete priorBase[id];
      localStorage.setItem("tks-society:notebook-sync-base", JSON.stringify(priorBase));
    }
    const { data: cloudNotes, error: pullError } = await supabase.from("notes").select("*").eq("user_id", user.id);
    if (pullError) return setSyncMessage(`Sync could not read cloud notes: ${pullError.message}`);
    const local = await loadNotes();
    const localById = new Map(local.map((note) => [note.id, note]));
    const base = JSON.parse(localStorage.getItem("tks-society:notebook-sync-base") || "{}") as Record<string, string>;
    const foundConflicts: Conflict[] = [];
    const merged = [...local];
    for (const row of cloudNotes ?? []) {
      const cloud = row as Record<string, unknown>;
      const id = String(cloud.id);
      const localNote = localById.get(id);
      if (!localNote) {
        const note: Note = { id, title: String(cloud.title ?? ""), body: String(cloud.body ?? ""), folder: String(cloud.folder ?? "General"), tags: (cloud.tags as string[]) ?? [], week: cloud.week_id ? Number(cloud.week_id) : null, pinned: Boolean(cloud.pinned), updatedAt: String(cloud.updated_at) };
        await saveNote(note); merged.push(note); base[id] = note.updatedAt;
      } else if (localNote.updatedAt !== String(cloud.updated_at)) {
        const baseTime = base[id];
        if (baseTime && localNote.updatedAt !== baseTime && String(cloud.updated_at) !== baseTime) {
          foundConflicts.push({ id, local: localNote, cloud });
        } else if (new Date(localNote.updatedAt) > new Date(String(cloud.updated_at))) {
      const { error: pushError } = await supabase.from("notes").upsert({ id: localNote.id, title: localNote.title, body: localNote.body, folder: localNote.folder || "General", tags: localNote.tags, user_id: user.id, week_id: localNote.week, pinned: localNote.pinned, updated_at: localNote.updatedAt, explicitly_shared: false });
          if (pushError) return setSyncMessage(`A note could not be uploaded: ${pushError.message}`);
          base[id] = localNote.updatedAt;
        } else {
        const note: Note = { id, title: String(cloud.title ?? ""), body: String(cloud.body ?? ""), folder: String(cloud.folder ?? "General"), tags: (cloud.tags as string[]) ?? [], week: cloud.week_id ? Number(cloud.week_id) : null, pinned: Boolean(cloud.pinned), updatedAt: String(cloud.updated_at) };
          await saveNote(note);
          const index = merged.findIndex((item) => item.id === id);
          if (index >= 0) merged[index] = note;
          base[id] = note.updatedAt;
        }
      }
    }
    for (const note of local) {
      if (!(cloudNotes ?? []).some((row) => (row as { id?: string }).id === note.id)) {
        const { error: pushError } = await supabase.from("notes").upsert({ id: note.id, title: note.title, body: note.body, folder: note.folder || "General", tags: note.tags, user_id: user.id, week_id: note.week, pinned: note.pinned, updated_at: note.updatedAt, explicitly_shared: false });
        if (pushError) return setSyncMessage(`A note could not be uploaded: ${pushError.message}`);
        base[note.id] = note.updatedAt;
      }
    }
    setNotes(merged);
    setConflicts(foundConflicts);
    localStorage.setItem("tks-society:notebook-sync-base", JSON.stringify(base));
    setSyncMessage(foundConflicts.length ? `${foundConflicts.length} note conflict${foundConflicts.length === 1 ? "" : "s"} need your choice below.` : "Notebook synced. Your private notes remain private.");
  }

  async function resolveConflict(conflict: Conflict, choice: "local" | "cloud") {
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase!.auth.getUser();
    if (choice === "local") {
      const { error: pushError } = await supabase!.from("notes").upsert({ id: conflict.local.id, title: conflict.local.title, body: conflict.local.body, folder: conflict.local.folder || "General", tags: conflict.local.tags, user_id: user!.id, week_id: conflict.local.week, pinned: conflict.local.pinned, updated_at: conflict.local.updatedAt, explicitly_shared: false });
      if (pushError) return setSyncMessage(pushError.message);
    } else {
      const cloud = conflict.cloud;
      const note: Note = { id: conflict.id, title: String(cloud.title ?? ""), body: String(cloud.body ?? ""), folder: String(cloud.folder ?? "General"), tags: (cloud.tags as string[]) ?? [], week: cloud.week_id ? Number(cloud.week_id) : null, pinned: Boolean(cloud.pinned), updatedAt: String(cloud.updated_at) };
      try { await saveNote(note); }
      catch {
        setSyncMessage("Could not restore the cloud copy into local storage.");
        return;
      }
      setNotes((current) => current.map((item) => item.id === note.id ? note : item));
    }
    const remaining = conflicts.filter((item) => item.id !== conflict.id);
    setConflicts(remaining);
    const base = JSON.parse(localStorage.getItem("tks-society:notebook-sync-base") || "{}");
    base[conflict.id] = choice === "local" ? conflict.local.updatedAt : String(conflict.cloud.updated_at);
    localStorage.setItem("tks-society:notebook-sync-base", JSON.stringify(base));
    setSyncMessage(remaining.length ? `${remaining.length} conflict(s) remain.` : "Conflict resolved. Sync again to verify.");
  }

  return <ModuleShell title="Research notebook" description="Local-first notes for your technical learning, experiments, and research." icon={Folder}
    actions={<button className="small-outline-button" onClick={syncCloud}><ArrowLeftRight size={14} /> Sync</button>}>
    <div className="notebook-layout">
      <aside className="notebook-sidebar">
        <div className="notebook-list-heading"><div><h2>My notes</h2><span>{notes.length} on this device</span></div><button className="new-note-button" onClick={createNote} aria-label="Create a new note"><Plus size={16} /></button></div>
        <label className="module-search notebook-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a note…" /></label>
        <div className="notebook-folders"><button className={folderFilter === "All notes" ? "folder-filter-active" : ""} onClick={() => setFolderFilter("All notes")}><Folder size={14} /> All notes <b>{notes.length}</b></button><button className={folderFilter === "Pinned" ? "folder-filter-active" : ""} onClick={() => setFolderFilter("Pinned")}><Pin size={14} /> Pinned <b>{notes.filter((note) => note.pinned).length}</b></button>{folders.map((folder) => <button key={folder} className={folderFilter === folder ? "folder-filter-active" : ""} onClick={() => setFolderFilter(folder)}><Folder size={13} /> {folder}</button>)}</div>
        <div className="note-list">{visibleNotes.map((note) => <button key={note.id} className={`note-list-item ${selectedId === note.id ? "note-selected" : ""}`} onClick={() => void selectNote(note.id)}><strong>{note.title || "Untitled note"}{note.pinned && <Pin size={11} />}</strong><span>{note.body.replace(/[#*_`$\n]/g, " ").slice(0, 55) || "No content yet"}</span><small>{new Date(note.updatedAt).toLocaleDateString()}</small></button>)}
          {visibleNotes.length === 0 && <div className="note-list-empty">{notes.length ? "No notes match that search." : "Your notebook starts with a blank page."}</div>}
        </div>
        <div className="notebook-local-status"><span className="local-status" /> Saved locally in IndexedDB</div>
      </aside>
      <section className="notebook-editor">
        {selected ? <>
          <div className="notebook-toolbar">
            <div className={`autosave-status autosave-${saveStatus}`}>{saveStatus === "saved" ? <Check size={13} /> : saveStatus === "error" ? <TriangleAlert size={13} /> : <span className="saving-spinner" />}{saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Save issue" : saveStatus === "loading" ? "Loading…" : "Saving…"}</div>
            <div className="notebook-actions"><button className={`icon-text-button ${selected.pinned ? "pinned-action" : ""}`} onClick={() => updateSelected({ pinned: !selected.pinned })}><Pin size={14} /> {selected.pinned ? "Pinned" : "Pin"}</button><button className="icon-text-button" onClick={exportNote}><ArrowDownToLine size={14} /> Export note</button><button className="icon-text-button delete-action" onClick={deleteSelected} aria-label="Delete note"><Trash2 size={14} /></button></div>
          </div>
          <input className="note-title-input" value={selected.title} onChange={(event) => updateSelected({ title: event.target.value })} placeholder="Untitled note" aria-label="Note title" />
          <div className="note-meta-controls"><label>Folder <input value={selected.folder ?? "General"} maxLength={48} onChange={(event) => updateSelected({ folder: event.target.value || "General" })} placeholder="General" /></label><label>Week <select value={selected.week ?? ""} onChange={(event) => updateSelected({ week: event.target.value ? Number(event.target.value) : null })}><option value="">Unlinked</option>{curriculum.map((week) => <option key={week.week} value={week.week}>Week {week.week}: {week.title}</option>)}</select></label><label>Tags <input value={selected.tags.join(", ")} onChange={(event) => updateSelected({ tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} placeholder="e.g. linear algebra, ideas" /></label></div>
          <div className="note-editor-tabs"><button className={mode === "edit" ? "note-tab-active" : ""} onClick={() => setMode("edit")}>Write</button><button className={mode === "preview" ? "note-tab-active" : ""} onClick={() => setMode("preview")}>Preview</button><span><Link2 size={13} /> Markdown + LaTeX supported</span></div>
          {mode === "edit" ? <textarea className="note-body-input" value={selected.body} onChange={(event) => updateSelected({ body: event.target.value })} placeholder={"Capture a concept, experiment, or question…\n\nMarkdown: **bold**, `code`\nMath: $\\nabla_\\theta L(\\theta)$"} aria-label="Note content" /> : <div className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{selected.body || "_Nothing to preview yet._"}</ReactMarkdown></div>}
          {error && <p className="notebook-error">{error}</p>}
          {syncMessage && <p className="sync-message"><Cloud size={14} /> {syncMessage}</p>}
          {conflicts.length > 0 && <div className="conflict-list"><h3>Choose which version to keep</h3>{conflicts.map((conflict) => <div className="conflict-card" key={conflict.id}><strong>{conflict.local.title || "Untitled note"}</strong><p>Your local and cloud copies both changed since the last sync.</p><button onClick={() => resolveConflict(conflict, "local")}>Keep this device</button><button onClick={() => resolveConflict(conflict, "cloud")}>Keep cloud copy</button></div>)}</div>}
          <div className="notebook-editor-footer"><span>Private by default · {configured ? "Cloud sync is optional" : "Cloud sync not configured"}</span><span>Updated {new Date(selected.updatedAt).toLocaleString()}</span></div>
        </> : <div className="notebook-welcome"><span><FilePlus2 size={23} /></span><h2>A space for working ideas.</h2><p>Keep notes, equations, code snippets, and questions connected to your learning journey.</p><button className="primary-button" onClick={createNote}><Plus size={15} /> Create your first note</button></div>}
      </section>
    </div>
    <Panel collapsible title="Local-first notes & backup" description="Your notes and learning data are stored on this device. Back them up to your preferred drive or cloud anytime.">
      <div className="backup-actions">
        <button className="small-outline-button" onClick={() => void exportAllNotes()}><Download size={14} /> Export all notes (Markdown)</button>
        <button className="small-outline-button" onClick={() => void downloadWorkspaceBackup()}><ArrowDownToLine size={14} /> Download workspace backup</button>
        <label className="small-outline-button backup-import-label"><Upload size={14} /> Import backup<input type="file" accept="application/json,.json" className="sr-only-input" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importWorkspaceBackupFile(file); e.currentTarget.value = ""; }} /></label>
      </div>
      <p className="module-muted">“Workspace backup” includes notes, curriculum progress, projects/analyses, resource saves, and other local workspace data. Save the file to Google Drive, OneDrive, iCloud, or any storage you prefer. Cloud sync to the society workspace is optional and requires an approved account.</p>
    </Panel>
  </ModuleShell>;
}
