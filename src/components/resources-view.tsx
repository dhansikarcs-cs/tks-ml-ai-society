"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, Check, ExternalLink, FileText, MonitorPlay, Search, StickyNote, Trophy, Video, X } from "lucide-react";
import { curriculum, type Resource } from "@/lib/curriculum";
import { readLocal, writeLocal } from "@/lib/local-data";
import { ModuleShell, Panel } from "@/components/module-shell";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LibraryResource = Resource & { weeks: number[] };
const resources: LibraryResource[] = (() => {
  const grouped = new Map<string, LibraryResource>();
  for (const week of curriculum) for (const resource of week.resources) {
    const current = grouped.get(resource.url);
    if (current) current.weeks.push(week.week);
    else grouped.set(resource.url, { ...resource, weeks: [week.week] });
  }
  return Array.from(grouped.values());
})();

export function ResourcesView() {
  const [resourceData, setResourceData] = useState(resources);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("All types");
  const [weekFilter, setWeekFilter] = useState("All weeks");
  const [savedOnly, setSavedOnly] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [completedResources, setCompletedResources] = useState<string[]>([]);
  const [resourcePoints, setResourcePoints] = useState(0);
  const [resourceNotes, setResourceNotes] = useState<Record<string, string>>({});
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [viewer, setViewer] = useState<LibraryResource | null>(null);
  useEffect(() => {
    setBookmarks(readLocal("resource-bookmarks", []));
    const completed = readLocal<string[]>("resource-completed", []);
    setCompletedResources(completed);
    setResourcePoints(readLocal<number>("resource-points", completed.length));
    setResourceNotes(readLocal("resource-notes", {}));
    const params = new URLSearchParams(window.location.search);
    if (params.has("week")) setWeekFilter(params.get("week")!);
    const supabase = createSupabaseBrowserClient();
    if (supabase) void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("membership_state").eq("id", user.id).maybeSingle();
      if (profile?.membership_state !== "approved") return;
      const { data } = await supabase.from("resources").select("title,url,kind,note,week_id");
      if (!data?.length) return;
      const grouped = new Map<string, LibraryResource>(resources.map((resource) => [resource.url, { ...resource, weeks: [...resource.weeks] }]));
      for (const resource of data) {
        const week = Number(resource.week_id);
        const existing = grouped.get(resource.url);
        if (existing) {
          existing.title = resource.title;
          existing.kind = resource.kind as Resource["kind"];
          existing.note = resource.note ?? undefined;
          if (week && !existing.weeks.includes(week)) existing.weeks.push(week);
        } else grouped.set(resource.url, { title: resource.title, url: resource.url, kind: resource.kind as Resource["kind"], note: resource.note ?? undefined, weeks: week ? [week] : [] });
      }
      setResourceData(Array.from(grouped.values()));
    })();
  }, []);

  const types = ["All types", ...Array.from(new Set(resourceData.map((resource) => resource.kind)))];
  const filtered = useMemo(() => resourceData.filter((resource) => {
    const weekTitles = resource.weeks
      .map((week) => curriculum[week - 1]?.title)
      .filter((title): title is string => Boolean(title));
    const text = `${resource.title} ${resource.kind} ${resource.note ?? ""} ${weekTitles.join(" ")}`.toLowerCase();
    const matchesQuery = text.includes(query.trim().toLowerCase());
    const matchesKind = kind === "All types" || resource.kind === kind;
    const matchesWeek = weekFilter === "All weeks" || resource.weeks.includes(Number(weekFilter));
    const matchesSaved = !savedOnly || bookmarks.includes(resource.url);
    return matchesQuery && matchesKind && matchesWeek && matchesSaved;
  }), [resourceData, query, kind, weekFilter, savedOnly, bookmarks]);

  function toggleBookmark(url: string) {
    setBookmarks((current) => {
      const next = current.includes(url) ? current.filter((item) => item !== url) : [...current, url];
      writeLocal("resource-bookmarks", next);
      return next;
    });
  }

  function toggleCompleted(url: string) {
    setCompletedResources((current) => {
      const already = current.includes(url);
      const next = already ? current.filter((item) => item !== url) : [...current, url];
      writeLocal("resource-completed", next);
      if (!already) {
        setResourcePoints((prev) => {
          const awarded = prev + 1;
          writeLocal("resource-points", awarded);
          return awarded;
        });
      }
      return next;
    });
  }

  function updateResourceNote(url: string, note: string) {
    setResourceNotes((current) => {
      const next = { ...current, [url]: note };
      writeLocal("resource-notes", next);
      return next;
    });
  }

  const completedCount = completedResources.length;

  return <ModuleShell title="Resource library" description="A curated shelf of lectures, documentation, papers, and repositories connected to the curriculum." icon={FileText}>
    <div className="resource-library-summary">
      <div><span className="summary-icon purple-icon"><BookOpenIcon /></span><span><strong>{resourceData.length} curated resources</strong><small>{completedCount} read · {resourcePoints} point{resourcePoints === 1 ? "" : "s"} earned · across 24 weeks</small></span></div>
      <button className={`small-outline-button ${savedOnly ? "filter-active" : ""}`} onClick={() => setSavedOnly((current) => !current)}><Bookmark size={14} fill={savedOnly ? "currentColor" : "none"} /> Saved resources <span>{bookmarks.length}</span></button>
    </div>
    <Panel title="Find a resource" description="Resources are selected to complement each week's learning. View them in-app when possible and use the bottom timer to track active reading time.">
      <div className="resource-filters">
        <label className="module-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, topics, or providers…" /><kbd>{filtered.length}</kbd></label>
        <select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Filter by resource type">{types.map((type) => <option key={type}>{type}</option>)}</select>
        <select value={weekFilter} onChange={(event) => setWeekFilter(event.target.value)} aria-label="Filter by curriculum week"><option>All weeks</option>{curriculum.map((week) => <option value={week.week} key={week.week}>Week {String(week.week).padStart(2, "0")} · {week.title}</option>)}</select>
      </div>
      {filtered.length ? <div className="resource-library-grid">{filtered.map((resource) => <article key={resource.url} className="library-resource-card">
        <div className="library-card-top"><span className={`library-type-icon ${resource.kind.toLowerCase()}`}>{resource.kind === "Video" ? <Video size={16} /> : <FileText size={16} />}</span><span className="library-kind-label">{resource.kind}</span><button className={`bookmark-button ${bookmarks.includes(resource.url) ? "is-bookmarked" : ""}`} onClick={() => toggleBookmark(resource.url)} aria-label={bookmarks.includes(resource.url) ? "Remove bookmark" : "Bookmark resource"}><Bookmark size={16} fill={bookmarks.includes(resource.url) ? "currentColor" : "none"} /></button></div>
        <h3>{resource.title}</h3><p>{resource.note ?? `Curated ${resource.kind.toLowerCase()} for your machine learning journey.`}</p>
        <div className="library-week-tags">{resource.weeks.map((week) => <Link key={week} href={`/curriculum?week=${week}`}>Week {String(week).padStart(2, "0")}</Link>)}</div>
        <ResourceActions resource={resource} done={completedResources.includes(resource.url)} noteOpen={openNote === resource.url} note={resourceNotes[resource.url] ?? ""} onDone={() => toggleCompleted(resource.url)} onToggleNote={() => setOpenNote((current) => current === resource.url ? null : resource.url)} onNote={(value) => updateResourceNote(resource.url, value)} onView={() => setViewer(resource)} />
      </article>)}</div> : <div className="module-empty"><Search size={22} /><strong>No resources match these filters</strong><span>Adjust your search or select a different resource type.</span><button className="text-button" onClick={() => { setQuery(""); setKind("All types"); setWeekFilter("All weeks"); setSavedOnly(false); }}>Clear filters <ArrowRight size={13} /></button></div>}
    </Panel>
    <div className="resource-safety-note"><Trophy size={14} /><span>Mark resources as read to earn points. Use the bottom <strong>Timer</strong> to track active reading time (it counts only when you’re interacting). Some external sites block in-app embedding — if a resource can’t load inside the tab, use “Open externally”.</span></div>
    {viewer && <ResourceViewer resource={viewer} onClose={() => setViewer(null)} onDone={() => { if (!completedResources.includes(viewer.url)) toggleCompleted(viewer.url); }} done={completedResources.includes(viewer.url)} />}
  </ModuleShell>;
}

