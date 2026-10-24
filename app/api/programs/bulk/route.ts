import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";

export const dynamic = "force-dynamic";

function normalise(raw: string): string | null {
  const m = raw.match(/https?:\/\/[^\s"'<>)\]]+/i);
  if (!m) return null;
  try {
    const u = new URL(m[0]);
    u.hash = "";
    for (const p of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"]) {
      u.searchParams.delete(p);
    }
    return u.toString();
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { urls?: string };
  const text = body.urls ?? "";

  const db = getDb();
  const existing = new Set(
    (db.prepare("SELECT url FROM programs").all() as { url: string }[]).map((r) => r.url)
  );

  const seen = new Set<string>();
  const toInsert: string[] = [];

  for (const chunk of text.split(/[\n\r,;]+/)) {
    const url = normalise(chunk);
    if (!url || seen.has(url) || existing.has(url)) continue;
    seen.add(url);
    toInsert.push(url);
  }

  const now = nowIso();
  const insert = db.prepare(
    `INSERT INTO programs (url, status, pipeline_status, created_at, updated_at, kind)
     VALUES (?, 'queued', 'reviewing', ?, ?, 'convocatoria')`
  );

  const insertMany = db.transaction((urls: string[]) => {
    for (const u of urls) insert.run(u, now, now);
  });
  insertMany(toInsert.slice(0, 1000));

  return NextResponse.json({
    created: Math.min(toInsert.length, 1000),
    skipped: text.split(/[\n\r,;]+/).filter((x) => x.trim()).length - toInsert.length,
  });
}
