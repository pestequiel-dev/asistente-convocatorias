import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";
import { fetchDocText } from "@/lib/docs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  const db = getDb();
  const docs = db
    .prepare("SELECT id, label, url, kind, length(content) AS chars, created_at FROM profile_docs ORDER BY id")
    .all();
  return NextResponse.json({ docs });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { label?: string; url?: string; kind?: string };
  const label = (body.label || "").trim();
  const url = (body.url || "").trim();
  const kind = (body.kind || "otro").trim();

  if (!label) return NextResponse.json({ error: "Poné un nombre al documento" }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: "El link tiene que empezar con http" }, { status: 400 });

  const { content, error } = await fetchDocText(url);
  const db = getDb();
  const info = db
    .prepare("INSERT INTO profile_docs (label, url, kind, content, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(label, url, kind, content || null, nowIso());

  const doc = db
    .prepare("SELECT id, label, url, kind, length(content) AS chars, created_at FROM profile_docs WHERE id = ?")
    .get(Number(info.lastInsertRowid));

  return NextResponse.json({ doc, warning: error ?? null }, { status: 201 });
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  const db = getDb();
  db.prepare("DELETE FROM profile_docs WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
