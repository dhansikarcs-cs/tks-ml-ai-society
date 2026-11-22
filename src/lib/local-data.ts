export type Note = {
  id: string;
  title: string;
  body: string;
  folder: string;
  tags: string[];
  week: number | null;
  pinned: boolean;
  updatedAt: string;
};

export type StudySession = {
  id: string;
  startedAt: string;
  endedAt: string;
  seconds: number;
  category: "lesson" | "reading" | "coding" | "research";
  reflection?: string;
  humanConfirmed?: boolean;
  breaksTaken?: number;
};

export type Project = {
  id: string;
  title: string;
  description: string;
  week: number | null;
  repository: string;
  reflection: string;
  status: "planning" | "in_progress" | "submitted";
  milestones: { title: string; done: boolean }[];
  updatedAt: string;
};

const PREFIX = "tks-society:";

export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("tks-local-data", { detail: { key } }));
}

export function readAllLocal(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const data: Record<string, unknown> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const full = window.localStorage.key(i);
    if (!full || !full.startsWith(PREFIX)) continue;
    const key = full.slice(PREFIX.length);
    // Skip transient/sensitive-ish sync internals if desired? keep all local workspace data for portability.
    try {
      const raw = window.localStorage.getItem(full);
      data[key] = raw ? JSON.parse(raw) : null;
    } catch {
      data[key] = window.localStorage.getItem(full);
    }
  }
  return data;
}

export function writeAllLocal(data: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  for (const [key, value] of Object.entries(data)) {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // ignore individual key failures
    }
  }
  window.dispatchEvent(new CustomEvent("tks-local-data", { detail: { key: "*" } }));
}

export type WorkspaceBackup = {
  version: 1;
  exportedAt: string;
  localStorage: Record<string, unknown>;
  notes: Note[];
};

export async function exportWorkspaceBackup(): Promise<WorkspaceBackup> {
  const notes = await loadNotes().catch(() => [] as Note[]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    localStorage: readAllLocal(),
    notes,
  };
}

export async function importWorkspaceBackup(backup: WorkspaceBackup) {
  if (!backup || backup.version !== 1) throw new Error("Unsupported backup file.");
  if (backup.localStorage && typeof backup.localStorage === "object") {
    writeAllLocal(backup.localStorage as Record<string, unknown>);
  }
  if (Array.isArray(backup.notes)) {
    for (const note of backup.notes) {
      if (note && typeof note.id === "string") await saveNote(note as Note);
    }
  }
  window.dispatchEvent(new CustomEvent("tks-local-data", { detail: { key: "*" } }));
}

export function loadNotes(): Promise<Note[]> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return resolve([]);
    const request = indexedDB.open("tks-society-notebook", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("notes", { keyPath: "id" });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("notes", "readonly");
      const get = tx.objectStore("notes").getAll();
      get.onsuccess = () => resolve((get.result as Note[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      get.onerror = () => reject(get.error);
      tx.oncomplete = () => db.close();
    };
  });
}

export function saveNote(note: Note): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is unavailable in this browser."));
    const request = indexedDB.open("tks-society-notebook", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("notes", { keyPath: "id" });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("notes", "readwrite");
      tx.objectStore("notes").put(note);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}

export function removeNote(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is unavailable in this browser."));
    const request = indexedDB.open("tks-society-notebook", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("notes", { keyPath: "id" });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("notes", "readwrite");
      tx.objectStore("notes").delete(id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}
