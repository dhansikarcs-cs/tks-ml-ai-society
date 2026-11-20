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
