import { NextResponse } from "next/server";
import { getDb, logEvent, nowIso } from "@/lib/db";
import { statusLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const events = db
    .prepare("SELECT id, kind, detail, created_at FROM program_events WHERE program_id = ? ORDER BY id DESC LIMIT 100")
    .all(Number(id));
  return NextResponse.json({ events });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { detail?: string; status?: string };
  const detail = (body.detail ?? "").trim().slice(0, 800);
  if (!detail) return NextResponse.json({ error: "Escribí qué pasó." }, { status: 400 });

  const db = getDb();
  const program = db.prepare("SELECT id FROM programs WHERE id = ?").get(Number(id));
  if (!program) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  logEvent(Number(id), "nota", detail);
  if (body.status) {
    db.prepare("UPDATE programs SET pipeline_status = ?, updated_at = ? WHERE id = ?").run(body.status, nowIso(), Number(id));
    logEvent(Number(id), "estado", `Estado: ${statusLabel(body.status)}`);
  }
  return NextResponse.json({ ok: true });
}