function BookOpenIcon() { return <FileText size={17} />; }

function ResourceActions({ resource, done, noteOpen, note, onDone, onToggleNote, onNote, onView }: {
  resource: LibraryResource; done: boolean; noteOpen: boolean; note: string;
  onDone: () => void; onToggleNote: () => void; onNote: (value: string) => void; onView: () => void;
}) {
  const videoId = getYoutubeId(resource.url);
  const [embed, setEmbed] = useState(false);
  return <>
    <div className="resource-card-actions">
      <button className="resource-complete-button resource-view-tab" onClick={onView}><MonitorPlay size={12} /> View in tab</button>
      <a className="resource-open-link" href={resource.url} target="_blank" rel="noopener noreferrer">Open <ExternalLink size={13} /></a>
      <button className={`resource-complete-button ${done ? "resource-done" : ""}`} onClick={onDone}>{done ? <><Check size={12} /> Read (+1)</> : "Mark read (+1)"}</button>
      {videoId && <button className="resource-complete-button" onClick={() => setEmbed((current) => !current)}>{embed ? "Hide video" : "Preview"}</button>}
      <button className="resource-note-button" onClick={onToggleNote} aria-label="Add a private resource note"><StickyNote size={14} /></button>
    </div>
    {embed && videoId && <div className="resource-video-embed"><iframe src={`https://www.youtube-nocookie.com/embed/${videoId}`} title={resource.title} referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>}
    {noteOpen && <label className="resource-note-field"><span>Private note · saved in this browser</span><textarea rows={2} value={note} onChange={(event) => onNote(event.target.value)} placeholder="A thought or takeaway…" /></label>}
  </>;
}

