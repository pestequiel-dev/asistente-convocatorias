import { NextResponse } from "next/server";
import { getDb, nowIso } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const milestones = db.prepare("SELECT * FROM milestones ORDER BY achieved_at DESC, id DESC").all();
  return NextResponse.json({ milestones });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });

  const db = getDb();
  const achieved = String(body.achieved_at ?? "").trim() || nowIso().slice(0, 10);
  const info = db
    .prepare("INSERT INTO milestones (title, kind, description, metric, achieved_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(title, body.kind ?? null, body.description ?? null, body.metric ?? null, achieved, nowIso());

  return NextResponse.json(
    { milestone: db.prepare("SELECT * FROM milestones WHERE id = ?").get(Number(info.lastInsertRowid)) },
    { status: 201 }
  );
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  getDb().prepare("DELETE FROM milestones WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
