import { NextResponse } from "next/server";

type NewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
};

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function extractTag(block: string, tag: string) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!m) return "";
  return decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim());
}

function parseRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemBlocks = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];
  for (const block of itemBlocks) {
    const rawTitle = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate");
    const source = extractTag(block, "source");
    // Google News titles often end with " - Source"
    let title = rawTitle;
    let src = source;
    const sep = rawTitle.lastIndexOf(" - ");
    if (sep > 0) {
      if (!src) src = rawTitle.slice(sep + 3).trim();
      title = rawTitle.slice(0, sep).trim();
    }
    if (!title || !link) continue;
    items.push({
      title,
      link,
      source: src || "News",
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
    });
    if (items.length >= 8) break;
  }
  return items;
}

export async function GET() {
  const url =
    "https://news.google.com/rss/search?q=%22machine+learning%22+OR+%22artificial+intelligence%22+OR+%22LLM%22+when:1d&hl=en-US&gl=US&ceid=US:en";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TKS-ML-AI-Society/1.0" },
      next: { revalidate: 1800 },
    });
    if (!res.ok) throw new Error(`News feed error ${res.status}`);
    const xml = await res.text();
    const items = parseRss(xml);
    return NextResponse.json(
      { items, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } },
    );
  } catch {
    return NextResponse.json(
      { items: [], fetchedAt: new Date().toISOString(), error: "News unavailable right now." },
      { status: 200, headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  }
}