function ResourceViewer({ resource, onClose, onDone, done }: { resource: LibraryResource; onClose: () => void; onDone: () => void; done: boolean }) {
  const videoId = getYoutubeId(resource.url);
  const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : resource.url;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return <div className="resource-viewer-overlay" role="dialog" aria-modal="true" aria-label={`Viewing ${resource.title}`}>
    <div className="resource-viewer-header">
      <div className="resource-viewer-title"><span className="library-kind-label">{resource.kind}</span><strong>{resource.title}</strong></div>
      <div className="resource-viewer-actions">
        <button className={`small-outline-button ${done ? "filter-active" : ""}`} onClick={onDone}>{done ? <><Check size={14} /> Read (+1 point)</> : "Mark read (+1 point)"}</button>
        <a className="small-outline-button" href={resource.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open externally</a>
        <button className="icon-button" onClick={onClose} aria-label="Close viewer"><X size={16} /></button>
      </div>
    </div>
    <div className="resource-viewer-hint">Reading inside this tab. Use the bottom <strong>Timer</strong> to track active time (counts only while you move mouse/scroll/type). If the site blocks embedding, use “Open externally”.</div>
    <div className="resource-viewer-frame-wrap">
      <iframe src={embedUrl} title={resource.title} className="resource-viewer-frame" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox" />
    </div>
  </div>;
}

function getYoutubeId(value: string) {
  try {
    const url = new URL(value);
    let id = "";
    if (url.hostname === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] ?? "";
    } else return null;
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
